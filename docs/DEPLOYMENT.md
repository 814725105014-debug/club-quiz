# Deployment guide

Target: a single college-controlled Linux host (or an existing VM) running Node.js 20+ behind TLS. No paid service
is required. **Do not deploy publicly or send real participant email until the coordinator approves** — the app
ships in `EMAIL_TEST_MODE=true`.

## 1. Prerequisites

- Node.js 20.11+ (22 LTS recommended — `node:sqlite` is used instead of a native module, so no build toolchain is
  needed).
- A DNS name, e.g. `quiz.trp.srmtrichy.edu.in`, pointing at the host.
- Ports 80/443 reachable; the app itself listens on `127.0.0.1:4000` behind a reverse proxy.
- ~200 MB disk plus certificate PDFs (about 25 KB each).

## 2. Install

```bash
git clone <private-repo-url> /srv/club-quiz
cd /srv/club-quiz
git checkout main          # or the approved release tag
cp .env.example .env
# edit .env — see section 3
npm ci --omit=dev || npm ci
npm run build
npm run seed               # first run only: creates schema + first admin
```

Keep `data/` outside the release directory if you deploy by re-cloning, e.g. `DATA_DIR=/srv/quiz-data` and
`DATABASE_PATH=/srv/quiz-data/quiz.db`.

## 3. Required environment

| Variable | Notes |
| --- | --- |
| `NODE_ENV=production` | enables secure cookies, strict CSP, no demo seeding |
| `PORT=4000` | bind address is `0.0.0.0`; keep it behind the proxy |
| `APP_BASE_URL=https://quiz.trp.srmtrichy.edu.in` | used for join links, QR codes, verification URLs |
| `SESSION_SECRET` | 32+ random bytes (`openssl rand -base64 48`) |
| `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD` | seeded once; change the password after first login |
| `GOOGLE_PROVIDER` | `apps_script` (recommended) or `google_api` |
| `APPS_SCRIPT_WEBHOOK_URL`, `APPS_SCRIPT_SHARED_SECRET` | for the bridge provider |
| `EMAIL_TEST_MODE` | keep `true` until the coordinator signs off |
| `EMAIL_REDIRECT_TO` | the admin address that receives test mail |
| `GOOGLE_SPREADSHEET_ID`, `SHEET_*_TAB`, `CERT_*` | already populated with the audited resource IDs |

Never commit `.env`. Back it up in the college's password manager.

## 4. Process supervision (systemd)

```ini
# /etc/systemd/system/quiz-platform.service
[Unit]
Description=QUIZ PLATFORM
After=network.target

[Service]
Type=simple
User=quiz
WorkingDirectory=/srv/club-quiz
EnvironmentFile=/srv/club-quiz/.env
ExecStart=/usr/bin/node dist/server/index.js
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ReadWritePaths=/srv/quiz-data

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now quiz-platform
sudo journalctl -u quiz-platform -f
```

## 5. Reverse proxy (Caddy example)

```
quiz.trp.srmtrichy.edu.in {
    encode gzip
    reverse_proxy 127.0.0.1:4000
}
```

Nginx equivalent: `proxy_pass http://127.0.0.1:4000;` plus `proxy_set_header X-Forwarded-Proto $scheme;` and
`X-Forwarded-Host $host;` (the app trusts one proxy hop). Do not cache `/api/*`.

## 6. Google provider setup

### 6a. Apps Script bridge (recommended)

1. Open the **existing** Apps Script project `16hTGWLwIvGNZqPMQXdDUMasc8kZFg2atwkfWi50X9vg0zgjLUUf3MejZ`.
2. Add `apps-script-bridge/CertificateBridge.gs` as a new file (do not remove existing files).
3. Project Settings → Script properties:
   - `QUIZ_PLATFORM_SECRET` = the same random value as `APPS_SCRIPT_SHARED_SECRET`
   - `QUIZ_PLATFORM_SPREADSHEET_ID` = `1jiVDFpIxGwfSlHBt3vaHl-5GFd8DPGapSS4tsR-FhJQ`
   - `QUIZ_PLATFORM_TEMPLATE_ID` = `1dkfJ6PQtmeDEkcNR4xJWsWrLjSu5pkAnvY3JY44_ISo`
   - `QUIZ_PLATFORM_OUTPUT_FOLDER_ID` = `1SDdCpIQHvf_WP0o9vC0ZrLHEb9vt0Q6Y`
4. Deploy → New deployment → Web app → *Execute as: me*, *Who has access: anyone* (the shared secret is the gate;
   use "anyone with Google account" if the caller can mint a token).
5. Copy the `/exec` URL into `APPS_SCRIPT_WEBHOOK_URL`, then verify with
   **Admin → Settings → Test Google Workspace connection** (should report `apps_script` reachable and list tabs).
6. Keep the existing Form-submit trigger untouched. The new code only **adds** a web-app entry point; the old
   `generateCertificateForStudent` function is called, never replaced.

### 6b. Direct Google API (service account)

1. In Google Cloud, create a project, enable **Sheets, Slides, Drive, Gmail APIs**.
2. Create a service account + JSON key, store it outside the repo (`GOOGLE_SERVICE_ACCOUNT_FILE=/etc/quiz/sa.json`).
3. Domain-wide delegation: add the service account client ID in Workspace Admin → Security → API controls with
   scopes `spreadsheets`, `presentations`, `drive`, `gmail.send`; set `GOOGLE_IMPERSONATE_EMAIL` to the
   certificate mailbox (`certificate.trp.srmtrichy@gmail.com` or the institutional admin).
4. Share the spreadsheet, template and output folder with that account (Editor for the sheet/folder; the template
   only needs read access because certificates are generated from copies).
5. Set `GOOGLE_PROVIDER=google_api` and test the connection from Settings.

> OAuth refresh-token mode (`GOOGLE_OAUTH_*`) exists for testing, but service-account delegation is more stable in
> production. Never place tokens in the frontend.

## 7. Email safety

- `EMAIL_TEST_MODE=true` redirects every message to `EMAIL_REDIRECT_TO` and records `redirected` in the email log.
- Sending real participant mail is a **manual, approved** step: set `EMAIL_TEST_MODE=false`, send one test email to
  the coordinator, then run `POST /api/admin/sync/all` / retry only after sign-off.
- Gmail sending is subject to Workspace limits (roughly 1,500 recipients/day for a paid account). The job queue
  retries failures with backoff; bulk delivery beyond a few hundred recipients should be scheduled, not burst.

## 8. Backups and retention

```bash
# nightly, WAL-safe
sqlite3 /srv/quiz-data/quiz.db ".backup '/srv/backups/quiz-$(date +%F).db'"
tar czf /srv/backups/certificates-$(date +%F).tgz -C /srv/quiz-data certificates
```

Keep 30 daily + 12 monthly copies. Certificate PDFs also live in the Drive folder, so the local copies are a cache.
Never truncate or reorder the Google Sheet; the sync layer upserts rows by key and appends Form Responses rows.

## 9. Upgrade and rollback

```bash
cd /srv/club-quiz
git fetch && git checkout <tag>
npm ci && npm run build
sudo systemctl restart quiz-platform
```

Schema changes are additive in `server/src/db.ts` (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN` guarded
by `PRAGMA table_info`). Roll back by checking out the previous tag and restarting; keep the pre-upgrade DB backup.

## 10. Health checks

- `GET /api/health` → `{ok:true}`.
- Admin → Settings → Test connection → provider reachability + tab list.
- Admin → Sheets → recent sync jobs; failures can be retried individually.
- `journalctl -u quiz-platform` for job worker errors (`[sweeper]`, `[jobs]`).
