# Canonical Content Folder Cleanup Report

## Final Decision

READY_CANONICAL_FOLDER_SOURCE_FIXED

## Root Cause

The canonical service had been partially repaired, but active quiz loading still appended legacy `apps/api/app/content/math/question_banks/grade_*/*.jsonl`. Older helper code in `/me` and admin also probed `question_banks` directly. That meant tests could be deduped against, or fall back to, legacy JSONL banks instead of the active `grade_N/quizzes` folders.

There was also no single allowlist function for active content paths, so future recursive scans could accidentally include `_content_backups`, `backup_*`, old `g1/g4/g5/g6`, or other generated folders.

## Wrong Paths Found

Active-loader hazards found and removed:

- `apps/api/app/services/lesson_content.py`: `_quiz_files()` included `question_banks/grade_*/*.jsonl`.
- `apps/api/app/services/content_status.py`: `_question_files()` included `question_banks/grade_*/*.jsonl`.
- `apps/api/app/routers/me.py`: `_content_question_rows_for_lesson()` read `CONTENT_ROOT / "question_banks" / ...`.
- `apps/api/app/routers/admin.py`: `_question_bank_has_test()` checked `CONTENT_ROOT / "question_banks" / ...`.
- `apps/api/app/routers/admin.py`: system health counted all files with `Path(CONTENT_ROOT).rglob("*")`.

No active student/admin loader now scans `_content_backups`, `backup_*`, old `g1/g4/g5/g6`, or legacy `question_banks`.

## Correct Active Paths Enforced

The only active lesson roots are:

- `apps/api/app/content/math/grade_1/lessons`
- `apps/api/app/content/math/grade_2/lessons`
- `apps/api/app/content/math/grade_3/lessons`
- `apps/api/app/content/math/grade_4/lessons`
- `apps/api/app/content/math/grade_5/lessons`
- `apps/api/app/content/math/grade_6/lessons`

The only active quiz roots are:

- `apps/api/app/content/math/grade_1/quizzes`
- `apps/api/app/content/math/grade_2/quizzes`
- `apps/api/app/content/math/grade_3/quizzes`
- `apps/api/app/content/math/grade_4/quizzes`
- `apps/api/app/content/math/grade_5/quizzes`
- `apps/api/app/content/math/grade_6/quizzes`

## Loader Changes

- Added `active_content_roots(kind)` and `path_is_active_content(path, kind)` in `lesson_content.py`.
- Replaced broad grade globs with allowlisted active-root scans.
- Removed legacy `question_banks` from canonical quiz/test loading.
- `content_status` backup/status scanners now use the same active quiz/lesson file list.
- `/me/lessons` now builds canonical sections without repeated full-file scans.
- Admin health content count now counts only active lesson/quiz files.
- Admin canonical lesson/test rows now include:
  - `source_path`
  - `active_content_source_path`
  - `file_structure`
  - `loaded_from_backup`

## Files And Folders Ignored

Ignored for active loading:

- `_content_backups`
- `_archived_legacy_not_loaded`
- `_content_status` except direct status metadata reads
- `backup_miniquiz_round2`
- `backup_miniquiz_round3`
- `backup_teaching_quality_round1`
- `backup_*`
- `question_banks`
- old `g1`, `g4`, `g5`, `g6`
- `__pycache__`

## Files Archived Or Moved

No active lesson or quiz files were moved.

Created:

- `apps/api/app/content/math/_archived_legacy_not_loaded/README.md`

Reason: reserve an explicit non-loaded archive location without deleting or moving good active `grade_1` through `grade_6` content.

## Lesson-Specific Folder Support

Added support for both:

- current flat files: `grade_N/lessons/*.json`, `grade_N/quizzes/*.json`
- one-level lesson folders: `grade_N/lessons/<lesson_id>/*.json`, `grade_N/quizzes/<lesson_id>/*.json`

If a same-named flat file and subfolder both exist, the loader prefers the subfolder file set.

## Migration Script

Added:

- `apps/api/app/scripts/migrate_content_to_lesson_folders.py`

Dry-run command verified:

```text
python -m app.scripts.migrate_content_to_lesson_folders --dry-run
```

Dry-run result:

- planned moves: 174
- moved: 0
- skipped: 0
- conflicts: 0

The real migration was not run. Current flat files are good active content, and moving all 174 files is a review-worthy content operation.

## Canonical Counts

Active lesson files:

- total active lesson files: 87
- Grade 1: 14
- Grade 2: 14
- Grade 3: 17
- Grade 4: 14
- Grade 5: 14
- Grade 6: 14

Active quiz files:

- total active quiz files: 87
- Grade 1: 14
- Grade 2: 14
- Grade 3: 17
- Grade 4: 14
- Grade 5: 14
- Grade 6: 14

Approved canonical content:

- TH lessons: 43
- EP lessons: 44
- TH test banks: 43, 430 rows
- EP test banks: 44, 440 rows

Student-visible EP `/me/lessons` currently returns 42 rows because two EP lesson payloads remain `needs_review` and are correctly hidden.

## Admin Routes Verified

Docker-local API checks using `admin@4-craft.com / admin1234`:

- `/admin/lessons?language=TH&grade=3`: HTTP 200, 8 rows, `loaded_from_backup = false`, first source `/app/app/content/math/grade_3/lessons/g3_area_intro.json`
- `/admin/tests?language=TH&grade=3&lesson_id=g3_area_intro`: HTTP 200, 10 rows, `loaded_from_backup = false`, first source `/app/app/content/math/grade_3/quizzes/g3_area_intro.json`

## Student Routes Verified

Docker-local API checks using `demo@4-craft.com / demo1234`:

- `/me/lessons?program_type=TH`: HTTP 200, 43 rows, `_ep` suffix count 0, `loaded_from_backup = false`
- `/me/lessons?program_type=EP`: HTTP 200, 42 student-visible rows, all visible EP IDs have `_ep`
- `/me/dashboard`: HTTP 200, 8 current-grade Grade 3 TH rows, `_ep` suffix count 0
- `http://localhost:3000/lessons`: HTTP 200
- `http://localhost:3000/dashboard`: HTTP 200

## Test Start Verified

Docker-local TH test:

- `POST /me/lessons/g3_area_intro/test/start?program_type=TH`: HTTP 200
- `GET /me/tests/{session_id}/questions`: HTTP 200, 10 questions
- First question id example: `g3_area_intro_q006`
- Question text was Thai.
- `POST /me/tests/{session_id}/submit`: HTTP 200
- Scoring response keys remained:
  - `correct_answer`
  - `correct_answer_normalized`
  - `explanation_th`
  - `is_correct`
  - `question_id`
  - `selected_answer_normalized`
  - `selected_answer_raw`

## Validation Commands

Passed:

```text
python -m py_compile apps\api\app\services\lesson_content.py apps\api\app\services\content_status.py apps\api\app\routers\me.py apps\api\app\routers\admin.py apps\api\app\scripts\migrate_content_to_lesson_folders.py
pytest tests/test_active_content_roots.py
npm run lint
npm run build
docker compose -f docker-compose.beta.yml build 4craft-api 4craft-web
docker compose -f docker-compose.beta.yml ps
```

Docker status after recreating API/web from the built images:

- `4craft-api`: healthy
- `4craft-web`: healthy
- `4craft-postgres`: healthy
- `4craft-redis`: healthy

Runtime note: recreating API required setting `POSTGRES_PASSWORD` and `DATABASE_URL` to the password already used by the existing Postgres volume: `change_this_local_beta_password`. The compose defaults currently differ from that existing volume, so future recreates should provide the same environment or update the compose/env configuration intentionally.

## Authoring Guide

Updated:

- `docs/CONTENT_AUTHORING_GUIDE.md`

The guide now states that active lessons/tests must be added only under `grade_N/lessons` and `grade_N/quizzes`, warns against `_content_backups`, `backup_*`, `question_banks`, old grade folders, and `_archived_legacy_not_loaded`, and documents the recommended lesson-specific folder structure.

## Remaining Risks

- Legacy folders still exist on disk by design, but active loaders ignore them.
- The flat-to-folder migration is prepared and dry-run verified, but not executed.
- Compose defaults for Postgres credentials do not match the existing local beta volume. This is an environment hygiene issue, not a content-loader issue.
