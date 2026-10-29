# Google Form Apps Script Workflow Preservation & Migration Strategy

**Author:** EMBEDX Technical Team
**Super Admin:** Hariharan V (`814725105014@trp.srmtrichy.edu.in`)
**Context:** Migration from legacy Google Form workflow to EMBEDX Standalone Web App

---

## 1. Context & Purpose

The EMBEDX club previously utilized a Google Form tied to a Google Sheet with container-bound Google Apps Script logic (`onFormSubmit`) to collect student responses, log test submissions, and generate basic completion certificates.

To guarantee zero operational risk for the workshop on **30 October 2026**, the legacy Google Form workflow must be **completely preserved as an active fallback** until the new platform is verified.

---

## 2. Inventory & Comparison: Legacy vs. New Architecture

| Feature | Legacy Google Form Workflow | New EMBEDX Web App Platform | Migration Action |
| :--- | :--- | :--- | :--- |
| **Project Type** | Container-bound to Google Form / Sheet | Standalone Google Apps Script Web App | **Separate**: Isolated Script ID to eliminate interference. |
| **Authentication** | Student types email or Google Form domain collection | Server-verified Google Workspace Session (`@trp.srmtrichy.edu.in`) | **Replaced**: Eliminates impersonation. |
| **Question Display** | All questions exposed upfront via Google Form | Staged, timed interface with server-side countdown | **Replaced**: Enhanced quiz interface. |
| **Answer Security** | Client receives answer validation data | Zero-leak: answers validated solely on the server | **Replaced**: Complete cheat resistance. |
| **Phased Gating** | None (Single Form or multiple disconnected Forms) | Phase 1 & Phase 2 state engine with prerequisites | **New Feature**: Enforces topic mastery. |
| **Certificate Engine**| Container-bound script replaces slide shapes | Idempotent service, custom certificate ID, Drive PDF export | **Refactored & Enhanced**: Slide template approach preserved. |
| **Live Leaderboard** | Static pivot table or manual formulas in Sheet | Dynamic real-time calculation with privacy masking | **New Feature**: Live near-instant updates. |
| **Admin Control** | Direct sheet editing | Protected Admin Dashboard with RBAC & audit logging | **New Feature**: Super Admin delegation & management. |

---

## 3. Preservation of Legacy Google Form Script

If the previous script is online, follow these exact steps to create an isolated local backup:

### Step 1: Install & Authenticate Clasp
```bash
# Ensure Node.js is present (Node v24.21.0 is installed locally)
npm install -g @google/clasp

# Login with authorized Google Workspace account
clasp login
```

### Step 2: Clone Legacy Script into an Isolated Backup Directory
```bash
# Navigate outside the active repository or to a dedicated backup directory
mkdir legacy-apps-script-backup
cd legacy-apps-script-backup

# Clone by legacy Script ID (replace with actual legacy script ID)
clasp clone "<LEGACY_SCRIPT_ID>"
```

### Step 3: Safeguard Existing Triggers
Do **NOT** disable or delete the existing `onFormSubmit` trigger on the Google Form spreadsheet. Keep the Form open and ready to distribute to students should internet connectivity or institutional permissions experience unexpected disruption during the workshop.

---

## 4. Reusable Logic & Code Refactoring Map

### Reused Components:
1. **Google Slides Template Mapping Logic:**
   - The method of opening a Slide presentation template, copying it, and replacing text placeholders (`{{NAME}}`, `{{DATE}}`) is refined and modernized into `CertificateService.gs`.
2. **Drive PDF Export:**
   - Converting the modified presentation into a Blob (`getAs('application/pdf')`) and saving it to a designated Drive folder is retained with added private permission restrictions.

### Refactored Components:
1. **Email Delivery:**
   - The legacy `MailApp.sendEmail()` calls lacked retry queues, duplicate tracking, and quota monitoring. These are refactored into `EmailService.gs` with an `EMAIL_LOG` sheet and `DRY_RUN_MODE` safety switch.
2. **Sheet Record Appends:**
   - Upgraded from simple `sheet.appendRow()` to structured schema mapping with UUIDs and concurrency locking (`LockService`).

### Brand New Components:
1. `Auth.gs`: Domain lockdown, Super Admin privilege verification, dynamic Admin delegation.
2. `QuizService.gs`: Server-side scoring engine with zero answer leakage.
3. `PhaseService.gs`: Two-tier phase completion logic.
4. `AdminService.gs`: CSV question importer with schema validation.
5. `AuditService.gs`: Comprehensive administrative action trail.

---

## 5. Cutover & Acceptance Protocol

The official cutover from Google Forms to the new EMBEDX Portal occurs when:
1. Super Admin Hariharan V tests Google Workspace sign-in with `@trp.srmtrichy.edu.in`.
2. A pilot student completes a test quiz and score is recorded accurately.
3. Leaderboard displays real-time ranking with deterministic tie-breaking.
4. Phase 1 and Phase 2 progress indicators increment accurately.
5. Test certificate generates cleanly with student name and workshop title.
