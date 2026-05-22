# Canonical Content Final Count Verify Report

## Final Counts

Canonical active lessons are file-backed lessons with approved sidecar status.

| Program | P1 | P2 | P3 | P4 | P5 | P6 | Total |
|---|---:|---:|---:|---:|---:|---:|---:|
| TH | 7 | 7 | 8 | 7 | 7 | 7 | 43 |
| EP | 7 | 7 | 9 | 7 | 7 | 7 | 44 |

Total active lessons: 87.

Canonical active test banks are approved question banks grouped by lesson id.

| Program | P1 | P2 | P3 | P4 | P5 | P6 | Total Banks | Active Questions |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| TH | 7 | 7 | 8 | 7 | 7 | 7 | 43 | 430 |
| EP | 7 | 7 | 9 | 7 | 7 | 7 | 44 | 440 |

Total canonical test banks: 87. Total active approved canonical questions: 870.

## Source Alignment

Verified in code:

- `/admin/lessons`: uses `list_canonical_lessons()` when Program TH/EP is selected.
- `/admin/tests`: fixed in this pass to use `list_canonical_tests()`; old session history moved to `/admin/test-sessions`.
- `/me/lessons`: uses `_dashboard_lessons()` -> `_json_lesson_sections()` -> `list_canonical_lessons()`.
- `/me/dashboard`: uses `_dashboard_lessons()` -> `_json_lesson_sections()` -> `list_canonical_lessons()`.
- `/me/lessons/{lesson_id}`: uses `get_canonical_lesson(lesson_id, program)`.
- `/me/lessons/{lesson_id}/test/start`: uses `get_canonical_lesson()`, `has_approved_test()`, and `get_canonical_test_bank()`.

I also fixed one canonical test-list issue found during verification: duplicate rows were produced when both `grade_*/quizzes/*.json` and legacy `question_banks/*.jsonl` contained the same approved question ids. The canonical test loader now dedupes by question id, so each active bank has 10 canonical questions.

## TH Verification

Canonical TH checks passed:

- `/me/lessons` source returns TH only for TH child program.
- No canonical TH lesson id ends with `_ep`.
- `g3_area_intro` resolves to `g3_area_intro`.
- `g3_area_intro` test bank resolves to `grade_3/quizzes/g3_area_intro.json`.
- TH bank rows do not include `_ep` lesson ids.

## EP Verification

Canonical EP checks passed:

- `/me/lessons` source returns EP only for EP child program.
- EP lesson ids resolve to `_ep` variants.
- `g3_area_intro` with EP resolves to `g3_area_intro_ep`.
- EP test bank resolves to `grade_3/quizzes/g3_area_intro_ep.json`.
- EP bank rows are `_ep` lesson ids.

## Public Frontend Verification

Checked with Codex in-app browser against `https://topamath.com`.

Unauthenticated:

- `/lessons` redirects to `/login`.
- `/dashboard` redirects to `/login`.
- No failure message was visible on the login redirect.

Authenticated with the public QA student account shown on the login page:

- `/dashboard` loaded successfully.
- Dashboard showed Grade 3 TH lessons and Grade 2 TH review lessons.
- Dashboard did not show `_ep` lesson ids.
- Dashboard did not show `โหลดแดชบอร์ดไม่สำเร็จ`.

Public `/lessons` did not pass:

- It initially stayed on `กำลังโหลดบทเรียน...`.
- After additional inspection it showed `ไม่สามารถโหลดบทเรียนได้`.
- This means the deployed/public `/lessons` runtime is not yet confirmed fixed, even though local canonical service counts and route wiring are correct.

## Why Prior Counts Differed

101 lessons:

- This was the broad pre-restructure repaired content set from `LESSON_TEST_CONTENT_COMPLETENESS_FINAL_FIX_REPORT`.
- It included generated/legacy/misplaced content that was later cleaned or removed from the active tree.

87/87 complete lessons:

- This is the post-restructure active lesson-file count.
- It equals 43 TH + 44 EP active approved lesson files.
- This is the correct active lesson count now.

43 Thai + 43 EP reports:

- The TH count of 43 is correct.
- EP is currently 44, not 43, because Grade 3 has 9 EP lessons.
- The extra EP Grade 3 lesson is `g3_multiplication_area_model_ep`, alongside `g3_multiplication_area_model_thp_ep`.

## Active, Admin-Only, Student-Visible

- Active lesson files: 87.
- Lesson sidecar entries: 87 approved.
- Admin-only lesson files: 0 among active `grade_*/lessons/*.json`.
- Student-visible lessons: 87 total, split by child program as 43 TH or 44 EP.
- Test sidecar entries: 2182 total.
- Active approved canonical question rows: 870.
- Archived/non-active test status entries: 1312.
- Student-visible test banks: 87 total, split by child program as 43 TH or 44 EP.

## Commands Run

```powershell
python -m py_compile apps/api/app/services/lesson_content.py apps/api/app/routers/me.py apps/api/app/routers/admin.py
npm run lint
```

Both passed.

Canonical invariant script passed:

```text
problems: []
th_count: 43
ep_count: 44
```

## Final Decision

NEEDS_STUDENT_VISIBILITY_FIX

Reason: local canonical source alignment and counts are confirmed, and the dashboard public runtime loads, but the deployed public `/lessons` page still shows `ไม่สามารถโหลดบทเรียนได้` after authenticated verification.

