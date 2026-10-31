import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { env } from './env.js';

export interface SqlStatement {
  // node:sqlite returns untyped rows; the domain layer supplies the concrete types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(...params: unknown[]): any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  all(...params: unknown[]): any[];
  run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
}

export interface SqliteDb {
  prepare(sql: string): SqlStatement;
  exec(sql: string): void;
}

let db: DatabaseSync;

export function getDb(): SqliteDb {
  if (!db) {
    const dir = path.dirname(env.databasePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    db = new DatabaseSync(env.databasePath);
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec('PRAGMA busy_timeout = 5000;');
    migrate(db);
  }
  return db as unknown as SqliteDb;
}

/** Opens a throw-away in-memory database (used by the integration test suite). */
export function createTestDb(): SqliteDb {
  const testDb = new DatabaseSync(':memory:');
  testDb.exec('PRAGMA foreign_keys = ON;');
  migrate(testDb);
  return testDb as unknown as SqliteDb;
}

export function setDb(next: SqliteDb | DatabaseSync): void {
  db = next as DatabaseSync;
}

const SCHEMA_VERSION = 1;

function migrate(database: DatabaseSync): void {
  const row = database.prepare('PRAGMA user_version').get() as { user_version: number } | undefined;
  const current = row?.user_version ?? 0;
  if (current >= SCHEMA_VERSION) return;

  database.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'quiz_host',
      password_hash TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked INTEGER NOT NULL DEFAULT 0,
      ip TEXT,
      user_agent TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id TEXT,
      actor_email TEXT,
      action TEXT NOT NULL,
      entity TEXT,
      entity_id TEXT,
      detail TEXT,
      ip TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);

    CREATE TABLE IF NOT EXISTS registration_fields (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'text',
      required INTEGER NOT NULL DEFAULT 1,
      enabled INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      pattern TEXT,
      pattern_hint TEXT,
      options TEXT,
      maps_to_sheet_column TEXT,
      maps_to_placeholder TEXT,
      is_core INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS quizzes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      instructions TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      start_at TEXT,
      end_at TEXT,
      duration_minutes INTEGER NOT NULL DEFAULT 15,
      pass_percentage REAL NOT NULL DEFAULT 40,
      max_attempts INTEGER NOT NULL DEFAULT 1,
      shuffle_questions INTEGER NOT NULL DEFAULT 0,
      shuffle_options INTEGER NOT NULL DEFAULT 0,
      random_question_count INTEGER,
      negative_marking INTEGER NOT NULL DEFAULT 0,
      result_visibility TEXT NOT NULL DEFAULT 'after_end',
      certificate_rule TEXT NOT NULL DEFAULT 'pass',
      certificate_min_score REAL NOT NULL DEFAULT 0,
      cert_course_name TEXT,
      cert_conducted_by TEXT,
      cert_duration TEXT,
      auto_email INTEGER NOT NULL DEFAULT 1,
      email_subject TEXT,
      email_body TEXT,
      cert_folder_id TEXT,
      join_code TEXT NOT NULL UNIQUE,
      allow_registration INTEGER NOT NULL DEFAULT 1,
      allowed_email_domain TEXT,
      allowed_departments TEXT,
      announcement TEXT,
      violation_warn_after INTEGER NOT NULL DEFAULT 1,
      violation_auto_submit_count INTEGER NOT NULL DEFAULT 3,
      timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      published_at TEXT,
      archived_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_quizzes_status ON quizzes(status);

    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'single',
      marks REAL NOT NULL DEFAULT 1,
      negative_marks REAL NOT NULL DEFAULT 0,
      difficulty TEXT NOT NULL DEFAULT 'medium',
      explanation TEXT,
      image_url TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_questions_quiz ON questions(quiz_id, sort_order);

    CREATE TABLE IF NOT EXISTS question_options (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      text TEXT NOT NULL,
      is_correct INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_options_question ON question_options(question_id, sort_order);

    CREATE TABLE IF NOT EXISTS participants (
      id TEXT PRIMARY KEY,
      quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      reg_number TEXT,
      department TEXT,
      extra TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(quiz_id, email)
    );
    CREATE INDEX IF NOT EXISTS idx_participants_quiz ON participants(quiz_id);

    CREATE TABLE IF NOT EXISTS attempts (
      id TEXT PRIMARY KEY,
      quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
      attempt_no INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'in_progress',
      started_at TEXT NOT NULL,
      deadline_at TEXT NOT NULL,
      submitted_at TEXT,
      total_marks REAL NOT NULL DEFAULT 0,
      score REAL NOT NULL DEFAULT 0,
      percentage REAL NOT NULL DEFAULT 0,
      passed INTEGER NOT NULL DEFAULT 0,
      question_order TEXT,
      option_order TEXT,
      violations_count INTEGER NOT NULL DEFAULT 0,
      auto_submitted INTEGER NOT NULL DEFAULT 0,
      ip TEXT,
      user_agent TEXT,
      duration_seconds INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(quiz_id, participant_id, attempt_no)
    );
    CREATE INDEX IF NOT EXISTS idx_attempts_quiz ON attempts(quiz_id, status);
    CREATE INDEX IF NOT EXISTS idx_attempts_participant ON attempts(participant_id);

    CREATE TABLE IF NOT EXISTS attempt_answers (
      id TEXT PRIMARY KEY,
      attempt_id TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
      question_id TEXT NOT NULL,
      selected_options TEXT NOT NULL DEFAULT '[]',
      is_correct INTEGER,
      marks_awarded REAL,
      marked_for_review INTEGER NOT NULL DEFAULT 0,
      saved_at TEXT NOT NULL,
      UNIQUE(attempt_id, question_id)
    );

    CREATE TABLE IF NOT EXISTS violations (
      id TEXT PRIMARY KEY,
      attempt_id TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
      quiz_id TEXT NOT NULL,
      participant_id TEXT NOT NULL,
      type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'warning',
      metadata TEXT,
      handled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_violations_attempt ON violations(attempt_id);

    CREATE TABLE IF NOT EXISTS certificates (
      id TEXT PRIMARY KEY,
      certificate_id TEXT NOT NULL UNIQUE,
      attempt_id TEXT NOT NULL UNIQUE REFERENCES attempts(id) ON DELETE CASCADE,
      quiz_id TEXT NOT NULL,
      participant_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      pdf_url TEXT,
      drive_file_id TEXT,
      slide_file_id TEXT,
      issued_at TEXT,
      error TEXT,
      email_status TEXT NOT NULL DEFAULT 'pending',
      email_error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_certificates_quiz ON certificates(quiz_id, status);

    CREATE TABLE IF NOT EXISTS emails (
      id TEXT PRIMARY KEY,
      template_key TEXT NOT NULL,
      to_email TEXT NOT NULL,
      actual_recipient TEXT NOT NULL,
      subject TEXT NOT NULL,
      body_html TEXT NOT NULL,
      attempt_id TEXT,
      participant_id TEXT,
      certificate_id TEXT,
      status TEXT NOT NULL DEFAULT 'queued',
      provider_message_id TEXT,
      error TEXT,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      sent_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_emails_created ON emails(created_at DESC);

    CREATE TABLE IF NOT EXISTS sync_jobs (
      id TEXT PRIMARY KEY,
      job_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      run_after TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_jobs_status ON sync_jobs(status, run_after);

    CREATE TABLE IF NOT EXISTS announcements (
      id TEXT PRIMARY KEY,
      quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sheet_mirror (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tab TEXT NOT NULL,
      row_key TEXT,
      row_values TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sheet_mirror_tab ON sheet_mirror(tab);

    CREATE TABLE IF NOT EXISTS certificate_sequence (
      year INTEGER PRIMARY KEY,
      last_number INTEGER NOT NULL DEFAULT 0
    );
  `);
  database.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

export function getSetting(key: string, fallback = ''): string {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? fallback;
}

export function setSetting(key: string, value: string): void {
  getDb()
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run(key, value);
}

export function getSettings(prefix = ''): Record<string, string> {
  const rows = getDb()
    .prepare('SELECT key, value FROM settings WHERE key LIKE ?')
    .all(`${prefix}%`) as { key: string; value: string }[];
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
