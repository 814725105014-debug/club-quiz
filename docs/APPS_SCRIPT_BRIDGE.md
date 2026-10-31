# Apps Script bridge (additive, not yet deployed)

The web app can run fully in `mock` mode, call Google APIs directly, or delegate to the **existing** Apps Script
project through a signed web app. The bridge is the recommended production path because it keeps OAuth inside
Google, reuses the college's issuance code, and requires no service-account key on the server.

> Nothing is deployed by this repository. Adding the bridge is a deliberate, reviewed step in the Apps Script
> editor. Until then the app stays on `GOOGLE_PROVIDER=mock`.

## 1. Contract

`POST <webhook-url>` with JSON:

```json
{
  "action": "issue_certificate",
  "secret": "<APPS_SCRIPT_SHARED_SECRET>",
  "payload": { "...": "action specific" }
}
```

Response: `{ "ok": true, ...data }` or `{ "ok": false, "error": "message" }` with HTTP 200 (Apps Script cannot set
arbitrary status codes reliably); the client treats `ok:false` as a retryable failure.

| Action | Payload | Response |
| --- | --- | --- |
| `ping` | `{}` | `{ ok, message, spreadsheet, tabs? }` |
| `list_tabs` | `{}` | `{ ok, tabs: string[] }` |
| `read_sheet` | `{ tab }` | `{ ok, headers: string[], rows: string[][] }` |
| `write_sheet_row` | `{ tab, mode, keyColumn?, keyValue?, headers?, values }` | `{ ok, updated: boolean }` |
| `issue_certificate` | `{ certificateId, participant, quiz, score, totalMarks, percentage, passed, issueDate, verifyUrl, templateId, folderId, qrPngBase64 }` | `{ ok, pdfUrl, driveFileId, slideFileId }` |
| `send_email` | `{ to, subject, html, from, fromName, attachment: { filename, driveFileId } }` | `{ ok, messageId }` |

`write_sheet_row` with `mode:"upsert"` matches `values[0]` against `keyColumn` and updates that row; otherwise it
appends. Headers are written only when the tab is empty.

## 2. Install

1. Open the Apps Script project `16hTGWLwIvGNZqPMQXdDUMasc8kZFg2atwkfWi50X9vg0zgjLUUf3MejZ`.
2. Add `apps-script-bridge/CertificateBridge.gs` (File → New → Script). Do not delete or rewrite existing files.
3. Script properties:
   - `QUIZ_PLATFORM_SECRET` — same value as the server's `APPS_SCRIPT_SHARED_SECRET`.
   - `QUIZ_PLATFORM_SPREADSHEET_ID`, `QUIZ_PLATFORM_TEMPLATE_ID`, `QUIZ_PLATFORM_OUTPUT_FOLDER_ID`.
4. Deploy → New deployment → **Web app** → Execute as *Me* → Who has access *Anyone* (or *Anyone with a Google
   account* if the server can mint an ID token).
5. Put the `/exec` URL into `APPS_SCRIPT_WEBHOOK_URL`, set `GOOGLE_PROVIDER=apps_script`, restart, then
   **Admin → Settings → Test connection**.
6. Run **one** certificate for the admin's own registration before allowing participants.

## 3. Reusing the existing issuance function

The bridge's `issueCertificate_` is intentionally thin:

1. Validate the secret.
2. Copy `QUIZ_PLATFORM_TEMPLATE_ID` into `QUIZ_PLATFORM_OUTPUT_FOLDER_ID`
   (`DriveApp.getFileById(...).makeCopy(name, folder)`).
3. Replace `{{NAME}}`, `{{COURSE_NAME}}`, `{{ISSUE_DATE}}` and the three signature tokens with `SlidesApp` text
   replacement (signature text is optional — the template may already hold signature images).
4. Insert the QR image over `{{QR_CODE}}` with `insertImage(blob)`, using the PNG that the server sends as
   `qrPngBase64` (no external QR service; the raw API cannot insert a private blob image).
5. Export PDF (`slides.getAs('application/pdf')`), save it next to the copy, return `pdfUrl` + file IDs.
6. Optionally call the existing `generateCertificateForStudent` for the legacy Form path — but never modify it in
   place without the coordinator's review. The two entry points must share one function, not duplicate logic.

If the existing function is later refactored, extract the replacement table into a single constant and have both the
Form trigger and the bridge call it. The template has changed placeholders once already (see
`docs/GOOGLE_WORKSPACE.md`), so read the template at runtime and warn on unknown tokens rather than failing silently.

## 4. Operational notes

- Shared secret is the only gate: rotate it if the URL leaks, and update both sides together.
- Apps Script quotas: ~20k URL-fetch calls/day and 90 min/day of execution — far above a college quiz's needs, but
  avoid retry storms. The platform retries with exponential backoff (max 5 attempts) and exposes a manual retry.
- `LockService.getScriptLock()` guards counter increments and row upserts.
- Apps Script writes to the Sheet **do not** fire Form-submit triggers; the platform therefore issues certificates
  itself instead of inserting rows and waiting.
