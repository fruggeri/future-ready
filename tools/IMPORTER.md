# FutureReady Simbli Importer

Phase 1 adds a local importer for Simbli meeting agendas.

## Components

- `tools/importer-helper`
  - Local Node helper server
  - Listens on `http://127.0.0.1:4318`
  - Writes SQLite data and attachment files to `~/FutureReadyData`
- `tools/simbli-importer-extension`
  - Unpacked Chrome extension
  - Scrapes the active Simbli meeting page and sends it to the helper

## Run

1. Start the helper:

```bash
npm run importer:helper
```

2. In Chrome, open `chrome://extensions`.
3. Enable Developer Mode.
4. Choose "Load unpacked".
5. Select:

```text
/Users/francoruggeri/AI-APPS/FutureReady/FutureReady/tools/simbli-importer-extension
```

6. Open a Simbli meeting page.
7. In the extension popup, confirm the `Importer Helper URL`.
8. For local development, use:

```text
http://127.0.0.1:4318
```

9. Keep the extension pointed at the local helper. The helper saves the meeting locally first, then syncs it to the hosted helper configured through:

```env
FUTUREREADY_SYNC_URL=https://board-briefing.187.77.12.18.sslip.io/helper
FUTUREREADY_LIVE_APP_URL=https://board-briefing.187.77.12.18.sslip.io
```

The sync request uses `FUTUREREADY_SYNC_TOKEN`, falling back to `JWT_SECRET`. The hosted helper requires `FUTUREREADY_IMPORT_TOKEN` and must use the same secret.

10. Click the FutureReady importer extension icon.
11. Click `Import This Meeting`.
12. After a successful live sync, the extension opens the imported meeting in the live board app.

## Output

- SQLite database:

```text
~/FutureReadyData/futureready.sqlite
```

- Attachment files:

```text
~/FutureReadyData/attachments/
```

- Raw import snapshots:

```text
~/FutureReadyData/logs/
```

- Failed live syncs remain queued in the local SQLite database and retry once per minute while the helper is running.

## Current MVP behavior

- Imports one meeting at a time.
- Scrapes every rendered agenda item in the left tree.
- Captures the current right-pane content for each item.
- Downloads supporting documents through the browser session.
- Stores item text, HTML, attachment metadata, and raw files locally.

## Known limitations

- The scraper relies on the rendered meeting DOM, so major Simbli UI changes could break selectors.
- Attachment text extraction is not part of phase 1 yet.
- The popup reports the final result, not per-item live progress.
