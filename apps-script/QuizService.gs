/**
 * EMBEDX Quiz Engine & Server-Side Scoring Service
 * Guarantees Zero Client Answer Leaks, Concurrency Protection, and Accurate Grading
 */

/**
 * Retrieves a quiz for the student and initiates an attempt
 * CRITICAL SECURITY: Never returns correct answers to the client!
 */
function getQuizForStudent(quizId) {
  const user = requireAuthenticatedUser_();
  const profile = getOrCreateStudentProfile_(user);
  const ss = getSpreadsheet();

  // 1. Fetch Quiz definition
  const quizzesSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.QUIZZES);
  const qData = quizzesSheet.getDataRange().getValues();
  const qHeaders = qData[0].map(h => String(h).trim().toLowerCase());
  const qIdIdx = qHeaders.indexOf('quiz_id');
  const sIdIdx = qHeaders.indexOf('session_id');
  const pIdIdx = qHeaders.indexOf('phase_id');
  const titleIdx = qHeaders.indexOf('title');
  const instIdx = qHeaders.indexOf('instructions');
  const durIdx = qHeaders.indexOf('duration_minutes');
  const totalMarksIdx = qHeaders.indexOf('total_marks');
  const passPctIdx = qHeaders.indexOf('pass_percentage');
  const limitIdx = qHeaders.indexOf('attempt_limit');
  const pubIdx = qHeaders.indexOf('is_published');
  const randIdx = qHeaders.indexOf('is_randomized');

  let quizRow = null;
  for (let i = 1; i < qData.length; i++) {
    if (qData[i][qIdIdx] === quizId) {
      quizRow = qData[i];
      break;
    }
  }

  if (!quizRow) {
    throw new Error('Quiz not found: ' + quizId);
  }

  const isPub = (quizRow[pubIdx] === true || String(quizRow[pubIdx]).toLowerCase() === 'true');
  if (!isPub && !user.isAdmin) {
    throw new Error('This quiz is not currently published.');
  }

  const phaseId = quizRow[pIdIdx];
  const attemptLimit = Number(quizRow[limitIdx]) || 1;
  const durationMinutes = Number(quizRow[durIdx]) || 15;

  // 2. Check Phase 2 prerequisite (Phase 1 must be completed)
  if (phaseId === 'phase-2' && !user.isAdmin) {
    const dashData = getStudentDashboardData();
    if (!dashData.phaseProgress.phase1.completed) {
      throw new Error('PREREQUISITE_LOCKED: You must complete and pass all required Phase 1 quizzes before attempting Phase 2 quizzes.');
    }
  }

  // 3. Check attempt limit from ATTEMPTS sheet
  const attemptsSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ATTEMPTS);
  let attemptsCount = 0;
  if (attemptsSheet.getLastRow() > 1) {
    const aData = attemptsSheet.getDataRange().getValues();
    const aHeaders = aData[0].map(h => String(h).trim().toLowerCase());
    const aSIdIdx = aHeaders.indexOf('student_id');
    const aQIdIdx = aHeaders.indexOf('quiz_id');
    const aStatusIdx = aHeaders.indexOf('status');

    for (let i = 1; i < aData.length; i++) {
      if (aData[i][aSIdIdx] === profile.id && aData[i][aQIdIdx] === quizId && aData[i][aStatusIdx] === 'submitted') {
        attemptsCount++;
      }
    }
  }

  if (attemptsCount >= attemptLimit && !user.isAdmin) {
    throw new Error('ATTEMPTS_EXHAUSTED: You have already used all permitted attempts (' + attemptsCount + '/' + attemptLimit + ') for this quiz.');
  }

  // 4. Fetch Published Questions (WITHOUT correct answers!)
  const questionsSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.QUESTIONS);
  const questions = [];
  if (questionsSheet.getLastRow() > 1) {
    const quData = questionsSheet.getDataRange().getValues();
    const quHeaders = quData[0].map(h => String(h).trim().toLowerCase());
    const quIdIdx = quHeaders.indexOf('question_id');
    const quQIdIdx = quHeaders.indexOf('quiz_id');
    const textIdx = quHeaders.indexOf('question_text');
    const typeIdx = quHeaders.indexOf('question_type');
    const opAIdx = quHeaders.indexOf('option_a');
    const opBIdx = quHeaders.indexOf('option_b');
    const opCIdx = quHeaders.indexOf('option_c');
    const opDIdx = quHeaders.indexOf('option_d');
    const marksIdx = quHeaders.indexOf('marks');
    const quPubIdx = quHeaders.indexOf('is_published');

    for (let i = 1; i < quData.length; i++) {
      const qPublished = (quData[i][quPubIdx] === true || String(quData[i][quPubIdx]).toLowerCase() === 'true');
      if (quData[i][quQIdIdx] === quizId && qPublished) {
        questions.push({
          id: quData[i][quIdIdx],
          text: quData[i][textIdx],
          type: quData[i][typeIdx] || 'single_choice',
          options: [
            { key: 'A', text: quData[i][opAIdx] },
            { key: 'B', text: quData[i][opBIdx] },
            { key: 'C', text: quData[i][opCIdx] },
            { key: 'D', text: quData[i][opDIdx] }
          ].filter(o => o.text !== '' && o.text !== null && o.text !== undefined),
          marks: Number(quData[i][marksIdx]) || 1
        });
      }
    }
  }

  if (questions.length === 0) {
    throw new Error('No published questions found in this quiz.');
  }

  // Randomize question sequence if configured
  const isRandomized = (quizRow[randIdx] === true || String(quizRow[randIdx]).toLowerCase() === 'true');
  if (isRandomized) {
    questions.sort(() => Math.random() - 0.5);
  }

  // 5. Create attempt record with server deadline
  const attemptId = 'ATT-' + Utilities.getUuid().substring(0, 10).toUpperCase();
  const startedAt = new Date();
  const deadlineAt = new Date(startedAt.getTime() + (durationMinutes * 60 * 1000));

  attemptsSheet.appendRow([
    attemptId,
    quizId,
    profile.id,
    startedAt,
    '', // submitted_at
    deadlineAt,
    'in_progress',
    0, // score_obtained
    Number(quizRow[totalMarksIdx]) || questions.reduce((acc, q) => acc + q.marks, 0),
    0, // percentage
    false // passed
  ]);

  return {
    quiz: {
      id: quizId,
      title: quizRow[titleIdx],
      instructions: quizRow[instIdx],
      durationMinutes: durationMinutes,
      totalMarks: quizRow[totalMarksIdx],
      passPercentage: quizRow[passPctIdx],
      attemptLimit: attemptLimit,
      attemptsUsed: attemptsCount
    },
    attemptId: attemptId,
    startedAt: startedAt.toISOString(),
    deadlineAt: deadlineAt.toISOString(),
    serverTime: new Date().toISOString(),
    questions: questions
  };
}

/**
 * Evaluates and scores student submission with strict server-side validation and LockService
 */
function submitQuizAttempt(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000); // 30-second lock window
  } catch (e) {
    throw new Error('Server busy processing concurrent submissions. Please try submitting again in a moment.');
  }

  try {
    const user = requireAuthenticatedUser_();
    const profile = getOrCreateStudentProfile_(user);
    const ss = getSpreadsheet();

    const attemptId = payload.attemptId;
    const quizId = payload.quizId;
    const submittedAnswers = payload.answers || {}; // { [questionId]: 'A' | 'B' | ... }

    // 1. Verify Attempt record in ATTEMPTS sheet
    const attemptsSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ATTEMPTS);
    const aData = attemptsSheet.getDataRange().getValues();
    const aHeaders = aData[0].map(h => String(h).trim().toLowerCase());
    const aIdIdx = aHeaders.indexOf('attempt_id');
    const aQIdIdx = aHeaders.indexOf('quiz_id');
    const aSIdIdx = aHeaders.indexOf('student_id');
    const aStatusIdx = aHeaders.indexOf('status');
    const aScoreIdx = aHeaders.indexOf('score_obtained');
    const aTotalIdx = aHeaders.indexOf('total_possible');
    const aPctIdx = aHeaders.indexOf('percentage');
    const aPassIdx = aHeaders.indexOf('passed');
    const aSubAtIdx = aHeaders.indexOf('submitted_at');

    let attemptRowIndex = -1;
    let attemptRecord = null;
    for (let i = 1; i < aData.length; i++) {
      if (aData[i][aIdIdx] === attemptId) {
        attemptRowIndex = i + 1;
        attemptRecord = aData[i];
        break;
      }
    }

    if (!attemptRecord) {
      throw new Error('Attempt not found or invalid session: ' + attemptId);
    }

    if (attemptRecord[aSIdIdx] !== profile.id && !user.isAdmin) {
      throw new Error('Unauthorized submission: Attempt does not belong to your user account.');
    }

    if (attemptRecord[aStatusIdx] === 'submitted') {
      throw new Error('DUPLICATE_SUBMISSION: This quiz attempt has already been submitted and scored.');
    }

    // 2. Load Quiz Pass Criteria
    const quizzesSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.QUIZZES);
    const qData = quizzesSheet.getDataRange().getValues();
    const qHeaders = qData[0].map(h => String(h).trim().toLowerCase());
    const qIdIdx = qHeaders.indexOf('quiz_id');
    const passPctIdx = qHeaders.indexOf('pass_percentage');
    const revIdx = qHeaders.indexOf('review_policy');

    let passPct = 50;
    let reviewPolicy = 'after_submission';
    for (let i = 1; i < qData.length; i++) {
      if (qData[i][qIdIdx] === quizId) {
        passPct = Number(qData[i][passPctIdx]) || 50;
        reviewPolicy = qData[i][revIdx] || 'after_submission';
        break;
      }
    }

    // 3. Load Questions & Ground Truth Correct Answers
    const questionsSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.QUESTIONS);
    const quData = questionsSheet.getDataRange().getValues();
    const quHeaders = quData[0].map(h => String(h).trim().toLowerCase());
    const quIdIdx = quHeaders.indexOf('question_id');
    const quQIdIdx = quHeaders.indexOf('quiz_id');
    const textIdx = quHeaders.indexOf('question_text');
    const corrIdx = quHeaders.indexOf('correct_answer');
    const marksIdx = quHeaders.indexOf('marks');
    const expIdx = quHeaders.indexOf('explanation');

    const questionMap = {};
    for (let i = 1; i < quData.length; i++) {
      if (quData[i][quQIdIdx] === quizId) {
        questionMap[quData[i][quIdIdx]] = {
          id: quData[i][quIdIdx],
          text: quData[i][textIdx],
          correctAnswer: String(quData[i][corrIdx]).trim().toUpperCase(),
          marks: Number(quData[i][marksIdx]) || 1,
          explanation: quData[i][expIdx]
        };
      }
    }

    // 4. Server-Side Answer Grading
    let totalScore = 0;
    let totalPossible = 0;
    const answersSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ANSWERS);
    const reviewData = [];

    for (const [qId, qInfo] of Object.entries(questionMap)) {
      totalPossible += qInfo.marks;
      const selected = String(submittedAnswers[qId] || '').trim().toUpperCase();
      const isCorrect = (selected === qInfo.correctAnswer);
      const marksAwarded = isCorrect ? qInfo.marks : 0;
      totalScore += marksAwarded;

      // Save individual answer record
      answersSheet.appendRow([
        'ANS-' + Utilities.getUuid().substring(0, 8),
        attemptId,
        qId,
        profile.id,
        selected,
        isCorrect,
        marksAwarded
      ]);

      reviewData.push({
        questionId: qId,
        questionText: qInfo.text,
        selectedOption: selected,
        correctOption: qInfo.correctAnswer,
        isCorrect: isCorrect,
        marksAwarded: marksAwarded,
        maxMarks: qInfo.marks,
        explanation: qInfo.explanation
      });
    }

    const percentage = totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : 0;
    const passed = (percentage >= passPct);
    const submittedAt = new Date();

    // 5. Update ATTEMPTS record
    attemptsSheet.getRange(attemptRowIndex, aStatusIdx + 1).setValue('submitted');
    attemptsSheet.getRange(attemptRowIndex, aSubAtIdx + 1).setValue(submittedAt);
    attemptsSheet.getRange(attemptRowIndex, aScoreIdx + 1).setValue(totalScore);
    attemptsSheet.getRange(attemptRowIndex, aTotalIdx + 1).setValue(totalPossible);
    attemptsSheet.getRange(attemptRowIndex, aPctIdx + 1).setValue(percentage);
    attemptsSheet.getRange(attemptRowIndex, aPassIdx + 1).setValue(passed);

    // 6. Update or Insert into RESULTS sheet
    const resultsSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.RESULTS);
    const rData = resultsSheet.getDataRange().getValues();
    const rHeaders = rData[0].map(h => String(h).trim().toLowerCase());
    const rSIdIdx = rHeaders.indexOf('student_id');
    const rQIdIdx = rHeaders.indexOf('quiz_id');
    const rBestScoreIdx = rHeaders.indexOf('best_score');
    const rBestPctIdx = rHeaders.indexOf('best_percentage');
    const rBestAttIdx = rHeaders.indexOf('best_attempt_id');
    const rCountIdx = rHeaders.indexOf('attempts_count');
    const rPassIdx = rHeaders.indexOf('passed');
    const rUpdIdx = rHeaders.indexOf('updated_at');

    let existingResultRow = -1;
    let prevBest = 0;
    let prevCount = 0;
    for (let i = 1; i < rData.length; i++) {
      if (rData[i][rSIdIdx] === profile.id && rData[i][rQIdIdx] === quizId) {
        existingResultRow = i + 1;
        prevBest = Number(rData[i][rBestScoreIdx]) || 0;
        prevCount = Number(rData[i][rCountIdx]) || 0;
        break;
      }
    }

    if (existingResultRow !== -1) {
      const isNewBest = totalScore >= prevBest;
      if (isNewBest) {
        resultsSheet.getRange(existingResultRow, rBestScoreIdx + 1).setValue(totalScore);
        resultsSheet.getRange(existingResultRow, rBestPctIdx + 1).setValue(percentage);
        resultsSheet.getRange(existingResultRow, rBestAttIdx + 1).setValue(attemptId);
        resultsSheet.getRange(existingResultRow, rPassIdx + 1).setValue(passed);
      }
      resultsSheet.getRange(existingResultRow, rCountIdx + 1).setValue(prevCount + 1);
      resultsSheet.getRange(existingResultRow, rUpdIdx + 1).setValue(submittedAt);
    } else {
      resultsSheet.appendRow([
        'RES-' + Utilities.getUuid().substring(0, 8),
        profile.id,
        quizId,
        totalScore,
        percentage,
        attemptId,
        1,
        passed,
        submittedAt
      ]);
    }

    // 7. Update Student Phase Progress
    const dashData = getStudentDashboardData();

    // 8. Queue Email in EMAIL_LOG (Idempotent & Safe)
    try {
      queueNotification_('QUIZ_COMPLETION', profile.email, profile.id, quizId, {
        quizTitle: 'Quiz: ' + quizId,
        score: totalScore,
        totalPossible: totalPossible,
        percentage: percentage,
        passed: passed
      });

      // If Phase 2 is satisfied, trigger certificate check
      if (dashData.phaseProgress.phase2.completed) {
        queueNotification_('PHASE_2_COMPLETION', profile.email, profile.id, 'phase-2', {
          studentName: profile.displayName,
          phaseTitle: dashData.phaseProgress.phase2.title
        });
      }
    } catch (mailErr) {
      console.warn('Notification queuing skipped: ' + mailErr.message);
    }

    return {
      success: true,
      score: totalScore,
      totalPossible: totalPossible,
      percentage: percentage,
      passed: passed,
      review: (reviewPolicy === 'after_submission' || user.isAdmin) ? reviewData : null
    };
  } finally {
    lock.releaseLock();
  }
}
