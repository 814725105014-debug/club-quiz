/**
 * EMBEDX Phase Tracking & Completion Verification Engine
 * Enforces Phase 1 Prerequisites and Evaluates Phase 2 Certificate Eligibility
 */

function getPhasesList() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.PHASES);
  const phases = [];

  if (sheet && sheet.getLastRow() > 1) {
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim().toLowerCase());
    const idIdx = headers.indexOf('phase_id');
    const numIdx = headers.indexOf('phase_number');
    const titleIdx = headers.indexOf('title');
    const descIdx = headers.indexOf('description');
    const reqIdx = headers.indexOf('required_quizzes_count');
    const minScoreIdx = headers.indexOf('min_pass_score');
    const activeIdx = headers.indexOf('is_active');

    for (let i = 1; i < data.length; i++) {
      phases.push({
        id: data[i][idIdx],
        number: data[i][numIdx],
        title: data[i][titleIdx],
        description: data[i][descIdx],
        requiredQuizzesCount: Number(data[i][reqIdx]) || 1,
        minPassScore: Number(data[i][minScoreIdx]) || 50,
        isActive: (data[i][activeIdx] === true || String(data[i][activeIdx]).toLowerCase() === 'true')
      });
    }
  }
  return phases;
}

/**
 * Evaluates Phase 1 & Phase 2 completion for a student based on actual passed quizzes
 */
function evaluateStudentPhases_(studentId, studentResults, quizzes) {
  const phases = getPhasesList();
  const phase1Config = phases.find(p => p.id === 'phase-1') || { requiredQuizzesCount: 2, minPassScore: 50 };
  const phase2Config = phases.find(p => p.id === 'phase-2') || { requiredQuizzesCount: 3, minPassScore: 50 };

  // Phase 1 Quizzes
  const p1Quizzes = quizzes.filter(q => q.phaseId === 'phase-1');
  const p1Passed = p1Quizzes.filter(q => {
    const res = studentResults[q.id];
    return res && res.passed && (Number(res.percentage) >= phase1Config.minPassScore);
  });

  const p1Completed = (p1Passed.length >= phase1Config.requiredQuizzesCount) || (p1Quizzes.length > 0 && p1Passed.length === p1Quizzes.length);
  const p1Pct = p1Quizzes.length > 0 ? Math.min(100, Math.round((p1Passed.length / phase1Config.requiredQuizzesCount) * 100)) : 0;

  // Phase 2 Quizzes (Strict prerequisite: Phase 1 must be completed!)
  const p2Quizzes = quizzes.filter(q => q.phaseId === 'phase-2');
  const p2Passed = p2Quizzes.filter(q => {
    const res = studentResults[q.id];
    return res && res.passed && (Number(res.percentage) >= phase2Config.minPassScore);
  });

  const p2Completed = p1Completed && (
    (p2Passed.length >= phase2Config.requiredQuizzesCount) ||
    (p2Quizzes.length > 0 && p2Passed.length === p2Quizzes.length)
  );
  const p2Pct = p2Quizzes.length > 0 ? Math.min(100, Math.round((p2Passed.length / phase2Config.requiredQuizzesCount) * 100)) : 0;

  // Sync to PHASE_PROGRESS sheet
  syncPhaseProgressRecord_(studentId, 'phase-1', p1Completed, p1Passed.length);
  syncPhaseProgressRecord_(studentId, 'phase-2', p2Completed, p2Passed.length);

  return {
    phase1: {
      id: 'phase-1',
      title: phase1Config.title || 'Phase 1: Foundations',
      completed: p1Completed,
      quizzesCompleted: p1Passed.length,
      requiredQuizzes: phase1Config.requiredQuizzesCount,
      percentage: p1Pct
    },
    phase2: {
      id: 'phase-2',
      title: phase2Config.title || 'Phase 2: Applied Firmware & Automation',
      completed: p2Completed,
      quizzesCompleted: p2Passed.length,
      requiredQuizzes: phase2Config.requiredQuizzesCount,
      percentage: p2Pct,
      prerequisiteSatisfied: p1Completed
    }
  };
}

/**
 * Safe idempotent record sync in PHASE_PROGRESS sheet
 */
function syncPhaseProgressRecord_(studentId, phaseId, completed, count) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.PHASE_PROGRESS);
    if (!sheet) return;

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      sheet.appendRow([
        'PROG-' + Utilities.getUuid().substring(0, 8),
        studentId,
        phaseId,
        completed,
        completed ? new Date() : '',
        count,
        ''
      ]);
      return;
    }

    const headers = data[0].map(h => String(h).trim().toLowerCase());
    const sIdIdx = headers.indexOf('student_id');
    const pIdIdx = headers.indexOf('phase_id');
    const compIdx = headers.indexOf('completed');
    const compAtIdx = headers.indexOf('completed_at');
    const countIdx = headers.indexOf('quizzes_completed');

    let foundRow = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][sIdIdx] === studentId && data[i][pIdIdx] === phaseId) {
        foundRow = i + 1;
        break;
      }
    }

    if (foundRow !== -1) {
      sheet.getRange(foundRow, compIdx + 1).setValue(completed);
      sheet.getRange(foundRow, countIdx + 1).setValue(count);
      if (completed && !data[foundRow - 1][compAtIdx]) {
        sheet.getRange(foundRow, compAtIdx + 1).setValue(new Date());
      }
    } else {
      sheet.appendRow([
        'PROG-' + Utilities.getUuid().substring(0, 8),
        studentId,
        phaseId,
        completed,
        completed ? new Date() : '',
        count,
        ''
      ]);
    }
  } catch (e) {
    console.warn('Phase progress sync skipped: ' + e.message);
  }
}
