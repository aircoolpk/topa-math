# TOPA Math Lesson Language Variant Restructure Report

## 1. Root cause

The previous completeness pass made lesson pages non-empty, but it left the old mixed content model in place. TH and EP files could share generic generated blocks, old `visual_thinking` / “Look First” sections were still normalized by the frontend, EP tests were stored in `question_text_en` but shared validators only checked Thai-style question fields, and some misplaced Grade 4 lesson files existed under the Grade 2 lesson folder.

## 2. Old content structure problems

- Lessons mixed legacy `lesson_variants`, `visual_blocks`, `visual_thinking`, and generated filler.
- TH mode could be affected by English instructional text.
- EP mode could be blocked or incorrectly treated as invalid by validators that ignored `question_text_en`.
- Tests were sometimes too generic for the lesson topic.
- Duplicate/misplaced lesson files made Program -> Grade -> Lesson scans ambiguous.

## 3. New structure implemented

- Added canonical `story_variants` per lesson with:
  - `variant_id`
  - `story`
  - `think_story`
  - `model_diagram`
  - `number_sentence`
  - `practice`
  - `helper_tip`
  - approved status
- Student lesson output now uses:
  - Story
  - Think Story
  - Model Diagram
  - Number Sentence
  - Practice
- Removed active student rendering of “Look First / มองภาพก่อน”.
- EP fallback to TH was disabled for `/me/lessons/{lesson_id}?program_type=EP`.

## 4. Lessons repaired TH count

43 TH lesson files are active and complete after removing misplaced Grade 4 duplicates from the Grade 2 folder.

Coverage:
- P1 TH: 7
- P2 TH: 7
- P3 TH: 8
- P4 TH: 7
- P5 TH: 7
- P6 TH: 7

## 5. Lessons repaired EP count

44 EP lesson files are active and complete.

Coverage:
- P1 EP: 7
- P2 EP: 7
- P3 EP: 9
- P4 EP: 7
- P5 EP: 7
- P6 EP: 7

## 6. Variants created

87 approved story variants were created, one approved variant per active lesson for beta. The schema supports multiple variants per lesson for future randomization.

## 7. Tests repaired/created

Question banks were regenerated for TH and EP lessons with 10 questions per active lesson. The status sidecar now has 870 unique approved active test questions and 1,312 stale/unpaired question statuses archived.

## 8. Content archived/deleted

- Misplaced Grade 4 lesson files under `apps/api/app/content/math/grade_2/lessons` were removed from the active tree.
- One language-variant backup folder was retained:
  - `apps/api/app/content/math/_content_backups/20260522_111851_language_variant_restructure`

## 9. Admin CMS changes

Admin status list now exposes lesson program, variant count, approved variant count, missing EP, and missing test flags. Existing lesson detail/admin payloads can inspect the new `story_variants` data.

Remaining limitation: a full rich variant editor with duplicate/archive buttons is not fully built in this pass.

## 10. Student API changes

- `/me/lessons/{lesson_id}` recognizes approved `story_variants`.
- Student API returns only complete approved variants.
- `program_type=EP` no longer silently returns TH fallback content.
- Test materialization now reads `question_text_en` and `question_en`.
- Lesson/test availability remains tied to approved content status.

## 11. Validation results

Passed:
- `python -m py_compile` for changed API files.
- `python -m app.scripts.audit_lesson_language_and_variants`
  - Total lessons: 87
  - Complete lessons: 87
  - Broken lessons: 0
  - TH lessons: 43
  - EP lessons: 44
- `python -m app.scripts.seed_content_status --force`
  - Approved lessons: 87
  - Needs review lessons: 0
  - Unique approved active tests: 870
  - Tests needing review: 0
- `npm run lint`
- `npm run build`
- `docker compose --env-file .env.docker -f docker-compose.beta.yml build 4craft-api 4craft-web`
- Docker API/web/postgres/redis healthy.
- `GET /health` returned ok.
- Authenticated TH dashboard, lesson detail, lesson test start, and single-answer submit passed.
- Fresh EP smoke account opened `g3_fractions_intro_ep` and started a 10-question EP test.

Browser note: unauthenticated route loaded with no console errors and correctly redirected to login. The in-app browser automation could not fill the login form because its virtual clipboard integration failed, so authenticated browser UI verification was completed through API/HTTP smoke instead.

## 12. Exact examples fixed

- `g3_fractions_intro` TH now returns Thai-only story variant blocks: `story_intro`, `think_story`, `model_diagram`, `number_sentence`, `mini_quiz`.
- `g3_fractions_intro_ep` now returns EP-only English story/test content.
- `g3_area_intro` TH/EP now use model diagram blocks without “Look First”.
- `g5_decimals` TH/EP now uses decimal money/change content.
- `g3_multi_step_word_problems` TH/EP now uses multi-step profit stories and tests instead of single-step area filler.
- Tests are no longer bare equations for the repaired generated banks.

## 13. Remaining limitations

- Only one approved story variant per lesson was created in this pass.
- Some generic topic families still use shared templates, although they are complete, language-separated, and topic-safe for beta.
- Admin variant creation/duplication/archive controls need a fuller UI pass.

## 14. Final decision

READY_FOR_TH_EP_CONTENT_BETA
