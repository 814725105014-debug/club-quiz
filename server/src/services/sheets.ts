import { getDb } from '../db.js';
import { getWorkspaceConfig } from './config.js';
import { getProvider, type SheetWrite } from './google.js';
import { formatDateTime } from '../lib/time.js';
import type { AttemptRow, CertificateRow, ParticipantRow, QuizRow } from '../domain.js';

/**
 * Column layout of the existing "Form Responses 1" tab (Google Form response sheet).
 * Header text is preserved verbatim — including trailing spaces — because the existing
 * Apps Script automation resolves columns by header name.
 */
export const FORM_RESPONSE_HEADERS = [
  'Timestamp',
  'Email Address',
  'Participant Full Name ',
  '  Register Number  ',
  '  Department  ',
  '  Course Name  ',
  '  Conducted By  ',
  '  Course Duration  ',
  'Issue Date  ',
  'Certificate ID',
  'PDF URL',
  'Mail Status',
  'Mail Sent Time',
  'Error',
  'Slide File ID',
] as const;

export const QUIZ_RESULTS_HEADERS = [
  'Attempt ID',
  'Quiz ID',
  'Quiz Title',
  'Participant Name',
  'Register Number',
  'Department',
  'Email Address',
  'Score',
  'Total Marks',
  'Percentage',
  'Result',
  'Submitted At',
  'Duration (seconds)',
  'Violations',
  'Certificate ID',
  'Certificate Status',
  'Email Status',
  'PDF URL',
  'Last Synced',
] as const;

export function certificateCourseName(quiz: QuizRow): string {
  return quiz.cert_course_name || quiz.title;
}

/** Mirrors the row the existing certificate automation writes to "Form Responses 1". */
export function buildFormResponseRow(
  quiz: QuizRow,
  participant: ParticipantRow,
  cert: CertificateRow,
  emailStatus: string,
  mailSentTime: string | null,
): (string | number | null)[] {
  return [
    new Date().toISOString(),
    participant.email,
    participant.name,
    participant.reg_number ?? '',
    participant.department ?? '',
    certificateCourseName(quiz),
    quiz.cert_conducted_by ?? '',
    quiz.cert_duration ?? '',
    new Date().toISOString(),
    cert.certificate_id,
    cert.pdf_url ?? '',
    emailStatus,
    mailSentTime ?? '',
    cert.error ?? '',
    cert.slide_file_id ?? '',
  ];
}

export async function syncCertificateToFormResponses(certificateRowId: string): Promise<void> {
  const db = getDb();
  const cert = db.prepare('SELECT * FROM certificates WHERE id = ?').get(certificateRowId) as
    | CertificateRow
    | undefined;
  if (!cert) throw new Error('Certificate record not found for sheet sync.');
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(cert.quiz_id) as QuizRow;
  const participant = db
    .prepare('SELECT * FROM participants WHERE id = ?')
    .get(cert.participant_id) as ParticipantRow;
  const cfg = getWorkspaceConfig();
  const provider = getProvider(cfg);

  const mailLabel =
    cert.email_status === 'sent'
      ? 'Sent'
      : cert.email_status === 'redirected'
        ? 'Sent (test redirect)'
        : cert.email_status === 'failed'
          ? 'Failed'
          : 'Pending';
  await provider.writeSheetRow(
    {
      tab: cfg.responsesTab,
      mode: 'upsert',
      keyColumn: 'Certificate ID',
      keyValue: cert.certificate_id,
      headers: [...FORM_RESPONSE_HEADERS],
      values: buildFormResponseRow(quiz, participant, cert, mailLabel, cert.issued_at),
    },
    cfg,
  );
}

export async function syncAttemptToResults(attemptId: string): Promise<void> {
  const db = getDb();
  const attempt = db.prepare('SELECT * FROM attempts WHERE id = ?').get(attemptId) as
    | AttemptRow
    | undefined;
  if (!attempt) throw new Error('Attempt not found for result sync.');
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(attempt.quiz_id) as QuizRow;
  const participant = db
    .prepare('SELECT * FROM participants WHERE id = ?')
    .get(attempt.participant_id) as ParticipantRow;
  const cert = db
    .prepare('SELECT * FROM certificates WHERE attempt_id = ?')
    .get(attempt.id) as CertificateRow | undefined;

  const cfg = getWorkspaceConfig();
  const values = [
    attempt.id,
    quiz.id,
    quiz.title,
    participant.name,
    participant.reg_number ?? '',
    participant.department ?? '',
    participant.email,
    attempt.score,
    attempt.total_marks,
    Number(attempt.percentage.toFixed(2)),
    attempt.passed ? 'PASS' : 'FAIL',
    attempt.submitted_at ?? '',
    attempt.duration_seconds ?? '',
    attempt.violations_count,
    cert?.certificate_id ?? '',
    cert?.status ?? (cert ? 'pending' : 'not_applicable'),
    cert?.email_status ?? '',
    cert?.pdf_url ?? '',
    formatDateTime(new Date().toISOString()),
  ];

  const provider = getProvider(cfg);
  await provider.writeSheetRow(
    {
      tab: cfg.resultsTab,
      mode: 'upsert',
      keyColumn: 'Attempt ID',
      keyValue: attempt.id,
      headers: [...QUIZ_RESULTS_HEADERS],
      values,
    },
    cfg,
  );
}

export async function ensureResultsTab(): Promise<{ ok: boolean; message: string }> {
  const cfg = getWorkspaceConfig();
  const provider = getProvider(cfg);
  try {
    const tabs = await provider.listTabs(cfg);
    if (tabs.includes(cfg.resultsTab)) return { ok: true, message: `${cfg.resultsTab} tab already exists.` };
    return {
      ok: false,
      message: `The "${cfg.resultsTab}" tab does not exist yet. Create it (headers: ${QUIZ_RESULTS_HEADERS.join(
        ' | ',
      )}) or let the first sync create it via the Apps Script bridge.`,
    };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}
