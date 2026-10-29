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
