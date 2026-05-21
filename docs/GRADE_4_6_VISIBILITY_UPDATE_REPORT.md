# Grade 4-6 Visibility Update Report

Date: 2026-05-15

## Summary

Updated the frontend lesson visibility behavior so Grades 4, 5, and 6 are visible to users as disabled preparation/QA states, without exposing incomplete lesson pages.

No lesson content, backend logic, quiz/test scoring logic, or Stripe logic was changed.

## Files Changed

- `apps/web/src/lib/api/me.ts`
- `apps/web/src/app/lessons/page.tsx`
- `apps/web/src/app/dashboard/page.tsx`
- `apps/web/src/app/dashboard/lessons/[lessonId]/page.tsx`

## Grade 4-6 Visibility Behavior

The `/lessons` page now renders explicit sections for:

- ป.1
- ป.2
- ป.3
- ป.4
- ป.5
- ป.6

Grades 4-6 appear as disabled cards with:

- `ป.4 กำลังเตรียมบทเรียน`
- `ป.5 กำลังเตรียมบทเรียน`
- `ป.6 กำลังเตรียมบทเรียน`

Badges shown:

- `Coming Soon`
- `กำลังตรวจบทเรียน`

The dashboard grade tab panel also uses the same Thai preparation state for Grade 4-6.

## Clickable vs Disabled Behavior

- Grade 1-3 beta-ready lessons remain clickable.
- Grade 4-6 cards are visible but disabled.
- Grade 4-6 cards do not link to lesson detail pages.
- The old empty-content message `บทเรียนนี้ยังไม่มีเนื้อหาแสดง` was replaced with a QA/preparation message.

## Direct URL Gating Confirmation

Local API checks using `demo@4-craft.com / demo1234`:

- `/me/lessons` visible grades: `1,2,3`
- Grade 4+ visible lesson count from API: `0`
- `/me/lessons/g4_fraction_equivalence`: `404`
- `/me/lessons/g5_decimal_place_value`: `404`
- `/me/lessons/g6_ratio_intro`: `404`

This confirms direct navigation remains gated at the API level.

## Routes Tested

Frontend route checks on `http://localhost:3000`:

- `/`: `200`
- `/dashboard`: `200`
- `/lessons`: `200`
- `/dashboard/lessons/g4_fraction_equivalence`: app shell returned `200`; client-side API remains gated with `404`

Validation:

- `npm run lint`: passed
- `npm run build`: passed

Build note: the existing Next/ESLint warning still appears:

`ESLint: Invalid Options: - Unknown options: useEslintrc, extensions - 'extensions' has been removed.`

## Safety Confirmation

- Quiz/test scoring logic was not changed.
- Lesson content was not changed.
- Backend code was not changed.
- Stripe code was not changed.
- Empty or incomplete Grade 4-6 lesson pages remain gated/not found through the API.
