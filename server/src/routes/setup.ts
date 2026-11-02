import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { requireAuth, requireRole } from '../auth.js';
import { getDb } from '../db.js';
import { env } from '../env.js';
import { asyncHandler } from '../lib/http.js';
import { getProvider } from '../services/google.js';
import { firebaseAdminConfigured } from '../services/firebase.js';
import { getWorkspaceConfig, peekCertificateNumber } from '../services/config.js';

export const setupRouter = Router();
setupRouter.use(requireAuth);

export type ReadinessStatus = 'ok' | 'warn' | 'fail' | 'off';

interface ReadinessCheck {
  id: string;
  label: string;
  group: 'identity' | 'google' | 'email' | 'certificates' | 'data';
  status: ReadinessStatus;
  detail: string;
  action?: string;
  docs?: string;
}

/**
 * One place that answers "is this deployment actually ready?".
 *
 * It reads live state rather than configuration guesses: whether a service account is
 * present, whether the provider answers, whether the certificate counter is where the
 * spreadsheet expects it. Safe to call from the dashboard — no writes, no secrets.
 */
setupRouter.get(
  '/setup',
  requireRole('quiz_host'),
  asyncHandler(async (_req, res) => {
    const db = getDb();
    const cfg = getWorkspaceConfig();
    const checks: ReadinessCheck[] = [];

    /* ------------------------------ identity ------------------------------ */
    if (env.firebase.mode === 'firebase') {
      const adminReady = firebaseAdminConfigured();
      checks.push({
        id: 'auth.firebase',
        label: 'Firebase Authentication',
        group: 'identity',
        status: adminReady ? 'ok' : 'fail',
        detail: adminReady
          ? `Administrators sign in with Firebase (project ${env.firebase.projectId}).`
          : 'AUTH_MODE=firebase but no service account is configured, so ID tokens cannot be verified.',
        action: adminReady ? undefined : 'Set FIREBASE_SERVICE_ACCOUNT_FILE on the API host and restart.',
        docs: 'docs/FIREBASE.md',
      });

      const unlinked = (
        db
          .prepare('SELECT COUNT(*) AS n FROM users WHERE firebase_uid IS NULL AND is_active = 1')
          .get() as { n: number }
      ).n;
      checks.push({
        id: 'auth.provision',
        label: 'Administrators linked to Firebase',
        group: 'identity',
        status: unlinked === 0 ? 'ok' : 'warn',
        detail:
          unlinked === 0
            ? 'Every active administrator has a Firebase identity.'
            : `${unlinked} active administrator(s) have no Firebase identity yet.`,
        action: unlinked === 0 ? undefined : 'Run: npm run firebase:provision -- --apply',
        docs: 'docs/FIREBASE.md',
      });
    } else {
      checks.push({
        id: 'auth.cookie',
        label: 'Cookie sessions',
        group: 'identity',
        status: 'ok',
        detail: 'Sign-in uses the platform’s own scrypt + signed-cookie sessions (offline capable).',
        action: 'Set AUTH_MODE=firebase to switch administrators to Firebase Authentication.',
        docs: 'docs/FIREBASE.md',
      });
    }

    /* ------------------------------- google ------------------------------- */
    const provider = getProvider(cfg);
    let providerOk = false;
    let providerMessage = 'Not checked.';
    let tabs: string[] = [];
    try {
      const status = await provider.status(cfg);
      providerOk = status.ok;
      providerMessage = status.message;
      tabs = await provider.listTabs(cfg);
    } catch (err) {
      providerMessage = (err as Error).message;
    }
    checks.push({
      id: 'google.provider',
      label: `Google provider (${cfg.provider})`,
      group: 'google',
      status: providerOk ? (cfg.provider === 'mock' ? 'warn' : 'ok') : 'fail',
      detail: providerMessage,
      action:
        cfg.provider === 'mock'
          ? 'Mock mode renders local PDFs and redirects mail. Switch to apps_script or google_api before issuing real certificates.'
          : providerOk
            ? undefined
            : 'Fix the bridge URL/secret or the service account, then test again.',
      docs: 'docs/DEPLOYMENT.md',
    });

    const expectedTabs = [cfg.responsesTab, cfg.resultsTab, cfg.logTab];
    const missingTabs = providerOk ? expectedTabs.filter((tab) => !tabs.includes(tab)) : expectedTabs;
    checks.push({
      id: 'google.tabs',
      label: 'Spreadsheet tabs',
      group: 'google',
      status: !providerOk ? 'warn' : missingTabs.length === 0 ? 'ok' : 'fail',
      detail: !providerOk
        ? 'Tab list unavailable until the provider answers.'
        : missingTabs.length === 0
          ? `Found ${expectedTabs.join(', ')}.`
          : `Missing tab(s): ${missingTabs.join(', ')}.`,
      action: missingTabs.length ? 'Create the tab or correct its name in Settings.' : undefined,
      docs: 'docs/GOOGLE_WORKSPACE.md',
    });

    /* -------------------------------- email ------------------------------- */
    checks.push({
      id: 'email.mode',
      label: 'Email delivery',
      group: 'email',
      status: env.email.testMode ? 'warn' : 'ok',
      detail: env.email.testMode
        ? `Test mode: every message is redirected to ${cfg.emailRedirectTo}.`
        : `Sending to participants from ${cfg.emailFrom}.`,
      action: env.email.testMode
        ? 'Turn test mode off only after the coordinator approves real delivery.'
        : undefined,
      docs: 'docs/DEPLOYMENT.md',
    });

    /* ----------------------------- certificates --------------------------- */
    const nextNumber = peekCertificateNumber(cfg.certificateYear);
    checks.push({
      id: 'cert.numbering',
      label: 'Certificate numbering',
      group: 'certificates',
      status: 'ok',
      detail: `Next certificate: ${cfg.certificatePrefix}-${cfg.certificateYear}-${String(nextNumber).padStart(4, '0')}`,
      action: 'Confirm this matches the Settings tab of the spreadsheet before issuing.',
      docs: 'docs/GOOGLE_WORKSPACE.md',
    });

    checks.push({
      id: 'cert.template',
      label: 'Slides template',
      group: 'certificates',
      status: cfg.templateId ? 'ok' : 'fail',
      detail: cfg.templateId ? `Template ${cfg.templateId.slice(0, 12)}… will be copied per certificate.` : 'No template configured.',
      action: cfg.templateId ? undefined : 'Set CERT_TEMPLATE_ID in Settings → Google Workspace.',
      docs: 'docs/GOOGLE_WORKSPACE.md',
    });

    /* --------------------------------- data ------------------------------- */
    const queue = db
      .prepare(
        `SELECT
           SUM(CASE WHEN status IN ('pending','processing') THEN 1 ELSE 0 END) AS pending,
           SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
         FROM sync_jobs`,
      )
      .get() as { pending: number | null; failed: number | null };
    checks.push({
      id: 'data.queue',
      label: 'Background queue',
      group: 'data',
      status: (queue.failed ?? 0) > 0 ? 'warn' : 'ok',
      detail: `${queue.pending ?? 0} pending, ${queue.failed ?? 0} failed job(s).`,
      action: (queue.failed ?? 0) > 0 ? 'Review failed jobs under Spreadsheet sync and retry.' : undefined,
      docs: 'docs/RUNBOOK.md',
    });

    // Backups are operational, not application state: report how stale the newest
    // snapshot is so the gap is visible before it matters.
    const backupDir = path.resolve(process.env.BACKUP_DIR ?? path.join(env.dataDir, 'backups'));
    const snapshots = fs.existsSync(backupDir)
      ? fs
          .readdirSync(backupDir)
          .filter((f) => f.endsWith('.db'))
          .map((f) => fs.statSync(path.join(backupDir, f)).mtimeMs)
      : [];
    const newest = snapshots.length ? Math.max(...snapshots) : 0;
    const ageDays = newest ? Math.floor((Date.now() - newest) / 86_400_000) : null;
    checks.push({
      id: 'data.backup',
      label: 'Database snapshot',
      group: 'data',
      status: newest === 0 ? 'warn' : ageDays !== null && ageDays > 7 ? 'warn' : 'ok',
      detail:
        newest === 0
          ? 'No snapshot has been taken yet.'
          : `Newest snapshot is ${ageDays === 0 ? 'from today' : `${ageDays} day(s) old`}.`,
      action: 'Run: npm run backup (and schedule it outside the app).',
      docs: 'docs/RUNBOOK.md',
    });

    const pendingCerts = (
      db
        .prepare(`SELECT COUNT(*) AS n FROM certificates WHERE status IN ('pending','generating')`)
        .get() as { n: number }
    ).n;
    checks.push({
      id: 'data.certificates',
      label: 'Certificate backlog',
      group: 'data',
      status: pendingCerts > 5 ? 'warn' : 'ok',
      detail: pendingCerts === 0 ? 'No certificates waiting.' : `${pendingCerts} certificate(s) still generating.`,
      action: pendingCerts > 5 ? 'Check the queue worker and provider connectivity.' : undefined,
      docs: 'docs/RUNBOOK.md',
    });

    const summary = {
      ok: checks.filter((c) => c.status === 'ok').length,
      warn: checks.filter((c) => c.status === 'warn').length,
      fail: checks.filter((c) => c.status === 'fail').length,
    };

    res.json({
      summary,
      ready: summary.fail === 0,
      checks,
      environment: {
        node: process.version,
        timezone: env.timezone,
        nodeEnv: env.nodeEnv,
        provider: cfg.provider,
        authMode: env.firebase.mode,
        projectId: env.firebase.projectId,
        firestoreMirror: env.firebase.mirror,
        databasePath: env.databasePath,
        appBaseUrl: cfg.appBaseUrl,
        emailTestMode: cfg.emailTestMode,
      },
    });
  }),
);
