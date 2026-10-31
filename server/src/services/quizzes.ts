import { getDb } from '../db.js';
import { newId, randomCode } from '../lib/ids.js';
import { ApiError } from '../lib/http.js';
import { nowIso } from '../lib/time.js';
import type { OptionRow, QuestionRow, QuizRow } from '../domain.js';

export interface QuizInput {
  title: string;
  description?: string;
  instructions?: string;
  startAt?: string | null;
  endAt?: string | null;
  durationMinutes?: number;
  passPercentage?: number;
  maxAttempts?: number;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  randomQuestionCount?: number | null;
  negativeMarking?: boolean;
  resultVisibility?: QuizRow['result_visibility'];
  certificateRule?: QuizRow['certificate_rule'];
  certificateMinScore?: number;
  certCourseName?: string | null;
  certConductedBy?: string | null;
  certDuration?: string | null;
  autoEmail?: boolean;
  emailSubject?: string | null;
  emailBody?: string | null;
  certFolderId?: string | null;
  allowRegistration?: boolean;
  allowedEmailDomain?: string | null;
  allowedDepartments?: string | null;
  violationWarnAfter?: number;
  violationAutoSubmitCount?: number;
}

function uniqueJoinCode(): string {
  const db = getDb();
  for (let i = 0; i < 40; i += 1) {
    const code = randomCode(6);
    const exists = db.prepare('SELECT 1 FROM quizzes WHERE join_code = ?').get(code);
    if (!exists) return code;
  }
  return `${randomCode(4)}${Date.now().toString(36).slice(-3).toUpperCase()}`;
}

export function getQuiz(quizId: string): QuizRow {
  const quiz = getDb().prepare('SELECT * FROM quizzes WHERE id = ?').get(quizId) as QuizRow | undefined;
  if (!quiz) throw new ApiError(404, 'Quiz not found.', 'quiz_not_found');
  return quiz;
}

export function createQuiz(input: QuizInput, createdBy: string): QuizRow {
  const id = newId('qz');
  const joinCode = uniqueJoinCode();
  getDb()
    .prepare(
      `INSERT INTO quizzes (id, title, description, instructions, status, start_at, end_at, duration_minutes,
        pass_percentage, max_attempts, shuffle_questions, shuffle_options, random_question_count, negative_marking,
        result_visibility, certificate_rule, certificate_min_score, cert_course_name, cert_conducted_by, cert_duration,
        auto_email, email_subject, email_body, cert_folder_id, join_code, allow_registration, allowed_email_domain,
        allowed_departments, violation_warn_after, violation_auto_submit_count, created_by)
       VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.title,
      input.description ?? '',
      input.instructions ?? '',
      input.startAt ?? null,
      input.endAt ?? null,
      input.durationMinutes ?? 15,
      input.passPercentage ?? 40,
      input.maxAttempts ?? 1,
      input.shuffleQuestions ? 1 : 0,
      input.shuffleOptions ? 1 : 0,
      input.randomQuestionCount ?? null,
      input.negativeMarking ? 1 : 0,
      input.resultVisibility ?? 'after_end',
      input.certificateRule ?? 'pass',
      input.certificateMinScore ?? 0,
      input.certCourseName ?? null,
      input.certConductedBy ?? null,
      input.certDuration ?? null,
      input.autoEmail === false ? 0 : 1,
      input.emailSubject ?? null,
      input.emailBody ?? null,
      input.certFolderId ?? null,
      joinCode,
      input.allowRegistration === false ? 0 : 1,
      input.allowedEmailDomain ?? null,
      input.allowedDepartments ?? null,
      input.violationWarnAfter ?? 1,
      input.violationAutoSubmitCount ?? 3,
      createdBy,
    );
  return getQuiz(id);
}

export function updateQuiz(quizId: string, input: Partial<QuizInput>): QuizRow {
  const current = getQuiz(quizId);
  const map: Record<keyof QuizInput, string> = {
    title: 'title',
    description: 'description',
    instructions: 'instructions',
    startAt: 'start_at',
    endAt: 'end_at',
    durationMinutes: 'duration_minutes',
    passPercentage: 'pass_percentage',
    maxAttempts: 'max_attempts',
    shuffleQuestions: 'shuffle_questions',
    shuffleOptions: 'shuffle_options',
    randomQuestionCount: 'random_question_count',
    negativeMarking: 'negative_marking',
    resultVisibility: 'result_visibility',
    certificateRule: 'certificate_rule',
    certificateMinScore: 'certificate_min_score',
    certCourseName: 'cert_course_name',
    certConductedBy: 'cert_conducted_by',
    certDuration: 'cert_duration',
    autoEmail: 'auto_email',
    emailSubject: 'email_subject',
    emailBody: 'email_body',
    certFolderId: 'cert_folder_id',
    allowRegistration: 'allow_registration',
    allowedEmailDomain: 'allowed_email_domain',
    allowedDepartments: 'allowed_departments',
    violationWarnAfter: 'violation_warn_after',
    violationAutoSubmitCount: 'violation_auto_submit_count',
  };
  const booleanKeys = [
    'shuffleQuestions',
    'shuffleOptions',
    'negativeMarking',
    'autoEmail',
    'allowRegistration',
  ];
  const sets: string[] = [];
  const values: (string | number | null)[] = [];
  for (const [key, column] of Object.entries(map)) {
    if (!(key in input)) continue;
    const raw = input[key as keyof QuizInput];
    let value: string | number | null;
    if (raw === undefined) continue;
    if (booleanKeys.includes(key)) value = raw ? 1 : 0;
    else if (raw === null) value = null;
    else value = typeof raw === 'number' || typeof raw === 'boolean' ? Number(raw) : String(raw);
    sets.push(`${column} = ?`);
    values.push(value);
  }
  if (!sets.length) return current;
  sets.push('updated_at = ?');
  values.push(nowIso());
  values.push(quizId);
  getDb().prepare(`UPDATE quizzes SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  return getQuiz(quizId);
}

export type QuizAction =
  | 'publish'
  | 'schedule'
  | 'start'
  | 'pause'
  | 'resume'
  | 'end'
  | 'archive'
  | 'unarchive'
  | 'draft'
  | 'close_registration'
  | 'open_registration';

export function applyQuizAction(quizId: string, action: QuizAction): QuizRow {
  const db = getDb();
  const quiz = getQuiz(quizId);
  const now = nowIso();

  switch (action) {
    case 'publish': {
      const totals = quizTotals(quizId);
      if (!totals.totalQuestions) throw new ApiError(400, 'Add at least one question before publishing.', 'quiz_empty');
      if (!quiz.duration_minutes || quiz.duration_minutes < 1) {
        throw new ApiError(400, 'Quiz duration must be at least one minute.', 'invalid_duration');
      }
      db.prepare(`UPDATE quizzes SET status = 'published', published_at = COALESCE(published_at, ?), updated_at = ?, archived_at = NULL WHERE id = ?`).run(
        now,
        now,
        quizId,
      );
      break;
    }
    case 'schedule': {
      const totals = quizTotals(quizId);
      if (!totals.totalQuestions) throw new ApiError(400, 'Add at least one question before scheduling.', 'quiz_empty');
      if (!quiz.start_at || !quiz.end_at) {
        throw new ApiError(400, 'Set a start and closing date/time before scheduling.', 'missing_schedule');
      }
      if (new Date(quiz.end_at).getTime() <= new Date(quiz.start_at).getTime()) {
        throw new ApiError(400, 'The closing time must be after the start time.', 'invalid_schedule');
      }
      db.prepare(`UPDATE quizzes SET status = 'scheduled', updated_at = ? WHERE id = ?`).run(now, quizId);
      break;
    }
    case 'start':
      db.prepare(`UPDATE quizzes SET status = 'active', start_at = COALESCE(start_at, ?), updated_at = ? WHERE id = ?`).run(
        now,
        now,
        quizId,
      );
      break;
    case 'pause':
      if (quiz.status !== 'active') throw new ApiError(409, 'Only an active quiz can be paused.', 'invalid_transition');
      db.prepare(`UPDATE quizzes SET status = 'paused', updated_at = ? WHERE id = ?`).run(now, quizId);
      break;
    case 'resume':
      if (quiz.status !== 'paused') throw new ApiError(409, 'Only a paused quiz can be resumed.', 'invalid_transition');
      db.prepare(`UPDATE quizzes SET status = 'active', updated_at = ? WHERE id = ?`).run(now, quizId);
      break;
    case 'end':
      db.prepare(`UPDATE quizzes SET status = 'ended', end_at = COALESCE(end_at, ?), updated_at = ? WHERE id = ?`).run(
        now,
        now,
        quizId,
      );
      break;
    case 'archive':
      db.prepare(`UPDATE quizzes SET status = 'archived', archived_at = ?, updated_at = ? WHERE id = ?`).run(now, now, quizId);
      break;
    case 'unarchive':
      db.prepare(`UPDATE quizzes SET status = 'draft', archived_at = NULL, updated_at = ? WHERE id = ?`).run(now, quizId);
      break;
    case 'draft':
      db.prepare(`UPDATE quizzes SET status = 'draft', updated_at = ? WHERE id = ?`).run(now, quizId);
      break;
    case 'close_registration':
      db.prepare(`UPDATE quizzes SET allow_registration = 0, updated_at = ? WHERE id = ?`).run(now, quizId);
      break;
    case 'open_registration':
      db.prepare(`UPDATE quizzes SET allow_registration = 1, updated_at = ? WHERE id = ?`).run(now, quizId);
      break;
    default:
      throw new ApiError(400, 'Unknown quiz action.', 'invalid_action');
  }
  return getQuiz(quizId);
}

export function deleteQuiz(quizId: string): void {
  const attemptCount = (
    getDb().prepare('SELECT COUNT(*) AS n FROM attempts WHERE quiz_id = ?').get(quizId) as { n: number }
  ).n;
  if (attemptCount > 0) {
    throw new ApiError(
      409,
      'This quiz already has attempts and cannot be deleted. Archive it instead so participant records are preserved.',
      'quiz_has_attempts',
    );
  }
  getDb().prepare('DELETE FROM quizzes WHERE id = ?').run(quizId);
}

export function duplicateQuiz(quizId: string, createdBy: string): QuizRow {
  const quiz = getQuiz(quizId);
  const copy = createQuiz(
    {
      title: `${quiz.title} (copy)`,
      description: quiz.description,
      instructions: quiz.instructions,
      startAt: null,
      endAt: null,
      durationMinutes: quiz.duration_minutes,
      passPercentage: quiz.pass_percentage,
      maxAttempts: quiz.max_attempts,
      shuffleQuestions: Boolean(quiz.shuffle_questions),
      shuffleOptions: Boolean(quiz.shuffle_options),
      randomQuestionCount: quiz.random_question_count,
      negativeMarking: Boolean(quiz.negative_marking),
      resultVisibility: quiz.result_visibility,
      certificateRule: quiz.certificate_rule,
      certificateMinScore: quiz.certificate_min_score,
      certCourseName: quiz.cert_course_name,
      certConductedBy: quiz.cert_conducted_by,
      certDuration: quiz.cert_duration,
      autoEmail: Boolean(quiz.auto_email),
      emailSubject: quiz.email_subject,
      emailBody: quiz.email_body,
      certFolderId: quiz.cert_folder_id,
      allowRegistration: Boolean(quiz.allow_registration),
      allowedEmailDomain: quiz.allowed_email_domain,
      allowedDepartments: quiz.allowed_departments,
      violationWarnAfter: quiz.violation_warn_after,
      violationAutoSubmitCount: quiz.violation_auto_submit_count,
    },
    createdBy,
  );
  const questions = listQuestions(quizId);
  for (const q of questions) {
    const created = createQuestion(copy.id, {
      text: q.text,
      type: q.type,
      marks: q.marks,
      negativeMarks: q.negative_marks,
      difficulty: q.difficulty,
      explanation: q.explanation ?? undefined,
      imageUrl: q.image_url ?? undefined,
      options: q.options.map((o) => ({ text: o.text, isCorrect: Boolean(o.is_correct) })),
    });
    void created;
  }
  return copy;
}

export function regenerateJoinCode(quizId: string): QuizRow {
  const joinCode = uniqueJoinCode();
  getDb().prepare('UPDATE quizzes SET join_code = ?, updated_at = ? WHERE id = ?').run(joinCode, nowIso(), quizId);
  return getQuiz(quizId);
}

/* ------------------------------------------------------------------ */
/* Questions                                                          */
/* ------------------------------------------------------------------ */

export interface QuestionInput {
  text: string;
  type: 'single' | 'multi' | 'truefalse';
  marks?: number;
  negativeMarks?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  explanation?: string;
  imageUrl?: string;
  sortOrder?: number;
  options: { text: string; isCorrect: boolean }[];
}

export type QuestionWithOptions = QuestionRow & { options: OptionRow[] };

export function listQuestions(quizId: string): QuestionWithOptions[] {
  const db = getDb();
  const questions = db
    .prepare('SELECT * FROM questions WHERE quiz_id = ? ORDER BY sort_order ASC, created_at ASC')
    .all(quizId) as QuestionRow[];
  const options = db
    .prepare(
      `SELECT o.* FROM question_options o JOIN questions q ON q.id = o.question_id WHERE q.quiz_id = ? ORDER BY o.sort_order ASC`,
    )
    .all(quizId) as OptionRow[];
  return questions.map((q) => ({ ...q, options: options.filter((o) => o.question_id === q.id) }));
}

export function quizTotals(quizId: string): { totalQuestions: number; totalMarks: number } {
  const row = getDb()
    .prepare('SELECT COUNT(*) AS n, COALESCE(SUM(marks),0) AS marks FROM questions WHERE quiz_id = ?')
    .get(quizId) as { n: number; marks: number };
  return { totalQuestions: row.n, totalMarks: row.marks };
}

function validateQuestionInput(input: QuestionInput): { text: string; options: { text: string; isCorrect: boolean }[] } {
  const text = String(input.text ?? '').trim();
  if (!text) throw new ApiError(400, 'Question text is required.', 'validation_error');
  let options = (input.options ?? []).map((o) => ({ text: String(o.text ?? '').trim(), isCorrect: Boolean(o.isCorrect) }));
  options = options.filter((o) => o.text.length > 0);
  if (input.type === 'truefalse' && options.length === 0) {
    options = [
      { text: 'True', isCorrect: false },
      { text: 'False', isCorrect: false },
    ];
  }
  if (options.length < 2) throw new ApiError(400, 'A question needs at least two options.', 'validation_error');
  const correct = options.filter((o) => o.isCorrect);
  if (input.type === 'multi') {
    if (correct.length < 1) throw new ApiError(400, 'Select at least one correct option.', 'validation_error');
  } else if (correct.length !== 1) {
    throw new ApiError(400, 'Select exactly one correct option for this question type.', 'validation_error');
  }
  return { text, options };
}

export function createQuestion(quizId: string, input: QuestionInput): QuestionWithOptions {
  getQuiz(quizId);
  const { text, options } = validateQuestionInput(input);
  const db = getDb();
  const maxOrder = (
    db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM questions WHERE quiz_id = ?').get(quizId) as {
      m: number;
    }
  ).m;
  const id = newId('qst');
  db.prepare(
    `INSERT INTO questions (id, quiz_id, text, type, marks, negative_marks, difficulty, explanation, image_url, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    quizId,
    text,
    input.type,
    input.marks ?? 1,
    input.negativeMarks ?? 0,
    input.difficulty ?? 'medium',
    input.explanation ?? null,
    input.imageUrl ?? null,
    input.sortOrder ?? maxOrder + 1,
  );
  options.forEach((opt, index) => {
    const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    db.prepare(
      `INSERT INTO question_options (id, question_id, label, text, is_correct, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(newId('opt'), id, labels[index] ?? String(index + 1), opt.text, opt.isCorrect ? 1 : 0, index);
  });
  return listQuestions(quizId).find((q) => q.id === id)!;
}

export function updateQuestion(questionId: string, input: QuestionInput): QuestionWithOptions {
  const db = getDb();
  const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(questionId) as QuestionRow | undefined;
  if (!question) throw new ApiError(404, 'Question not found.', 'question_not_found');
  const { text, options } = validateQuestionInput(input);
  db.prepare(
    `UPDATE questions SET text = ?, type = ?, marks = ?, negative_marks = ?, difficulty = ?, explanation = ?,
      image_url = ?, updated_at = ? WHERE id = ?`,
  ).run(
    text,
    input.type,
    input.marks ?? question.marks,
    input.negativeMarks ?? question.negative_marks,
    input.difficulty ?? question.difficulty,
    input.explanation ?? null,
    input.imageUrl ?? null,
    nowIso(),
    questionId,
  );
  db.prepare('DELETE FROM question_options WHERE question_id = ?').run(questionId);
  const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  options.forEach((opt, index) => {
    db.prepare(
      `INSERT INTO question_options (id, question_id, label, text, is_correct, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(newId('opt'), questionId, labels[index] ?? String(index + 1), opt.text, opt.isCorrect ? 1 : 0, index);
  });
  return listQuestions(question.quiz_id).find((q) => q.id === questionId)!;
}

export function deleteQuestion(questionId: string): void {
  const db = getDb();
  const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(questionId) as QuestionRow | undefined;
  if (!question) throw new ApiError(404, 'Question not found.', 'question_not_found');
  const attempts = (
    db.prepare('SELECT COUNT(*) AS n FROM attempts WHERE quiz_id = ?').get(question.quiz_id) as { n: number }
  ).n;
  if (attempts > 0) {
    throw new ApiError(
      409,
      'This quiz already has attempts; deleting questions would change historical scoring. Duplicate the quiz instead.',
      'quiz_has_attempts',
    );
  }
  db.prepare('DELETE FROM questions WHERE id = ?').run(questionId);
}

export function duplicateQuestion(questionId: string): QuestionWithOptions {
  const db = getDb();
  const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(questionId) as QuestionRow | undefined;
  if (!question) throw new ApiError(404, 'Question not found.', 'question_not_found');
  const options = db
    .prepare('SELECT * FROM question_options WHERE question_id = ? ORDER BY sort_order ASC')
    .all(questionId) as OptionRow[];
  return createQuestion(question.quiz_id, {
    text: `${question.text} (copy)`,
    type: question.type,
    marks: question.marks,
    negativeMarks: question.negative_marks,
    difficulty: question.difficulty,
    explanation: question.explanation ?? undefined,
    imageUrl: question.image_url ?? undefined,
    options: options.map((o) => ({ text: o.text, isCorrect: Boolean(o.is_correct) })),
  });
}

export function reorderQuestions(quizId: string, orderedIds: string[]): void {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM questions WHERE quiz_id = ?').all(quizId) as { id: string }[];
  const valid = new Set(existing.map((q) => q.id));
  if (orderedIds.some((id) => !valid.has(id)) || orderedIds.length !== existing.length) {
    throw new ApiError(400, 'Question order payload does not match the quiz question set.', 'invalid_order');
  }
  orderedIds.forEach((id, index) => {
    db.prepare('UPDATE questions SET sort_order = ? WHERE id = ?').run(index, id);
  });
}

/* ------------------------------------------------------------------ */
/* CSV import / export                                                */
/* ------------------------------------------------------------------ */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch !== '\r') cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

export interface ImportSummary {
  imported: number;
  skipped: { row: number; reason: string }[];
}

export function importQuestionsCsv(quizId: string, csv: string): ImportSummary {
  const rows = parseCsv(csv);
  if (!rows.length) throw new ApiError(400, 'CSV file is empty.', 'empty_csv');
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const required = ['question'];
  for (const col of required) {
    if (idx(col) === -1) throw new ApiError(400, `CSV is missing the "${col}" column.`, 'invalid_csv');
  }
  const summary: ImportSummary = { imported: 0, skipped: [] };
  const get = (row: string[], name: string) => (idx(name) >= 0 ? String(row[idx(name)] ?? '').trim() : '');

  rows.slice(1).forEach((row, index) => {
    const rowNumber = index + 2;
    try {
      const questionText = get(row, 'question');
      if (!questionText) throw new Error('missing question text');
      const rawType = (get(row, 'type') || 'single').toLowerCase();
      const type: QuestionInput['type'] = rawType.includes('multi')
        ? 'multi'
        : rawType.includes('true')
          ? 'truefalse'
          : 'single';
      const optionTexts = ['a', 'b', 'c', 'd', 'e', 'f']
        .map((letter) => get(row, `option${letter}`))
        .filter(Boolean);
      const correctRaw = get(row, 'correct').toUpperCase();
      const correctLetters = correctRaw.split(/[,;|\s]+/).filter(Boolean);
      const options = optionTexts.map((text, i) => ({
        text,
        isCorrect: correctLetters.includes(String.fromCharCode(65 + i)),
      }));
      if (type === 'truefalse' && options.length === 0) {
        options.push({ text: 'True', isCorrect: correctLetters.includes('A') || correctRaw === 'TRUE' });
        options.push({ text: 'False', isCorrect: correctLetters.includes('B') || correctRaw === 'FALSE' });
      }
      createQuestion(quizId, {
        text: questionText,
        type,
        marks: Number(get(row, 'marks') || 1) || 1,
        negativeMarks: Number(get(row, 'negative') || 0) || 0,
        difficulty: (get(row, 'difficulty').toLowerCase() as QuestionInput['difficulty']) || 'medium',
        explanation: get(row, 'explanation'),
        options,
      });
      summary.imported += 1;
    } catch (err) {
      summary.skipped.push({ row: rowNumber, reason: (err as Error).message });
    }
  });
  return summary;
}

export function exportQuestionsCsv(quizId: string): string {
  const questions = listQuestions(quizId);
  const esc = (value: string | number | null | undefined) => {
    const s = String(value ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
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
  const lines = [header.join(',')];
  for (const q of questions) {
    const correct = q.options
      .map((o, i) => (o.is_correct ? String.fromCharCode(65 + i) : null))
      .filter(Boolean)
      .join(';');
    const optionText = (i: number) => q.options[i]?.text ?? '';
    lines.push(
      [
        esc(q.text),
        esc(q.type),
        esc(optionText(0)),
        esc(optionText(1)),
        esc(optionText(2)),
        esc(optionText(3)),
        esc(optionText(4)),
        esc(optionText(5)),
        esc(correct),
        q.marks,
        q.negative_marks,
        esc(q.difficulty),
        esc(q.explanation ?? ''),
      ].join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}

export function listQuizSummaries() {
  const db = getDb();
  const quizzes = db.prepare('SELECT * FROM quizzes ORDER BY created_at DESC').all() as QuizRow[];
  const totals = db
    .prepare('SELECT quiz_id, COUNT(*) AS n, COALESCE(SUM(marks),0) AS marks FROM questions GROUP BY quiz_id')
    .all() as { quiz_id: string; n: number; marks: number }[];
  const participants = db
    .prepare('SELECT quiz_id, COUNT(*) AS n FROM participants GROUP BY quiz_id')
    .all() as { quiz_id: string; n: number }[];
  const attempts = db
    .prepare(`SELECT quiz_id, COUNT(*) AS n, SUM(CASE WHEN status != 'in_progress' THEN 1 ELSE 0 END) AS subs FROM attempts GROUP BY quiz_id`)
    .all() as { quiz_id: string; n: number; subs: number }[];
  return quizzes.map((q) => ({
    ...q,
    totalQuestions: totals.find((t) => t.quiz_id === q.id)?.n ?? 0,
    totalMarks: totals.find((t) => t.quiz_id === q.id)?.marks ?? 0,
    participantCount: participants.find((p) => p.quiz_id === q.id)?.n ?? 0,
    attemptCount: attempts.find((a) => a.quiz_id === q.id)?.n ?? 0,
    submissionCount: attempts.find((a) => a.quiz_id === q.id)?.subs ?? 0,
  }));
}
