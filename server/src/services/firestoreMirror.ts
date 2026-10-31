import { getDb } from '../db.js';
import { env } from '../env.js';
import { enqueueJob } from './jobs.js';
import { deleteMirrorDocument, mirrorDocument, type MirrorCollection } from './firebase.js';

/**
 * Firestore mirroring.
 *
 * SQLite remains the transactional source of truth: grading, the server-authoritative
 * timer, certificate numbering and the job queue all depend on local transactions that a
 * hosted document store cannot express atomically. Firestore receives a denormalised
 * projection so the Firebase project has a live, rules-protected read model for
 * dashboards — and, crucially, so no answer key is ever mirrored.
 *
 * Enable with FIRESTORE_MIRROR=true. When it is off every function here is a no-op.
 */

export type MirrorKind = 'quiz' | 'participant' | 'attempt' | 'certificate' | 'fields';

export function mirrorEnabled(): boolean {
  return env.firebase.mirror;
}

/** Queues a projection refresh; the job handler reads the current row so retries converge. */
export function queueMirror(kind: MirrorKind, id: string): void {
  if (!mirrorEnabled()) return;
  enqueueJob('firestore_mirror', { kind, id });
}

export function mirrorCollectionFor(kind: MirrorKind): MirrorCollection {
  switch (kind) {
    case 'quiz':
      return 'quizzes';
    case 'participant':
      return 'participants';
    case 'attempt':
      return 'attempts';
    case 'certificate':
      return 'certificates';
    case 'fields':
      return 'registrationFields';
  }
}

/** Builds the answer-key-free projection for a domain record. */
export function buildProjection(kind: MirrorKind, id: string): Record<string, unknown> | null {
  const db = getDb();
  switch (kind) {
    case 'quiz': {
      const quiz = db
        .prepare(
          `SELECT id, title, status, join_code, start_at, end_at, duration_minutes, pass_percentage,
            result_visibility, certificate_rule, allow_registration, created_at, updated_at
           FROM quizzes WHERE id = ?`,
        )
        .get(id) as Record<string, unknown> | undefined;
      if (!quiz) return null;
      const totals = db
        .prepare('SELECT COUNT(*) AS questions, COALESCE(SUM(marks),0) AS marks FROM questions WHERE quiz_id = ?')
        .get(id) as { questions: number; marks: number };
      const counts = db
        .prepare(
          `SELECT (SELECT COUNT(*) FROM participants WHERE quiz_id = ?) AS participants,
                  (SELECT COUNT(*) FROM attempts WHERE quiz_id = ? AND status != 'in_progress') AS submissions`,
        )
        .get(id, id) as { participants: number; submissions: number };
      return {
        ...quiz,
        questionCount: totals.questions,
        totalMarks: totals.marks,
        participantCount: counts.participants,
        submissionCount: counts.submissions,
      };
    }
    case 'participant': {
      const participant = db
        .prepare('SELECT id, quiz_id, name, email, reg_number, department, created_at FROM participants WHERE id = ?')
        .get(id) as Record<string, unknown> | undefined;
      if (!participant) return null;
      return { ...participant, quizId: participant.quiz_id };
    }
    case 'attempt': {
      const attempt = db
        .prepare(
          `SELECT a.id, a.quiz_id, a.participant_id, a.status, a.score, a.total_marks, a.percentage, a.passed,
            a.started_at, a.submitted_at, a.duration_seconds, a.violations_count, p.name, p.reg_number
           FROM attempts a JOIN participants p ON p.id = a.participant_id WHERE a.id = ?`,
        )
        .get(id) as Record<string, unknown> | undefined;
      if (!attempt) return null;
      // Deliberately excludes answers and question ids: the projection is leaderboard-shaped.
      return { ...attempt, quizId: attempt.quiz_id };
    }
    case 'certificate': {
      const certificate = db
        .prepare(
          `SELECT c.id, c.certificate_id, c.quiz_id, c.participant_id, c.status, c.issued_at, c.email_status,
            p.name
           FROM certificates c JOIN participants p ON p.id = c.participant_id WHERE c.id = ?`,
        )
        .get(id) as Record<string, unknown> | undefined;
      if (!certificate) return null;
      return { ...certificate, quizId: certificate.quiz_id };
    }
    case 'fields': {
      const field = db
        .prepare('SELECT id, key, label, type, required, enabled, sort_order FROM registration_fields WHERE id = ?')
        .get(id) as Record<string, unknown> | undefined;
      return field ?? null;
    }
    default:
      return null;
  }
}

export async function syncMirror(kind: MirrorKind, id: string): Promise<boolean> {
  if (!mirrorEnabled()) return false;
  const projection = buildProjection(kind, id);
  if (!projection) {
    await deleteMirrorDocument(mirrorCollectionFor(kind), id);
    return false;
  }
  return mirrorDocument(mirrorCollectionFor(kind), id, projection);
}

/** Mirrors every registration field in one pass (called after the form editor saves). */
export async function syncAllFields(): Promise<number> {
  if (!mirrorEnabled()) return 0;
  const rows = getDb().prepare('SELECT id FROM registration_fields').all() as { id: string }[];
  let count = 0;
  for (const row of rows) {
    if (await syncMirror('fields', row.id)) count += 1;
  }
  return count;
}
