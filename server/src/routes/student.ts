import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import {
  bearerOrQueryToken,
  verifyAttemptToken,
  verifyParticipantToken,
} from '../auth.js';
import { ApiError, asyncHandler, parse } from '../lib/http.js';
import {
  buildAttemptState,
  findQuizByJoinCode,
  getAttemptResult,
  getParticipantSummary,
  joinQuiz,
  publicQuizPayload,
  recordViolation,
  saveAttemptAnswer,
  startOrResumeAttempt,
  submitAttempt,
} from '../services/attempts.js';
import { recordAudit } from '../audit.js';

export const studentRouter = Router();

const joinLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many registration attempts. Please wait a moment.', code: 'rate_limited' },
});

const saveLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 240,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many answer saves. Please slow down.', code: 'rate_limited' },
});

const attemptLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a moment.', code: 'rate_limited' },
});

studentRouter.get(
  '/quiz/:joinCode',
  asyncHandler(async (req, res) => {
    const quiz = findQuizByJoinCode(req.params.joinCode);
    res.json(publicQuizPayload(quiz));
  }),
);

studentRouter.post(
  '/quiz/:joinCode/join',
  joinLimiter,
  asyncHandler(async (req, res) => {
    const input = parse(
      z.object({
        fields: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
      }),
      req.body,
    );
    const fields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input.fields)) fields[key] = value ?? '';
    const result = joinQuiz(req.params.joinCode, fields, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    recordAudit(req, 'participant.join', 'quiz', result.quiz.id, {
      participantId: result.participant.id,
      email: result.participant.email,
      resumed: Boolean(result.openAttemptId),
    });
    res.status(201).json(result);
  }),
);

studentRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    const claims = verifyParticipantToken(bearerOrQueryToken(req));
    res.json(getParticipantSummary(claims));
  }),
);

studentRouter.post(
  '/attempts/start',
  attemptLimiter,
  asyncHandler(async (req, res) => {
    const claims = verifyParticipantToken(
      (req.body?.participantToken as string | undefined) ?? bearerOrQueryToken(req),
    );
    const result = startOrResumeAttempt(claims, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    recordAudit(req, result.resumed ? 'attempt.resume' : 'attempt.start', 'attempt', result.attemptId, {
      quizId: claims.qid,
      participantId: claims.pid,
    });
    res.json(result);
  }),
);

studentRouter.get(
  '/attempts/state',
  asyncHandler(async (req, res) => {
    const claims = verifyAttemptToken(bearerOrQueryToken(req));
    res.json(buildAttemptState(claims));
  }),
);

studentRouter.post(
  '/attempts/answer',
  saveLimiter,
  asyncHandler(async (req, res) => {
    const input = parse(
      z.object({
        token: z.string().min(10),
        questionId: z.string().min(3),
        selected: z.array(z.string()).max(10),
        markedForReview: z.boolean().optional(),
      }),
      req.body,
    );
    const claims = verifyAttemptToken(input.token);
    const result = saveAttemptAnswer(claims, {
      questionId: input.questionId,
      selected: input.selected,
      markedForReview: input.markedForReview,
    });
    res.json({ ok: true, ...result });
  }),
);

studentRouter.post(
  '/attempts/violation',
  asyncHandler(async (req, res) => {
    const input = parse(
      z.object({
        token: z.string().min(10),
        type: z.string().min(2).max(60),
        metadata: z.record(z.string(), z.unknown()).optional(),
      }),
      req.body,
    );
    const claims = verifyAttemptToken(input.token);
    const result = recordViolation(claims, { type: input.type, metadata: input.metadata });
    recordAudit(req, 'attempt.violation', 'attempt', claims.aid, {
      type: input.type,
      count: result.count,
      autoSubmitted: result.autoSubmitted,
    });
    res.json(result);
  }),
);

studentRouter.post(
  '/attempts/submit',
  attemptLimiter,
  asyncHandler(async (req, res) => {
    const input = parse(
      z.object({ token: z.string().min(10), reason: z.enum(['manual', 'timeout']).optional() }),
      req.body,
    );
    const claims = verifyAttemptToken(input.token);
    const result = submitAttempt(claims, input.reason ?? 'manual');
    recordAudit(req, 'attempt.submit', 'attempt', claims.aid, {
      score: result.score,
      status: result.status,
    });
    res.json(result);
  }),
);

studentRouter.get(
  '/attempts/result',
  asyncHandler(async (req, res) => {
    const claims = verifyAttemptToken(bearerOrQueryToken(req));
    res.json(getAttemptResult(claims));
  }),
);

studentRouter.get(
  '/quiz/:joinCode/status',
  asyncHandler(async (req, res) => {
    const quiz = findQuizByJoinCode(req.params.joinCode);
    const payload = publicQuizPayload(quiz);
    res.json({
      status: payload.quiz.status,
      announcement: payload.quiz.announcement,
      registration: payload.registration,
      startAt: payload.quiz.startAt,
      participantCount: payload.participantCount,
    });
  }),
);

studentRouter.get('/health', (_req, res) => {
  res.json({ ok: true });
});

studentRouter.use((_req, _res, next) => next(new ApiError(404, 'Endpoint not found.', 'not_found')));
