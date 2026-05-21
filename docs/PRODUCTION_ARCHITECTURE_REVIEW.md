# Production Architecture Review

Date: 2026-05-13  
Project: `D:\web app\4-craft.com`  
Scope: architecture readiness review only. No application behavior was changed.

## Executive Verdict

**READY FOR STAGING ONLY**

The current architecture can be moved to another machine and can support a single vertically scaled backend with managed PostgreSQL after staging configuration gates are handled. It is not yet production-ready for public paid launch or horizontal API scaling because several runtime assumptions remain local or single-instance oriented: backend CORS is hardcoded to localhost, Next.js rewrites point to `127.0.0.1`, Alembic has no committed migration revisions, admin content editing writes JSON files on local disk, Stripe webhook handling has no stored event idempotency, and quota/progress updates do not use database-level locks or idempotency keys.

## Machine Migration Readiness

| Check | Status | Evidence | Fix Needed |
|---|---|---|---|
| Git snapshot exists | Pass | Local repo created with snapshot tag `staging-snapshot-20260513-091147`; `docs/STAGING_SNAPSHOT.md` records backup/source copy references. | None for staging. |
| Local secrets ignored | Pass | `.gitignore` excludes `.env`, `.env.*`, `.db`, `.next`, `.venv`, `node_modules`, logs, storage, and caches. | Keep policy enforced before any remote push. |
| Fresh backend setup documented | Partial | `README.md` documents venv, `pip install -e ".[test]"`, seed, tests, and `uvicorn`; paths are Windows-specific (`D:\web app\4-craft.com`). | Add platform-neutral setup and production deploy runbook. |
| Fresh frontend setup documented | Partial | `README.md` documents `npm install --legacy-peer-deps`, `npm run dev`, and `npm run build`; staging plan documents Vercel settings. | Reconcile documented backend/frontend ports and prefer `npm ci` for reproducible install. |
| Docker path exists | Partial | `apps/api/Dockerfile` exists; `infra/docker-compose.yml` runs API, Postgres, Redis, MinIO. | Add production/staging compose or service manifests with non-default secrets. |
| Env examples exist | Partial | `apps/api/.env.example` and `apps/web/.env.example` exist. | Backend example is incomplete: missing `DATABASE_URL`, `JWT_SECRET`, `ENVIRONMENT`, `REDIS_URL`, MinIO/storage vars, CORS origins. |
| DB separated from local files | Partial | Runtime default is SQLite `sqlite:///./adaptive_learning.db`; Docker uses PostgreSQL. | Require PostgreSQL `DATABASE_URL` outside local/dev and prevent production boot with default SQLite. |
| Migration/seed commands documented | Partial | `README.md` lists Alembic revision/upgrade and `python -m app.seeds.seed`. | Add exact staging/prod migration and seed order; avoid autogenerate-on-deploy ambiguity. |

## Vertical Scaling Readiness

| Check | Status | Evidence | Fix Needed |
|---|---|---|---|
| Backend can run as one larger service | Pass | FastAPI app is process-local, DB-backed, no memory session middleware found. | Add production process manager/gunicorn worker guidance. |
| Auth does not require sticky sessions | Pass | `apps/api/app/core/security.py` creates/verifies HMAC JWT; `current_user` reads bearer token and DB user. | Use strong env `JWT_SECRET`; consider standard JWT library and key rotation later. |
| PostgreSQL dependency available | Pass | `pyproject.toml` includes `psycopg[binary]`; models include PostgreSQL JSONB/ARRAY variants. | Validate all queries against Postgres in staging. |
| Startup creates schema automatically | Partial | `main.py` calls `Base.metadata.create_all()` and `ensure_local_schema()` at startup. | Replace production startup schema mutation with Alembic migrations only. |
| Static content reads scale vertically | Pass for single instance | Lesson/content services read JSON from local app filesystem. | Fine for one instance if content is immutable during deploy. |
| Observability | Missing | No structured logging, monitoring, Sentry/OpenTelemetry, or health beyond `/health` found. | Add production logs, error tracking, uptime checks, and alerts. |

## Horizontal Scaling Readiness

| Check | Status | Evidence | Fix Needed |
|---|---|---|---|
| Stateless web/API sessions | Pass | Auth is JWT-based; no in-memory sessions found. | Keep JWT secret identical across API instances. |
| CORS env-driven | Fail | `main.py` hardcodes `allow_origins=["http://127.0.0.1:3000", "http://localhost:3000"]`. | Add `CORS_ORIGINS` env parsing and reject wildcard in production. |
| Frontend API origin env-driven | Partial | `api-client.ts` uses `NEXT_PUBLIC_API_BASE_URL`; `next.config.js` rewrites still hardcode `http://127.0.0.1:8001`. | Make rewrites env-driven or remove production rewrites. |
| Webhook idempotency | Fail | Stripe webhook verifies signature but no `stripe_event_id` storage or duplicate-event guard was found. | Add webhook event table with unique event id and transactional processing. |
| Founder quota race safety | Fail | Founder availability is count-then-create: `_founder_slots()` checks count before checkout; no lock/reservation. | Add DB reservation or transactional quota lock before granting founder entitlement. |
| XP/progress duplicate safety | Fail | Quest completion and quiz answers increment XP directly; no unique idempotency key for repeated client submits. | Add unique constraints/idempotency keys and row-level locking for reward updates. |
| Admin content edits across instances | Fail | Admin content save writes JSON files under local `app/content/math` and creates local backups. | Move editable content to DB/object storage with versioning, or restrict editor to single writer. |
| Redis/queue readiness | Partial | `redis_url` setting and Redis compose service exist, but no queue/worker usage found. | Add queue design for AI/content/background jobs before multi-instance async work. |
| Content synchronization | Fail | Multiple API instances would each have their own filesystem copy unless deployed read-only and immutable. | Store mutable content centrally or deploy immutable content with CI artifact versioning. |

## Hardcoded Config Audit

| File | Hardcoded Value | Risk | Recommended Fix |
|---|---|---|---|
| `apps/web/next.config.js` | `http://127.0.0.1:8001` in rewrites | Staging/prod frontend can silently call local backend or fail. | Use env-driven backend URL or remove rewrites for deployed frontend. |
| `apps/web/src/lib/api-client.ts` | Fallback `http://127.0.0.1:8001` | Missing env in production falls back to localhost. | Fail build/start when `NEXT_PUBLIC_API_BASE_URL` is missing in non-local env. |
| `apps/api/app/main.py` | CORS localhost origins only | Deployed browser app will hit CORS failures; wildcard workaround would be unsafe. | Add `CORS_ORIGINS` env setting. |
| `apps/api/app/core/config.py` | Default SQLite DB and default JWT secret | Accidental production boot with local DB or weak secret. | Validate `ENVIRONMENT=production` requires Postgres URL and strong secret. |
| `apps/api/app/core/config.py` | Default Redis/MinIO credentials | Unsafe if reused outside local compose. | Mark local defaults dev-only; require env in staging/prod if feature enabled. |
| `infra/docker-compose.yml` | `postgres:postgres`, `JWT_SECRET: change-me`, MinIO defaults | Unsafe beyond local staging sandbox. | Use env-file or platform secrets; never public staging with defaults. |
| `README.md` and scratch scripts | `D:\web app\4-craft.com` absolute paths | Migration to Linux/cloud is harder; scripts are machine-specific. | Convert docs/scripts to relative paths or mark local-only. |

## Database / Migration Readiness

| Check | Status | Evidence | Fix Needed |
|---|---|---|---|
| PostgreSQL supported | Pass | `DATABASE_URL` is env-based; SQLAlchemy model uses JSONB/ARRAY variants; Docker compose includes Postgres 16. | Run full staging test on managed Postgres. |
| SQLite dev separation | Partial | Default `database_url` is SQLite; compose uses Postgres. | Enforce Postgres for staging/prod via startup config validation. |
| Alembic configured | Partial | `alembic/env.py` reads `get_settings().database_url`. | Commit real migration revisions; `alembic/versions` currently has only `.gitkeep`. |
| Startup migrations | Fail for production | App creates/patches schema at startup via `Base.metadata.create_all()` and `ensure_local_schema()`. | Use `alembic upgrade head` before app start; remove schema mutation from prod startup. |
| Seed strategy | Partial | `README.md` documents `python -m app.seeds.seed`; dev owner is ensured only in local/dev/test. | Document staging seed/demo account strategy and production no-demo policy. |
| Subscription/plan fields | Pass basic | `ChildProfile` has Stripe customer/subscription/status, plan, price, program, paid/canceled dates. | Add invoice/payment tables for durable billing history. |
| Founder quota tracking | Partial | Founder count is derived from `ChildProfile` status/plan fields. | Add reservation table/unique constraints/transactional lock. |
| Quota-sensitive locks | Missing | No `SELECT ... FOR UPDATE`, advisory locks, or unique reservation found around founder limit or XP rewards. | Add transaction boundaries and idempotency constraints. |

## Storage Readiness

| Check | Status | Evidence | Fix Needed |
|---|---|---|---|
| Object storage config present | Partial | `config.py` has MinIO endpoint/access/secret; compose includes MinIO. | Add actual storage service abstraction and production S3/R2-compatible env names. |
| Local storage ignored | Pass | `.gitignore` excludes `storage/`, `apps/api/storage/`, and local files. | None. |
| Upload persistence | Partial | `ChildProfile` has `student_photo_url` and `student_photo_path`; no production object storage usage found. | Store uploads in S3/R2/MinIO, not local disk. |
| Admin content storage | Fail for horizontal | Lesson admin writes JSON and backup files to local filesystem. | Move content edits to DB/object storage with version/version lock. |

## Stripe / Subscription Scale Risks

| Check | Status | Evidence | Fix Needed |
|---|---|---|---|
| Stripe config env-based | Pass basic | Settings include Stripe secret, webhook secret, price IDs, portal return URL. | Complete `.env.example` with all deployment envs. |
| Test/live separation | Partial | Staging plan warns test mode only; code does not block live key by environment. | Add environment guard preventing `sk_live` outside production and requiring explicit production approval. |
| Webhook signature verification | Pass | `stripe.Webhook.construct_event(...)` uses `stripe_webhook_secret`. | None for signature verification. |
| Webhook idempotency | Fail | No persisted Stripe event table/unique event ID check. | Store processed events and make handlers idempotent. |
| Duplicate entitlement handling | Partial | Updates overwrite child subscription fields; repeat events mostly converge but side effects are not formally idempotent. | Add event idempotency and status transition tests. |
| Founder limit race condition | Fail | Founder slots are count-based before checkout and entitlement. | Lock/reserve founder slots transactionally. |
| Billing audit/history | Partial | Admin audit log exists; no invoice/payment event ledger found. | Add payment/subscription event ledger for reconciliation. |

## Admin / Content Editing Scale Risks

| Check | Status | Evidence | Fix Needed |
|---|---|---|---|
| Admin routes protected | Pass basic | Admin router uses `require_admin`, allowing `admin`/`owner`. | Review all admin frontend routes for server-side enforcement; middleware currently only passes through. |
| Content editor writes DB lessons | Partial | Some admin lesson/question updates write DB rows. | Add optimistic locking/version columns for concurrent edits. |
| Content editor writes JSON files | Fail for horizontal | `save_lesson()` and `update_question_payload()` write local JSON/JSONL files. | Move editable content into DB or central object storage with locking. |
| Local backups | Fail for horizontal | `save_lesson()` creates backups under `CONTENT_ROOT/backups`. | Use central version history or object storage revisions. |
| Write conflict handling | Missing | No version/ETag/checksum conflict check found for admin content updates. | Add version numbers and conflict responses. |

## Security Readiness

| Check | Status | Evidence | Fix Needed |
|---|---|---|---|
| No secrets committed | Pass with caveat | Tracked secret scan only found documentation warnings; env/db/log/cache files ignored. | Keep pre-push secret scan mandatory; rotate any local keys ever exposed in scratch files. |
| `.env` ignored | Pass | `.gitignore` excludes `.env` and `.env.*`, with `.env.example` allowed. | None. |
| CORS production-safe | Fail | CORS hardcoded localhost; no env-driven production allowlist. | Add `CORS_ORIGINS`; fail production if wildcard. |
| Admin API protected | Pass basic | `require_admin` checks role in backend. | Add rate limiting, audit all admin mutations, and server-side frontend access checks if needed. |
| JWT secret production safety | Fail-safe missing | Default `jwt_secret` is `change-me-in-production`. | Production/staging startup must reject default or short secrets. |
| Stripe webhook signature | Pass | Signature verification is implemented. | Add idempotency. |
| Debug/docs exposure | Partial | FastAPI `/docs` enabled by default; no environment-specific debug/docs gating found. | Consider disabling docs or protecting them in production. |
| Rate limiting/abuse controls | Missing | No rate limiter found for auth, checkout, quiz submit, admin routes. | Add per-IP/user rate limits. |
| Production debug disabled | Unknown/Partial | No explicit debug flag found; FastAPI defaults are not debug, but docs remain open. | Add explicit environment config for docs/debug behavior. |

## Required Fixes Before Staging

1. Make backend CORS allow the staging frontend origin without using wildcard.
2. Set `NEXT_PUBLIC_API_BASE_URL` to the staging backend URL and do not rely on localhost rewrites.
3. Use staging-only `DATABASE_URL`, `JWT_SECRET`, and Stripe test keys in platform secrets.
4. Run staging on isolated PostgreSQL, not the local SQLite DB.
5. Confirm `.env`, local DB files, build output, dependency folders, logs, and local storage are not deployed.

## Required Fixes Before Public Production

1. Add production config validation: require PostgreSQL, strong JWT secret, explicit CORS origins, and no local defaults.
2. Commit real Alembic migrations and use `alembic upgrade head` as the only production schema path.
3. Add Stripe webhook idempotency with a durable event ledger.
4. Add founder quota reservation/locking to prevent overselling.
5. Add idempotency/unique constraints for quiz answers, quest completion, XP awards, and progress updates.
6. Add production observability: structured logs, error tracking, uptime checks, metrics, and alerts.
7. Add auth/checkout/admin rate limiting.
8. Decide whether FastAPI docs remain public; disable or protect `/docs` and `/openapi.json` if required.
9. Complete production legal/privacy/refund/child-data handling review.

## Required Fixes Before Horizontal Scaling

1. Remove all mutable local filesystem dependencies from runtime content/admin workflows, or make content immutable per deploy.
2. Move uploads/generated assets to S3/R2/MinIO through a storage abstraction.
3. Add DB-level idempotency and row/advisory locks for billing, quotas, XP, quests, and progress.
4. Add webhook event table with unique event IDs and replay-safe handlers.
5. Add optimistic locking/version checks for admin content edits.
6. Add Redis/queue-backed worker architecture for AI generation, long-running jobs, and background processing.
7. Ensure all API instances use identical config/secrets and shared central services.
8. Add deployment artifact/version tracking for lesson JSON if file-based content remains.

## Recommended Architecture

### Staging

Use Vercel for `apps/web`, Railway/Render for `apps/api`, and a managed staging PostgreSQL database. Keep Stripe in test mode. Configure `NEXT_PUBLIC_API_BASE_URL` to the staging API and configure backend CORS for the Vercel staging origin. Run Alembic manually if migrations are added; until then, treat schema creation as staging-only and isolated.

### Early Production

Use Vercel or a containerized Next.js frontend, one FastAPI backend service scaled vertically, managed PostgreSQL, platform-managed secrets, Stripe live keys only after a full checkout/webhook entitlement rehearsal, and object storage for uploads. Keep admin content editing either disabled in public production or restricted to one writer until content storage/versioning is redesigned.

### Future Scale

Run multiple stateless FastAPI instances behind a load balancer with shared PostgreSQL, Redis for queues/rate limits/cache, S3/R2-compatible object storage, webhook idempotency tables, transactional quota/reward locks, and DB/object-storage backed content versioning. Treat lesson/content JSON as immutable build artifacts or move it into a versioned content service.
