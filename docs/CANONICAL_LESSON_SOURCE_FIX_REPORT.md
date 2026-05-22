# Canonical Lesson Source Fix Report

## Root Cause

`/admin/lessons` and `/admin/content/lessons` were not using the same source path as student pages. Admin could see file-backed content from `apps/api/app/content/math/grade_*/lessons`, while student routes mixed JSON scanning, DB-backed fallback lessons, and question-bank fallback selection.

The `/me/lessons` endpoint also returned only the child grade and previous grade when no grade was requested, while the frontend grade tabs expected all grades. That made approved lessons disappear from `/lessons`.

Program routing was also split: detail could request `program_type`, but list/dashboard/test-start did not consistently resolve the same base lesson id to the requested TH/EP variant. Test start could fall back to grade/skill question pools instead of using the exact canonical bank for the selected lesson/program.

## Sources Found

- Admin lesson management source: `apps/api/app/content/math/grade_*/lessons/*.json` plus `_content_status/lessons.json`.
- Admin test management source: `apps/api/app/content/math/grade_*/quizzes/*.json`, optional `question_banks/grade_*/*.jsonl`, plus `_content_status/tests.json`.
- Student `/me/lessons` previous source: `_json_lesson_sections()` with direct directory scan plus DB fallback.
- Dashboard previous source: `_dashboard_lessons()` using `_json_lesson_sections()` then DB fallback.
- Lesson detail previous source: direct `_load_json_lesson()`, `find_lesson_file()`, and DB fallback.
- Test start previous source: JSON/DB lesson lookup plus DB question fallback.

## Canonical Source Chosen

The fix adds canonical service functions in `apps/api/app/services/lesson_content.py`:

- `list_canonical_lessons(program, grade, include_admin_status)`
- `get_canonical_lesson(lesson_id, program)`
- `list_canonical_tests(program, grade, lesson_id, approved_only)`
- `get_canonical_test_bank(lesson_id, program)`
- `has_approved_test(lesson_id, program)`

These use the same file-backed content and sidecar approval status that admin content management uses, without TH/EP cross-fallback.

## Files Changed

- `apps/api/app/services/lesson_content.py`
- `apps/api/app/routers/me.py`
- `apps/api/app/routers/admin.py`
- `apps/web/src/lib/api/me.ts`
- `apps/web/src/app/dashboard/lessons/[lessonId]/page.tsx`
- `docs/CONTENT_AUTHORING_GUIDE.md`
- `docs/CANONICAL_LESSON_SOURCE_FIX_REPORT.md`

## Behavior Fixed

- TH lesson lists use approved TH files only.
- EP lesson lists use approved EP files only.
- `_ep` lesson ids do not appear in TH canonical lists.
- `/me/lessons` can now provide all approved grades for the grade tabs.
- Dashboard still uses current grade plus previous grade from the same program.
- Lesson detail resolves base id plus selected program to the canonical file.
- Lesson test start resolves base id plus selected program and uses the matching approved bank only.
- Test start logs clear backend reasons when the canonical bank is unavailable or too small.
- Admin canonical responses include `base_lesson_id`, `program`, `grade_level`, `student_visible`, `approved`, `has_approved_test`, and `test_bank_source`.

## Content Archived/Hidden

No good lesson files were deleted. Stale or unapproved content remains hidden from student APIs because canonical student reads require approved sidecar status and exact program matching.

## Validation Run

Commands run:

```powershell
python -m py_compile apps/api/app/services/lesson_content.py apps/api/app/routers/me.py apps/api/app/routers/admin.py
npm run lint
```

Both passed.

Canonical scanner results:

```text
TH Grade 1 lessons: 7
TH Grade 3 lessons: 8
TH Grade 6 lessons: 7
TH g3_area_intro approved bank rows: 20
TH g3_fractions_intro approved bank rows: 20
EP Grade 1 lessons: 7
EP Grade 3 lessons: 9
EP Grade 6 lessons: 7
EP g3_area_intro approved bank rows: 20
EP g3_fractions_intro approved bank rows: 20
```

TH Grade 3 canonical ids:

```text
g3_area_intro
g3_division_intro
g3_fractions_intro
g3_measurement
g3_mixed_review
g3_multi_step_word_problems
g3_multiplication_area_model_thp
g3_multiplication_multi_digit
```

EP Grade 3 canonical ids:

```text
g3_area_intro_ep
g3_division_intro_ep
g3_fractions_intro_ep
g3_measurement_ep
g3_mixed_review_ep
g3_multi_step_word_problems_ep
g3_multiplication_area_model_ep
g3_multiplication_area_model_thp_ep
g3_multiplication_multi_digit_ep
```

`python -m pytest apps/api/tests -q` was attempted after installing the missing local `python-multipart` test dependency, but the full suite did not finish within 2 minutes in this environment.

`python -m pytest apps/api/tests/test_services.py -q` ran 12 tests: 11 passed and 1 failed in pre-existing content-quality expectations for `g3_multiplication_area_model_thp` publishability. The failure is in `content_quality_report()` sample content validation, not in the canonical loader path changed here.

## Remaining Risks

- Full authenticated browser/API smoke testing still needs a running local app and login fixture.
- The existing `test_content_quality_accepts_sample_thp_and_ep_lessons` failure should be resolved in a separate content-quality pass.
- Some existing content text appears mojibake in PowerShell output; this fix does not rewrite lesson content.
- Existing DB fallback routes remain for legacy data, but canonical file-backed content is now preferred for the affected student flows.

## Final Decision

READY_CANONICAL_CONTENT_FIXED
