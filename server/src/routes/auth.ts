import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { getDb } from '../db.js';
import { env } from '../env.js';
import {
  clearSessionCookie,
  createSession,
  hashPassword,
  requireAuth,
  revokeSession,
  setSessionCookie,
  verifyPassword,
  type Role,
} from '../auth.js';
import { ApiError, asyncHandler, parse } from '../lib/http.js';
import { newId } from '../lib/ids.js';
import { recordAudit } from '../audit.js';
import { enqueueJob } from '../services/jobs.js';
import { queueEmail, wrapEmailHtml } from '../services/email.js';
import { getWorkspaceConfig } from '../services/config.js';
import { bearerToken } from '../auth.js';
import { revokeFirebaseRefreshTokens } from '../services/firebase.js';

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Please wait a few minutes and try again.', code: 'rate_limited' },
});

const resetLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many password reset requests. Please try again later.', code: 'rate_limited' },
});

const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters long.')
  .max(200)
  .refine((v) => /[A-Za-z]/.test(v) && /[0-9]/.test(v), 'Password must include letters and numbers.');

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required.'),
});

authRouter.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    if (env.firebase.mode === 'firebase') {
      throw new ApiError(
        400,
        'This deployment signs administrators in with Firebase Authentication. Use the Firebase form on the sign-in page.',
        'use_firebase_auth',
      );
    }
    const input = parse(loginSchema, req.body);
    const db = getDb();
    const user = db
      .prepare('SELECT * FROM users WHERE lower(email) = lower(?)')
      .get(input.email.trim()) as
      | { id: string; email: string; name: string; role: Role; password_hash: string; is_active: number }
      | undefined;

    const invalid = new ApiError(401, 'Email or password is incorrect.', 'invalid_credentials');
    if (!user || !user.is_active) throw invalid;
    if (!verifyPassword(input.password, user.password_hash)) throw invalid;

    const session = createSession(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      { ip: req.ip, userAgent: req.headers['user-agent'] },
    );
    setSessionCookie(res, session.token, session.expiresAt);
    db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(new Date().toISOString(), user.id);
    recordAudit(req, 'auth.login', 'user', user.id, { email: user.email });
    res.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      expiresAt: session.expiresAt,
    });
  }),
);

authRouter.post('/logout', requireAuth, asyncHandler(async (req, res) => {
  if (env.firebase.mode === 'firebase') {
    const row = getDb().prepare('SELECT firebase_uid FROM users WHERE id = ?').get(req.admin!.id) as
      | { firebase_uid: string | null }
      | undefined;
    if (row?.firebase_uid) await revokeFirebaseRefreshTokens(row.firebase_uid);
  }
  if (req.sessionId) revokeSession(req.sessionId);
  recordAudit(req, 'auth.logout', 'user', req.admin?.id ?? '', null);
  clearSessionCookie(res);
  res.json({ ok: true });
}));

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.admin });
});

authRouter.post(
  '/change-password',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (env.firebase.mode === 'firebase') {
      throw new ApiError(
        400,
        'Passwords are managed by Firebase Authentication. Use “Forgot password” on the sign-in page to reset it.',
        'use_firebase_auth',
      );
    }
    const input = parse(
      z.object({ currentPassword: z.string().min(1), newPassword: passwordSchema }),
      req.body,
    );
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.admin!.id) as {
      password_hash: string;
    };
    if (!verifyPassword(input.currentPassword, user.password_hash)) {
      throw new ApiError(400, 'Your current password is incorrect.', 'invalid_password');
    }
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
      hashPassword(input.newPassword),
      req.admin!.id,
    );
    recordAudit(req, 'auth.change_password', 'user', req.admin!.id, null);
    res.json({ ok: true });
  }),
);

authRouter.post(
  '/forgot-password',
  resetLimiter,
  asyncHandler(async (req, res) => {
    const input = parse(z.object({ email: z.string().email() }), req.body);
    const db = getDb();
    const cfg = getWorkspaceConfig();
    const user = db
      .prepare('SELECT * FROM users WHERE lower(email) = lower(?) AND is_active = 1')
      .get(input.email.trim()) as { id: string; email: string; name: string } | undefined;

    // Always answer 200 so the endpoint cannot be used to enumerate administrators.
    if (user) {
      const token = crypto.randomBytes(32).toString('base64url');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      db.prepare(
        `INSERT INTO password_resets (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)`,
      ).run(newId('prt'), user.id, tokenHash, new Date(Date.now() + 60 * 60 * 1000).toISOString());
      const link = `${cfg.appBaseUrl}/admin/reset?token=${encodeURIComponent(token)}`;
      const html = wrapEmailHtml(
        `<p>Hello ${user.name},</p><p>A password reset was requested for your QUIZ PLATFORM administrator account.</p>
         <p><a href="${link}" style="display:inline-block;background:#2B0B3F;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Reset your password</a></p>
         <p>This link expires in 1 hour. If you did not request it, you can ignore this email.</p>`,
        { title: 'Reset your QUIZ PLATFORM password' },
      );
      const emailId = queueEmail({
        templateKey: 'test',
        to: user.email,
        subject: 'Reset your QUIZ PLATFORM administrator password',
        html,
      });
      enqueueJob('send_email', { emailId });
      recordAudit(req, 'auth.forgot_password', 'user', user.id, null);
    }
    res.json({
      ok: true,
      message: 'If that email belongs to an administrator, a reset link has been sent.',
      testMode: cfg.emailTestMode,
    });
  }),
);

authRouter.post(
  '/reset-password',
  resetLimiter,
  asyncHandler(async (req, res) => {
    const input = parse(z.object({ token: z.string().min(20), password: passwordSchema }), req.body);
    const db = getDb();
    const tokenHash = crypto.createHash('sha256').update(input.token).digest('hex');
    const record = db
      .prepare(`SELECT * FROM password_resets WHERE token_hash = ? AND used = 0`)
      .get(tokenHash) as { id: string; user_id: string; expires_at: string } | undefined;
    if (!record || new Date(record.expires_at).getTime() < Date.now()) {
      throw new ApiError(400, 'This reset link is invalid or has expired.', 'invalid_reset_token');
    }
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(input.password), record.user_id);
    db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(record.id);
    db.prepare('UPDATE sessions SET revoked = 1 WHERE user_id = ?').run(record.user_id);
    recordAudit(req, 'auth.reset_password', 'user', record.user_id, null);
    res.json({ ok: true });
  }),
);

authRouter.get('/session-policy', (_req, res) => {
  res.json({ sessionHours: env.sessionHours, timezone: env.timezone });
});
