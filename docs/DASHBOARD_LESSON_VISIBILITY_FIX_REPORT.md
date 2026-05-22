# TOPA Math Dashboard Lesson Visibility Fix Report

## Root Cause
- The content completeness pass made lesson/test approval stricter, but dashboard lesson-card construction was also reading question-bank files and test status metadata repeatedly for every visible lesson.
- On the Docker beta bind mount this made `/me/dashboard` and `/me/lessons` very slow, which caused the frontend to show the dashboard error/empty states even though approved lessons existed.
- Lesson reading visibility was effectively coupled to expensive test availability checks. Reading an approved lesson should not require opening the question bank; only the test button needs approved-test metadata.

## Fixes Applied
- Cached sidecar status loaders in `apps/api/app/services/content_status.py`:
  - `load_lessons_status()`
  - `load_tests_status()`
  - Cache clears on `save_lessons_status()` / `save_tests_status()`.
- Updated `/me` lesson metadata in `apps/api/app/routers/me.py`:
  - Listing/detail now use approved status metadata to set `test_available`.
  - Question-bank files are no longer opened for every dashboard lesson card.
  - Question-bank content is still read when starting a lesson test.
- Narrowed dashboard lesson scanning:
  - Dashboard scans only current grade and previous grade review lessons.
  - `/me/lessons?grade=N` can include the requested grade for grade-filter views.
- Added admin-safe backend logging:
  - Debug summary for filtered lessons.
  - Warning when no JSON lessons are visible for a child, including non-sensitive filter reasons.

## Dashboard API Shape Verified
- `/me/dashboard.child.grade_level` returns the child grade.
- `/me/dashboard.child.program_type`, `membership_status`, `student_photo_url`, `student_photo_path`, `avatar_gender`, score, XP, level, coins, rank title, and free-test counters remain in the response.
- `/me/dashboard.current_grade_lessons` returns current-grade approved lessons.
- `/me/dashboard.review_lessons` returns previous-grade approved review lessons.

## Approved Status Persistence
- Docker compose mounts `./apps/api/app/content/math:/app/app/content/math`, so `_content_status/lessons.json` and `_content_status/tests.json` persist across container rebuilds/restarts.
- `docker exec 4craft-api python -m app.scripts.seed_content_status --dry-run` confirmed existing metadata is present:
  - skipped existing lessons: 101
  - skipped existing tests: 1140

## Validation
- `GET /health`: PASS, `ok`.
- Authenticated `GET /me/dashboard`: PASS.
  - Grade 3 smoke child returned `grade_level: 3`.
  - Current lessons: 8.
  - Review lessons: 6.
- Authenticated `GET /me/lessons`: PASS.
  - Current lessons: 8.
  - Review lessons: 7.
- Authenticated `GET /me/lessons?grade=5`: PASS.
  - Returned Grade 5 approved lessons for grade filter behavior.
- Authenticated `GET /me/lessons/g3_area_intro`: PASS.
  - Returned lesson detail with 5 visual blocks.
- Authenticated `POST /me/lessons/g3_area_intro/test/start`: PASS.
  - Returned a test session and 10 questions.
- `docker exec 4craft-api python -m app.scripts.audit_content_integrity`: PASS.
  - 101 complete lessons, 0 broken lessons, 0 missing tests.
- `python -m py_compile apps/api/app/routers/me.py apps/api/app/services/content_status.py`: PASS.
- `docker compose --env-file .env.docker -f docker-compose.beta.yml build 4craft-api`: PASS.
- Docker health:
  - `4craft-api`: healthy.
  - `4craft-web`: healthy.

## Remaining Notes
- Local Docker API calls are still not instant on Windows bind mounts, but dashboard/lessons now return approved lesson data and no longer scan all G1-G6 question banks for normal dashboard display.
- Test start still reads/materializes question data on demand; scoring logic was not changed.

## Final Decision
READY_DASHBOARD_LESSONS_FIXED
