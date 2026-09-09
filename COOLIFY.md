# Coolify deployment

This repository contains the Miller Creek School District board briefing desk and its importer helper. The board product uses local SQLite and local full-text search. It does not require OpenAI, Supabase, or a hosted database.

## Create the resource

1. In Coolify, create a new **Project** and environment.
2. Add a **Docker Compose** resource from this GitHub repository.
3. Set the compose file to `deploy/docker-compose.hostinger.yml`.
4. Select the `main` branch and deploy.
5. Configure the `web` service to expose container port `3000`.
6. Configure the public domain for the `web` service as `https://board-briefing.187.77.12.18.sslip.io`.
7. Keep the `helper` service on the same host and expose it through the existing `/helper` route. Its container port is `4318`.

The compose file retains the existing host directories:

- `/var/www/board-briefing-desk/data` stores `futureready.sqlite`, downloaded attachments, and import logs.
- `/var/www/board-meetings` stores the optional iOS archive feed.

Do not remove either directory during the migration. If the current archive is elsewhere, copy it into `/var/www/board-briefing-desk/data` before the first Coolify deployment.

## After deployment

Verify the web service:

```text
https://board-briefing.187.77.12.18.sslip.io/board
```

Verify the helper through the public route:

```text
https://board-briefing.187.77.12.18.sslip.io/helper/health
```

The Chrome extension should use the same helper URL, ending in `/helper`. Re-importing is not required when the SQLite file and attachment directory are mounted from the existing host paths.

## Important separation

The repository still contains the unrelated original FutureReady family-app routes. They are not used by the board briefing desk. The board search and importer paths have no OpenAI dependency; the `openai` package remains only because those unrelated legacy routes still reference it.
