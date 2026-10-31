import crypto from 'node:crypto';
import { getDb } from '../db.js';
import { newId } from '../lib/ids.js';
import { ApiError } from '../lib/http.js';
import { addMinutes, nowIso, secondsBetween } from '../lib/time.js';
import type {
  AnswerRow,
  AttemptRow,
  FieldRow,
  OptionRow,
  ParticipantRow,
  QuestionRow,
  QuizRow,
  ViolationRow,
} from '../domain.js';
import { signAttemptToken, signParticipantToken, verifyAttemptToken } from '../auth.js';
import { ensureCertificateForAttempt, certificateEligibility, getCertificateForAttempt } from './certificates.js';
import { enqueueJob } from './jobs.js';
import { queueSubmissionConfirmation } from './email.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const MANUAL_SUBMIT_GRACE_SECONDS = 5;
const WARNING_TYPES = new Set([
  'visibility_hidden',
  'window_blur',
  'fullscreen_exit',
  'copy_attempt',
  'paste_attempt',
  'context_menu',
  'print_attempt',
  'keyboard_shortcut',
  'devtools_hint',
  'page_hide',
  'duplicate_tab',
]);
const INFO_TYPES = new Set(['offline', 'reconnect', 'heartbeat']);

/* ------------------------------------------------------------------ */
/* Registration configuration                                          */
/* ------------------------------------------------------------------ */

export function getRegistrationFields(includeDisabled = false): FieldRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM registration_fields ${includeDisabled ? '' : 'WHERE enabled = 1'} ORDER BY sort_order ASC`,
    )
    .all() as FieldRow[];
}

export function validateRegistrationInput(
  raw: Record<string, unknown>,
  fields: FieldRow[],
  quiz: QuizRow,
): Record<string, string> {
  const clean: Record<string, string> = {};
  const errors: { path: string; message: string }[] = [];

  for (const field of fields) {
    const value = String(raw[field.key] ?? '').trim();
    if (!value) {
      if (field.required) errors.push({ path: field.key, message: `${field.label} is required.` });
      continue;
    }
    if (field.type === 'email' && !EMAIL_RE.test(value)) {
      errors.push({ path: field.key, message: `${field.label} must be a valid email address.` });
      continue;
    }
    if (field.pattern) {
      try {
        if (!new RegExp(field.pattern).test(value)) {
          errors.push({
            path: field.key,
            message: `${field.label} format is invalid. ${field.pattern_hint ?? ''}`.trim(),
          });
          continue;
        }
      } catch {
        /* ignore malformed admin pattern rather than blocking students */
      }
    }
    if (field.type === 'select' && field.options) {
      const allowed = field.options.split(',').map((o) => o.trim()).filter(Boolean);
      if (allowed.length && !allowed.some((o) => o.toLowerCase() === value.toLowerCase())) {
        errors.push({ path: field.key, message: `${field.label} must be one of: ${allowed.join(', ')}.` });
        continue;
      }
    }
    clean[field.key] = field.type === 'email' ? value.toLowerCase() : value;
  }

  if (quiz.allowed_email_domain && clean.email) {
    const domain = quiz.allowed_email_domain.trim().toLowerCase().replace(/^@/, '');
    if (domain && !clean.email.endsWith(`@${domain}`)) {
      errors.push({
        path: 'email',
        message: `Registration is limited to @${domain} email addresses.`,
      });
    }
  }
  if (quiz.allowed_departments && clean.department) {
    const allowed = quiz.allowed_departments
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
    if (allowed.length && !allowed.includes(clean.department.toLowerCase())) {
      errors.push({
        path: 'department',
        message: `This quiz is restricted to: ${quiz.allowed_departments}.`,
      });
    }
  }

  if (errors.length) {
    throw new ApiError(400, errors[0].message, 'validation_error', errors);
  }
  return clean;
}

/* ------------------------------------------------------------------ */
/* Quiz lookup                                                        */
/* ------------------------------------------------------------------ */

export function findQuizByJoinCode(joinCode: string): QuizRow {
  const quiz = getDb()
    .prepare('SELECT * FROM quizzes WHERE UPPER(join_code) = UPPER(?)')
    .get(joinCode.trim()) as QuizRow | undefined;
  if (!quiz) throw new ApiError(404, 'This quiz link is not valid. Please scan the QR code again.', 'quiz_not_found');
  if (quiz.status === 'archived') {
    throw new ApiError(410, 'This quiz has been archived.', 'quiz_archived');
  }
  if (quiz.status === 'draft') {
    throw new ApiError(403, 'This quiz has not been published yet.', 'quiz_draft');
  }
  return quiz;
}

export function registrationWindowState(quiz: QuizRow): {
  open: boolean;
  reason?: string;
  startsInSeconds?: number;
} {
  const now = Date.now();
  if (!quiz.allow_registration) return { open: false, reason: 'Registration is closed by the host.' };
  if (quiz.status === 'ended') return { open: false, reason: 'This quiz has ended.' };
  if (quiz.status === 'paused' || quiz.status === 'active') return { open: true };
  if (quiz.start_at && new Date(quiz.start_at).getTime() > now) {
    return {
      open: false,
      reason: 'Registration is not open yet.',
      startsInSeconds: Math.round((new Date(quiz.start_at).getTime() - now) / 1000),
    };
  }
  if (quiz.end_at && new Date(quiz.end_at).getTime() < now) {
    return { open: false, reason: 'The quiz has closed.' };
  }
  return { open: true };
}

export function publicQuizPayload(quiz: QuizRow) {
  const db = getDb();
  const stats = db
    .prepare('SELECT COUNT(*) AS n, COALESCE(SUM(marks),0) AS marks FROM questions WHERE quiz_id = ?')
    .get(quiz.id) as { n: number; marks: number };
  const participantCount = db
    .prepare('SELECT COUNT(*) AS n FROM participants WHERE quiz_id = ?')
    .get(quiz.id) as { n: number };
  const window = registrationWindowState(quiz);
  return {
    quiz: {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      instructions: quiz.instructions,
      status: quiz.status,
      durationMinutes: quiz.duration_minutes,
      passPercentage: quiz.pass_percentage,
      startAt: quiz.start_at,
      endAt: quiz.end_at,
      joinCode: quiz.join_code,
      allowRegistration: quiz.allow_registration,
      resultVisibility: quiz.result_visibility,
      certificateRule: quiz.certificate_rule,
      questionCount: quiz.random_question_count
        ? Math.min(quiz.random_question_count, stats.n)
        : stats.n,
      totalMarks: stats.marks,
      announcement: quiz.announcement,
      timezone: quiz.timezone,
    },
    registration: {
      open: window.open,
      reason: window.reason ?? null,
      startsInSeconds: window.startsInSeconds ?? null,
    },
    fields: getRegistrationFields().map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      required: Boolean(f.required),
      options: f.options ? f.options.split(',').map((o) => o.trim()) : null,
      patternHint: f.pattern_hint,
      mapsToSheetColumn: f.maps_to_sheet_column,
    })),
    participantCount: participantCount.n,
  };
}

/* ------------------------------------------------------------------ */
/* Join + attempts                                                     */
/* ------------------------------------------------------------------ */

export interface JoinResult {
  participantToken: string;
  participant: { id: string; name: string; email: string; regNumber: string | null; department: string | null };
  quiz: { id: string; title: string; joinCode: string };
  attemptsUsed: number;
  maxAttempts: number;
  openAttemptId: string | null;
}

export function joinQuiz(
  joinCode: string,
  rawFields: Record<string, unknown>,
  meta: { ip?: string; userAgent?: string },
): JoinResult {
  const quiz = findQuizByJoinCode(joinCode);
  const window = registrationWindowState(quiz);
  if (!window.open) throw new ApiError(403, window.reason ?? 'Registration is closed.', 'registration_closed');

  const fields = getRegistrationFields();
  const clean = validateRegistrationInput(rawFields, fields, quiz);
  const email = clean.email;
  const name = clean.name;
  const regNumber = clean.reg_number || null;
  const department = clean.department || null;

  if (!name) throw new ApiError(400, 'Participant name is required.', 'validation_error');
  if (!email) throw new ApiError(400, 'Email address is required.', 'validation_error');

  const db = getDb();
  const existing = db
    .prepare('SELECT * FROM participants WHERE quiz_id = ? AND lower(email) = lower(?)')
    .get(quiz.id, email) as ParticipantRow | undefined;

  if (regNumber) {
    const clash = db
      .prepare(
        `SELECT * FROM participants WHERE quiz_id = ? AND lower(reg_number) = lower(?) AND lower(email) != lower(?)`,
      )
      .get(quiz.id, regNumber, email) as ParticipantRow | undefined;
    if (clash) {
      throw new ApiError(
        409,
        'This register number is already registered with a different email address. Please contact the quiz host if this is an error.',
        'duplicate_registration',
      );
    }
  }

  let participant = existing;
  if (!participant) {
    const id = newId('ptc');
    // Core fields live in dedicated columns; any additional configured field is stored as JSON.
    const extra: Record<string, string> = {};
    for (const [key, value] of Object.entries(clean)) {
      if (!['name', 'email', 'reg_number', 'department'].includes(key)) extra[key] = value;
    }
    db.prepare(
      `INSERT INTO participants (id, quiz_id, email, name, reg_number, department, extra)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      quiz.id,
      email,
      name.toUpperCase(),
      regNumber,
      department,
      Object.keys(extra).length ? JSON.stringify(extra) : null,
    );
    participant = db.prepare('SELECT * FROM participants WHERE id = ?').get(id) as ParticipantRow;
  } else {
    db.prepare(
      `UPDATE participants SET name = ?, reg_number = ?, department = ?, updated_at = ? WHERE id = ?`,
    ).run(name.toUpperCase(), regNumber ?? participant.reg_number, department ?? participant.department, nowIso(), participant.id);
  }

  const attempts = db
    .prepare('SELECT id, status FROM attempts WHERE quiz_id = ? AND participant_id = ? ORDER BY attempt_no ASC')
    .all(quiz.id, participant.id) as { id: string; status: string }[];
  const open = attempts.find((a) => a.status === 'in_progress');
  if (!open && attempts.length >= quiz.max_attempts) {
    throw new ApiError(
      409,
      `You have already used all ${quiz.max_attempts} attempt(s) for this quiz.`,
      'attempt_limit_reached',
    );
  }

  return {
    participantToken: signParticipantToken(participant.id, quiz.id),
    participant: {
      id: participant.id,
      name: participant.name,
      email: participant.email,
      regNumber: participant.reg_number,
      department: participant.department,
    },
    quiz: { id: quiz.id, title: quiz.title, joinCode: quiz.join_code },
    attemptsUsed: attempts.filter((a) => a.status !== 'in_progress').length,
    maxAttempts: quiz.max_attempts,
    openAttemptId: open?.id ?? null,
  };
}

function seededShuffle<T>(items: T[], seed: string): T[] {
  // Deterministic Fisher-Yates driven by a hash of the attempt seed.
  let state = crypto.createHash('sha256').update(seed).digest().readUInt32LE(0) || 1;
  const rand = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 1_000_000) / 1_000_000;
  };
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function startOrResumeAttempt(
  claims: { pid: string; qid: string },
  meta: { ip?: string; userAgent?: string },
): { attemptToken: string; attemptId: string; resumed: boolean } {
  const db = getDb();
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(claims.qid) as QuizRow | undefined;
  if (!quiz) throw new ApiError(404, 'Quiz not found.', 'quiz_not_found');
  const participant = db
    .prepare('SELECT * FROM participants WHERE id = ? AND quiz_id = ?')
    .get(claims.pid, claims.qid) as ParticipantRow | undefined;
  if (!participant) throw new ApiError(403, 'Participant registration not found.', 'participant_not_found');

  const open = db
    .prepare(`SELECT * FROM attempts WHERE quiz_id = ? AND participant_id = ? AND status = 'in_progress'`)
    .get(quiz.id, participant.id) as AttemptRow | undefined;
  if (open) {
    return {
      attemptToken: signAttemptToken(open.id, participant.id, quiz.id),
      attemptId: open.id,
      resumed: true,
    };
  }

  if (!['published', 'active', 'scheduled'].includes(quiz.status)) {
    throw new ApiError(403, `This quiz is currently ${quiz.status} and cannot be started.`, 'quiz_unavailable');
  }
  if (quiz.status === 'scheduled' && quiz.start_at && new Date(quiz.start_at).getTime() > Date.now()) {
    throw new ApiError(403, 'This quiz has not started yet. Please wait for the host.', 'quiz_not_started');
  }
  if (quiz.end_at && new Date(quiz.end_at).getTime() < Date.now()) {
    throw new ApiError(403, 'The quiz window has closed.', 'quiz_closed');
  }

  const attemptsUsed = (
    db
      .prepare(`SELECT COUNT(*) AS n FROM attempts WHERE quiz_id = ? AND participant_id = ? AND status != 'in_progress'`)
      .get(quiz.id, participant.id) as { n: number }
  ).n;
  if (attemptsUsed >= quiz.max_attempts) {
    throw new ApiError(409, 'Attempt limit reached for this quiz.', 'attempt_limit_reached');
  }

  const questions = db
    .prepare('SELECT id FROM questions WHERE quiz_id = ? ORDER BY sort_order ASC')
    .all(quiz.id) as { id: string }[];
  if (!questions.length) throw new ApiError(409, 'This quiz has no questions yet.', 'quiz_empty');

  let questionIds = questions.map((q) => q.id);
  const limit = quiz.random_question_count && quiz.random_question_count > 0
    ? Math.min(quiz.random_question_count, questionIds.length)
    : questionIds.length;
  const attemptId = newId('att');
  const seed = crypto.randomBytes(16).toString('hex');

  if (quiz.shuffle_questions) questionIds = seededShuffle(questionIds, `${seed}:q`);
  questionIds = questionIds.slice(0, limit);

  const optionOrder: Record<string, string[]> = {};
  const optionRows = db
    .prepare(
      `SELECT o.id, o.question_id FROM question_options o JOIN questions q ON q.id = o.question_id
       WHERE q.quiz_id = ? ORDER BY o.sort_order ASC`,
    )
    .all(quiz.id) as { id: string; question_id: string }[];
  for (const qid of questionIds) {
    const ids = optionRows.filter((o) => o.question_id === qid).map((o) => o.id);
    optionOrder[qid] = quiz.shuffle_options ? seededShuffle(ids, `${seed}:o:${qid}`) : ids;
  }

  const startedAt = nowIso();
  let deadline = addMinutes(startedAt, quiz.duration_minutes);
  if (quiz.end_at && new Date(quiz.end_at).getTime() < new Date(deadline).getTime()) {
    deadline = new Date(quiz.end_at).toISOString();
  }

  db.prepare(
    `INSERT INTO attempts (id, quiz_id, participant_id, attempt_no, status, started_at, deadline_at,
       question_order, option_order, ip, user_agent)
     VALUES (?, ?, ?, ?, 'in_progress', ?, ?, ?, ?, ?, ?)`,
  ).run(
    attemptId,
    quiz.id,
    participant.id,
    attemptsUsed + 1,
    startedAt,
    deadline,
    JSON.stringify(questionIds),
    JSON.stringify(optionOrder),
    meta.ip ?? null,
    meta.userAgent ?? null,
  );

  return { attemptToken: signAttemptToken(attemptId, participant.id, quiz.id), attemptId, resumed: false };
}

function loadAttempt(claims: { aid: string; pid: string; qid: string }): AttemptRow {
  const attempt = getDb().prepare('SELECT * FROM attempts WHERE id = ?').get(claims.aid) as
    | AttemptRow
    | undefined;
  if (!attempt) throw new ApiError(404, 'Attempt not found.', 'attempt_not_found');
  if (attempt.participant_id !== claims.pid || attempt.quiz_id !== claims.qid) {
    throw new ApiError(403, 'This attempt does not belong to you.', 'attempt_forbidden');
  }
  return attempt;
}

export interface AttemptStatePayload {
  quiz: {
    id: string;
    title: string;
    instructions: string;
    durationMinutes: number;
    resultVisibility: string;
    totalQuestions: number;
  };
  attempt: {
    id: string;
    status: string;
    startedAt: string;
    deadlineAt: string;
    serverNow: string;
    remainingSeconds: number;
    totalMarks: number;
    violations: number;
    warning: string | null;
  };
  questions: {
    id: string;
    text: string;
    type: string;
    marks: number;
    imageUrl: string | null;
    options: { id: string; label: string; text: string }[];
  }[];
  answers: Record<string, { selected: string[]; markedForReview: boolean }>;
  submitted: boolean;
  result?: ResultPayload;
}

export function buildAttemptState(claims: { aid: string; pid: string; qid: string }): AttemptStatePayload {
  const db = getDb();
  let attempt = loadAttempt(claims);
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(attempt.quiz_id) as QuizRow;

  if (attempt.status === 'in_progress' && new Date(attempt.deadline_at).getTime() + 2000 < Date.now()) {
    attempt = gradeAndCloseAttempt(attempt, quiz, 'timeout');
  }

  if (attempt.status !== 'in_progress') {
    return {
      quiz: {
        id: quiz.id,
        title: quiz.title,
        instructions: quiz.instructions,
        durationMinutes: quiz.duration_minutes,
        resultVisibility: quiz.result_visibility,
        totalQuestions: 0,
      },
      attempt: {
        id: attempt.id,
        status: attempt.status,
        startedAt: attempt.started_at,
        deadlineAt: attempt.deadline_at,
        serverNow: nowIso(),
        remainingSeconds: 0,
        totalMarks: attempt.total_marks,
        violations: attempt.violations_count,
        warning: null,
      },
      questions: [],
      answers: {},
      submitted: true,
      result: buildResultPayload(attempt, quiz, true),
    };
  }

  const questionOrder = JSON.parse(attempt.question_order ?? '[]') as string[];
  const optionOrder = JSON.parse(attempt.option_order ?? '{}') as Record<string, string[]>;
  const questions = db
    .prepare(
      `SELECT * FROM questions WHERE quiz_id = ? ORDER BY sort_order ASC`,
    )
    .all(quiz.id) as QuestionRow[];
  const options = db
    .prepare(
      `SELECT o.* FROM question_options o JOIN questions q ON q.id = o.question_id WHERE q.quiz_id = ? ORDER BY o.sort_order ASC`,
    )
    .all(quiz.id) as OptionRow[];
  const answers = db
    .prepare('SELECT * FROM attempt_answers WHERE attempt_id = ?')
    .all(attempt.id) as AnswerRow[];

  const answerMap: Record<string, { selected: string[]; markedForReview: boolean }> = {};
  for (const a of answers) {
    answerMap[a.question_id] = {
      selected: JSON.parse(a.selected_options) as string[],
      markedForReview: Boolean(a.marked_for_review),
    };
  }

  const payloadQuestions = questionOrder
    .map((qid) => {
      const q = questions.find((item) => item.id === qid);
      if (!q) return null;
      const ids = optionOrder[qid] ?? options.filter((o) => o.question_id === qid).map((o) => o.id);
      return {
        id: q.id,
        text: q.text,
        type: q.type,
        marks: q.marks,
        imageUrl: q.image_url,
        options: ids
          .map((oid) => options.find((o) => o.id === oid))
          .filter((o): o is OptionRow => Boolean(o))
          .map((o) => ({ id: o.id, label: o.label, text: o.text })),
      };
    })
    .filter((q): q is NonNullable<typeof q> => Boolean(q));

  const totalMarks = payloadQuestions.reduce((sum, q) => sum + Number(q.marks), 0);
  const remainingSeconds = Math.max(
    0,
    Math.round((new Date(attempt.deadline_at).getTime() - Date.now()) / 1000),
  );
  const warning =
    attempt.violations_count >= quiz.violation_warn_after
      ? `Warning: ${attempt.violations_count} proctoring event(s) recorded. Leaving the quiz screen may be logged by the host.`
      : null;

  return {
    quiz: {
      id: quiz.id,
      title: quiz.title,
      instructions: quiz.instructions,
      durationMinutes: quiz.duration_minutes,
      resultVisibility: quiz.result_visibility,
      totalQuestions: payloadQuestions.length,
    },
    attempt: {
      id: attempt.id,
      status: attempt.status,
      startedAt: attempt.started_at,
      deadlineAt: attempt.deadline_at,
      serverNow: nowIso(),
      remainingSeconds,
      totalMarks,
      violations: attempt.violations_count,
      warning,
    },
    questions: payloadQuestions,
    answers: answerMap,
    submitted: false,
  };
}

export function saveAttemptAnswer(
  claims: { aid: string; pid: string; qid: string },
  input: { questionId: string; selected: string[]; markedForReview?: boolean },
): { savedAt: string; answeredCount: number } {
  const db = getDb();
  const attempt = loadAttempt(claims);
  if (attempt.status !== 'in_progress') {
    throw new ApiError(409, 'This attempt has already been submitted.', 'attempt_closed');
  }
  if (new Date(attempt.deadline_at).getTime() < Date.now()) {
    throw new ApiError(409, 'Time is up. Your saved answers are being submitted.', 'time_up');
  }

  const order = JSON.parse(attempt.question_order ?? '[]') as string[];
  if (!order.includes(input.questionId)) {
    throw new ApiError(400, 'Question is not part of this attempt.', 'invalid_question');
  }
  const optionOrder = JSON.parse(attempt.option_order ?? '{}') as Record<string, string[]>;
  const allowed = new Set(optionOrder[input.questionId] ?? []);
  const selected = Array.from(new Set(input.selected.filter((id) => allowed.has(id)))).sort();

  const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(input.questionId) as QuestionRow;
  if ((question.type === 'single' || question.type === 'truefalse') && selected.length > 1) {
    throw new ApiError(400, 'Only one option can be selected for this question.', 'invalid_selection');
  }

  const savedAt = nowIso();
  db.prepare(
    `INSERT INTO attempt_answers (id, attempt_id, question_id, selected_options, marked_for_review, saved_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(attempt_id, question_id) DO UPDATE SET
       selected_options = excluded.selected_options,
       marked_for_review = excluded.marked_for_review,
       saved_at = excluded.saved_at`,
  ).run(
    newId('ans'),
    attempt.id,
    input.questionId,
    JSON.stringify(selected),
    input.markedForReview ? 1 : 0,
    savedAt,
  );

  const answeredCount = (
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM attempt_answers WHERE attempt_id = ? AND selected_options NOT IN ('[]','')`,
      )
      .get(attempt.id) as { n: number }
  ).n;

  return { savedAt, answeredCount };
}

export interface ViolationResult {
  accepted: boolean;
  count: number;
  autoSubmitted: boolean;
  warning: string | null;
}

export function recordViolation(
  claims: { aid: string; pid: string; qid: string },
  input: { type: string; metadata?: Record<string, unknown> },
): ViolationResult {
  const db = getDb();
  let attempt = loadAttempt(claims);
  if (attempt.status !== 'in_progress') return { accepted: false, count: attempt.violations_count, autoSubmitted: false, warning: null };

  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(attempt.quiz_id) as QuizRow;
  const type = String(input.type || 'unknown').slice(0, 60);
  const severity = INFO_TYPES.has(type) ? 'info' : WARNING_TYPES.has(type) ? 'warning' : 'info';
  db.prepare(
    `INSERT INTO violations (id, attempt_id, quiz_id, participant_id, type, severity, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    newId('vio'),
    attempt.id,
    attempt.quiz_id,
    attempt.participant_id,
    type,
    severity,
    JSON.stringify({ ...input.metadata, userAgent: attempt.user_agent }).slice(0, 3000),
  );

  let count = attempt.violations_count;
  if (severity !== 'info') {
    db.prepare('UPDATE attempts SET violations_count = violations_count + 1 WHERE id = ?').run(attempt.id);
    count += 1;
  }
  attempt = db.prepare('SELECT * FROM attempts WHERE id = ?').get(attempt.id) as AttemptRow;

  const threshold = quiz.violation_auto_submit_count || 0;
  if (threshold > 0 && count >= threshold) {
    gradeAndCloseAttempt(attempt, quiz, 'auto_violation');
    return {
      accepted: true,
      count,
      autoSubmitted: true,
      warning: `Your attempt was submitted automatically after ${count} proctoring violations.`,
    };
  }

  return {
    accepted: true,
    count,
    autoSubmitted: false,
    warning:
      count >= quiz.violation_warn_after
        ? `Warning ${count}: leaving the quiz screen is recorded and shared with the host.`
        : null,
  };
}

export interface ResultPayload {
  attemptId: string;
  status: string;
  submittedAt: string | null;
  score: number | null;
  totalMarks: number;
  percentage: number | null;
  passed: boolean | null;
  visibility: string;
  message: string;
  certificate: {
    status: string;
    certificateId: string | null;
    pdfUrl: string | null;
    emailStatus: string;
  } | null;
  violations: number;
  durationSeconds: number | null;
}

export function buildResultPayload(attempt: AttemptRow, quiz: QuizRow, includeInternal = false): ResultPayload {
  const cert = getCertificateForAttempt(attempt.id);
  const visibility = quiz.result_visibility;
  const showScore = includeInternal || visibility === 'immediate';
  const showPass = showScore || visibility === 'pass_only';
  let message = 'Your submission was received.';
  if (showScore) {
    message = attempt.passed
      ? `You passed with ${attempt.score} out of ${attempt.total_marks} (${attempt.percentage.toFixed(2)}%).`
      : `You scored ${attempt.score} out of ${attempt.total_marks} (${attempt.percentage.toFixed(2)}%).`;
  } else if (visibility === 'after_end') {
    message = 'Your submission was received. Results will be published after the quiz closes.';
  } else if (visibility === 'pass_only') {
    message = attempt.passed ? 'Your submission was received. You have passed this quiz.' : 'Your submission was received.';
  } else if (visibility === 'never') {
    message = 'Your submission was received. Results are not published for this quiz.';
  }

  return {
    attemptId: attempt.id,
    status: attempt.status,
    submittedAt: attempt.submitted_at,
    score: showScore ? attempt.score : null,
    totalMarks: attempt.total_marks,
    percentage: showScore ? Number(attempt.percentage.toFixed(2)) : null,
    passed: showPass ? Boolean(attempt.passed) : null,
    visibility,
    message,
    certificate: cert
      ? {
          status: cert.status,
          certificateId: cert.status === 'generated' ? cert.certificate_id : null,
          pdfUrl: cert.status === 'generated' ? cert.pdf_url : null,
          emailStatus: cert.email_status,
        }
      : null,
    violations: attempt.violations_count,
    durationSeconds: attempt.duration_seconds,
  };
}

function gradeAndCloseAttempt(attempt: AttemptRow, quiz: QuizRow, reason: string): AttemptRow {
  const db = getDb();
  if (attempt.status !== 'in_progress') return attempt;

  const questionOrder = JSON.parse(attempt.question_order ?? '[]') as string[];
  const questions = db
    .prepare(`SELECT * FROM questions WHERE quiz_id = ?`)
    .all(quiz.id) as QuestionRow[];
  const options = db
    .prepare(
      `SELECT o.* FROM question_options o JOIN questions q ON q.id = o.question_id WHERE q.quiz_id = ?`,
    )
    .all(quiz.id) as OptionRow[];
  const answers = db
    .prepare('SELECT * FROM attempt_answers WHERE attempt_id = ?')
    .all(attempt.id) as AnswerRow[];

  let totalMarks = 0;
  let score = 0;
  for (const qid of questionOrder) {
    const question = questions.find((q) => q.id === qid);
    if (!question) continue;
    totalMarks += Number(question.marks);
    const answer = answers.find((a) => a.question_id === qid);
    const selected = answer ? (JSON.parse(answer.selected_options) as string[]) : [];
    const correct = options
      .filter((o) => o.question_id === qid && o.is_correct)
      .map((o) => o.id)
      .sort();
    const isCorrect =
      selected.length > 0 &&
      selected.length === correct.length &&
      selected.every((id, idx) => id === correct[idx]);
    const marks = isCorrect
      ? Number(question.marks)
      : quiz.negative_marking && selected.length > 0
        ? -Math.abs(Number(question.negative_marks) || 0)
        : 0;
    score += marks;

    if (answer) {
      db.prepare(
        `UPDATE attempt_answers SET is_correct = ?, marks_awarded = ? WHERE id = ?`,
      ).run(isCorrect ? 1 : 0, marks, answer.id);
    }
  }

  const finalScore = Math.max(0, Math.round(score * 100) / 100);
  const percentage = totalMarks > 0 ? (finalScore / totalMarks) * 100 : 0;
  const passed = percentage >= quiz.pass_percentage;
  const submittedAt = nowIso();
  const durationSeconds = secondsBetween(attempt.started_at, submittedAt);

  db.prepare(
    `UPDATE attempts SET status = ?, submitted_at = ?, score = ?, total_marks = ?, percentage = ?,
       passed = ?, auto_submitted = ?, duration_seconds = ? WHERE id = ?`,
  ).run(
    reason === 'manual' ? 'submitted' : 'auto_submitted',
    submittedAt,
    finalScore,
    totalMarks,
    percentage,
    passed ? 1 : 0,
    reason === 'manual' ? 0 : 1,
    durationSeconds,
    attempt.id,
  );

  const closed = db.prepare('SELECT * FROM attempts WHERE id = ?').get(attempt.id) as AttemptRow;

  // Certificate workflow is queued only after closing the attempt (idempotent per attempt).
  ensureCertificateForAttempt(closed.id);
  enqueueJob('sheet_sync_result', { attemptId: closed.id });
  void queueSubmissionConfirmation(closed.id).then((emailId) => {
    if (emailId) enqueueJob('send_email', { emailId });
  });
  return closed;
}

export function submitAttempt(
  claims: { aid: string; pid: string; qid: string },
  reason: 'manual' | 'timeout' | 'host' = 'manual',
): ResultPayload {
  const db = getDb();
  let attempt = loadAttempt(claims);
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(attempt.quiz_id) as QuizRow;
  if (attempt.status === 'in_progress') {
    const expired = Date.now() > new Date(attempt.deadline_at).getTime() + MANUAL_SUBMIT_GRACE_SECONDS * 1000;
    attempt = gradeAndCloseAttempt(attempt, quiz, reason === 'manual' && !expired ? 'manual' : reason === 'host' ? 'host' : 'timeout');
  }
  return buildResultPayload(attempt, quiz);
}

export function getAttemptResult(claims: { aid: string; pid: string; qid: string }): ResultPayload {
  const db = getDb();
  const attempt = loadAttempt(claims);
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(attempt.quiz_id) as QuizRow;
  if (attempt.status === 'in_progress') {
    throw new ApiError(409, 'This attempt is still in progress.', 'attempt_in_progress');
  }
  return buildResultPayload(attempt, quiz);
}

export function getParticipantSummary(claims: { pid: string; qid: string }) {
  const db = getDb();
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(claims.qid) as QuizRow;
  const participant = db
    .prepare('SELECT * FROM participants WHERE id = ?')
    .get(claims.pid) as ParticipantRow | undefined;
  if (!participant) throw new ApiError(404, 'Participant not found.', 'participant_not_found');
  const attempts = db
    .prepare('SELECT * FROM attempts WHERE quiz_id = ? AND participant_id = ? ORDER BY attempt_no ASC')
    .all(quiz.id, participant.id) as AttemptRow[];
  return {
    participant: {
      id: participant.id,
      name: participant.name,
      email: participant.email,
      regNumber: participant.reg_number,
      department: participant.department,
    },
    quiz: {
      id: quiz.id,
      title: quiz.title,
      durationMinutes: quiz.duration_minutes,
      resultVisibility: quiz.result_visibility,
      allowRegistration: quiz.allow_registration,
      status: quiz.status,
    },
    attempts: attempts.map((a) => buildResultPayload(a, quiz)),
  };
}

/** Auto-submits attempts whose server-side deadline has passed (runs on a timer). */
export function sweepExpiredAttempts(): number {
  const db = getDb();
  const expired = db
    .prepare(
      `SELECT * FROM attempts WHERE status = 'in_progress' AND deadline_at < ? LIMIT 100`,
    )
    .all(nowIso()) as AttemptRow[];
  let closed = 0;
  for (const attempt of expired) {
    const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(attempt.quiz_id) as QuizRow;
    if (!quiz) continue;
    gradeAndCloseAttempt(attempt, quiz, 'timeout');
    closed += 1;
  }
  return closed;
}

export function getCertificateEligibilityForAttempt(
  attemptId: string,
): { eligible: boolean; reason: string } | null {
  const db = getDb();
  const attempt = db.prepare('SELECT * FROM attempts WHERE id = ?').get(attemptId) as
    | AttemptRow
    | undefined;
  if (!attempt) return null;
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(attempt.quiz_id) as QuizRow;
  return certificateEligibility(quiz, attempt);
}

export { verifyAttemptToken };
