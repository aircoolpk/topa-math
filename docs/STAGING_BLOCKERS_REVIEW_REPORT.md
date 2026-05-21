# Staging Blockers Review Report

Date: 2026-05-13  
Project: `D:\web app\4-craft.com`  
Scope: review only. No code was edited during review.

## Decision

**APPROVED FOR STAGING DEPLOY**

The required staging blockers from `PRODUCTION_ARCHITECTURE_REVIEW.md` are fixed and validated. Remaining items are public production / horizontal scaling work, not blockers for staging.

## Review Results

| Check | Status | Evidence |
|---|---|---|
| Backend CORS is env-driven | Pass | `apps/api/app/main.py` uses `allow_origins=settings.cors_origin_list`; `apps/api/app/core/config.py` parses comma-separated `cors_origins`. |
| No wildcard CORS in staging/production | Pass | `Settings.model_post_init()` rejects `*` when `ENVIRONMENT` is `staging` or `production`; smoke test confirmed wildcard rejection. |
| Frontend API base URL is env-driven | Pass | `apps/web/next.config.js` and `apps/web/src/lib/api-client.ts` use `NEXT_PUBLIC_API_BASE_URL`. |
| No staging/production fallback to localhost | Pass | `NEXT_PUBLIC_APP_ENV=staging` without `NEXT_PUBLIC_API_BASE_URL` throws; smoke test confirmed failure message. Localhost fallback remains local/dev/test only. |
| Staging env example files exist and are complete | Pass | `apps/api/.env.staging.example` and `apps/web/.env.staging.example` exist and include staging API/CORS/database/JWT/Stripe test placeholders. |
| Staging/production config rejects SQLite | Pass | Smoke test confirmed `Settings(environment="staging", database_url="sqlite:///...")` raises validation error. |
| JWT secret default rejected in staging/production | Pass | Smoke test confirmed `JWT_SECRET=change-me-in-production` is rejected for staging. |
| `.gitignore` excludes secrets/local artifacts | Pass | `git check-ignore -v` confirmed real env files, SQLite DB, `.next`, `node_modules`, `.venv`, logs, storage, and `.cache` are ignored; `.env.staging.example` remains trackable. |
| Frontend build passes | Pass | With portable Node `v20.20.2` and staging env placeholders, `npm run build` completed successfully. It still prints the known Next/ESLint option warning after build output, but exits `0`. |
| Backend startup/import passes | Pass | `from app.main import app` succeeded and app routes include `/` and `/health`. |

## Validation Commands Run

| Command | Result |
|---|---|
| Backend config smoke test for local, valid staging, SQLite rejection, default JWT rejection, wildcard CORS rejection, localhost CORS rejection | Pass |
| Backend import check: `from app.main import app` | Pass |
| Frontend staging missing API URL check via `node -e "require('./next.config.js')"` | Pass, throws expected error |
| Frontend staging API URL rewrite check with `NEXT_PUBLIC_API_BASE_URL=https://api-staging.4-craft.com` | Pass, rewrite destination points to staging API |
| `git check-ignore -v ...` for env/db/build/deps/log/storage/cache artifacts | Pass |
| `npm run build` with portable Node `v20.20.2` and staging env placeholders | Pass |

## Notes

The staging examples intentionally use placeholders only:

```text
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
```

No Stripe live mode is enabled.

## Remaining Non-Staging Blockers

These remain before public production or horizontal scaling, but do not block staging deployment:

1. Real Alembic migration revisions and production migration flow.
2. Stripe webhook idempotency table.
3. Founder quota locking/reservation.
4. Idempotency for XP, quiz answer, quest completion, and progress updates.
5. Centralized/versioned storage for mutable admin content edits.
6. Production observability, rate limiting, and docs/openapi exposure policy.
