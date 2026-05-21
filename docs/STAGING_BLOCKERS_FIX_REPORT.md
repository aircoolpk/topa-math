# Staging Blockers Fix Report

Date: 2026-05-13  
Project: `D:\web app\4-craft.com`  
Scope: required-before-staging blockers only. No lesson content or public production scale work was changed.

## Result

**Staging blockers fixed. Ready to re-run staging deployment validation.**

Stripe remains test-mode only in all examples. No real secrets were added.

## Files Changed

| File | Change |
|---|---|
| `apps/api/app/core/config.py` | Added `CORS_ORIGINS` parsing and staging/production guard validation for database URL, JWT secret, and explicit non-wildcard CORS origins. |
| `apps/api/app/main.py` | Backend CORS now reads `settings.cors_origin_list` instead of hardcoded localhost list. |
| `apps/web/next.config.js` | API rewrites now use `NEXT_PUBLIC_API_BASE_URL`; staging/production fail loudly if it is missing. Local dev still falls back to `http://127.0.0.1:8001`. |
| `apps/web/src/lib/api-client.ts` | API client now uses env-driven API origin and only falls back to localhost for local/dev/test. |
| `apps/api/.env.example` | Expanded local backend env placeholders. |
| `apps/api/.env.staging.example` | Added staging backend env placeholders. |
| `apps/web/.env.example` | Expanded local frontend env placeholders. |
| `apps/web/.env.staging.example` | Added staging frontend env placeholders. |
| `.gitignore` | Allows `.env.staging.example` while keeping real `.env.*` ignored; added `.cache/` ignore. |

## Staging Blockers Fixed

| Blocker | Status | Evidence |
|---|---|---|
| Backend CORS hardcoded to localhost | Fixed | `main.py` now passes `settings.cors_origin_list` to `CORSMiddleware`; `config.py` parses comma-separated `CORS_ORIGINS`. |
| No wildcard CORS in staging/production | Fixed | `Settings.model_post_init()` rejects `*` when `ENVIRONMENT=staging` or `production`. |
| Staging CORS must be explicit | Fixed | Staging/prod validation rejects empty `CORS_ORIGINS` and localhost origins. |
| Frontend rewrites hardcoded to localhost | Fixed | `next.config.js` rewrite destinations now derive from `NEXT_PUBLIC_API_BASE_URL`. |
| Frontend silently falls back to localhost in staging/prod | Fixed | `next.config.js` and `api-client.ts` throw if `NEXT_PUBLIC_APP_ENV=staging|production` and `NEXT_PUBLIC_API_BASE_URL` is missing. |
| Staging accidentally using SQLite | Fixed | `Settings` rejects SQLite `DATABASE_URL` for staging/production. |
| Staging accidentally using default/weak JWT secret | Fixed | `Settings` rejects default or shorter-than-32-character `JWT_SECRET` for staging/production. |
| Env examples incomplete | Fixed | Added local and staging examples for backend and frontend. |
| Deploy ignore coverage | Fixed/Confirmed | `.env`, `.env.*`, `*.db`, `.next`, `node_modules`, `.venv`, logs, storage, and cache paths are ignored; `.env.staging.example` remains trackable. |

## Env Vars Added / Documented

### Backend

```text
ENVIRONMENT
DATABASE_URL
JWT_SECRET
JWT_ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES
CORS_ORIGINS
FRONTEND_BASE_URL
BACKEND_BASE_URL
REDIS_URL
MINIO_ENDPOINT
MINIO_ACCESS_KEY
MINIO_SECRET_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_EP_FOUNDER_MONTHLY
STRIPE_PRICE_TH_FOUNDER_MONTHLY
STRIPE_PRICE_EP_PLUS_MONTHLY
STRIPE_PRICE_TH_PLUS_MONTHLY
STRIPE_PRICE_EP_PLUS_YEARLY_PROMO
STRIPE_PRICE_TH_PLUS_YEARLY_PROMO
STRIPE_CUSTOMER_PORTAL_RETURN_URL
FOUNDER_PRICE_LIMIT
```

### Frontend

```text
NEXT_PUBLIC_APP_ENV
NEXT_PUBLIC_API_BASE_URL
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
```

## Validation Commands Run

| Command | Result |
|---|---|
| Backend settings smoke test: local defaults, valid staging settings, invalid staging defaults | Pass. Local SQLite allowed for local env; valid staging Postgres settings pass; staging defaults raise validation error. |
| Backend app import: `from app.main import app` | Pass. App imports and exposes `/` and `/health`. |
| Frontend staging missing API URL check | Pass. `NEXT_PUBLIC_APP_ENV=staging` without `NEXT_PUBLIC_API_BASE_URL` throws: `NEXT_PUBLIC_API_BASE_URL is required when NEXT_PUBLIC_APP_ENV is staging or production`. |
| Frontend staging API URL check | Pass. `NEXT_PUBLIC_APP_ENV=staging` with `NEXT_PUBLIC_API_BASE_URL=https://api-staging.4-craft.com` loads `next.config.js`. |
| Deploy ignore check with `git check-ignore -v` | Pass for real env files, SQLite DB, `.next`, `node_modules`, `.venv`, logs, storage, and `.cache`; `.env.staging.example` is unignored for tracking. |
| `node -v` using portable runtime | Pass: `v20.20.2`. |
| `npm run lint` | Pass: `tsc --noEmit`. |
| `npm run build` | Pass: Next.js production build completed successfully. Build emitted an existing ESLint option warning, but command exited successfully after type checking and generating all pages. |

## Local Dev Impact

Local dev remains supported without requiring staging env vars:

| Area | Local behavior |
|---|---|
| Backend database | Defaults to `sqlite:///./adaptive_learning.db` when `ENVIRONMENT=local`. |
| Backend CORS | Defaults to `http://127.0.0.1:3000,http://localhost:3000`. |
| Frontend API URL | Defaults to `http://127.0.0.1:8001` only when `NEXT_PUBLIC_APP_ENV` is local/dev/development/test or unset. |
| Staging/prod safety | Localhost fallback is blocked when `NEXT_PUBLIC_APP_ENV=staging` or `production`. |

## Remaining Blockers Before Public Production

These were intentionally not fixed in this staging-only task:

1. Commit real Alembic migration revisions and stop production schema mutation at app startup.
2. Add Stripe webhook idempotency with a durable event table.
3. Add founder quota reservation/locking.
4. Add idempotency/unique constraints for quiz answers, quest completion, XP awards, and progress updates.
5. Move mutable admin content editing away from local JSON files or add central storage/versioning.
6. Add production observability, structured logs, uptime checks, metrics, and alerts.
7. Add auth/checkout/admin rate limiting.
8. Decide whether `/docs` and `/openapi.json` should be disabled or protected in production.
