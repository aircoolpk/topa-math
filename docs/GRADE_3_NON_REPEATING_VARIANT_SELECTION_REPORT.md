# Grade 3 Non-Repeating Variant Selection Report

## 1. Files changed

- `apps/api/app/services/lesson_content.py`
- `apps/api/app/routers/me.py`
- `docs/GRADE_3_NON_REPEATING_VARIANT_SELECTION_REPORT.md`

Existing dirty worktree changes were present in content, admin, and web files before/around this pass; this implementation did not rewrite, move, or normalize lesson/quiz JSON content.

## 2. Lesson variant selection logic

Grade 3 lesson group ids map through the topic-folder mapping:

- `g3_addition_subtraction -> addition_subtraction`
- `g3_data_charts -> data_charts`
- `g3_division -> division`
- `g3_fractions -> fractions`
- `g3_geometry -> geometry`
- `g3_length -> length`
- `g3_money -> money`
- `g3_multiplication -> multiplication`
- `g3_numbers -> numbers`
- `g3_time -> time`
- `g3_weight_capacity -> weight_capacity`

Student lesson detail/start uses `grade_3/lessons/{TH|EP}/{topic_folder}/*.json`, filters to approved/published/active variants, and rotates by child + program + lesson group. It never falls back across TH/EP and never loads old flat Grade 3 files, backups, or question banks for Grade 3 topic-folder lessons.

## 3. Quiz variant selection logic

Grade 3 test start uses `grade_3/quizzes/{TH|EP}/{topic_folder}/*.json`, selects one approved quiz JSON variant, materializes only that variant's questions into the existing question/session flow, and stores selected quiz metadata on `test_sessions.metadata`.

The response shape remains the same: test start still returns session ids, timing/count metadata, and question payloads.

## 4. History persistence method

Lesson history uses the existing `lesson_variant_views` table:

- `child_id`
- scoped `lesson_id` as `{program}:{lesson_group_id}`
- `variant_id`
- `cycle_number`
- `viewed_at`

Quiz history uses existing `test_sessions.metadata`:

- `grade_level`
- `program_type`
- `lesson_group_id`
- `topic_folder`
- `quiz_variant_id`
- `quiz_variant_cycle`
- `source_path_hash`
- `source_filename`
- `backup_loaded=false`
- `legacy_loaded=false`

No new migration was required.

## 5. Test pairing behavior

Lesson and quiz pairing is by the shared Grade 3 `topic_folder`. For example, `g3_addition_subtraction` pairs:

- lesson: `grade_3/lessons/TH/addition_subtraction/*.json`
- quiz: `grade_3/quizzes/TH/addition_subtraction/*.json`

EP uses only `EP` folders and requires EP access.

## 6. Admin display changes

The shared content listing now exposes Grade 3 quiz variant diagnostics per question row:

- `topic_folder`
- `quiz_variant_id`
- `source_filename`
- `source_path_hash`
- `student_visible`
- `used_by_student_loader`
- `approved_quiz_count`
- `selected_active_source_root`
- `backup_loaded=false`
- `legacy_loaded=false`

## 7. TH validation

Static loader validation:

- TH lesson cards: 11
- Sampled TH approved lesson variants: 0 because current lesson files are marked `needs_review`
- Sampled TH approved quiz variants: 0 because current quiz files are marked `needs_review`

The code correctly refuses student selection for `needs_review` content.

## 8. EP validation

Static loader validation:

- EP lesson cards: 11
- Sampled EP approved lesson variants: 0 because current lesson files are marked `needs_review`
- Sampled EP approved quiz variants: 0 because current quiz files are marked `needs_review`

EP access remains guarded by `_require_program_access`.

## 9. No-repeat validation

Implemented:

- Lesson no-repeat cycle: existing `lesson_variant_views`
- Quiz no-repeat cycle: selected quiz variant metadata on `test_sessions`
- Cycle resets when the selected variants in the current cycle cover the active approved variant set
- Single-variant folders always select that one

Runtime no-repeat could not be fully exercised because active Grade 3 variant files are currently `needs_review`, so the student-approved pool is empty.

## 10. Remaining limitations

- Grade 3 student selection is blocked until lesson/quiz JSON variants are approved or otherwise marked active for student use.
- `npm run lint` fails before checking this change because `.next/types/**/*.ts` includes missing generated files.
- `npm run build` compiles but fails type checking in an existing dashboard lesson page issue at `apps/web/src/app/dashboard/lessons/[lessonId]/page.tsx:649`, plus an ESLint option mismatch.
- Docker beta build was not run after the web build failure, since the same web type failure would block the image.

## 11. Final decision

BLOCKED_BY_RUNTIME

