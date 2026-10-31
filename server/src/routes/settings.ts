import { Router } from 'express';
import { z } from 'zod';
import { getDb, getSetting, setSetting } from '../db.js';
import { requireAuth, requireRole, hashPassword, ROLE_LABELS, type Role } from '../auth.js';
import { ApiError, asyncHandler, parse } from '../lib/http.js';
import { recordAudit } from '../audit.js';
import { newId } from '../lib/ids.js';
import { toCsv } from '../lib/csv.js';
import { getWorkspaceConfig, publicWorkspaceConfig, updateWorkspaceConfig } from '../services/config.js';
import { getProvider, resetProviderCache } from '../services/google.js';
import { DEFAULT_TEMPLATES, getTemplate } from '../services/email.js';
import { enqueueJob } from '../services/jobs.js';
import { syncAttemptToResults, syncCertificateToFormResponses } from '../services/sheets.js';
import type { FieldRow, ParticipantRow } from '../domain.js';

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

/* ----------------------------- workspace ----------------------------- */

settingsRouter.get(
  '/settings',
  asyncHandler(async (_req, res) => {
    const cfg = publicWorkspaceConfig();
    res.json({
      workspace: cfg,
      audit: JSON.parse(getSetting('onboarding_workspace_audit', '{}') || '{}'),
      certificatePreview: {
        prefix: cfg.certificatePrefix,
        year: cfg.certificateYear,
        startNumber: cfg.certificateStartNumber,
      },
      platform: {
        name: getSetting('platform_name', 'QUIZ PLATFORM'),
        timezone: cfg.appBaseUrl ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'Asia/Kolkata',
      },
    });
  }),
);

const workspaceSchema = z.object({
  provider: z.enum(['mock', 'apps_script', 'google_api']).optional(),
  spreadsheetId: z.string().max(200).optional(),
  responsesTab: z.string().max(120).optional(),
  resultsTab: z.string().max(120).optional(),
  logTab: z.string().max(120).optional(),
  templateId: z.string().max(200).optional(),
  outputFolderId: z.string().max(200).optional(),
  certificatePrefix: z.string().max(80).optional(),
  certificateYear: z.number().int().min(2020).max(2100).optional(),
  certificateStartNumber: z.number().int().min(1).max(100000).optional(),
  verifyBaseUrl: z.string().max(300).optional(),
  emailFrom: z.string().email().optional(),
  emailFromName: z.string().max(120).optional(),
  webhookUrl: z.string().max(500).optional(),
  sharedSecret: z.string().max(200).optional(),
  impersonateEmail: z.string().email().optional().or(z.literal('')),
  organizationName: z.string().max(200).optional(),
  institutionLine: z.string().max(300).optional(),
  department: z.string().max(200).optional(),
  emailTestMode: z.boolean().optional(),
  emailRedirectTo: z.string().email().optional(),
  appBaseUrl: z.string().max(300).optional(),
});

settingsRouter.patch(
  '/settings/workspace',
  requireRole('super_admin'),
  asyncHandler(async (req, res) => {
    const input = parse(workspaceSchema, req.body);
    resetProviderCache();
    const cfg = updateWorkspaceConfig(input);
    recordAudit(req, 'settings.workspace_update', 'settings', 'workspace', {
      fields: Object.keys(input),
      provider: cfg.provider,
    });
    res.json({ workspace: publicWorkspaceConfig() });
  }),
);

settingsRouter.post(
  '/settings/test-connection',
  requireRole('quiz_admin'),
  asyncHandler(async (req, res) => {
    const cfg = getWorkspaceConfig();
    resetProviderCache();
    const provider = getProvider(cfg);
    const status = await provider.status(cfg);
    let tabs: string[] = [];
    try {
      tabs = await provider.listTabs(cfg);
    } catch {
      tabs = [];
    }
    recordAudit(req, 'settings.test_connection', 'google', cfg.provider, status);
    res.json({ provider: provider.name, ...status, tabs });
  }),
);

settingsRouter.get(
  '/settings/tabs',
  asyncHandler(async (req, res) => {
    const cfg = getWorkspaceConfig();
    const provider = getProvider(cfg);
    try {
      const tabs = await provider.listTabs(cfg);
      res.json({ tabs });
    } catch (err) {
      res.status(200).json({ tabs: [], error: (err as Error).message });
    }
  }),
);

settingsRouter.get(
  '/sheet/:tab',
  asyncHandler(async (req, res) => {
    const cfg = getWorkspaceConfig();
    const provider = getProvider(cfg);
    try {
      const table = await provider.readSheet(req.params.tab, cfg);
      res.json(table);
    } catch (err) {
      throw new ApiError(502, `Could not read the spreadsheet tab: ${(err as Error).message}`, 'sheet_read_failed');
    }
  }),
);

settingsRouter.get(
  '/email-templates',
  asyncHandler(async (_req, res) => {
    res.json({
      templates: {
        certificate_delivery: getTemplate('certificate_delivery'),
        submission_confirmation: getTemplate('submission_confirmation'),
        certificate_regenerated: getTemplate('certificate_regenerated'),
      },
      defaults: DEFAULT_TEMPLATES,
      variables: [
        '{{PARTICIPANT_NAME}}',
        '{{QUIZ_TITLE}}',
        '{{COURSE_NAME}}',
        '{{SCORE}}',
        '{{TOTAL_MARKS}}',
        '{{PERCENTAGE}}',
        '{{RESULT}}',
        '{{CERTIFICATE_ID}}',
        '{{ISSUE_DATE}}',
        '{{VERIFY_URL}}',
        '{{CERTIFICATE_URL}}',
        '{{ORGANIZATION}}',
        '{{SCORE_BLOCK}}',
      ],
    });
  }),
);

settingsRouter.put(
  '/email-templates/:key',
  requireRole('quiz_admin'),
  asyncHandler(async (req, res) => {
    const key = req.params.key;
    if (!['certificate_delivery', 'submission_confirmation', 'certificate_regenerated'].includes(key)) {
      throw new ApiError(400, 'Unknown email template.', 'invalid_template');
    }
    const input = parse(
      z.object({ subject: z.string().min(1).max(300), body: z.string().min(1).max(20000) }),
      req.body,
    );
    setSetting(`email_template.${key}`, JSON.stringify(input));
    recordAudit(req, 'settings.email_template_update', 'email_template', key, null);
    res.json({ ok: true });
  }),
);

/* ----------------------------- registration fields ----------------------------- */

settingsRouter.get(
  '/fields',
  asyncHandler(async (_req, res) => {
    const fields = getDb()
      .prepare('SELECT * FROM registration_fields ORDER BY sort_order ASC')
      .all() as FieldRow[];
    res.json({ fields });
  }),
);

const fieldSchema = z.object({
  key: z.string().min(2).max(40).regex(/^[a-z][a-z0-9_]*$/, 'Key must be lowercase letters, numbers and underscores.'),
  label: z.string().min(2).max(100),
  type: z.enum(['text', 'email', 'number', 'select', 'tel']).optional(),
  required: z.boolean().optional(),
  enabled: z.boolean().optional(),
  pattern: z.string().max(300).nullable().optional(),
  patternHint: z.string().max(300).nullable().optional(),
  options: z.string().max(500).nullable().optional(),
  mapsToSheetColumn: z.string().max(120).nullable().optional(),
  mapsToPlaceholder: z.string().max(120).nullable().optional(),
  sortOrder: z.number().int().min(0).max(100).optional(),
});

settingsRouter.post(
  '/fields',
  requireRole('quiz_admin'),
  asyncHandler(async (req, res) => {
    const input = parse(fieldSchema, req.body);
    const db = getDb();
    if (input.pattern) {
      try {
        new RegExp(input.pattern);
      } catch {
        throw new ApiError(400, 'Validation pattern is not a valid regular expression.', 'invalid_pattern');
      }
    }
    const count = (db.prepare('SELECT COUNT(*) AS n FROM registration_fields').get() as { n: number }).n;
    const id = newId('fld');
    db.prepare(
      `INSERT INTO registration_fields (id, key, label, type, required, enabled, sort_order, pattern, pattern_hint,
        options, maps_to_sheet_column, maps_to_placeholder, is_core)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    ).run(
      id,
      input.key,
      input.label,
      input.type ?? 'text',
      input.required === false ? 0 : 1,
      input.enabled === false ? 0 : 1,
      input.sortOrder ?? count,
      input.pattern ?? null,
      input.patternHint ?? null,
      input.options ?? null,
      input.mapsToSheetColumn ?? null,
      input.mapsToPlaceholder ?? null,
    );
    recordAudit(req, 'field.create', 'registration_field', id, { key: input.key });
    res.status(201).json({ fields: db.prepare('SELECT * FROM registration_fields ORDER BY sort_order ASC').all() });
  }),
);

settingsRouter.patch(
  '/fields/:fieldId',
  requireRole('quiz_admin'),
  asyncHandler(async (req, res) => {
    const input = parse(fieldSchema.partial(), req.body);
    const db = getDb();
    const field = db.prepare('SELECT * FROM registration_fields WHERE id = ?').get(req.params.fieldId) as
      | FieldRow
      | undefined;
    if (!field) throw new ApiError(404, 'Field not found.', 'field_not_found');
    if (input.pattern) {
      try {
        new RegExp(input.pattern);
      } catch {
        throw new ApiError(400, 'Validation pattern is not a valid regular expression.', 'invalid_pattern');
      }
    }
    if (field.is_core && input.key && input.key !== field.key) {
      throw new ApiError(400, 'Core fields cannot be renamed; edit the label instead.', 'core_field_key');
    }
    const sets: string[] = [];
    const vals: (string | number | null)[] = [];
    const mapping: Record<string, string> = {
      key: 'key',
      label: 'label',
      type: 'type',
      pattern: 'pattern',
      patternHint: 'pattern_hint',
      options: 'options',
      mapsToSheetColumn: 'maps_to_sheet_column',
      mapsToPlaceholder: 'maps_to_placeholder',
      sortOrder: 'sort_order',
      required: 'required',
      enabled: 'enabled',
    };
    for (const [key, column] of Object.entries(mapping)) {
      const value = input[key as keyof typeof input];
      if (value === undefined) continue;
      if (key === 'required' || key === 'enabled') {
        sets.push(`${column} = ?`);
        vals.push(value ? 1 : 0);
      } else {
        sets.push(`${column} = ?`);
        vals.push(value === null ? null : (value as string | number));
      }
    }
    if (!sets.length) {
      res.json({ fields: db.prepare('SELECT * FROM registration_fields ORDER BY sort_order ASC').all() });
      return;
    }
    sets.push("updated_at = datetime('now')");
    vals.push(req.params.fieldId);
    db.prepare(`UPDATE registration_fields SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    recordAudit(req, 'field.update', 'registration_field', req.params.fieldId, { fields: Object.keys(input) });
    res.json({ fields: db.prepare('SELECT * FROM registration_fields ORDER BY sort_order ASC').all() });
  }),
);

settingsRouter.delete(
  '/fields/:fieldId',
  requireRole('quiz_admin'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const field = db.prepare('SELECT * FROM registration_fields WHERE id = ?').get(req.params.fieldId) as
      | FieldRow
      | undefined;
    if (!field) throw new ApiError(404, 'Field not found.', 'field_not_found');
    if (field.is_core) throw new ApiError(400, 'Core fields cannot be deleted; disable them instead.', 'core_field');
    db.prepare('DELETE FROM registration_fields WHERE id = ?').run(field.id);
    recordAudit(req, 'field.delete', 'registration_field', field.id, { key: field.key });
    res.json({ fields: db.prepare('SELECT * FROM registration_fields ORDER BY sort_order ASC').all() });
  }),
);

settingsRouter.post(
  '/fields/reorder',
  requireRole('quiz_admin'),
  asyncHandler(async (req, res) => {
    const { orderedIds } = parse(z.object({ orderedIds: z.array(z.string()).min(1) }), req.body);
    const db = getDb();
    orderedIds.forEach((id, index) => {
      db.prepare('UPDATE registration_fields SET sort_order = ? WHERE id = ?').run(index, id);
    });
    recordAudit(req, 'field.reorder', 'registration_field', 'all', { count: orderedIds.length });
    res.json({ fields: db.prepare('SELECT * FROM registration_fields ORDER BY sort_order ASC').all() });
  }),
);

/* ----------------------------- participant records ----------------------------- */

settingsRouter.get(
  '/participants',
  asyncHandler(async (req, res) => {
    const db = getDb();
    const where: string[] = ['1=1'];
    const params: string[] = [];
    if (req.query.quizId) {
      where.push('p.quiz_id = ?');
      params.push(String(req.query.quizId));
    }
    if (req.query.search) {
      const term = `%${String(req.query.search).toLowerCase()}%`;
      where.push('(lower(p.name) LIKE ? OR lower(p.email) LIKE ? OR lower(COALESCE(p.reg_number,\'\')) LIKE ?)');
      params.push(term, term, term);
    }
    const rows = db
      .prepare(
        `SELECT p.*, q.title AS quiz_title, a.id AS attempt_id, a.status AS attempt_status, a.percentage, a.passed,
          a.score, a.total_marks, a.started_at, a.submitted_at, a.deadline_at, a.violations_count,
          c.status AS certificate_status, c.certificate_id, c.email_status
         FROM participants p JOIN quizzes q ON q.id = p.quiz_id
         LEFT JOIN attempts a ON a.participant_id = p.id
         LEFT JOIN certificates c ON c.attempt_id = a.id
         WHERE ${where.join(' AND ')} ORDER BY p.created_at DESC LIMIT 500`,
      )
      .all(...params);
    res.json({ participants: rows });
  }),
);

settingsRouter.patch(
  '/participants/:participantId',
  requireRole('quiz_admin'),
  asyncHandler(async (req, res) => {
    const input = parse(
      z.object({
        name: z.string().min(2).max(120).optional(),
        email: z.string().email().optional(),
        regNumber: z.string().max(40).nullable().optional(),
        department: z.string().max(120).nullable().optional(),
      }),
      req.body,
    );
    const db = getDb();
    const participant = db.prepare('SELECT * FROM participants WHERE id = ?').get(req.params.participantId) as
      | ParticipantRow
      | undefined;
    if (!participant) throw new ApiError(404, 'Participant not found.', 'participant_not_found');
    db.prepare(
      `UPDATE participants SET name = ?, email = ?, reg_number = ?, department = ?, updated_at = ? WHERE id = ?`,
    ).run(
      (input.name ?? participant.name).toUpperCase(),
      (input.email ?? participant.email).toLowerCase(),
      input.regNumber === undefined ? participant.reg_number : input.regNumber,
      input.department === undefined ? participant.department : input.department,
      new Date().toISOString(),
      participant.id,
    );
    const attempts = db.prepare('SELECT id FROM attempts WHERE participant_id = ?').all(participant.id) as {
      id: string;
    }[];
    for (const a of attempts) enqueueJob('sheet_sync_result', { attemptId: a.id });
    recordAudit(req, 'participant.update', 'participant', participant.id, { fields: Object.keys(input) });
    res.json({ ok: true });
  }),
);

settingsRouter.get(
  '/participants/export.csv',
  asyncHandler(async (req, res) => {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT p.name, p.email, p.reg_number, p.department, q.title AS quiz_title, p.created_at
         FROM participants p JOIN quizzes q ON q.id = p.quiz_id ORDER BY p.created_at DESC`,
      )
      .all() as Record<string, string>[];
    const csv = toCsv(
      ['Name', 'Email', 'Register Number', 'Department', 'Quiz', 'Registered At'],
      rows.map((r) => [r.name, r.email, r.reg_number ?? '', r.department ?? '', r.quiz_title, r.created_at]),
    );
    recordAudit(req, 'participant.export', 'participant', 'all', { rows: rows.length });
    res.type('text/csv').setHeader('Content-Disposition', 'attachment; filename="participants.csv"');
    res.send(csv);
  }),
);

settingsRouter.post(
  '/sync/attempt/:attemptId',
  requireRole('quiz_admin'),
  asyncHandler(async (req, res) => {
    enqueueJob('sheet_sync_result', { attemptId: req.params.attemptId });
    recordAudit(req, 'sheet.sync_attempt', 'attempt', req.params.attemptId, null);
    res.json({ queued: true });
  }),
);

settingsRouter.post(
  '/sync/certificate/:certificateRowId',
  requireRole('quiz_admin'),
  asyncHandler(async (req, res) => {
    await syncCertificateToFormResponses(req.params.certificateRowId);
    recordAudit(req, 'sheet.sync_certificate', 'certificate', req.params.certificateRowId, null);
    res.json({ ok: true });
  }),
);

settingsRouter.post(
  '/sync/all',
  requireRole('quiz_admin'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const attempts = db
      .prepare(`SELECT id FROM attempts WHERE status != 'in_progress' LIMIT 500`)
      .all() as { id: string }[];
    for (const a of attempts) enqueueJob('sheet_sync_result', { attemptId: a.id });
    recordAudit(req, 'sheet.sync_all', 'attempt', 'all', { count: attempts.length });
    res.json({ queued: attempts.length });
  }),
);

/* ----------------------------- users ----------------------------- */

settingsRouter.get(
  '/users',
  requireRole('super_admin'),
  asyncHandler(async (_req, res) => {
    const users = getDb()
      .prepare('SELECT id, email, name, role, is_active, created_at, last_login_at FROM users ORDER BY created_at ASC')
      .all();
    res.json({ users, roles: ROLE_LABELS });
  }),
);

settingsRouter.post(
  '/users',
  requireRole('super_admin'),
  asyncHandler(async (req, res) => {
    const input = parse(
      z.object({
        name: z.string().min(2).max(120),
        email: z.string().email(),
        role: z.enum(['super_admin', 'quiz_admin', 'quiz_host', 'results_viewer']),
        password: z.string().min(10).max(200),
      }),
      req.body,
    );
    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').get(input.email);
    if (existing) throw new ApiError(409, 'An administrator with this email already exists.', 'duplicate_user');
    const id = newId('usr');
    db.prepare('INSERT INTO users (id, email, name, role, password_hash) VALUES (?, ?, ?, ?, ?)').run(
      id,
      input.email.toLowerCase(),
      input.name,
      input.role,
      hashPassword(input.password),
    );
    recordAudit(req, 'user.create', 'user', id, { email: input.email, role: input.role });
    res.status(201).json({ id });
  }),
);

settingsRouter.patch(
  '/users/:userId',
  requireRole('super_admin'),
  asyncHandler(async (req, res) => {
    const input = parse(
      z.object({
        name: z.string().min(2).max(120).optional(),
        role: z.enum(['super_admin', 'quiz_admin', 'quiz_host', 'results_viewer']).optional(),
        isActive: z.boolean().optional(),
        password: z.string().min(10).max(200).optional(),
      }),
      req.body,
    );
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.userId) as
      | { id: string; role: Role; is_active: number }
      | undefined;
    if (!user) throw new ApiError(404, 'Administrator not found.', 'user_not_found');
    if (user.id === req.admin!.id && input.isActive === false) {
      throw new ApiError(400, 'You cannot deactivate your own account.', 'self_deactivate');
    }
    if (user.id === req.admin!.id && input.role && input.role !== 'super_admin') {
      throw new ApiError(400, 'You cannot remove your own super administrator role.', 'self_demote');
    }
    const sets: string[] = [];
    const values: (string | number)[] = [];
    if (input.name !== undefined) {
      sets.push('name = ?');
      values.push(input.name);
    }
    if (input.role !== undefined) {
      sets.push('role = ?');
      values.push(input.role);
    }
    if (input.isActive !== undefined) {
      sets.push('is_active = ?');
      values.push(input.isActive ? 1 : 0);
      if (!input.isActive) db.prepare('UPDATE sessions SET revoked = 1 WHERE user_id = ?').run(user.id);
    }
    if (input.password) {
      sets.push('password_hash = ?');
      values.push(hashPassword(input.password));
      db.prepare('UPDATE sessions SET revoked = 1 WHERE user_id = ?').run(user.id);
    }
    if (sets.length) {
      values.push(user.id);
      db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    }
    recordAudit(req, 'user.update', 'user', user.id, { fields: Object.keys(input) });
    res.json({ ok: true });
  }),
);
