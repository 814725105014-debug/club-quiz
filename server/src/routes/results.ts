import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { getDb } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { ApiError, asyncHandler, parse } from '../lib/http.js';
import { recordAudit } from '../audit.js';
import { toCsv } from '../lib/csv.js';
import { env } from '../env.js';
import { certificateFileName } from '../services/google.js';
import {
  emailList,
  dashboardStats,
  quizAnalytics,
  recentActivity,
  resultsList,
} from '../services/stats.js';
import {
  regenerateCertificate,
  retryCertificate,
  verifyCertificate,
} from '../services/certificates.js';
import { enqueueJob, retryJob } from '../services/jobs.js';
import { queueEmail, wrapEmailHtml } from '../services/email.js';
import { getWorkspaceConfig } from '../services/config.js';
import type { CertificateRow, EmailRow, QuizRow } from '../domain.js';

export const resultsRouter = Router();
resultsRouter.use(requireAuth);

resultsRouter.get(
  '/dashboard',
  asyncHandler(async (_req, res) => {
    res.json({
      stats: dashboardStats(),
      activity: recentActivity(10),
      upcoming: getDb()
        .prepare(
          `SELECT id, title, status, start_at, end_at, join_code, duration_minutes FROM quizzes
           WHERE status IN ('scheduled','published','active','paused')
           ORDER BY COALESCE(start_at, '9999') ASC LIMIT 5`,
        )
        .all(),
    });
  }),
);

resultsRouter.get(
  '/results',
  asyncHandler(async (req, res) => {
    const data = resultsList({
      quizId: req.query.quizId ? String(req.query.quizId) : undefined,
      search: req.query.search ? String(req.query.search) : undefined,
      result: req.query.result === 'pass' || req.query.result === 'fail' ? req.query.result : undefined,
      certificateStatus: req.query.certificateStatus ? String(req.query.certificateStatus) : undefined,
      emailStatus: req.query.emailStatus ? String(req.query.emailStatus) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      offset: req.query.offset ? Number(req.query.offset) : undefined,
      sort: (req.query.sort as 'submitted_desc' | 'score_desc' | 'score_asc' | 'name_asc') ?? undefined,
    });
    res.json(data);
  }),
);

resultsRouter.get(
  '/results/export.csv',
  asyncHandler(async (req, res) => {
    const { rows } = resultsList({
      quizId: req.query.quizId ? String(req.query.quizId) : undefined,
      search: req.query.search ? String(req.query.search) : undefined,
      limit: 500,
    });
    const csv = toCsv(
      [
        'Participant Name',
        'Register Number',
        'Department',
        'Email',
        'Quiz',
        'Score',
        'Total Marks',
        'Percentage',
        'Result',
        'Status',
        'Submitted At',
        'Duration (seconds)',
        'Violations',
        'Certificate Status',
        'Certificate ID',
        'PDF URL',
        'Email Status',
      ],
      rows.map((r) => [
        r.name,
        r.regNumber ?? '',
        r.department ?? '',
        r.email,
        r.quizTitle,
        r.score,
        r.totalMarks,
        r.percentage.toFixed(2),
        r.passed ? 'PASS' : 'FAIL',
        r.status,
        r.submittedAt ?? '',
        r.durationSeconds ?? '',
        r.violations,
        r.certificateStatus ?? 'not_applicable',
        r.certificateId ?? '',
        r.pdfUrl ?? '',
        r.emailStatus ?? '',
      ]),
    );
    recordAudit(req, 'results.export', 'results', req.query.quizId ? String(req.query.quizId) : 'all', {
      rows: rows.length,
    });
    res.type('text/csv').setHeader('Content-Disposition', 'attachment; filename="quiz-results.csv"');
    res.send(csv);
  }),
);

resultsRouter.get(
  '/results/:attemptId',
  asyncHandler(async (req, res) => {
    const db = getDb();
    const attempt = db
      .prepare(
        `SELECT a.*, p.name, p.email, p.reg_number, p.department, q.title AS quiz_title,
          c.status AS certificate_status, c.certificate_id, c.pdf_url, c.email_status, c.error AS certificate_error
         FROM attempts a JOIN participants p ON p.id = a.participant_id JOIN quizzes q ON q.id = a.quiz_id
         LEFT JOIN certificates c ON c.attempt_id = a.id WHERE a.id = ?`,
      )
      .get(req.params.attemptId) as Record<string, unknown> | undefined;
    if (!attempt) throw new ApiError(404, 'Attempt not found.', 'attempt_not_found');
    const answers = db
      .prepare(
        `SELECT aa.*, qq.text AS question_text, qq.type AS question_type, qq.marks AS question_marks
         FROM attempt_answers aa JOIN questions qq ON qq.id = aa.question_id
         WHERE aa.attempt_id = ?`,
      )
      .all(req.params.attemptId);
    const violations = db
      .prepare('SELECT * FROM violations WHERE attempt_id = ? ORDER BY created_at ASC')
      .all(req.params.attemptId);
    const emails = db
      .prepare('SELECT id, template_key, to_email, actual_recipient, status, error, created_at FROM emails WHERE attempt_id = ? ORDER BY created_at ASC')
      .all(req.params.attemptId);
    res.json({ attempt, answers, violations, emails });
  }),
);

/* ----------------------------- certificates ----------------------------- */

resultsRouter.get(
  '/certificates',
  asyncHandler(async (req, res) => {
    const db = getDb();
    const where: string[] = ['1=1'];
    const params: string[] = [];
    if (req.query.quizId) {
      where.push('c.quiz_id = ?');
      params.push(String(req.query.quizId));
    }
    if (req.query.status) {
      where.push('c.status = ?');
      params.push(String(req.query.status));
    }
    if (req.query.search) {
      where.push('(lower(p.name) LIKE ? OR lower(c.certificate_id) LIKE ?)');
      params.push(`%${String(req.query.search).toLowerCase()}%`, `%${String(req.query.search).toLowerCase()}%`);
    }
    const certificates = db
      .prepare(
        `SELECT c.*, p.name AS participant_name, p.email AS participant_email, p.reg_number,
          q.title AS quiz_title FROM certificates c
         JOIN participants p ON p.id = c.participant_id JOIN quizzes q ON q.id = c.quiz_id
         WHERE ${where.join(' AND ')} ORDER BY c.created_at DESC LIMIT 300`,
      )
      .all(...params);
    res.json({ certificates });
  }),
);

resultsRouter.post(
  '/certificates/:id/retry',
  requireRole('quiz_admin'),
  asyncHandler(async (req, res) => {
    retryCertificate(req.params.id, 'issue');
    recordAudit(req, 'certificate.retry', 'certificate', req.params.id, null);
    res.json({ ok: true });
  }),
);

resultsRouter.post(
  '/certificates/:id/retry-email',
  requireRole('quiz_admin'),
  asyncHandler(async (req, res) => {
    retryCertificate(req.params.id, 'email');
    recordAudit(req, 'certificate.retry_email', 'certificate', req.params.id, null);
    res.json({ ok: true });
  }),
);

resultsRouter.post(
  '/certificates/:id/regenerate',
  requireRole('quiz_admin'),
  asyncHandler(async (req, res) => {
    regenerateCertificate(req.params.id);
    recordAudit(req, 'certificate.regenerate', 'certificate', req.params.id, null);
    res.json({ ok: true });
  }),
);

resultsRouter.get(
  '/certificates/:id/download',
  asyncHandler(async (req, res) => {
    const cert = getDb().prepare('SELECT * FROM certificates WHERE id = ?').get(req.params.id) as
      | CertificateRow
      | undefined;
    if (!cert) throw new ApiError(404, 'Certificate not found.', 'certificate_not_found');
    const local = path.join(env.certDir, certificateFileName(cert.certificate_id));
    recordAudit(req, 'certificate.download', 'certificate', cert.id, null);
    if (fs.existsSync(local)) {
      res.download(local, `${cert.certificate_id.replace(/[^A-Za-z0-9]+/g, '-')}.pdf`);
      return;
    }
    if (cert.pdf_url) {
      res.redirect(cert.pdf_url);
      return;
    }
    throw new ApiError(404, 'The certificate PDF is not available yet.', 'pdf_missing');
  }),
);

resultsRouter.get(
  '/certificates/verify/:certificateId',
  asyncHandler(async (req, res) => {
    res.json(verifyCertificate(req.params.certificateId));
  }),
);

/* ----------------------------- emails ----------------------------- */

resultsRouter.get(
  '/emails',
  asyncHandler(async (req, res) => {
    const emails = emailList({
      status: req.query.status ? String(req.query.status) : undefined,
      search: req.query.search ? String(req.query.search) : undefined,
    });
    res.json({ emails });
  }),
);

resultsRouter.post(
  '/emails/:id/resend',
  requireRole('quiz_admin'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const email = db.prepare('SELECT * FROM emails WHERE id = ?').get(req.params.id) as EmailRow | undefined;
    if (!email) throw new ApiError(404, 'Email not found.', 'email_not_found');
    if (email.certificate_id) {
      const cert = db.prepare('SELECT * FROM certificates WHERE id = ?').get(email.certificate_id) as
        | CertificateRow
        | undefined;
      if (!cert) throw new ApiError(409, 'The certificate for this email no longer exists.', 'certificate_missing');
      db.prepare(`UPDATE certificates SET email_status = 'pending', email_error = NULL WHERE id = ?`).run(cert.id);
      retryCertificate(cert.id, 'email');
    } else {
      db.prepare(`UPDATE emails SET status = 'queued', error = NULL WHERE id = ?`).run(email.id);
      enqueueJob('send_email', { emailId: email.id });
    }
    recordAudit(req, 'email.resend', 'email', email.id, { to: email.to_email });
    res.json({ ok: true });
  }),
);

resultsRouter.post(
  '/emails/test',
  requireRole('quiz_admin'),
  asyncHandler(async (req, res) => {
    const input = parse(
      z.object({ to: z.string().email().optional(), subject: z.string().max(200).optional(), body: z.string().max(4000).optional() }),
      req.body,
    );
    const cfg = getWorkspaceConfig();
    const recipient = input.to || cfg.emailRedirectTo || cfg.emailFrom;
    const html = wrapEmailHtml(
      input.body || '<p>This is a test message from the QUIZ PLATFORM email pipeline. Delivery, templates and logging are working.</p>',
      { title: 'QUIZ PLATFORM test email' },
    );
    const emailId = queueEmail({
      templateKey: 'test',
      to: recipient,
      subject: input.subject || 'QUIZ PLATFORM — email pipeline test',
      html,
    });
    enqueueJob('send_email', { emailId });
    recordAudit(req, 'email.test', 'email', emailId, { to: recipient });
    res.status(201).json({ emailId, recipient, testMode: cfg.emailTestMode });
  }),
);

/* ----------------------------- analytics / audit / jobs ----------------------------- */

resultsRouter.get(
  '/analytics/:quizId',
  asyncHandler(async (req, res) => {
    const quiz = getDb().prepare('SELECT * FROM quizzes WHERE id = ?').get(req.params.quizId) as
      | QuizRow
      | undefined;
    if (!quiz) throw new ApiError(404, 'Quiz not found.', 'quiz_not_found');
    res.json({ quiz, analytics: quizAnalytics(quiz.id) });
  }),
);

resultsRouter.get(
  '/audit',
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 200, 500);
    const rows = getDb()
      .prepare(
        `SELECT id, actor_email, action, entity, entity_id, detail, ip, created_at FROM audit_log
         ORDER BY id DESC LIMIT ?`,
      )
      .all(limit);
    res.json({ entries: rows });
  }),
);

resultsRouter.get(
  '/jobs',
  asyncHandler(async (_req, res) => {
    const rows = getDb()
      .prepare(
        `SELECT id, job_type, status, attempts, last_error, run_after, created_at, updated_at FROM sync_jobs
         ORDER BY created_at DESC LIMIT 100`,
      )
      .all();
    res.json({ jobs: rows });
  }),
);

resultsRouter.post(
  '/jobs/:id/retry',
  requireRole('quiz_admin'),
  asyncHandler(async (req, res) => {
    retryJob(req.params.id);
    recordAudit(req, 'job.retry', 'job', req.params.id, null);
    res.json({ ok: true });
  }),
);
