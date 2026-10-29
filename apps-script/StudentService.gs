/**
 * EMBEDX Student Profile & Dashboard Service
 * Manages Student Profiles, Dashboard Payloads, and Certificate Display Names
 */

/**
 * Gets or creates the student profile upon authenticated access
 */
function getOrCreateStudentProfile_(user) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.USERS);
  if (!sheet) { initDatabase(ss); sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.USERS); }
  const data = sheet.getDataRange().getValues();
  const now = new Date();

  if (data.length > 1) {
    const headers = data[0].map(h => String(h).trim().toLowerCase());
    const emailIdx = headers.indexOf('email');
    const nameIdx = headers.indexOf('display_name');
    const idIdx = headers.indexOf('student_id');
    const roleIdx = headers.indexOf('role');
    const deptIdx = headers.indexOf('department');
    const yearIdx = headers.indexOf('year');
    const lastActiveIdx = headers.indexOf('last_active_at');

    for (let i = 1; i < data.length; i++) {
      if (normalizeEmail_(data[i][emailIdx]) === user.email) {
        // Update last active
        if (lastActiveIdx !== -1) {
          sheet.getRange(i + 1, lastActiveIdx + 1).setValue(now);
        }
        return {
          id: data[i][idIdx],
          email: data[i][emailIdx],
          displayName: data[i][nameIdx],
          role: data[i][roleIdx] || user.role,
          department: data[i][deptIdx] || 'EEE',
          year: data[i][yearIdx] || 'I / II Year'
        };
      }
    }
  }

  // Create new student profile
  const newId = 'STU-' + Utilities.getUuid().substring(0, 8).toUpperCase();
  // Generate friendly default name from email (e.g. 814725105014 or name prefix)
  const prefix = user.email.split('@')[0];
  const defaultName = prefix.toUpperCase();

  sheet.appendRow([
    newId,
    user.email,
    defaultName,
    user.role,
    'Department of EEE',
    'I / II Year',
    now,
    now,
    'active'
  ]);

  return {
    id: newId,
    email: user.email,
    displayName: defaultName,
    role: user.role,
    department: 'Department of EEE',
    year: 'I / II Year'
  };
}

/**
 * Allows student to update their certificate display name
 */
function updateCertificateDisplayName(newName) {
  const user = requireAuthenticatedUser_();
  const cleanName = String(newName || '').trim();
  if (cleanName.length < 3 || cleanName.length > 100) {
    throw new Error('Name must be between 3 and 100 characters in length.');
  }

  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.USERS);
  if (!sheet) { initDatabase(ss); sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.USERS); }
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim().toLowerCase());
  const emailIdx = headers.indexOf('email');
  const nameIdx = headers.indexOf('display_name');

  for (let i = 1; i < data.length; i++) {
    if (normalizeEmail_(data[i][emailIdx]) === user.email) {
      sheet.getRange(i + 1, nameIdx + 1).setValue(cleanName);
      logAuditAction_(user.email, 'UPDATE_PROFILE', 'USER', user.email, 'Updated certificate display name to: ' + cleanName);
      return { success: true, displayName: cleanName };
    }
  }

  throw new Error('User record not found.');
}

/**
 * Assembles the complete dashboard payload for the authenticated student
 */
function getStudentDashboardData() {
  const user = requireAuthenticatedUser_();
  const profile = getOrCreateStudentProfile_(user);

  const ss = getSpreadsheet();

  // 1. Fetch Workshop Event details from APP_SETTINGS
  const settingsSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.APP_SETTINGS);
  const settingsMap = {};
  if (settingsSheet && settingsSheet.getLastRow() > 1) {
    const sData = settingsSheet.getDataRange().getValues();
    for (let i = 1; i < sData.length; i++) {
      settingsMap[sData[i][0]] = sData[i][1];
    }
  }

  const workshop = {
    title: settingsMap['EVENT_TITLE'] || CONFIG.EVENT.TITLE,
    date: settingsMap['EVENT_DATE'] || CONFIG.EVENT.DATE,
    venue: settingsMap['EVENT_VENUE'] || CONFIG.EVENT.VENUE,
    institution: CONFIG.INSTITUTION.NAME,
    department: CONFIG.INSTITUTION.DEPARTMENT,
    club: CONFIG.INSTITUTION.CLUB,
    resourcePersons: CONFIG.EVENT.RESOURCE_PERSONS
  };

  // 2. Fetch Sessions
  const sessions = [];
  const sessionsSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.SESSIONS);
  if (sessionsSheet && sessionsSheet.getLastRow() > 1) {
    const sRows = sessionsSheet.getDataRange().getValues();
    const headers = sRows[0].map(h => String(h).trim().toLowerCase());
    const idIdx = headers.indexOf('session_id');
    const orderIdx = headers.indexOf('session_order');
    const titleIdx = headers.indexOf('title');
    const descIdx = headers.indexOf('description');
    const phaseIdx = headers.indexOf('phase_id');
    const pubIdx = headers.indexOf('is_published');

    for (let i = 1; i < sRows.length; i++) {
      const isPub = (sRows[i][pubIdx] === true || String(sRows[i][pubIdx]).toLowerCase() === 'true');
      if (isPub) {
        sessions.push({
          id: sRows[i][idIdx],
          order: sRows[i][orderIdx],
          title: sRows[i][titleIdx],
          description: sRows[i][descIdx],
          phaseId: sRows[i][phaseIdx]
        });
      }
    }
    sessions.sort((a, b) => a.order - b.order);
  }

  // 3. Fetch Student's Results & Attempts
  const studentResults = {};
  const resultsSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.RESULTS);
  if (resultsSheet && resultsSheet.getLastRow() > 1) {
    const rRows = resultsSheet.getDataRange().getValues();
    const headers = rRows[0].map(h => String(h).trim().toLowerCase());
    const sIdIdx = headers.indexOf('student_id');
    const qIdIdx = headers.indexOf('quiz_id');
    const scoreIdx = headers.indexOf('best_score');
    const pctIdx = headers.indexOf('best_percentage');
    const attemptsIdx = headers.indexOf('attempts_count');
    const passedIdx = headers.indexOf('passed');

    for (let i = 1; i < rRows.length; i++) {
      if (rRows[i][sIdIdx] === profile.id) {
        studentResults[rRows[i][qIdIdx]] = {
          bestScore: rRows[i][scoreIdx],
          percentage: rRows[i][pctIdx],
          attemptsCount: rRows[i][attemptsIdx],
          passed: (rRows[i][passedIdx] === true || String(rRows[i][passedIdx]).toLowerCase() === 'true')
        };
      }
    }
  }

  // 4. Fetch Quizzes and compute student state
  const quizzes = [];
  const quizzesSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.QUIZZES);
  if (quizzesSheet && quizzesSheet.getLastRow() > 1) {
    const qRows = quizzesSheet.getDataRange().getValues();
    const headers = qRows[0].map(h => String(h).trim().toLowerCase());
    const qIdIdx = headers.indexOf('quiz_id');
    const sIdIdx = headers.indexOf('session_id');
    const pIdIdx = headers.indexOf('phase_id');
    const titleIdx = headers.indexOf('title');
    const instIdx = headers.indexOf('instructions');
    const durIdx = headers.indexOf('duration_minutes');
    const totalMarksIdx = headers.indexOf('total_marks');
    const passPctIdx = headers.indexOf('pass_percentage');
    const limitIdx = headers.indexOf('attempt_limit');
    const pubIdx = headers.indexOf('is_published');
    const startIdx = headers.indexOf('start_time');
    const endIdx = headers.indexOf('end_time');

    for (let i = 1; i < qRows.length; i++) {
      const isPub = (qRows[i][pubIdx] === true || String(qRows[i][pubIdx]).toLowerCase() === 'true');
      if (isPub) {
        const quizId = qRows[i][qIdIdx];
        const res = studentResults[quizId] || null;
        const attemptLimit = Number(qRows[i][limitIdx]) || 1;
        const attemptsUsed = res ? (Number(res.attemptsCount) || 0) : 0;

        let status = 'available';
        if (res && res.passed) {
          status = 'completed';
        } else if (attemptsUsed >= attemptLimit) {
          status = 'attempts_exhausted';
        }

        quizzes.push({
          id: quizId,
          sessionId: qRows[i][sIdIdx],
          phaseId: qRows[i][pIdIdx],
          title: qRows[i][titleIdx],
          instructions: qRows[i][instIdx],
          durationMinutes: qRows[i][durIdx],
          totalMarks: qRows[i][totalMarksIdx],
          passPercentage: qRows[i][passPctIdx],
          attemptLimit: attemptLimit,
          attemptsUsed: attemptsUsed,
          status: status,
          bestScore: res ? res.bestScore : null,
          percentage: res ? res.percentage : null,
          passed: res ? res.passed : false
        });
      }
    }
  }

  // 5. Compute Phase Progress
  const phaseProgress = evaluateStudentPhases_(profile.id, studentResults, quizzes);

  // 6. Check Certificate Record
  const certificateInfo = getStudentCertificate_(profile.id, phaseProgress.phase2.completed);

  // 7. Get Student Rank from Leaderboard
  const rankInfo = getStudentRank_(profile.id);

  return {
    profile: profile,
    user: user,
    workshop: workshop,
    sessions: sessions,
    quizzes: quizzes,
    phaseProgress: phaseProgress,
    certificate: certificateInfo,
    rank: rankInfo
  };
}
