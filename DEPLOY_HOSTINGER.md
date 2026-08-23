# Hostinger VPS Deployment

## Current board archive deployment

The SQL-backed board briefing desk runs at:

```text
https://board-briefing.187.77.12.18.sslip.io/board
```

Deploy it from the repository root with:

```bash
docker compose --env-file .env -f deploy/docker-compose.hostinger.yml up -d --build
```

Both containers mount `/var/www/future-ready-data`. The web container opens the SQLite database read-only; the helper container owns imports and attachment writes. Traefik publishes the helper under `/helper` and strips that prefix before forwarding requests.

The hosted helper requires `FUTUREREADY_IMPORT_TOKEN`. The compose file derives it from `JWT_SECRET`; the local helper uses that same secret when syncing.

This app has two services:

- `board-web`
  - Next.js dashboard and APIs
- `board-helper`
  - importer helper, SQLite writer, OpenAI attachment indexer

## Environment variables

Set these in Hostinger for both processes:

```env
OPENAI_API_KEY=your_real_key
FUTUREREADY_DATA_DIR=/var/www/board-briefing-desk/data
FUTUREREADY_DATA_DB=/var/www/board-briefing-desk/data/futureready.sqlite
DATABASE_URL=postgres://...
JWT_SECRET=...
```

## Process manager

Use PM2 with:

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Extension setting

After deployment, set the extension helper URL to your HTTPS endpoint, for example:

```text
https://board.yourdomain.com/helper
```

If you proxy the helper directly:

```text
https://board.yourdomain.com
```

depending on your Nginx routing.

## Recommended folders

```text
/var/www/board-briefing-desk/current
/var/www/board-briefing-desk/data
```
