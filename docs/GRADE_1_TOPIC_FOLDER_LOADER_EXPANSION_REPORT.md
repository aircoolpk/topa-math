# Grade 1 Topic-Folder Loader Expansion Report

Date: 2026-05-27

## Files Changed

- `apps/api/app/services/lesson_content.py`
- `apps/api/app/routers/me.py`
- `apps/api/app/routers/admin.py`
- `docs/GRADE_1_TOPIC_FOLDER_LOADER_EXPANSION_REPORT.md`

No lesson JSON, quiz JSON, Stripe code, schema, or package audit command was changed.

## Loader Change

The Grade 3 topic-folder loader was generalized into a grade-aware topic-folder loader.

Supported topic-folder grades now include:

- Grade 1
- Grade 3

Grade 3 wrapper functions remain in place so existing Grade 3 callers keep working.

## Grade 1 Topic Map

Added Grade 1 topic-folder mapping:

- `g1_counting_1_to_10 -> counting_1_to_10`
- `g1_add_within_10 -> add_within_10`
- `g1_subtract_within_10 -> subtract_within_10`
- `g1_counting_11_to_20 -> counting_11_to_20`
- `g1_add_sub_within_20 -> add_sub_within_20`
- `g1_picture_graphs -> picture_graphs`
- `g1_weight_measurement -> weight_measurement`
- `g1_position_order -> position_order`
- `g1_geometry_shapes -> geometry_shapes`
- `g1_counting_21_to_100 -> counting_21_to_100`
- `g1_length_measurement -> length_measurement`
- `g1_add_within_100 -> add_within_100`
- `g1_subtract_within_100 -> subtract_within_100`
- `g1_addition_subtraction_word_problems -> addition_subtraction_word_problems`

## Student Behavior

Student lesson listing now resolves approved Grade 1 topic-folder lessons from:

- `grade_1/lessons/TH/[topic_folder]/*.json`
- `grade_1/lessons/EP/[topic_folder]/*.json`

Student quiz availability now resolves approved Grade 1 topic-folder quizzes from:

- `grade_1/quizzes/TH/[topic_folder]/*.json`
- `grade_1/quizzes/EP/[topic_folder]/*.json`

EP access still goes through the existing entitlement check. A non-EP user calling Grade 1 EP lessons received HTTP 403.

Because all current Grade 1 topic-folder content is `needs_review`, student Grade 1 lists correctly remain empty until content is approved.

## Admin Behavior

Admin lesson listing can see Grade 1 topic-folder groups even while content is `needs_review`.

Admin test listing now returns Grade 1 quiz topic-folder pairing rows:

- Grade 1 TH admin lesson groups: 14
- Grade 1 TH admin quiz topic rows: 14
- Grade 3 TH admin quiz topic rows: 11

For current `needs_review` Grade 1 quizzes, admin pairing rows show `test_available=false` and approved counts at 0.

## Approval Gate Validation

Current real content state:

- `GET /me/lessons?grade=1&program_type=TH`: 0 student lessons
- Grade 1 child dashboard with TH: 0 current-grade lessons
- Reason: all Grade 1 topic-folder lesson variants are still `needs_review`

In-memory approval simulation:

- Simulated one approved Grade 1 TH lesson variant and matching quiz variant for `g1_counting_1_to_10`
- Student topic-folder loader returned 1 lesson card
- `test_available=true`
- `get_canonical_lesson("g1_counting_1_to_10", "TH")` resolved successfully
- `has_approved_test("g1_counting_1_to_10", "TH")` returned true

No content files were edited for this simulation.

## Grade 3 Regression Check

Grade 3 behavior remains available:

- `GET /me/lessons?grade=3&program_type=TH`: 11 current-grade lesson cards
- Admin Grade 3 TH quiz topic rows: 11
- `get_canonical_lesson("g3_addition_subtraction", "TH")` resolves successfully

## Ignored Paths

The loader is constrained to active topic-folder paths:

- `grade_1/lessons/TH|EP/[topic_folder]/*.json`
- `grade_1/quizzes/TH|EP/[topic_folder]/*.json`
- existing Grade 3 topic-folder paths

It does not add loading from:

- `lessons old`
- `quizzes old`
- `_content_backups`
- `backup_*`
- `question_banks`
- legacy flat Grade 1 files

## Build And Runtime Validation

Passed:

- `python -m py_compile apps/api/app/services/lesson_content.py apps/api/app/routers/me.py apps/api/app/routers/admin.py`
- `npm run lint`
- `npm run build`
- `docker compose --env-file .env.docker -f docker-compose.beta.yml build 4craft-api 4craft-web`
- `docker compose --env-file .env.docker -f docker-compose.beta.yml up -d 4craft-api 4craft-web`
- API container healthy
- Web container healthy

Note: Next.js still prints the existing ESLint options warning during `npm run build`, but the build exits successfully.

## Remaining Limitation

Grade 1 student-facing cards will not appear until lesson variants are approved. Matching tests will not become available until quiz variants are approved and valid. This is expected and preserves the `needs_review` gate.

## Final Decision

READY_GRADE_1_TOPIC_FOLDER_LOADER
