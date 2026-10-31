# EMBEDX Platform Setup Guide

**Institution:** SRM TRP Engineering College (Autonomous), Tiruchirappalli
**Department:** Electrical and Electronics Engineering (EEE)
**Club:** EMBEDX – Embedded Systems & Automation Club
**Target Event:** *Basics of Embedded Systems and Embedded Programming Language*
**Date:** 30 October 2026 (Friday)
**Super Admin:** Hariharan V (`814725105014@trp.srmtrichy.edu.in`)

---

## 1. Prerequisites

- Node.js `v24+` and npm `11+` (Verified locally).
- Google Account with access to SRM TRP Google Workspace (`@trp.srmtrichy.edu.in`).
- Google Chrome or Edge browser.
- Git (configured on Windows).

---

## 2. Local Environment Setup

1. Open PowerShell in `c:\EmbedX`:
   ```powershell
   cd c:\EmbedX
   ```
2. Verify test suite execution:
   ```powershell
   node tests\run_all_tests.js
   ```

---

## 3. Google Cloud & Apps Script Project Setup

Follow these exact steps to create the Google Apps Script Web App:

### Step 3.1: Create Google Spreadsheet (Database)
1. Go to [Google Sheets](https://sheets.new) while logged into your `@trp.srmtrichy.edu.in` account.
2. Name the spreadsheet: `EMBEDX_Quiz_Platform_2026_Database`.
3. Copy the Spreadsheet ID from the URL (the long string between `/d/` and `/edit`):
   ```
   https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit
   ```
4. Keep the spreadsheet empty or run the initialization script once deployed. The script will automatically create and format all 13 required sheets (`USERS`, `SESSIONS`, `PHASES`, `QUIZZES`, `QUESTIONS`, `ATTEMPTS`, `ANSWERS`, `RESULTS`, `PHASE_PROGRESS`, `CERTIFICATES`, `EMAIL_LOG`, `AUDIT_LOG`, `APP_SETTINGS`).

### Step 3.2: Create Standalone Apps Script Project
1. Navigate to [Google Apps Script Home](https://script.google.com/home/start).
2. Click **New Project**.
3. Name the project: `EMBEDX Quiz & Certification Engine`.
4. Upload or paste the files from `apps-script/`:
   - `Config.gs`
   - `Auth.gs`
   - `Setup.gs`
   - `StudentService.gs`
   - `SessionService.gs`
   - `PhaseService.gs`
   - `QuizService.gs`
   - `LeaderboardService.gs`
   - `AdminService.gs`
   - `CertificateService.gs`
   - `EmailService.gs`
   - `AuditService.gs`
   - `Code.gs`
   - `Styles.html`
   - `Client.html`
   - `Index.html`
   - `appsscript.json` (Open Project Settings -> Check "Show 'appsscript.json' manifest file in editor" and paste content).

---

## 4. Script Properties Configuration

In the Apps Script Editor:
1. Click the gear icon (**Project Settings**).
2. Scroll down to **Script Properties** and click **Add script property**.
3. Add the following key-value pairs:

| Property Key | Example / Recommended Value | Description |
| :--- | :--- | :--- |
| `SPREADSHEET_ID` | `<YOUR_COPIED_SPREADSHEET_ID>` | The ID of your created Google Spreadsheet |
| `SUPER_ADMIN_EMAIL` | `814725105014@trp.srmtrichy.edu.in` | Root Super Admin account |
| `ADMIN_EMAILS` | `814725105014@trp.srmtrichy.edu.in` | Comma-separated list of initial administrator emails |
| `DRY_RUN_MODE` | `true` | Keep `true` during development to prevent real email sends |
| `SLIDES_TEMPLATE_ID` | `<YOUR_GOOGLE_SLIDES_TEMPLATE_ID>` | (Optional) Template ID for completion certificates |
| `CERTIFICATE_FOLDER_ID` | `<YOUR_GOOGLE_DRIVE_FOLDER_ID>` | (Optional) Private Drive folder ID to store generated PDFs |

---

## 5. First-Time Database Initialization

1. In the Apps Script code editor, select the file `Setup.gs`.
2. From the function dropdown at the top, select `initDatabase`.
3. Click **Run**.
4. A Google prompt will appear: **Authorization Required**.
   - Click **Review Permissions**.
   - Select your `@trp.srmtrichy.edu.in` account.
   - Click **Advanced** -> **Go to EMBEDX Quiz & Certification Engine (unsafe)**.
   - Click **Allow**.
5. Once execution finishes, inspect your Google Spreadsheet:
   - All 13 sheets will be created with styled headers and frozen rows.
   - Initial 5 workshop sessions, Phase 1 & Phase 2 settings, and a starter technical quiz (`QUIZ-EMB-01`) will be seeded automatically.

---

## 6. Developing Locally with Clasp (Optional)

To push changes from your local repository to Google Apps Script via CLI:
```bash
# 1. Install clasp
npm install -g @google/clasp

# 2. Login to your institutional Google account
clasp login

# 3. In apps-script directory, create or link your project:
cd c:\EmbedX\apps-script
clasp clone "<YOUR_SCRIPT_ID>"

# 4. Push local changes
clasp push
```
