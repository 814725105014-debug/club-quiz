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
- **Database restore** — stop the service, then `npm run backup -- --restore <snapshot>`; it verifies the
  snapshot, keeps the current database as `quiz.db.pre-restore-<time>`, removes stale WAL/SHM, and copies the
  certificate PDFs back. Start the service and check `/api/health` and Admin → Readiness.

## Backups

The SQLite database is the only state that cannot be rebuilt: scores, participants, issued certificate ids and
the audit log. Certificates themselves live in `data/certificates`, and `VACUUM INTO` takes a consistent copy
without stopping the API.

```bash
npm run backup                        # snapshot into data/backups (keeps the last 14)
npm run backup -- --list              # newest first, with row counts
npm run backup -- --verify <file>     # integrity_check + sha256 against the manifest
npm run backup -- --restore <file>    # refuses while the API holds the database
```

Each snapshot is `quiz-<utc>.db` plus a `.json` manifest (row counts, table checksums, app version, sha256) and a
sibling folder holding that day's certificate PDFs and outbox. Copy `data/backups` somewhere off the host —
a backup on the same disk does not survive a dead disk.

Automate it with the host's scheduler, not the app:

```cron
0 2 * * * cd /srv/quiz-platform && /usr/bin/npm run backup >> /var/log/quiz-backup.log 2>&1
0 3 * * 0 rsync -a /srv/quiz-platform/data/backups/ coordinator@nas:/backups/quiz-platform/
```

Admin → Readiness warns once the newest snapshot is more than a week old, or when none exists.

Retention: `BACKUP_KEEP` (default 14) snapshots are kept locally. Prune the off-host copy on your own schedule;
the `Logs` sheet in Google Sheets and the audit table remain the long-term record.

## Contacts / ownership

Owner: Department of EEE / EMBEDX coordinator. Technical owner: the administrator seeded by `ADMIN_EMAIL`.
