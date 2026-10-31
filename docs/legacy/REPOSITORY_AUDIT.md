# EMBEDX Platform Repository Audit & Architecture Assessment

**Date of Audit:** 29 October 2026
**Institution:** SRM TRP Engineering College (Autonomous), Tiruchirappalli
**Department:** Electrical and Electronics Engineering (EEE)
**Club:** EMBEDX – Embedded Systems & Automation Club
**Target Event:** *Basics of Embedded Systems and Embedded Programming Language*
**Confirmed Event Date:** 30 October 2026 (Friday)
**Lead Architect / Super Admin:** Hariharan V (`814725105014@trp.srmtrichy.edu.in`)

---

## 1. Executive Summary

This audit assesses the local workspace and repositories on the system to guide the development, deployment, and integration of the **EMBEDX Quiz, Live Leaderboard, Phase Tracking & Certificate Platform**.

The workshop will be held on **30 October 2026** at the **5th Floor, CSE Seminar Hall** for first- and second-year EEE students. The primary operational priority is **Priority 0 (rock-solid authentication, quiz execution, server-side grading, and live leaderboard)** followed by **Priority 1 (phase tracking, certificate generation via Google Slides, and email notifications in safe dry-run mode)**.

---

## 2. Inventory of Repositories & Local Codebases

### Repository 1: Primary Website — `C:\EmbedX` (Selected)
- **Git Remote:** `https://github.com/814725105014-debug/embedx-website.git`
- **Active Branch:** `feature/quiz-certification-platform` (branched from `main` at `4effe44`)
- **Runtime & Tech Stack:**
  - Semantic HTML5, Modular CSS3 (`css/main.css`, `components.css`, `responsive.css`, `animations.css`), Vanilla Modern JavaScript (ES6+).
  - Cloudflare Workers / Pages Functions backend (`_worker.js`, `function/api/join.js`, `function/api/inquiry.js`) with configuration in `wrangler.jsonc`.
  - Node.js runtime environment: `v24.21.0`, npm `11.19.0`.
- **Branding & Visual Assets:**
  - High-resolution SVG and PNG assets in `assets/branding/`: `srm-trp-logo-official.png`, `embedx-logo-emblem.png`, `embednova-logo.png`, `HARIHARAN_V_PHOTO.jpg`, etc.
  - Authentic leadership photos in `assets/images/`: `hod.png`, `faculty-coordinator.png`, `club-president.png`, `vice-president.png`, `secretary.png`, `joint-secretary.png`, `event.png`, `media.png`.
  - Color Palette: Primary Navy (`#0B2A6F`, `#071C4B`), Engineering Green (`#146B3A`, `#1E8C4E`), Accent Blue (`#2D72D9`, `#00D2FF`), Accent Orange (`#F47B20`).
  - Typography: Space Grotesk, Rajdhani, Sora, Inter, JetBrains Mono.
- **Current Navigation & Entry Points:**
  - `index.html`, `about.html`, `domains.html`, `projects.html`, `events.html`, `achievers.html`, `team.html`, `resources.html`, `contact.html`, `join.html`.
- **Existing Backend Integrations:**
  - `/api/join` and `/api/inquiry` endpoints proxy form submissions to a Google Apps Script Web App URL (`APPS_SCRIPT_URL` environment variable).
- **Audit Verdict:** **PRIMARY TARGET REPOSITORY**. It hosts the official EMBEDX club web presence, contains the design tokens and official logos, and directly serves the EEE department. The Quiz Portal will be seamlessly integrated via a dedicated, perfectly synced `quiz.html` page without modifying or breaking any existing pages.

---

### Repository 2: OD Ease — `C:\Users\User\Downloads\OD Ease`
- **Git Remote:** `https://github.com/Aishwaryavarshini/OD-Ease.git`
- **Tech Stack:** React 18, Vite, TypeScript, Tailwind CSS, Supabase backend (`supabase_schema.sql`).
- **Purpose:** On-Duty approval workflow for students and EEE mentors (contains `2026-2027 EEE MENTOR LIST.xlsx`).
- **Audit Verdict:** Dedicated student on-duty management tool. Not suitable as the club portal host, but its mentor lists and institutional email patterns provide valuable validation data for SRM TRP student domains (`@trp.srmtrichy.edu.in`).

---

### Repository 3 & 4: Prior Checkouts & Archive Trees
- `C:\$Recycle.Bin\...\OD-Ease-main` (Prior backup/recycle copy of OD-Ease).
- `C:\Users\User\Downloads\19857425.zip` (Research dataset: `Marine_Engine_Fault_Data_v1.zip`).
- **Audit Verdict:** Non-conflicting; will remain untouched.

---

## 3. Existing Google Form Apps Script Workflow Audit

The previous workflow utilized Google Forms linked to a Google Sheet with a container-bound Apps Script trigger (`onFormSubmit`) to send confirmation emails and generate certificates.

### Assessment of Current Workflow:
1. **Container-bound vs. Standalone:** The old script is bound directly to the Google Form spreadsheet. Modifying it in-place risks breaking student submissions during the event.
2. **Identity Verification Deficit:** Google Forms allows students to type arbitrary emails or names unless strictly locked to domain collection, which frequently fails on mobile browsers.
3. **Cheat Prevention & Scoring Deficit:** Answers are typically validated only after submission or exposed in form metadata. Time limits cannot be enforced server-side in Google Forms.
4. **Phased Evaluation Gap:** Forms cannot enforce Phase 1 prerequisite completion before unlocking Phase 2 quizzes.
5. **Preservation Strategy:**
   - Keep the existing Google Form URL and spreadsheet active as an emergency fallback.
   - Develop the new platform in a **clean, dedicated standalone Apps Script project** under `apps-script/`.
   - Maintain full migration notes in `docs/APPS_SCRIPT_MIGRATION.md` detailing how to backup, clone via clasp, and cut over when verified.

---

## 4. Key Architectural Decisions

1. **Standalone Google Apps Script Web App Architecture:**
   - Deployed with `executeAs: USER_DEPLOYING` (or domain service) and `access: DOMAIN` (restricted to `@trp.srmtrichy.edu.in`).
   - Server-side identity verified via `Session.getActiveUser().getEmail()`.
   - Complete Google Sheets backend with 13 relational sheets and UUIDs.
   - Concurrency protection via `LockService.getScriptLock()` for score submissions, attempt recording, and certificate generation.
2. **Synchronized UI/UX Integration in `C:\EmbedX`:**
   - Add `quiz.html` with identical navigation, circuit canvas animations, brand lockup, typography, and responsive drawer.
   - The page acts as the official entry point: student workshop briefing, session curriculum, live countdown, direct Single Sign-On link to the Web App, and embedded portal preview.
   - Existing site pages remain completely intact and functional.
3. **Role-Based Access Control (RBAC):**
   - Super Admin: `814725105014@trp.srmtrichy.edu.in` (Hariharan V).
   - Dynamic Admin Management: Super Admin can grant Admin roles to club leaders (President Ramanathan S, Vice President Nanthakishore J, Secretary Vimala Varshini M, Joint Secretary Gayathri Arumugam, Faculty Coordinator Dr. R. Meenal, HOD EEE) via an interactive admin interface with role dropdowns.
4. **Zero-Leak Server Grading:**
   - Client never receives correct answer keys. Only question text, options, and marks are delivered.
   - Grading is performed entirely on the server within `QuizService.gs`.
5. **Deterministic Leaderboard & Privacy Protection:**
   - Real-time ranking based on total marks and submission time (tie-breaker).
   - Institutional emails and private answers are stripped from student-facing views.

---

## 5. Repository Health & Verification

- `git status` on `C:\EmbedX`: Clean.
- Branch `feature/quiz-certification-platform` created.
- Node.js `v24.21.0` verified.
- Clasp development scripts configured with isolated targets.
