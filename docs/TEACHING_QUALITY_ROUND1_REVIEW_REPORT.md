# Teaching Quality Round 1 Review Report

Date: 2026-05-15

Decision: **NOT APPROVED**

## Review Scope

Reviewed OpenClaw Teaching Quality Round 1 content changes for Grade 1-3 math content under:

- `apps/api/app/content/math`

No application code, frontend logic, backend logic, Stripe logic, or quiz/test scoring logic was edited during this review.

## Files Reviewed

Reported/observed edited lesson files:

- Grade 1: `g1_add_within_20`, `g1_compare_numbers`, `g1_counting_numbers`, `g1_money_basic`, `g1_shapes_basic`, `g1_subtract_within_20`, `g1_time_basic`
- Grade 2: `g2_add_two_digit`, `g2_money_change`, `g2_multiplication_intro`, `g2_shapes_2d`, `g2_subtract_two_digit`, `g2_time_calendar`, `g2_times_table_2_5_10`
- Grade 3: `g3_area_intro`, `g3_division_intro`, `g3_fractions_intro`, `g3_measurement`, `g3_mixed_review`, `g3_multi_step_word_problems`, `g3_multiplication_multi_digit`

Backup folder reviewed:

- `apps/api/app/content/math/backup_teaching_quality_round1`

## Backup Verification

- `backup_teaching_quality_round1` exists.
- It contains 23 JSON backup files.
- All 23 Round 1 backup files are readable JSON.
- Caveat: backups are stored as flat filenames, so files with the same basename across `lessons` and `quizzes` are ambiguous. A future backup should preserve relative paths.

## Scope Verification

Content changes are present under `apps/api/app/content/math`.

The working tree also contains unrelated frontend/backend/config/doc changes from prior Beta tasks, so Git status alone cannot prove OpenClaw only touched content. The Round 1 backup folder and observed content edits are limited to math content.

No review edits were made to:

- frontend logic
- backend logic
- auth/register/login
- Stripe
- quiz/test scoring logic

## JSON Validation

- Active non-backup JSON under `apps/api/app/content/math`: **183 files checked, 0 invalid**
- All JSON including backup folders: **234 files checked, 2 invalid**

Invalid files are in an older backup folder, not the active lesson content:

- `backup_miniquiz_round2/g2_add_two_digit.json`
- `backup_miniquiz_round2/g2_subtract_two_digit.json`

## Replacement Character / Encoding Check

- U+FFFD replacement character count: **0**
- Forbidden fragments checked: `缺`, `ปล้ำ`
- Result: **not found**

However, new garbled or unnatural Thai was found in active Grade 2 content. Examples:

- `g2_subtract_two_digit`: `พี่อลิสงเรียนมีนักเรียน...`
- `g2_time_calendar`: `พี่อลิสงเรียนปิดภาคเรียน...`
- `g2_times_table_2_5_10`: `พี่อลิสงเรียนมีห้องเรียน 5 ห้อง ห้องละ 2 พัดธุ์ รวมพัดธุ์กี่อัน?`
- `g2_times_table_2_5_10`: repeated phrases like `พี่อลิสลังผลไม้`, `พี่อลิสกล่องของเล่น`, `พี่อลิสแถวเก้าอี้`

## Mini Quiz Validation

Grade 1 mini-quiz blocks reviewed:

- Structural checks passed for the edited Grade 1 lesson mini quizzes.
- No arithmetic mismatch found in the sampled/parsed Grade 1 mini quiz answers.

Grade 2 mini-quiz issues found:

- `g2_subtract_two_digit`: several quiz variants ask `87 - 43 = ?` but mark `87` as the answer. Correct answer is `44`.
- `g2_multiplication_intro`: variants 7-9 have `answer: "3"` while `correct_answer` is `24 ลูก`, `20 แท่ง`, or `24 ผล`. This can break feedback depending on which field the renderer/checker uses.
- `g2_add_two_digit`: variants 7-9 include extra questions such as `67 + 21 = ?` and `53 + 46 = ?` without choices or answers.
- `g2_money_change`: variants 7-9 include extra question `ซื้อของ 44 บาท จ่าย 100 บาท ได้เงินทอนกี่บาท?` without choices or answer.
- `g2_multiplication_intro`: variants 7-9 include extra questions `5 × 6 = ?` and `2 × 7 = ?` without choices or answers.
- `g2_shapes_2d`, `g2_time_calendar`, and `g2_times_table_2_5_10` also include extra incomplete questions in later variants.

Pay-special-attention result:

- `g1_money_basic`: no blocking arithmetic issue found in reviewed mini quiz content.
- `g1_subtract_within_20`: no blocking arithmetic issue found in reviewed mini quiz content.
- `g2_money_change`: incomplete extra question(s) found.
- `g2_multiplication_intro`: answer/correct_answer mismatch found.

## Teaching Quality Review

Not approved as-is.

Main concerns:

- “พี่อลิส” context is overused and sometimes grammatically broken.
- Several story intros are unnatural Thai due missing verbs or corrupted noun phrases.
- EP/Alice usage is not clean enough for Beta in the affected Grade 2 lessons.
- No Chinese fragment `缺` and no report-only wording `ปล้ำ` found.

## Beta Gating Regression

API checks passed:

- `/health` returned `{"status":"ok"}`
- Login API worked with `demo@4-craft.com / demo1234`
- `/me/lessons` returned Grade 1-3 only across current/review lesson lists
- Grade 4+ count in `/me/lessons`: `0`
- Direct Grade 4/5/6 lesson IDs checked returned `404`
- At least 3 edited Grade 1 lessons returned `200`
- At least 3 edited Grade 2 lessons returned `200`
- At least 3 Grade 3 lessons returned `200`

Frontend HTTP route checks on `http://localhost:3000`:

- `/`: `200`
- `/login`: `200`
- `/lessons`: `200`
- `/dashboard`: `200`

The in-app browser backend was unavailable in this session, so UI clicking was not performed. Route/API smoke checks were completed with local HTTP requests.

## Test Feedback Smoke

Lesson test feedback endpoint was checked through the local API:

- Started a Grade 3 lesson test session.
- Submitted an incorrect answer and received `is_correct: false`.
- Submitted the correct answer and received `is_correct: true`.

This confirms the answer checking path still responds correctly. Quiz/test scoring logic was not modified.

## Remaining Fixes Needed

Before keeping these content changes for closed Beta:

- Fix malformed Grade 2 story intro text, especially `พี่อลิสงเรียน`, missing verbs after `พี่อลิส`, and `พัดธุ์`.
- Fix `g2_subtract_two_digit` wrong mini-quiz answer for `87 - 43 = ?`.
- Fix `g2_multiplication_intro` `answer` vs `correct_answer` mismatches.
- Remove or complete extra mini-quiz questions that have text only but no choices/answers.
- Re-run active JSON validation and mini-quiz validation after content fixes.

## Safe For Beta?

**No.** The platform gating and answer-checking logic look stable, but the Round 1 content changes contain visible teaching-quality defects and mini-quiz correctness issues in Grade 2 content that is accessible during Beta.
