# Docker Desktop Server Guide

This guide runs the 4-Craft / TOPA Math beta stack from Docker Desktop without changing Stripe mode or including the existing `n8n-main` container.

## Services

- `4craft-web`: Next.js frontend on `http://localhost:3000`
- `4craft-api`: FastAPI backend on `http://localhost:8001`
- `4craft-postgres`: PostgreSQL 16 with persistent volume `4craft-postgres-data`
- `4craft-redis`: Redis 7 with append-only persistence in `4craft-redis-data`

MinIO is not included because the current app only defines MinIO settings and no active local app usage was found.

## First-Time Setup

From `C:\web-app\4-craft.com`:

```powershell
Copy-Item .env.docker.example .env.docker
notepad .env.docker
```

Before running beta containers, edit `.env.docker`:

- Change `POSTGRES_PASSWORD`.
- Make sure `DATABASE_URL` uses the same Postgres password.
- Change `JWT_SECRET` to a long local beta secret.
- Keep Stripe values empty or test-mode only. Do not add live Stripe keys.
- Keep `NEXT_PUBLIC_API_BASE_URL=http://localhost:8001` for local Docker Desktop browser access.
- Keep `INTERNAL_API_BASE_URL=http://4craft-api:8001` so the web container can reach the API by Docker service name.

If the non-Docker frontend/backend are already running on ports `3000` and `8001`, stop them first or set alternate `WEB_PORT` / `API_PORT` values in `.env.docker`.

## Start Beta Stack

```powershell
docker compose --env-file .env.docker -f docker-compose.beta.yml up -d --build
```

Docker Desktop should show:

- `4craft-web`
- `4craft-api`
- `4craft-postgres`
- `4craft-redis`

## Check Status

```powershell
docker ps --filter "name=4craft-"
docker logs -f 4craft-api
docker logs -f 4craft-web
curl.exe http://localhost:8001/health
curl.exe http://localhost:3000
```

Expected API health response:

```json
{"status":"ok"}
```

## App Smoke Test

Open `http://localhost:3000` and verify:

- Login with the local demo account if seeded: `demo@4-craft.com` / `demo1234`.
- `/dashboard` loads.
- `/lessons` loads.
- Grade tabs show only the selected grade.
- A lesson page opens correctly.
- A sample test can start and submit one answer.
- No HTTP 500, Next.js server error overlay, or missing chunk error appears.

## Networking Notes

Browser-side frontend code must call a browser-reachable URL, so local Docker beta uses:

```text
NEXT_PUBLIC_API_BASE_URL=http://localhost:8001
```

Server-side Next.js rewrites inside the container use Docker service discovery:

```text
INTERNAL_API_BASE_URL=http://4craft-api:8001
```

For a Cloudflare Tunnel beta, rebuild the frontend with the public API URL:

```text
NEXT_PUBLIC_API_BASE_URL=https://api-beta.topamath.com
```

Keep `INTERNAL_API_BASE_URL=http://4craft-api:8001` unless the web container must route server-side requests through the public tunnel. Backend CORS must include the public frontend origin, for example:

```text
CORS_ORIGINS=https://beta.topamath.com,http://localhost:3000,http://127.0.0.1:3000
```

The app currently uses direct API base URLs for client calls. It is not converted to a single same-domain `/api` proxy.

## Stop Beta Access

Stop containers while preserving database/Redis volumes:

```powershell
docker compose --env-file .env.docker -f docker-compose.beta.yml down
```

Do not use `down -v` unless you intentionally want to delete the persistent Postgres and Redis data.

## Development Compose

For local development with bind mounts and reload:

```powershell
docker compose --env-file .env.docker -f docker-compose.dev.yml up -d --build
```

Do not run `docker-compose.beta.yml` and `docker-compose.dev.yml` at the same time because they use the same container names and host ports.

## Data Safety

Postgres data persists in `4craft-postgres-data`. To make a quick SQL backup:

```powershell
docker exec 4craft-postgres pg_dump -U postgres adaptive_learning | Out-File -Encoding utf8 C:\web-app\4-craft-backups\4craft-postgres-backup.sql
```

The Docker beta stack starts with a Postgres database. If existing beta users are currently stored in a local SQLite file or another database, migrate or re-seed that data before using Docker for external testers.

## Security Notes

- Use a small tester group only.
- Do not run public ads against this local beta stack.
- Do not use production-sensitive data.
- Keep admin accounts private.
- Keep Stripe in test mode only.
- Keep `.env.docker` private and never commit it.
