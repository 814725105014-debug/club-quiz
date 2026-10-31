import { Router } from 'express';
import { z } from 'zod';
import QRCode from 'qrcode';
import { getDb } from '../db.js';
import { env } from '../env.js';
import { requireAuth, requireRole } from '../auth.js';
import { ApiError, asyncHandler, parse, requestBaseUrl } from '../lib/http.js';
import { recordAudit } from '../audit.js';
import {
  applyQuizAction,
  createQuestion,
  createQuiz,
  deleteQuestion,
  deleteQuiz,
  duplicateQuestion,
  duplicateQuiz,
  exportQuestionsCsv,
  getQuiz,
  importQuestionsCsv,
  listQuestions,
  listQuizSummaries,
  quizTotals,
  regenerateJoinCode,
  reorderQuestions,
  updateQuestion,
  updateQuiz,
} from '../services/quizzes.js';
import { liveQuizOverview, quizAnalytics } from '../services/stats.js';
import { getWorkspaceConfig, peekCertificateNumber } from '../services/config.js';
import { buildCertificateId } from '../services/config.js';
import { newId } from '../lib/ids.js';

export const quizzesRouter = Router();
quizzesRouter.use(requireAuth);

const isoOrNull = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v ? new Date(v).toISOString() : v ?? null));

const quizSchema = z.object({
  title: z.string().min(3, 'Quiz title must be at least 3 characters.').max(200),
  description: z.string().max(4000).optional(),
  instructions: z.string().max(6000).optional(),
  startAt: isoOrNull,
  endAt: isoOrNull,
  durationMinutes: z.number().int().min(1).max(600).optional(),
  passPercentage: z.number().min(0).max(100).optional(),
  maxAttempts: z.number().int().min(1).max(20).optional(),
  shuffleQuestions: z.boolean().optional(),
  shuffleOptions: z.boolean().optional(),
  randomQuestionCount: z.number().int().min(1).max(500).nullable().optional(),
  negativeMarking: z.boolean().optional(),
  resultVisibility: z.enum(['immediate', 'after_end', 'pass_only', 'never']).optional(),
  certificateRule: z.enum(['none', 'always', 'pass', 'score_threshold']).optional(),
  certificateMinScore: z.number().min(0).max(100).optional(),
  certCourseName: z.string().max(300).nullable().optional(),
  certConductedBy: z.string().max(300).nullable().optional(),
  certDuration: z.string().max(120).nullable().optional(),
  autoEmail: z.boolean().optional(),
  emailSubject: z.string().max(300).nullable().optional(),
  emailBody: z.string().max(20000).nullable().optional(),
  certFolderId: z.string().max(200).nullable().optional(),
  allowRegistration: z.boolean().optional(),
  allowedEmailDomain: z.string().max(120).nullable().optional(),
  allowedDepartments: z.string().max(400).nullable().optional(),
  violationWarnAfter: z.number().int().min(0).max(50).optional(),
  violationAutoSubmitCount: z.number().int().min(0).max(50).optional(),
});

const questionSchema = z.object({
  text: z.string().min(1, 'Question text is required.').max(4000),
  type: z.enum(['single', 'multi', 'truefalse']),
  marks: z.number().min(0.01).max(100).optional(),
  negativeMarks: z.number().min(0).max(100).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  explanation: z.string().max(4000).optional(),
  imageUrl: z.string().url().max(1000).optional().or(z.literal('')),
  options: z
    .array(z.object({ text: z.string().max(2000), isCorrect: z.boolean() }))
    .min(2, 'Provide at least two options.')
    .max(10),
});

function withDerived(quizId: string) {
  const quiz = getQuiz(quizId);
  const totals = quizTotals(quizId);
  const questions = listQuestions(quizId);
  const cfg = getWorkspaceConfig();
  const joinUrl = `${cfg.appBaseUrl}/j/${quiz.join_code}`;
  return {
    quiz,
    totals,
    questions,
    joinUrl,
    presentationUrl: `${cfg.appBaseUrl}/present/${quiz.join_code}`,
    certificatePreviewId: buildCertificateId(peekCertificateNumber(cfg.certificateYear)),
  };
}

quizzesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const search = String(req.query.search ?? '').toLowerCase();
    const status = String(req.query.status ?? '');
    let quizzes = listQuizSummaries();
    if (search) quizzes = quizzes.filter((q) => q.title.toLowerCase().includes(search) || q.join_code.toLowerCase().includes(search));
    if (status) quizzes = quizzes.filter((q) => q.status === status);
    res.json({ quizzes });
  }),
);

quizzesRouter.get(
  '/template.csv',
  asyncHandler(async (_req, res) => {
    const header = [
      'question',
      'type',
      'optionA',
      'optionB',
      'optionC',
      'optionD',
      'optionE',
      'optionF',
      'correct',
      'marks',
      'negative',
      'difficulty',
      'explanation',
    ];
    const rows = [
      [
        'Which unit converts a digital value into an analog voltage?',
        'single',
        'ADC',
        'DAC',
        'UART',
        'PWM',
        '',
        '',
        'B',
        '1',
        '0',
        'easy',
        'A DAC performs digital-to-analog conversion.',
      ],
      [
        'Select all valid serial buses used in embedded systems.',
        'multi',
        'I2C',
        'SPI',
        'HTTP',
        'CAN',
        '',
        '',
        'A;B;D',
        '2',
        '0',
        'medium',
        'HTTP is an application protocol, not an embedded serial bus.',
      ],
      [
        'An interrupt service routine should be kept as short as possible.',
        'truefalse',
        'True',
        'False',
        '',
        '',
        '',
        '',
        'A',
        '1',
        '0',
        'easy',
        'Long ISRs increase latency for other interrupts.',
      ],
    ];
    const esc = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
    const csv = [header, ...rows].map((row) => row.map(esc).join(',')).join('\n');
    res.type('text/csv').setHeader('Content-Disposition', 'attachment; filename="quiz_questions_template.csv"');
    res.send(csv);
  }),
);

quizzesRouter.post(
  '/',
  requireRole('quiz_admin'),
  asyncHandler(async (req, res) => {
    const input = parse(quizSchema, req.body);
    const quiz = createQuiz(input, req.admin!.id);
    recordAudit(req, 'quiz.create', 'quiz', quiz.id, { title: quiz.title });
    res.status(201).json(withDerived(quiz.id));
  }),
);

quizzesRouter.get(
  '/:quizId',
  asyncHandler(async (req, res) => {
    res.json(withDerived(req.params.quizId));
  }),
);

quizzesRouter.patch(
  '/:quizId',
  requireRole('quiz_admin'),
  asyncHandler(async (req, res) => {
    const input = parse(quizSchema.partial(), req.body);
    const quiz = updateQuiz(req.params.quizId, input);
    recordAudit(req, 'quiz.update', 'quiz', quiz.id, { fields: Object.keys(input) });
    res.json(withDerived(quiz.id));
  }),
);

quizzesRouter.delete(
  '/:quizId',
  requireRole('quiz_admin'),
  asyncHandler(async (req, res) => {
    const quiz = getQuiz(req.params.quizId);
    deleteQuiz(quiz.id);
    recordAudit(req, 'quiz.delete', 'quiz', quiz.id, { title: quiz.title });
    res.json({ ok: true });
  }),
);

quizzesRouter.post(
  '/:quizId/duplicate',
  requireRole('quiz_admin'),
  asyncHandler(async (req, res) => {
    const copy = duplicateQuiz(req.params.quizId, req.admin!.id);
    recordAudit(req, 'quiz.duplicate', 'quiz', copy.id, { source: req.params.quizId });
    res.status(201).json(withDerived(copy.id));
  }),
);

quizzesRouter.post(
  '/:quizId/actions',
  requireRole('quiz_host'),
  asyncHandler(async (req, res) => {
    const input = parse(
      z.object({
        action: z.enum([
          'publish',
          'schedule',
          'start',
          'pause',
          'resume',
          'end',
          'archive',
          'unarchive',
          'draft',
          'close_registration',
          'open_registration',
        ]),
      }),
      req.body,
    );
    const quiz = applyQuizAction(req.params.quizId, input.action);
    recordAudit(req, `quiz.${input.action}`, 'quiz', quiz.id, { status: quiz.status });
    res.json(withDerived(quiz.id));
  }),
);

quizzesRouter.post(
  '/:quizId/extend',
  requireRole('quiz_host'),
  asyncHandler(async (req, res) => {
    const input = parse(z.object({ minutes: z.number().int().min(1).max(120) }), req.body);
    const quiz = getQuiz(req.params.quizId);
    const db = getDb();
    const now = new Date().toISOString();
    const extensionMs = input.minutes * 60_000;
    if (quiz.end_at) {
      const base = Math.max(Date.now(), new Date(quiz.end_at).getTime());
      db.prepare('UPDATE quizzes SET end_at = ?, updated_at = ? WHERE id = ?').run(
        new Date(base + extensionMs).toISOString(),
        now,
        quiz.id,
      );
    }
    const attempts = db
      .prepare(`SELECT id, deadline_at FROM attempts WHERE quiz_id = ? AND status = 'in_progress'`)
      .all(quiz.id) as { id: string; deadline_at: string }[];
    const update = db.prepare('UPDATE attempts SET deadline_at = ? WHERE id = ?');
    for (const attempt of attempts) {
      update.run(new Date(new Date(attempt.deadline_at).getTime() + extensionMs).toISOString(), attempt.id);
    }
    recordAudit(req, 'quiz.extend', 'quiz', quiz.id, { minutes: input.minutes, attempts: attempts.length });
    res.json({ ok: true, extendedAttempts: attempts.length, endAt: getQuiz(quiz.id).end_at });
  }),
);

quizzesRouter.post(
  '/:quizId/join-code/regenerate',
  requireRole('quiz_admin'),
  asyncHandler(async (req, res) => {
    const input = parse(z.object({ confirm: z.literal(true) }), req.body);
    const before = getQuiz(req.params.quizId);
    const quiz = regenerateJoinCode(before.id);
    recordAudit(req, 'quiz.regenerate_join_code', 'quiz', quiz.id, {
      previous: before.join_code,
      current: quiz.join_code,
      confirm: input.confirm,
    });
    res.json(withDerived(quiz.id));
  }),
);

quizzesRouter.get(
  '/:quizId/qr.png',
  asyncHandler(async (req, res) => {
    const quiz = getQuiz(req.params.quizId);
    const cfg = getWorkspaceConfig();
    const url = `${requestBaseUrl(req, cfg.appBaseUrl, env.isProduction)}/j/${quiz.join_code}`;
    const buffer = await QRCode.toBuffer(url, {
      width: Math.min(Number(req.query.size) || 900, 1600),
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#120718', light: '#FFFFFF' },
    });
    recordAudit(req, 'quiz.download_qr', 'quiz', quiz.id, null);
    res.type('png').setHeader('Content-Disposition', `attachment; filename="quiz-${quiz.join_code}-qr.png"`);
    res.send(buffer);
  }),
);

/* ----------------------------- questions ----------------------------- */

quizzesRouter.get(
  '/:quizId/questions',
  asyncHandler(async (req, res) => {
    const quiz = getQuiz(req.params.quizId);
    res.json({ questions: listQuestions(quiz.id), totals: quizTotals(quiz.id) });
  }),
);

quizzesRouter.post(
  '/:quizId/questions',
  requireRole('quiz_admin'),
  asyncHandler(async (req, res) => {
    const input = parse(questionSchema, req.body);
    const question = createQuestion(req.params.quizId, {
      ...input,
      imageUrl: input.imageUrl || undefined,
    });
    recordAudit(req, 'question.create', 'question', question.id, { quizId: req.params.quizId });
    res.status(201).json({ question, totals: quizTotals(req.params.quizId) });
  }),
);

quizzesRouter.post(
  '/:quizId/questions/reorder',
  requireRole('quiz_admin'),
  asyncHandler(async (req, res) => {
    const input = parse(z.object({ orderedIds: z.array(z.string()).min(1) }), req.body);
    reorderQuestions(req.params.quizId, input.orderedIds);
    recordAudit(req, 'question.reorder', 'quiz', req.params.quizId, { count: input.orderedIds.length });
    res.json({ questions: listQuestions(req.params.quizId) });
  }),
);

quizzesRouter.post(
  '/:quizId/questions/import',
  requireRole('quiz_admin'),
  asyncHandler(async (req, res) => {
    const input = parse(z.object({ csv: z.string().min(5) }), req.body);
    const summary = importQuestionsCsv(req.params.quizId, input.csv);
    recordAudit(req, 'question.import', 'quiz', req.params.quizId, summary);
    res.json({ summary, questions: listQuestions(req.params.quizId), totals: quizTotals(req.params.quizId) });
  }),
);

quizzesRouter.get(
  '/:quizId/questions/export.csv',
  asyncHandler(async (req, res) => {
    const quiz = getQuiz(req.params.quizId);
    const csv = exportQuestionsCsv(quiz.id);
    recordAudit(req, 'question.export', 'quiz', quiz.id, null);
    res.type('text/csv').setHeader('Content-Disposition', `attachment; filename="quiz-${quiz.join_code}-questions.csv"`);
    res.send(csv);
  }),
);

quizzesRouter.get(
  '/:quizId/live',
  requireRole('results_viewer'),
  asyncHandler(async (req, res) => {
    const quiz = getQuiz(req.params.quizId);
    const db = getDb();
    const config = {
      durationMinutes: quiz.duration_minutes,
      status: quiz.status,
      shuffleQuestions: Boolean(quiz.shuffle_questions),
      shuffleOptions: Boolean(quiz.shuffle_options),
      resultVisibility: quiz.result_visibility,
      allowRegistration: Boolean(quiz.allow_registration),
      closeAt: quiz.end_at,
      violationWarnAfter: quiz.violation_warn_after,
      violationAutoSubmitCount: quiz.violation_auto_submit_count,
      updatedAt: quiz.updated_at,
    };
    const violationsByAttempt = db
      .prepare(
        `SELECT attempt_id, COUNT(*) AS n FROM violations WHERE quiz_id = ? GROUP BY attempt_id`,
      )
      .all(quiz.id) as { attempt_id: string; n: number }[];
    void violationsByAttempt;
    res.json({ quiz: config, ...liveQuizOverview(quiz.id) });
  }),
);

quizzesRouter.get(
  '/:quizId/analytics',
  asyncHandler(async (req, res) => {
    const quiz = getQuiz(req.params.quizId);
    res.json({ quiz, analytics: quizAnalytics(quiz.id) });
  }),
);

quizzesRouter.post(
  '/:quizId/announcements',
  requireRole('quiz_host'),
  asyncHandler(async (req, res) => {
    const input = parse(z.object({ message: z.string().min(1).max(500) }), req.body);
    const quiz = getQuiz(req.params.quizId);
    const id = newId('ann');
    getDb()
      .prepare('INSERT INTO announcements (id, quiz_id, message, created_by) VALUES (?, ?, ?, ?)')
      .run(id, quiz.id, input.message, req.admin!.email);
    getDb().prepare('UPDATE quizzes SET announcement = ?, updated_at = ? WHERE id = ?').run(
      input.message,
      new Date().toISOString(),
      quiz.id,
    );
    recordAudit(req, 'quiz.announcement', 'quiz', quiz.id, { message: input.message });
    res.status(201).json({ id, message: input.message });
  }),
);

quizzesRouter.get(
  '/:quizId/participants',
  asyncHandler(async (req, res) => {
    const quiz = getQuiz(req.params.quizId);
    const rows = getDb()
      .prepare(
        `SELECT p.id, p.name, p.email, p.reg_number, p.department, p.created_at,
          a.id AS attempt_id, a.status, a.score, a.total_marks, a.percentage, a.passed,
          a.started_at, a.submitted_at, a.violations_count,
          c.status AS certificate_status, c.certificate_id, c.email_status
         FROM participants p
         LEFT JOIN attempts a ON a.participant_id = p.id
         LEFT JOIN certificates c ON c.attempt_id = a.id
         WHERE p.quiz_id = ? ORDER BY p.created_at DESC`,
      )
      .all(quiz.id);
    res.json({ participants: rows });
  }),
);

/* ----------------------------- single question ----------------------------- */

export const questionsRouter = Router();
questionsRouter.use(requireAuth);

questionsRouter.patch(
  '/:questionId',
  requireRole('quiz_admin'),
  asyncHandler(async (req, res) => {
    const input = parse(questionSchema, req.body);
    const question = updateQuestion(req.params.questionId, {
      ...input,
      imageUrl: input.imageUrl || undefined,
    });
    recordAudit(req, 'question.update', 'question', question.id, null);
    res.json({ question, totals: quizTotals(question.quiz_id) });
  }),
);

questionsRouter.delete(
  '/:questionId',
  requireRole('quiz_admin'),
  asyncHandler(async (req, res) => {
    const question = getDb().prepare('SELECT * FROM questions WHERE id = ?').get(req.params.questionId) as
      | { id: string; quiz_id: string }
      | undefined;
    if (!question) throw new ApiError(404, 'Question not found.', 'question_not_found');
    deleteQuestion(question.id);
    recordAudit(req, 'question.delete', 'question', question.id, null);
    res.json({ ok: true });
  }),
);

questionsRouter.post(
  '/:questionId/duplicate',
  requireRole('quiz_admin'),
  asyncHandler(async (req, res) => {
    const question = duplicateQuestion(req.params.questionId);
    recordAudit(req, 'question.duplicate', 'question', question.id, { source: req.params.questionId });
    res.status(201).json({ question });
  }),
);
