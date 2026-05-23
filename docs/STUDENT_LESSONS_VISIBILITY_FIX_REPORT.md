# Student Lessons Visibility Fix Report

## Final Decision

READY_STUDENT_LESSONS_FIXED

## Root Cause

The public student `/lessons` page was still using an older client flow while `/dashboard` had already moved to the canonical lesson path.

The failure had three parts:

1. `apps/web/src/app/lessons/page.tsx` called `meApi.getLessons()` before waiting for the same `checkAuth()` completion pattern used by `/dashboard`. On a real authenticated load this could race the local auth store and surface the generic Thai error message: `ไม่สามารถโหลดบทเรียนได้`.
2. The `/lessons` page expected an old flattened lesson-card shape and did not request `program_type`, so the TH/EP selector disappeared and the page could not intentionally request canonical TH or canonical EP content.
3. `GET /me/lessons` accepted `program_type` but did not use it in the canonical JSON visibility filter. A TH child requesting EP would still compare EP rows against the child TH track and filter them as a language mismatch. Also, when no grade was requested, the `lessons` field returned only current-grade rows instead of the canonical all-grade list needed by the P1-P6 tab view.

## Endpoint Used Before Fix

Before the fix, `/lessons` called:

```text
GET /me/lessons
```

with no `program_type` parameter and no grade parameter. The frontend then flattened whichever legacy fields it found and rendered minimal lesson cards.

After the fix, `/lessons` calls:

```text
GET /me/lessons?program_type=TH
GET /me/lessons?program_type=EP
```

through the shared `meApi.getLessons(undefined, programType)` wrapper.

## Response Shape Fix

The frontend now reads canonical `Lesson` fields from `/me/lessons`:

- `lesson_id`
- `program_type`
- `grade_level`
- `title_th`
- `title_en`
- `estimated_minutes`
- `test_available` / `has_approved_test` / `has_test`

It no longer treats empty old current/review sections as a page failure when canonical `lessons` are present.

## Files Changed

- `apps/api/app/routers/me.py`
  - Added `program_type_override` to the canonical student lesson section builder.
  - Made `/me/lessons?program_type=TH|EP` use the requested canonical program.
  - Kept dashboard default behavior unchanged.
  - Returned canonical all-grade rows in the `lessons` field for the grade-tab page.

- `apps/web/src/lib/api/me.ts`
  - Added `LessonProgram`.
  - Allowed `program_type` on `meApi.getLessons`.
  - Updated `Lesson.program_type` to include canonical `TH`.

- `apps/web/src/app/lessons/page.tsx`
  - Rebuilt the student lessons list around canonical `/me/lessons`.
  - Waits for auth before fetching lessons.
  - Restored TH/EP selector.
  - Added P1-P6 grade tabs.
  - Shows lesson title, base lesson ID, grade, duration, test availability, `เรียนต่อ`, and `ทำเทสจากบทนี้`.
  - Prevents `_ep` IDs from appearing in TH mode.

- `apps/web/src/app/dashboard/lessons/[lessonId]/page.tsx`
  - Reads `?program_type=TH|EP` from `/lessons` card navigation.
  - Loads the matching canonical lesson detail instead of defaulting every direct card open to TH.

## Validation Results

Commands run:

```text
python -m py_compile apps\api\app\routers\me.py apps\api\app\services\lesson_content.py apps\api\app\routers\admin.py
npm run lint
npm run build
```

Results:

- Python compile passed.
- TypeScript check passed.
- Next production build passed.
- Local production server started at `http://localhost:3010`.
- `http://localhost:3010/lessons` returned HTTP 200.

Canonical visibility invariant:

- TH canonical lessons: 43.
- TH student-visible `/me/lessons` section rows: 43.
- TH `_ep` suffix count: 0.
- TH by grade: P1 7, P2 7, P3 8, P4 7, P5 7, P6 7.
- TH canonical test banks: 43.

- EP canonical lessons/test banks: 44.
- EP student-visible rows: 42.
- EP by grade: P1 5, P2 7, P3 9, P4 7, P5 7, P6 7.
- EP `_ep` suffix count in visible rows: 42.
- The two hidden EP canonical rows are `g1_add_within_20_ep` and `g1_subtract_within_20_ep`, both filtered because their lesson payload status is `needs_review`. They remain admin-review content and are not exposed to students.

## Route Behavior

- `/admin/lessons`: unchanged; continues to use canonical lesson management.
- `/admin/tests`: unchanged; continues to use canonical test-bank management from the prior fix.
- `/dashboard`: unchanged by default; dashboard continues to use child-program canonical sections.
- `/lessons`: now uses the same canonical `/me/lessons` source and requests explicit TH/EP content.
- Lesson detail: direct opens from `/lessons` now preserve TH/EP via `program_type`.
- Test start: lesson cards call `startLessonTest(lesson_id, program_type)` so test start remains program-specific.

## Public Runtime Note

The local code was built and served successfully. The live `https://topamath.com/lessons` result still depends on rebuilding/redeploying the Docker/public frontend with these changes. I did not claim live production verification after deploy because that deploy step was not available in this workspace run.
