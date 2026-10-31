import { getDb, getSetting, setSetting } from './db.js';
import { env } from './env.js';
import { hashPassword } from './auth.js';
import { newId, randomCode } from './lib/ids.js';
import { createQuestion, createQuiz, applyQuizAction, listQuestions } from './services/quizzes.js';
import { addMinutes, nowIso } from './lib/time.js';
import { GOOGLE_WORKSPACE_AUDIT } from './auditNotes.js';

export function bootstrap(opts: { demo?: boolean } = {}): void {
  const db = getDb();
  seedAdmin();
  seedFields();
  seedSettings();
  if (opts.demo ?? (env.nodeEnv !== 'production' && getSetting('demo_seeded', '') !== 'true')) {
    seedDemoQuiz();
    setSetting('demo_seeded', 'true');
  }
}

export function seedAdmin(): void {
  const db = getDb();
  const count = (db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n;
  if (count > 0) return;
  db.prepare(
    `INSERT INTO users (id, email, name, role, password_hash) VALUES (?, ?, ?, ?, ?)`,
  ).run(
    newId('usr'),
    env.admin.email.toLowerCase(),
    env.admin.name,
    env.admin.role,
    hashPassword(env.admin.password),
  );
  // eslint-disable-next-line no-console
  console.log(`[bootstrap] created administrator ${env.admin.email}`);
}

export function seedFields(): void {
  const db = getDb();
  const count = (db.prepare('SELECT COUNT(*) AS n FROM registration_fields').get() as { n: number }).n;
  if (count > 0) return;

  const fields = [
    {
      key: 'name',
      label: 'Participant Full Name',
      type: 'text',
      required: 1,
      enabled: 1,
      order: 1,
      pattern: '^[A-Za-z][A-Za-z .\'-]{1,80}$',
      hint: 'Letters only, as printed on your certificate.',
      sheet: 'Participant Full Name ',
      placeholder: '{{NAME}}',
      core: 1,
    },
    {
      key: 'email',
      label: 'Email Address',
      type: 'email',
      required: 1,
      enabled: 1,
      order: 2,
      pattern: null,
      hint: 'Your certificate will be emailed to this address.',
      sheet: 'Email Address',
      placeholder: '{{EMAIL}}',
      core: 1,
    },
    {
      key: 'reg_number',
      label: 'Register Number',
      type: 'text',
      required: 1,
      enabled: 1,
      order: 3,
      pattern: '^[0-9]{12}$',
      hint: '12-digit college register number (e.g. 814725114014).',
      sheet: '  Register Number  ',
      placeholder: '{{REGISTRATION_NUMBER}}',
      core: 1,
    },
    {
      key: 'department',
      label: 'Department',
      type: 'text',
      required: 0,
      enabled: 1,
      order: 4,
      pattern: null,
      hint: 'e.g. EEE, CSE, ECE',
      sheet: '  Department  ',
      placeholder: '{{DEPARTMENT}}',
      core: 1,
    },
    {
      key: 'course_name',
      label: 'Course Name',
      type: 'text',
      required: 0,
      enabled: 0,
      order: 5,
      pattern: null,
      hint: 'Optional: only needed if participants must enter the course name themselves.',
      sheet: '  Course Name  ',
      placeholder: '{{COURSE_NAME}}',
      core: 0,
    },
    {
      key: 'conducted_by',
      label: 'Conducted By',
      type: 'text',
      required: 0,
      enabled: 0,
      order: 6,
      pattern: null,
      hint: 'Optional: defaults to the quiz certificate settings.',
      sheet: '  Conducted By  ',
      placeholder: '{{CONDUCTED_BY}}',
      core: 0,
    },
    {
      key: 'course_duration',
      label: 'Course Duration',
      type: 'text',
      required: 0,
      enabled: 0,
      order: 7,
      pattern: null,
      hint: 'Optional: for example "30 hours".',
      sheet: '  Course Duration  ',
      placeholder: '{{COURSE_DURATION}}',
      core: 0,
    },
  ];
  for (const f of fields) {
    db.prepare(
      `INSERT INTO registration_fields (id, key, label, type, required, enabled, sort_order, pattern, pattern_hint,
        maps_to_sheet_column, maps_to_placeholder, is_core)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      newId('fld'),
      f.key,
      f.label,
      f.type,
      f.required,
      f.enabled,
      f.order,
      f.pattern,
      f.hint,
      f.sheet,
      f.placeholder,
      f.core,
    );
  }
}

export function seedSettings(): void {
  const defaults: Record<string, string> = {
    'email_submission_confirmation_enabled': 'true',
    'onboarding_workspace_audit': JSON.stringify(GOOGLE_WORKSPACE_AUDIT),
    'platform_name': 'QUIZ PLATFORM',
    'platform_tagline': 'Assessment & Certification',
  };
  for (const [key, value] of Object.entries(defaults)) {
    if (getSetting(key, '') === '') setSetting(key, value);
  }
}

export function seedDemoQuiz(): void {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM quizzes WHERE join_code = ?').get('DEMO01');
  if (existing) return;

  const quiz = createQuiz(
    {
      title: 'Embedded Systems Fundamentals — Quiz 1',
      description:
        'A short assessment covering microcontrollers, embedded C and hardware interfacing. Scan the QR code, register with your college details and submit before the timer ends.',
      instructions:
        'Answer all questions. Each question carries 1 mark. Do not leave the quiz screen — proctoring events are recorded. Your answers are saved automatically.',
      durationMinutes: 10,
      passPercentage: 40,
      maxAttempts: 1,
      shuffleQuestions: true,
      shuffleOptions: true,
      negativeMarking: false,
      resultVisibility: 'immediate',
      certificateRule: 'pass',
      certificateMinScore: 0,
      certCourseName: 'Basics of Embedded Systems and Embedded Programming Language',
      certConductedBy: 'EMBEDX — Embedded Systems & Automation Club',
      certDuration: '30 hours',
      autoEmail: true,
      allowRegistration: true,
      violationWarnAfter: 1,
      violationAutoSubmitCount: 5,
      startAt: nowIso(),
      endAt: addMinutes(nowIso(), 60 * 24 * 30),
    },
    'system',
  );
  db.prepare('UPDATE quizzes SET join_code = ?, status = ? WHERE id = ?').run('DEMO01', 'published', quiz.id);

  const questions = [
    {
      text: 'What is the primary difference between a microprocessor and a microcontroller?',
      options: [
        'Microprocessors have built-in RAM and Flash ROM on-chip.',
        'Microcontrollers integrate the CPU, RAM, ROM and I/O peripherals on a single die.',
        'Microprocessors consume less power than microcontrollers.',
        'Microcontrollers cannot run real-time control loops.',
      ],
      correct: 1,
      explanation:
        'A microcontroller integrates CPU, memory and peripherals on one chip, which is why it suits embedded control applications.',
    },
    {
      text: 'Which memory type in a microcontroller typically stores the firmware permanently?',
      options: ['SRAM', 'DRAM', 'Flash ROM', 'Cache memory'],
      correct: 2,
      explanation: 'Flash ROM retains firmware when power is removed and can be reprogrammed.',
    },
    {
      text: 'In Embedded C, what does the bitwise expression `PORTB |= (1 << 3)` do?',
      options: [
        'Clears bit 3 of PORTB.',
        'Toggles bit 3 of PORTB.',
        'Sets bit 3 of PORTB to logic high without disturbing the other bits.',
        'Reads the value of bit 3 of PORTB.',
      ],
      correct: 2,
      explanation: 'OR-assignment with a shifted mask sets only the target bit while preserving other bits.',
    },
    {
      text: 'Which communication protocol uses two wires (SDA and SCL) with device addressing?',
      options: ['UART', 'SPI', 'I2C', 'CAN'],
      correct: 2,
      explanation: 'I2C is a two-wire synchronous bus where each peripheral has an address.',
    },
    {
      text: 'Which of the following are typical functions of a watchdog timer? (Select all that apply.)',
      options: [
        'Resetting the microcontroller if the firmware hangs.',
        'Increasing the CPU clock frequency automatically.',
        'Recovering the system from an infinite loop.',
        'Storing the firmware image permanently.',
      ],
      correct: [0, 2],
      multiple: true,
      explanation: 'A watchdog resets the device when the firmware fails to refresh it, recovering from hangs and infinite loops.',
    },
    {
      text: 'A relay is typically driven through an optocoupler to isolate the microcontroller from the load. True or false?',
      options: ['True', 'False'],
      correct: 0,
      type: 'truefalse',
      explanation: 'Optocouplers provide galvanic isolation between control electronics and inductive loads.',
    },
  ];

  for (const q of questions) {
    createQuestion(quiz.id, {
      text: q.text,
      type: (q as { type?: 'truefalse'; multiple?: boolean }).type
        ? 'truefalse'
        : (q as { multiple?: boolean }).multiple
          ? 'multi'
          : 'single',
      marks: 1,
      difficulty: 'medium',
      explanation: q.explanation,
      options: q.options.map((text, index) => ({
        text,
        isCorrect: Array.isArray(q.correct) ? q.correct.includes(index) : q.correct === index,
      })),
    });
  }
  applyQuizAction(quiz.id, 'publish');
  // eslint-disable-next-line no-console
  console.log('[bootstrap] demo quiz ready — join code DEMO01');
  void listQuestions(quiz.id);
}

export function ensureUniqueJoinCode(): string {
  const db = getDb();
  for (let i = 0; i < 50; i += 1) {
    const code = randomCode(6);
    if (!db.prepare('SELECT 1 FROM quizzes WHERE join_code = ?').get(code)) return code;
  }
  return randomCode(8);
}
