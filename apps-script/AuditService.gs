/**
 * EMBEDX Administrative Audit Trail Service
 * Records Immutable Audit Logs for Role Assignments, Quiz Mutations, and Certificates
 */

function logAuditAction_(actorEmail, actionType, targetEntity, targetId, details) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.AUDIT_LOG);
    if (!sheet) return;

    const logId = 'AUD-' + Utilities.getUuid().substring(0, 8).toUpperCase();
    const now = new Date();

    sheet.appendRow([
      logId,
      actorEmail || 'SYSTEM',
      actionType,
      targetEntity,
      targetId,
      details,
      now
    ]);
  } catch (e) {
    console.warn('Audit log write error: ' + e.message);
  }
}

function getAuditLogs(limit = 100) {
  requireAdmin_();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.AUDIT_LOG);
  const logs = [];

  if (sheet && sheet.getLastRow() > 1) {
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim().toLowerCase());
    const idIdx = headers.indexOf('log_id');
    const actorIdx = headers.indexOf('actor_email');
    const actionIdx = headers.indexOf('action_type');
    const entityIdx = headers.indexOf('target_entity');
    const targetIdx = headers.indexOf('target_id');
    const detailsIdx = headers.indexOf('details');
    const timeIdx = headers.indexOf('timestamp');

    for (let i = data.length - 1; i >= 1 && logs.length < limit; i--) {
      const ts = data[i][timeIdx];
      logs.push({
        id: data[i][idIdx],
        actor: data[i][actorIdx],
        action: data[i][actionIdx],
        entity: data[i][entityIdx],
        targetId: data[i][targetIdx],
        details: data[i][detailsIdx],
        timestamp: ts instanceof Date ? Utilities.formatDate(ts, CONFIG.EVENT.TIMEZONE, 'dd MMM yyyy, HH:mm:ss') : String(ts)
      });
    }
  }

  return logs;
}
