# Exam-day runbook

## T-1 day

1. `GET /api/health` returns `ok`; **Settings → Test connection** reports the configured provider.
2. Confirm certificate template, output folder and counter in Settings.
3. Import questions via CSV, check totals, publish the quiz and print the join code.
4. Dry-run one registration + submission with your own email (test mode on). Confirm the PDF, sheet row and audit
   entry, then delete the test attempt only if the coordinator approves (deleting is not required for go-live).
5. Confirm the projector laptop can open `/present/<code>` and go fullscreen (F11); zoom the browser to 125 % for a
   back-row-readable QR.

## T-0

1. Open **Host console** for the quiz on the invigilator laptop; keep **Presentation mode** on the projector.
2. Announce the rules and the honest anti-cheat disclosure shown on the student screen.
3. Open registration; watch *Registered* on the projector. Close registration from the host panel when the hall is
   seated.
4. Start the quiz. The timer starts per student, server-side; pausing freezes deadlines.
5. Watch the violation feed. Use announcements for time warnings; extend only with approval.
6. End the quiz when the last student submits or time expires. Attempts auto-submit at the deadline.

## After the quiz

1. **Results** → check counts, pass rate, question analytics, flagged attempts.
2. **Certificates** → retry anything failed; verify one certificate via `/verify/<id>` and one QR scan.
3. Email: leave test mode on until the coordinator approves real delivery. Then send one real message first and
   confirm it arrives before retrying the rest.
4. Export results CSV for the department record.
5. Check **Sheets** for failed sync jobs; retry. Never edit the Sheet's columns.

## Incidents

- **Wrong join code on projector** — regenerate the code only before registration opens; otherwise keep it and
  correct the projector URL.
- **Provider failure** — jobs stay `pending`/`failed` with the upstream message; fix credentials and press retry.
  Scores are already stored locally, so no data is lost.
- **Duplicate certificate number** — the counter is reserved transactionally; if a duplicate appears, stop the
  worker (Settings → set provider to mock), inspect `Settings` vs the app counter, reconcile to the higher number,
  then retry. Never renumber existing certificates.
- **Compromised admin account** — deactivate the user (revokes sessions), rotate `SESSION_SECRET`, rotate the bridge
  secret and Apps Script property, review the audit log.
- **Database restore** — stop the service, copy the latest `.backup` file to `DATABASE_PATH`, start, verify
  `/api/health` and the audit log continuity.

## Contacts / ownership

Owner: Department of EEE / EMBEDX coordinator. Technical owner: the administrator seeded by `ADMIN_EMAIL`.
