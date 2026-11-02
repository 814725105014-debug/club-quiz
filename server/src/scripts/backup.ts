/**
 * Backup, verify and restore the platform's own data.
 *
 *   npm run backup                      create a snapshot in data/backups
 *   npm run backup -- --list            list snapshots, newest first
 *   npm run backup -- --verify <file>   integrity-check a snapshot
 *   npm run backup -- --restore <file>  restore it (refuses while the API is running)
 *
 * A snapshot is a consistent SQLite copy taken with VACUUM INTO, so it is safe to run
 * against a live database: no downtime, no half-written WAL. Certificate PDFs and the
 * local outbox are copied alongside it, and a manifest records row counts so a restore
 * can be checked afterwards.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { env } from '../env.js';

const BACKUP_DIR = path.resolve(process.env.BACKUP_DIR ?? path.join(env.dataDir, 'backups'));
const KEEP = Number(process.env.BACKUP_KEEP ?? 14);
const STAMP = () =>
  new Date().toISOString().replace(/\.\d+Z$/, 'Z').replace(/[:T]/g, '-');

const TABLES = ['users', 'quizzes', 'questions', 'participants', 'attempts', 'answers', 'certificates', 'sync_jobs', 'audit_log', 'settings'];

interface Manifest {
  createdAt: string;
  appVersion: string;
  source: string;
  database: string;
  bytes: number;
  sha256: string;
  integrity: string;
  counts: Record<string, number>;
  files: { certificates: number; outbox: number };
  node: string;
}

function sha256(file: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function countRows(db: DatabaseSync, where = ''): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const table of TABLES) {
    try {
      const row = db.prepare(`SELECT COUNT(*) AS n FROM ${table}${where}`).get() as { n: number };
      counts[table] = row.n;
    } catch {
      counts[table] = -1; // table not present in this schema version
    }
  }
  return counts;
}

function copyDir(from: string, to: string): number {
  if (!fs.existsSync(from)) {
    fs.mkdirSync(to, { recursive: true });
    return 0;
  }
  fs.mkdirSync(to, { recursive: true });
  let n = 0;
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) n += copyDir(src, dest);
    else if (entry.isFile()) {
      fs.copyFileSync(src, dest);
      n += 1;
    }
  }
  return n;
}

function human(bytes: number): string {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} kB`;
}

/** True when another process holds the database — a restore must never race a writer. */
function databaseInUse(): boolean {
  // A live WAL means the API (or a test run) has the file open. A cleanly closed
  // database leaves no -wal/-shm, so this is a reliable enough signal for a human.
  return fs.existsSync(`${env.databasePath}-wal`) || fs.existsSync(`${env.databasePath}-shm`);
}

function create(): void {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const name = `quiz-${STAMP()}`;
  const dbFile = path.join(BACKUP_DIR, `${name}.db`);

  const source = new DatabaseSync(env.databasePath, { readOnly: true });
  let integrity = 'unknown';
  let counts: Record<string, number> = {};
  try {
    // Escape single quotes for the literal path in VACUUM INTO.
    source.exec(`VACUUM INTO '${dbFile.replace(/'/g, "''")}'`);
    counts = countRows(source);
  } finally {
    source.close();
  }

  const snapshot = new DatabaseSync(dbFile, { readOnly: true });
  try {
    integrity = (snapshot.prepare('PRAGMA integrity_check').get() as { integrity_check: string }).integrity_check;
  } finally {
    snapshot.close();
  }
  if (integrity !== 'ok') {
    console.error(`✕ Snapshot failed its integrity check: ${integrity}`);
    process.exitCode = 1;
    return;
  }

  const files = {
    certificates: copyDir(env.certDir, path.join(BACKUP_DIR, name, 'certificates')),
    outbox: copyDir(path.join(env.dataDir, 'outbox'), path.join(BACKUP_DIR, name, 'outbox')),
  };

  const manifest: Manifest = {
    createdAt: new Date().toISOString(),
    appVersion: JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8')).version,
    source: env.databasePath,
    database: `${name}.db`,
    bytes: fs.statSync(dbFile).size,
    sha256: sha256(dbFile),
    integrity,
    counts,
    files,
    node: process.version,
  };
  fs.writeFileSync(path.join(BACKUP_DIR, `${name}.json`), `${JSON.stringify(manifest, null, 2)}\n`);

  const total = Object.values(counts).reduce((sum, n) => sum + Math.max(n, 0), 0);
  console.log(`✓ ${path.relative(process.cwd(), dbFile)}  ${human(manifest.bytes)}  ${total} rows`);
  console.log(`  integrity ${integrity}, ${files.certificates} certificate PDF(s), ${files.outbox} outbox file(s)`);
  console.log(`  sha256 ${manifest.sha256.slice(0, 16)}…`);

  prune();
}

function prune(): void {
  const snapshots = list().reverse(); // oldest first
  const excess = snapshots.slice(0, Math.max(0, snapshots.length - KEEP));
  for (const snap of excess) {
    fs.rmSync(snap.dbPath, { force: true });
    fs.rmSync(snap.dbPath.replace(/\.db$/, '.json'), { force: true });
    fs.rmSync(snap.dbPath.replace(/\.db$/, ''), { recursive: true, force: true });
    console.log(`  pruned ${path.basename(snap.dbPath)}`);
  }
}

function list(): { name: string; dbPath: string; bytes: number; createdAt: string }[] {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith('.db'))
    .map((f) => {
      const dbPath = path.join(BACKUP_DIR, f);
      const stat = fs.statSync(dbPath);
      return { name: f.replace(/\.db$/, ''), dbPath, bytes: stat.size, createdAt: stat.mtime.toISOString() };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function listCommand(): void {
  const snapshots = list();
  if (!snapshots.length) {
    console.log(`No snapshots in ${path.relative(process.cwd(), BACKUP_DIR)} yet. Run: npm run backup`);
    return;
  }
  console.log(`${snapshots.length} snapshot(s) in ${path.relative(process.cwd(), BACKUP_DIR)}:`);
  for (const snap of snapshots) {
    const manifestPath = snap.dbPath.replace(/\.db$/, '.json');
    let tag = '';
    if (fs.existsSync(manifestPath)) {
      const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Manifest;
      tag = `  ${m.counts.participants ?? 0} participants, ${m.counts.certificates ?? 0} certificates`;
    }
    console.log(`  ${snap.name}  ${human(snap.bytes)}${tag}`);
  }
}

function verify(file: string): boolean {
  const dbPath = path.resolve(file);
  if (!fs.existsSync(dbPath)) {
    console.error(`✕ ${file} does not exist`);
    return false;
  }
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const integrity = (db.prepare('PRAGMA integrity_check').get() as { integrity_check: string }).integrity_check;
    const counts = countRows(db);
    const ok = integrity === 'ok';
    console.log(`${ok ? '✓' : '✕'} ${path.basename(dbPath)} — integrity ${integrity}`);
    for (const [table, n] of Object.entries(counts)) {
      if (n > 0) console.log(`    ${table.padEnd(14)} ${n}`);
    }
    const manifestPath = dbPath.replace(/\.db$/, '.json');
    if (fs.existsSync(manifestPath)) {
      const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Manifest;
      const digest = sha256(dbPath);
      const same = digest === m.sha256;
      console.log(`  manifest ${m.createdAt} (v${m.appVersion}) — sha256 ${same ? 'matches' : 'DIFFERS'}`);
      if (!same) console.log('  the file changed since it was written; counts above are current');
    }
    return ok;
  } finally {
    db.close();
  }
}

function restore(file: string): void {
  const dbPath = path.resolve(file);
  if (!verify(dbPath)) {
    console.error('✕ Refusing to restore a snapshot that does not verify.');
    process.exitCode = 1;
    return;
  }
  if (databaseInUse()) {
    console.error(
      `✕ ${path.relative(process.cwd(), env.databasePath)} is open (WAL/SHM present).\n` +
        '  Stop the API first, then run this again. Restoring under a live server corrupts sessions and jobs.',
    );
    process.exitCode = 1;
    return;
  }

  // Never destroy the current state without keeping a copy of it.
  const safety = `${env.databasePath}.pre-restore-${STAMP()}.db`;
  if (fs.existsSync(env.databasePath)) {
    fs.copyFileSync(env.databasePath, safety);
    console.log(`  kept current database as ${path.basename(safety)}`);
  }
  for (const suffix of ['-wal', '-shm']) {
    fs.rmSync(`${env.databasePath}${suffix}`, { force: true });
  }
  fs.copyFileSync(dbPath, env.databasePath);
  console.log(`✓ restored ${path.basename(dbPath)} → ${path.relative(process.cwd(), env.databasePath)}`);

  const sidecar = path.join(path.dirname(dbPath), path.basename(dbPath, '.db'));
  if (fs.existsSync(sidecar)) {
    const certs = copyDir(path.join(sidecar, 'certificates'), env.certDir);
    const outbox = copyDir(path.join(sidecar, 'outbox'), path.join(env.dataDir, 'outbox'));
    console.log(`  restored ${certs} certificate PDF(s) and ${outbox} outbox file(s)`);
  }
  console.log('  Start the API and check /api/health, then Admin → Readiness.');
}

function usage(): void {
  console.log(`Usage: npm run backup -- [command]

  (no command)        create a snapshot in ${path.relative(process.cwd(), BACKUP_DIR)}
  --list              list snapshots, newest first
  --verify <file>     integrity-check a snapshot
  --restore <file>    restore a snapshot (stop the API first)

Environment: BACKUP_DIR (default data/backups), BACKUP_KEEP (default ${KEEP} snapshots).`);
}

const argv = process.argv.slice(2);
const flag = argv.find((a) => a.startsWith('--'));
const value = argv[argv.indexOf(flag ?? '') + 1];

if (!flag) create();
else if (flag === '--list' || flag === '-l') listCommand();
else if (flag === '--verify' && value) process.exitCode = verify(value) ? 0 : 1;
else if (flag === '--restore' && value) restore(value);
else if (flag === '--help' || flag === '-h') usage();
else {
  usage();
  process.exitCode = 1;
}
