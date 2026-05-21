# Admin Dashboard Report

Date: 2026-05-16

## Final Decision

READY_FOR_ADMIN_BETA

## Files Changed

Backend:

- `apps/api/app/models/entities.py`
- `apps/api/app/core/schema_maintenance.py`
- `apps/api/app/routers/auth.py`
- `apps/api/app/routers/deps.py`
- `apps/api/app/routers/admin.py`
- `apps/api/app/scripts/promote_admin.py`

Frontend:

- `apps/web/src/lib/api/admin.ts`
- `apps/web/src/app/admin/layout.tsx`
- `apps/web/src/app/admin/page.tsx`
- `apps/web/src/app/admin/dashboard/page.tsx`
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/users/[id]/page.tsx`
- `apps/web/src/app/admin/children/page.tsx`
- `apps/web/src/app/admin/tests/page.tsx`
- `apps/web/src/app/admin/lessons/page.tsx`
- `apps/web/src/app/admin/system/page.tsx`

Docs:

- `docs/ADMIN_DASHBOARD_REPORT.md`

## Data Model / Migration

The existing `users` model already had:

- `id`
- `email`
- `password_hash`
- `role`
- `created_at`
- `updated_at`

Added safe user-level admin fields:

- `plan`
- `plan_expires_at`
- `is_active`
- `last_login_at`

`ensure_local_schema()` now also checks the `users` table and adds missing columns for SQLite and PostgreSQL on startup. This preserves existing demo login and existing users.

Existing child-level plan/subscription fields were preserved for compatibility with current billing and dashboard behavior.

## Backend Endpoints Added / Updated

All `/admin/*` endpoints use the existing `require_admin` dependency. Non-admin users receive `403`; unauthenticated users receive `401`.

Added or updated:

- `GET /admin/summary`
- `GET /admin/users`
- `GET /admin/users/{user_id}`
- `PATCH /admin/users/{user_id}/plan`
- `PATCH /admin/users/{user_id}/role`
- `PATCH /admin/users/{user_id}/active`
- `GET /admin/children`
- `GET /admin/tests`
- `GET /admin/lessons/status`
- `GET /admin/system/health`

Existing admin content, revenue, subscription, and QA endpoints remain in place.

## Frontend Admin Pages

Created browser pages:

- `/admin`: overview cards, lesson coverage, content warnings
- `/admin/users`: searchable/filterable user table
- `/admin/users/[id]`: user detail, children, recent tests, plan editor, role editor, active toggle
- `/admin/children`: child profile table with grade filter
- `/admin/tests`: recent test sessions with grade/lesson/user filters
- `/admin/lessons`: TH/EP/test/visual readiness table
- `/admin/system`: API/database/Redis/content status

The frontend route guard still redirects unauthenticated users to `/login`, but backend role enforcement is the real security boundary.

## Admin Promotion

One-time Docker command:

```powershell
docker compose -f docker-compose.beta.yml exec 4craft-api python -m app.scripts.promote_admin infomilliongarden@gmail.com
```

Local command:

```powershell
cd C:\web-app\4-craft.com\apps\api
python -m app.scripts.promote_admin infomilliongarden@gmail.com
```

This command promotes the existing account to `role = admin` and sets `is_active = true`. It is not hardcoded into application startup logic.

## Access

1. Promote `infomilliongarden@gmail.com` with the one-time command.
2. Restart the API container so schema maintenance adds any missing user columns.
3. Log in normally.
4. Open `/admin`.

## Validation Results

Passed:

- `python -m py_compile` for changed backend files.
- In-memory FastAPI admin security smoke test:
  - unauthenticated `GET /admin/users` returned `401`
  - normal user `GET /admin/users` returned `403`
  - admin `GET /admin/users` returned `200`
  - admin `GET /admin/summary` returned `200`
  - admin `GET /admin/system/health` returned `200`
  - admin `PATCH /admin/users/{id}/plan` returned `200`
  - admin `PATCH /admin/users/{id}/active` returned `200`
  - `password_hash` was not present in checked admin responses
  - secret names such as `JWT_SECRET`, `STRIPE_SECRET`, and `DATABASE_URL` were not present in checked admin responses
- `npm run build` for `apps/web` passed.
- `docker compose -f docker-compose.beta.yml build 4craft-web 4craft-api` passed.
- `docker compose -f docker-compose.beta.yml build 4craft-api` passed after the final backend patch.
- `docker compose -f docker-compose.beta.yml config` passed.
- Local `GET http://127.0.0.1:8001/health` returned `{"status":"ok"}`.
- `git diff --check` passed for changed admin files.

Known build warning:

- Next.js still reports the existing non-fatal ESLint option warning: `useEslintrc` / `extensions` are unknown options. The build exits successfully.

Not fully re-tested in browser:

- Student `/dashboard`, `/lessons`, and full test flow were not re-run after this admin dashboard work. Admin changes did not touch quiz/test scoring logic.

## Security Notes

- Backend role enforcement is server-side through `require_admin`.
- Non-admin users are blocked with `403`.
- Disabled users are blocked during authenticated API use.
- Password hashes are never returned by admin payload helpers.
- `/admin/system/health` returns only status, environment name, app version, and content count; it does not return environment variables or secrets.
- Stripe live mode was not enabled.
- Stripe logic was not modified.
- Quiz/test scoring logic was not modified.
- `npm audit fix --force` was not run.

## Remaining Risks

- API containers must be restarted for the new user columns to be added to the running PostgreSQL database.
- Existing admin pages under content/revenue/subscriptions remain from earlier work and may still have older copy/style, but server-side admin protection is shared.
- Browser validation as both a promoted admin and a normal user should be run after deploying the rebuilt Docker images.
