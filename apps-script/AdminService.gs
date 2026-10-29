/**
 * EMBEDX Admin Management & Live Results Service
 * Question Authoring, Bulk CSV Importer, Quiz Configuration, and Submission Monitoring
 */

function getAdminMetrics() {
  requireAdmin_();
  const ss = getSpreadsheet();

  // 1. Total Registered Users
  const usersSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.USERS);
  let totalUsers = 0;
  if (usersSheet && usersSheet.getLastRow() > 1) {
    totalUsers = usersSheet.getLastRow() - 1;
  }

  // 2. Attempts & Activity
  const attemptsSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ATTEMPTS);
  let totalAttempts = 0;
  let completedAttempts = 0;
  let totalScoreSum = 0;
  let passedAttempts = 0;
  const activeStudentIds = new Set();

  if (attemptsSheet && attemptsSheet.getLastRow() > 1) {
    const aData = attemptsSheet.getDataRange().getValues();
    const headers = aData[0].map(h => String(h).trim().toLowerCase());
    const sIdIdx = headers.indexOf('student_id');
    const statusIdx = headers.indexOf('status');
    const scoreIdx = headers.indexOf('score_obtained');
    const passIdx = headers.indexOf('passed');

    for (let i = 1; i < aData.length; i++) {
      totalAttempts++;
      activeStudentIds.add(aData[i][sIdIdx]);
      if (aData[i][statusIdx] === 'submitted') {
        completedAttempts++;
        totalScoreSum += Number(aData[i][scoreIdx]) || 0;
        const passed = (aData[i][passIdx] === true || String(aData[i][passIdx]).toLowerCase() === 'true');
        if (passed) passedAttempts++;
      }
    }
  }

  // 3. Phase Progress Stats
  const progressSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.PHASE_PROGRESS);
  let phase1CompletedCount = 0;
  let phase2CompletedCount = 0;

  if (progressSheet && progressSheet.getLastRow() > 1) {
    const pData = progressSheet.getDataRange().getValues();
    const headers = pData[0].map(h => String(h).trim().toLowerCase());
    const pIdIdx = headers.indexOf('phase_id');
    const compIdx = headers.indexOf('completed');

    for (let i = 1; i < pData.length; i++) {
      const isComp = (pData[i][compIdx] === true || String(pData[i][compIdx]).toLowerCase() === 'true');
      if (isComp) {
        if (pData[i][pIdIdx] === 'phase-1') phase1CompletedCount++;
        if (pData[i][pIdIdx] === 'phase-2') phase2CompletedCount++;
      }
    }
  }

  // 4. Certificates Issued
  const certsSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CERTIFICATES);
  let certificatesIssuedCount = 0;
  if (certsSheet && certsSheet.getLastRow() > 1) {
    const cData = certsSheet.getDataRange().getValues();
    const headers = cData[0].map(h => String(h).trim().toLowerCase());
    const statusIdx = headers.indexOf('status');

    for (let i = 1; i < cData.length; i++) {
      if (cData[i][statusIdx] === 'issued') {
        certificatesIssuedCount++;
      }
    }
  }

  const avgScore = completedAttempts > 0 ? (totalScoreSum / completedAttempts).toFixed(1) : 0;
  const passRate = completedAttempts > 0 ? Math.round((passedAttempts / completedAttempts) * 100) : 0;

  return {
    lastUpdated: Utilities.formatDate(new Date(), CONFIG.EVENT.TIMEZONE, 'dd MMM yyyy, HH:mm:ss'),
    totalRegisteredStudents: totalUsers,
    activeStudentsCount: activeStudentIds.size,
    totalAttempts: totalAttempts,
    completedAttempts: completedAttempts,
    averageScore: avgScore,
    passRate: passRate,
    phase1Completions: phase1CompletedCount,
    phase2Completions: phase2CompletedCount,
    certificatesIssued: certificatesIssuedCount
  };
}

/**
 * Returns full submissions list for admin live monitoring with filtering
 */
function getAdminSubmissionsList(filter = {}) {
  requireAdmin_();
  const ss = getSpreadsheet();
  const attemptsSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ATTEMPTS);
  const usersSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.USERS);

  const userMap = {};
  if (usersSheet && usersSheet.getLastRow() > 1) {
    const uData = usersSheet.getDataRange().getValues();
    const headers = uData[0].map(h => String(h).trim().toLowerCase());
    const idIdx = headers.indexOf('student_id');
    const emailIdx = headers.indexOf('email');
    const nameIdx = headers.indexOf('display_name');

    for (let i = 1; i < uData.length; i++) {
      userMap[uData[i][idIdx]] = {
        email: uData[i][emailIdx],
        name: uData[i][nameIdx]
      };
    }
  }

  const submissions = [];
  if (attemptsSheet && attemptsSheet.getLastRow() > 1) {
    const aData = attemptsSheet.getDataRange().getValues();
    const headers = aData[0].map(h => String(h).trim().toLowerCase());
    const idIdx = headers.indexOf('attempt_id');
    const qIdIdx = headers.indexOf('quiz_id');
    const sIdIdx = headers.indexOf('student_id');
    const startIdx = headers.indexOf('started_at');
    const subIdx = headers.indexOf('submitted_at');
    const statusIdx = headers.indexOf('status');
    const scoreIdx = headers.indexOf('score_obtained');
    const totIdx = headers.indexOf('total_possible');
    const pctIdx = headers.indexOf('percentage');
    const passIdx = headers.indexOf('passed');

    for (let i = aData.length - 1; i >= 1; i--) {
      const sId = aData[i][sIdIdx];
      const uInfo = userMap[sId] || { email: '', name: 'Student ' + sId };
      const subTime = aData[i][subIdx];

      submissions.push({
        attemptId: aData[i][idIdx],
        quizId: aData[i][qIdIdx],
        studentId: sId,
        studentName: uInfo.name,
        studentEmail: uInfo.email,
        status: aData[i][statusIdx],
        score: aData[i][scoreIdx],
        totalPossible: aData[i][totIdx],
        percentage: aData[i][pctIdx],
        passed: (aData[i][passIdx] === true || String(aData[i][passIdx]).toLowerCase() === 'true'),
        startedAt: aData[i][startIdx] instanceof Date ? Utilities.formatDate(aData[i][startIdx], CONFIG.EVENT.TIMEZONE, 'dd MMM, HH:mm:ss') : '-',
        submittedAt: subTime instanceof Date ? Utilities.formatDate(subTime, CONFIG.EVENT.TIMEZONE, 'dd MMM, HH:mm:ss') : '-'
      });
    }
  }

  return submissions;
}

/**
 * Returns full question list for admin quiz editor
 */
function getAdminQuestions(quizId) {
  requireAdmin_();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.QUESTIONS);
  const questions = [];

  if (sheet && sheet.getLastRow() > 1) {
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim().toLowerCase());
    const idIdx = headers.indexOf('question_id');
    const qIdIdx = headers.indexOf('quiz_id');
    const textIdx = headers.indexOf('question_text');
    const typeIdx = headers.indexOf('question_type');
    const opAIdx = headers.indexOf('option_a');
    const opBIdx = headers.indexOf('option_b');
    const opCIdx = headers.indexOf('option_c');
    const opDIdx = headers.indexOf('option_d');
    const corrIdx = headers.indexOf('correct_answer');
    const marksIdx = headers.indexOf('marks');
    const expIdx = headers.indexOf('explanation');
    const pubIdx = headers.indexOf('is_published');

    for (let i = 1; i < data.length; i++) {
      if (!quizId || data[i][qIdIdx] === quizId) {
        questions.push({
          id: data[i][idIdx],
          quizId: data[i][qIdIdx],
          text: data[i][textIdx],
          type: data[i][typeIdx],
          optionA: data[i][opAIdx],
          optionB: data[i][opBIdx],
          optionC: data[i][opCIdx],
          optionD: data[i][opDIdx],
          correctAnswer: data[i][corrIdx],
          marks: Number(data[i][marksIdx]) || 1,
          explanation: data[i][expIdx],
          isPublished: (data[i][pubIdx] === true || String(data[i][pubIdx]).toLowerCase() === 'true')
        });
      }
    }
  }
  return questions;
}

/**
 * Saves or updates a question
 */
function saveAdminQuestion(q) {
  const admin = requireAdmin_();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.QUESTIONS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim().toLowerCase());
  const idIdx = headers.indexOf('question_id');

  const questionId = q.id || ('Q-' + Utilities.getUuid().substring(0, 8).toUpperCase());
  let foundRow = -1;

  for (let i = 1; i < data.length; i++) {
    if (data[i][idIdx] === questionId) {
      foundRow = i + 1;
      break;
    }
  }

  const rowValues = [
    questionId,
    q.quizId || 'QUIZ-EMB-01',
    q.text,
    q.type || 'single_choice',
    q.optionA || '',
    q.optionB || '',
    q.optionC || '',
    q.optionD || '',
    String(q.correctAnswer || '').trim().toUpperCase(),
    Number(q.marks) || 1,
    q.explanation || '',
    q.isPublished !== undefined ? q.isPublished : true
  ];

  if (foundRow !== -1) {
    sheet.getRange(foundRow, 1, 1, rowValues.length).setValues([rowValues]);
    logAuditAction_(admin.email, 'UPDATE_QUESTION', 'QUESTION', questionId, 'Updated question in ' + q.quizId);
  } else {
    sheet.appendRow(rowValues);
    logAuditAction_(admin.email, 'CREATE_QUESTION', 'QUESTION', questionId, 'Created question in ' + q.quizId);
  }

  return { success: true, questionId: questionId };
}

/**
 * Bulk Question Importer with CSV validation
 * Suggested format: quizId,questionText,questionType,optionA,optionB,optionC,optionD,correctAnswer,marks,explanation
 */
function importQuestionsFromCSV(csvString, targetQuizId) {
  const admin = requireAdmin_();
  if (!csvString || String(csvString).trim().length === 0) {
    throw new Error('CSV content cannot be empty.');
  }

  const parsedRows = Utilities.parseCsv(csvString);
  if (parsedRows.length <= 1) {
    throw new Error('CSV must contain a header row and at least one data row.');
  }

  const headers = parsedRows[0].map(h => String(h).trim().toLowerCase());
  const textIdx = headers.indexOf('questiontext');
  const typeIdx = headers.indexOf('questiontype');
  const opAIdx = headers.indexOf('optiona');
  const opBIdx = headers.indexOf('optionb');
  const opCIdx = headers.indexOf('optionc');
  const opDIdx = headers.indexOf('optiond');
  const corrIdx = headers.indexOf('correctanswer');
  const marksIdx = headers.indexOf('marks');
  const expIdx = headers.indexOf('explanation');
  const qIdIdx = headers.indexOf('quizid');

  if (textIdx === -1 || corrIdx === -1) {
    throw new Error('Missing required headers: CSV must include at least "questionText" and "correctAnswer".');
  }

  const accepted = [];
  const rejected = [];

  for (let i = 1; i < parsedRows.length; i++) {
    const row = parsedRows[i];
    if (row.length === 0 || row.every(cell => !cell || String(cell).trim() === '')) {
      continue; // Skip empty row
    }

    const qText = String(row[textIdx] || '').trim();
    const corrAns = String(row[corrIdx] || '').trim().toUpperCase();
    const marks = Number(row[marksIdx]) || 1;
    const qType = (typeIdx !== -1 && row[typeIdx]) ? String(row[typeIdx]).trim() : 'single_choice';
    const quizId = (qIdIdx !== -1 && row[qIdIdx]) ? String(row[qIdIdx]).trim() : (targetQuizId || 'QUIZ-EMB-01');

    if (!qText) {
      rejected.push({ rowNumber: i + 1, error: 'Empty question text' });
      continue;
    }

    if (!corrAns) {
      rejected.push({ rowNumber: i + 1, error: 'Empty correct answer' });
      continue;
    }

    const opA = opAIdx !== -1 ? String(row[opAIdx] || '').trim() : '';
    const opB = opBIdx !== -1 ? String(row[opBIdx] || '').trim() : '';
    const opC = opCIdx !== -1 ? String(row[opCIdx] || '').trim() : '';
    const opD = opDIdx !== -1 ? String(row[opDIdx] || '').trim() : '';
    const explanation = expIdx !== -1 ? String(row[expIdx] || '').trim() : '';

    const qId = 'Q-CSV-' + Utilities.getUuid().substring(0, 6).toUpperCase();

    accepted.push([
      qId,
      quizId,
      qText,
      qType,
      opA,
      opB,
      opC,
      opD,
      corrAns,
      marks,
      explanation,
      true // Published
    ]);
  }

  if (accepted.length > 0) {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.QUESTIONS);
    sheet.getRange(sheet.getLastRow() + 1, 1, accepted.length, 12).setValues(accepted);
    logAuditAction_(admin.email, 'BULK_IMPORT_QUESTIONS', 'QUIZ', targetQuizId || 'VARIOUS', 'Imported ' + accepted.length + ' questions via CSV');
  }

  return {
    success: true,
    acceptedCount: accepted.length,
    rejectedCount: rejected.length,
    rejectedDetails: rejected
  };
}
