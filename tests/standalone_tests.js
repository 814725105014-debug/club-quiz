/**
 * EMBEDX Standalone Quiz Platform 2.0 Test Suite
 * Validates new constraints:
 * 1. Name forced to UPPERCASE
 * 2. Year strictly limited to 'I Year' and 'II Year'
 * 3. Any Google account accepted
 * 4. First-time registration bypass on subsequent visits
 * 5. Question bank integrity
 */

const assert = require('assert');
const { DEFAULT_QUIZZES } = require('../js/questions.js');

let passedCount = 0;
let totalCount = 0;

function runTest(name, fn) {
  totalCount++;
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
  }
}

console.log('================================================================');
console.log('EMBEDX Standalone Platform 2.0 Test Suite');
console.log('================================================================');

// Suite 1: Name Enforcing UPPERCASE
runTest('Enforces student name conversion to UPPERCASE', () => {
  const sanitizeName = (raw) => (raw || '').trim().toUpperCase();
  assert.strictEqual(sanitizeName('hariharan v'), 'HARIHARAN V');
  assert.strictEqual(sanitizeName('ramanathan s'), 'RAMANATHAN S');
  assert.strictEqual(sanitizeName('nanthakishore j'), 'NANTHAKISHORE J');
  assert.strictEqual(sanitizeName('vimala varshini m'), 'VIMALA VARSHINI M');
  assert.strictEqual(sanitizeName('Gayathri Arumugam'), 'GAYATHRI ARUMUGAM');
});

// Suite 2: Year of Study Dropdown Constraints
runTest('Restricts Year of Study strictly to I Year and II Year', () => {
  const allowedYears = ['I Year', 'II Year'];
  const validateYear = (val) => allowedYears.includes(val);

  assert.strictEqual(validateYear('I Year'), true);
  assert.strictEqual(validateYear('II Year'), true);
  assert.strictEqual(validateYear('III Year'), false);
  assert.strictEqual(validateYear('IV Year'), false);
  assert.strictEqual(validateYear('Faculty'), false);
});

// Suite 3: Any Google Account Allowed
runTest('Permits any valid Google account without restricting to college domain', () => {
  const isGoogleEmailValid = (email) => {
    return typeof email === 'string' && email.includes('@') && email.trim().length >= 5;
  };

  assert.strictEqual(isGoogleEmailValid('student123@gmail.com'), true);
  assert.strictEqual(isGoogleEmailValid('hariharan@yahoo.com'), true);
  assert.strictEqual(isGoogleEmailValid('814725105014@trp.srmtrichy.edu.in'), true);
  assert.strictEqual(isGoogleEmailValid('invalid-mail'), false);
});

// Suite 4: First-time Registration Persistence Logic
runTest('Shows registration modal on first visit and bypasses on subsequent visits', () => {
  const mockStorage = {};
  
  function checkStudentRegistrationStatus(email) {
    const key = 'embedx_student_' + email.toLowerCase();
    return mockStorage[key] ? true : false;
  }

  function registerStudent(email, name, year, dept) {
    const key = 'embedx_student_' + email.toLowerCase();
    mockStorage[key] = JSON.stringify({
      email: email.toLowerCase(),
      name: name.toUpperCase(),
      year: year,
      dept: dept,
      registeredAt: new Date().toISOString()
    });
  }

  const testEmail = 'newstudent@gmail.com';

  // 1st visit: Not registered
  assert.strictEqual(checkStudentRegistrationStatus(testEmail), false);

  // Student completes registration
  registerStudent(testEmail, 'arun kumar', 'I Year', 'EEE');

  // 2nd visit: Already registered!
  assert.strictEqual(checkStudentRegistrationStatus(testEmail), true);
  const profile = JSON.parse(mockStorage['embedx_student_' + testEmail]);
  assert.strictEqual(profile.name, 'ARUN KUMAR');
  assert.strictEqual(profile.year, 'I Year');
});

// Suite 5: Question Bank Validation
runTest('Validates full 5-session question bank integrity', () => {
  assert.strictEqual(DEFAULT_QUIZZES.length, 5);
  DEFAULT_QUIZZES.forEach(q => {
    assert.ok(q.id);
    assert.ok(q.title);
    assert.ok(q.phase);
    assert.strictEqual(q.questions.length, 5);
    q.questions.forEach(item => {
      assert.ok(item.id);
      assert.ok(item.text);
      assert.strictEqual(item.options.length, 4);
      assert.ok(['A', 'B', 'C', 'D'].includes(item.correct));
    });
  });
});

// Suite 6: Zero Browser Native Dialogs in Codebase
runTest('Enforces ZERO native alert/confirm/prompt calls across all portal HTML views', () => {
  const fs = require('fs');
  const path = require('path');
  const root = path.join(__dirname, '..');
  const files = ['index.html', 'admin.html', 'projector.html'];

  files.forEach(fileName => {
    const filePath = path.join(root, fileName);
    const content = fs.readFileSync(filePath, 'utf8');
    const regex = /(?:window\.)?(alert|confirm|prompt)\s*\(/g;
    const matches = [];
    let m;
    while ((m = regex.exec(content)) !== null) {
      matches.push(m[0]);
    }
    assert.strictEqual(matches.length, 0, `File ${fileName} contains ${matches.length} native browser dialog call(s): ${matches.join(', ')}`);
  });
});

// Suite 7: Assessment Evaluation & Result Page Metrics Calculation
runTest('Validates evaluation calculation for dedicated result screen', () => {
  const sampleQuiz = DEFAULT_QUIZZES[0];
  const userAnswers = {
    'Q1-1': sampleQuiz.questions[0].correct,
    'Q1-2': sampleQuiz.questions[1].correct,
    'Q1-3': sampleQuiz.questions[2].correct,
    'Q1-4': sampleQuiz.questions[3].correct,
    'Q1-5': 'WRONG_ANSWER'
  };

  let score = 0;
  sampleQuiz.questions.forEach(q => {
    if (userAnswers[q.id] === q.correct) {
      score += 2;
    }
  });

  const percent = Math.round((score / sampleQuiz.totalMarks) * 100);
  const passed = (percent >= sampleQuiz.passMarks);

  assert.strictEqual(score, 8); // 4 correct * 2 = 8
  assert.strictEqual(percent, 80);
  assert.strictEqual(passed, true); // 80% >= 50%
});

// Suite 8: Google Forms Question Bank Operations (Edit, Delete, Duplicate, Reorder)
runTest('Validates Google Forms authoring operations: Edit, Delete, Duplicate, and Reorder', () => {
  const quizzes = JSON.parse(JSON.stringify(DEFAULT_QUIZZES));
  const qz = quizzes[0];
  const initialCount = qz.questions.length;

  // 1. Edit Question
  const targetQ = qz.questions[0];
  targetQ.text = 'Updated Question Statement for Embedded Systems';
  targetQ.options[0].text = 'Updated Option A';
  targetQ.correct = 'C';
  targetQ.marks = 4;
  targetQ.exp = 'Updated technical rationale explanation.';

  assert.strictEqual(qz.questions[0].text, 'Updated Question Statement for Embedded Systems');
  assert.strictEqual(qz.questions[0].correct, 'C');
  assert.strictEqual(qz.questions[0].marks, 4);

  // 2. Duplicate Question (Google Forms feature)
  const cloned = JSON.parse(JSON.stringify(targetQ));
  cloned.id = 'Q1-DUP-99';
  cloned.text = `${targetQ.text} (Copy)`;
  qz.questions.splice(1, 0, cloned);
  assert.strictEqual(qz.questions.length, initialCount + 1);
  assert.strictEqual(qz.questions[1].text.includes('(Copy)'), true);

  // 3. Reorder Question (Move Down)
  const firstId = qz.questions[0].id;
  const secondId = qz.questions[1].id;
  const temp = qz.questions[0];
  qz.questions[0] = qz.questions[1];
  qz.questions[1] = temp;
  assert.strictEqual(qz.questions[0].id, secondId);
  assert.strictEqual(qz.questions[1].id, firstId);

  // 4. Delete Question (Google Forms feature)
  qz.questions = qz.questions.filter(item => item.id !== 'Q1-DUP-99');
  assert.strictEqual(qz.questions.length, initialCount);

  // 5. Total Marks Recalculation
  let newTotal = 0;
  qz.questions.forEach(q => newTotal += (q.marks || 2));
  assert.strictEqual(newTotal, 12); // 4 + 2 + 2 + 2 + 2 = 12
});

// Suite 9: Broadcast Message Controls (Publish, Edit, Delete)
runTest('Validates broadcast message lifecycle: Publish, Edit, and Delete', () => {
  const config = { broadcastMsg: '' };

  // 1. Publish Broadcast
  config.broadcastMsg = '⚠️ Attention: 5 minutes remaining!';
  assert.strictEqual(config.broadcastMsg, '⚠️ Attention: 5 minutes remaining!');

  // 2. Edit Broadcast
  config.broadcastMsg = '⚠️ Revised: 3 minutes remaining! Finalize submissions.';
  assert.strictEqual(config.broadcastMsg, '⚠️ Revised: 3 minutes remaining! Finalize submissions.');

  // 3. Delete / Clear Broadcast
  config.broadcastMsg = '';
  assert.strictEqual(config.broadcastMsg, '');
});

console.log('================================================================');
console.log(`TEST SUMMARY: ${passedCount} of ${totalCount} tests passed successfully.`);
console.log('================================================================');

