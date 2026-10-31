# EMBEDX Platform Deployment Guide

**Target Event:** 30 October 2026 (Friday)
**System:** Standalone Google Apps Script Web App + EMBEDX Website Portal
**Domain Requirement:** `@trp.srmtrichy.edu.in`

---

## 1. Web App Deployment Options & Procedure

To deploy the standalone Apps Script application:

### Step 1: Open Apps Script Project
Open your `EMBEDX Quiz & Certification Engine` project at [script.google.com](https://script.google.com).

### Step 2: Create New Deployment
1. Click the blue **Deploy** button in the top right -> **New deployment**.
2. Click the gear icon next to "Select type" and select **Web app**.
3. Configure the deployment settings:
   - **Description:** `EMBEDX Production Release 1.0 (30 Oct 2026)`
   - **Execute as:** `User accessing the web app` (or `Me` / `USER_DEPLOYING`)
     > **Recommendation for domain restricted institutional access:** Select `User accessing the web app` if each student can directly access the spreadsheet via domain permissions, OR select `Me (814725105014@trp.srmtrichy.edu.in)` so the script executes with service authority to write to the master spreadsheet and slides without requiring individual student write access to the underlying spreadsheet!
   - **Who has access:** `Anyone within SRM TRP Engineering College` (or `Anyone within trp.srmtrichy.edu.in`).
4. Click **Deploy**.
5. Copy the generated **Web App URL**:
   ```
   https://script.google.com/a/macros/trp.srmtrichy.edu.in/s/AKfycbyO2asCYfAeg61GuNfhUMInNDEJaB0UeD82ZhuCIpL8FB-QT6aXxgpBt7D7BmIwjsEuWg/exec
   ```

---

## 2. Linking Deployed Web App to EMBEDX Website

In `c:\EmbedX\quiz.html`:
Locate the launch button:
```html
<a href="https://script.google.com/a/macros/trp.srmtrichy.edu.in/exec" id="launchPortalBtn" target="_blank" class="btn btn-green">
```
Replace the URL with your actual deployed Web App URL:
```html
<a href="https://script.google.com/a/macros/trp.srmtrichy.edu.in/s/AKfycbyO2asCYfAeg61GuNfhUMInNDEJaB0UeD82ZhuCIpL8FB-QT6aXxgpBt7D7BmIwjsEuWg/exec" id="launchPortalBtn" target="_blank" class="btn btn-green">
```

---

## 3. Safe Email & Dry-Run Transition Protocol

To prevent accidental emails before the real event:
1. Keep `DRY_RUN_MODE=true` in Script Properties while testing.
2. In dry-run mode, all email events (`QUIZ_COMPLETION`, `PHASE_1_COMPLETION`, `PHASE_2_COMPLETION`, `CERTIFICATE_ISSUED`) are recorded in the `EMAIL_LOG` sheet with `dry_run_simulated` status without consuming Google Mail quota.
3. On the morning of **30 October 2026**, once final verification tests pass:
   - Go to **Project Settings** -> **Script Properties**.
   - Change `DRY_RUN_MODE` to `false`.
   - Now, valid completion and certificate emails will be delivered directly to verified student inboxes.

---

## 4. Rollback & Emergency Contingency Plan

If the Google Workspace environment experiences domain outages or script authorization blocks:
1. The legacy Google Form remains intact and active.
2. The website's existing pages (`index.html`, `events.html`, `team.html`) remain 100% operational and will continue functioning normally.
3. The Super Admin can share the fallback Google Form link directly with seminar hall students via `quiz.html` or WhatsApp group.
