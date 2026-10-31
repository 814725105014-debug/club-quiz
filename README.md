# QUIZ PLATFORM — SRM TRP Engineering College / EMBEDX

A mobile-first quiz delivery and **automated certification** platform: an admin console for coordinators, a
phone-first assessment app for students, and a certificate pipeline that reuses the college's existing Google
Workspace resources (Form, Sheet, Slides template, Gmail).

This replaces the earlier static `index.html` / `admin.html` prototype in this repository. The legacy files are
kept for reference only and are **not** served by this application.

---

## 1. What it does

**Assessment lifecycle**

- Quiz CRUD, question bank (single choice, multiple choice, true/false), optional question images,
  marks and negative marks, difficulty, explanation, CSV import/export.
- Scheduling in `Asia/Kolkata`, duration, pass percentage, attempt limits, negative marking and
  independent **question shuffle** and **option shuffle** toggles (evaluated by stable option IDs, so shuffling
  never changes correctness).
- Unique 6-character join code, public join link `/j/<code>`, QR download and a full-screen
  **Presentation mode** (`/present/<code>`) with live registration/attendance/submission counters.
- Student registration that mirrors the existing Google Form (full name, email, 12-digit register number,
  department, course fields), validated on the server against the same patterns, with duplicate
  registration/attempt prevention.
- Server-authoritative timer (never trusted from the browser), autosave per answer with an offline queue and
  recovery, review flags, unanswered warning, confirmation screen before submit, and a result screen.
- Live host panel: start, pause, resume, extend time, end, close registration, announcements, participant list,
  violation feed and audit trail.

**Certification**

- Eligibility rules per quiz (`none`, `always`, `pass`, `score_threshold`).
- One reusable issuance service: reserve certificate number → copy the Slides template → replace the seven
  placeholders that actually exist in the live template → export PDF → Drive folder → upsert the Form Responses
  row → email the participant, with retries, manual retry/regenerate and a public verification page.
- The template itself is never edited; every certificate is generated from a copy.
- Numbering continues the college's existing sequence (prefix `SRMTRP/EEE/VAC/`, year, next number).

**Reporting and operations**

- Results with filters, sorting, per-question analytics, CSV export, violation timeline and email history.
- Registration-field designer (labels, required, order, validation regex, sheet column / certificate
  placeholder mapping), live mobile preview.
- Spreadsheet console: tabs, mirrored rows, sync queue with retry.
- Email templates editor, delivery log, test send, Gmail redirect safety mode.
- Admin users and roles (`super_admin`, `quiz_admin`, `quiz_host`, `results_viewer`), hashed passwords,
  rate limits, server-side sessions, and a complete audit log.

---

## 2. Stack

| Layer | Choice |
| --- | --- |
| API | Node.js ≥ 20, Express, Zod, `node:sqlite` (WAL), `jsonwebtoken`, bcrypt-less `scrypt` password hashing |
| Web | React 18, Vite, React Router, hand-written CSS (mobile-first, no UI framework) |
| Files | `pdfkit` (mock/local certificates), `qrcode` |
| Google | One provider interface with three implementations: `mock`, `apps_script` (recommended), `google_api` |
| Identity | Firebase Authentication (`AUTH_MODE=firebase`): email/password, Google, phone (prepared, off until Blaze) |
| Read model | Firestore mirror (`FIRESTORE_MIRROR=true`) protected by `firestore.rules`; SQLite stays authoritative |

`data/` (SQLite database, generated PDFs, outbox) is git-ignored.

---

## 3. Quick start

```bash
cp .env.example .env          # then edit the secrets
npm install
npm run seed                  # creates the database, admin and a demo quiz
npm run dev:api               # API + built SPA on http://localhost:4000
# optional, for hot reload while editing the UI:
npm run dev:web               # Vite on :5173, proxies /api to :4000
```

Production-style run:

```bash
npm run build                 # API → dist/server, SPA → dist/web
NODE_ENV=production npm start # single process serves API and SPA
```

Local demo credentials come from `.env` (`ADMIN_EMAIL` / `ADMIN_PASSWORD`) and the demo quiz code is
`DEMO01`. **Change the password before exposing the app.**

Useful scripts: `npm run typecheck`, `npm test`, `npx tsx --tsconfig web/tsconfig.json scripts/ui-smoke.tsx`
(renders every route in jsdom against a running server).

---

## 4. Google Workspace integration

The existing resources are pinned in `.env.example`:

| Resource | ID |
| --- | --- |
| Form / responses spreadsheet | `1jiVDFpIxGwfSlHBt3vaHl-5GFd8DPGapSS4tsR-FhJQ` |
| Slides certificate template | `1dkfJ6PQtmeDEkcNR4xJWsWrLjSu5pkAnvY3JY44_ISo` |
| Generated certificates folder | `1SDdCpIQHvf_WP0o9vC0ZrLHEb9vt0Q6Y` |
| Apps Script project (existing automation) | `16hTGWLwIvGNZqPMQXdDUMasc8kZFg2atwkfWi50X9vg0zgjLUUf3MejZ` |

`GOOGLE_PROVIDER` selects how the platform talks to Google:

1. **`mock`** (default) — renders real PDFs locally, mirrors sheet writes into SQLite, writes email previews to
   `data/outbox`. Everything is testable without credentials. This is what the sandbox demo runs.
2. **`apps_script`** (recommended in production) — posts signed JSON to a webhook added to the **existing**
   Apps Script project. No OAuth secrets in the web app, and the existing certificate function can be reused.
   See [`docs/APPS_SCRIPT_BRIDGE.md`](docs/APPS_SCRIPT_BRIDGE.md) and `apps-script-bridge/CertificateBridge.gs`.
3. **`google_api`** — the app calls Sheets/Slides/Drive/Gmail directly with a service account (domain-wide
   delegation) or an OAuth refresh token. See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

Because the real Google credentials were not available in this environment, the browser-facing integration is
verified against the mock provider; the Apps Script and Google API providers are implemented and type-checked but
must be smoke-tested once on the college workspace (steps in `docs/DEPLOYMENT.md`).

---

## 5. Security model (short version)

- Passwords hashed with `scrypt`; sessions are opaque tokens stored hashed in SQLite, `HttpOnly` + `SameSite=Lax`
  cookies, 12-hour expiry, revocation on deactivation/password change.
- Login and student endpoints are rate limited; mutating admin requests are origin-checked.
- Answer keys, other participants' data and admin routes are never sent to the student client before submission.
- Scores and expiry are computed on the server; the timer in the browser is only a display.
- No secrets in the frontend; only `.env.example` is committed.
- Emails default to **test mode** (redirected to the admin inbox) so no bulk participant email can be sent by
  accident.

Known, honest limitation: browser JavaScript cannot prevent OS-level app switching, screenshots or a second
device. The platform logs visibility/blur/fullscreen/context-menu/copy-paste events and applies configurable
warnings/auto-submit rules; it does not claim to detect everything. See [`docs/SECURE_DELIVERY.md`](docs/SECURE_DELIVERY.md).

---

## 6. Repository map

```
server/src/
  app.ts, index.ts, bootstrap.ts, seed.ts
  auth.ts, audit.ts, db.ts, domain.ts, env.ts
  lib/{ids,time,http,csv}.ts
  services/  config, google (3 providers), jobs + jobHandlers, sheets,
             email, certificates, attempts, quizzes, stats
  routes/    auth, quizzes, results, settings, student, public
web/src/
  App.tsx, styles.css
  lib/{api,types,format,session,hooks,student}
  components/{ui,Icon,Layout,QuizForm,QuestionForm}
  pages/            admin screens
  pages/student/    landing, join, attempt, result
scripts/ui-smoke.tsx  route-level render smoke test
apps-script/          the college's existing automation (reference, not modified)
apps-script-bridge/   NEW bridge code to paste into that project when ready
docs/                 deployment, QA, Google workspace, bridge contract, security
```

---

## 7. Documentation

- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — production setup, TLS, backups, Google provider options.
- [`docs/GOOGLE_WORKSPACE.md`](docs/GOOGLE_WORKSPACE.md) — audited sheet schema, certificate placeholders,
  numbering and non-destructive migration rules.
- [`docs/APPS_SCRIPT_BRIDGE.md`](docs/APPS_SCRIPT_BRIDGE.md) — bridge contract and install steps.
- [`docs/QA.md`](docs/QA.md) — test matrix, automated checks and manual acceptance script.
- [`docs/SECURE_DELIVERY.md`](docs/SECURE_DELIVERY.md) — anti-cheat limits and kiosk options.
- [`docs/RUNBOOK.md`](docs/RUNBOOK.md) — day-of-exam checklist and incident procedures.
- [`docs/FIREBASE.md`](docs/FIREBASE.md) — Firebase Authentication + Firestore setup for project
  `embedx-assessment`, provider status, provisioning and rules.

No paid service is used, and nothing in this repository deploys itself.
