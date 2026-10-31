import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';

function str(key: string, fallback = ''): string {
  const v = process.env[key];
  return v === undefined || v === '' ? fallback : v;
}

function bool(key: string, fallback = false): boolean {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
}

function int(key: string, fallback: number): number {
  const v = Number(process.env[key]);
  return Number.isFinite(v) ? v : fallback;
}

const ROOT = path.resolve(process.cwd());
const DATA_DIR = path.resolve(ROOT, str('DATA_DIR', './data'));

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

export type GoogleProviderMode = 'mock' | 'apps_script' | 'google_api';

export const env = {
  nodeEnv: str('NODE_ENV', 'development'),
  isProduction: str('NODE_ENV', 'development') === 'production',
  port: int('PORT', 4000),
  appBaseUrl: str('APP_BASE_URL', `http://localhost:${int('PORT', 4000)}`).replace(/\/$/, ''),
  timezone: str('APP_TIMEZONE', 'Asia/Kolkata'),
  dataDir: DATA_DIR,
  databasePath: path.resolve(ROOT, str('DATABASE_PATH', path.join(DATA_DIR, 'quiz.db'))),
  sessionSecret: str('SESSION_SECRET', 'dev-only-insecure-session-secret-change-me-please'),
  sessionHours: int('SESSION_HOURS', 12),
  admin: {
    email: str('ADMIN_EMAIL', 'admin@example.com').toLowerCase(),
    name: str('ADMIN_NAME', 'Platform Administrator'),
    password: str('ADMIN_PASSWORD', 'ChangeMe!2026'),
    role: str('ADMIN_ROLE', 'super_admin'),
  },
  google: {
    provider: str('GOOGLE_PROVIDER', 'mock') as GoogleProviderMode,
    webhookUrl: str('APPS_SCRIPT_WEBHOOK_URL'),
    sharedSecret: str('APPS_SCRIPT_SHARED_SECRET'),
    serviceAccountFile: str('GOOGLE_SERVICE_ACCOUNT_FILE'),
    impersonateEmail: str('GOOGLE_IMPERSONATE_EMAIL'),
    oauthClientId: str('GOOGLE_OAUTH_CLIENT_ID'),
    oauthClientSecret: str('GOOGLE_OAUTH_CLIENT_SECRET'),
    oauthRefreshToken: str('GOOGLE_OAUTH_REFRESH_TOKEN'),
    dryRun: bool('DRY_RUN', false),
  },
  workspace: {
    spreadsheetId: str('GOOGLE_SPREADSHEET_ID', '1jiVDFpIxGwfSlHBt3vaHl-5GFd8DPGapSS4tsR-FhJQ'),
    responsesTab: str('SHEET_RESPONSES_TAB', 'Form Responses 1'),
    resultsTab: str('SHEET_RESULTS_TAB', 'Quiz Results'),
    logTab: str('SHEET_LOG_TAB', 'Logs'),
    templateId: str('CERT_TEMPLATE_ID', '1dkfJ6PQtmeDEkcNR4xJWsWrLjSu5pkAnvY3JY44_ISo'),
    outputFolderId: str('CERT_OUTPUT_FOLDER_ID', '1SDdCpIQHvf_WP0o9vC0ZrLHEb9vt0Q6Y'),
    certificatePrefix: str('CERT_PREFIX', 'SRMTRP/EEE/VAC/'),
    certificateYear: int('CERT_YEAR', new Date().getFullYear() + 1),
    certificateStartNumber: int('CERT_START_NUMBER', 1),
    verifyBaseUrl: str('CERT_VERIFY_BASE_URL', `${str('APP_BASE_URL', 'http://localhost:4000')}/verify`),
    emailFrom: str('CERT_EMAIL_FROM', str('ADMIN_EMAIL', 'admin@example.com')),
    emailFromName: str('CERT_EMAIL_FROM_NAME', 'SRM TRP Engineering College'),
  },
  firebase: {
    /**
     * cookie   -> the platform's own scrypt + signed-cookie sessions (default, works offline)
     * firebase -> verify Firebase ID tokens on every admin request (email/password, Google, phone)
     */
    mode: (str('AUTH_MODE', 'cookie') === 'firebase' ? 'firebase' : 'cookie') as 'cookie' | 'firebase',
    projectId: str('FIREBASE_PROJECT_ID', 'embedx-assessment'),
    // Public web-app identifiers (safe to ship to the browser; access is governed by rules + claims).
    web: {
      apiKey: str('FIREBASE_API_KEY', 'AIzaSyACO6JtEgvD_n5m5haPV-0y91Z76UI9C18'),
      authDomain: str('FIREBASE_AUTH_DOMAIN', 'embedx-assessment.firebaseapp.com'),
      projectId: str('FIREBASE_PROJECT_ID', 'embedx-assessment'),
      storageBucket: str('FIREBASE_STORAGE_BUCKET', 'embedx-assessment.firebasestorage.app'),
      messagingSenderId: str('FIREBASE_MESSAGING_SENDER_ID', '803481654330'),
      appId: str('FIREBASE_APP_ID', '1:803481654330:web:3bd07cd5cf42c4de1e5103'),
      measurementId: str('FIREBASE_MEASUREMENT_ID', 'G-S94VH65XXC'),
    },
    // Server-side credentials. Either the JSON itself (secret manager) or a file path.
    serviceAccountJson: str('FIREBASE_SERVICE_ACCOUNT_JSON', ''),
    serviceAccountFile: str('FIREBASE_SERVICE_ACCOUNT_FILE', ''),
    /** Mirror domain records into Firestore so the project's database stays in sync. */
    mirror: bool('FIRESTORE_MIRROR', false),
  },
  email: {
    testMode: bool('EMAIL_TEST_MODE', true),
    redirectTo: str('EMAIL_REDIRECT_TO', str('ADMIN_EMAIL', 'admin@example.com')),
  },
  certDir: path.join(DATA_DIR, 'certificates'),
  uploadsDir: path.join(DATA_DIR, 'uploads'),
};

for (const dir of [env.certDir, env.uploadsDir]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

if (env.sessionSecret.includes('dev-only-insecure') && env.isProduction) {
  throw new Error('SESSION_SECRET must be set to a strong random value in production.');
}
