
// =========================================================================
// SECTION: Config.gs
// =========================================================================

/**
 * EMBEDX Platform Configuration & Constants
 * Department of Electrical & Electronics Engineering
 * SRM TRP Engineering College, Tiruchirappalli
 */

var DEFAULT_SPREADSHEET_ID = typeof DEFAULT_SPREADSHEET_ID !== 'undefined' ? DEFAULT_SPREADSHEET_ID : '1Sw7EI3uiobfOj6ItfEGzmOXA_3xTHDYH_-eNYqO-MZo';

var CONFIG = typeof CONFIG !== 'undefined' ? CONFIG : {
  INSTITUTION: {
    NAME: 'SRM TRP Engineering College (Autonomous)',
    CAMPUS: 'SRM Nagar, Samayapuram, Tiruchirappalli – 621 105',
    DEPARTMENT: 'Department of Electrical and Electronics Engineering (EEE)',
    CLUB: 'EMBEDX – Embedded Systems & Automation Club',
    WEBSITE: 'https://trp.srmtrichy.edu.in/',
    EMAIL_DOMAIN: '@trp.srmtrichy.edu.in'
  },
  EVENT: {
    TITLE: 'Basics of Embedded Systems and Embedded Programming Language',
    DATE: '30 October 2026 (Friday)',
    TIMEZONE: 'Asia/Kolkata',
    VENUE: '5th Floor, CSE Seminar Hall',
    AUDIENCE: 'First- and second-year EEE students',
    RESOURCE_PERSONS: [
      { name: 'Mr. Ramanathan S', role: 'President & Technical Lead, EMBEDX' },
      { name: 'Mr. Hariharan V', role: 'Technical Coordinator & Systems Architect, EMBEDX' }
    ]
  },
  SUPER_ADMIN: {
    EMAIL: '814725105014@trp.srmtrichy.edu.in',
    NAME: 'HARIHARAN V',
    ROLE: 'Super Admin'
  },
  SHEET_NAMES: {
    USERS: 'USERS',
    SESSIONS: 'SESSIONS',
    PHASES: 'PHASES',
    QUIZZES: 'QUIZZES',
    QUESTIONS: 'QUESTIONS',
    ATTEMPTS: 'ATTEMPTS',
    ANSWERS: 'ANSWERS',
    RESULTS: 'RESULTS',
    PHASE_PROGRESS: 'PHASE_PROGRESS',
    CERTIFICATES: 'CERTIFICATES',
    EMAIL_LOG: 'EMAIL_LOG',
    AUDIT_LOG: 'AUDIT_LOG',
    APP_SETTINGS: 'APP_SETTINGS'
  },
  ROLES: {
    SUPER_ADMIN: 'super_admin',
    ADMIN: 'admin',
    COORDINATOR: 'coordinator',
    HOD: 'hod',
    STUDENT: 'student'
  },
  PRESET_LEADERSHIP: [
    {
      id: 'faculty-coordinator',
      role: 'Faculty Coordinator',
      name: 'Dr. R. MEENAL',
      department: 'EEE Faculty',
      suggestedRole: 'coordinator'
    },
    {
      id: 'hod-eee',
      role: 'Head of Department',
      name: 'Head of Department (EEE)',
      department: 'EEE Leadership',
      suggestedRole: 'hod'
    },
    {
      id: 'president',
      role: 'President',
      name: 'RAMANATHAN S',
      department: 'EEE Final Year',
      suggestedRole: 'admin'
    },
    {
      id: 'vice-president',
      role: 'Vice President',
      name: 'NANTHAKISHORE J',
      department: 'EEE Pre-Final Year',
      suggestedRole: 'admin'
    },
    {
      id: 'secretary',
      role: 'Secretary',
      name: 'VIMALA VARSHINI M',
      department: 'EEE Pre-Final Year',
      suggestedRole: 'admin'
    },
    {
      id: 'joint-secretary',
      role: 'Joint Secretary',
      name: 'GAYATHRI ARUMUGAM',
      department: 'EEE II Year',
      suggestedRole: 'admin'
    },
    {
      id: 'technical-lead',
      role: 'Technical Coordinator',
      name: 'HARIHARAN V',
      department: 'EEE II Year',
      suggestedRole: 'super_admin'
    },
    {
      id: 'event-lead',
      role: 'Event Coordinator',
      name: 'JEEVANANTHAM A',
      department: 'EEE II Year',
      suggestedRole: 'admin'
    },
    {
      id: 'media-lead',
      role: 'Publicity & Media Coordinator',
      name: 'KEERTHIVASAN A',
      department: 'EEE II Year',
      suggestedRole: 'admin'
    }
  ],
  INITIAL_TOPICS: [
    {
      order: 1,
      title: 'Fundamentals of embedded systems and their applications',
      description: 'Core concepts of embedded computing, architecture distinctions, real-time operating systems introduction, and modern industrial automation applications.',
      phase: 1
    },
    {
      order: 2,
      title: 'Microcontrollers, sensors, actuators, and embedded hardware components',
      description: 'Understanding MCU internals (GPIO, timers, ADC, DAC), active/passive transducers, analog and digital sensors, and drive circuits for actuators.',
      phase: 1
    },
    {
      order: 3,
      title: 'Embedded C and introductory embedded programming',
      description: 'Syntax, bitwise manipulation, memory-mapped I/O registers, interrupt service routines (ISR), and firmware structuring techniques.',
      phase: 2
    },
    {
      order: 4,
      title: 'Programming and interfacing input/output devices',
      description: 'Interfacing tactile switches, matrix keypads, 7-segment displays, alphanumeric LCDs, and OLED modules with debounce handling.',
      phase: 2
    },
    {
      order: 5,
      title: 'Basic hardware interfacing techniques using microcontrollers',
      description: 'Serial communication protocols (UART, I2C, SPI), PWM motor speed control, relay switching, and optocoupler isolation circuits.',
      phase: 2
    }
  ]
};

/**
 * Returns configuration properties stored in ScriptProperties
 */
function getAppProperty(key, defaultValue = '') {
  try {
    const props = PropertiesService.getScriptProperties();
    const val = props.getProperty(key);
    if (val !== null && val !== undefined && val !== '') return val;
    if (key === 'SPREADSHEET_ID') return DEFAULT_SPREADSHEET_ID;
    return defaultValue;
  } catch (e) {
    if (key === 'SPREADSHEET_ID') return DEFAULT_SPREADSHEET_ID;
    return defaultValue;
  }
}

/**
 * Sets configuration properties in ScriptProperties
 */
function setAppProperty(key, value) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty(key, String(value));
}

/**
 * Intelligently extracts clean Spreadsheet ID whether user pasted full URL or bare ID
 */
function extractSpreadsheetId_(input) {
  if (!input) return DEFAULT_SPREADSHEET_ID;
  const str = String(input).trim();
  const match = str.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return str || DEFAULT_SPREADSHEET_ID;
}

/**
 * Helper to get the bound or configured Google Spreadsheet instance
 * Auto-initializes sheets if USERS table is not present
 */
function getSpreadsheet(autoInit = true) {
  const rawId = getAppProperty('SPREADSHEET_ID');
  const customId = extractSpreadsheetId_(rawId);
  let ss = null;

  if (customId) {
    try {
      ss = SpreadsheetApp.openById(customId);
    } catch (e) {
      throw new Error('Could not open Spreadsheet with ID "' + customId + '". Ensure the sheet is shared or created in your SRM TRP Google account: ' + e.message);
    }
  } else {
    try {
      ss = SpreadsheetApp.getActiveSpreadsheet();
    } catch (e) {
      // Not container-bound
    }
  }

  if (!ss) {
    throw new Error('Spreadsheet ID is not configured. Please set SPREADSHEET_ID in Script Properties.');
  }

  // Auto-initialize if USERS sheet does not exist yet
  if (autoInit && typeof initDatabase === 'function') {
    try {
      if (!ss.getSheetByName(CONFIG.SHEET_NAMES.USERS)) {
        initDatabase(ss);
      }
    } catch (initErr) {
      console.warn('Auto-initialization notice: ' + initErr.message);
    }
  }

  return ss;
}


// =========================================================================
// SECTION: Auth.gs
// =========================================================================

/**
 * EMBEDX Authentication & Role-Based Access Control (RBAC)
 * Verifies Google Workspace Session Identity & Domain Authority
 */

/**
 * Normalizes an email address
 */
function normalizeEmail_(email) {
  return String(email || '').trim().toLowerCase();
}

/**
 * Checks if email ends with the verified institutional domain
 */
function isInstitutionalEmail_(email) {
  const norm = normalizeEmail_(email);
  return norm.endsWith(CONFIG.INSTITUTION.EMAIL_DOMAIN.toLowerCase());
}

/**
 * Retrieves the currently authenticated user session details
 */
function getCurrentUser_() {
  let email = '';
  try {
    email = Session.getActiveUser().getEmail();
  } catch (e) {
    email = '';
  }

  // Fallback for developmental / mock environments
  if (!email) {
    const devEmail = getAppProperty('DEV_MOCK_USER_EMAIL');
    if (devEmail) {
      email = devEmail;
    }
  }

  const normEmail = normalizeEmail_(email);
  const isDomainAuth = isInstitutionalEmail_(normEmail);
  const isSuper = (normEmail === normalizeEmail_(CONFIG.SUPER_ADMIN.EMAIL));

  let role = isSuper ? CONFIG.ROLES.SUPER_ADMIN : CONFIG.ROLES.STUDENT;

  // Check additional admins configured in ScriptProperties or USERS sheet
  if (!isSuper) {
    const adminCsv = getAppProperty('ADMIN_EMAILS', '');
    const adminList = adminCsv.split(',').map(normalizeEmail_).filter(Boolean);
    if (adminList.includes(normEmail)) {
      role = CONFIG.ROLES.ADMIN;
    } else {
      // Check role in USERS table if spreadsheet is available
      try {
        const userRec = findUserByEmail_(normEmail);
        if (userRec && [CONFIG.ROLES.ADMIN, CONFIG.ROLES.COORDINATOR, CONFIG.ROLES.HOD, CONFIG.ROLES.SUPER_ADMIN].includes(userRec.role)) {
          role = userRec.role;
        }
      } catch (err) {
        // Table not initialized yet
      }
    }
  }

  const isAdmin = (role === CONFIG.ROLES.SUPER_ADMIN || role === CONFIG.ROLES.ADMIN || role === CONFIG.ROLES.COORDINATOR || role === CONFIG.ROLES.HOD);

  return {
    email: normEmail,
    displayEmail: email,
    domainAuthorized: isDomainAuth,
    role: role,
    isSuperAdmin: isSuper,
    isAdmin: isAdmin,
    isStudent: !isAdmin
  };
}

/**
 * Guard: Enforces valid institutional authentication
 */
function requireAuthenticatedUser_() {
  const user = getCurrentUser_();
  if (!user.email) {
    throw new Error('AUTH_REQUIRED: You must be logged in with your SRM TRP Google Workspace account.');
  }
  if (!user.domainAuthorized && !user.isSuperAdmin) {
    throw new Error('ACCESS_DENIED: Only verified accounts ending with ' + CONFIG.INSTITUTION.EMAIL_DOMAIN + ' are authorized to access this platform. (Current: ' + user.email + ')');
  }
  return user;
}

/**
 * Guard: Enforces Administrator or Coordinator or HOD privileges
 */
function requireAdmin_() {
  const user = requireAuthenticatedUser_();
  if (!user.isAdmin) {
    throw new Error('FORBIDDEN: Administrative privileges required. Contact Super Admin ' + CONFIG.SUPER_ADMIN.EMAIL + ' for access.');
  }
  return user;
}

/**
 * Guard: Enforces Super Administrator privileges exclusively
 */
function requireSuperAdmin_() {
  const user = requireAuthenticatedUser_();
  if (!user.isSuperAdmin) {
    throw new Error('FORBIDDEN: Super Admin privileges required (' + CONFIG.SUPER_ADMIN.EMAIL + ').');
  }
  return user;
}

/**
 * Helper to find user in USERS sheet
 */
function findUserByEmail_(email) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.USERS);
    if (!sheet) return null;
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return null;

    const headers = data[0].map(h => String(h).trim().toLowerCase());
    const emailIdx = headers.indexOf('email');
    if (emailIdx === -1) return null;

    const normTarget = normalizeEmail_(email);
    for (let i = 1; i < data.length; i++) {
      if (normalizeEmail_(data[i][emailIdx]) === normTarget) {
        const obj = {};
        headers.forEach((h, idx) => {
          obj[h] = data[i][idx];
        });
        obj._rowIndex = i + 1;
        return obj;
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Super Admin function to assign an admin/coordinator/hod role to a user
 */
function assignAdminRole(email, role, displayName, department) {
  const superUser = requireSuperAdmin_();
  const targetEmail = normalizeEmail_(email);
  if (!isInstitutionalEmail_(targetEmail) && targetEmail !== normalizeEmail_(CONFIG.SUPER_ADMIN.EMAIL)) {
    throw new Error('Email must belong to ' + CONFIG.INSTITUTION.EMAIL_DOMAIN);
  }

  const allowedRoles = [CONFIG.ROLES.SUPER_ADMIN, CONFIG.ROLES.ADMIN, CONFIG.ROLES.COORDINATOR, CONFIG.ROLES.HOD, CONFIG.ROLES.STUDENT];
  if (!allowedRoles.includes(role)) {
    throw new Error('Invalid role specified: ' + role);
  }

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.USERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim().toLowerCase());
  const emailIdx = headers.indexOf('email');
  const roleIdx = headers.indexOf('role');
  const nameIdx = headers.indexOf('display_name');
  const deptIdx = headers.indexOf('department');

  let updated = false;
  for (let i = 1; i < data.length; i++) {
    if (normalizeEmail_(data[i][emailIdx]) === targetEmail) {
      if (roleIdx !== -1) sheet.getRange(i + 1, roleIdx + 1).setValue(role);
      if (nameIdx !== -1 && displayName) sheet.getRange(i + 1, nameIdx + 1).setValue(displayName);
      if (deptIdx !== -1 && department) sheet.getRange(i + 1, deptIdx + 1).setValue(department);
      updated = true;
      break;
    }
  }

  if (!updated) {
    // Insert new user record
    const newId = 'USR-' + Utilities.getUuid().substring(0, 8).toUpperCase();
    const now = new Date();
    sheet.appendRow([
      newId,
      targetEmail,
      displayName || targetEmail.split('@')[0],
      role,
      department || 'EEE',
      'Faculty / Leadership',
      now,
      now,
      'active'
    ]);
  }

  // Update ScriptProperties ADMIN_EMAILS cache
  const adminCsv = getAppProperty('ADMIN_EMAILS', '');
  const adminSet = new Set(adminCsv.split(',').map(normalizeEmail_).filter(Boolean));
  if ([CONFIG.ROLES.ADMIN, CONFIG.ROLES.COORDINATOR, CONFIG.ROLES.HOD, CONFIG.ROLES.SUPER_ADMIN].includes(role)) {
    adminSet.add(targetEmail);
  } else {
    adminSet.delete(targetEmail);
  }
  setAppProperty('ADMIN_EMAILS', Array.from(adminSet).join(','));

  // Log action
  logAuditAction_(superUser.email, 'ASSIGN_ROLE', 'USER', targetEmail, 'Assigned role: ' + role + ' (' + displayName + ')');

  return { success: true, message: 'Successfully updated role for ' + targetEmail + ' to ' + role };
}

/**
 * Super Admin function to list all configured administrators and team leaders
 */
function getAdminUsersList() {
  requireAdmin_();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.USERS);
  const data = sheet.getDataRange().getValues();
  const results = [];

  if (data.length > 1) {
    const headers = data[0].map(h => String(h).trim().toLowerCase());
    const emailIdx = headers.indexOf('email');
    const roleIdx = headers.indexOf('role');
    const nameIdx = headers.indexOf('display_name');
    const deptIdx = headers.indexOf('department');
    const statusIdx = headers.indexOf('status');

    for (let i = 1; i < data.length; i++) {
      const userRole = data[i][roleIdx];
      if ([CONFIG.ROLES.SUPER_ADMIN, CONFIG.ROLES.ADMIN, CONFIG.ROLES.COORDINATOR, CONFIG.ROLES.HOD].includes(userRole)) {
        results.push({
          email: data[i][emailIdx],
          name: data[i][nameIdx],
          role: userRole,
          department: data[i][deptIdx],
          status: data[i][statusIdx] || 'active',
          isSuperAdmin: (normalizeEmail_(data[i][emailIdx]) === normalizeEmail_(CONFIG.SUPER_ADMIN.EMAIL))
        });
      }
    }
  }

  // Ensure Super Admin is always present in list
  const hasSuper = results.some(r => normalizeEmail_(r.email) === normalizeEmail_(CONFIG.SUPER_ADMIN.EMAIL));
  if (!hasSuper) {
    results.unshift({
      email: CONFIG.SUPER_ADMIN.EMAIL,
      name: CONFIG.SUPER_ADMIN.NAME,
      role: CONFIG.ROLES.SUPER_ADMIN,
      department: 'EEE Department (Lead Architect)',
      status: 'active',
      isSuperAdmin: true
    });
  }

  return {
    superAdminEmail: CONFIG.SUPER_ADMIN.EMAIL,
    leadershipPresets: CONFIG.PRESET_LEADERSHIP,
    adminUsers: results
  };
}


// =========================================================================
// SECTION: Setup.gs
// =========================================================================

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


// =========================================================================
// SECTION: StudentService.gs
// =========================================================================

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


// =========================================================================
// SECTION: SessionService.gs
// =========================================================================

/**
 * EMBEDX Session Management Service
 * Provides Session Lifecycle, Reordering, and Association with Phases & Quizzes
 */

function getAllSessions() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.SESSIONS);
  const sessions = [];

  if (sheet && sheet.getLastRow() > 1) {
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim().toLowerCase());
    const idIdx = headers.indexOf('session_id');
    const orderIdx = headers.indexOf('session_order');
    const titleIdx = headers.indexOf('title');
    const descIdx = headers.indexOf('description');
    const outIdx = headers.indexOf('learning_outcomes');
    const phaseIdx = headers.indexOf('phase_id');
    const pubIdx = headers.indexOf('is_published');
    const createdIdx = headers.indexOf('created_at');

    for (let i = 1; i < data.length; i++) {
      sessions.push({
        id: data[i][idIdx],
        order: Number(data[i][orderIdx]) || 1,
        title: data[i][titleIdx],
        description: data[i][descIdx],
        learningOutcomes: data[i][outIdx],
        phaseId: data[i][phaseIdx],
        isPublished: (data[i][pubIdx] === true || String(data[i][pubIdx]).toLowerCase() === 'true'),
        createdAt: data[i][createdIdx]
      });
    }
    sessions.sort((a, b) => a.order - b.order);
  }

  return sessions;
}

function saveSession(sessionData) {
  const admin = requireAdmin_();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.SESSIONS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim().toLowerCase());
  const idIdx = headers.indexOf('session_id');
  const orderIdx = headers.indexOf('session_order');
  const titleIdx = headers.indexOf('title');
  const descIdx = headers.indexOf('description');
  const outIdx = headers.indexOf('learning_outcomes');
  const phaseIdx = headers.indexOf('phase_id');
  const pubIdx = headers.indexOf('is_published');

  const sessionId = sessionData.id || ('session-' + Utilities.getUuid().substring(0, 8));
  let existingRow = -1;

  for (let i = 1; i < data.length; i++) {
    if (data[i][idIdx] === sessionId) {
      existingRow = i + 1;
      break;
    }
  }

  const isPublished = sessionData.isPublished !== undefined ? sessionData.isPublished : true;
  const order = Number(sessionData.order) || 1;

  if (existingRow !== -1) {
    sheet.getRange(existingRow, orderIdx + 1).setValue(order);
    sheet.getRange(existingRow, titleIdx + 1).setValue(sessionData.title);
    sheet.getRange(existingRow, descIdx + 1).setValue(sessionData.description || '');
    sheet.getRange(existingRow, outIdx + 1).setValue(sessionData.learningOutcomes || '');
    sheet.getRange(existingRow, phaseIdx + 1).setValue(sessionData.phaseId || 'phase-1');
    sheet.getRange(existingRow, pubIdx + 1).setValue(isPublished);
    logAuditAction_(admin.email, 'UPDATE_SESSION', 'SESSION', sessionId, 'Updated session: ' + sessionData.title);
  } else {
    sheet.appendRow([
      sessionId,
      order,
      sessionData.title,
      sessionData.description || '',
      sessionData.learningOutcomes || '',
      sessionData.phaseId || 'phase-1',
      isPublished,
      new Date()
    ]);
    logAuditAction_(admin.email, 'CREATE_SESSION', 'SESSION', sessionId, 'Created session: ' + sessionData.title);
  }

  return { success: true, sessionId: sessionId };
}

function toggleSessionPublish(sessionId, isPublished) {
  const admin = requireAdmin_();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.SESSIONS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim().toLowerCase());
  const idIdx = headers.indexOf('session_id');
  const pubIdx = headers.indexOf('is_published');

  for (let i = 1; i < data.length; i++) {
    if (data[i][idIdx] === sessionId) {
      sheet.getRange(i + 1, pubIdx + 1).setValue(isPublished);
      logAuditAction_(admin.email, 'TOGGLE_SESSION_PUBLISH', 'SESSION', sessionId, 'Set is_published to ' + isPublished);
      return { success: true };
    }
  }
  throw new Error('Session not found: ' + sessionId);
}


// =========================================================================
// SECTION: PhaseService.gs
// =========================================================================

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


// =========================================================================
// SECTION: QuizService.gs
// =========================================================================

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


// =========================================================================
// SECTION: LeaderboardService.gs
// =========================================================================

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


// =========================================================================
// SECTION: AdminService.gs
// =========================================================================

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


// =========================================================================
// SECTION: CertificateService.gs
// =========================================================================

/**
 * EMBEDX Certificate Generation & Verification Engine
 * Strictly Gated by Phase 2 Completion, Idempotent, and Slides-to-PDF Driven
 */

/**
 * Checks existing certificate record or eligibility
 */
function getStudentCertificate_(studentId, isPhase2Completed) {
  const ss = getSpreadsheet();
  const certsSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CERTIFICATES);

  if (certsSheet && certsSheet.getLastRow() > 1) {
    const data = certsSheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim().toLowerCase());
    const cIdIdx = headers.indexOf('certificate_id');
    const sIdIdx = headers.indexOf('student_id');
    const fileIdIdx = headers.indexOf('drive_file_id');
    const pdfUrlIdx = headers.indexOf('pdf_url');
    const issuedAtIdx = headers.indexOf('issued_at');
    const statusIdx = headers.indexOf('status');

    for (let i = 1; i < data.length; i++) {
      if (data[i][sIdIdx] === studentId && data[i][statusIdx] === 'issued') {
        const issuedDate = data[i][issuedAtIdx];
        return {
          eligible: true,
          issued: true,
          certificateId: data[i][cIdIdx],
          driveFileId: data[i][fileIdIdx],
          pdfUrl: data[i][pdfUrlIdx],
          issuedAt: issuedDate instanceof Date ? Utilities.formatDate(issuedDate, CONFIG.EVENT.TIMEZONE, 'dd MMMM yyyy') : String(issuedDate)
        };
      }
    }
  }

  return {
    eligible: Boolean(isPhase2Completed),
    issued: false,
    certificateId: null,
    driveFileId: null,
    pdfUrl: null,
    issuedAt: null
  };
}

/**
 * Generates an official Certificate of Completion upon verified Phase 2 completion
 */
function generateCertificateForStudent(targetStudentId) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (e) {
    throw new Error('Server busy generating certificates. Please retry in a few seconds.');
  }

  try {
    const user = requireAuthenticatedUser_();
    const profile = getOrCreateStudentProfile_(user);
    const ss = getSpreadsheet();

    const studentId = (user.isAdmin && targetStudentId) ? targetStudentId : profile.id;
    const studentUser = findUserById_(studentId) || profile;

    // 1. Strict Phase 2 Prerequisite Check
    const dashData = getStudentDashboardData();
    if (!dashData.phaseProgress.phase2.completed && !user.isAdmin) {
      throw new Error('ELIGIBILITY_FAILED: Certificate generation requires 100% verified completion of Phase 2 requirements.');
    }

    // 2. Idempotency Check: Return existing if already issued
    const certsSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CERTIFICATES);
    const existingCert = getStudentCertificate_(studentId, true);
    if (existingCert.issued && existingCert.certificateId) {
      return {
        success: true,
        alreadyIssued: true,
        certificate: existingCert
      };
    }

    // 3. Prepare Template Placeholders
    const certId = 'EMBEDX-2026-' + Utilities.getUuid().substring(0, 8).toUpperCase();
    const issueDateStr = Utilities.formatDate(new Date(), CONFIG.EVENT.TIMEZONE, '30 October 2026');
    const studentName = studentUser.displayName || studentUser.name || 'Student Contender';

    const templateId = getAppProperty('SLIDES_TEMPLATE_ID');
    const folderId = getAppProperty('CERTIFICATE_FOLDER_ID');

    let pdfFileUrl = '';
    let driveFileId = '';

    if (templateId) {
      try {
        // Copy Slides Template
        const templateFile = DriveApp.getFileById(templateId);
        let destinationFolder = DriveApp.getRootFolder();
        if (folderId) {
          try {
            destinationFolder = DriveApp.getFolderById(folderId);
          } catch (e) {
            console.warn('Configured folder not accessible, using Drive root: ' + e.message);
          }
        }

        const copyName = 'EMBEDX_Certificate_' + studentId + '_' + certId;
        const copiedFile = templateFile.makeCopy(copyName, destinationFolder);
        const presentation = SlidesApp.openById(copiedFile.getId());
        const slides = presentation.getSlides();

        // Replace Placeholders on all slides
        const placeholders = {
          '{{STUDENT_NAME}}': studentName,
          '{{WORKSHOP_TITLE}}': CONFIG.EVENT.TITLE,
          '{{ISSUE_DATE}}': issueDateStr,
          '{{CERTIFICATE_ID}}': certId,
          '{{INSTITUTION_NAME}}': CONFIG.INSTITUTION.NAME,
          '{{CLUB_NAME}}': CONFIG.INSTITUTION.CLUB,
          '{{DEPARTMENT}}': CONFIG.INSTITUTION.DEPARTMENT
        };

        slides.forEach(slide => {
          for (const [findStr, repStr] of Object.entries(placeholders)) {
            slide.replaceAllText(findStr, repStr);
          }
        });

        presentation.saveAndClose();

        // Convert to PDF
        const pdfBlob = copiedFile.getAs('application/pdf');
        pdfBlob.setName(copyName + '.pdf');
        const pdfFile = destinationFolder.createFile(pdfBlob);

        // Security: Remove temporary slide copy
        copiedFile.setTrashed(true);

        driveFileId = pdfFile.getId();
        pdfFileUrl = pdfFile.getUrl();

        // Restrict access directly to student
        try {
          pdfFile.addViewer(studentUser.email);
        } catch (permErr) {
          console.warn('Could not add direct viewer permission: ' + permErr.message);
        }

      } catch (slidesErr) {
        console.error('Google Slides error: ' + slidesErr.message);
        // Fallback for development if template ID is not yet connected by admin
        driveFileId = 'DEV-PLACEHOLDER-' + certId;
        pdfFileUrl = '#certificate-preview-' + certId;
      }
    } else {
      // Slides Template ID not configured yet in ScriptProperties
      driveFileId = 'DEV-MOCK-DRIVE-ID';
      pdfFileUrl = '#certificate-ready-' + certId;
    }

    // 4. Save Record in CERTIFICATES sheet
    const now = new Date();
    certsSheet.appendRow([
      certId,
      studentId,
      'EMBEDX-WORKSHOP-2026',
      templateId || 'DEFAULT_SLIDES_V1',
      driveFileId,
      pdfFileUrl,
      now,
      'issued',
      '' // revoked_at
    ]);

    // 5. Log Audit Trail
    logAuditAction_(user.email, 'ISSUE_CERTIFICATE', 'CERTIFICATE', certId, 'Issued to ' + studentUser.email + ' (' + studentName + ')');

    // 6. Queue Certificate Notification
    try {
      queueNotification_('CERTIFICATE_ISSUED', studentUser.email, studentId, certId, {
        studentName: studentName,
        certificateId: certId,
        pdfUrl: pdfFileUrl
      });
    } catch (e) {
      console.warn('Certificate email queue skipped: ' + e.message);
    }

    return {
      success: true,
      alreadyIssued: false,
      certificate: {
        certificateId: certId,
        pdfUrl: pdfFileUrl,
        driveFileId: driveFileId,
        issuedAt: Utilities.formatDate(now, CONFIG.EVENT.TIMEZONE, 'dd MMMM yyyy')
      }
    };
  } finally {
    lock.releaseLock();
  }
}

function findUserById_(id) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.USERS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim().toLowerCase());
    const idIdx = headers.indexOf('student_id');
    const emailIdx = headers.indexOf('email');
    const nameIdx = headers.indexOf('display_name');

    for (let i = 1; i < data.length; i++) {
      if (data[i][idIdx] === id) {
        return {
          id: id,
          email: data[i][emailIdx],
          name: data[i][nameIdx],
          displayName: data[i][nameIdx]
        };
      }
    }
  } catch (e) {
    return null;
  }
  return null;
}


// =========================================================================
// SECTION: EmailService.gs
// =========================================================================

/**
 * EMBEDX Notification Engine & Safe Email Dispatcher
 * Prevents Accidental Mass Emails, Enforces Dry-Run Safety, and Manages Retries
 */

/**
 * Queues a notification and dispatches if enabled
 */
function queueNotification_(eventType, recipientEmail, studentId, relatedId, templateVars) {
  const ss = getSpreadsheet();
  const logSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.EMAIL_LOG);
  const now = new Date();
  const logId = 'EML-' + Utilities.getUuid().substring(0, 8).toUpperCase();

  // 1. Idempotency Check: Prevent duplicate email events
  if (logSheet && logSheet.getLastRow() > 1) {
    const data = logSheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim().toLowerCase());
    const eventIdx = headers.indexOf('event_type');
    const recIdx = headers.indexOf('recipient_email');
    const relIdx = headers.indexOf('related_id');
    const statIdx = headers.indexOf('status');

    for (let i = 1; i < data.length; i++) {
      if (data[i][eventIdx] === eventType && data[i][recIdx] === recipientEmail && data[i][relIdx] === relatedId) {
        if (['sent', 'dry_run_simulated'].includes(data[i][statIdx])) {
          console.log('Skipping duplicate notification for: ' + recipientEmail + ' (' + eventType + ')');
          return { skipped: true, reason: 'DUPLICATE_EVENT' };
        }
      }
    }
  }

  // 2. Check DRY_RUN_MODE setting
  const dryRunSetting = getAppProperty('DRY_RUN_MODE', 'true');
  const isDryRun = (dryRunSetting === 'true' || dryRunSetting === true);

  if (isDryRun) {
    logSheet.appendRow([
      logId,
      eventType,
      recipientEmail,
      studentId,
      relatedId,
      'dry_run_simulated',
      'Dry run mode enabled. No external email dispatched.',
      now,
      0
    ]);
    return { success: true, dryRun: true, logId: logId };
  }

  // 3. Dispatch Live Email via MailApp
  try {
    const quota = MailApp.getRemainingDailyQuota();
    if (quota <= 5) {
      throw new Error('Daily email quota low (' + quota + ' remaining). Send suspended.');
    }

    const emailContent = renderEmailTemplate_(eventType, templateVars);
    MailApp.sendEmail({
      to: recipientEmail,
      subject: emailContent.subject,
      htmlBody: emailContent.htmlBody,
      name: 'EMBEDX – SRM TRP Engineering College'
    });

    logSheet.appendRow([
      logId,
      eventType,
      recipientEmail,
      studentId,
      relatedId,
      'sent',
      '',
      now,
      1
    ]);

    return { success: true, dryRun: false, logId: logId };
  } catch (err) {
    console.error('Mail dispatch failed: ' + err.message);
    logSheet.appendRow([
      logId,
      eventType,
      recipientEmail,
      studentId,
      relatedId,
      'failed',
      err.message,
      now,
      1
    ]);
    return { success: false, error: err.message };
  }
}

/**
 * Builds branded responsive HTML email templates matching EMBEDX theme
 */
function renderEmailTemplate_(eventType, vars) {
  const brandHeader = `
    <div style="background-color: #071C4B; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
      <h2 style="color: #FFFFFF; margin: 0; font-family: sans-serif; letter-spacing: 1px;">EMBED<span style="color: #146B3A;">X</span></h2>
      <p style="color: #00D2FF; margin: 4px 0 0 0; font-size: 13px; font-family: sans-serif;">SRM TRP Engineering College &bull; EEE Department</p>
    </div>
  `;

  const brandFooter = `
    <div style="background-color: #F5F8FC; padding: 18px; text-align: center; font-size: 12px; color: #617086; font-family: sans-serif; border-radius: 0 0 8px 8px; border-top: 1px solid #EDF3FA;">
      <p style="margin: 0;">Workshop: Basics of Embedded Systems and Embedded Programming Language</p>
      <p style="margin: 4px 0 0 0;">30 October 2026 &bull; 5th Floor, CSE Seminar Hall</p>
    </div>
  `;

  let subject = 'EMBEDX Workshop Update';
  let bodyContent = '';

  switch (eventType) {
    case 'QUIZ_COMPLETION':
      subject = '[EMBEDX] Quiz Attempt Scored: ' + (vars.quizTitle || 'Embedded Systems Assessment');
      bodyContent = `
        <h3 style="color: #0B2A6F; margin-top: 0;">Quiz Results</h3>
        <p>Your attempt for <strong>${vars.quizTitle || 'Assessment'}</strong> has been evaluated.</p>
        <div style="background: #F5F8FC; padding: 16px; border-radius: 6px; margin: 16px 0; border-left: 4px solid #146B3A;">
          <p style="margin: 0 0 8px 0;"><strong>Score:</strong> ${vars.score} / ${vars.totalPossible} (${vars.percentage}%)</p>
          <p style="margin: 0;"><strong>Status:</strong> ${vars.passed ? '<span style="color:#146B3A; font-weight:bold;">PASSED</span>' : '<span style="color:#D32F2F; font-weight:bold;">ATTEMPT LOGGED</span>'}</p>
        </div>
        <p>Check the live leaderboard and your Phase progress in the EMBEDX Quiz Portal.</p>
      `;
      break;

    case 'PHASE_1_COMPLETION':
      subject = '[EMBEDX] Congratulations! You Completed Phase 1 (Foundations)';
      bodyContent = `
        <h3 style="color: #0B2A6F; margin-top: 0;">Phase 1 Milestone Achieved!</h3>
        <p>Dear ${vars.studentName || 'Student'},</p>
        <p>You have successfully passed the foundational assessments covering Embedded System Architectures, Microcontrollers, and Component Interfacing.</p>
        <p><strong>Phase 2 is now unlocked on your dashboard.</strong> Proceed to the hands-on Embedded C and protocol modules.</p>
      `;
      break;

    case 'PHASE_2_COMPLETION':
      subject = '[EMBEDX] Outstanding! Phase 2 Completed — Certificate Eligible';
      bodyContent = `
        <h3 style="color: #0B2A6F; margin-top: 0;">Phase 2 Mastery Achieved!</h3>
        <p>Dear ${vars.studentName || 'Student'},</p>
        <p>You have satisfied all requirements for <strong>Phase 2: Embedded C, Device Interfacing & Firmware Engineering</strong>.</p>
        <p>Your official Certificate of Completion is now eligible for generation and download via your dashboard.</p>
      `;
      break;

    case 'CERTIFICATE_ISSUED':
      subject = '[EMBEDX] Official Certificate of Completion — EMBEDX 2026';
      bodyContent = `
        <h3 style="color: #0B2A6F; margin-top: 0;">Certificate of Completion Issued</h3>
        <p>Dear ${vars.studentName || 'Contender'},</p>
        <p>Congratulations! Your verified Certificate of Completion for the <strong>Basics of Embedded Systems and Embedded Programming Language</strong> workshop is now ready.</p>
        <div style="background: #F5F8FC; padding: 16px; border-radius: 6px; margin: 16px 0;">
          <p style="margin: 0 0 6px 0;"><strong>Certificate ID:</strong> ${vars.certificateId}</p>
          <p style="margin: 0 0 12px 0;"><strong>Issue Date:</strong> 30 October 2026</p>
          <a href="${vars.pdfUrl}" target="_blank" style="display: inline-block; background-color: #146B3A; color: #FFFFFF; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">View Certificate PDF</a>
        </div>
      `;
      break;

    default:
      bodyContent = '<p>' + JSON.stringify(vars) + '</p>';
  }

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden; background: #FFFFFF;">
      ${brandHeader}
      <div style="padding: 24px; color: #152238; line-height: 1.6;">
        ${bodyContent}
      </div>
      ${brandFooter}
    </div>
  `;

  return {
    subject: subject,
    htmlBody: htmlBody
  };
}


// =========================================================================
// SECTION: AuditService.gs
// =========================================================================

/**
 * EMBEDX Administrative Audit Trail Service
 * Records Immutable Audit Logs for Role Assignments, Quiz Mutations, and Certificates
 */

function logAuditAction_(actorEmail, actionType, targetEntity, targetId, details) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.AUDIT_LOG);
    if (!sheet) return;

    const logId = 'AUD-' + Utilities.getUuid().substring(0, 8).toUpperCase();
    const now = new Date();

    sheet.appendRow([
      logId,
      actorEmail || 'SYSTEM',
      actionType,
      targetEntity,
      targetId,
      details,
      now
    ]);
  } catch (e) {
    console.warn('Audit log write error: ' + e.message);
  }
}

function getAuditLogs(limit = 100) {
  requireAdmin_();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.AUDIT_LOG);
  const logs = [];

  if (sheet && sheet.getLastRow() > 1) {
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim().toLowerCase());
    const idIdx = headers.indexOf('log_id');
    const actorIdx = headers.indexOf('actor_email');
    const actionIdx = headers.indexOf('action_type');
    const entityIdx = headers.indexOf('target_entity');
    const targetIdx = headers.indexOf('target_id');
    const detailsIdx = headers.indexOf('details');
    const timeIdx = headers.indexOf('timestamp');

    for (let i = data.length - 1; i >= 1 && logs.length < limit; i--) {
      const ts = data[i][timeIdx];
      logs.push({
        id: data[i][idIdx],
        actor: data[i][actorIdx],
        action: data[i][actionIdx],
        entity: data[i][entityIdx],
        targetId: data[i][targetIdx],
        details: data[i][detailsIdx],
        timestamp: ts instanceof Date ? Utilities.formatDate(ts, CONFIG.EVENT.TIMEZONE, 'dd MMM yyyy, HH:mm:ss') : String(ts)
      });
    }
  }

  return logs;
}


// =========================================================================
// SECTION: Code.gs
// =========================================================================

/**
 * EMBEDX – Embedded Systems & Automation Club
 * Main Web App Routing, RPC Dispatch, and HTML Service Orchestrator
 * SRM TRP Engineering College, Tiruchirappalli
 */

function doGet(e) {
  // 1. JSON API endpoint for Live Leaderboard
  if (e && e.parameter && (e.parameter.action === 'getLeaderboard' || e.parameter.api === 'leaderboard')) {
    try {
      var ss = getSpreadsheet();
      var subSheet = ss.getSheetByName('SUBMISSIONS_LOG');
      if (!subSheet || subSheet.getLastRow() <= 1) {
        return ContentService.createTextOutput(JSON.stringify({ success: true, leaderboard: [] }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var data = subSheet.getDataRange().getValues();
      var rows = data.slice(1);
      var studentMap = {};
      rows.forEach(function(r) {
        var email = String(r[2] || '').toLowerCase().trim();
        var name = String(r[3] || '').toUpperCase().trim();
        var year = String(r[4] || 'I Year');
        var dept = String(r[5] || 'EEE');
        var score = Number(r[7]) || 0;
        var passed = (r[10] === true || String(r[10]).toLowerCase() === 'true');

        if (email) {
          if (!studentMap[email]) {
            studentMap[email] = { name: name, email: email, year: year, dept: dept, totalScore: 0, passedCount: 0 };
          }
          studentMap[email].totalScore += score;
          if (passed) studentMap[email].passedCount += 1;
        }
      });
      var leaderboard = Object.values(studentMap).sort(function(a, b) { return b.totalScore - a.totalScore; });
      return ContentService.createTextOutput(JSON.stringify({ success: true, leaderboard: leaderboard }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message, leaderboard: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  // 2. JSON API endpoint for Live Workshop Settings
  if (e && e.parameter && e.parameter.action === 'getWorkshopSettings') {
    try {
      var props = PropertiesService.getScriptProperties();
      var p1 = props.getProperty('PHASE_1_ACTIVE');
      var p2 = props.getProperty('PHASE_2_ACTIVE');
      var dur = props.getProperty('QUIZ_DURATION');
      var bcast = props.getProperty('BROADCAST_MSG');

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        phase1Active: p1 !== null ? (p1 === 'true') : true,
        phase2Active: p2 !== null ? (p2 === 'true') : false,
        quizDurationMinutes: dur ? Number(dur) : 15,
        broadcastMsg: bcast || ''
      })).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        phase1Active: true,
        phase2Active: false,
        quizDurationMinutes: 15,
        broadcastMsg: ''
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  // 3. JSON API endpoint for Live Proctoring Logs & Admin Submissions
  if (e && e.parameter && e.parameter.action === 'getAdminData') {
    try {
      var ss = getSpreadsheet();
      var subSheet = ss.getSheetByName('SUBMISSIONS_LOG');
      var regSheet = ss.getSheetByName('REGISTERED_STUDENTS');

      var regCount = (regSheet && regSheet.getLastRow() > 1) ? regSheet.getLastRow() - 1 : 0;
      var submissions = [];
      var violations = [];

      if (subSheet && subSheet.getLastRow() > 1) {
        var sData = subSheet.getDataRange().getValues().slice(1);
        sData.forEach(function(row) {
          var item = {
            timestamp: row[0],
            student_email: row[2],
            student_name: row[3],
            year: row[4],
            dept: row[5],
            quiz_id: row[6],
            score: row[7],
            total: row[8],
            passed: row[10],
            violations_count: row[11],
            proctoring_status: row[12],
            proctoring_events: row[13]
          };
          submissions.push(item);
          if (Number(row[11]) > 0 || row[12] === 'FLAGGED' || row[12] === 'TERMINATED') {
            violations.push(item);
          }
        });
      }

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        registeredCount: regCount,
        submissions: submissions,
        violations: violations
      })).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

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

    // 0. Update Workshop Live Settings from Admin
    if (postData.action === 'updateWorkshopSettings') {
      try {
        var props = PropertiesService.getScriptProperties();
        if (postData.phase1Active !== undefined) props.setProperty('PHASE_1_ACTIVE', String(postData.phase1Active));
        if (postData.phase2Active !== undefined) props.setProperty('PHASE_2_ACTIVE', String(postData.phase2Active));
        if (postData.quizDurationMinutes !== undefined) props.setProperty('QUIZ_DURATION', String(postData.quizDurationMinutes));
        if (postData.broadcastMsg !== undefined) props.setProperty('BROADCAST_MSG', String(postData.broadcastMsg));

        return ContentService.createTextOutput(JSON.stringify({ success: true, message: 'Settings Updated' }))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

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

    // 2. Student Registration Intake
    if (postData.action === 'registerStudent' || postData.type === 'registration') {
      var regSheet = ss.getSheetByName('REGISTERED_STUDENTS');
      if (!regSheet) {
        regSheet = ss.insertSheet('REGISTERED_STUDENTS');
        regSheet.appendRow(['timestamp', 'student_name', 'student_email', 'year', 'department']);
      }
      regSheet.appendRow([
        new Date(),
        (postData.name || postData.student_name || '').toUpperCase(),
        (postData.email || postData.student_email || '').toLowerCase(),
        postData.year || 'I Year',
        postData.department || postData.dept || 'EEE'
      ]);
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: 'Student Registered' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 3. Direct Quiz Conduction & Proctoring Report Ingestion
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
