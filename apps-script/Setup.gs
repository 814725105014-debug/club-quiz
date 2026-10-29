/**
 * EMBEDX Safe Idempotent Database Initialization
 * Sets up 13 Relational Sheets, Schemas, Default Settings, and Seed Data
 */

function initDatabase(targetSs) {
  const ss = targetSs || getSpreadsheet(false);
  const createdSheets = [];

  const SCHEMAS = {
    [CONFIG.SHEET_NAMES.USERS]: [
      'student_id', 'email', 'display_name', 'role', 'department', 'year', 'first_login_at', 'last_active_at', 'status'
    ],
    [CONFIG.SHEET_NAMES.SESSIONS]: [
      'session_id', 'session_order', 'title', 'description', 'learning_outcomes', 'phase_id', 'is_published', 'created_at'
    ],
    [CONFIG.SHEET_NAMES.PHASES]: [
      'phase_id', 'phase_number', 'title', 'description', 'required_quizzes_count', 'min_pass_score', 'is_active'
    ],
    [CONFIG.SHEET_NAMES.QUIZZES]: [
      'quiz_id', 'session_id', 'phase_id', 'title', 'instructions', 'duration_minutes', 'total_marks', 'pass_percentage', 'attempt_limit', 'is_randomized', 'is_published', 'start_time', 'end_time', 'review_policy'
    ],
    [CONFIG.SHEET_NAMES.QUESTIONS]: [
      'question_id', 'quiz_id', 'question_text', 'question_type', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_answer', 'marks', 'explanation', 'is_published'
    ],
    [CONFIG.SHEET_NAMES.ATTEMPTS]: [
      'attempt_id', 'quiz_id', 'student_id', 'started_at', 'submitted_at', 'deadline_at', 'status', 'score_obtained', 'total_possible', 'percentage', 'passed'
    ],
    [CONFIG.SHEET_NAMES.ANSWERS]: [
      'answer_id', 'attempt_id', 'question_id', 'student_id', 'selected_option', 'is_correct', 'marks_awarded'
    ],
    [CONFIG.SHEET_NAMES.RESULTS]: [
      'result_id', 'student_id', 'quiz_id', 'best_score', 'best_percentage', 'best_attempt_id', 'attempts_count', 'passed', 'updated_at'
    ],
    [CONFIG.SHEET_NAMES.PHASE_PROGRESS]: [
      'progress_id', 'student_id', 'phase_id', 'completed', 'completed_at', 'quizzes_completed', 'average_score'
    ],
    [CONFIG.SHEET_NAMES.CERTIFICATES]: [
      'certificate_id', 'student_id', 'workshop_id', 'template_id', 'drive_file_id', 'pdf_url', 'issued_at', 'status', 'revoked_at'
    ],
    [CONFIG.SHEET_NAMES.EMAIL_LOG]: [
      'log_id', 'event_type', 'recipient_email', 'student_id', 'related_id', 'status', 'error_message', 'sent_at', 'retry_count'
    ],
    [CONFIG.SHEET_NAMES.AUDIT_LOG]: [
      'log_id', 'actor_email', 'action_type', 'target_entity', 'target_id', 'details', 'timestamp'
    ],
    [CONFIG.SHEET_NAMES.APP_SETTINGS]: [
      'key', 'value', 'description', 'updated_at'
    ]
  };

  // 1. Create missing sheets and set header row
  for (const [sheetName, headers] of Object.entries(SCHEMAS)) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#0B2A6F').setFontColor('#FFFFFF');
      sheet.setFrozenRows(1);
      createdSheets.push(sheetName);
    } else {
      // Validate or update header row if empty
      if (sheet.getLastRow() === 0) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#0B2A6F').setFontColor('#FFFFFF');
        sheet.setFrozenRows(1);
      }
    }
  }

  // 2. Seed Default Settings if empty
  const settingsSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.APP_SETTINGS);
  if (settingsSheet.getLastRow() <= 1) {
    const defaultSettings = [
      ['EVENT_TITLE', CONFIG.EVENT.TITLE, 'Official Workshop Title', new Date()],
      ['EVENT_DATE', CONFIG.EVENT.DATE, 'Confirmed Workshop Date', new Date()],
      ['EVENT_VENUE', CONFIG.EVENT.VENUE, 'Confirmed Workshop Venue', new Date()],
      ['TIMEZONE', CONFIG.EVENT.TIMEZONE, 'Default Timezone', new Date()],
      ['DRY_RUN_MODE', 'true', 'Safety mode: Prevent real emails during testing', new Date()],
      ['ALLOW_STUDENT_REVIEW', 'true', 'Allow students to review answers after quiz close', new Date()],
      ['AUTO_CERTIFICATE_ON_PHASE2', 'true', 'Issue certificate upon Phase 2 completion', new Date()],
      ['SLIDES_TEMPLATE_ID', getAppProperty('SLIDES_TEMPLATE_ID', ''), 'Google Slides Certificate Template ID', new Date()],
      ['CERTIFICATE_FOLDER_ID', getAppProperty('CERTIFICATE_FOLDER_ID', ''), 'Google Drive Output Folder ID', new Date()]
    ];
    settingsSheet.getRange(2, 1, defaultSettings.length, 4).setValues(defaultSettings);
  }

  // 3. Seed Phases if empty
  const phasesSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.PHASES);
  if (phasesSheet.getLastRow() <= 1) {
    const defaultPhases = [
      [
        'phase-1',
        1,
        'Phase 1: Embedded Systems & Hardware Architecture Foundations',
        'Fundamental concepts of embedded architectures, MCUs, transducers, sensors, and actuators.',
        2, // 2 required quizzes
        50, // 50% minimum passing score
        true
      ],
      [
        'phase-2',
        2,
        'Phase 2: Embedded C, Device Interfacing & Firmware Engineering',
        'Advanced embedded C programming, register manipulation, protocol interfacing, and automation prototypes.',
        3, // 3 required quizzes
        50, // 50% minimum passing score
        true
      ]
    ];
    phasesSheet.getRange(2, 1, defaultPhases.length, 7).setValues(defaultPhases);
  }

  // 4. Seed Sessions if empty
  const sessionsSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.SESSIONS);
  if (sessionsSheet.getLastRow() <= 1) {
    const now = new Date();
    const defaultSessions = CONFIG.INITIAL_TOPICS.map(topic => [
      'session-' + topic.order,
      topic.order,
      topic.title,
      topic.description,
      'Understand core principles, practical circuit diagrams, and debugging practices for topic ' + topic.order,
      'phase-' + topic.phase,
      true, // published
      now
    ]);
    sessionsSheet.getRange(2, 1, defaultSessions.length, 8).setValues(defaultSessions);
  }

  // 5. Seed Super Admin User if empty
  const usersSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.USERS);
  if (usersSheet.getLastRow() <= 1) {
    const now = new Date();
    usersSheet.appendRow([
      'USR-SUPER-001',
      CONFIG.SUPER_ADMIN.EMAIL,
      CONFIG.SUPER_ADMIN.NAME,
      CONFIG.ROLES.SUPER_ADMIN,
      'EEE Department',
      'Faculty / Leadership',
      now,
      now,
      'active'
    ]);
  }

  // 6. Seed Sample Published Quiz & Questions if QUIZZES is empty
  const quizzesSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.QUIZZES);
  if (quizzesSheet.getLastRow() <= 1) {
    const sampleQuizId = 'QUIZ-EMB-01';
    const sampleQuiz = [
      sampleQuizId,
      'session-1',
      'phase-1',
      'Quiz 1: Fundamentals of Embedded Systems',
      'Answer all questions. Each question carries 2 marks. Passing threshold is 50%.',
      15, // 15 minutes
      10, // 10 marks total
      50, // 50% pass threshold
      2,  // 2 attempts permitted
      true, // question randomization
      true, // published
      '', // start time
      '', // end time
      'after_submission' // review policy
    ];
    quizzesSheet.getRange(2, 1, 1, sampleQuiz.length).setValues([sampleQuiz]);

    // Seed 5 technical questions for Quiz 1
    const questionsSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.QUESTIONS);
    if (questionsSheet.getLastRow() <= 1) {
      const sampleQuestions = [
        [
          'Q1-1',
          sampleQuizId,
          'What is the fundamental difference between a microprocessor and a microcontroller?',
          'single_choice',
          'Microprocessors contain on-chip RAM, ROM, and peripherals; microcontrollers do not.',
          'Microcontrollers integrate CPU, RAM, ROM, and timers/I/O on a single silicon die.',
          'Microprocessors consume significantly less power than microcontrollers.',
          'Microcontrollers cannot execute control loops in real-time.',
          'B',
          2,
          'A microcontroller integrates the processor core, RAM, Flash/ROM, timers, and I/O ports on a single chip, whereas a microprocessor requires external memory and peripheral chips.',
          true
        ],
        [
          'Q2-1',
          sampleQuizId,
          'Which of the following represents a hard real-time embedded system constraint?',
          'single_choice',
          'Video streaming playback buffer frame drops.',
          'Airbag deployment mechanism in an automotive collision.',
          'Smartphone weather widget periodic refresh.',
          'Smart home temperature logging to cloud database.',
          'B',
          2,
          'Hard real-time systems have strict deadlines where missing a deadline leads to catastrophic system failure (e.g. airbag deployment).',
          true
        ],
        [
          'Q3-1',
          sampleQuizId,
          'What architecture features separate buses for program instructions and data memory?',
          'single_choice',
          'Von Neumann Architecture',
          'Harvard Architecture',
          'SIMD Architecture',
          'CISC Monolithic Architecture',
          'B',
          2,
          'Harvard architecture uses physically separate storage and signal pathways for instructions and data, allowing simultaneous fetch and data transfer.',
          true
        ],
        [
          'Q4-1',
          sampleQuizId,
          'A Watchdog Timer (WDT) in an embedded microcontroller is primarily used to:',
          'single_choice',
          'Measure high-frequency PWM audio signals.',
          'Reset or recover the system in case of firmware freeze or infinite loop.',
          'Provide battery charging level monitoring.',
          'Act as an external clock generator for the ALU.',
          'B',
          2,
          'A watchdog timer automatically resets the microcontroller if firmware execution gets trapped in an infinite loop and fails to clear the timer before expiration.',
          true
        ],
        [
          'Q5-1',
          sampleQuizId,
          'In Embedded C, the keyword "volatile" tells the compiler that:',
          'single_choice',
          'The variable must be stored permanently in non-volatile Flash ROM.',
          'The variable can change unexpectedly and must not be optimized away into a CPU register.',
          'The variable is strictly read-only and cannot be modified by any function.',
          'The variable has unsigned 64-bit integer precision.',
          'B',
          2,
          'The volatile qualifier informs the compiler that the value may be altered by hardware, an ISR, or concurrent thread, preventing redundant read optimizations.',
          true
        ]
      ];
      questionsSheet.getRange(2, 1, sampleQuestions.length, 12).setValues(sampleQuestions);
    }
  }

  // Remove default blank 'Sheet1' if it exists and other sheets were created
  try {
    const defaultSheet = ss.getSheetByName('Sheet1');
    if (defaultSheet && ss.getSheets().length > 1 && defaultSheet.getLastRow() === 0) {
      ss.deleteSheet(defaultSheet);
    }
  } catch (sheetDelErr) {
    // Ignore if deletion is not permitted
  }

  return {
    success: true,
    message: 'Database initialized successfully. All 13 sheets verified.',
    createdSheets: createdSheets
  };
}
