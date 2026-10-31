import fs from 'node:fs';
import { cert, getApps, initializeApp, applicationDefault, type App } from 'firebase-admin/app';
import { getAuth, type Auth, type DecodedIdToken } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { env } from '../env.js';
import { ApiError } from '../lib/http.js';

/**
 * Server-side Firebase: verifies admin ID tokens and (optionally) mirrors domain
 * records into Firestore. Credentials never reach the browser.
 */

let appPromise: App | null = null;
let firestoreInstance: Firestore | null = null;

function serviceAccount(): Record<string, unknown> | null {
  const inline = env.firebase.serviceAccountJson.trim();
  if (inline) {
    try {
      return JSON.parse(inline) as Record<string, unknown>;
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.');
    }
  }
  const file = env.firebase.serviceAccountFile.trim();
  if (file) {
    if (!fs.existsSync(file)) throw new Error(`FIREBASE_SERVICE_ACCOUNT_FILE not found: ${file}`);
    return JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
  }
  return null;
}

/** True when the server can actually verify tokens (auth mode alone is not enough). */
export function firebaseAdminConfigured(): boolean {
  return Boolean(
    env.firebase.serviceAccountJson.trim() ||
      env.firebase.serviceAccountFile.trim() ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS,
  );
}

export function getFirebaseApp(): App {
  if (!appPromise) {
    const existing = getApps()[0];
    if (existing) {
      appPromise = existing;
    } else {
      const account = serviceAccount();
      appPromise = initializeApp(
        account
          ? {
              credential: cert(account as Parameters<typeof cert>[0]),
              projectId: env.firebase.projectId,
            }
          : {
              credential: applicationDefault(),
              projectId: env.firebase.projectId,
            },
      );
    }
  }
  return appPromise;
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

export function getFirestoreDb(): Firestore {
  if (!firestoreInstance) {
    firestoreInstance = getFirestore(getFirebaseApp());
  }
  return firestoreInstance;
}

/* ------------------------------------------------------------------ */
/* Token verification                                                  */
/* ------------------------------------------------------------------ */

interface CachedToken {
  decoded: DecodedIdToken;
  expiresAt: number;
}

const verifiedCache = new Map<string, CachedToken>();
const CACHE_MS = 5 * 60 * 1000;

/**
 * Verifies a Firebase ID token. Results are cached briefly because the signature check
 * fetches Google's public keys — the cache keeps a busy dashboard from re-verifying the
 * same token on every request. Revocation is enforced by the users table instead, which
 * is the authoritative source of role and activation state.
 */
export async function verifyFirebaseIdToken(idToken: string): Promise<DecodedIdToken> {
  const cached = verifiedCache.get(idToken);
  if (cached && cached.expiresAt > Date.now()) return cached.decoded;

  if (!firebaseAdminConfigured()) {
    throw new ApiError(
      503,
      'Firebase Authentication is enabled but the server has no service account. Set FIREBASE_SERVICE_ACCOUNT_FILE (or FIREBASE_SERVICE_ACCOUNT_JSON) on the API host.',
      'firebase_not_configured',
    );
  }

  let decoded: DecodedIdToken;
  try {
    decoded = await getFirebaseAuth().verifyIdToken(idToken);
  } catch (err) {
    const message = (err as Error).message || 'invalid token';
    throw new ApiError(401, `Your sign-in session is not valid. Please sign in again. (${message})`, 'invalid_token');
  }

  for (const [key, value] of verifiedCache) {
    if (value.expiresAt <= Date.now()) verifiedCache.delete(key);
  }
  verifiedCache.set(idToken, { decoded, expiresAt: Date.now() + CACHE_MS });
  return decoded;
}

/** Role carried in custom claims, used when provisioning a brand-new administrator. */
export function claimRole(decoded: DecodedIdToken): string | undefined {
  const value = (decoded as unknown as Record<string, unknown>).role;
  return typeof value === 'string' ? value : undefined;
}

/**
 * Creates or updates the Firebase user that matches an administrator row and stamps the
 * role into custom claims (convenience for Firestore rules; the API still trusts the DB).
 */
export async function upsertFirebaseUser(input: {
  email: string;
  password?: string;
  displayName?: string;
  role?: string;
  disabled?: boolean;
}): Promise<{ uid: string; created: boolean }> {
  const auth = getFirebaseAuth();
  let uid: string;
  let created = false;
  try {
    const existing = await auth.getUserByEmail(input.email);
    uid = existing.uid;
    const patch: Parameters<Auth['updateUser']>[1] = {
      ...(input.displayName ? { displayName: input.displayName } : {}),
      ...(input.disabled === undefined ? {} : { disabled: input.disabled }),
    };
    if (input.password) patch.password = input.password;
    if (Object.keys(patch).length) await auth.updateUser(uid, patch);
    if (input.role) await auth.setCustomUserClaims(uid, { role: input.role });
  } catch {
    const createdUser = await auth.createUser({
      email: input.email,
      password: input.password,
      displayName: input.displayName,
      disabled: input.disabled ?? false,
    });
    uid = createdUser.uid;
    created = true;
    if (input.role) await auth.setCustomUserClaims(uid, { role: input.role });
  }
  return { uid, created };
}

export async function revokeFirebaseRefreshTokens(uid: string): Promise<void> {
  try {
    await getFirebaseAuth().revokeRefreshTokens(uid);
  } catch {
    /* best effort: the users table already blocks the account */
  }
}

/* ------------------------------------------------------------------ */
/* Firestore mirror                                                    */
/* ------------------------------------------------------------------ */

export type MirrorCollection =
  | 'quizzes'
  | 'participants'
  | 'attempts'
  | 'certificates'
  | 'registrationFields'
  | 'auditLog';

/**
 * Writes/merges a document into Firestore. Disabled unless FIRESTORE_MIRROR=true, in
 * which case SQLite stays the transactional source of truth and Firestore receives a
 * denormalised, answer-key-free projection for dashboards and rules-protected reads.
 */
export async function mirrorDocument(
  collection: MirrorCollection,
  id: string,
  data: Record<string, unknown>,
): Promise<boolean> {
  if (!env.firebase.mirror) return false;
  if (!firebaseAdminConfigured()) {
    console.warn(`[firestore] mirror requested for ${collection}/${id} but no credentials are configured`);
    return false;
  }
  await getFirestoreDb()
    .collection(collection)
    .doc(id)
    .set({ ...data, updatedAt: new Date().toISOString() }, { merge: true });
  return true;
}

export async function deleteMirrorDocument(collection: MirrorCollection, id: string): Promise<boolean> {
  if (!env.firebase.mirror || !firebaseAdminConfigured()) return false;
  await getFirestoreDb().collection(collection).doc(id).delete();
  return true;
}
