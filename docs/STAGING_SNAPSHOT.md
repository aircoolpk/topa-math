# 4-Craft Git-Ready Staging Snapshot

Date: 2026-05-13  
Project: `D:\web app\4-craft.com`  
Purpose: safe local Git version tracking before staging deployment. No push performed.

## Snapshot Reference

| Item | Reference |
|---|---|
| Local backup | `D:\web app\backups\4-craft.com-backup-20260513-034954` |
| Staging source copy | `D:\web app\staging\4-craft.com-staging-20260513-035313` |
| Local Git ref to create | `refs/tags/staging-snapshot-20260513-091147` |
| Push status | Not pushed anywhere |

Note: Git commit hashes are content-addressed and cannot be embedded inside the same commit without changing that commit. The exact commit hash for this snapshot is recorded after commit creation in the operator handoff/final response. The local tag above is the intended immutable reference for this deployment snapshot.

## Current Status

| Area | Status |
|---|---|
| Frontend runtime | Passes local validation |
| Login | Works with staging/demo credentials in local validation |
| Dashboard | Works in local validation |
| Lesson pages | Reported working for staging preparation |
| Mini quiz frontend fix | Approved in `MINI_QUIZ_FRONTEND_REVIEW_REPORT.md` |
| Replacement character cleanup | Approved in `REPLACEMENT_CHARACTER_REVIEW_REPORT_ROUND_2.md` |
| JSON validation | Reported passing for active content |
| Staging deployment | Plan prepared; deployment not started |

## Test Reports Included

| Report | Purpose |
|---|---|
| `docs\SYSTEM_TEST_REPORT.md` | Full system regression evidence and known issues |
| `docs\MINI_QUIZ_FRONTEND_REVIEW_REPORT.md` | Browser validation for mini_quiz frontend behavior |
| `docs\REPLACEMENT_CHARACTER_REVIEW_REPORT_ROUND_2.md` | Replacement character cleanup review |
| `docs\STAGING_DEPLOYMENT_PLAN.md` | Staging architecture, env vars, deploy steps, rollback, and safety rules |

## Known Blockers / Gates

### Before Staging Traffic

1. Set `NEXT_PUBLIC_API_BASE_URL` to the staging backend URL.
2. Add staging frontend origin to backend CORS.
3. Use staging-only database credentials and a staging-only `JWT_SECRET`.
4. Keep Stripe in test mode only.
5. Do not upload local `.env`, `.env.local`, `.db`, logs, caches, build output, or dependency folders.

### Before Public Launch

1. Do not enable Stripe live mode until checkout, webhook, entitlement, cancellation, and rollback flows are fully tested.
2. Add production observability: uptime checks, error monitoring, structured logs, and alerts.
3. Finalize legal/privacy/refund pages and child-data handling review.
4. Rehearse production database backup/restore.
5. Replace hardcoded localhost CORS/API assumptions with env-driven config.

## Secret / Ignore Status

`.gitignore` excludes:

```text
.env
.env.*
node_modules/
.next/
.venv/
__pycache__/
*.db
storage/
*.log
*.tsbuildinfo
.tools/
.hermes/
```

Additional local scratch file excluded because it contains a machine-specific API key:

```text
apps/api/app/content/math/question_banks/moltbook_check.py
```

Secret scan of Git candidate files found no live production secret. Remaining scanner hits are placeholders, test-only values, local Docker defaults, or source code references to config fields.

## Deployment Safety

This snapshot is for staging only:

```text
Do not push production secrets.
Do not connect staging to production database.
Do not use Stripe live keys.
Do not open public paid launch from this snapshot.
Stop before pushing unless a human reviews the staged file list.
```
