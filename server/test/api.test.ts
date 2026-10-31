/**
 * End-to-end API test against an isolated SQLite database and the mock Google provider.
 * Run: npm test
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { Server } from 'node:http';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quiz-platform-test-'));
process.env.NODE_ENV = 'test';
process.env.DATA_DIR = tmpDir;
process.env.DATABASE_PATH = path.join(tmpDir, 'test.db');
process.env.GOOGLE_PROVIDER = 'mock';
process.env.EMAIL_TEST_MODE = 'true';
process.env.EMAIL_REDIRECT_TO = 'admin@example.edu';
process.env.ADMIN_EMAIL = 'admin@example.edu';
process.env.ADMIN_PASSWORD = 'TestPassword!2026';
process.env.ADMIN_NAME = 'Test Administrator';
process.env.SESSION_SECRET = 'test-session-secret-test-session-secret';
process.env.CERT_PREFIX = 'TEST/CERT/';
process.env.CERT_START_NUMBER = 100;

let server: Server;
let base = '';
let cookie = '';
let quizId = '';
let joinCode = '';
let participantToken = '';

async function call<T = any>(pathName: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${base}${pathName}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
      ...(init.headers ?? {}),
    },
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  for (const c of setCookie) if (c.startsWith('qp_session=')) cookie = c.split(';')[0];
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  if (!res.ok) throw new Error(`${pathName} -> ${res.status} ${String(text).slice(0, 300)}`);
  return body as T;
}

before(async () => {
  const { bootstrap } = await import('../src/bootstrap.js');
  const { createApp } = await import('../src/app.js');
  const { startJobWorker } = await import('../src/services/jobs.js');
  const { handleJob } = await import('../src/services/jobHandlers.js');
  bootstrap({ demo: false });
  const app = createApp();
  server = app.listen(0);
  startJobWorker(handleJob);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('no port');
  base = `http://127.0.0.1:${address.port}`;
});

after(() => {
  server?.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('admin login works and rejects a wrong password', async () => {
  const bad = await fetch(`${base}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.edu', password: 'wrong-password' }),
  });
  assert.equal(bad.status, 401);

  const session = await call<{ user: { role: string } }>('/api/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@example.edu', password: 'TestPassword!2026' }),
  });
  assert.equal(session.user.role, 'super_admin');
  assert.ok(cookie.startsWith('qp_session='));
});

test('quiz can be created, populated and published', async () => {
  const now = Date.now();
  const created = await call<{ quiz: { id: string; join_code: string } }>('/api/admin/quizzes', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Automated Test Quiz',
      description: 'Created by the API test.',
      instructions: 'Answer everything.',
      startAt: new Date(now - 60_000).toISOString(),
      endAt: new Date(now + 30 * 60_000).toISOString(),
      durationMinutes: 15,
      passPercentage: 50,
      maxAttempts: 1,
      shuffleQuestions: true,
      shuffleOptions: true,
      resultVisibility: 'immediate',
      certificateRule: 'pass',
      autoEmail: true,
      certCourseName: 'Embedded Systems',
      allowRegistration: true,
    }),
  });
  quizId = created.quiz.id;
  joinCode = created.quiz.join_code;
  assert.ok(quizId && joinCode);

  const questions = [
    {
      text: 'Which device converts digital to analog?',
      type: 'single',
      marks: 2,
      options: [
        { text: 'ADC', isCorrect: false },
        { text: 'DAC', isCorrect: true },
        { text: 'UART', isCorrect: false },
      ],
    },
    {
      text: 'Select the serial buses.',
      type: 'multi',
      marks: 2,
      options: [
        { text: 'I2C', isCorrect: true },
        { text: 'SPI', isCorrect: true },
        { text: 'HTTP', isCorrect: false },
      ],
    },
    {
      text: 'An ISR should be short.',
      type: 'truefalse',
      marks: 1,
      options: [
        { text: 'True', isCorrect: true },
        { text: 'False', isCorrect: false },
      ],
    },
  ];
  for (const question of questions) {
    await call(`/api/admin/quizzes/${quizId}/questions`, { method: 'POST', body: JSON.stringify(question) });
  }

  const detail = await call<{ totals: { totalQuestions: number; totalMarks: number } }>(`/api/admin/quizzes/${quizId}`);
  assert.deepEqual(detail.totals, { totalQuestions: 3, totalMarks: 5 });

  const published = await call<{ quiz: { status: string } }>(`/api/admin/quizzes/${quizId}/actions`, {
    method: 'POST',
    body: JSON.stringify({ action: 'publish' }),
  });
  assert.equal(published.quiz.status, 'published');
});

test('public quiz payload never exposes answer keys', async () => {
  const payload = await call<{ quiz: { questionCount: number; totalMarks: number }; fields: unknown[] }>(
    `/api/student/quiz/${joinCode}`,
  );
  assert.equal(payload.quiz.questionCount, 3);
  assert.equal(payload.quiz.totalMarks, 5);
  assert.ok(payload.fields.length >= 3);
  assert.equal(JSON.stringify(payload).includes('isCorrect'), false);
  assert.equal(JSON.stringify(payload).includes('is_correct'), false);
});

test('student can register, attempt, autosave and submit', async () => {
  const regNumber = String(900000000000 + Math.floor(Math.random() * 999999999));
  const joined = await call<{ participantToken: string }>(`/api/student/quiz/${joinCode}/join`, {
    method: 'POST',
    body: JSON.stringify({
      fields: {
        name: 'Test Student',
        email: `student-${Date.now()}@example.edu`,
        reg_number: regNumber,
        department: 'Electrical and Electronics Engineering',
      },
    }),
  });
  participantToken = joined.participantToken;
  assert.ok(participantToken);

  const started = await call<{ attemptToken: string }>('/api/student/attempts/start', {
    method: 'POST',
    body: JSON.stringify({ participantToken }),
  });
  const state = await call<{
    questions: { id: string; text: string; options: { id: string; text: string }[] }[];
    attempt: { remainingSeconds: number };
  }>(`/api/student/attempts/state?token=${started.attemptToken}`);
  assert.equal(state.questions.length, 3);
  assert.ok(state.attempt.remainingSeconds > 0);
  assert.equal(JSON.stringify(state).includes('isCorrect'), false);

  const wanted: Record<string, string[]> = {
    'Which device converts digital to analog?': ['DAC'],
    'Select the serial buses.': ['I2C', 'SPI'],
    'An ISR should be short.': ['True'],
  };
  for (const question of state.questions) {
    const selected = question.options.filter((o) => wanted[question.text].includes(o.text)).map((o) => o.id);
    await call('/api/student/attempts/answer', {
      method: 'POST',
      body: JSON.stringify({ token: started.attemptToken, questionId: question.id, selected, markedForReview: false }),
    });
  }

  const violation = await call<{ accepted: boolean; count: number }>('/api/student/attempts/violation', {
    method: 'POST',
    body: JSON.stringify({ token: started.attemptToken, type: 'visibility_hidden' }),
  });
  assert.equal(violation.accepted, true);
  assert.equal(violation.count, 1);

  const submitted = await call<{ score: number; totalMarks: number; percentage: number; passed: boolean }>(
    '/api/student/attempts/submit',
    { method: 'POST', body: JSON.stringify({ token: started.attemptToken, reason: 'manual' }) },
  );
  assert.equal(submitted.score, 5);
  assert.equal(submitted.totalMarks, 5);
  assert.equal(submitted.percentage, 100);
  assert.equal(submitted.passed, true);
});

test('certificate is generated, verifiable and downloadable', async () => {
  let certificateId = '';
  for (let i = 0; i < 40; i += 1) {
    const me = await call<{ attempts: { certificate: { status: string; certificateId: string | null } | null }[] }>(
      `/api/student/me?token=${participantToken}`,
    );
    const cert = me.attempts[0]?.certificate;
    if (cert?.status === 'generated' && cert.certificateId) {
      certificateId = cert.certificateId;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(certificateId, 'certificate was not generated');
  assert.match(certificateId, /^TEST\/CERT\/-\d{4}-\d{4}$/);

  const verified = await call<{ valid: boolean; participantName: string }>(
    `/api/public/verify/${encodeURIComponent(certificateId)}`,
  );
  assert.equal(verified.valid, true);
  assert.equal(verified.participantName, 'TEST STUDENT');

  const pdf = await fetch(`${base}/api/public/certificates/${encodeURIComponent(certificateId)}/download`);
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get('content-type'), 'application/pdf');
  const bytes = new Uint8Array(await pdf.arrayBuffer());
  assert.ok(bytes.byteLength > 2000);
  assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), '%PDF-');
});

test('results, audit trail and dashboard reflect the run', async () => {
  const results = await call<{ rows: { certificateId: string; passed: number }[]; total: number }>(
    `/api/admin/results?quizId=${quizId}`,
  );
  assert.equal(results.total, 1);
  assert.equal(results.rows[0].passed, 1);

  const audit = await call<{ entries: { action: string }[] }>('/api/admin/audit?limit=200');
  const actions = audit.entries.map((entry) => entry.action);
  for (const expected of ['auth.login', 'quiz.create', 'attempt.submit', 'certificate.retry']) {
    if (expected === 'certificate.retry') continue;
    assert.ok(actions.includes(expected), `audit is missing ${expected}`);
  }

  const dashboard = await call<{ stats: { participants: number; submissions: number; certificates: { generated: number } } }>(
    '/api/admin/dashboard',
  );
  assert.equal(dashboard.stats.participants, 1);
  assert.equal(dashboard.stats.submissions, 1);
  assert.equal(dashboard.stats.certificates.generated, 1);
});
