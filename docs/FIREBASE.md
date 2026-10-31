# Firebase integration (Authentication + Firestore)

Project: **`embedx-assessment`** · Web app: `1:803481654330:web:3bd07cd5cf42c4de1e5103`

Built from the Firebase agent skills (`npx skills add firebase/agent-skills`, read:
`firebase-basics`, `firebase-auth-basics`, `firebase-firestore`, `firestore-rules-creation`).

---

## 1. Architecture: why the API stays in front of Firestore

The app keeps Express + SQLite as the **transactional source of truth** and uses Firebase for
**identity** and a **read model**:

```
Browser ──Firebase Auth SDK──▶ Firebase Authentication (email/password, Google)
   │                                   │ ID token (JWT, 1 h)
   │  Authorization: Bearer <idToken>  │
   ▼                                   ▼
Express API ──verifyIdToken()──▶ firebase-admin  (AUTH_MODE=firebase)
   │
   ├── SQLite: grading, server-authoritative timer, certificate numbering, job queue
   └── Firestore (optional mirror): quizzes, participants, attempts, certificates,
       registrationFields, auditLog — denormalised, never containing answer keys
```

Grading, deadline enforcement and certificate numbering need multi-row transactions that a
hosted document store cannot express safely, and the answer keys must never be reachable from a
browser. Keeping them in the API is what makes "no answer keys in the client" provable
(`npm test` asserts it). Firestore still receives a live projection for dashboards and is
read-protected by rules.

Cloud Functions would move the trusted code into the project, but require the **Blaze** plan;
the project stays on Spark, so the API runs on the college host.

## 2. Provider support

| Provider | Status | Notes |
| --- | --- | --- |
| Email / password | **Implemented** | Sign in, reset email, rate-limited; self-service sign-up intentionally disabled. |
| Google | **Implemented** | Popup with forced account chooser (shared lab laptops). Domain must be authorised. |
| Phone (SMS OTP) | **Implemented, disabled** | Code path in `web/src/lib/firebase.ts` (`RecaptchaVerifier` → `signInWithPhoneNumber` → confirm). Needs Blaze + per-SMS billing, so `phoneAuthEnabled` stays `false` until that is approved. |

Administrators are **provisioned**, not self-registered: a Firebase account only gets in if a row
exists in `users` (by uid, or bound by email on first sign-in). Role and activation state come
from that row, so deactivating someone in *Team & access* blocks the next request even with a
valid Firebase token.

## 3. Console setup (one-time, your account)

1. **Authentication → Sign-in method**: enable *Email/Password* and *Google*. Leave *Phone*
   disabled for now.
2. **Authentication → Settings → Authorized domains**: add the domains you will run on.
   - `localhost` is pre-authorised.
   - Add the production host (e.g. `quiz.trp.srmtrichy.edu.in`).
   - The sandbox preview host (`4000-*.e2b.app`) is **not** authorised, so Google sign-in there
     fails with `auth/unauthorized-domain` — email/password also only works if the account
     exists in Firebase.
3. **Project settings → Service accounts → Generate new private key**. Store the JSON outside
   the repo (e.g. `/etc/quiz/firebase-service-account.json`) and point
   `FIREBASE_SERVICE_ACCOUNT_FILE` at it. Never commit it; `.gitignore` already blocks `.env`
   and any file you keep outside the tree.
4. **Firestore → Create database** (Production mode, region `asia-south1` recommended for
   latency in Tamil Nadu). Rules and indexes are deployed from this repo.
5. Optional: **Hosting** for the SPA only — see §7.

CLI equivalents (where the CLI supports them):

```bash
npx -y firebase-tools@latest login
npx -y firebase-tools@latest use embedx-assessment
npx -y firebase-tools@latest deploy --only auth                 # providers from firebase.json
npx -y firebase-tools@latest deploy --only firestore:rules,firestore:indexes
```

## 4. Turning it on

`.env` on the API host:

```bash
AUTH_MODE=firebase
FIREBASE_PROJECT_ID=embedx-assessment
FIREBASE_API_KEY=AIzaSyACO6JtEgvD_n5m5haPV-0y91Z76UI9C18
FIREBASE_AUTH_DOMAIN=embedx-assessment.firebaseapp.com
FIREBASE_STORAGE_BUCKET=embedx-assessment.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=803481654330
FIREBASE_APP_ID=1:803481654330:web:3bd07cd5cf42c4de1e5103
FIREBASE_SERVICE_ACCOUNT_FILE=/etc/quiz/firebase-service-account.json
FIRESTORE_MIRROR=true
```

Then:

```bash
npm run build && npm start        # API + SPA
npm run firebase:provision        # dry run: shows which admins are linked
npm run firebase:provision -- --apply
```

`firebase:provision` creates the Firebase users that match existing administrator rows, writes
the `role` custom claim and stores the uid locally. Existing passwords carry over.

With `AUTH_MODE=cookie` (default) nothing about the current deployment changes — the cookie
session keeps working, which is what the local/preview environment uses because the sandbox
cannot reach Google's endpoints.

## 5. Firestore data model and rules

Collections (`FIRESTORE_MIRROR=true`):

| Collection | Document | Contains |
| --- | --- | --- |
| `quizzes` | quiz id | title, status, join code, schedule, duration, pass %, counts, totals |
| `participants` | participant id | name, email, register number, department, quiz |
| `attempts` | attempt id | status, score, percentage, passed, timings, violation count |
| `certificates` | certificate row id | certificate id, status, issued date, email status |
| `registrationFields` | field id | label, type, required, order |
| `auditLog` | — | reserved; the SQLite trail is authoritative |

**Never mirrored:** questions, options, `is_correct`, explanations, tokens, other participants'
answers. `server/src/services/firestoreMirror.ts` builds each projection explicitly.

`firestore.rules`: deny-by-default; reads limited to role-claim holders (`super_admin`,
`quiz_admin`, `quiz_host`, `results_viewer`), audit log restricted to `super_admin`, client writes
refused everywhere (the service account bypasses rules, browsers cannot). A participant can read
their own document only once its `uid` field is bound.

`firestore.indexes.json`: composite indexes for attempts by quiz+submitted, attempts by
quiz+status, certificates by quiz+issued, participants by quiz+created.

## 6. Security notes

- The web config (`apiKey`, `appId`, …) is a **public identifier**, not a secret — it ships in
  `GET /api/public/runtime`. Firestore access is governed by rules, not by hiding the key.
- The **service account** never leaves the server and is never sent to the browser; the runtime
  endpoint returns only the six public fields (asserted in `npm test`).
- ID tokens are verified on every admin request with a 5-minute verification cache; role and
  activation still come from SQLite, so revocation is immediate.
- CSP now allows exactly the Firebase origins the SDK needs (`identitytoolkit`,
  `securetoken`, `firestore`, `*.firebaseapp.com`, `gstatic`/`google` for reCAPTCHA) — no
  wildcards beyond the project's own auth domain.
- Firebase sign-out also revokes refresh tokens, so a stolen refresh token cannot outlive the
  session.

## 7. Hosting (SPA only, free tier)

`firebase.json` publishes `dist/web` with an SPA rewrite. Hosting **cannot** proxy `/api` to an
external server (rewrites only target Functions/Cloud Run, which need Blaze), so a
Hosting-only deploy serves the UI and must reach the API cross-origin. If you go that route:

1. Put the API behind a custom domain, e.g. `api.quiz.trp.srmtrichy.edu.in`.
2. Add that origin to the API's origin allowlist and enable credentialed CORS.
3. Add the Hosting domain to Firebase *Authorized domains*.
4. Set `VITE_API_BASE_URL` at build time and rebuild.

The recommended free setup is still **one origin**: Express serves both the SPA and the API
(`docs/DEPLOYMENT.md`), with Firebase used only for identity and the Firestore read model.

## 8. Verification

```bash
npm test                                   # 8 tests, incl. runtime-config and bearer rejection
npx tsx --tsconfig web/tsconfig.json scripts/ui-smoke.tsx
npm run typecheck && npm run build
```

`GET /api/public/runtime` is the fastest sanity check: `authMode`, `projectId`, provider list and
whether the phone provider is on. In cookie mode it returns `firebase: null` on purpose — the
browser only receives Firebase config when the server is actually verifying Firebase tokens.
