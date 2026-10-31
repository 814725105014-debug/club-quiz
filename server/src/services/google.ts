import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { google, type Auth } from 'googleapis';
import { env } from '../env.js';
import { getDb } from '../db.js';
import { getWorkspaceConfig, type WorkspaceConfig } from './config.js';
import { formatDate } from '../lib/time.js';
import { randomCode } from '../lib/ids.js';

export interface CertificateInput {
  certificateId: string;
  participant: { name: string; email: string; regNumber?: string | null; department?: string | null };
  quiz: { title: string; courseName: string; conductedBy?: string | null; duration?: string | null };
  score: number;
  totalMarks: number;
  percentage: number;
  passed: boolean;
  issueDateIso: string;
  verifyUrl: string;
  templateId?: string;
  folderId?: string;
}

export interface CertificateArtifact {
  pdfUrl: string;
  driveFileId: string;
  slideFileId: string;
  provider: string;
}

export interface SheetWrite {
  tab: string;
  mode: 'append' | 'upsert';
  keyColumn?: string;
  keyValue?: string;
  headers?: string[];
  values: (string | number | null)[];
}

export interface EmailAttachment {
  filename: string;
  driveFileId?: string;
  localPath?: string;
}

export interface EmailInput {
  to: string;
  subject: string;
  html: string;
  attachment?: EmailAttachment;
}

export interface EmailResult {
  messageId: string;
}

export interface SheetTable {
  tab: string;
  headers: string[];
  rows: (string | number | null)[][];
}

export interface GoogleProvider {
  readonly name: string;
  issueCertificate(input: CertificateInput, cfg: WorkspaceConfig): Promise<CertificateArtifact>;
  writeSheetRow(row: SheetWrite, cfg: WorkspaceConfig): Promise<void>;
  readSheet(tab: string, cfg: WorkspaceConfig): Promise<SheetTable>;
  listTabs(cfg: WorkspaceConfig): Promise<string[]>;
  sendEmail(input: EmailInput, cfg: WorkspaceConfig): Promise<EmailResult>;
  status(cfg: WorkspaceConfig): Promise<{ ok: boolean; message: string }>;
}

/* ------------------------------------------------------------------ */
/* Mock provider — used for local development and automated testing    */
/* ------------------------------------------------------------------ */

export function certificateFileName(certificateId: string): string {
  return `${certificateId.replace(/[^A-Za-z0-9]+/g, '-')}.pdf`;
}

export class MockProvider implements GoogleProvider {
  readonly name = 'mock';

  async issueCertificate(input: CertificateInput, cfg: WorkspaceConfig): Promise<CertificateArtifact> {
    const filePath = path.join(env.certDir, certificateFileName(input.certificateId));
    await renderCertificatePdf(input, cfg, filePath);
    const pdfUrl = `${cfg.appBaseUrl}/api/public/certificates/${encodeURIComponent(
      input.certificateId,
    )}/download`;
    return {
      pdfUrl,
      driveFileId: `mock-drive-${randomCode(10)}`,
      slideFileId: `mock-slide-${randomCode(10)}`,
      provider: this.name,
    };
  }

  async writeSheetRow(row: SheetWrite, _cfg: WorkspaceConfig): Promise<void> {
    const db = getDb();
    if (row.mode === 'upsert' && row.keyValue) {
      const existing = db
        .prepare('SELECT id FROM sheet_mirror WHERE tab = ? AND row_key = ?')
        .get(row.tab, row.keyValue) as { id: number } | undefined;
      if (existing) {
        db.prepare(
          `UPDATE sheet_mirror SET row_values = ?, updated_at = datetime('now') WHERE id = ?`,
        ).run(JSON.stringify(row.values), existing.id);
        return;
      }
    }
    db.prepare('INSERT INTO sheet_mirror (tab, row_key, row_values) VALUES (?, ?, ?)').run(
      row.tab,
      row.keyValue ?? null,
      JSON.stringify(row.values),
    );
  }

  async readSheet(tab: string, _cfg: WorkspaceConfig): Promise<SheetTable> {
    const rows = getDb()
      .prepare('SELECT row_values FROM sheet_mirror WHERE tab = ? ORDER BY id ASC LIMIT 5000')
      .all(tab) as { row_values: string }[];
    return { tab, headers: [], rows: rows.map((r) => JSON.parse(r.row_values)) };
  }

  async listTabs(_cfg: WorkspaceConfig): Promise<string[]> {
    return ['Form Responses 1', 'Quiz Results', 'Logs', 'Settings'];
  }

  async sendEmail(input: EmailInput, cfg: WorkspaceConfig): Promise<EmailResult> {
    const id = `mock-msg-${randomCode(12)}`;
    const outbox = path.join(env.dataDir, 'outbox');
    if (!fs.existsSync(outbox)) fs.mkdirSync(outbox, { recursive: true });
    const record = {
      id,
      to: input.to,
      subject: input.subject,
      html: input.html,
      attachment: input.attachment
        ? {
            filename: input.attachment.filename,
            localPath: input.attachment.localPath ? path.basename(input.attachment.localPath) : null,
            driveFileId: input.attachment.driveFileId ?? null,
          }
        : null,
      queuedAt: new Date().toISOString(),
      provider: 'mock',
      from: cfg.emailFrom,
    };
    fs.writeFileSync(path.join(outbox, `${id}.json`), JSON.stringify(record, null, 2), 'utf8');
    return { messageId: id };
  }

  async status(_cfg: WorkspaceConfig): Promise<{ ok: boolean; message: string }> {
    return {
      ok: true,
      message:
        'Mock provider active. Certificates are rendered as local PDFs, sheet writes are mirrored locally and emails are written to data/outbox.',
    };
  }
}

/* ------------------------------------------------------------------ */
/* Apps Script bridge provider — recommended production path           */
/* ------------------------------------------------------------------ */

async function callBridge(
  payload: Record<string, unknown>,
  cfg: WorkspaceConfig,
): Promise<Record<string, unknown>> {
  if (!cfg.webhookUrl) {
    throw new Error(
      'Apps Script bridge URL is not configured. Set it in Admin → Settings → Google Workspace.',
    );
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const res = await fetch(cfg.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, secret: cfg.sharedSecret }),
      signal: controller.signal,
      redirect: 'follow',
    });
    const text = await res.text();
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error(`Apps Script bridge returned a non-JSON response (HTTP ${res.status}).`);
    }
    if (!res.ok || json.ok === false) {
      throw new Error(String(json.error ?? `Apps Script bridge error (HTTP ${res.status})`));
    }
    return json;
  } finally {
    clearTimeout(timeout);
  }
}

export class AppsScriptProvider implements GoogleProvider {
  readonly name = 'apps_script';

  async issueCertificate(input: CertificateInput, cfg: WorkspaceConfig): Promise<CertificateArtifact> {
    const res = await callBridge(
      {
        action: 'issue_certificate',
        templateId: input.templateId || cfg.templateId,
        folderId: input.folderId || cfg.outputFolderId,
        certificateId: input.certificateId,
        issueDate: input.issueDateIso,
        verifyUrl: input.verifyUrl,
        participant: input.participant,
        quiz: input.quiz,
        score: input.score,
        totalMarks: input.totalMarks,
        percentage: input.percentage,
        passed: input.passed,
        spreadsheetId: cfg.spreadsheetId,
      },
      cfg,
    );
    return {
      pdfUrl: String(res.pdfUrl ?? ''),
      driveFileId: String(res.driveFileId ?? ''),
      slideFileId: String(res.slideFileId ?? ''),
      provider: this.name,
    };
  }

  async writeSheetRow(row: SheetWrite, cfg: WorkspaceConfig): Promise<void> {
    await callBridge(
      {
        action: 'write_sheet_row',
        spreadsheetId: cfg.spreadsheetId,
        tab: row.tab,
        mode: row.mode,
        keyColumn: row.keyColumn,
        keyValue: row.keyValue,
        headers: row.headers,
        values: row.values,
      },
      cfg,
    );
  }

  async readSheet(tab: string, cfg: WorkspaceConfig): Promise<SheetTable> {
    const res = await callBridge(
      { action: 'read_sheet', spreadsheetId: cfg.spreadsheetId, tab },
      cfg,
    );
    return {
      tab,
      headers: (res.headers as string[]) ?? [],
      rows: (res.rows as (string | number | null)[][]) ?? [],
    };
  }

  async listTabs(cfg: WorkspaceConfig): Promise<string[]> {
    const res = await callBridge(
      { action: 'list_tabs', spreadsheetId: cfg.spreadsheetId },
      cfg,
    );
    return (res.tabs as string[]) ?? [];
  }

  async sendEmail(input: EmailInput, cfg: WorkspaceConfig): Promise<EmailResult> {
    const res = await callBridge(
      {
        action: 'send_email',
        to: input.to,
        subject: input.subject,
        html: input.html,
        fromName: cfg.emailFromName,
        attachment: input.attachment
          ? { filename: input.attachment.filename, driveFileId: input.attachment.driveFileId ?? null }
          : null,
      },
      cfg,
    );
    return { messageId: String(res.messageId ?? `bridge-${randomCode(8)}`) };
  }

  async status(cfg: WorkspaceConfig): Promise<{ ok: boolean; message: string }> {
    if (!cfg.webhookUrl) return { ok: false, message: 'Bridge webhook URL is not configured.' };
    try {
      const res = await callBridge({ action: 'ping' }, cfg);
      return { ok: true, message: String(res.message ?? 'Apps Script bridge reachable.') };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }
}

/* ------------------------------------------------------------------ */
/* Direct Google API provider (service account or OAuth refresh token) */
/* ------------------------------------------------------------------ */

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/presentations',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/gmail.send',
];

function serviceAccountCredentials(): { client_email: string; private_key: string } | undefined {
  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (inline) {
    const parsed = JSON.parse(inline) as { client_email: string; private_key: string };
    return { client_email: parsed.client_email, private_key: parsed.private_key };
  }
  if (env.google.serviceAccountFile && fs.existsSync(env.google.serviceAccountFile)) {
    const parsed = JSON.parse(fs.readFileSync(env.google.serviceAccountFile, 'utf8')) as {
      client_email: string;
      private_key: string;
    };
    return { client_email: parsed.client_email, private_key: parsed.private_key };
  }
  return undefined;
}

function getGoogleAuth(): Auth.OAuth2Client {
  const sa = serviceAccountCredentials();
  if (sa) {
    return new google.auth.JWT({
      email: sa.client_email,
      key: sa.private_key,
      scopes: SCOPES,
      subject: env.google.impersonateEmail || undefined,
    });
  }
  if (env.google.oauthClientId && env.google.oauthClientSecret && env.google.oauthRefreshToken) {
    const client = new google.auth.OAuth2(
      env.google.oauthClientId,
      env.google.oauthClientSecret,
      'urn:ietf:wg:oauth:2.0:oob',
    );
    client.setCredentials({ refresh_token: env.google.oauthRefreshToken });
    return client;
  }
  throw new Error(
    'No Google credentials configured. Set GOOGLE_SERVICE_ACCOUNT_FILE (with domain-wide delegation) or the OAuth client + refresh token environment variables.',
  );
}

function columnLetter(index: number): string {
  let n = index + 1;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

export class GoogleApiProvider implements GoogleProvider {
  readonly name = 'google_api';

  private clients() {
    const auth = getGoogleAuth();
    return {
      sheets: google.sheets({ version: 'v4', auth }),
      slides: google.slides({ version: 'v1', auth }),
      drive: google.drive({ version: 'v3', auth }),
      gmail: google.gmail({ version: 'v1', auth }),
    };
  }

  async issueCertificate(input: CertificateInput, cfg: WorkspaceConfig): Promise<CertificateArtifact> {
    const { drive, slides } = this.clients();
    const templateId = input.templateId || cfg.templateId;
    const folderId = input.folderId || cfg.outputFolderId;

    const copyName = `${input.participant.name} - ${input.certificateId}`;
    const copy = await drive.files.copy({
      fileId: templateId,
      supportsAllDrives: true,
      requestBody: { name: copyName, parents: folderId ? [folderId] : undefined },
      fields: 'id,webViewLink',
    });
    const slideFileId = copy.data.id as string;

    const replacements: Record<string, string> = {
      '{{NAME}}': input.participant.name,
      '{{COURSE_NAME}}': input.quiz.courseName,
      '{{ISSUE_DATE}}': formatDate(input.issueDateIso),
      '{{REGISTRATION_NUMBER}}': input.participant.regNumber ?? '',
      '{{EMAIL}}': input.participant.email,
      '{{DEPARTMENT}}': input.participant.department ?? '',
      '{{QUIZ_TITLE}}': input.quiz.title,
      '{{SCORE}}': `${input.score} / ${input.totalMarks}`,
      '{{PERCENTAGE}}': `${input.percentage.toFixed(2)}%`,
      '{{CERTIFICATE_ID}}': input.certificateId,
      '{{QR_CODE}}': '',
    };

    const requests: Record<string, unknown>[] = Object.entries(replacements).map(([text, replaceText]) => ({
      replaceAllText: { containsText: { text, matchCase: true }, replaceText },
    }));

    // Insert the verification QR image over the {{QR_CODE}} placeholder before it is cleared.
    const qrBuffer = await QRCode.toBuffer(input.verifyUrl, { margin: 1, width: 420 });
    let qrObjectId: string | undefined;
    try {
      const pres = await slides.presentations.get({
        presentationId: slideFileId,
        fields: 'slides(objectId,pageElements(objectId,size,transform,shape(text(textElements(textRun(content))))))',
      });
      for (const slide of pres.data.slides ?? []) {
        for (const el of slide.pageElements ?? []) {
          const text = (el.shape?.text?.textElements ?? [])
            .map((te) => te.textRun?.content ?? '')
            .join('');
          if (text.includes('{{QR_CODE}}')) {
            const qrFile = await drive.files.create({
              requestBody: { name: `${input.certificateId}-QR.png`, parents: folderId ? [folderId] : undefined },
              media: { mimeType: 'image/png', body: Buffer.from(qrBuffer) },
              fields: 'id',
            });
            await drive.permissions.create({
              fileId: qrFile.data.id as string,
              requestBody: { role: 'reader', type: 'anyone' },
            });
            const width = el.size?.width?.magnitude ?? 1_500_000;
            const height = el.size?.height?.magnitude ?? 1_500_000;
            qrObjectId = `qr_${Date.now()}`;
            requests.push({
              createImage: {
                objectId: qrObjectId,
                url: `https://drive.google.com/uc?export=view&id=${qrFile.data.id}`,
                elementProperties: {
                  pageObjectId: slide.objectId,
                  size: { width: { magnitude: width, unit: 'EMU' }, height: { magnitude: height, unit: 'EMU' } },
                  transform: {
                    scaleX: el.transform?.scaleX ?? 1,
                    scaleY: el.transform?.scaleY ?? 1,
                    translateX: el.transform?.translateX ?? 0,
                    translateY: el.transform?.translateY ?? 0,
                    unit: 'EMU',
                  },
                },
              },
            });
            break;
          }
        }
      }
    } catch {
      // QR insertion is best-effort: the certificate is still valid without it.
    }

    if (requests.length) {
      await slides.presentations.batchUpdate({
        presentationId: slideFileId,
        requestBody: { requests: requests as never },
      });
    }

    const exported = await drive.files.export(
      { fileId: slideFileId, mimeType: 'application/pdf' },
      { responseType: 'arraybuffer' },
    );
    const pdfBuffer = Buffer.from(exported.data as ArrayBuffer);
    const pdf = await drive.files.create({
      requestBody: {
        name: `${input.participant.name} - Certificate of Completion.pdf`,
        parents: folderId ? [folderId] : undefined,
        mimeType: 'application/pdf',
      },
      media: { mimeType: 'application/pdf', body: Buffer.from(pdfBuffer) },
      fields: 'id,webViewLink',
    });

    return {
      pdfUrl: (pdf.data.webViewLink as string) ?? '',
      driveFileId: pdf.data.id as string,
      slideFileId,
      provider: this.name,
    };
  }

  private async ensureTab(
    sheets: ReturnType<GoogleApiProvider['clients']>['sheets'],
    cfg: WorkspaceConfig,
    tab: string,
    headers?: string[],
  ): Promise<string> {
    const quoted = `'${tab.replace(/'/g, "''")}'`;
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: cfg.spreadsheetId,
      fields: 'sheets(properties(title))',
    });
    const exists = (meta.data.sheets ?? []).some((s) => s.properties?.title === tab);
    if (!exists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: cfg.spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] },
      });
      if (headers?.length) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: cfg.spreadsheetId,
          range: `${quoted}!A1`,
          valueInputOption: 'RAW',
          requestBody: { values: [headers] },
        });
      }
    }
    return quoted;
  }

  async writeSheetRow(row: SheetWrite, cfg: WorkspaceConfig): Promise<void> {
    const { sheets } = this.clients();
    const quoted = await this.ensureTab(sheets, cfg, row.tab, row.headers);
    if (row.mode === 'upsert' && row.keyColumn && row.keyValue) {
      const table = await this.readSheet(row.tab, cfg);
      const keyIndex = table.headers.findIndex(
        (h) => h.trim().toLowerCase() === row.keyColumn!.toLowerCase(),
      );
      if (keyIndex >= 0) {
        const rowIndex = table.rows.findIndex(
          (r) => String(r[keyIndex] ?? '').trim() === String(row.keyValue).trim(),
        );
        if (rowIndex >= 0) {
          const sheetRow = rowIndex + 2; // header offset
          await sheets.spreadsheets.values.update({
            spreadsheetId: cfg.spreadsheetId,
            range: `${quoted}!A${sheetRow}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [row.values] },
          });
          return;
        }
      }
    }
    await sheets.spreadsheets.values.append({
      spreadsheetId: cfg.spreadsheetId,
      range: `${quoted}!A1`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row.values] },
    });
  }

  async readSheet(tab: string, cfg: WorkspaceConfig): Promise<SheetTable> {
    const { sheets } = this.clients();
    const quoted = `'${tab.replace(/'/g, "''")}'`;
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: cfg.spreadsheetId,
      range: `${quoted}!A:Z`,
    });
    const values = (res.data.values ?? []) as (string | number)[][];
    const headers = (values[0] ?? []).map((h) => String(h));
    return { tab, headers, rows: values.slice(1) };
  }

  async listTabs(cfg: WorkspaceConfig): Promise<string[]> {
    const { sheets } = this.clients();
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: cfg.spreadsheetId,
      fields: 'sheets(properties(title))',
    });
    return (meta.data.sheets ?? []).map((s) => s.properties?.title ?? '').filter(Boolean);
  }

  async sendEmail(input: EmailInput, cfg: WorkspaceConfig): Promise<EmailResult> {
    const { gmail, drive } = this.clients();
    const boundary = `qp_${randomCode(16)}`;
    let attachmentPart = '';
    if (input.attachment) {
      let bytes: Buffer | undefined;
      if (input.attachment.localPath && fs.existsSync(input.attachment.localPath)) {
        bytes = fs.readFileSync(input.attachment.localPath);
      } else if (input.attachment.driveFileId) {
        const file = await drive.files.get(
          { fileId: input.attachment.driveFileId, alt: 'media', supportsAllDrives: true },
          { responseType: 'arraybuffer' },
        );
        bytes = Buffer.from(file.data as ArrayBuffer);
      }
      if (bytes) {
        attachmentPart = [
          `--${boundary}`,
          `Content-Type: application/pdf; name="${input.attachment.filename}"`,
          'Content-Transfer-Encoding: base64',
          `Content-Disposition: attachment; filename="${input.attachment.filename}"`,
          '',
          bytes.toString('base64').replace(/(.{76})/g, '$1\r\n'),
          '',
        ].join('\r\n');
      }
    }
    const raw = [
      `From: ${cfg.emailFromName} <${cfg.emailFrom}>`,
      `To: ${input.to}`,
      `Subject: =?UTF-8?B?${Buffer.from(input.subject).toString('base64')}?=`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(input.html).toString('base64').replace(/(.{76})/g, '$1\r\n'),
      '',
      attachmentPart,
      `--${boundary}--`,
    ].join('\r\n');

    const sent = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: Buffer.from(raw).toString('base64url') },
    });
    return { messageId: sent.data.id ?? `gmail-${randomCode(8)}` };
  }

  async status(cfg: WorkspaceConfig): Promise<{ ok: boolean; message: string }> {
    try {
      this.clients();
      const { sheets } = this.clients();
      await sheets.spreadsheets.get({ spreadsheetId: cfg.spreadsheetId, fields: 'properties(title)' });
      return { ok: true, message: 'Google API credentials are working and the spreadsheet is reachable.' };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }
}

/* ------------------------------------------------------------------ */
/* Provider selection                                                  */
/* ------------------------------------------------------------------ */

let cachedProvider: { key: string; provider: GoogleProvider } | undefined;

export function getProvider(cfg: WorkspaceConfig = getWorkspaceConfig()): GoogleProvider {
  const key = `${cfg.provider}:${cfg.webhookUrl}:${env.google.dryRun}`;
  if (cachedProvider?.key === key) return cachedProvider.provider;
  let provider: GoogleProvider;
  if (env.google.dryRun) provider = new MockProvider();
  else if (cfg.provider === 'apps_script') provider = new AppsScriptProvider();
  else if (cfg.provider === 'google_api') provider = new GoogleApiProvider();
  else provider = new MockProvider();
  cachedProvider = { key, provider };
  return provider;
}

export function resetProviderCache(): void {
  cachedProvider = undefined;
}

/* ------------------------------------------------------------------ */
/* Mock certificate PDF renderer (mirrors the purple/gold template)    */
/* ------------------------------------------------------------------ */

export async function renderCertificatePdf(
  input: CertificateInput,
  cfg: WorkspaceConfig,
  outPath: string,
): Promise<void> {
  const qrBuffer = await QRCode.toBuffer(input.verifyUrl, {
    margin: 1,
    width: 360,
    color: { dark: '#2B0B3F', light: '#FFFFFF' },
  });

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0, autoFirstPage: true });
    const stream = fs.createWriteStream(outPath);
    doc.pipe(stream);
    stream.on('finish', () => resolve());
    stream.on('error', reject);

    const W = doc.page.width;
    const H = doc.page.height;
    const gold = '#D4AF37';
    const deep = '#2B0B3F';
    const purple = '#43125F';

    doc.rect(0, 0, W, H).fill(deep);
    doc.rect(14, 14, W - 28, H - 28).fill(purple);
    doc.lineWidth(3).strokeColor(gold).rect(30, 30, W - 60, H - 60).stroke();
    doc.lineWidth(0.8).strokeColor(gold).rect(40, 40, W - 80, H - 80).stroke();

    // Corner flourishes
    const corner = (x: number, y: number, sx: number, sy: number) => {
      doc
        .moveTo(x, y + sy * 26)
        .lineTo(x, y)
        .lineTo(x + sx * 26, y)
        .lineWidth(2)
        .strokeColor(gold)
        .stroke();
    };
    corner(52, 52, 1, 1);
    corner(W - 52, 52, -1, 1);
    corner(52, H - 52, 1, -1);
    corner(W - 52, H - 52, -1, -1);

    doc.fillColor(gold).font('Times-Bold').fontSize(13).text(cfg.organizationName.toUpperCase(), 0, 70, {
      align: 'center',
      characterSpacing: 1.6,
    });
    doc.fillColor('#E8D9F5').font('Helvetica').fontSize(8.5).text(cfg.institutionLine, 0, 90, {
      align: 'center',
    });
    doc.fillColor('#E8D9F5').fontSize(8.5).text(cfg.department, 0, 103, { align: 'center' });

    doc.fillColor(gold).font('Times-Bold').fontSize(34).text('CERTIFICATE', 0, 138, {
      align: 'center',
      characterSpacing: 6,
    });
    doc.fontSize(15).fillColor('#F3E6C8').text('OF COMPLETION', 0, 180, {
      align: 'center',
      characterSpacing: 4,
    });

    doc.moveTo(W / 2 - 90, 210).lineTo(W / 2 + 90, 210).lineWidth(1).strokeColor(gold).stroke();

    doc.fillColor('#E8D9F5').font('Helvetica').fontSize(10.5).text('This is to certify that', 0, 228, {
      align: 'center',
    });

    doc
      .fillColor(gold)
      .font('Times-Bold')
      .fontSize(30)
      .text(input.participant.name.toUpperCase(), 60, 250, { align: 'center', width: W - 120 });

    doc.fillColor('#E8D9F5').font('Helvetica').fontSize(10.5).text(
      input.participant.regNumber
        ? `Register No. ${input.participant.regNumber}`
        : 'has successfully completed the course',
      0,
      292,
      { align: 'center' },
    );

    doc.fillColor('#FFFFFF').font('Times-Bold').fontSize(14).text(
      `“${input.quiz.courseName}”`,
      70,
      314,
      { align: 'center', width: W - 140 },
    );

    doc.fillColor('#E8D9F5').font('Helvetica').fontSize(9.5).text(
      `conducted by ${input.quiz.conductedBy || cfg.department}`,
      0,
      352,
      { align: 'center' },
    );

    if (input.quiz.duration) {
      doc.fillColor('#CDB6E0').fontSize(8.5).text(`Duration: ${input.quiz.duration}`, 0, 368, {
        align: 'center',
      });
    }

    doc.fillColor('#F3E6C8').font('Helvetica-Bold').fontSize(9.5).text(
      `Score ${input.score}/${input.totalMarks}  •  ${input.percentage.toFixed(2)}%  •  ${
        input.passed ? 'PASSED' : 'COMPLETED'
      }`,
      0,
      384,
      { align: 'center' },
    );

    // Signature lines
    const sigY = 470;
    const sigs = [
      { label: 'Course Coordinator', x: 120 },
      { label: 'Head of the Department', x: W / 2 - 85 },
      { label: 'Principal', x: W - 290 },
    ];
    for (const s of sigs) {
      doc.moveTo(s.x, sigY).lineTo(s.x + 170, sigY).lineWidth(0.8).strokeColor(gold).stroke();
      doc.fillColor('#E8D9F5').font('Helvetica').fontSize(8.5).text(s.label, s.x, sigY + 6, {
        width: 170,
        align: 'center',
      });
    }

    doc.fillColor(gold).font('Helvetica-Bold').fontSize(8.5).text(`Certificate ID: ${input.certificateId}`, 60, H - 88);
    doc.fillColor('#CDB6E0').font('Helvetica').fontSize(8).text(`Issued on ${formatDate(input.issueDateIso)}`, 60, H - 76);
    doc.fillColor('#CDB6E0').fontSize(7).text('Verify authenticity at', 60, H - 64);
    doc.fillColor('#E8D9F5').fontSize(7).text(input.verifyUrl, 60, H - 55, { width: 380 });

    doc.image(qrBuffer, W - 150, H - 160, { width: 90, height: 90 });
    doc.fillColor('#CDB6E0').fontSize(6.5).text('Scan to verify', W - 155, H - 66, {
      width: 100,
      align: 'center',
    });

    doc.end();
  });
}

export { columnLetter };
