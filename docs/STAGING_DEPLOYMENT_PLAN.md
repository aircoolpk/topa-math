# 4-Craft Staging Deployment Readiness Plan

Date: 2026-05-13  
Project: `D:\web app\4-craft.com`  
Scope: staging/test deployment only. Do not deploy yet.

## Decision

**READY FOR STAGING, with two required staging config gates before traffic is opened:**

1. Backend CORS must allow the staging frontend origin.
2. Frontend API URL must point to the staging backend, not localhost.

No public paid launch is approved by this plan. Stripe must remain in test mode.

## Local Preparation Status

Completed on 2026-05-13:

| Item | Status |
|---|---|
| Full local backup | Done: `D:\web app\backups\4-craft.com-backup-20260513-034954` |
| Staging source copy | Done: `D:\web app\staging\4-craft.com-staging-20260513-035313` |
| Git branch | Not applicable: current project folder is not a Git repository |
| Local env files | Kept local only; `.env`, `.env.local`, `.env.production`, and `.env.staging` were excluded from staging copy |
| Local database file | Removed from staging copy: `apps\api\adaptive_learning.db` |
| Latest docs copied to staging copy | Done for `SYSTEM_TEST_REPORT.md`, `MINI_QUIZ_FRONTEND_REVIEW_REPORT.md`, `REPLACEMENT_CHARACTER_REVIEW_REPORT_ROUND_2.md`, and this plan |

The full backup intentionally preserves local files, including local env files, because it is a private machine backup. The staging copy is the safer source candidate for deployment preparation.

## Recommended Staging Architecture

Use **Vercel frontend + Railway backend + Railway Postgres** for the first staging environment.

| Layer | Recommended service | Why |
|---|---|---|
| Frontend | Vercel | Native Next.js build/runtime, preview URLs, simple env management |
| Backend API | Railway or Render web service | Simple Python/FastAPI deployment, env vars, logs, health checks |
| Database | Railway Postgres | Managed staging DB with isolated data |
| Optional cache/object storage | Skip initially unless feature-tested | Redis/MinIO are configured but not required for the current verified core flow |
| Payments | Stripe test mode only | Safe checkout/webhook testing without live charges |

Suggested staging URLs:

```text
Frontend: https://4-craft-staging.vercel.app
Backend:  https://4-craft-api-staging.up.railway.app
```

## Current Config Review

| Area | Current state | Staging requirement |
|---|---|---|
| Frontend env | `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8001` locally | Set to staging API URL |
| Backend env | `.env` contains local/test values | Set secrets only in Railway/Render env, not committed files |
| Database | Defaults to SQLite unless `DATABASE_URL` is set | Use isolated managed Postgres |
| API URL config | `apiClient` reads `NEXT_PUBLIC_API_BASE_URL` | Good; set at build time on Vercel |
| Next rewrites | `next.config.js` rewrites point to `127.0.0.1:8001` | Avoid relying on rewrites in staging, or make destination env-driven before use |
| CORS | `allow_origins` is localhost-only | Must include Vercel staging frontend URL |
| Auth | JWT bearer token in localStorage | Use strong staging `JWT_SECRET`; HTTPS only |
| Stripe | Test keys currently used locally | Keep `sk_test`, `pk_test`, `whsec_...` test webhook only |

## Required Environment Variables

### Frontend, Vercel

Set these in the Vercel staging project:

```text
NEXT_PUBLIC_API_BASE_URL=https://4-craft-api-staging.up.railway.app
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
```

Do not set any `sk_live` or production-only values in Vercel.

### Backend, Railway/Render

Set these in the backend staging service:

```text
ENVIRONMENT=staging
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:PORT/DBNAME
JWT_SECRET=<strong-random-staging-secret>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
FRONTEND_BASE_URL=https://4-craft-staging.vercel.app
BACKEND_BASE_URL=https://4-craft-api-staging.up.railway.app

STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_EP_FOUNDER_MONTHLY=price_test_xxx
STRIPE_PRICE_TH_FOUNDER_MONTHLY=price_test_xxx
STRIPE_PRICE_EP_PLUS_MONTHLY=price_test_xxx
STRIPE_PRICE_TH_PLUS_MONTHLY=price_test_xxx
STRIPE_PRICE_EP_PLUS_YEARLY_PROMO=price_test_xxx
STRIPE_PRICE_TH_PLUS_YEARLY_PROMO=price_test_xxx
FOUNDER_PRICE_LIMIT=100
STRIPE_CUSTOMER_PORTAL_RETURN_URL=https://4-craft-staging.vercel.app/dashboard
```

Optional only if those features are exercised in staging:

```text
REDIS_URL=...
MINIMAX_API_KEY=...
MINIO_ENDPOINT=...
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...
```

## Required Config Gates

### 1. CORS

Current backend CORS allows only:

```text
http://127.0.0.1:3000
http://localhost:3000
```

Before staging browser tests, update backend config so CORS also allows:

```text
https://4-craft-staging.vercel.app
```

Preferred implementation: add an env-driven `CORS_ORIGINS` setting and parse comma-separated origins.

### 2. Frontend API URL

Vercel must build with:

```text
NEXT_PUBLIC_API_BASE_URL=https://4-craft-api-staging.up.railway.app
```

The frontend `apiClient` already reads this variable. Do not leave it as `127.0.0.1`.

### 3. Local-only rewrites

`apps/web/next.config.js` currently contains localhost API rewrites. Since the frontend uses `NEXT_PUBLIC_API_BASE_URL`, staging should not rely on these rewrites. If rewrites are needed later, make the destination env-driven.

## Build Commands

### Frontend

Vercel settings:

```text
Root Directory: apps/web
Install Command: npm ci
Build Command: npm run build
Output: Next.js default
Node version: 20.x
```

Manual validation command:

```powershell
cd "D:\web app\4-craft.com\apps\web"
npm ci
npm run lint
npm run build
```

### Backend

Railway/Render settings:

```text
Root Directory: apps/api
Build Command: pip install -e ".[test]"
Start Command: uvicorn app.main:app --host 0.0.0.0 --port $PORT
Python: 3.12 recommended
```

If using Docker:

```text
Dockerfile: apps/api/Dockerfile
Start command inside image: uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Exact Deploy Steps

### Option A: Vercel + Railway/Render

1. Create a staging backend service from `apps/api`.
2. Attach a staging Postgres database.
3. Set backend env vars listed above.
4. Add staging frontend URL to backend CORS config.
5. Deploy backend.
6. Verify backend:

```bash
curl https://4-craft-api-staging.up.railway.app/health
curl https://4-craft-api-staging.up.railway.app/openapi.json
```

7. Create a staging frontend project from `apps/web`.
8. Set frontend env vars listed above.
9. Deploy frontend.
10. Verify frontend route loads:

```bash
curl -I https://4-craft-staging.vercel.app/
curl -I https://4-craft-staging.vercel.app/login
```

11. Run post-deploy browser checklist below.

### Option B: VPS Docker

Use this only if Vercel/Railway is not acceptable.

1. Provision a staging VPS.
2. Install Docker and Docker Compose.
3. Create staging `.env` on the VPS only.
4. Use Postgres volume with staging-only credentials.
5. Configure reverse proxy:

```text
https://staging.4-craft.com -> frontend container
https://api-staging.4-craft.com -> api container
```

6. Set TLS with Let’s Encrypt.
7. Build and start:

```bash
docker compose -f infra/docker-compose.yml up -d --build
```

8. Replace default compose credentials before opening access. Do not use `postgres:postgres`, `JWT_SECRET=change-me`, or MinIO defaults in shared staging.

## Pre-Deploy Checklist

| Check | Required status |
|---|---|
| Frontend build passes | Required |
| Backend starts locally | Required |
| JSON validation passes | Required |
| Demo login works locally | Required |
| Lesson pages render locally | Required |
| Mini quiz correct/wrong behavior approved locally | Required |
| CORS includes staging frontend URL | Required before browser testing |
| `NEXT_PUBLIC_API_BASE_URL` points to staging backend | Required |
| Staging DB is isolated from local/prod | Required |
| `JWT_SECRET` is strong and staging-specific | Required |
| Stripe keys are test mode only | Required |
| No `sk_live`, live webhook, or production DB URL in staging | Required |

## Post-Deploy Browser Test Checklist

Run in a clean browser profile:

1. Open staging frontend.
2. Register a staging-only test account, or log in with seeded staging demo account.
3. Verify `/login` redirects to `/dashboard`.
4. Verify dashboard loads child profile, quests, lessons, rank, and billing status.
5. Open:

```text
/dashboard/lessons/g3_area_intro
/dashboard/lessons/g3_division_intro
/dashboard/lessons/g3_fractions_intro
```

6. Verify correct choices:

```text
B.12 ช่อง
B.4 ดวง
C.2 ชิ้น
```

7. Verify wrong choices still show wrong feedback.
8. Verify no Next.js Server Error overlay.
9. Verify browser console has no missing `.next` chunk errors.
10. Verify network tab has no CORS failures.
11. Verify `/billing` and `/pricing` show test-mode plan data.
12. Create a Stripe test checkout with test card only, then verify webhook updates staging membership.
13. Verify logout and relogin.

## Rollback Plan

### Vercel Frontend

1. Use Vercel deployment history.
2. Promote the last known good staging deployment.
3. If API URL env was wrong, correct env and redeploy.

### Railway/Render Backend

1. Roll back to previous deployment.
2. If database migration caused issues, restore from latest staging DB backup.
3. Rotate any exposed staging secret immediately.
4. Keep Stripe in test mode; no customer-impacting live payments should exist.

### Database

1. Take a manual staging snapshot before first deploy.
2. For bad content/import state, restore the snapshot.
3. Do not restore staging data into production.

## Remaining Blockers Before Public Launch

These do not block staging if the two staging config gates are handled, but they must be resolved before public launch:

| Area | Blocker |
|---|---|
| Payments | Stripe live mode not enabled or audited |
| Secrets | Production secret rotation and storage policy not finalized |
| Database | Production migration/backup/restore process not rehearsed |
| Observability | Error monitoring, uptime checks, structured logs, and alerting not configured |
| Security | Rate limiting, abuse controls, admin access policy, and secret scanning not complete |
| CORS/config | CORS and frontend API URL should be env-driven, not hardcoded |
| Content QA | Full public-launch content QA across all grades/programs still needed |
| Legal/compliance | Terms, privacy policy, refund policy, and child-data handling review still needed |
| Paid launch | Founder plan limits and entitlement flows need full Stripe test coverage before live mode |

## Staging Safety Rules

```text
Do not use Stripe live keys.
Do not connect staging to production database.
Do not expose production secrets.
Do not open public paid launch from staging.
Do not reuse local default JWT, Postgres, Redis, or MinIO credentials.
```
