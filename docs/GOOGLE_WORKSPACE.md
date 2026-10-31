# Google Workspace integration notes

Everything here was read from the live resources (read-only) before writing code. No existing file, sheet, form,
trigger or template was modified.

## 1. Resources

| Resource | ID | Use |
| --- | --- | --- |
| Spreadsheet (Form responses) | `1jiVDFpIxGwfSlHBt3vaHl-5GFd8DPGapSS4tsR-FhJQ` | Form responses, `Quiz Results`, `Logs`, `Settings` |
| Slides template | `1dkfJ6PQtmeDEkcNR4xJWsWrLjSu5pkAnvY3JY44_ISo` | Copied for every certificate; never edited |
| Generated folder | `1SDdCpIQHvf_WP0o9vC0ZrLHEb9vt0Q6Y` | PDF output |
| Apps Script project | `16hTGWLwIvGNZqPMQXdDUMasc8kZFg2atwkfWi50X9vg0zgjLUUf3MejZ` | Existing automation; bridge added later |
| Admin mailbox | `certificate.trp.srmtrichy@gmail.com` | Existing sender / test recipient |

## 2. Sheet structure

`Form Responses 1` — 15 columns, unchanged:

```
Timestamp · Email Address · Participant Full Name · Register Number · Department ·
Course Name · Conducted By · Course Duration · Timestamp(2) ·
Certificate ID · Certificate URL · Slide File ID · Mail Status · Error · Sent At
```

- New website registrations and certificates **upsert by Certificate ID**; existing Form rows are matched, not
  duplicated.
- `Quiz Results` is written by the platform (one row per attempt, upserted by Attempt ID).
- `Logs` receives operational entries.
- `Settings` holds TEMPLATE_ID, output folder, prefix, year, next number and timezone. The certificate sequence is
  reserved atomically inside the app, then written back, so a crash cannot reuse a number.

**Rules enforced by the code**

1. No column is renamed, reordered or deleted.
2. No existing row is deleted or overwritten in place unless it is the same Certificate ID being updated
   (`Mail Status`, `Error`, `Sent At` after a resend).
3. Formulas are never written over: the sync only writes the columns it owns.
4. A backup is taken by the operator before the first production sync (see `docs/DEPLOYMENT.md`).

## 3. Slides template placeholders (audited)

The live template contains **exactly seven** placeholders on slide `g3f943d42bc4_0_2`:

| Placeholder | Element |
| --- | --- |
| `{{NAME}}` | `g3f943d42bc4_0_12` |
| `{{COURSE_NAME}}` | `g3f943d42bc4_0_14` |
| `{{ISSUE_DATE}}` | `g3f943d42bc4_0_20` |
| `{{QR_CODE}}` | `g3f943d42bc4_0_24` |
| `{{COORDINATOR_SIGNATURE}}` | `g3f57cdc292b_0_6` |
| `{{HOD_SIGNATURE}}` | `g3f57cdc292b_0_7` |
| `{{PRINCIPAL_SIGNATURE}}` | `g3f57cdc292b_0_8` |

There is **no** `{{STUDENT_NAME}}`, `{{WORKSHOP_TITLE}}`, `{{INSTITUTION_NAME}}`, `{{CLUB_NAME}}` or
`{{CERTIFICATE_ID}}` in the current template, although the older `apps-script/CertificateService.gs` still replaces
those names. The new pipeline replaces the seven tokens that exist; the old function is left untouched so the
existing trigger keeps working. Signatures are already embedded images in the template and are not replaced.

`{{QR_CODE}}` is replaced with a scannable QR image in the Google API provider (temporary upload, inserted, then
removed) and by `insertImage(blob)` in the bridge. The certificate ID itself is printed on the certificate and in the
verification page/email; it is also stored in the Sheet.

## 4. Numbering

Format: `{PREFIX}{YEAR}-{NNNN}` → e.g. `SRMTRP/EEE/VAC/-2026-0016` (the college's prefix already ends with `/`, so
the separator shown in the Sheet is retained exactly as the existing rows have it).

- `CERT_PREFIX=SRMTRP/EEE/VAC/`, `CERT_YEAR=2026`, `CERT_START_NUMBER=15` → first issued number is 16.
- The counter lives in the app settings and is mirrored into the Sheet's `Settings` tab, so the old Form automation
  and the website do not collide. Keep both pointed at the same counter when the bridge goes live.

## 5. Existing automation and triggers

- The Form → Sheet → certificate automation stays in place. The platform never deletes or edits its trigger.
- **Do not assume Sheets API writes fire Form-submit triggers** — they do not. The website therefore calls the same
  reusable issuance logic itself instead of relying on a trigger.
- When the bridge is installed, the plan is to extract the body of `generateCertificateForStudent` into one shared
  function and call it from both paths (`onFormSubmit` and the new `doPost`). Until then, the platform's own
  provider performs the equivalent steps (copy → replace → PDF → folder → sheet → mail).
- If the Apps Script source is later replaced or moved and the URL is unknown, stop and ask the coordinator for the
  project URL before modifying it — do not guess.

## 6. Verification

`/verify/<certificateId>` (public) returns holder name, course, issue date and organization, never scores or email
addresses. QR codes point to the same page. The certificate PDF is downloadable from
`/api/public/certificates/<id>/download`.
