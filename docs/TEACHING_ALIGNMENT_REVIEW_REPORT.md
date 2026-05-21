# Teaching Alignment Review Report

Date: 2026-05-16

Decision: NOT APPROVED

## Scope Reviewed

Reviewed the lessons named as modified/fixed in `docs/TEACHING_ALIGNMENT_FIX_REPORT.md`:

- `apps/api/app/content/math/grade_2/lessons/g2_shapes_2d.json`
- `apps/api/app/content/math/grade_2/quizzes/g2_shapes_2d.json`
- `apps/api/app/content/math/grade_3/lessons/g3_division_intro.json`
- `apps/api/app/content/math/grade_3/quizzes/g3_division_intro.json`

The Git worktree contains broader content changes from prior rounds, so this review used the explicit fixed-lesson list in the Teaching Alignment fix report as the review scope.

## Summary

The fixes are only partially applied. Some default/sampled variants are improved, but other variants in the same lessons still contain placeholder stories, unrelated arithmetic, mismatched visual/model blocks, empty EP content, and generic lesson-test questions. Public beta lesson detail calls can still select these incomplete variants, so the content is not yet trustworthy for closed Beta.

## Validation Results

- Active JSON validation: PASS. All non-backup JSON files under `apps/api/app/content/math` parsed successfully after UTF-8 BOM handling.
- Full JSON validation including backups: FAIL. 2 backup files under `backup_miniquiz_round2` are invalid JSON:
  - `apps/api/app/content/math/backup_miniquiz_round2/g2_add_two_digit.json`
  - `apps/api/app/content/math/backup_miniquiz_round2/g2_subtract_two_digit.json`
- Replacement character check: PASS. U+FFFD count is 0.
- Foreign/report-only fragment check: PASS. No active or backup JSON hits for `缺`, `ปล้ำ`, or common Thai mojibake byte strings.
- Public/local API health: PASS. `http://127.0.0.1:8001/health` and `https://api-beta.topamath.com/health` returned `{"status":"ok"}`.
- Auth/API lesson smoke: PASS for login and lesson listing. Demo login worked locally and on beta API; `/me/lessons` returned 22 Grade 1-3 lessons and no Grade 4-6 lesson entries.
- Direct Grade 4 gating: PASS. `https://api-beta.topamath.com/me/lessons/g4_fractions` returned 404.
- Frontend route smoke: PARTIAL. `/register` and `/lessons` returned 200 locally and on beta. `/` and `/login` returned 404 in this HTTP smoke check; `/dashboard` direct request also returned 404.
- Mini-quiz feedback data shape: PARTIAL. Most sampled mini-quiz blocks have distinguishable correct and wrong choices, but `g2_shapes_2d` `ep_v01` has an empty mini-quiz, and several exposed variants have aligned feedback mechanics but misaligned teaching content.

## Findings

### 1. `g3_division_intro` still exposes placeholder and mismatched variants

File: `apps/api/app/content/math/grade_3/lessons/g3_division_intro.json`

Problem blocks:

- Lines 90, 172, 219, 266, 313, 360, 407, 454, 501: multiple variants still use generic text like "มีของหลายชิ้นต้องแบ่งให้เพื่อนๆ" instead of a concrete word problem.
- Lines 110, 192, 239, 286, 333, 380, 427, 474, 506: the number sentence remains `8 ÷ 2 = ?`, regardless of the story theme.
- Lines 115, 197, 244, 291, 338, 385, 432, 479, 511: mini-quiz questions still use unrelated star objects such as `⭐ 12 ดวง`.
- Line 501: EP variant still includes `[School]`, which is not natural user-facing Thai.

Impact:

- `story_intro` is not concrete for many variants.
- `visual_thinking` / `model_diagram` objects do not consistently match the story.
- `number_sentence` does not match the story for affected variants.
- `mini_quiz` is mechanically answerable but not aligned to the story or variant.
- Public beta lesson detail selected `ep_v01` during the smoke check, so this is user-visible.

Fix recommendation:

- Rewrite every `g3_division_intro` variant, including `ep_v01`, as a concrete division story with matching objects, quantities, grouping model, number sentence, answer, and mini-quiz.
- Remove `[School]` and any generic "มีของหลายชิ้น" placeholder phrasing from user-visible content.

### 2. `g3_division_intro` lesson-test questions are unrelated to division

File: `apps/api/app/content/math/grade_3/lessons/g3_division_intro.json`

Problem blocks:

- Lines 592-627 and duplicated again around 764-801 include multiplication/addition prompts such as:
  - "มี 4 กลุ่ม กลุ่มละ 3 ชิ้น รวมกี่ชิ้น?"
  - "มี 20 ชิ้น ใช้ไป 4 ชิ้น เหลือกี่ชิ้น?"
  - "6 + 5 = ?"
- Lines 660-712 and duplicated around 836-891 include more subtraction-style questions.

Impact:

- The lesson test does not match the division concept.
- Answer keys are arithmetically correct for their unrelated questions, but the test is not aligned with the lesson objective.

Fix recommendation:

- Replace the lesson-level `questions` and duplicated `quiz_th` entries with division story questions only, using equal sharing or grouping contexts and correct explanations.

### 3. `g2_shapes_2d` still includes addition-focused and mismatched variants

File: `apps/api/app/content/math/grade_2/lessons/g2_shapes_2d.json`

Problem blocks:

- Line 118: `v02` story teaches addition ("การบวกคือการเอาจำนวนมารวมกัน") instead of shape recognition/properties.
- Line 148: `v02` number sentence is `1 + 2 + 1 = 4`, which does not match the story quantities of 5 circles and 2 triangles.
- Line 181: another variant repeats addition framing instead of focusing on shape properties.
- Line 433: typo/garbled Thai phrase `พี่อลิสองเรียน`.
- Line 497: typo/garbled Thai phrase `ดวงตะเป็นวงกลม`.
- Line 539: number sentence `6 + 0 = ?` is unrelated to the shape-property story.
- Line 738: `ep_v01` has `Story Time` scaffolding and no usable story content.

Impact:

- Some shape lesson variants still behave like addition lessons.
- Some visual labels and number sentences do not match the story.
- The EP variant is incomplete.
- Public beta lesson detail selected `v02` during the smoke check, so this is user-visible.

Fix recommendation:

- For every `g2_shapes_2d` variant, make the story about identifying or comparing shapes, sides, corners, and curved/straight edges.
- Replace addition number sentences with shape-property statements or remove arithmetic number sentences where not appropriate.
- Fix Thai typos and complete or gate `ep_v01`.

### 4. `g2_shapes_2d` lesson-test questions are unrelated arithmetic

File: `apps/api/app/content/math/grade_2/lessons/g2_shapes_2d.json`

Problem blocks:

- Lines 827-862 and duplicated around 999-1036 include multiplication/addition prompts such as:
  - "มี 3 กลุ่ม กลุ่มละ 3 ชิ้น รวมกี่ชิ้น?"
  - "5 + 5 = ?"
- Lines 844-947 and duplicated around 1017-1126 include subtraction prompts such as:
  - "มี 16 ชิ้น ใช้ไป 4 ชิ้น เหลือกี่ชิ้น?"
  - "มี 50 ชิ้น ใช้ไป 5 ชิ้น เหลือกี่ชิ้น?"

Impact:

- The lesson test does not match shape recognition/properties.
- Answer keys are arithmetically correct for unrelated arithmetic, but the test is not aligned with the lesson concept.

Fix recommendation:

- Replace lesson-level `questions` and duplicated `quiz_th` entries with shape questions: sides, corners, curves, identifying real-world objects, and comparing triangles/squares/rectangles/circles.

### 5. Standalone quiz files are mostly aligned but not fully story-based

Files:

- `apps/api/app/content/math/grade_2/quizzes/g2_shapes_2d.json`
- `apps/api/app/content/math/grade_3/quizzes/g3_division_intro.json`

Result:

- `g2_shapes_2d` standalone quiz questions are concept-aligned for shapes and have valid choices/correct answers/explanations.
- `g3_division_intro` standalone quiz questions are arithmetically correct division facts with valid explanations.

Caveat:

- The Grade 3 quiz is mostly symbolic division facts, not story-based. This is acceptable as practice, but it does not fully satisfy the requested "story-based when appropriate" teaching-alignment standard.

## Beta Route / Gating Check

- `https://api-beta.topamath.com/health`: 200, `{"status":"ok"}`
- `https://api-beta.topamath.com/auth/login`: demo login succeeded.
- `https://api-beta.topamath.com/me/lessons`: returned only Grade 1-3 beta-visible lesson entries.
- `https://api-beta.topamath.com/me/lessons/g4_fractions`: 404, gated.
- `https://beta.topamath.com/register`: 200.
- `https://beta.topamath.com/lessons`: 200.
- `https://beta.topamath.com/`, `https://beta.topamath.com/login`, and `https://beta.topamath.com/dashboard`: 404 in direct HTTP route smoke.

## Mini-Quiz Frontend Feedback Check

The frontend lesson page still contains correct/wrong answer handling for `mini_quiz` blocks in `apps/web/src/app/dashboard/lessons/[lessonId]/page.tsx`, and sampled data shows most modified variants provide choices plus a correct answer.

However, feedback mechanics passing does not make the content trustworthy:

- `g2_shapes_2d` `ep_v01` has empty choices and no answer.
- `g3_division_intro` affected variants have correct/wrong choices but are built around generic or mismatched star questions instead of the lesson story.

## Approval Decision

Decision: NOT APPROVED

These Teaching Alignment fixes are not safe to keep as-is for Beta. The app/gating layer still works for Grades 4-6, but Grade 2 and Grade 3 beta-visible lessons can expose misaligned teaching content and unrelated lesson-test questions.

## Required Fixes Before Approval

1. Fully align every variant of `g3_division_intro`, especially `v02`, `v04`-`v10`, and `ep_v01`.
2. Replace all `g3_division_intro` lesson-level and `quiz_th` generic arithmetic questions with division-aligned story questions.
3. Fully align every variant of `g2_shapes_2d`, especially `v02`, later room/library variants, and `ep_v01`.
4. Replace all `g2_shapes_2d` lesson-level and `quiz_th` generic arithmetic questions with shape-property questions.
5. Re-run public beta lesson detail checks because variant selection can expose non-default variants.
6. Investigate the direct 404 frontend routes for `/`, `/login`, and `/dashboard` if those routes are expected to be public beta entry points.
