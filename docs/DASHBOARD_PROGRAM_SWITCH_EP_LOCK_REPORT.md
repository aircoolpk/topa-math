# Dashboard Program Switch EP Lock Report

## 1. Files changed

- `apps/api/app/services/foundation.py`
- `apps/api/app/routers/me.py`
- `apps/web/src/lib/api/me.ts`
- `apps/web/src/app/dashboard/page.tsx`
- `apps/web/src/app/dashboard/lessons/[lessonId]/page.tsx`

## 2. EP entitlement rule used

EP access is derived from paid/admin entitlement:

- Admin users can access EP for QA/admin policy.
- Paid children can access EP when `billing_program_type` or `program_type` is `EP`/`BOTH`.
- Paid children can access EP when plan metadata contains an EP plan marker, including `plan_code`, `plan_type`, `active_price_code`, `price_type`, or `manual_grant_reason`.
- Free and TH-only paid users remain EP locked.

TH remains available by default.

## 3. Backend fields added

`GET /me/dashboard` and `GET /me/lessons` now include:

- `active_program`: `TH` or `EP`
- `can_access_ep`: boolean
- `available_programs`: `["TH"]` or `["TH", "EP"]`

`/me/dashboard`, `/me/lessons`, lesson detail, lesson start, and lesson test start all default missing `program_type` to `TH`.

EP requests without entitlement return `403` with:

```json
{
  "code": "EP_PACKAGE_LOCKED",
  "message": "แพ็กเกจ EP ยังไม่ได้เปิดใช้งาน"
}
```

## 4. Dashboard UI behavior

The dashboard hero card now shows a TH/EP segmented switch directly under the student profile image.

- TH is selected by default.
- TH is always clickable.
- EP shows a lock icon and disabled styling when locked.
- Clicking locked EP shows `แพ็กเกจ EP ยังไม่ได้เปิดใช้งาน`.
- Clicking unlocked EP refetches `/me/dashboard?program_type=EP`.
- Lesson cards, review cards, recommended lesson links, lesson detail links, and lesson test starts pass the active program.

## 5. TH-only validation

Validated with `demo@4-craft.com`:

- `/me/dashboard` default returned `active_program=TH`.
- `can_access_ep=false`.
- Current dashboard lessons contained `0` lesson ids ending `_ep`.
- `/me/dashboard?program_type=EP` returned `403`.
- `/me/lessons?program_type=TH` contained `0` lesson ids ending `_ep`.
- TH lesson detail for `g3_area_intro?program_type=TH` returned `program_type=TH`.
- TH lesson test start for `g3_area_intro` with `program_type=TH` created a test session.
- Direct EP detail access for `g3_area_intro_ep?program_type=EP` returned `403`.
- Browser QA on `/dashboard` showed the switch under the profile image, TH as the active default, no `_ep` lesson text in TH mode, and the locked EP click message.

## 6. EP-user validation

Validated with admin/EP QA user `admin@4-craft.com`:

- `/me/dashboard?program_type=TH` returned `active_program=TH`, `can_access_ep=true`, and `0` `_ep` current lessons.
- `/me/dashboard?program_type=EP` returned `active_program=EP`.
- EP dashboard current lessons contained EP content and no TH current lessons.
- EP lesson detail for `g3_area_intro_ep?program_type=EP` returned `program_type=EP`.
- EP lesson test start for `g3_area_intro_ep` with `program_type=EP` created a test session.

## 7. Lesson/test routing validation

- Dashboard lesson links include `?program_type=TH` or `?program_type=EP`.
- Dashboard test start calls `/me/lessons/{lesson_id}/test/start?program_type=TH|EP`.
- Lesson detail already reads the query param and now no longer shows a TH fallback banner for EP.
- Test sessions now carry `program_type` in metadata and question responses.
- Backend EP guards run before canonical EP lesson or test loading.

## 8. Remaining risks

- Next build still prints an existing ESLint configuration warning about removed ESLint options, but the build exits successfully.
- Docker beta compose must be run with `.env.docker`; running without it uses default Postgres credentials that do not match the existing local volume.
- Browser QA was run against the rebuilt local web container. The locked EP control remains clickable so it can show the lock message while keeping locked styling.

## 9. Final decision

READY_DASHBOARD_PROGRAM_SWITCH

## Validation commands

- `python -m py_compile apps\api\app\routers\me.py apps\api\app\services\foundation.py`
- `npm run lint`
- `npm run build`
- `docker compose -f docker-compose.beta.yml build 4craft-api 4craft-web`
- `docker compose --env-file .env.docker -f docker-compose.beta.yml build 4craft-web`
- `docker compose --env-file .env.docker -f docker-compose.beta.yml up -d 4craft-api 4craft-web`
- `docker compose --env-file .env.docker -f docker-compose.beta.yml ps 4craft-api 4craft-web 4craft-postgres`
- Browser QA: login as `demo@4-craft.com`, open `/dashboard`, click locked EP, verify lock message and no `_ep` lesson ids in TH mode.
