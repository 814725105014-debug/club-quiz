/**
 * EMBEDX Session Management Service
 * Provides Session Lifecycle, Reordering, and Association with Phases & Quizzes
 */

function getAllSessions() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.SESSIONS);
  const sessions = [];

  if (sheet && sheet.getLastRow() > 1) {
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim().toLowerCase());
    const idIdx = headers.indexOf('session_id');
    const orderIdx = headers.indexOf('session_order');
    const titleIdx = headers.indexOf('title');
    const descIdx = headers.indexOf('description');
    const outIdx = headers.indexOf('learning_outcomes');
    const phaseIdx = headers.indexOf('phase_id');
    const pubIdx = headers.indexOf('is_published');
    const createdIdx = headers.indexOf('created_at');

    for (let i = 1; i < data.length; i++) {
      sessions.push({
        id: data[i][idIdx],
        order: Number(data[i][orderIdx]) || 1,
        title: data[i][titleIdx],
        description: data[i][descIdx],
        learningOutcomes: data[i][outIdx],
        phaseId: data[i][phaseIdx],
        isPublished: (data[i][pubIdx] === true || String(data[i][pubIdx]).toLowerCase() === 'true'),
        createdAt: data[i][createdIdx]
      });
    }
    sessions.sort((a, b) => a.order - b.order);
  }

  return sessions;
}

function saveSession(sessionData) {
  const admin = requireAdmin_();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.SESSIONS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim().toLowerCase());
  const idIdx = headers.indexOf('session_id');
  const orderIdx = headers.indexOf('session_order');
  const titleIdx = headers.indexOf('title');
  const descIdx = headers.indexOf('description');
  const outIdx = headers.indexOf('learning_outcomes');
  const phaseIdx = headers.indexOf('phase_id');
  const pubIdx = headers.indexOf('is_published');

  const sessionId = sessionData.id || ('session-' + Utilities.getUuid().substring(0, 8));
  let existingRow = -1;

  for (let i = 1; i < data.length; i++) {
    if (data[i][idIdx] === sessionId) {
      existingRow = i + 1;
      break;
    }
  }

  const isPublished = sessionData.isPublished !== undefined ? sessionData.isPublished : true;
  const order = Number(sessionData.order) || 1;

  if (existingRow !== -1) {
    sheet.getRange(existingRow, orderIdx + 1).setValue(order);
    sheet.getRange(existingRow, titleIdx + 1).setValue(sessionData.title);
    sheet.getRange(existingRow, descIdx + 1).setValue(sessionData.description || '');
    sheet.getRange(existingRow, outIdx + 1).setValue(sessionData.learningOutcomes || '');
    sheet.getRange(existingRow, phaseIdx + 1).setValue(sessionData.phaseId || 'phase-1');
    sheet.getRange(existingRow, pubIdx + 1).setValue(isPublished);
    logAuditAction_(admin.email, 'UPDATE_SESSION', 'SESSION', sessionId, 'Updated session: ' + sessionData.title);
  } else {
    sheet.appendRow([
      sessionId,
      order,
      sessionData.title,
      sessionData.description || '',
      sessionData.learningOutcomes || '',
      sessionData.phaseId || 'phase-1',
      isPublished,
      new Date()
    ]);
    logAuditAction_(admin.email, 'CREATE_SESSION', 'SESSION', sessionId, 'Created session: ' + sessionData.title);
  }

  return { success: true, sessionId: sessionId };
}

function toggleSessionPublish(sessionId, isPublished) {
  const admin = requireAdmin_();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.SESSIONS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim().toLowerCase());
  const idIdx = headers.indexOf('session_id');
  const pubIdx = headers.indexOf('is_published');

  for (let i = 1; i < data.length; i++) {
    if (data[i][idIdx] === sessionId) {
      sheet.getRange(i + 1, pubIdx + 1).setValue(isPublished);
      logAuditAction_(admin.email, 'TOGGLE_SESSION_PUBLISH', 'SESSION', sessionId, 'Set is_published to ' + isPublished);
      return { success: true };
    }
  }
  throw new Error('Session not found: ' + sessionId);
}
