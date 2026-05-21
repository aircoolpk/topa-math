# Admin Lessons and Tests Routes Report

Date: 2026-05-16

## Summary

Added clean admin aliases for lesson and test management while keeping `/admin/content` as the Content QA overview dashboard.

## Files Changed

- `apps/web/src/app/admin/layout.tsx`
- `apps/web/src/app/admin/lessons/page.tsx`
- `apps/web/src/app/admin/lessons/[lessonId]/page.tsx`
- `apps/web/src/app/admin/tests/page.tsx`
- `apps/web/src/app/admin/tests/[testId]/page.tsx`
- `apps/web/src/app/admin/tests/by-lesson/[lessonId]/page.tsx`
- `apps/web/src/lib/api/admin-content.ts`
- `apps/api/app/routers/admin.py`
- `apps/api/app/services/lesson_content.py`

## Routes Added or Updated

- `/admin/lessons`
  - Loads real CMS lesson rows from `/admin/content/lessons`.
  - Groups by Grade 1-6, then TH/EP.
  - Supports filters for grade, language, status, and search.
  - Includes preview, edit, validate, approve, and reject actions.

- `/admin/lessons/[lessonId]`
  - Redirects to `/admin/content/lesson/[lessonId]`.
  - Preserves language query as `?language=...` when supplied.

- `/admin/tests`
  - Loads real CMS test/question rows from `/admin/content/tests`.
  - Groups by Grade 1-6, then TH/EP, then lesson/test set.
  - Supports filters for grade, language, status, and search.
  - Includes edit, validate, approve, and reject actions.

- `/admin/tests/[testId]`
  - Redirects to the existing question editor area.

- `/admin/tests/by-lesson/[lessonId]`
  - Redirects to `/admin/content/questions?lesson_id=[lessonId]`.

## Sidebar Navigation

Updated admin sidebar order:

- ภาพรวม
- ผู้ใช้
- นักเรียน
- บทเรียน
- แบบทดสอบ
- Content QA
- ระบบ
- สมาชิก

## Backend API Adjustments

- `/admin/content/lessons` now returns frontend-ready lesson fields including title, topic, test presence, approved test count, issue count, and language.
- `/admin/content/tests` now returns question text, choices, correct answer, explanation, difficulty, and skill tag for the admin UI.
- Added `POST /admin/content/tests/{question_id}/validate`.
- Kept all `/admin/*` endpoints behind server-side admin auth.

## Validation Results

- Python compile passed for changed backend modules.
- Frontend production build passed and generated routes for:
  - `/admin/content`
  - `/admin/lessons`
  - `/admin/lessons/[lessonId]`
  - `/admin/tests`
  - `/admin/tests/[testId]`
  - `/admin/tests/by-lesson/[lessonId]`
- Admin route import check confirmed the updated backend routes are registered.
- No Stripe files or Stripe behavior were changed.
- Student scoring logic was not changed.

## Remaining Limitations

- Preview currently uses existing student/admin editor routes. A dedicated unapproved admin preview mode can still be improved later.
- `/admin/tests/by-lesson/[lessonId]` redirects with a lesson filter query, but the underlying question editor should be reviewed in the next pass if a richer by-lesson editing screen is needed.
- Runtime browser checks against the running Docker stack were not performed in this pass because the stack was not restarted with the newly edited files.
