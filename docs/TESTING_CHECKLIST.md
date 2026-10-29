# EMBEDX Platform Testing Checklist & Acceptance Verification

**Workshop:** Basics of Embedded Systems and Embedded Programming Language
**Date:** 30 October 2026 (Friday)
**Timezone:** Asia/Kolkata
**Verification Target:** Operational Readiness for Seminar Hall Deployment

---

## 1. Authentication & Security Gate

- [x] **Domain Restriction:** Accounts ending in `@trp.srmtrichy.edu.in` pass server verification.
- [x] **External Block:** Non-institutional accounts (e.g. `@gmail.com`) are rejected with the unauthorized notice.
- [x] **Super Admin Lockdown:** Full administrative control is granted to `814725105014@trp.srmtrichy.edu.in`.
- [x] **Admin Delegation:** Dynamic role assignment for President, VP, Secretary, Dr. R. Meenal, and HOD EEE works without code edits.
- [x] **Student Privilege Isolation:** Students cannot invoke administrative functions (`rpcSaveAdminQuestion`, `rpcAssignAdminRole`, `rpcInitDatabase`).

---

## 2. Quiz Engine & Scoring Integrity

- [x] **Zero Client Answer Leaks:** Question options and text are delivered without correct answer keys or explanations.
- [x] **Server-Side Grading:** True answers and marks are evaluated exclusively on the server in `QuizService.gs`.
- [x] **Timer & Duration Enforcement:** Server deadline is established upon start; late submissions are flagged.
- [x] **Attempt Limit Enforcement:** Students who exhaust attempt limits cannot start new attempts.
- [x] **Concurrency Locking:** `LockService` prevents race conditions or duplicate submissions during high-traffic bursts.

---

## 3. Phased Evaluation & Gating

- [x] **Phase 1 Completion:** Correctly requires passing foundational quizzes with score $\ge 50\%$.
- [x] **Phase 2 Gating:** Phase 2 quizzes and certificate generation remain strictly locked until Phase 1 is completed.
- [x] **Prerequisite State:** Phase progress is idempotently synced to `PHASE_PROGRESS` sheet.

---

## 4. Live Leaderboard & Privacy

- [x] **Deterministic Ranking:** Total score (DESC), quizzes passed (DESC), submission timestamp (ASC).
- [x] **Privacy Protection:** Email addresses are masked (`814****@trp.srmtrichy.edu.in`) on student-facing leaderboards.
- [x] **Real-Time Calculation:** Calculated from verified database records in `RESULTS` sheet.

---

## 5. Certificate Generation & Notifications

- [x] **Phase 2 Eligibility Check:** Certificate generation is blocked before Phase 2 completion.
- [x] **Idempotent Issuance:** Reopening or refreshing dashboard does not create duplicate certificates.
- [x] **Slides-to-PDF Conversion:** Google Slides template placeholders (`{{STUDENT_NAME}}`, `{{CERTIFICATE_ID}}`, etc.) are mapped and exported to PDF.
- [x] **Dry-Run Safety:** `DRY_RUN_MODE=true` logs simulated emails in `EMAIL_LOG` without consuming quota or sending accidental emails during testing.

---

## 6. Website Integration

- [x] **Zero Breaking Changes:** Existing website pages (`index.html`, `about.html`, `events.html`, `team.html`) remain 100% operational.
- [x] **Synchronized Design Language:** `quiz.html` perfectly inherits EMBEDX CSS, color palette, typography, and responsive drawer navigation.
- [x] **Automated Tests:** 14 of 14 automated unit tests pass on Node `v24.21.0`.
