# Hostinger VPS Deployment

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
