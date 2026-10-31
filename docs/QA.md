# QA and acceptance record

## 1. Automated checks

| Check | Command | Result |
| --- | --- | --- |
| Server typecheck | `npx tsc -p server/tsconfig.json --noEmit` | pass |
| Web typecheck | `npx tsc -p web/tsconfig.json --noEmit` | pass |
| Production build | `npm run build` | pass (server `dist/server`, SPA `dist/web`) |
| Route render smoke (jsdom, live API) | `npx tsx --tsconfig web/tsconfig.json scripts/ui-smoke.tsx` | 19/19 routes render, no error banners |
| API end-to-end (isolated DB) | `npm test` | 6/6 pass |
| Concurrency/limiter | login limiter (10/min/IP), join (5/min), save (60/min) | exercised with 429 responses |

`scripts/ui-smoke.tsx` logs in, injects the session cookie, mounts the real `App` in jsdom at every route
(student landing, join, projector, verify, all admin pages, quiz editor, host console) and fails if a route renders
nothing or shows an `.alert-error`.

## 2. Verified end-to-end flow (mock Google provider)

1. Admin login → dashboard.
2. Create quiz (window open, duration 10 min, pass 40 %, shuffle on, certificate rule `pass`).
3. Add single / multiple / true-false questions with marks.
4. Publish; extend time; join code generated.
5. Public join payload exposes quiz metadata and registration fields, **no answer keys**.
6. Student registers with the Form-equivalent fields; a second registration with the same register number is
   rejected (`duplicate_registration`).
7. Attempt starts; `/state` returns shuffled questions/options and no `is_correct` anywhere in the payload.
8. Answers autosave; a violation is recorded and counted.
9. Submit → server grades (`6/6`, `100 %`, `passed: true`), certificate row created.
10. Job worker copies the template / renders the mock PDF (`SRMTRP/EEE/VAC/-2026-0016`), writes the sheet mirror,
    emails the participant (redirected to the admin in test mode).
11. Public verification returns the holder and course; PDF download returns `application/pdf`.
12. Presentation endpoint returns live counters; admin results list shows the certificate and email state.
13. Audit log records login, quiz/attempt/certificate/email events; job queue drains to zero.

## 3. Manual acceptance checklist (run on the college workspace)

- [ ] Real Google provider (`apps_script` bridge) reports reachable and lists the four tabs.
- [ ] Certificate generated from a copy: template unchanged, seven placeholders replaced, signatures intact,
      QR scans to the verification page, PDF appears in `1SDdCpIQ…`.
- [ ] Form Responses row upserted by Certificate ID; existing rows untouched; `Settings` counter advanced.
- [ ] Gmail delivery arrives (test mode off) with the PDF attached; resend and regenerate work.
- [ ] Existing Form submit still produces a certificate after the bridge is installed.
- [ ] Mobile Safari (iOS 16+) and Chrome (Android 12+): join, autosave, rotation, background/foreground recovery,
      submit; timer survives a locked screen.
- [ ] Two devices cannot submit the same participant twice; max-attempts enforced.
- [ ] OMR-free question image renders on a small screen and does not overflow.
- [ ] CSV import with 100 rows reports imported/skipped rows correctly; export re-imports cleanly.
- [ ] Rate limits return friendly errors, not stack traces.
- [ ] Certificate verification page shows no scores, emails or other participants.

## 4. Reproducing

`npm test` (`server/test/api.test.ts`) boots the real Express app on an ephemeral port with a temporary SQLite
`DATA_DIR`, then drives login → create quiz → questions → publish → public payload → join → start → answer →
violation → submit → certificate poll → public verification → PDF bytes → results/audit/dashboard. It asserts that
no answer key appears in any student payload and that the certificate number follows the configured sequence.

`scripts/ui-smoke.tsx` covers the rendering layer of every route against a running server.

## 5. Known gaps (environmental)

- No real Google credentials in the sandbox, so the `apps_script` and `google_api` providers are type-checked and
  contract-tested only. Their failure paths surface as retryable jobs with the upstream message.
- No iOS/Android device was available; mobile behaviour is implemented with `visualViewport`, safe-area insets,
  `dvh` units and an offline queue, but must be confirmed by the checklist above.
- Email delivery is simulated in mock mode (`data/outbox/*.html`), including the attachment metadata.
