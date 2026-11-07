# Grade 3 Quiz Pairing And Non-Repeat Report

## Files changed

- `apps/api/app/services/lesson_content.py`
- `apps/api/app/routers/me.py`
- `apps/api/app/routers/admin.py`
- `docs/GRADE_3_QUIZ_PAIRING_AND_NON_REPEAT_REPORT.md`

No lesson JSON or quiz JSON files were rewritten, moved, or renamed.

## Quiz pairing

Grade 3 test start now resolves `lesson_group_id` to `topic_folder` and loads only:

- TH: `apps/api/app/content/math/grade_3/quizzes/TH/[topic_folder]/*.json`
- EP: `apps/api/app/content/math/grade_3/quizzes/EP/[topic_folder]/*.json`

Examples:

- `g3_addition_subtraction + TH -> grade_3/quizzes/TH/addition_subtraction`
- `g3_addition_subtraction + EP -> grade_3/quizzes/EP/addition_subtraction`

The loader does not use `_content_backups`, `backup_*`, `question_banks`, or legacy flat Grade 3 quiz files.

## Valid quiz rule

Grade 3 quiz files are considered student-usable when they are structurally valid and not rejected, archived, deleted, disabled, or inactive. Each selected quiz variant must have at least 10 usable questions.

Dashboard and `/me/lessons` now report `test_available=true` for Grade 3 topics that have valid quiz files in the matching TH/EP topic folder.

## Non-repeat

Quiz variant history reuses `test_sessions.metadata`:

- `grade_level`
- `program_type`
- `lesson_group_id`
- `topic_folder`
- `quiz_variant_id`
- `quiz_variant_cycle`
- `source_path_hash`
- `source_filename`

Selection is randomized among unused variants in the current cycle. Once all variants for the same child + lesson group + program have been used, the cycle increments and variants become eligible again.

Isolated validation for `g3_addition_subtraction + TH`:

- first selected: `add_sub_th_q001`, cycle 1
- second selected: `add_sub_th_q002`, cycle 1
- third selected: `add_sub_th_q001`, cycle 2
- first two were non-repeating: true
- reset after all variants: true

## Lesson randomization check

Existing Grade 3 lesson variant selection uses `lesson_variant_views` with scoped lesson ids like `TH:g3_addition_subtraction`, so TH and EP lesson cycles stay separate. It selects from the matching `grade_3/lessons/{TH|EP}/[topic_folder]` folder.

## Admin tests

`/admin/tests?grade=3&program_type=TH|EP` now returns grouped Grade 3 quiz pairing rows with:

- program
- topic_folder
- quiz_files
- quiz_variant_count
- approved_valid_count
- paired lesson_group_id
- test_available
- source_folder
- `backup_loaded=false`
- `legacy_loaded=false`

`/admin/content/tests` uses the same grouped Grade 3 view when a Grade 3 TH/EP language filter is supplied.

## Validation

Source validation:

- TH `g3_addition_subtraction` resolves to `grade_3/quizzes/TH/addition_subtraction`
- EP `g3_addition_subtraction` resolves to `grade_3/quizzes/EP/addition_subtraction`
- No backup or question bank path is used by the Grade 3 topic-folder loader

Dashboard/static card validation:

- TH Grade 3 cards: 11
- TH cards with `test_available=true`: 11
- EP Grade 3 cards: 11
- EP cards with `test_available=true`: 11

Question validation:

- TH `addition_subtraction`: `add_sub_th_q001.json`, `add_sub_th_q002.json`, 10 questions each
- EP `addition_subtraction`: `add_sub_ep_q001.json`, `add_sub_ep_q002.json`, 10 questions each

EP lock:

- EP test start still passes through `_require_program_access`; non-EP users cannot start EP tests.

Build:

- `python -m py_compile apps/api/app/services/lesson_content.py apps/api/app/routers/me.py apps/api/app/routers/admin.py` passed.
- `npm run lint` in `apps/web` failed on existing missing `.next/types/**/*.ts` entries.
- `npm run build` in `apps/web` compiled, then failed on existing ESLint option mismatch and TypeScript error in `apps/web/src/app/dashboard/lessons/[lessonId]/page.tsx:649`.
- `docker compose -f docker-compose.beta.yml build 4craft-api 4craft-web` built the API image path but failed on the web `npm run build` step for the same TypeScript error.

## Final decision

READY_GRADE_3_QUIZ_PAIRING

