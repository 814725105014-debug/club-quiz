# Delivery integrity and secure assessment options

## 1. What the web app actually enforces

- Server-side scoring: the browser never receives `is_correct`, and the result payload is built after submission.
- Server-side deadline: `deadline_at` is fixed at attempt start (duration clamped to the quiz window); a sweeper
  auto-submits expired attempts even if the phone is closed. Extending time updates the deadline, never the score.
- Autosave with an offline queue; answers are re-sent and the timer is resynced from the server on reconnect.
- One attempt per registration per quiz unless the quiz allows more; duplicate email/register number is rejected.
- Option and question order are snapshotted per attempt, so a shuffle cannot change correctness.

## 2. What it logs but cannot prevent (honest disclosure)

| Event | Logged | Can it be blocked? |
| --- | --- | --- |
| Tab/app switch, screen off | `visibility_hidden` | No |
| Window blur (desktop) | `window_blur` | No |
| Fullscreen exit | `fullscreen_exit` | Partly — fullscreen can be requested, not enforced on mobile |
| Right click | `context_menu` | Yes (suppressed in-page) |
| Copy / paste | `clipboard_copy`, `clipboard_paste` | Yes (prevented in-page) |
| OS screenshot, split screen, second device | — | **No** |
| Developer tools / proxy inspection | — | No |

Warnings appear after `violationWarnAfter` events; auto-submit can be configured at
`violationAutoSubmitCount`. These are **signals for review**, not proof of misconduct. The UI tells students this
before they start, and the host console repeats it.

No camera, microphone, contact list or location access is requested.

## 3. Options for high-stakes sessions

| Option | Blocks app switching | Cost / effort | Verdict |
| --- | --- | --- | --- |
| **Web app + invigilators** (default) | No | None | Use for formative quizzes, workshops, VACs |
| **Secure browser** (e.g. Safe Exam Browser, LockDown Browser) | Partly (kiosk window on desktop) | Lab setup, licensing for some products | Good for lab-based exams |
| **Android Lock Task / kiosk mode** (device owner via MDM, or a dedicated app) | Yes, if device-owner provisioned | MDM or a small native app; institutional devices only | Best for shared tablets |
| **iOS Guided Access** (Settings → Accessibility → Guided Access, or MDM) | Yes, until triple-click exit | Manual per device, no MDM needed | Practical for iPads in a lab |
| **Native kiosk app** | Yes | Optional/advanced — not required for this project | Only if the college mandates it |

Recommendation: use the web app plus supervision for ordinary assessments. For high-stakes exams, run a lab session
with Secure Exam Browser or Guided Access, and keep the platform's violation log as corroborating evidence.

## 4. Identity and privacy

- Registration collects only the Form's fields (name, email, institute register number, department, course
  metadata). No phone number, photo or ID document is required.
- The verification page shows name/course/date only; certificate IDs are unguessable enough for lookup but not
  sensitive, and no bulk listing is public.
- Admin exports are role-gated and audited (`results.export`, `participant.export`).
- Test mode redirects all email to the admin; no participant receives mail until that is turned off deliberately.
