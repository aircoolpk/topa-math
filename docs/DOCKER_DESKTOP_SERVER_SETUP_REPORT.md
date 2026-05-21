# Docker Desktop Server Setup Report

Date: 2026-05-16

## Files Changed

- `.gitignore`
- `.env.docker.example`
- `docker-compose.beta.yml`
- `docker-compose.dev.yml`
- `apps/api/Dockerfile`
- `apps/api/.dockerignore`
- `apps/web/Dockerfile`
- `apps/web/.dockerignore`
- `apps/web/next.config.js`
- `docs/DOCKER_DESKTOP_SERVER_GUIDE.md`
- `docs/DOCKER_DESKTOP_SERVER_SETUP_REPORT.md`

## Environment Variables Identified

Backend:

- `ENVIRONMENT`
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_ALGORITHM`
- `ACCESS_TOKEN_EXPIRE_MINUTES`
- `CORS_ORIGINS`
- `REDIS_URL`
- `FRONTEND_BASE_URL`
- `BACKEND_BASE_URL`
- `MINIO_ENDPOINT`
- `MINIO_ACCESS_KEY`
- `MINIO_SECRET_KEY`
- Stripe test-mode related values
- `MINIMAX_API_KEY`

Frontend:

- `NEXT_PUBLIC_APP_ENV`
- `NEXT_PUBLIC_API_BASE_URL`
- `INTERNAL_API_BASE_URL` added for Docker server-side rewrites

## Docker Setup Created

`docker-compose.beta.yml` creates these Docker Desktop containers:

- `4craft-web`: Next.js standalone production server on port `3000`
- `4craft-api`: FastAPI/Uvicorn on `0.0.0.0:8001`
- `4craft-postgres`: PostgreSQL 16 with persistent volume
- `4craft-redis`: Redis 7 with append-only persistence

`docker-compose.dev.yml` was also added for reload-oriented local development with the same clear container names. It should not run at the same time as the beta compose file.

MinIO was not included because current repository usage only exposes settings and examples; no active local app code path requiring MinIO was found.

## Networking Behavior

The frontend container reaches the backend over Docker networking with:

```text
INTERNAL_API_BASE_URL=http://4craft-api:8001
```

External browser access still uses:

```text
NEXT_PUBLIC_API_BASE_URL=http://localhost:8001
```

For tunnel beta, rebuild the frontend with the public beta API URL, for example:

```text
NEXT_PUBLIC_API_BASE_URL=https://api-beta.topamath.com
```

and keep backend `CORS_ORIGINS` aligned with the public frontend origin.

## Health Checks

Added service health checks:

- API: `http://127.0.0.1:8001/health` inside `4craft-api`
- Web: `http://127.0.0.1:3000` inside `4craft-web`
- Postgres: `pg_isready`
- Redis: `redis-cli ping`

## Validation Results

Completed:

- `docker compose -f docker-compose.beta.yml config` passed.
- `docker compose -f docker-compose.dev.yml config` passed.
- `npm run build` in `apps/web` passed and generated Next.js standalone output. Next reported the existing non-fatal ESLint option warning about `useEslintrc` / `extensions`, but the build exited successfully.
- `apps/web/.next/standalone/server.js` exists.
- `python -m py_compile apps/api/app/core/config.py apps/api/app/main.py` passed.

Not run:

- `docker compose --env-file .env.docker -f docker-compose.beta.yml up -d --build`
- Runtime `docker ps`, `docker logs`, `curl`, browser login, dashboard, lessons, and sample test checks.

Reason: the existing non-Docker local frontend/backend are already using ports `3000` and `8001`. The runtime commands are documented in `docs/DOCKER_DESKTOP_SERVER_GUIDE.md`; stop the local services first or change `WEB_PORT` / `API_PORT` in `.env.docker`.

## Stripe/Auth/Scoring Safety

- Stripe logic and config were not modified.
- Stripe live mode was not enabled.
- Auth logic was not modified.
- Quiz/test scoring logic was not modified.
- `npm audit fix --force` was not run.

## Remaining Risks

- First Docker beta run uses the Postgres volume database. If existing beta data lives in SQLite or another local database, it must be migrated or recreated before external testers use the Docker stack.
- Public tunnel beta requires rebuilding the web image with the public `NEXT_PUBLIC_API_BASE_URL` because browser-exposed Next.js env values are build-time values.
- Full runtime validation still needs to be run after freeing ports `3000` and `8001`.

## Final Decision

READY_FOR_DOCKER_DESKTOP_BETA
