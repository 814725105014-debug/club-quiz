import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode';
import rateLimit from 'express-rate-limit';
import { getDb } from '../db.js';
import { env } from '../env.js';
import { ApiError, asyncHandler, requestBaseUrl } from '../lib/http.js';
import { findQuizByJoinCode } from '../services/attempts.js';
import { verifyCertificate } from '../services/certificates.js';
import { certificateFileName } from '../services/google.js';
import { getWorkspaceConfig } from '../services/config.js';
import type { CertificateRow, QuizRow } from '../domain.js';

export const publicRouter = Router();

const verifyLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many verification requests. Please try again shortly.', code: 'rate_limited' },
});

publicRouter.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'quiz-platform', time: new Date().toISOString() });
});

/**
 * Public runtime configuration for the SPA. Contains only public identifiers — the
 * Firebase web config is designed to be shipped to browsers; access control lives in
 * Firestore rules and custom claims, and the service account never leaves the server.
 */
publicRouter.get('/runtime', (_req, res) => {
  res.json({
    authMode: env.firebase.mode,
    firebase: env.firebase.mode === 'firebase' ? env.firebase.web : null,
    projectId: env.firebase.projectId,
    firestoreMirror: env.firebase.mirror,
    providers: env.firebase.mode === 'firebase' ? ['password', 'google'] : [],
    phoneAuthEnabled: false,
    platform: { timezone: env.timezone },
  });
});

publicRouter.get(
  '/verify/:certificateId',
  verifyLimiter,
  asyncHandler(async (req, res) => {
    res.json(verifyCertificate(decodeURIComponent(req.params.certificateId)));
  }),
);

publicRouter.get(
  '/certificates/:certificateId/download',
  verifyLimiter,
  asyncHandler(async (req, res) => {
    const certificateId = decodeURIComponent(req.params.certificateId);
    const cert = getDb()
      .prepare('SELECT * FROM certificates WHERE certificate_id = ?')
      .get(certificateId) as CertificateRow | undefined;
    if (!cert || cert.status !== 'generated') {
      throw new ApiError(404, 'This certificate is not available for download.', 'certificate_unavailable');
    }
    const local = path.join(env.certDir, certificateFileName(cert.certificate_id));
    if (fs.existsSync(local)) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${certificateId.replace(/[^A-Za-z0-9]+/g, '-')}.pdf"`);
      fs.createReadStream(local).pipe(res);
      return;
    }
    if (cert.pdf_url) {
      res.redirect(cert.pdf_url);
      return;
    }
    throw new ApiError(404, 'The certificate file is not available.', 'certificate_unavailable');
  }),
);

publicRouter.get(
  '/presentation/:joinCode',
  asyncHandler(async (req, res) => {
    const quiz = findQuizByJoinCode(req.params.joinCode);
    const db = getDb();
    const cfg = getWorkspaceConfig();
    const participants = (
      db.prepare('SELECT COUNT(*) AS n FROM participants WHERE quiz_id = ?').get(quiz.id) as { n: number }
    ).n;
    const attempts = db
      .prepare(
        `SELECT
          SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS attending,
          SUM(CASE WHEN status != 'in_progress' THEN 1 ELSE 0 END) AS submitted,
          COUNT(*) AS joined
         FROM attempts WHERE quiz_id = ?`,
      )
      .get(quiz.id) as { attending: number | null; submitted: number | null; joined: number | null };
    const announcements = db
      .prepare('SELECT message, created_at FROM announcements WHERE quiz_id = ? ORDER BY created_at DESC LIMIT 3')
      .all(quiz.id) as { message: string; created_at: string }[];
    res.json({
      quiz: {
        title: quiz.title,
        joinCode: quiz.join_code,
        status: quiz.status,
        startAt: quiz.start_at,
        endAt: quiz.end_at,
        durationMinutes: quiz.duration_minutes,
        announcement: quiz.announcement,
        totalMarks: (
          db.prepare('SELECT COALESCE(SUM(marks),0) AS m FROM questions WHERE quiz_id = ?').get(quiz.id) as { m: number }
        ).m,
        questionCount: (
          db.prepare('SELECT COUNT(*) AS n FROM questions WHERE quiz_id = ?').get(quiz.id) as { n: number }
        ).n,
      },
      joinUrl: `${requestBaseUrl(req, cfg.appBaseUrl, env.isProduction)}/j/${quiz.join_code}`,
      participants: {
        registered: participants,
        joined: attempts.joined ?? 0,
        attending: attempts.attending ?? 0,
        submitted: attempts.submitted ?? 0,
      },
      announcements,
      organization: {
        name: cfg.organizationName,
        department: cfg.department,
        line: cfg.institutionLine,
      },
      serverTime: new Date().toISOString(),
    });
  }),
);

publicRouter.get(
  '/qr/:joinCode.png',
  asyncHandler(async (req, res) => {
    const quiz: QuizRow = findQuizByJoinCode(req.params.joinCode);
    const cfg = getWorkspaceConfig();
    const buffer = await QRCode.toBuffer(`${requestBaseUrl(req, cfg.appBaseUrl, env.isProduction)}/j/${quiz.join_code}`, {
      width: Math.min(Number(req.query.size) || 700, 1400),
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#120718', light: '#FFFFFF' },
    });
    res.type('png');
    res.send(buffer);
  }),
);
