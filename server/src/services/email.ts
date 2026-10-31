import fs from 'node:fs';
import path from 'node:path';
import { env } from '../env.js';
import { getDb, getSetting } from '../db.js';
import { newId } from '../lib/ids.js';
import { formatDate, nowIso } from '../lib/time.js';
import type { AttemptRow, CertificateRow, EmailRow, ParticipantRow, QuizRow } from '../domain.js';
import { getWorkspaceConfig } from './config.js';
import { certificateFileName, getProvider } from './google.js';

export type TemplateKey =
  | 'certificate_delivery'
  | 'submission_confirmation'
  | 'certificate_regenerated'
  | 'test';

export interface TemplateVars {
  [key: string]: string;
}

export const DEFAULT_TEMPLATES: Record<
  Exclude<TemplateKey, 'test'>,
  { subject: string; body: string }
> = {
  certificate_delivery: {
    subject: 'Your certificate for {{QUIZ_TITLE}}',
    body: `<p>Dear {{PARTICIPANT_NAME}},</p>
<p>Congratulations! Your participation in <strong>{{QUIZ_TITLE}}</strong> has been evaluated and your certificate of completion is attached to this email.</p>
{{SCORE_BLOCK}}
<p><strong>Certificate ID:</strong> {{CERTIFICATE_ID}}<br/>
<strong>Issued on:</strong> {{ISSUE_DATE}}</p>
<p>You can verify the authenticity of this certificate at any time: <a href="{{VERIFY_URL}}">{{VERIFY_URL}}</a></p>
<p>We wish you continued success in your learning journey.</p>
<p>Warm regards,<br/>{{ORGANIZATION}}<br/>{{DEPARTMENT}}</p>`,
  },
  submission_confirmation: {
    subject: 'Submission received — {{QUIZ_TITLE}}',
    body: `<p>Dear {{PARTICIPANT_NAME}},</p>
<p>Your responses for <strong>{{QUIZ_TITLE}}</strong> were received on {{SUBMITTED_AT}}.</p>
{{SCORE_BLOCK}}
<p>{{CERTIFICATE_NOTE}}</p>
<p>Warm regards,<br/>{{ORGANIZATION}}</p>`,
  },
  certificate_regenerated: {
    subject: 'Your re-issued certificate for {{QUIZ_TITLE}}',
    body: `<p>Dear {{PARTICIPANT_NAME}},</p>
<p>Your certificate for <strong>{{QUIZ_TITLE}}</strong> has been regenerated and is attached.</p>
<p><strong>Certificate ID:</strong> {{CERTIFICATE_ID}}<br/>
<strong>Issued on:</strong> {{ISSUE_DATE}}</p>
<p>Verify at: <a href="{{VERIFY_URL}}">{{VERIFY_URL}}</a></p>
<p>Warm regards,<br/>{{ORGANIZATION}}</p>`,
  },
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (_m, key: string) => vars[key] ?? '');
}

export function getTemplate(key: Exclude<TemplateKey, 'test'>): { subject: string; body: string } {
  const stored = getSetting(`email_template.${key}`);
  if (stored) {
    try {
      return JSON.parse(stored) as { subject: string; body: string };
    } catch {
      /* fall through to defaults */
    }
  }
  return DEFAULT_TEMPLATES[key];
}

export function wrapEmailHtml(inner: string, opts: { title: string; banner?: string }): string {
  const cfg = getWorkspaceConfig();
  return `<!doctype html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(opts.title)}</title></head>
<body style="margin:0;padding:0;background:#f3f1f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#241631;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f1f7;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e4dced;">
<tr><td style="background:#2B0B3F;padding:22px 28px;color:#ffffff;">
<div style="font-size:12px;letter-spacing:2px;color:#D4AF37;text-transform:uppercase;">${escapeHtml(cfg.organizationName)}</div>
<div style="font-size:13px;color:#cbb6dd;margin-top:6px;">${escapeHtml(cfg.department)}</div>
</td></tr>
${opts.banner ? `<tr><td style="background:#fff4d6;color:#7a5300;padding:10px 28px;font-size:12px;border-bottom:1px solid #f0dfae;">${opts.banner}</td></tr>` : ''}
<tr><td style="padding:28px;font-size:15px;line-height:1.65;color:#31233f;">${inner}</td></tr>
<tr><td style="padding:18px 28px;background:#faf8fc;color:#7c6d8a;font-size:11px;line-height:1.6;border-top:1px solid #eee7f3;">
${escapeHtml(cfg.organizationName)}<br/>${escapeHtml(cfg.institutionLine)}<br/>
This is an automated message from the QUIZ PLATFORM examination system.
</td></tr>
</table></td></tr></table></body></html>`;
}

export interface QueueEmailInput {
  templateKey: TemplateKey;
  to: string;
  subject: string;
  html: string;
  attemptId?: string | null;
  participantId?: string | null;
  certificateId?: string | null;
}

export function queueEmail(input: QueueEmailInput): string {
  const id = newId('eml');
  getDb()
    .prepare(
      `INSERT INTO emails (id, template_key, to_email, actual_recipient, subject, body_html, attempt_id, participant_id, certificate_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued')`,
    )
    .run(
      id,
      input.templateKey,
      input.to,
      input.to,
      input.subject,
      input.html,
      input.attemptId ?? null,
      input.participantId ?? null,
      input.certificateId ?? null,
    );
  return id;
}

export function buildScoreBlock(
  attempt: AttemptRow,
  quiz: QuizRow,
  includeScore: boolean,
): string {
  if (!includeScore) {
    return '<p>Results will be published by the quiz host according to the result visibility settings for this quiz.</p>';
  }
  if (quiz.result_visibility === 'pass_only') {
    return `<p><strong>Result:</strong> ${attempt.passed ? 'PASSED' : 'COMPLETED'}</p>`;
  }
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #eadff2;border-radius:10px;overflow:hidden;">
<tr><td style="background:#faf7fd;padding:12px 16px;font-size:13px;color:#5b4a6b;">Score</td><td style="padding:12px 16px;font-weight:700;">${attempt.score} / ${attempt.total_marks}</td></tr>
<tr><td style="background:#faf7fd;padding:12px 16px;font-size:13px;color:#5b4a6b;">Percentage</td><td style="padding:12px 16px;font-weight:700;">${attempt.percentage.toFixed(2)}%</td></tr>
<tr><td style="background:#faf7fd;padding:12px 16px;font-size:13px;color:#5b4a6b;">Result</td><td style="padding:12px 16px;font-weight:700;color:${attempt.passed ? '#1c7a4a' : '#a33b3b'};">${attempt.passed ? 'PASSED' : 'NOT PASSED'}</td></tr>
</table>`;
}

export function includeScoreInEmail(quiz: QuizRow): boolean {
  return quiz.result_visibility === 'immediate' || quiz.result_visibility === 'pass_only';
}

export async function sendCertificateEmail(certId: string, templateKey: TemplateKey): Promise<string> {
  const db = getDb();
  const cert = db.prepare('SELECT * FROM certificates WHERE id = ?').get(certId) as CertificateRow;
  const attempt = db.prepare('SELECT * FROM attempts WHERE id = ?').get(cert.attempt_id) as AttemptRow;
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(cert.quiz_id) as QuizRow;
  const participant = db
    .prepare('SELECT * FROM participants WHERE id = ?')
    .get(cert.participant_id) as ParticipantRow;
  const cfg = getWorkspaceConfig();

  const defaults = getTemplate(templateKey === 'test' ? 'certificate_delivery' : templateKey);
  const subjectTemplate = quiz.email_subject || defaults.subject;
  const bodyTemplate = quiz.email_body || defaults.body;
  const verifyUrl = `${cfg.appBaseUrl}/verify/${encodeURIComponent(cert.certificate_id)}`;

  const vars: TemplateVars = {
    PARTICIPANT_NAME: escapeHtml(participant.name),
    EMAIL: escapeHtml(participant.email),
    REGISTRATION_NUMBER: escapeHtml(participant.reg_number ?? ''),
    DEPARTMENT: escapeHtml(participant.department ?? ''),
    QUIZ_TITLE: escapeHtml(quiz.title),
    COURSE_NAME: escapeHtml(quiz.cert_course_name || quiz.title),
    SCORE: String(attempt.score),
    TOTAL_MARKS: String(attempt.total_marks),
    PERCENTAGE: attempt.percentage.toFixed(2),
    RESULT: attempt.passed ? 'PASSED' : 'NOT PASSED',
    CERTIFICATE_ID: escapeHtml(cert.certificate_id),
    CERTIFICATE_URL: cert.pdf_url ?? '',
    VERIFY_URL: verifyUrl,
    ISSUE_DATE: formatDate(cert.issued_at ?? nowIso()),
    SUBMITTED_AT: formatDate(attempt.submitted_at ?? nowIso()),
    ORGANIZATION: escapeHtml(cfg.organizationName),
    SCORE_BLOCK: buildScoreBlock(attempt, quiz, includeScoreInEmail(quiz)),
    CERTIFICATE_NOTE: cert.status === 'generated'
      ? 'Your certificate is being delivered in a separate email.'
      : 'Your certificate will follow if you are eligible for one.',
  };

  const html = wrapEmailHtml(renderTemplate(bodyTemplate, vars), {
    title: renderTemplate(subjectTemplate, vars),
    banner: cfg.emailTestMode
      ? `<strong>TEST MODE:</strong> this message was redirected to ${escapeHtml(cfg.emailRedirectTo)} instead of the participant.`
      : undefined,
  });

  const emailId = queueEmail({
    templateKey,
    to: participant.email,
    subject: renderTemplate(subjectTemplate, vars),
    html,
    attemptId: attempt.id,
    participantId: participant.id,
    certificateId: cert.id,
  });
  return emailId;
}

export async function queueSubmissionConfirmation(attemptId: string): Promise<string | null> {
  const db = getDb();
  const attempt = db.prepare('SELECT * FROM attempts WHERE id = ?').get(attemptId) as AttemptRow | undefined;
  if (!attempt) return null;
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(attempt.quiz_id) as QuizRow;
  const participant = db
    .prepare('SELECT * FROM participants WHERE id = ?')
    .get(attempt.participant_id) as ParticipantRow;
  const cfg = getWorkspaceConfig();
  const settings = getSetting('email_submission_confirmation_enabled', 'true') === 'true';
  if (!settings) return null;

  const tpl = getTemplate('submission_confirmation');
  const cert = db
    .prepare('SELECT * FROM certificates WHERE attempt_id = ?')
    .get(attempt.id) as CertificateRow | undefined;
  const vars: TemplateVars = {
    PARTICIPANT_NAME: escapeHtml(participant.name),
    QUIZ_TITLE: escapeHtml(quiz.title),
    SUBMITTED_AT: formatDate(attempt.submitted_at ?? nowIso()),
    SCORE_BLOCK: buildScoreBlock(attempt, quiz, includeScoreInEmail(quiz)),
    CERTIFICATE_NOTE: cert
      ? 'Your certificate is being prepared and will be emailed to you once it is ready.'
      : quiz.certificate_rule === 'none'
        ? 'No certificate is configured for this quiz.'
        : 'You will receive a certificate by email if you meet the eligibility criteria.',
    ORGANIZATION: escapeHtml(cfg.organizationName),
  };
  const html = wrapEmailHtml(renderTemplate(tpl.body, vars), {
    title: renderTemplate(tpl.subject, vars),
    banner: cfg.emailTestMode
      ? `<strong>TEST MODE:</strong> redirected to ${escapeHtml(cfg.emailRedirectTo)}.`
      : undefined,
  });
  return queueEmail({
    templateKey: 'submission_confirmation',
    to: participant.email,
    subject: renderTemplate(tpl.subject, vars),
    html,
    attemptId: attempt.id,
    participantId: participant.id,
  });
}

export async function processEmail(emailId: string): Promise<void> {
  const db = getDb();
  const email = db.prepare('SELECT * FROM emails WHERE id = ?').get(emailId) as EmailRow | undefined;
  if (!email) throw new Error('Email record not found.');
  if (email.status === 'sent' || email.status === 'redirected') return; // idempotent

  const cfg = getWorkspaceConfig();
  const provider = getProvider(cfg);
  const dbAttempt = email.attempt_count + 1;
  db.prepare('UPDATE emails SET attempt_count = ? WHERE id = ?').run(dbAttempt, emailId);

  const recipient = cfg.emailTestMode ? cfg.emailRedirectTo || cfg.emailFrom : email.to_email;
  let attachment: { filename: string; driveFileId?: string; localPath?: string } | undefined;
  if (email.certificate_id) {
    const cert = db.prepare('SELECT * FROM certificates WHERE id = ?').get(email.certificate_id) as
      | CertificateRow
      | undefined;
    if (cert) {
      const localPath = path.join(env.certDir, certificateFileName(cert.certificate_id));
      attachment = {
        filename: `${email.certificate_id ? cert.certificate_id.replace(/[^A-Za-z0-9]+/g, '-') : 'certificate'} - Certificate of Completion.pdf`,
        localPath: fs.existsSync(localPath) ? localPath : undefined,
        driveFileId: cert.drive_file_id && !cert.drive_file_id.startsWith('mock-') ? cert.drive_file_id : undefined,
      };
    }
  }

  try {
    const result = await provider.sendEmail(
      { to: recipient, subject: email.subject, html: email.body_html, attachment },
      cfg,
    );
    db.prepare(
      `UPDATE emails SET status = ?, actual_recipient = ?, provider_message_id = ?, sent_at = ?, error = NULL WHERE id = ?`,
    ).run(cfg.emailTestMode ? 'redirected' : 'sent', recipient, result.messageId, nowIso(), emailId);
  } catch (err) {
    const message = (err as Error).message.slice(0, 1500);
    db.prepare(`UPDATE emails SET status = 'failed', error = ? WHERE id = ?`).run(message, emailId);
    throw err;
  }
}
