# Auth QA Fix Report

## Summary
- Date/time: 2026-05-10 22:03:28 +07:00
- Scope: Local QA login seed and login page credential display.
- Result: PASS for API login and browser login for both QA student and QA admin.
- Production auth: Not weakened. Login still uses the existing `/auth/login`, PBKDF2 password verification, and JWT creation path.

## Seeded Users
| Email | Password | Role | Child/Profile | Plan |
|---|---|---|---|---|
| `demo@4-craft.com` | `demo1234` | `student` | `QA Student`, grade 3, THP | `membership_status=plus`, `plan_type=thp`, `plan_code=th_plus_monthly` |
| `admin@4-craft.com` | `admin1234` | `admin` | `QA Admin`, grade 3, EP | `membership_status=plus`, `plan_type=ep`, `plan_code=ep_plus_monthly` |

## Files Changed
| File | Change |
|---|---|
| `apps/api/app/seeds/seed.py` | Added idempotent local QA user seeding for student/admin accounts. Existing `hash_password` is used. Seeding is guarded to local/dev/test or SQLite contexts. |
| `apps/web/src/app/login/page.tsx` | Updated the login page QA credential hint so it displays both working student and admin credentials. |

## Commands Run
| Command | Result |
|---|---|
| `rg --files apps/api/app \| rg 'seed\|auth\|security\|config\|database'` | Inspected seed/auth-related files. |
| `Get-Content apps/api/app/seeds/seed.py` | Confirmed previous seed only created `admin@4-craft.local` and owner account, not the displayed demo credentials. |
| `Get-Content apps/api/app/core/security.py` | Confirmed PBKDF2 hash and verify logic. |
| `python -m app.seeds.seed` from `apps/api` with venv Python | PASS, `Seed complete`. |
| `POST /auth/login` with `demo@4-craft.com / demo1234` | PASS, HTTP 200 with bearer token. |
| `POST /auth/login` with `admin@4-craft.com / admin1234` | PASS, HTTP 200 with bearer token. |
| `GET /auth/me` and `GET /me/dashboard` with demo token | PASS, HTTP 200; role `student`, dashboard returned `QA Student`. |
| `GET /auth/me` and `GET /admin/metrics` with admin token | PASS, HTTP 200; role `admin`, admin metrics returned. |
| `npm run lint` from `apps/web` | PASS, `tsc --noEmit` exit code 0. |

## Login Test Result
| Test | Result | Evidence |
|---|---|---|
| Student API login | PASS | `/auth/login` returned 200 for `demo@4-craft.com / demo1234`. |
| Admin API login | PASS | `/auth/login` returned 200 for `admin@4-craft.com / admin1234`. |
| Bad token still rejected | PASS | `GET /auth/me` with `Bearer bad` returned 401. |
| Login page credential display | PASS | Browser snapshot shows both QA student and QA admin credentials. |

## Dashboard/Admin Test Result
| Flow | Result | Evidence |
|---|---|---|
| Browser student login | PASS | `/login` submitted `demo@4-craft.com / demo1234`, redirected to `/dashboard`, rendered `QA Student` and `TH Plus`. |
| Browser admin login | PASS | `/login` submitted `admin@4-craft.com / admin1234`, redirected to `/admin/dashboard`, rendered Owner Dashboard/admin navigation. |
| Admin API authorization | PASS | Admin token reached `/admin/metrics` with HTTP 200. |

## Remaining Auth Issues
| Issue | Status | Notes |
|---|---|---|
| Existing `.next` dev chunk/runtime error | REMAINS | Browser console still reports pre-existing `Cannot find module './844.js'` from `.next/server/webpack-runtime.js`. It did not block verified login after retry, but it is still a frontend dev runtime issue from the system test report. |
| Role naming | WATCH | The QA student account uses role `student` as requested. Existing registration still creates `parent` users, and admin role tooling lists `parent/admin/owner/editor/viewer` but not `student`. Current dashboard/API accepted `student`; future admin user editing may need role option alignment if `student` becomes permanent. |
| Thai/mojibake | REMAINS | Not part of this auth fix; still documented in `SYSTEM_TEST_REPORT.md`. |
