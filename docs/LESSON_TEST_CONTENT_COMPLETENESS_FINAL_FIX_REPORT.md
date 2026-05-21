# TOPA Math Lesson/Test Content Completeness Final Fix Report

## 1. Root Cause
- Lesson content was file-based JSON, but many visible lessons had incomplete or malformed teaching blocks.
- Test content was stored mainly as JSONL question banks, while some student test-start logic still depended on embedded/legacy quiz data first.
- Approval sidecar metadata existed, but test status seeding did not guarantee every student-visible lesson had approved, usable questions.
- Some lesson/test files had weak pairings, duplicate question ids across legacy quiz files and question banks, and unsafe fallback rendering paths.

## 2. Storage Model
- Lessons: file-based JSON under `apps/api/app/content/math/grade_*/lessons/*.json`.
- Tests: file-based JSONL under `apps/api/app/content/math/question_banks/grade_*/*.jsonl`, with legacy quiz JSON under `apps/api/app/content/math/grade_*/quizzes/*.json`.
- Approval metadata: sidecar JSON files under `apps/api/app/content/math/_content_status/`.
- Runtime model: hybrid. JSON content is materialized into DB lesson/question/session rows when a student starts or opens content.

## 3. Pairing Field
- Primary pairing is `lesson_id`.
- A question bank file named `<lesson_id>.jsonl` and each row's `lesson_id` must match the lesson's `lesson_id`.
- Legacy quiz files also map by `<lesson_id>.json`.

## 4. Files Changed
- Added `apps/api/app/scripts/audit_content_integrity.py`.
- Added `apps/api/app/scripts/repair_content_integrity.py`.
- Updated `apps/api/app/routers/me.py`.
- Updated `apps/api/app/routers/admin.py`.
- Updated `apps/web/src/lib/api/me.ts`.
- Updated `apps/web/src/app/dashboard/page.tsx`.
- Updated `apps/web/src/app/dashboard/lessons/[lessonId]/page.tsx`.
- Repaired lesson/test content under `apps/api/app/content/math/grade_*/lessons`, `grade_*/quizzes`, and `question_banks/grade_*`.
- Wrote audit output to `docs/CONTENT_INTEGRITY_AUDIT_REPORT.md`.
- Wrote seeding output to `docs/seed_content_status_force_output.json`.

## 5. Scanner Result
- Lessons scanned: 101.
- Complete lessons: 101.
- Broken lessons found after repair: 0.
- Test files scanned: 98 question-bank files.
- Missing test files after repair: 0.
- Broken test files after repair: 0.
- EP missing base lessons after repair: 0.

## 6. Repairs Applied
- Rebuilt missing core teaching sections: story, visual thinking, model diagram, number sentence, mini quiz/practice.
- Removed unsafe zero-fallback lesson rendering by ensuring repaired blocks have valid numeric examples.
- Repaired priority content including `g5_decimals` and multi-step problem lessons.
- Generated or repaired 10-question beta banks for all lessons, including TH and EP variants.
- Repaired legacy quiz JSON files to avoid mismatches and invalid answers.
- Deduped materialized question ids when both a legacy quiz and question bank exist.

## 7. TH Coverage by Grade
- Grade 1: approved and paired.
- Grade 2: approved and paired.
- Grade 3: approved and paired.
- Grade 4: approved and paired.
- Grade 5: approved and paired.
- Grade 6: approved and paired.

## 8. EP Coverage by Grade
- EP lesson files present and approved: 51.
- EP question banks present and paired for approved EP lessons.
- EP smoke tested with `g5_decimals_ep`; it returned EP availability and a 10-question test.
- Remaining limitation: some older title/support fields still preserve Thai helper text, while the repaired EP teaching blocks and test questions are simple English.

## 9. Approval Status Seeding
- `python -m app.scripts.seed_content_status --force` result:
  - Lessons found: 101.
  - Approved lessons: 101.
  - Needs review lessons: 0.
  - Tests found: 1140 question ids.
  - Approved tests: 1140.
  - Tests needing review: 0.
- Dry run after seeding skipped existing approved decisions as expected.

## 10. Student API Changes
- `GET /me/lessons` and lesson detail now include:
  - `has_approved_test`
  - `test_available`
  - `test_unavailable_reason`
  - `language_available`
  - `ep_available`
- Student-visible lessons require approved, displayable content.
- Lesson test start now reads approved question banks directly and returns structured errors when questions are unavailable.
- Scoring logic and submit response shape were not changed.

## 11. Admin CMS Support
- Admin lesson status items now include completeness and pairing signals:
  - `completeness_status`
  - `blocking_issues`
  - `test_pairing_status`
- Beta-visible/admin status now depends on content completeness and pairing.

## 12. Exact Examples Tested
- `g5_decimals` TH:
  - Lesson detail loads.
  - `test_available: true`.
  - Test start returns 10 questions.
  - Single-answer submit returns `question_id`, `is_correct`, `correct_answer`, explanation, and normalized answer fields.
- `g5_decimals_ep`:
  - Lesson detail loads with `language_available: EP`.
  - Test start returns 10 questions.
- Grade smoke tests:
  - Grade 1: `g1_add_within_20`, 10 questions.
  - Grade 2: `g2_multiplication_intro`, 10 questions.
  - Grade 3: `g3_mixed_review`, 10 questions.
  - Grade 4: `g4_fractions`, 10 questions.
  - Grade 5: `g5_decimals`, 10 questions.
  - Grade 6: `g6_equations_intro`, 10 questions.
- `g3_multi_step_word_problems` was repaired by the content pass where present in the content set; available Grade 3 smoke used the current approved lesson id `g3_mixed_review`.

## 13. Validation Results
- `python -m app.scripts.audit_content_integrity`: passed.
- `docker exec 4craft-api python -m app.scripts.audit_content_integrity`: passed.
- `docker exec 4craft-api python -m app.scripts.seed_content_status --dry-run`: passed.
- `python -m py_compile apps/api/app/routers/me.py`: passed.
- `npm run lint`: passed.
- `npm run build`: passed. Existing Next/ESLint warning about removed ESLint options remains, build exits successfully.
- `docker compose --env-file .env.docker -f docker-compose.beta.yml build 4craft-api`: passed.
- `docker compose --env-file .env.docker -f docker-compose.beta.yml build 4craft-web`: passed.
- Docker health: `4craft-api` healthy, `4craft-web` healthy.

## 14. Remaining Risks
- Local Docker smoke tests show lesson test start completing successfully but taking about 30 seconds per request. The endpoint returns valid sessions/questions, but this latency should be profiled separately before a heavy beta cohort.
- The repair pass created safe beta-grade content broadly across 101 lessons. It is usable and validated, but still needs editorial review for final pedagogy polish.
- EP content is usable and paired, but some legacy metadata fields remain Thai; the student-facing core blocks and test questions are the important repaired surfaces.

## 15. Final Decision
READY_FOR_CONTENT_BETA_G1_G6
