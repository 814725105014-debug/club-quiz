import { getDb } from '../db.js';

export interface DashboardStats {
  quizzes: { total: number; draft: number; scheduled: number; active: number; completed: number; published: number };
  participants: number;
  attempts: number;
  submissions: number;
  averageScore: number;
  certificates: { generated: number; pending: number; failed: number; emailed: number };
  emails: { sent: number; failed: number; queued: number };
  violations: number;
  syncQueue: { pending: number; failed: number };
}

export function dashboardStats(): DashboardStats {
  const db = getDb();
  const quizCounts = db.prepare('SELECT status, COUNT(*) AS n FROM quizzes GROUP BY status').all() as {
    status: string;
    n: number;
  }[];
  const byStatus = (status: string) => quizCounts.find((q) => q.status === status)?.n ?? 0;

  const participants = (db.prepare('SELECT COUNT(*) AS n FROM participants').get() as { n: number }).n;
  const attempts = (db.prepare('SELECT COUNT(*) AS n FROM attempts').get() as { n: number }).n;
  const submissionRow = db
    .prepare(`SELECT COUNT(*) AS n, COALESCE(AVG(percentage),0) AS avg FROM attempts WHERE status != 'in_progress'`)
    .get() as { n: number; avg: number };

  const certCounts = db
    .prepare('SELECT status, COUNT(*) AS n FROM certificates GROUP BY status')
    .all() as { status: string; n: number }[];
  const certByStatus = (s: string) => certCounts.find((c) => c.status === s)?.n ?? 0;
  const emailed = (
    db
      .prepare(`SELECT COUNT(*) AS n FROM certificates WHERE email_status IN ('sent','redirected')`)
      .get() as { n: number }
  ).n;

  const emailCounts = db.prepare('SELECT status, COUNT(*) AS n FROM emails GROUP BY status').all() as {
    status: string;
    n: number;
  }[];
  const emailByStatus = (s: string) => emailCounts.find((e) => e.status === s)?.n ?? 0;

  const violations = (db.prepare('SELECT COUNT(*) AS n FROM violations').get() as { n: number }).n;
  const pendingJobs = (
    db.prepare(`SELECT COUNT(*) AS n FROM sync_jobs WHERE status IN ('pending','processing')`).get() as { n: number }
  ).n;
  const failedJobs = (
    db.prepare(`SELECT COUNT(*) AS n FROM sync_jobs WHERE status = 'failed'`).get() as { n: number }
  ).n;

  return {
    quizzes: {
      total: quizCounts.reduce((sum, q) => sum + q.n, 0),
      draft: byStatus('draft'),
      scheduled: byStatus('scheduled'),
      active: byStatus('active') + byStatus('paused'),
      published: byStatus('published'),
      completed: byStatus('ended'),
    },
    participants,
    attempts,
    submissions: submissionRow.n,
    averageScore: Math.round(submissionRow.avg * 100) / 100,
    certificates: {
      generated: certByStatus('generated'),
      pending: certByStatus('pending') + certByStatus('generating'),
      failed: certByStatus('failed'),
      emailed,
    },
    emails: { sent: emailByStatus('sent') + emailByStatus('redirected'), failed: emailByStatus('failed'), queued: emailByStatus('queued') },
    violations,
    syncQueue: { pending: pendingJobs, failed: failedJobs },
  };
}

export function recentActivity(limit = 12) {
  return getDb()
    .prepare(
      `SELECT id, actor_email, action, entity, entity_id, detail, created_at FROM audit_log ORDER BY id DESC LIMIT ?`,
    )
    .all(limit) as {
    id: number;
    actor_email: string;
    action: string;
    entity: string;
    entity_id: string;
    detail: string | null;
    created_at: string;
  }[];
}

export function upcomingQuizzes(limit = 5) {
  return getDb()
    .prepare(
      `SELECT * FROM quizzes WHERE status IN ('scheduled','published','active') AND (end_at IS NULL OR end_at > datetime('now'))
       ORDER BY COALESCE(start_at, '9999') ASC LIMIT ?`,
    )
    .all(limit) as Record<string, unknown>[];
}

export interface ResultRow {
  attemptId: string;
  quizId: string;
  quizTitle: string;
  participantId: string;
  name: string;
  regNumber: string | null;
  department: string | null;
  email: string;
  score: number;
  totalMarks: number;
  percentage: number;
  passed: number;
  status: string;
  submittedAt: string | null;
  durationSeconds: number | null;
  violations: number;
  certificateStatus: string | null;
  certificateId: string | null;
  pdfUrl: string | null;
  emailStatus: string | null;
}

export interface ResultFilters {
  quizId?: string;
  search?: string;
  result?: 'pass' | 'fail';
  certificateStatus?: string;
  emailStatus?: string;
  limit?: number;
  offset?: number;
  sort?: 'submitted_desc' | 'score_desc' | 'score_asc' | 'name_asc';
}

export function resultsList(filters: ResultFilters = {}): { rows: ResultRow[]; total: number } {
  const db = getDb();
  const where: string[] = [`a.status != 'in_progress'`];
  const params: (string | number)[] = [];
  if (filters.quizId) {
    where.push('a.quiz_id = ?');
    params.push(filters.quizId);
  }
  if (filters.search) {
    where.push('(lower(p.name) LIKE ? OR lower(p.email) LIKE ? OR lower(COALESCE(p.reg_number,\'\')) LIKE ?)');
    const term = `%${filters.search.toLowerCase()}%`;
    params.push(term, term, term);
  }
  if (filters.result === 'pass') where.push('a.passed = 1');
  if (filters.result === 'fail') where.push('a.passed = 0');
  if (filters.certificateStatus) {
    where.push('COALESCE(c.status, \'none\') = ?');
    params.push(filters.certificateStatus);
  }
  if (filters.emailStatus) {
    where.push('COALESCE(c.email_status, \'none\') = ?');
    params.push(filters.emailStatus);
  }
  const order =
    filters.sort === 'score_desc'
      ? 'a.percentage DESC'
      : filters.sort === 'score_asc'
        ? 'a.percentage ASC'
        : filters.sort === 'name_asc'
          ? 'p.name ASC'
          : 'a.submitted_at DESC';

  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
  const offset = Math.max(filters.offset ?? 0, 0);

  const total = (
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM attempts a JOIN participants p ON p.id = a.participant_id
         LEFT JOIN certificates c ON c.attempt_id = a.id WHERE ${where.join(' AND ')}`,
      )
      .get(...params) as { n: number }
  ).n;

  const rows = db
    .prepare(
      `SELECT a.id AS attemptId, a.quiz_id AS quizId, q.title AS quizTitle, p.id AS participantId,
        p.name AS name, p.reg_number AS regNumber, p.department AS department, p.email AS email,
        a.score AS score, a.total_marks AS totalMarks, a.percentage AS percentage, a.passed AS passed,
        a.status AS status, a.submitted_at AS submittedAt, a.duration_seconds AS durationSeconds,
        a.violations_count AS violations, c.status AS certificateStatus, c.certificate_id AS certificateId,
        c.pdf_url AS pdfUrl, c.email_status AS emailStatus
       FROM attempts a
       JOIN participants p ON p.id = a.participant_id
       JOIN quizzes q ON q.id = a.quiz_id
       LEFT JOIN certificates c ON c.attempt_id = a.id
       WHERE ${where.join(' AND ')}
       ORDER BY ${order}
       LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset) as ResultRow[];
  return { rows, total };
}

export function quizAnalytics(quizId: string) {
  const db = getDb();
  const stats = db
    .prepare(
      `SELECT COUNT(*) AS attempts,
        SUM(CASE WHEN status != 'in_progress' THEN 1 ELSE 0 END) AS submissions,
        COALESCE(AVG(CASE WHEN status != 'in_progress' THEN percentage END),0) AS average,
        COALESCE(MAX(CASE WHEN status != 'in_progress' THEN percentage END),0) AS highest,
        COALESCE(MIN(CASE WHEN status != 'in_progress' THEN percentage END),0) AS lowest,
        SUM(CASE WHEN passed = 1 AND status != 'in_progress' THEN 1 ELSE 0 END) AS passes
       FROM attempts WHERE quiz_id = ?`,
    )
    .get(quizId) as {
    attempts: number;
    submissions: number;
    average: number;
    highest: number;
    lowest: number;
    passes: number;
  };
  const questionStats = db
    .prepare(
      `SELECT q.id, q.text, q.marks,
        COUNT(aa.id) AS responses,
        SUM(CASE WHEN aa.is_correct = 1 THEN 1 ELSE 0 END) AS correct,
        SUM(CASE WHEN aa.is_correct = 0 THEN 1 ELSE 0 END) AS incorrect
       FROM questions q
       LEFT JOIN attempt_answers aa ON aa.question_id = q.id
       LEFT JOIN attempts a ON a.id = aa.attempt_id AND a.status != 'in_progress'
       WHERE q.quiz_id = ?
       GROUP BY q.id ORDER BY q.sort_order ASC`,
    )
    .all(quizId) as {
    id: string;
    text: string;
    marks: number;
    responses: number;
    correct: number;
    incorrect: number;
  }[];
  const certStats = db
    .prepare(
      `SELECT COUNT(*) AS total,
        SUM(CASE WHEN status = 'generated' THEN 1 ELSE 0 END) AS generated,
        SUM(CASE WHEN status IN ('pending','generating') THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN email_status IN ('sent','redirected') THEN 1 ELSE 0 END) AS emailed
       FROM certificates WHERE quiz_id = ?`,
    )
    .get(quizId) as { total: number; generated: number; pending: number; failed: number; emailed: number };

  return {
    attempts: stats.attempts ?? 0,
    submissions: stats.submissions ?? 0,
    average: Math.round((stats.average ?? 0) * 100) / 100,
    highest: Math.round((stats.highest ?? 0) * 100) / 100,
    lowest: Math.round((stats.lowest ?? 0) * 100) / 100,
    passRate: stats.submissions ? Math.round(((stats.passes ?? 0) / stats.submissions) * 1000) / 10 : 0,
    questionStats: questionStats.map((q) => ({
      ...q,
      accuracy: q.responses ? Math.round(((q.correct ?? 0) / q.responses) * 1000) / 10 : 0,
    })),
    certificates: certStats,
  };
}

export function liveQuizOverview(quizId: string) {
  const db = getDb();
  const participants = (
    db.prepare('SELECT COUNT(*) AS n FROM participants WHERE quiz_id = ?').get(quizId) as { n: number }
  ).n;
  const attempts = db
    .prepare(
      `SELECT a.*, p.name, p.email, p.reg_number, p.department FROM attempts a
       JOIN participants p ON p.id = a.participant_id WHERE a.quiz_id = ? ORDER BY a.started_at DESC`,
    )
    .all(quizId) as Record<string, unknown>[];
  const inProgress = attempts.filter((a) => a.status === 'in_progress');
  const submitted = attempts.filter((a) => a.status !== 'in_progress');
  const violations = db
    .prepare(
      `SELECT v.*, p.name FROM violations v JOIN participants p ON p.id = v.participant_id
       WHERE v.quiz_id = ? ORDER BY v.created_at DESC LIMIT 50`,
    )
    .all(quizId) as Record<string, unknown>[];
  const announcements = db
    .prepare('SELECT * FROM announcements WHERE quiz_id = ? ORDER BY created_at DESC LIMIT 10')
    .all(quizId) as Record<string, unknown>[];
  return {
    participantCount: participants,
    joined: attempts.length,
    inProgress: inProgress.length,
    submitted: submitted.length,
    notStarted: Math.max(0, participants - attempts.length),
    avgPercentage:
      submitted.length > 0
        ? Math.round(
            (submitted.reduce((sum, a) => sum + Number(a.percentage ?? 0), 0) / submitted.length) * 100,
          ) / 100
        : 0,
    participants: attempts,
    violations,
    announcements,
  };
}

export function fieldUsageStats() {
  const db = getDb();
  return db.prepare('SELECT * FROM registration_fields ORDER BY sort_order ASC').all();
}

export function emailList(filters: { status?: string; search?: string; limit?: number } = {}) {
  const db = getDb();
  const where: string[] = ['1=1'];
  const params: (string | number)[] = [];
  if (filters.status) {
    where.push('status = ?');
    params.push(filters.status);
  }
  if (filters.search) {
    where.push('(lower(to_email) LIKE ? OR lower(subject) LIKE ?)');
    const term = `%${filters.search.toLowerCase()}%`;
    params.push(term, term);
  }
  const rows = db
    .prepare(
      `SELECT id, template_key, to_email, actual_recipient, subject, status, provider_message_id, error,
        attempt_count, created_at, sent_at, certificate_id FROM emails
       WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT ?`,
    )
    .all(...params, Math.min(filters.limit ?? 200, 500));
  return rows;
}
