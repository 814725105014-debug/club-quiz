/**
 * EMBEDX Notification Engine & Safe Email Dispatcher
 * Prevents Accidental Mass Emails, Enforces Dry-Run Safety, and Manages Retries
 */

/**
 * Queues a notification and dispatches if enabled
 */
function queueNotification_(eventType, recipientEmail, studentId, relatedId, templateVars) {
  const ss = getSpreadsheet();
  const logSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.EMAIL_LOG);
  const now = new Date();
  const logId = 'EML-' + Utilities.getUuid().substring(0, 8).toUpperCase();

  // 1. Idempotency Check: Prevent duplicate email events
  if (logSheet && logSheet.getLastRow() > 1) {
    const data = logSheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim().toLowerCase());
    const eventIdx = headers.indexOf('event_type');
    const recIdx = headers.indexOf('recipient_email');
    const relIdx = headers.indexOf('related_id');
    const statIdx = headers.indexOf('status');

    for (let i = 1; i < data.length; i++) {
      if (data[i][eventIdx] === eventType && data[i][recIdx] === recipientEmail && data[i][relIdx] === relatedId) {
        if (['sent', 'dry_run_simulated'].includes(data[i][statIdx])) {
          console.log('Skipping duplicate notification for: ' + recipientEmail + ' (' + eventType + ')');
          return { skipped: true, reason: 'DUPLICATE_EVENT' };
        }
      }
    }
  }

  // 2. Check DRY_RUN_MODE setting
  const dryRunSetting = getAppProperty('DRY_RUN_MODE', 'true');
  const isDryRun = (dryRunSetting === 'true' || dryRunSetting === true);

  if (isDryRun) {
    logSheet.appendRow([
      logId,
      eventType,
      recipientEmail,
      studentId,
      relatedId,
      'dry_run_simulated',
      'Dry run mode enabled. No external email dispatched.',
      now,
      0
    ]);
    return { success: true, dryRun: true, logId: logId };
  }

  // 3. Dispatch Live Email via MailApp
  try {
    const quota = MailApp.getRemainingDailyQuota();
    if (quota <= 5) {
      throw new Error('Daily email quota low (' + quota + ' remaining). Send suspended.');
    }

    const emailContent = renderEmailTemplate_(eventType, templateVars);
    MailApp.sendEmail({
      to: recipientEmail,
      subject: emailContent.subject,
      htmlBody: emailContent.htmlBody,
      name: 'EMBEDX – SRM TRP Engineering College'
    });

    logSheet.appendRow([
      logId,
      eventType,
      recipientEmail,
      studentId,
      relatedId,
      'sent',
      '',
      now,
      1
    ]);

    return { success: true, dryRun: false, logId: logId };
  } catch (err) {
    console.error('Mail dispatch failed: ' + err.message);
    logSheet.appendRow([
      logId,
      eventType,
      recipientEmail,
      studentId,
      relatedId,
      'failed',
      err.message,
      now,
      1
    ]);
    return { success: false, error: err.message };
  }
}

/**
 * Builds branded responsive HTML email templates matching EMBEDX theme
 */
function renderEmailTemplate_(eventType, vars) {
  const brandHeader = `
    <div style="background-color: #071C4B; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
      <h2 style="color: #FFFFFF; margin: 0; font-family: sans-serif; letter-spacing: 1px;">EMBED<span style="color: #146B3A;">X</span></h2>
      <p style="color: #00D2FF; margin: 4px 0 0 0; font-size: 13px; font-family: sans-serif;">SRM TRP Engineering College &bull; EEE Department</p>
    </div>
  `;

  const brandFooter = `
    <div style="background-color: #F5F8FC; padding: 18px; text-align: center; font-size: 12px; color: #617086; font-family: sans-serif; border-radius: 0 0 8px 8px; border-top: 1px solid #EDF3FA;">
      <p style="margin: 0;">Workshop: Basics of Embedded Systems and Embedded Programming Language</p>
      <p style="margin: 4px 0 0 0;">30 October 2026 &bull; 5th Floor, CSE Seminar Hall</p>
    </div>
  `;

  let subject = 'EMBEDX Workshop Update';
  let bodyContent = '';

  switch (eventType) {
    case 'QUIZ_COMPLETION':
      subject = '[EMBEDX] Quiz Attempt Scored: ' + (vars.quizTitle || 'Embedded Systems Assessment');
      bodyContent = `
        <h3 style="color: #0B2A6F; margin-top: 0;">Quiz Results</h3>
        <p>Your attempt for <strong>${vars.quizTitle || 'Assessment'}</strong> has been evaluated.</p>
        <div style="background: #F5F8FC; padding: 16px; border-radius: 6px; margin: 16px 0; border-left: 4px solid #146B3A;">
          <p style="margin: 0 0 8px 0;"><strong>Score:</strong> ${vars.score} / ${vars.totalPossible} (${vars.percentage}%)</p>
          <p style="margin: 0;"><strong>Status:</strong> ${vars.passed ? '<span style="color:#146B3A; font-weight:bold;">PASSED</span>' : '<span style="color:#D32F2F; font-weight:bold;">ATTEMPT LOGGED</span>'}</p>
        </div>
        <p>Check the live leaderboard and your Phase progress in the EMBEDX Quiz Portal.</p>
      `;
      break;

    case 'PHASE_1_COMPLETION':
      subject = '[EMBEDX] Congratulations! You Completed Phase 1 (Foundations)';
      bodyContent = `
        <h3 style="color: #0B2A6F; margin-top: 0;">Phase 1 Milestone Achieved!</h3>
        <p>Dear ${vars.studentName || 'Student'},</p>
        <p>You have successfully passed the foundational assessments covering Embedded System Architectures, Microcontrollers, and Component Interfacing.</p>
        <p><strong>Phase 2 is now unlocked on your dashboard.</strong> Proceed to the hands-on Embedded C and protocol modules.</p>
      `;
      break;

    case 'PHASE_2_COMPLETION':
      subject = '[EMBEDX] Outstanding! Phase 2 Completed — Certificate Eligible';
      bodyContent = `
        <h3 style="color: #0B2A6F; margin-top: 0;">Phase 2 Mastery Achieved!</h3>
        <p>Dear ${vars.studentName || 'Student'},</p>
        <p>You have satisfied all requirements for <strong>Phase 2: Embedded C, Device Interfacing & Firmware Engineering</strong>.</p>
        <p>Your official Certificate of Completion is now eligible for generation and download via your dashboard.</p>
      `;
      break;

    case 'CERTIFICATE_ISSUED':
      subject = '[EMBEDX] Official Certificate of Completion — EMBEDX 2026';
      bodyContent = `
        <h3 style="color: #0B2A6F; margin-top: 0;">Certificate of Completion Issued</h3>
        <p>Dear ${vars.studentName || 'Contender'},</p>
        <p>Congratulations! Your verified Certificate of Completion for the <strong>Basics of Embedded Systems and Embedded Programming Language</strong> workshop is now ready.</p>
        <div style="background: #F5F8FC; padding: 16px; border-radius: 6px; margin: 16px 0;">
          <p style="margin: 0 0 6px 0;"><strong>Certificate ID:</strong> ${vars.certificateId}</p>
          <p style="margin: 0 0 12px 0;"><strong>Issue Date:</strong> 30 October 2026</p>
          <a href="${vars.pdfUrl}" target="_blank" style="display: inline-block; background-color: #146B3A; color: #FFFFFF; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">View Certificate PDF</a>
        </div>
      `;
      break;

    default:
      bodyContent = '<p>' + JSON.stringify(vars) + '</p>';
  }

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden; background: #FFFFFF;">
      ${brandHeader}
      <div style="padding: 24px; color: #152238; line-height: 1.6;">
        ${bodyContent}
      </div>
      ${brandFooter}
    </div>
  `;

  return {
    subject: subject,
    htmlBody: htmlBody
  };
}
