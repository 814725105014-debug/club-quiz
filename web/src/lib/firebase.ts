import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  RecaptchaVerifier,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut,
  updateProfile,
  type Auth,
  type ConfirmationResult,
  type User,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

/** Public web-app identifiers served by `GET /api/public/runtime` (never secrets). */
export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let confirmationResult: ConfirmationResult | null = null;

/** True once a runtime config with a usable API key has been applied. */
export function initFirebase(config: FirebaseWebConfig | null): boolean {
  if (!config?.apiKey || !config.authDomain || !config.projectId || !config.appId) return false;
  if (app) return true;
  app = getApps()[0] ?? initializeApp(config);
  authInstance = getAuth(app);
  // Sessions survive a reload but stay scoped to this browser profile.
  void setPersistence(authInstance, browserLocalPersistence).catch(() => undefined);
  dbInstance = getFirestore(app);
  return true;
}

export function getFirebaseAuth(): Auth {
  if (!authInstance) throw new Error('Firebase Auth has not been initialised.');
  return authInstance;
}

export function getFirebaseDb(): Firestore {
  if (!dbInstance) throw new Error('Firestore has not been initialised.');
  return dbInstance;
}

export function watchAuth(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(getFirebaseAuth(), callback);
}

/* ------------------------------------------------------------------ */
/* Sign-in methods                                                     */
/* ------------------------------------------------------------------ */

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
  return credential.user;
}

/** Self-service sign-up is disabled for administrators; kept for provisioning flows. */
export async function registerWithEmail(email: string, password: string, name?: string): Promise<User> {
  const credential = await createUserWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
  if (name) await updateProfile(credential.user, { displayName: name });
  return credential.user;
}

export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  // Force the account chooser so a shared lab laptop cannot silently reuse a session.
  provider.setCustomParameters({ prompt: 'select_account' });
  const credential = await signInWithPopup(getFirebaseAuth(), provider);
  return credential.user;
}

export async function sendReset(email: string): Promise<void> {
  await sendPasswordResetEmail(getFirebaseAuth(), email.trim());
}

export async function signOutFirebase(): Promise<void> {
  await signOut(getFirebaseAuth());
}

/* ------------------------------------------------------------------ */
/* Phone authentication (implemented, disabled until Blaze is approved) */
/* ------------------------------------------------------------------ */

export function createRecaptchaVerifier(containerId: string): RecaptchaVerifier {
  return new RecaptchaVerifier(getFirebaseAuth(), containerId, { size: 'invisible' });
}

export async function startPhoneSignIn(phoneNumber: string, verifier: RecaptchaVerifier): Promise<void> {
  confirmationResult = await signInWithPhoneNumber(getFirebaseAuth(), phoneNumber.trim(), verifier);
}

export async function confirmPhoneCode(code: string): Promise<User> {
  if (!confirmationResult) throw new Error('Request a verification code first.');
  const credential = await confirmationResult.confirm(code.trim());
  confirmationResult = null;
  return credential.user;
}

/* ------------------------------------------------------------------ */
/* Error messages                                                      */
/* ------------------------------------------------------------------ */

const MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'That email address is not valid.',
  'auth/user-disabled': 'This account has been disabled. Contact the platform administrator.',
  'auth/user-not-found': 'No administrator account uses that email address.',
  'auth/wrong-password': 'Email or password is incorrect.',
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/popup-closed-by-user': 'The Google sign-in window was closed before completing.',
  'auth/popup-blocked': 'Your browser blocked the sign-in popup. Allow popups for this site and retry.',
  'auth/cancelled-popup-request': 'Another sign-in attempt is already in progress.',
  'auth/unauthorized-domain':
    'This domain is not authorised for Firebase sign-in. Add it under Authentication → Settings → Authorized domains, or run the app on localhost.',
  'auth/operation-not-allowed': 'That sign-in method is not enabled in the Firebase project yet.',
  'auth/network-request-failed': 'Could not reach Firebase. Check the network and try again.',
  'auth/invalid-verification-code': 'That verification code is not correct.',
  'auth/missing-phone-number': 'Enter a phone number in international format, e.g. +91 98765 43210.',
  'auth/quota-exceeded': 'The SMS quota for this project has been exhausted. Try again later.',
};

export function firebaseAuthErrorMessage(err: unknown): string {
  const code = (err as { code?: string } | null)?.code;
  if (code && MESSAGES[code]) return MESSAGES[code];
  const message = (err as Error | null)?.message;
  return message || 'Sign-in failed. Please try again.';
}
