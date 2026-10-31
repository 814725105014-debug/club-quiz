import { getDb } from '../db.js';
import { nowIso } from '../lib/time.js';
import { newId } from '../lib/ids.js';

export type JobType =
  | 'sheet_sync_result'
  | 'sheet_sync_certificate'
  | 'issue_certificate'
  | 'send_email';

export interface JobRecord {
  id: string;
  job_type: JobType;
  payload: string;
  status: 'pending' | 'processing' | 'done' | 'failed';
  attempts: number;
  last_error: string | null;
  run_after: string;
  created_at: string;
  updated_at: string;
}

export type JobHandler = (type: JobType, payload: Record<string, unknown>) => Promise<void>;

const MAX_ATTEMPTS = 5;

/** Queues a background job. Identical work already queued is merged. */
export function enqueueJob(type: JobType, payload: Record<string, unknown>, runAfter?: string): string {
  const db = getDb();
  const serialized = JSON.stringify(payload);
  const existing = db
    .prepare(
      `SELECT id FROM sync_jobs
        WHERE job_type = ? AND status IN ('pending','processing') AND payload = ?
        LIMIT 1`,
    )
    .get(type, serialized) as { id: string } | undefined;
  if (existing) return existing.id;

  const id = newId('job');
  db.prepare(
    `INSERT INTO sync_jobs (id, job_type, payload, status, attempts, last_error, run_after, created_at, updated_at)
     VALUES (?, ?, ?, 'pending', 0, NULL, ?, ?, ?)`,
  ).run(id, type, serialized, runAfter ?? nowIso(), nowIso(), nowIso());
  return id;
}

/** Claims the oldest due job. SQLite's single-writer model keeps this race-free in-process. */
export function claimJob(): JobRecord | null {
  const db = getDb();
  const job = db
    .prepare(
      `SELECT * FROM sync_jobs
        WHERE status = 'pending' AND run_after <= ?
        ORDER BY created_at ASC LIMIT 1`,
    )
    .get(nowIso()) as JobRecord | undefined;
  if (!job) return null;
  db.prepare(`UPDATE sync_jobs SET status = 'processing', updated_at = ? WHERE id = ?`).run(nowIso(), job.id);
  return job;
}

export function completeJob(id: string) {
  getDb()
    .prepare(`UPDATE sync_jobs SET status = 'done', updated_at = ?, last_error = NULL WHERE id = ?`)
    .run(nowIso(), id);
}

export function failJob(id: string, message: string) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM sync_jobs WHERE id = ?').get(id) as JobRecord | undefined;
  if (!row) return;
  const attempts = row.attempts + 1;
  const exhausted = attempts >= MAX_ATTEMPTS;
  const backoffSeconds = Math.min(300, 5 * 2 ** attempts);
  db.prepare(
    `UPDATE sync_jobs SET status = ?, attempts = ?, last_error = ?, run_after = ?, updated_at = ? WHERE id = ?`,
  ).run(
    exhausted ? 'failed' : 'pending',
    attempts,
    message.slice(0, 900),
    new Date(Date.now() + backoffSeconds * 1000).toISOString(),
    nowIso(),
    id,
  );
}

export function retryJob(id: string) {
  getDb()
    .prepare(
      `UPDATE sync_jobs SET status = 'pending', attempts = 0, last_error = NULL, run_after = ?, updated_at = ?
        WHERE id = ?`,
    )
    .run(nowIso(), nowIso(), id);
}

export function jobQueueStats() {
  const rows = getDb().prepare('SELECT status, COUNT(*) AS n FROM sync_jobs GROUP BY status').all() as {
    status: string;
    n: number;
  }[];
  const by = (status: string) => rows.find((r) => r.status === status)?.n ?? 0;
  return { pending: by('pending'), processing: by('processing'), done: by('done'), failed: by('failed') };
}

export function listJobs(limit = 60) {
  return getDb()
    .prepare('SELECT * FROM sync_jobs ORDER BY created_at DESC LIMIT ?')
    .all(limit) as JobRecord[];
}

/** Drains up to `limit` due jobs. Used by the seed script and tests. */
export async function drainJobs(handler: JobHandler, limit = 100): Promise<number> {
  let processed = 0;
  while (processed < limit) {
    const job = claimJob();
    if (!job) break;
    processed += 1;
    try {
      await handler(job.job_type, JSON.parse(job.payload) as Record<string, unknown>);
      completeJob(job.id);
    } catch (err) {
      failJob(job.id, err instanceof Error ? err.message : String(err));
    }
  }
  return processed;
}

let workerTimer: NodeJS.Timeout | null = null;
let running = false;

export function startJobWorker(handler: JobHandler) {
  if (workerTimer) return;
  workerTimer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await drainJobs(handler, 20);
    } catch (err) {
      console.error('[jobs] worker error', err);
    } finally {
      running = false;
    }
  }, 1500);
  workerTimer.unref?.();
  void drainJobs(handler, 20);
}

export function stopJobWorker() {
  if (workerTimer) clearInterval(workerTimer);
  workerTimer = null;
}
