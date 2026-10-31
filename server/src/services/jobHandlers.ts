import { getDb } from '../db.js';
import type { CertificateRow, EmailRow } from '../domain.js';
import type { JobHandler, JobType } from './jobs.js';
import { processCertificateIssue } from './certificates.js';
import { processEmail } from './email.js';
import { syncAttemptToResults, syncCertificateToFormResponses } from './sheets.js';
import { enqueueJob } from './jobs.js';
import { nowIso } from '../lib/time.js';
import { syncMirror, type MirrorKind } from './firestoreMirror.js';

export const handleJob: JobHandler = async (type: JobType, payload: Record<string, unknown>) => {
  switch (type) {
    case 'issue_certificate': {
      const certificateRowId = String(payload.certificateRowId ?? '');
      if (!certificateRowId) throw new Error('issue_certificate job is missing certificateRowId.');
      await processCertificateIssue(certificateRowId);
      return;
    }
    case 'send_email': {
      const emailId = String(payload.emailId ?? '');
      if (!emailId) throw new Error('send_email job is missing emailId.');
      await processEmail(emailId);
      const db = getDb();
      const email = db.prepare('SELECT * FROM emails WHERE id = ?').get(emailId) as EmailRow;
      if (email?.certificate_id) {
        const cert = db.prepare('SELECT * FROM certificates WHERE id = ?').get(email.certificate_id) as
          | CertificateRow
          | undefined;
        if (cert) {
          const emailStatus = email.status === 'failed' ? 'failed' : email.status === 'sent' ? 'sent' : 'redirected';
          db.prepare(
            `UPDATE certificates SET email_status = ?, email_error = ?, updated_at = ? WHERE id = ?`,
          ).run(emailStatus, email.error, nowIso(), cert.id);
          enqueueJob('sheet_sync_certificate', { certificateRowId: cert.id });
          enqueueJob('sheet_sync_result', { attemptId: cert.attempt_id });
        }
      }
      return;
    }
    case 'sheet_sync_result': {
      await syncAttemptToResults(String(payload.attemptId ?? ''));
      return;
    }
    case 'sheet_sync_certificate': {
      await syncCertificateToFormResponses(String(payload.certificateRowId ?? ''));
      return;
    }
    case 'firestore_mirror': {
      const kind = String(payload.kind ?? '') as MirrorKind;
      const id = String(payload.id ?? '');
      if (!id) throw new Error('firestore_mirror job is missing id.');
      await syncMirror(kind, id);
      return;
    }
    default: {
      throw new Error(`Unknown job type: ${type}`);
    }
  }
};
