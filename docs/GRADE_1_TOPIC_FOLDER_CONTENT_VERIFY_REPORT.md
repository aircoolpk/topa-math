# Grade 1 Topic-Folder Content Verify Report

Date: 2026-05-27

## Scope

Verification was read-only for lesson and quiz content. No Grade 1 JSON content was rewritten, moved, or renamed. No Stripe code, schema, or package audit command was touched.

Checked active Grade 1 topic-folder roots:

- `apps/api/app/content/math/grade_1/lessons/TH/[topic_folder]/*.json`
- `apps/api/app/content/math/grade_1/lessons/EP/[topic_folder]/*.json`
- `apps/api/app/content/math/grade_1/quizzes/TH/[topic_folder]/*.json`
- `apps/api/app/content/math/grade_1/quizzes/EP/[topic_folder]/*.json`

## Folder Structure

Active topic-folder structure matches expected counts:

| Area | Topic folders | JSON files | Result |
| --- | ---: | ---: | --- |
| Lessons TH | 14 | 28 | Pass |
| Lessons EP | 14 | 28 | Pass |
| Quizzes TH | 14 | 28 | Pass |
| Quizzes EP | 14 | 28 | Pass |

The same 14 topic folders exist in all four active roots:

- `add_sub_within_20`
- `add_within_10`
- `add_within_100`
- `addition_subtraction_word_problems`
- `counting_1_to_10`
- `counting_11_to_20`
- `counting_21_to_100`
- `geometry_shapes`
- `length_measurement`
- `picture_graphs`
- `position_order`
- `subtract_within_10`
- `subtract_within_100`
- `weight_measurement`

## JSON Syntax

- Active Grade 1 JSON files checked: 112
- JSON parse errors: 0

Result: Pass.

## Status

- Active files with `status = needs_review`: 112
- Active files with any other status: 0

Result: Pass.

## Grade 3 Template Compatibility

Lesson files include the expected Grade 3-style top-level compatibility fields used by the current renderer:

- `variant_id`
- `status`
- `visual_blocks`

Lesson schema summary:

- Lesson files checked: 56
- Files with compatible top-level structure: 56
- Files with missing required lesson sections: 0

Result: Pass.

## Required Lesson Sections

Every active lesson file includes all required visual block types:

- `story_intro`
- `think_story`
- `model_diagram`
- `number_sentence`
- `mini_quiz`

Result: Pass.

## Quiz Structure

Quiz validation summary:

- Quiz files checked: 56
- Files with exactly 10 questions: 56
- Files where every question has 4 choices: 56
- Files where `correct_answer` matches one choice: 56
- Files where every question has an explanation: 56

Result: Structural pass.

## Language Field Check

- Thai text found inside `*_en` fields: 0

Result: Pass.

## Math Correctness Check

Detectable arithmetic was checked by comparing arithmetic expressions in explanations against the declared correct answer.

Summary:

- Detectable arithmetic expressions checked: 498
- Arithmetic checks passing: 421
- Arithmetic checks uncertain: 62
- Arithmetic checks failing: 77
- Quiz files with at least one detected math-answer mismatch: 22

Examples of detected mismatches:

- `quizzes/TH/add_sub_within_20/add_sub_within_20_th_q001.json`
  - q4: explanation `11 + 5 = 16`, but correct answer is `12 เล่ม`
  - q6: explanation `9 + 8 = 17`, but correct answer is `14 ชิ้น`
  - q8: explanation `11 + 6 = 17`, but correct answer is `16 ลูก`
  - q10: explanation `10 + 7 = 17`, but correct answer is `19 แท่ง`

- `quizzes/TH/add_within_10/add_within_10_th_q001.json`
  - q8: explanation `4 + 3 = 7`, but correct answer is `9 แท่ง`

- `quizzes/TH/add_within_100/add_within_100_th_q001.json`
  - q4: explanation `47 + 38 = 85`, but correct answer is `100 เล่ม`
  - q5: explanation `56 + 29 = 85`, but correct answer is `67 ผล`
  - q6: explanation `34 + 47 = 81`, but correct answer is `56 ชิ้น`

- `quizzes/TH/addition_subtraction_word_problems/addition_subtraction_word_problems_th_q001.json`
  - q4: explanation `53 - 18 = 35`, but correct answer is `62 ผล`
  - q5: explanation `46 + 29 = 75`, but correct answer is `57 เล่ม`
  - q6: explanation `75 - 28 = 47`, but correct answer is `82 บาท`

- `quizzes/TH/subtract_within_100/subtract_within_100_th_q001.json`
  - q4: explanation `96 - 37 = 59`, but correct answer is `77 แท่ง`
  - q5: explanation `73 - 28 = 45`, but correct answer is `80 ผล`
  - q10: explanation `76 - 25 = 51`, but correct answer is `77 ลูก`

Some EP/position/order examples may require human review because the detector only understands simple arithmetic expressions. However, many TH examples above are direct answer mismatches and should be fixed before approval.

Result: Fail for quiz content correctness.

## Files Outside Active Topic-Folder Structure

Active Grade 1 JSON files found: 112.

Additional Grade 1 JSON files also exist outside the active topic-folder structure: 28.

They are under:

- `apps/api/app/content/math/grade_1/lessons old/`
- `apps/api/app/content/math/grade_1/quizzes old/`

These were not loaded as active topic-folder content by this verification, but they mean the Grade 1 content directory is not limited to only the active topic-folder structure.

Result: Warning.

## Grade 3 Modification Check

This verification did not edit Grade 3 files.

Current git status already shows Grade 3 content changes in the working tree, including modified Grade 3 lesson files and untracked Grade 3 quiz topic folders. Because the working tree was already dirty, this report cannot claim Grade 3 is clean; it can only confirm this verification pass made no Grade 3 edits.

Result: Warning.

## Overall Result

Pass:

- Folder counts
- Topic folder parity across TH/EP and lessons/quizzes
- JSON syntax
- `needs_review` status
- Lesson required sections
- Grade 3-style lesson schema compatibility
- Quiz structural requirements
- No Thai in `*_en` fields

Needs fix:

- Detected quiz arithmetic/correct-answer mismatches in 22 quiz files.
- Legacy/outside Grade 1 JSON folders are present under `lessons old` and `quizzes old`.

## Final Decision

NEEDS_GRADE_1_QUIZ_FIX
