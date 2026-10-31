import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { env } from './env.js';
import { getDb } from './db.js';
import { ApiError } from './lib/http.js';
import { newId, randomToken } from './lib/ids.js';

export type Role = 'super_admin' | 'quiz_admin' | 'quiz_host' | 'results_viewer';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: AdminUser;
      sessionId?: string;
    }
  }
}

const ROLE_RANK: Record<Role, number> = {
  results_viewer: 1,
  quiz_host: 2,
  quiz_admin: 3,
  super_admin: 4,
};

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super Admin',
  quiz_admin: 'Quiz Administrator',
  quiz_host: 'Quiz Host',
  results_viewer: 'Results Viewer',
};

export function hasRole(user: AdminUser | undefined, minimum: Role): boolean {
  if (!user) return false;
  return ROLE_RANK[user.role] >= ROLE_RANK[minimum];
}

/* ------------------------------------------------------------------ */
/* Password hashing (scrypt, no native dependency)                     */
/* ------------------------------------------------------------------ */

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString('base64')}$${derived.toString('base64')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, N, r, p, saltB64, hashB64] = stored.split('$');
    if (scheme !== 'scrypt') return false;
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(hashB64, 'base64');
    const derived = crypto.scryptSync(password, salt, expected.length, {
      N: Number(N),
      r: Number(r),
      p: Number(p),
    });
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Sessions                                                            */
/* ------------------------------------------------------------------ */

const COOKIE_NAME = 'qp_session';

export function createSession(
  user: AdminUser,
  meta: { ip?: string; userAgent?: string },
): { token: string; expiresAt: string } {
  const sessionId = newId('sess');
  const expiresAt = new Date(Date.now() + env.sessionHours * 3600_000).toISOString();
  getDb()
    .prepare(
      `INSERT INTO sessions (id, user_id, created_at, expires_at, ip, user_agent)
       VALUES (?, ?, datetime('now'), ?, ?, ?)`,
    )
    .run(sessionId, user.id, expiresAt, meta.ip ?? '', meta.userAgent ?? '');
  const token = jwt.sign({ sid: sessionId, uid: user.id, role: user.role }, env.sessionSecret, {
    expiresIn: `${env.sessionHours}h`,
  });
  return { token, expiresAt };
}

export function setSessionCookie(res: Response, token: string, expiresAt: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProduction,
    expires: new Date(expiresAt),
    path: '/',
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

export function revokeSession(sessionId: string): void {
  getDb().prepare('UPDATE sessions SET revoked = 1 WHERE id = ?').run(sessionId);
}

export function authenticate(req: Request): AdminUser | undefined {
  const raw = req.cookies?.[COOKIE_NAME] as string | undefined;
  if (!raw) return undefined;
  try {
    const payload = jwt.verify(raw, env.sessionSecret) as { sid: string; uid: string; role: Role };
    const session = getDb()
      .prepare('SELECT id, user_id, expires_at, revoked FROM sessions WHERE id = ?')
      .get(payload.sid) as
      | { id: string; user_id: string; expires_at: string; revoked: number }
      | undefined;
    if (!session || session.revoked || new Date(session.expires_at).getTime() < Date.now()) {
      return undefined;
    }
    const user = getDb()
      .prepare('SELECT id, email, name, role, is_active FROM users WHERE id = ?')
      .get(payload.uid) as
      | { id: string; email: string; name: string; role: Role; is_active: number }
      | undefined;
    if (!user || !user.is_active) return undefined;
    req.sessionId = session.id;
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  } catch {
    return undefined;
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const user = authenticate(req);
  if (!user) {
    next(new ApiError(401, 'Authentication required. Please sign in.', 'unauthenticated'));
    return;
  }
  req.admin = user;
  next();
}

export function requireRole(minimum: Role) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.admin) {
      next(new ApiError(401, 'Authentication required. Please sign in.', 'unauthenticated'));
      return;
    }
    if (!hasRole(req.admin, minimum)) {
      next(new ApiError(403, 'Your role does not allow this action.', 'forbidden'));
      return;
    }
    next();
  };
}

/* ------------------------------------------------------------------ */
/* Participant & attempt tokens (signed, scoped)                       */
/* ------------------------------------------------------------------ */

export interface ParticipantClaims {
  pid: string;
  qid: string;
  kind: 'participant';
}

export interface AttemptClaims {
  aid: string;
  pid: string;
  qid: string;
  kind: 'attempt';
}

export function signParticipantToken(pid: string, qid: string): string {
  return jwt.sign({ pid, qid, kind: 'participant' }, env.sessionSecret, { expiresIn: '12h' });
}

export function signAttemptToken(aid: string, pid: string, qid: string): string {
  return jwt.sign({ aid, pid, qid, kind: 'attempt' }, env.sessionSecret, { expiresIn: '12h' });
}

export function verifyParticipantToken(token: string | undefined): ParticipantClaims {
  if (!token) throw new ApiError(401, 'Participant session missing.', 'participant_auth');
  try {
    const claims = jwt.verify(token, env.sessionSecret) as ParticipantClaims;
    if (claims.kind !== 'participant') throw new Error('wrong kind');
    return claims;
  } catch {
    throw new ApiError(401, 'Participant session expired. Please register again.', 'participant_auth');
  }
}

export function verifyAttemptToken(token: string | undefined): AttemptClaims {
  if (!token) throw new ApiError(401, 'Attempt token missing.', 'attempt_auth');
  try {
    const claims = jwt.verify(token, env.sessionSecret) as AttemptClaims;
    if (claims.kind !== 'attempt') throw new Error('wrong kind');
    return claims;
  } catch {
    throw new ApiError(401, 'Your attempt session expired. Reopen the quiz to recover it.', 'attempt_auth');
  }
}

export function bearerOrQueryToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  const q = req.query.token;
  return typeof q === 'string' ? q : undefined;
}

export { randomToken };
