# Grade 1 Topic-Folder Content Reverify Report

Date: 2026-05-27

## Scope

Read-only verification was run against active Grade 1 topic-folder content only:

- `apps/api/app/content/math/grade_1/lessons/TH`
- `apps/api/app/content/math/grade_1/lessons/EP`
- `apps/api/app/content/math/grade_1/quizzes/TH`
- `apps/api/app/content/math/grade_1/quizzes/EP`

No lesson JSON, quiz JSON, schema, Stripe code, or package audit command was changed.

## Folder Structure

Active structure is valid and consistent across lessons/quizzes and TH/EP.

| Area | Topic folders | JSON files | Result |
| --- | ---: | ---: | --- |
| Lessons TH | 14 | 28 | Pass |
| Lessons EP | 14 | 28 | Pass |
| Quizzes TH | 14 | 28 | Pass |
| Quizzes EP | 14 | 28 | Pass |

All four active roots contain the same 14 topic folders:

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

- Active JSON files checked: 112
- JSON parse errors: 0

Result: Pass.

## Lesson Sections

Lesson files checked: 56.

Every lesson file includes the required visual block types:

- `story_intro`
- `think_story`
- `model_diagram`
- `number_sentence`
- `mini_quiz`

Missing required lesson sections: 0.

Result: Pass.

## Quiz Structure

Quiz files checked: 56.

All quiz files pass:

- Exactly 10 questions per file.
- Exactly 4 choices per question.
- `correct_answer` matches one choice exactly.
- `answer`, when present, matches `correct_answer`.
- Explanation field is present.

Structural issues found: 0.

Result: Pass.

## Math And Explanation Recheck

Quiz questions checked: 560.

Validation summary:

- Numeric `correct_answer` questions: 540
- Numeric answers present in explanations: 540
- Numeric answer/explanation mismatches: 0
- Non-numeric answer questions: 20
- Non-numeric answers repeated directly in explanation: 18
- Non-numeric answers explained by context rather than repeated text: 2

The two contextual non-numeric cases are Thai position-order questions. The explanations correctly state the ranking relationship, for example `อันดับ 9 อยู่หลังอันดับ 5`, even though they do not repeat the child name from `correct_answer`.

The previous direct arithmetic mismatches are no longer present. Result: Pass for admin review.

## English Field Language Check

Recursive scan of keys ending in `_en` found Thai characters in `_en` fields: 0.

Result: Pass.

## Status Check

All active files remain in review state:

- `needs_review`: 112
- other statuses: 0

Result: Pass.

## Old Folders

Old folders were ignored for active validation, as requested, but are still present:

- `apps/api/app/content/math/grade_1/lessons old`
- `apps/api/app/content/math/grade_1/quizzes old`

Old JSON files found there: 28.

These were reported separately and were not counted as active topic-folder content.

## Final Decision

READY_GRADE_1_ADMIN_REVIEW
