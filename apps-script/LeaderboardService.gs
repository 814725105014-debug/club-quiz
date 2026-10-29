/**
 * EMBEDX Deterministic Leaderboard Service
 * Calculates Verified Rankings from Stored Submissions with Privacy Protection
 */

function getLeaderboard(limit = 100) {
  const user = getCurrentUser_();
  const ss = getSpreadsheet();

  // 1. Load All Users
  const usersSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.USERS);
  const userMap = {};
  if (usersSheet && usersSheet.getLastRow() > 1) {
    const uData = usersSheet.getDataRange().getValues();
    const headers = uData[0].map(h => String(h).trim().toLowerCase());
    const idIdx = headers.indexOf('student_id');
    const emailIdx = headers.indexOf('email');
    const nameIdx = headers.indexOf('display_name');
    const deptIdx = headers.indexOf('department');
    const yearIdx = headers.indexOf('year');

    for (let i = 1; i < uData.length; i++) {
      userMap[uData[i][idIdx]] = {
        id: uData[i][idIdx],
        email: uData[i][emailIdx],
        displayName: uData[i][nameIdx],
        department: uData[i][deptIdx],
        year: uData[i][yearIdx]
      };
    }
  }

  // 2. Load All Results
  const resultsSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.RESULTS);
  const studentAggregates = {};

  if (resultsSheet && resultsSheet.getLastRow() > 1) {
    const rData = resultsSheet.getDataRange().getValues();
    const headers = rData[0].map(h => String(h).trim().toLowerCase());
    const sIdIdx = headers.indexOf('student_id');
    const qIdIdx = headers.indexOf('quiz_id');
    const scoreIdx = headers.indexOf('best_score');
    const pctIdx = headers.indexOf('best_percentage');
    const passedIdx = headers.indexOf('passed');
    const updIdx = headers.indexOf('updated_at');

    for (let i = 1; i < rData.length; i++) {
      const sId = rData[i][sIdIdx];
      if (!studentAggregates[sId]) {
        studentAggregates[sId] = {
          studentId: sId,
          totalScore: 0,
          quizzesPassed: 0,
          quizzesAttempted: 0,
          latestSubmission: new Date(0),
          quizzes: {}
        };
      }

      const score = Number(rData[i][scoreIdx]) || 0;
      const passed = (rData[i][passedIdx] === true || String(rData[i][passedIdx]).toLowerCase() === 'true');
      const updated = rData[i][updIdx] instanceof Date ? rData[i][updIdx] : new Date(rData[i][updIdx] || 0);

      studentAggregates[sId].totalScore += score;
      studentAggregates[sId].quizzesAttempted += 1;
      if (passed) studentAggregates[sId].quizzesPassed += 1;
      if (updated > studentAggregates[sId].latestSubmission) {
        studentAggregates[sId].latestSubmission = updated;
      }
      studentAggregates[sId].quizzes[rData[i][qIdIdx]] = score;
    }
  }

  // 3. Compile and Rank Deterministically
  const leaderboardEntries = Object.values(studentAggregates).map(agg => {
    const uInfo = userMap[agg.studentId] || {
      displayName: 'Student ' + agg.studentId.substring(0, 6),
      email: '',
      department: 'EEE',
      year: 'I / II Year'
    };

    // Privacy Masking for Non-Admin
    let displayEmail = uInfo.email;
    if (!user.isAdmin) {
      if (displayEmail.includes('@')) {
        const parts = displayEmail.split('@');
        displayEmail = parts[0].substring(0, 3) + '****@' + parts[1];
      }
    }

    return {
      studentId: agg.studentId,
      displayName: uInfo.displayName,
      email: displayEmail,
      rawEmail: uInfo.email,
      department: uInfo.department,
      year: uInfo.year,
      totalScore: agg.totalScore,
      quizzesPassed: agg.quizzesPassed,
      quizzesAttempted: agg.quizzesAttempted,
      latestSubmissionTime: agg.latestSubmission.getTime(),
      latestSubmissionFormatted: agg.latestSubmission.getTime() > 0 ? Utilities.formatDate(agg.latestSubmission, CONFIG.EVENT.TIMEZONE, 'dd MMM, HH:mm') : '-'
    };
  });

  // Sort: Total Score DESC -> Quizzes Passed DESC -> Latest Submission ASC (Earliest gets higher rank)
  leaderboardEntries.sort((a, b) => {
    if (b.totalScore !== a.totalScore) {
      return b.totalScore - a.totalScore;
    }
    if (b.quizzesPassed !== a.quizzesPassed) {
      return b.quizzesPassed - a.quizzesPassed;
    }
    return a.latestSubmissionTime - b.latestSubmissionTime;
  });

  // Assign Rank Numbers with Proper Ties
  let currentRank = 1;
  for (let i = 0; i < leaderboardEntries.length; i++) {
    if (i > 0) {
      const prev = leaderboardEntries[i - 1];
      const curr = leaderboardEntries[i];
      if (curr.totalScore === prev.totalScore && curr.quizzesPassed === prev.quizzesPassed && curr.latestSubmissionTime === prev.latestSubmissionTime) {
        curr.rank = prev.rank;
      } else {
        curr.rank = i + 1;
      }
    } else {
      leaderboardEntries[i].rank = 1;
    }
  }

  return {
    generatedAt: Utilities.formatDate(new Date(), CONFIG.EVENT.TIMEZONE, 'dd MMM yyyy, HH:mm:ss (zzz)'),
    totalContenders: leaderboardEntries.length,
    leaderboard: leaderboardEntries.slice(0, limit)
  };
}

/**
 * Returns current student rank and score stats
 */
function getStudentRank_(studentId) {
  const lbData = getLeaderboard(500);
  const found = lbData.leaderboard.find(e => e.studentId === studentId);
  if (found) {
    return {
      rank: found.rank,
      totalScore: found.totalScore,
      totalContenders: lbData.totalContenders,
      quizzesPassed: found.quizzesPassed
    };
  }
  return {
    rank: '-',
    totalScore: 0,
    totalContenders: lbData.totalContenders,
    quizzesPassed: 0
  };
}
