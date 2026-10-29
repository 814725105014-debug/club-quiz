/**
 * EMBEDX – Embedded Systems & Automation Club
 * Main Web App Routing, RPC Dispatch, and HTML Service Orchestrator
 * SRM TRP Engineering College, Tiruchirappalli
 */

function doGet(e) {
  const template = HtmlService.createTemplateFromFile('Index');

  // Inject server bootstrap context
  let currentUser = { email: '', domainAuthorized: false, role: 'student', isAdmin: false, isSuperAdmin: false };
  try {
    currentUser = getCurrentUser_();
  } catch (err) {
    currentUser.authError = err.message;
  }

  template.serverContext = {
    user: currentUser,
    event: {
      title: CONFIG.EVENT.TITLE,
      date: CONFIG.EVENT.DATE,
      venue: CONFIG.EVENT.VENUE,
      club: CONFIG.INSTITUTION.CLUB,
      college: CONFIG.INSTITUTION.NAME,
      domain: CONFIG.INSTITUTION.EMAIL_DOMAIN
    }
  };

  return template.evaluate()
    .setTitle('EMBEDX Platform | SRM TRP Engineering College')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  try {
    const postData = e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    const ss = getSpreadsheet();

    // 1. Compatibility handler for website forms
    if (postData.type === 'join' || postData.type === 'inquiry') {
      let sheet = ss.getSheetByName('WEBSITE_INQUIRIES');
      if (!sheet) {
        sheet = ss.insertSheet('WEBSITE_INQUIRIES');
        sheet.appendRow(['timestamp', 'type', 'full_name', 'email', 'phone', 'department', 'year', 'details']);
      }
      sheet.appendRow([
        new Date(),
        postData.type,
        postData.full_name || '',
        postData.email || '',
        postData.phone || '',
        postData.department || '',
        postData.year || '',
        JSON.stringify(postData)
      ]);
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: 'Inquiry Received' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 2. Direct Quiz Conduction & Proctoring Report Ingestion
    if (postData.quiz_id || postData.student_email) {
      let subSheet = ss.getSheetByName('SUBMISSIONS_LOG');
      if (!subSheet) {
        subSheet = ss.insertSheet('SUBMISSIONS_LOG');
        subSheet.appendRow([
          'timestamp',
          'student_id',
          'student_email',
          'student_name',
          'quiz_id',
          'score',
          'total_marks',
          'percentage',
          'passed',
          'violations_count',
          'proctoring_status',
          'proctoring_events'
        ]);
      }
      subSheet.appendRow([
        new Date(),
        postData.student_id || '',
        postData.student_email || '',
        postData.student_name || '',
        postData.quiz_id || '',
        postData.score !== undefined ? postData.score : '',
        postData.total !== undefined ? postData.total : '',
        postData.percentage !== undefined ? postData.percentage : '',
        postData.passed !== undefined ? postData.passed : '',
        postData.violations_count || 0,
        postData.proctoring_status || 'CLEAN',
        JSON.stringify(postData.proctoring_events || [])
      ]);
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: 'Submission & Proctoring Logged' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * File inclusion helper for modular HTML Service templates
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// =========================================================================
// RPC EXPORTS (Callable by google.script.run from client browser)
// =========================================================================

function rpcGetCurrentUser() {
  return getCurrentUser_();
}

function rpcGetStudentDashboard() {
  return getStudentDashboardData();
}

function rpcUpdateCertificateDisplayName(newName) {
  return updateCertificateDisplayName(newName);
}

function rpcGetQuizForStudent(quizId) {
  return getQuizForStudent(quizId);
}

function rpcSubmitQuizAttempt(payload) {
  return submitQuizAttempt(payload);
}

function rpcGetLeaderboard(limit) {
  return getLeaderboard(limit || 100);
}

function rpcGenerateCertificate() {
  return generateCertificateForStudent();
}

function rpcGetAdminMetrics() {
  return getAdminMetrics();
}

function rpcGetAdminSubmissions(filter) {
  return getAdminSubmissionsList(filter);
}

function rpcGetAdminQuestions(quizId) {
  return getAdminQuestions(quizId);
}

function rpcSaveAdminQuestion(q) {
  return saveAdminQuestion(q);
}

function rpcImportQuestionsFromCSV(csv, quizId) {
  return importQuestionsFromCSV(csv, quizId);
}

function rpcGetAdminUsersList() {
  return getAdminUsersList();
}

function rpcAssignAdminRole(email, role, name, dept) {
  return assignAdminRole(email, role, name, dept);
}

function rpcGetAuditLogs(limit) {
  return getAuditLogs(limit || 100);
}

function rpcInitDatabase() {
  requireAdmin_();
  return initDatabase();
}
