# Teaching Alignment Batch 2 QA Report

Date: 2026-05-16

Final decision: BLOCKED_BY_CONTENT

## Scope

Reviewed OpenClaw Batch 2 using:

- `docs/TEACHING_ALIGNMENT_FIX_BATCH_2_REPORT.md`
- `docs/TEACHING_ALIGNMENT_FIX_REPORT.md`

Primary lessons checked:

- `g1_add_within_20`
- `g1_counting_numbers`
- `g1_shapes_basic`
- `g1_money_basic`
- `g2_shapes_2d` variants `v02`-`v10`

## Executive Summary

Batch 2 improved the main `questions` arrays for the reviewed Grade 1 lessons and improved most `g2_shapes_2d` visual variants. However, the content is not ready for external beta because stale/misaligned duplicate `quiz_th` blocks remain in several Grade 1 lesson files, `g2_shapes_2d` has a replacement character in a mini-quiz answer, and backend lesson-test start for `g2_shapes_2d` still served unrelated addition questions.

Runtime smoke checks passed, so this is a content QA blocker rather than a runtime blocker.

## JSON Validation

Result: PASS for modified active JSON files.

- Modified JSON files checked under `apps/api/app/content/math`: 21
- Invalid modified JSON files: 0

Encoding issue found:

- `apps/api/app/content/math/grade_2/lessons/g2_shapes_2d.json` contains 1 U+FFFD replacement character.
- Exact issue: variant `v07` mini-quiz `correct_answer` is `วงรีเพราะยาวกว่า�วงกลม กลิ้งไม่เท่าทุกทิศทาง`, while the matching choice is `วงรีเพราะยาวกว่าวงกลม กลิ้งไม่เท่าทุกทิศทาง`.
- Impact: the correct answer is not exactly present in choices, so mini-quiz feedback can mark the right visible option wrong.

## Grade 1 Content Review

### `g1_add_within_20`

Main `questions` array: PASS.

- Questions are story-based addition within 20.
- Choices contain the correct answer.
- Answers/explanations are consistent.

Blocking issue: FAIL in duplicated `quiz_th`.

Examples:

- Lines 741-742: `มี 2 กลุ่ม กลุ่มละ 3 ชิ้น รวมกี่ชิ้น?`
- Lines 795-796: `มี 5 กลุ่ม กลุ่มละ 6 ชิ้น รวมกี่ชิ้น?`
- Lines 867-868: `มี 45 ชิ้น ใช้ไป 5 ชิ้น เหลือกี่ชิ้น?`

These violate the Grade 1 requirements: no multiplication-like grouping and no large subtraction.

### `g1_counting_numbers`

Main `questions` array: PASS.

- Questions are counting/number recognition.
- Choices contain the correct answer.
- Answers/explanations are consistent.

Blocking issue: FAIL in duplicated `quiz_th`.

Examples:

- Lines 724-725: `มี 2 กลุ่ม กลุ่มละ 3 ชิ้น รวมกี่ชิ้น?`
- Lines 778-779: `มี 5 กลุ่ม กลุ่มละ 6 ชิ้น รวมกี่ชิ้น?`
- Lines 850-851: `มี 45 ชิ้น ใช้ไป 5 ชิ้น เหลือกี่ชิ้น?`

These are not counting-number questions.

Additional caveat:

- The lesson visual block still contains addition-style content at lines 111 and 148 (`7 + 3 = 10`). This may be intended as a visual counting activity, but it should be reviewed because the task specifically asked for no concept mismatch in Grade 1 content.

### `g1_shapes_basic`

Main `questions` array: PASS.

- Questions are shape recognition/properties.
- Choices contain the correct answer.
- Answers/explanations are consistent.

Blocking issue: FAIL in duplicated `quiz_th`.

Examples:

- Lines 788-789: `มี 2 กลุ่ม กลุ่มละ 3 ชิ้น รวมกี่ชิ้น?`
- Lines 824-825: `4 + 5 = ?`
- Lines 914-915: `มี 45 ชิ้น ใช้ไป 5 ชิ้น เหลือกี่ชิ้น?`
- Lines 932-933: `10 + 6 = ?`

These are unrelated arithmetic inside a shapes lesson.

### `g1_money_basic`

Main `questions` array: PASS with caveat.

- Questions are money-value recognition and simple total-value questions.
- Choices contain the correct answer.
- Answers/explanations are consistent.

Caveat:

- Some money questions involve repeated values, such as 5 baht coins times 3. They do not use multiplication wording, but they still require repeated addition/skip-counting. This may be acceptable for money recognition, but should be checked against Grade 1 scope.

Blocking issue: FAIL in duplicated `quiz_th`.

Examples:

- Lines 731-732: `มี 2 กลุ่ม กลุ่มละ 3 ชิ้น รวมกี่ชิ้น?`
- Lines 785-786: `มี 5 กลุ่ม กลุ่มละ 6 ชิ้น รวมกี่ชิ้น?`
- Lines 857-858: `มี 45 ชิ้น ใช้ไป 5 ชิ้น เหลือกี่ชิ้น?`

These are not money-recognition questions.

## Grade 2 Shapes Review

### `g2_shapes_2d` `v02`-`v10`

Result: PARTIAL PASS, blocked by one answer-key defect.

What passed:

- `v02`-`v10` no longer contain addition questions in the inspected visual blocks.
- Mini-quiz prompts teach sides, corners, shape recognition, or circle/ellipse comparison.
- Shape visual blocks generally match the story focus.

Blocking issue:

- `v07` has a U+FFFD replacement character in `correct_answer`, causing the correct answer to differ from the visible matching choice.
- File/line: `apps/api/app/content/math/grade_2/lessons/g2_shapes_2d.json:479`

Additional caveat:

- The stories still include quantities, but they are used to contextualize shapes rather than ask addition totals. That is acceptable for the shape lesson as currently written.

## Backend Smoke Checks

Backend URL: `http://127.0.0.1:8001`

Result: PASS for runtime, FAIL for selected test content.

Checks run:

- `GET /health`: PASS, returned `{"status":"ok"}`
- Demo login `demo@4-craft.com / demo1234`: PASS
- `GET /me/lessons`: PASS, returned 22 lessons with grades `1:7`, `2:7`, `3:8`
- Start one fixed Grade 1 lesson test: PASS runtime
- Start `g2_shapes_2d` test: PASS runtime
- Submit one answer: PASS response shape

Normal submit response keys confirmed:

- `question_id`
- `is_correct`
- `correct_answer`
- `explanation_th`
- `selected_answer_raw`
- `selected_answer_normalized`
- `correct_answer_normalized`

Blocking content issue from backend lesson-test selection:

- Starting `g2_shapes_2d` returned plain addition questions, for example:
  - `21 + 2 = ?`
  - `23 + 2 = ?`
  - `26 + 2 = ?`
  - `30 + 2 = ?`
  - `29 + 2 = ?`

These do not match the Grade 2 shapes lesson.

Grade 1 sample test content:

- Starting `g1_add_within_20` returned addition questions such as `19 + 1 = ?`, `13 + 1 = ?`, `16 + 1 = ?`.
- Runtime response shape was normal, though these are symbolic rather than story-based.

## Frontend Smoke Checks

Frontend URL: `http://localhost:3000`

The Codex in-app browser backend was unavailable, so browser automation could not be completed through the Browser Use plugin. I used HTTP route checks as fallback.

HTTP route checks:

- `/`: 200, no Next.js error overlay detected in HTML.
- `/login`: 200, no Next.js error overlay detected in HTML.
- `/dashboard`: 200, no Next.js error overlay detected in HTML.
- `/lessons`: 200, no Next.js error overlay detected in HTML.
- `/register`: 200, no Next.js error overlay detected in HTML.

Fixed lesson routes checked:

- `/dashboard/lessons/g1_add_within_20`: 200, no overlay marker detected.
- `/dashboard/lessons/g1_counting_numbers`: 200, no overlay marker detected.
- `/dashboard/lessons/g1_shapes_basic`: 200, no overlay marker detected.
- `/dashboard/lessons/g1_money_basic`: 200, no overlay marker detected.
- `/dashboard/lessons/g2_shapes_2d`: 200, no overlay marker detected.

Grade 4-6 gating:

- API `/me/lessons` returned only Grade 1-3 lessons.
- Direct API check for a Grade 4 lesson previously returned 404.
- Frontend code still contains Grade 4-6 Coming Soon copy in `apps/web/src/app/lessons/page.tsx` and `apps/web/src/app/dashboard/page.tsx`.

Limitations:

- Because browser automation was unavailable, I could not visually confirm hydrated UI state, console errors, or click behavior. HTTP checks found no HTTP 500 and no server-rendered Next.js overlay markers.

## Comparison Against Prior Report

The original `TEACHING_ALIGNMENT_FIX_REPORT.md` identified Grade 1 concept mismatches as unresolved. Batch 2 fixed the main `questions` arrays for the reviewed Grade 1 lessons, but did not fully remove the old mismatches from duplicated `quiz_th` arrays.

The prior report also flagged `g2_shapes_2d` as only partially fixed. Batch 2 mostly resolves `v02`-`v10` visual-block concept mismatch, but `v07` has an answer-key corruption issue and backend lesson-test selection still serves addition questions for the shapes lesson.

## Remaining Fixes Needed

1. Replace or remove stale `quiz_th` arrays in:
   - `g1_add_within_20.json`
   - `g1_counting_numbers.json`
   - `g1_shapes_basic.json`
   - `g1_money_basic.json`
2. Fix `g2_shapes_2d` `v07` mini-quiz `correct_answer` so it exactly matches the intended choice and contains no U+FFFD character.
3. Investigate backend lesson-test question selection for `g2_shapes_2d`; it currently serves unrelated addition questions from the DB/pool instead of shapes questions.
4. Re-run a real browser smoke test when the in-app browser or another browser automation surface is available, especially for hydrated lesson pages and console errors.

## Final Decision

BLOCKED_BY_CONTENT

Reason: Runtime smoke checks passed, but content is still not trustworthy for external beta because stale Grade 1 `quiz_th` mismatches remain, `g2_shapes_2d` has a corrupted mini-quiz answer key, and backend lesson-test selection for `g2_shapes_2d` serves unrelated addition questions.
