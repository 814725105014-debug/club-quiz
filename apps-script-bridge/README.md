# Bridge for the existing Apps Script project

`CertificateBridge.gs` is **not** part of the running Node app. It is a reviewed patch to paste into the
college's existing Apps Script project when the coordinator approves the production bridge.

- It only adds a `doPost` web app and helper functions; existing files, functions and Form triggers are untouched.
- It copies the Slides template (never edits it), replaces the seven placeholders that exist in the live template,
  inserts the QR from the PNG that the platform sends (no external QR service), exports a PDF, shares it read-only,
  upserts the Form Responses row by Certificate ID and returns the file IDs.
- The shared secret is the gate; rotate it with the server's `APPS_SCRIPT_SHARED_SECRET`.
- Full contract and install steps: [`../docs/APPS_SCRIPT_BRIDGE.md`](../docs/APPS_SCRIPT_BRIDGE.md).

Deploying this is a manual step; the repository never deploys it.
