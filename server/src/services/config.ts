import { getSettings, setSetting, getDb } from '../db.js';
import { env } from '../env.js';

export interface WorkspaceConfig {
  provider: 'mock' | 'apps_script' | 'google_api';
  spreadsheetId: string;
  responsesTab: string;
  resultsTab: string;
  logTab: string;
  templateId: string;
  outputFolderId: string;
  certificatePrefix: string;
  certificateYear: number;
  certificateStartNumber: number;
  verifyBaseUrl: string;
  emailFrom: string;
  emailFromName: string;
  webhookUrl: string;
  sharedSecret: string;
  impersonateEmail: string;
  organizationName: string;
  institutionLine: string;
  department: string;
  emailTestMode: boolean;
  emailRedirectTo: string;
  appBaseUrl: string;
}

const DEFAULTS: WorkspaceConfig = {
  provider: env.google.provider,
  spreadsheetId: env.workspace.spreadsheetId,
  responsesTab: env.workspace.responsesTab,
  resultsTab: env.workspace.resultsTab,
  logTab: env.workspace.logTab,
  templateId: env.workspace.templateId,
  outputFolderId: env.workspace.outputFolderId,
  certificatePrefix: env.workspace.certificatePrefix,
  certificateYear: env.workspace.certificateYear,
  certificateStartNumber: env.workspace.certificateStartNumber,
  verifyBaseUrl: env.workspace.verifyBaseUrl,
  emailFrom: env.workspace.emailFrom,
  emailFromName: env.workspace.emailFromName,
  webhookUrl: env.google.webhookUrl,
  sharedSecret: env.google.sharedSecret,
  impersonateEmail: env.google.impersonateEmail,
  organizationName: 'SRM TRP Engineering College (Autonomous)',
  institutionLine: 'SRM Nagar, Samayapuram, Tiruchirappalli – 621 105',
  department: 'Department of Electrical and Electronics Engineering',
  emailTestMode: env.email.testMode,
  emailRedirectTo: env.email.redirectTo,
  appBaseUrl: env.appBaseUrl,
};

const SETTING_KEYS: Record<keyof WorkspaceConfig, string> = {
  provider: 'workspace.provider',
  spreadsheetId: 'workspace.spreadsheetId',
  responsesTab: 'workspace.responsesTab',
  resultsTab: 'workspace.resultsTab',
  logTab: 'workspace.logTab',
  templateId: 'workspace.templateId',
  outputFolderId: 'workspace.outputFolderId',
  certificatePrefix: 'workspace.certificatePrefix',
  certificateYear: 'workspace.certificateYear',
  certificateStartNumber: 'workspace.certificateStartNumber',
  verifyBaseUrl: 'workspace.verifyBaseUrl',
  emailFrom: 'workspace.emailFrom',
  emailFromName: 'workspace.emailFromName',
  webhookUrl: 'workspace.webhookUrl',
  sharedSecret: 'workspace.sharedSecret',
  impersonateEmail: 'workspace.impersonateEmail',
  organizationName: 'workspace.organizationName',
  institutionLine: 'workspace.institutionLine',
  department: 'workspace.department',
  emailTestMode: 'workspace.emailTestMode',
  emailRedirectTo: 'workspace.emailRedirectTo',
  appBaseUrl: 'workspace.appBaseUrl',
};

const BOOLEAN_KEYS: (keyof WorkspaceConfig)[] = ['emailTestMode'];
const NUMBER_KEYS: (keyof WorkspaceConfig)[] = ['certificateYear', 'certificateStartNumber'];

export function getWorkspaceConfig(): WorkspaceConfig {
  const stored = getSettings('workspace.');
  const cfg: WorkspaceConfig = { ...DEFAULTS };
  for (const [key, settingKey] of Object.entries(SETTING_KEYS) as [keyof WorkspaceConfig, string][]) {
    const raw = stored[settingKey];
    if (raw === undefined) continue;
    if (BOOLEAN_KEYS.includes(key)) (cfg[key] as boolean) = raw === 'true';
    else if (NUMBER_KEYS.includes(key)) (cfg[key] as number) = Number(raw);
    else (cfg[key] as string) = raw;
  }
  if (!cfg.appBaseUrl) cfg.appBaseUrl = env.appBaseUrl;
  return cfg;
}

export function updateWorkspaceConfig(patch: Partial<WorkspaceConfig>): WorkspaceConfig {
  for (const [key, value] of Object.entries(patch)) {
    const settingKey = SETTING_KEYS[key as keyof WorkspaceConfig];
    if (!settingKey || value === undefined || value === null) continue;
    setSetting(settingKey, String(value));
  }
  return getWorkspaceConfig();
}

export function publicWorkspaceConfig(): Omit<WorkspaceConfig, 'sharedSecret'> & {
  sharedSecretSet: boolean;
} {
  const cfg = getWorkspaceConfig();
  const { sharedSecret, ...rest } = cfg;
  return { ...rest, sharedSecretSet: Boolean(sharedSecret) };
}

/* ------------------------------------------------------------------ */
/* Certificate sequence                                               */
/* ------------------------------------------------------------------ */

export function nextCertificateNumber(year: number): number {
  const db = getDb();
  const cfg = getWorkspaceConfig();
  const row = db.prepare('SELECT last_number FROM certificate_sequence WHERE year = ?').get(year) as
    | { last_number: number }
    | undefined;
  const current = row ? row.last_number : cfg.certificateStartNumber - 1;
  const next = current + 1;
  db.prepare(
    `INSERT INTO certificate_sequence (year, last_number) VALUES (?, ?)
     ON CONFLICT(year) DO UPDATE SET last_number = excluded.last_number`,
  ).run(year, next);
  return next;
}

export function peekCertificateNumber(year: number): number {
  const cfg = getWorkspaceConfig();
  const row = getDb()
    .prepare('SELECT last_number FROM certificate_sequence WHERE year = ?')
    .get(year) as { last_number: number } | undefined;
  return (row ? row.last_number : cfg.certificateStartNumber - 1) + 1;
}

export function buildCertificateId(serial: number): string {
  const cfg = getWorkspaceConfig();
  const year = cfg.certificateYear;
  const padded = String(serial).padStart(4, '0');
  // Mirrors the existing automation: "SRMTRP/EEE/VAC/-2026-0014" (prefix already ends with "/").
  return `${cfg.certificatePrefix}-${year}-${padded}`;
}
