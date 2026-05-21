# Thai Lesson Content Fix Report

Date: 2026-05-16

## Scope

Content-only QA and repair pass for Thai math lesson content across Grades 1-6.

Priority lessons fully rewritten/aligned:

- `g1_shapes_basic`
- `g1_add_within_20`
- `g1_counting_numbers`
- `g1_money_basic`
- `g2_shapes_2d`
- `g2_money_change`
- `g3_division_intro`
- `g3_area_intro`

Additional live lesson question/quiz arrays cleaned across Grades 1-6 where generated generic questions did not match the lesson concept.

## Files Changed

Live lesson JSON:

- `apps/api/app/content/math/grade_1/lessons/*.json`
- `apps/api/app/content/math/grade_2/lessons/*.json`
- `apps/api/app/content/math/grade_3/lessons/*.json`
- `apps/api/app/content/math/grade_4/lessons/*.json`
- `apps/api/app/content/math/grade_5/lessons/*.json`
- `apps/api/app/content/math/grade_6/lessons/*.json`

Active quiz-bank JSONL files updated for priority tested lessons:

- `apps/api/app/content/math/question_banks/grade_2/g2_shapes_2d.jsonl`
- `apps/api/app/content/math/question_banks/grade_2/g2_money_change.jsonl`
- `apps/api/app/content/math/question_banks/grade_3/g3_area_intro.jsonl`
- `apps/api/app/content/math/question_banks/grade_3/g3_division_intro.jsonl`

## Fixes Made

Priority lesson teaching blocks:

- Replaced concept-mismatched story variants in `g1_shapes_basic` so shape lessons now teach sides, corners, and shape recognition instead of addition.
- Rebuilt `g1_counting_numbers` variants so the story, visual count, number sentence, mini quiz, answer, and explanation use the same object and count.
- Rebuilt `g1_money_basic` variants to use Grade 1-friendly repeated addition of coin values, with no multiplication notation in Grade 1 money explanations.
- Rebuilt `g2_shapes_2d` variants to teach sides, corners, and shape recognition only.
- Rebuilt `g2_money_change` variants so price, paid amount, change, equation, mini quiz, and explanation match.
- Rebuilt `g3_division_intro` variants around equal sharing, with matching grouping models and division sentences.
- Rebuilt `g3_area_intro` variants around rectangle area, with width, height, total, number sentence, and mini quiz aligned.

Question and quiz arrays:

- Replaced generic generated questions such as unrelated group/item arithmetic in non-matching lessons.
- Synced `questions` and `quiz_th` answer keys and explanations for live Grades 1-6 lesson JSON.
- Confirmed every live lesson `correct_answer` appears in its `choices`.

## Validation

- Live JSON validation excluding old backup folders: `PASS`
- Priority JSONL validation: `PASS`
- Live U+FFFD replacement character count: `0`
- Live scan for `缺`, `ปล้ำ`, and replacement-character markers in JSON/JSONL: `PASS`
- Answer-in-choices validation for live Grades 1-6 lessons: `PASS`
- Grade 1 priority scan for multiplication drift in `g1_shapes_basic`, `g1_counting_numbers`, and `g1_money_basic`: `PASS`

## Caveats

- Two old backup JSON files under `apps/api/app/content/math/backup_miniquiz_round2/` still do not parse as valid JSON. They are backup artifacts, not live lesson content.
- A generator script under `apps/api/app/content/math/grade_2/lessons/generate_variants.py` still contains a garbled string in script text. It is not live lesson JSON and was not changed in this pass.
- This pass did not run a browser smoke test. It was limited to content files and content validation.

## Protected Areas

No Stripe, auth, frontend app logic, backend scoring logic, or quiz/test scoring logic was modified by this content pass.

## Decision

CONTENT_FIX_APPLIED_WITH_CAVEATS

The live Thai lesson content is safer and more concept-aligned for Beta review. Remaining caveats are old backup/script artifacts, not live student-facing JSON.
