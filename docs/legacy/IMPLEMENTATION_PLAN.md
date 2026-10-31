# EMBEDX Platform Implementation Plan

**Event:** Basics of Embedded Systems and Embedded Programming Language
**Target Date:** 30 October 2026 (Friday)
**Location:** 5th Floor, CSE Seminar Hall, SRM TRP Engineering College
**Audience:** 1st & 2nd Year EEE Students
**Super Admin:** Hariharan V (`814725105014@trp.srmtrichy.edu.in`)
**Resource Persons:** Mr. Ramanathan S & Mr. Hariharan V
**Status:** In Active Execution

---

## 1. Objectives & Quality Standards

1. Deliver a rock-solid, production-ready Quiz, Phase Tracking, Live Leaderboard, and Certificate Platform for tomorrow's workshop.
2. Maintain zero disruption to the existing EMBEDX website (`C:\EmbedX`) while seamlessly incorporating the Quiz Portal.
3. Strict institutional security: only `@trp.srmtrichy.edu.in` accounts allowed.
4. Robust Super Admin control with dynamic admin delegation (President, VP, Secretary, Faculty Coordinator Dr. R. Meenal, HOD EEE).
5. Zero question-leak architecture: question answers graded strictly on the server.
6. Phase 1 & Phase 2 gating: certificates issued only when Phase 2 criteria are satisfied.
7. Automated, idempotent Google Slides to PDF certificate generation with email logs kept in dry-run/safe mode during development.

---

## 2. Priority Roadmap

### Priority 0 — Core Operational Foundation (Must Work First)
1. **Security & Authentication Module (`Auth.gs`)**:
   - Institutional domain restriction (`@trp.srmtrichy.edu.in`).
   - Super Admin identity lockdown (`814725105014@trp.srmtrichy.edu.in`).
   - Admin delegation allowlist with role-based checks (`requireAdmin_()`, `requireSuperAdmin_()`).
2. **Database & Schema Initialization (`Setup.gs`, `Config.gs`)**:
   - 13 Relational Google Sheets with UUID keys, batched reads/writes, and zero data loss on re-runs.
   - Seed data for the 5 workshop topics and initial Phase structure.
3. **Student Profile & Dashboard Backend (`StudentService.gs`)**:
   - Student profile auto-creation upon Google sign-in.
   - Editable certificate display name with validation.
   - Live retrieval of available, locked, completed, and expired quizzes.
4. **Quiz Engine & Server-Side Grader (`QuizService.gs`)**:
   - Answer stripping on fetch (correct answers never sent to browser).
   - Server-side duration and attempt enforcement.
   - Concurrency locking via `LockService.getScriptLock()` to prevent race conditions or duplicate submissions.
5. **Live Admin Monitoring & Real-time Leaderboard (`LeaderboardService.gs`, `AdminService.gs`)**:
   - Deterministic ranking (Score DESC, Duration/Timestamp ASC).
   - Privacy-masked leaderboard for students.
   - Admin live monitoring dashboard with 10-second polling.

### Priority 1 — Phase Tracking, Certification & Notification Engine
1. **Phase Tracking Engine (`PhaseService.gs`)**:
   - Independent tracking for Phase 1 (Foundations) and Phase 2 (Advanced/Applied).
   - Evaluation of required vs. optional quizzes and passing thresholds.
2. **Bulk Question Importer (`AdminService.gs`)**:
   - CSV upload parser with strict validation (headers, single/multiple-choice/TF, marks, correct answer keys).
   - Row-level diagnostics and downloadable template.
3. **Automated Certificate Engine (`CertificateService.gs`)**:
   - Google Slides template placeholder replacement (`{{STUDENT_NAME}}`, `{{WORKSHOP_TITLE}}`, `{{ISSUE_DATE}}`, `{{CERTIFICATE_ID}}`, etc.).
   - PDF conversion and private storage in Google Drive.
   - Student dashboard download action and unique verification link.
   - Idempotent issuance guard to prevent duplicates.
4. **Notification Engine (`EmailService.gs`)**:
   - Configurable email templates for quiz completion, phase completion, and certificate issuance.
   - Quota checking, error handling, retry mechanism, and safe `DRY_RUN_MODE` toggle.
5. **Website Integration (`quiz.html`)**:
   - Official portal page integrated into `C:\EmbedX` using identical design tokens, header, navigation, and mobile drawer.

---

## 3. Google Sheets Relational Data Model (13 Sheets)

1. `USERS`: `student_id`, `email`, `display_name`, `role`, `department`, `year`, `first_login_at`, `last_active_at`, `status`
2. `SESSIONS`: `session_id`, `session_order`, `title`, `description`, `learning_outcomes`, `phase_id`, `is_published`, `created_at`
3. `PHASES`: `phase_id`, `phase_number`, `title`, `description`, `required_quizzes_count`, `min_pass_score`, `is_active`
4. `QUIZZES`: `quiz_id`, `session_id`, `phase_id`, `title`, `instructions`, `duration_minutes`, `total_marks`, `pass_percentage`, `attempt_limit`, `is_randomized`, `is_published`, `start_time`, `end_time`, `review_policy`
5. `QUESTIONS`: `question_id`, `quiz_id`, `question_text`, `question_type`, `option_a`, `option_b`, `option_c`, `option_d`, `correct_answer`, `marks`, `explanation`, `is_published`
6. `ATTEMPTS`: `attempt_id`, `quiz_id`, `student_id`, `started_at`, `submitted_at`, `deadline_at`, `status`, `score_obtained`, `total_possible`, `percentage`, `passed`
7. `ANSWERS`: `answer_id`, `attempt_id`, `question_id`, `student_id`, `selected_option`, `is_correct`, `marks_awarded`
8. `RESULTS`: `result_id`, `student_id`, `quiz_id`, `best_score`, `best_percentage`, `best_attempt_id`, `attempts_count`, `passed`, `updated_at`
9. `PHASE_PROGRESS`: `progress_id`, `student_id`, `phase_id`, `completed`, `completed_at`, `quizzes_completed`, `average_score`
10. `CERTIFICATES`: `certificate_id`, `student_id`, `workshop_id`, `template_id`, `drive_file_id`, `pdf_url`, `issued_at`, `status`, `revoked_at`
11. `EMAIL_LOG`: `log_id`, `event_type`, `recipient_email`, `student_id`, `related_id`, `status`, `error_message`, `sent_at`, `retry_count`
12. `AUDIT_LOG`: `log_id`, `actor_email`, `action_type`, `target_entity`, `target_id`, `details`, `timestamp`
13. `APP_SETTINGS`: `key`, `value`, `description`, `updated_at`

---

## 4. Technical Architecture Diagram

```
+---------------------------------------------------------------------------------+
|                       EMBEDX Official Website (C:\EmbedX)                       |
|   index.html | about.html | team.html | ... | quiz.html (Synced Portal Entry)   |
+---------------------------------------------------------------------------------+
                                       |
                                       | Direct Link & SSO Entry
                                       v
+---------------------------------------------------------------------------------+
|                 EMBEDX Standalone Apps Script Web App Engine                   |
|                                                                                 |
|  [Frontend HTML Service]                                                        |
|  - Index.html (Single Page App Container & Router)                              |
|  - Styles.html (EMBEDX Tech Design System: Navy, Emerald, Glows, Responsive)    |
|  - Client.html (Async RPC client, Toast notifications, Modal handlers)          |
|  - StudentDashboard.html (Sessions, Quizzes, Progress, Certificate Download)   |
|  - QuizPlayer.html (Timed, Navigation, Autosave, Submit Guard)                 |
|  - Leaderboard.html (Privacy-filtered, Deterministic ranking, Search)           |
|  - AdminDashboard.html (Live metrics, Phase tracking, Action center)           |
|  - AdminQuizEditor.html (Question builder, CSV bulk import, Publishing)         |
|  - AdminResults.html (10s live monitoring, student drill-down, CSV export)     |
|  - AdminUserManagement.html (Super Admin delegation with role dropdowns)        |
|  - Certificates.html (Phase 2 validation, Generation log, Resend, Revoke)      |
|                                                                                 |
|  [Backend Script Services]                                                      |
|  - Code.gs (doGet/doPost, API routing, RPC dispatch)                            |
|  - Auth.gs (Domain validation, Super Admin, RBAC allowlist)                     |
|  - Setup.gs (Idempotent 13-sheet schema initialization & seed data)             |
|  - StudentService.gs (Profile & dashboard data)                                 |
|  - SessionService.gs (5 workshop topics, session sequencing)                    |
|  - QuizService.gs (Zero-leak question fetch, Server grading, LockService)       |
|  - LeaderboardService.gs (Batched calculation, deterministic ties)              |
|  - PhaseService.gs (Phase 1 & Phase 2 completion rules)                         |
|  - CertificateService.gs (Google Slides replacement -> Drive PDF conversion)    |
|  - EmailService.gs (Safe templates, retry queue, dry-run safety)               |
|  - AdminService.gs (CSV question importer, Settings CRUD)                       |
|  - AuditService.gs (Security log, immutable audit trail)                        |
+---------------------------------------------------------------------------------+
                   |                           |                         |
                   v                           v                         v
+--------------------+        +--------------------+    +--------------------+
|   Google Sheets    |        |   Google Slides    |    |    Google Drive    |
| (13 Relational DB) |        | (Editable Cert Tpl)|    | (Private PDF Store)|
+--------------------+        +--------------------+    +--------------------+
```

---

## 5. Implementation Execution Checklist

- [x] Repository audit & Git status check
- [x] Plan creation (`docs/IMPLEMENTATION_PLAN.md`)
- [x] Old Google Form Apps Script analysis (`docs/APPS_SCRIPT_MIGRATION.md`)
- [ ] Backend Apps Script services implementation (`apps-script/*.gs`)
- [ ] Frontend HTML Service UI implementation (`apps-script/*.html`)
- [ ] Super Admin role management panel with team role dropdowns
- [ ] EMBEDX Website integration (`quiz.html` & updated navigation links)
- [ ] Question CSV bulk import template (`quiz_questions_template.csv`)
- [ ] Automated test suite & test scripts (`tests/`)
- [ ] Documentation (`SETUP_GUIDE.md`, `DEPLOYMENT_GUIDE.md`, `ADMIN_GUIDE.md`, `TESTING_CHECKLIST.md`)
- [ ] Validation & verification
