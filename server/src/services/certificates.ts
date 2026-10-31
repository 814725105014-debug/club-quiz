import { getDb } from '../db.js';
import { queueMirror } from './firestoreMirror.js';
import { newId } from '../lib/ids.js';
import { nowIso } from '../lib/time.js';
import type { AttemptRow, CertificateRow, ParticipantRow, QuizRow } from '../domain.js';
import {
  buildCertificateId,
  getWorkspaceConfig,
  nextCertificateNumber,
} from './config.js';
import { getProvider } from './google.js';
import { enqueueJob } from './jobs.js';
import { sendCertificateEmail } from './email.js';

export function certificateEligibility(
  quiz: QuizRow,
  attempt: AttemptRow,
): { eligible: boolean; reason: string } {
  if (quiz.certificate_rule === 'none') {
    return { eligible: false, reason: 'Certificates are disabled for this quiz.' };
  }
  if (attempt.status === 'in_progress') {
    return { eligible: false, reason: 'The attempt has not been submitted yet.' };
  }
  if (quiz.certificate_rule === 'always') {
    return { eligible: true, reason: 'Certificate issued for every completed submission.' };
  }
  if (quiz.certificate_rule === 'pass') {
    return {
      eligible: Boolean(attempt.passed),
      reason: attempt.passed
        ? `Passed with ${attempt.percentage.toFixed(2)}% (minimum ${quiz.pass_percentage}%).`
        : `Certificate requires a pass (minimum ${quiz.pass_percentage}%).`,
    };
  }
  const threshold = quiz.certificate_min_score;
  return {
    eligible: attempt.percentage >= threshold,
    reason:
      attempt.percentage >= threshold
        ? `Scored ${attempt.percentage.toFixed(2)}%, meeting the ${threshold}% certificate threshold.`
        : `Certificate requires ${threshold}% or more.`,
  };
}

export function getCertificateForAttempt(attemptId: string): CertificateRow | undefined {
  return getDb().prepare('SELECT * FROM certificates WHERE attempt_id = ?').get(attemptId) as
    | CertificateRow
    | undefined;
}

/**
 * Idempotent: at most one certificate exists per attempt (DB unique constraint).
 * Returns undefined when the attempt is not eligible.
 */
export function ensureCertificateForAttempt(attemptId: string): CertificateRow | undefined {
  const db = getDb();
  const attempt = db.prepare('SELECT * FROM attempts WHERE id = ?').get(attemptId) as
    | AttemptRow
    | undefined;
  if (!attempt) throw new Error('Attempt not found while issuing certificate.');
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(attempt.quiz_id) as QuizRow;

  const eligibility = certificateEligibility(quiz, attempt);
  if (!eligibility.eligible) return undefined;

  const existing = getCertificateForAttempt(attemptId);
  if (existing) return existing;

  const serial = nextCertificateNumber(getWorkspaceConfig().certificateYear);
  const certificateId = buildCertificateId(serial);
  const rowId = newId('crt');
  try {
    db.prepare(
      `INSERT INTO certificates (id, certificate_id, attempt_id, quiz_id, participant_id, status, email_status)
       VALUES (?, ?, ?, ?, ?, 'pending', 'pending')`,
    ).run(rowId, certificateId, attemptId, attempt.quiz_id, attempt.participant_id);
  } catch (err) {
    const raced = getCertificateForAttempt(attemptId);
    if (raced) return raced;
    throw err;
  }

  enqueueJob('issue_certificate', { certificateRowId: rowId });
  return db.prepare('SELECT * FROM certificates WHERE id = ?').get(rowId) as CertificateRow;
}

export async function processCertificateIssue(certificateRowId: string): Promise<void> {
  const db = getDb();
  const cert = db.prepare('SELECT * FROM certificates WHERE id = ?').get(certificateRowId) as
    | CertificateRow
    | undefined;
  if (!cert) throw new Error('Certificate record not found.');
  if (cert.status === 'generated') {
    // Certificate already exists — make sure the delivery email is queued exactly once.
    if (cert.email_status === 'pending') {
      await queueDeliveryEmail(cert);
    }
    return;
  }

  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(cert.quiz_id) as QuizRow;
  const attempt = db.prepare('SELECT * FROM attempts WHERE id = ?').get(cert.attempt_id) as AttemptRow;
  const participant = db
    .prepare('SELECT * FROM participants WHERE id = ?')
    .get(cert.participant_id) as ParticipantRow;

  const cfg = getWorkspaceConfig();
  const provider = getProvider(cfg);
  db.prepare(`UPDATE certificates SET status = 'generating', updated_at = ? WHERE id = ?`).run(
    nowIso(),
    cert.id,
  );

  try {
    const artifact = await provider.issueCertificate(
      {
        certificateId: cert.certificate_id,
        participant: {
          name: participant.name,
          email: participant.email,
          regNumber: participant.reg_number,
          department: participant.department,
        },
        quiz: {
          title: quiz.title,
          courseName: quiz.cert_course_name || quiz.title,
          conductedBy: quiz.cert_conducted_by,
          duration: quiz.cert_duration,
        },
        score: attempt.score,
        totalMarks: attempt.total_marks,
        percentage: attempt.percentage,
        passed: Boolean(attempt.passed),
        issueDateIso: nowIso(),
        verifyUrl: `${cfg.appBaseUrl}/verify/${encodeURIComponent(cert.certificate_id)}`,
        templateId: cfg.templateId,
        folderId: quiz.cert_folder_id || cfg.outputFolderId,
      },
      cfg,
    );

    db.prepare(
      `UPDATE certificates SET status = 'generated', pdf_url = ?, drive_file_id = ?, slide_file_id = ?,
       issued_at = ?, error = NULL, updated_at = ? WHERE id = ?`,
    ).run(
      artifact.pdfUrl,
      artifact.driveFileId,
      artifact.slideFileId,
      nowIso(),
      nowIso(),
      cert.id,
    );

    enqueueJob('sheet_sync_certificate', { certificateRowId: cert.id });
    const refreshed = db.prepare('SELECT * FROM certificates WHERE id = ?').get(cert.id) as CertificateRow;
    if (quiz.auto_email) {
      await queueDeliveryEmail(refreshed);
    } else {
      db.prepare(`UPDATE certificates SET email_status = 'skipped' WHERE id = ?`).run(cert.id);
    }
    enqueueJob('sheet_sync_result', { attemptId: cert.attempt_id });
    queueMirror('certificate', cert.id);
  } catch (err) {
    const message = (err as Error).message.slice(0, 1500);
    db.prepare(
      `UPDATE certificates SET status = 'failed', error = ?, email_status = 'failed', email_error = ?, updated_at = ? WHERE id = ?`,
    ).run(message, message, nowIso(), cert.id);
    queueMirror('certificate', cert.id);
    throw err;
  }
}

async function queueDeliveryEmail(cert: CertificateRow): Promise<void> {
  const db = getDb();
  const existing = db
    .prepare(
      `SELECT id FROM emails WHERE certificate_id = ? AND template_key = 'certificate_delivery' AND status IN ('queued','sent','redirected') LIMIT 1`,
    )
    .get(cert.id) as { id: string } | undefined;
  if (existing) return;
  const emailId = await sendCertificateEmail(cert.id, 'certificate_delivery');
  db.prepare(`UPDATE certificates SET email_status = 'queued' WHERE id = ?`).run(cert.id);
  enqueueJob('send_email', { emailId });
}

export function retryCertificate(
  certificateRowId: string,
  mode: 'issue' | 'email' = 'issue',
): void {
  const db = getDb();
  const cert = db.prepare('SELECT * FROM certificates WHERE id = ?').get(certificateRowId) as
    | CertificateRow
    | undefined;
  if (!cert) throw new Error('Certificate not found.');
  if (mode === 'email') {
    db.prepare(
      `UPDATE certificates SET email_status = 'pending', email_error = NULL, updated_at = ? WHERE id = ?`,
    ).run(nowIso(), cert.id);
    enqueueJob('issue_certificate', { certificateRowId: cert.id });
    return;
  }
  db.prepare(
    `UPDATE certificates SET status = 'pending', error = NULL, updated_at = ? WHERE id = ?`,
  ).run(nowIso(), cert.id);
  enqueueJob('issue_certificate', { certificateRowId: cert.id });
}

/** Re-issues the PDF for an existing certificate ID (never creates a duplicate ID). */
export function regenerateCertificate(certificateRowId: string): void {
  const db = getDb();
  const cert = db.prepare('SELECT * FROM certificates WHERE id = ?').get(certificateRowId) as
    | CertificateRow
    | undefined;
  if (!cert) throw new Error('Certificate not found.');
  db.prepare(
    `UPDATE certificates SET status = 'pending', email_status = 'pending', error = NULL,
     drive_file_id = NULL, slide_file_id = NULL, updated_at = ? WHERE id = ?`,
  ).run(nowIso(), cert.id);
  enqueueJob('issue_certificate', { certificateRowId: cert.id });
}

export interface VerifyResult {
  valid: boolean;
  certificateId: string;
  status: string;
  participantName?: string;
  courseName?: string;
  quizTitle?: string;
  issuedAt?: string;
  organization?: string;
  message: string;
}

export function verifyCertificate(certificateId: string): VerifyResult {
  const db = getDb();
  const cert = db.prepare('SELECT * FROM certificates WHERE certificate_id = ?').get(certificateId) as
    | CertificateRow
    | undefined;
  const cfg = getWorkspaceConfig();
  if (!cert) {
    return {
      valid: false,
      certificateId,
      status: 'not_found',
      organization: cfg.organizationName,
      message: 'No certificate with this ID exists in the issuing registry.',
    };
  }
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(cert.quiz_id) as QuizRow;
  const participant = db
    .prepare('SELECT * FROM participants WHERE id = ?')
    .get(cert.participant_id) as ParticipantRow;
  const valid = cert.status === 'generated';
  return {
    valid,
    certificateId: cert.certificate_id,
    status: cert.status,
    participantName: participant?.name,
    courseName: quiz?.cert_course_name || quiz?.title,
    quizTitle: quiz?.title,
    issuedAt: cert.issued_at ?? undefined,
    organization: cfg.organizationName,
    message: valid
      ? 'This certificate was issued by the platform registry and is authentic.'
      : 'This certificate exists but has not completed issuance. Contact the quiz administrator.',
  };
}
