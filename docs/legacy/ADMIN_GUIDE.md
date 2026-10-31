# EMBEDX Platform Administrator & Council Guide

**Super Admin:** Hariharan V (`814725105014@trp.srmtrichy.edu.in`)
**Target Event:** Basics of Embedded Systems and Embedded Programming Language
**Date:** 30 October 2026 (Friday)

---

## 1. Role Hierarchy & Access Levels

| Role | Permissions | Intended Users |
| :--- | :--- | :--- |
| **Super Admin** | Full access: Assign/revoke admins, configure system settings, view audit logs, wipe/init database, author questions, view live monitoring, issue/revoke certificates. | **Hariharan V** (`814725105014@trp.srmtrichy.edu.in`) |
| **Admin** | Create/publish quizzes and sessions, add/import questions via CSV, monitor live results, export CSV reports. | **President** (Ramanathan S), **Vice President** (Nanthakishore J), **Secretary** (Vimala Varshini M), **Joint Secretary** (Gayathri Arumugam) |
| **Coordinator / HOD** | Monitor student submissions, view session-wise analytics, inspect certificate logs. | **Dr. R. Meenal** (Faculty In-Charge), **HOD EEE** |
| **Student** | View published quizzes, complete assessments, track Phase 1 & Phase 2 progress, view leaderboard, download certificate. | Verified **@trp.srmtrichy.edu.in** students |

---

## 2. Super Admin Delegation: Adding Executive Council Members

As Super Admin (`814725105014@trp.srmtrichy.edu.in`), you can dynamically grant administrative privileges from your portal interface without modifying code:

1. Open the EMBEDX Portal Web App.
2. In the navigation bar, click **Admins (Super)**.
3. In the **Assign Administrator Access** panel:
   - Select a council or faculty member from the dropdown:
     - **RAMANATHAN S** (President)
     - **NANTHAKISHORE J** (Vice President)
     - **VIMALA VARSHINI M** (Secretary)
     - **GAYATHRI ARUMUGAM** (Joint Secretary)
     - **Dr. R. MEENAL** (Faculty Coordinator)
     - **Head of Department** (HOD EEE)
     - **JEEVANANTHAM A** (Event Coordinator)
     - **KEERTHIVASAN A** (Publicity & Media Coordinator)
   - Enter their official `@trp.srmtrichy.edu.in` email address.
   - Choose their assigned role (`admin`, `coordinator`, `hod`).
   - Click **Save Role Authorization**.
4. The user is immediately granted server-verified privileges upon their next Google sign-in.

---

## 3. Creating & Managing Quizzes

### 3.1 Adding Single Questions
1. Navigate to **Quizzes & Questions**.
2. Select target Quiz ID (e.g. `QUIZ-EMB-01`).
3. Enter question text, four options (A, B, C, D), correct option, marks (default: 2), and optional technical explanation.
4. Click **Save Question**.

### 3.2 Bulk Importing via CSV
1. Download or copy the provided template `quiz_questions_template.csv`.
2. Ensure columns:
   ```csv
   quizId,questionText,questionType,optionA,optionB,optionC,optionD,correctAnswer,marks,explanation
   ```
3. In the portal, click **Bulk Import CSV**.
4. Paste the CSV rows into the text area and click **Validate & Import**.
5. The validator will verify headers, check that `correctAnswer` is A/B/C/D, verify non-zero marks, and report accepted and rejected row counts.

---

## 4. Near-Live Monitoring (10-Second Auto Refresh)

1. Navigate to **Live Monitoring**.
2. The dashboard polls the server every 10 seconds, displaying:
   - Total registered students.
   - Active contenders.
   - Live stream of submitted attempts with real-time score calculation and pass/fail indicators.
   - Filter by session, phase, and student name.

---

## 5. Google Slides Certificate Template Setup

To enable automated PDF certificate generation:

1. Create a slide in [Google Slides](https://slides.new) with the official EMBEDX and SRM TRP layout.
2. Insert text boxes with these exact placeholder tags:
   - `{{STUDENT_NAME}}`
   - `{{WORKSHOP_TITLE}}`
   - `{{ISSUE_DATE}}`
   - `{{CERTIFICATE_ID}}`
   - `{{INSTITUTION_NAME}}`
   - `{{CLUB_NAME}}`
   - `{{DEPARTMENT}}`
3. Copy the Google Slides presentation ID from its URL.
4. In your Apps Script Project Settings -> Script Properties:
   - Set `SLIDES_TEMPLATE_ID` = `<YOUR_SLIDES_ID>`.
   - Set `CERTIFICATE_FOLDER_ID` = `<YOUR_DRIVE_FOLDER_ID>` (to store generated PDFs).
5. Once configured, students who satisfy Phase 2 requirements will have their certificates automatically generated as real PDFs in Drive with private view access!
