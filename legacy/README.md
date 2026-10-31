# Legacy static prototype (superseded)

These files are the earlier static quiz portal (`index.html`, `admin.html`, `projector.html`, `css/`, `js/`).
**Do not deploy them.** `js/questions.js` contains answer keys that are shipped to the browser, which is exactly
what the new server-graded platform removes.

The running application is in `server/` + `web/`, built to `dist/` and served by Express. These files are kept only
as a design/reference archive. The old standalone test runner is at `legacy/tests/standalone_tests.js`.
