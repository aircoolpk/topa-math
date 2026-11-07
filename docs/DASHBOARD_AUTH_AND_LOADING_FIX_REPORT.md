# Dashboard Auth and Loading Fix Report

Date: 2026-06-17

## Summary

แก้ flow โหลด `/dashboard` ให้รอ auth/session token พร้อมก่อนเรียก protected API, เพิ่ม timeout/retry state, ใช้ `AbortController` กัน request เก่าหรือ request ซ้ำ และทำให้ Affiliate API เป็น optional ไม่สามารถ block dashboard หลักหรือ trigger redirect เองได้

## Changes

- เพิ่ม default API timeout ที่ `apiClient` เป็น 15 วินาที
- เพิ่ม `skipAuthRedirect` สำหรับ optional requests เช่น dashboard affiliate summary
- 401 จาก protected API จะล้าง token และ redirect ไป `/login?next=...`
- `/dashboard` โหลดผ่าน guarded loader:
  - เรียก `checkAuth()` ก่อน `/me/dashboard`
  - redirect ถ้าไม่มี token หรือเจอ 401
  - ใช้ `AbortController` abort dashboard request เก่าก่อนยิงใหม่
  - กัน stale response ด้วย request sequence
  - แสดง error + ปุ่ม `โหลดใหม่`
  - แสดงข้อความ retry hint เมื่อ request timeout
- Affiliate summary โหลดหลัง dashboard หลักพร้อม และ failure ถูก catch แยก ไม่ block dashboard
- Program switch ยังใช้ dashboard data เดิม แต่เพิ่ม abort signal เพื่อกัน request เก่าค้าง
- Backend logging:
  - auth dependency log `missing_token`, `invalid_token`, `user_not_found`, `disabled_user`
  - `/me/dashboard` log duration, user, child, program และจำนวน payload สำคัญ
  - dashboard response ที่ช้ากว่า 2 วินาที log เป็น warning

## Files Changed

- `apps/web/src/lib/api-client.ts`
- `apps/web/src/lib/api/me.ts`
- `apps/web/src/app/dashboard/page.tsx`
- `apps/api/app/routers/deps.py`
- `apps/api/app/routers/me.py`

## Validation

Validated by code path and build checks:

- Fresh login: dashboard now waits for `checkAuth()` and token before protected dashboard request
- Hard refresh/direct `/dashboard`: guarded loader checks stored token first, then loads dashboard
- Expired token: 401 clears token and redirects to `/login?next=/dashboard`
- Slow API: axios timeout plus visible retry state and `โหลดใหม่` button
- Affiliate API failure: request uses `skipAuthRedirect`, catches errors, and does not affect main dashboard
- Infinite loading: loader always clears loading for the latest non-aborted request
- Duplicate/stale dashboard requests: prior request is aborted before a new load
- Unauthorized `/children` after valid login: no dashboard code path calls `/children`; protected dashboard calls now wait for auth first

## Commands Run

- `python -m py_compile apps/api/app/routers/deps.py apps/api/app/routers/me.py`
- `python -m py_compile` for `apps/api/app` excluding `app/content`
- `npm run build`
- `npm run lint` after build generated `.next/types`
- `docker compose -f docker-compose.beta.yml build 4craft-api 4craft-web`

## Results

- `py_compile` changed backend files: passed
- `py_compile` app excluding `app/content`: passed
- `npm run build`: passed
- `npm run lint`: passed after `.next/types` existed
- Docker API/Web rebuild: passed

## Known Environment Notes

- `npm run lint` before `next build` can fail because this repo includes `.next/types/**/*.ts` in `tsconfig`; running `npm run build` first regenerates those files and lint passes.
- Browser/runtime validation against Docker API was not completed because the existing Docker PostgreSQL volume/config still has a credential mismatch from the current environment, causing API health to fail with `password authentication failed for user "postgres"`.
- Full `py_compile` including `apps/api/app/content` is still blocked by existing content generator syntax in `apps/api/app/content/math/question_banks/_generate_remaining.py`, unrelated to this dashboard auth fix.

## Decision

READY_DASHBOARD_AUTH_LOADING_FIX

## Runtime Revalidation: 2026-10-15

The June PostgreSQL credential mismatch is not currently reproducible. The
original PostgreSQL volume is mounted and authenticated TCP/API-container
connectivity succeeds. Credentials already align; no password rotation, volume
reset or replacement database was needed. Users/child counts remain 109/87.

Actual QA-account HTTP and browser tests, without mocked API responses, now
confirm public login, direct dashboard, hard refresh, TH/EP dashboard requests
and Affiliate Summary. Protected requests returned 200, loading completed,
pending fetch count was zero, and no unauthorized /children request followed
valid browser login. A genuinely signed expired token returned 401 and the
browser redirected to login. Public page/console error counts were zero.

The active API is production and was not redeployed. localhost:3002 is a separate
preview targeting api-beta.topamath.com; its login remains blocked by actual
preflight CORS rejection. That preview failure is not PostgreSQL authentication
failure. Only the agent-owned preview process was restarted to fix stale assets.

Detailed evidence, deployment-versus-workspace payment audit and blockers:
`docs/POSTGRES_RUNTIME_AND_PAYMENT_AUDIT_REPORT.md`.

This evidence does not certify MPP staging UAT or production gateway readiness.
