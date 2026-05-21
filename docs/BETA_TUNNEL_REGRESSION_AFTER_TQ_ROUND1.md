# Beta Tunnel Regression After Teaching Quality Round 1

Date: 2026-05-15

Decision: **NOT_READY**

## Scope

Post-content-update Cloudflare Tunnel Beta regression test for:

- Frontend: `https://beta.topamath.com`
- Backend API: `https://api-beta.topamath.com`

Test-only pass. No code, content, scoring logic, backend logic, frontend logic, or Stripe logic was changed.

Reference report:

- `docs/TEACHING_QUALITY_ROUND1_REVIEW_REPORT.md`

## Environment / Test Method

The in-app browser backend was unavailable in this session, so full click-through UI automation could not be performed. Validation used:

- Public HTTPS route checks
- Public beta API checks
- Authenticated lesson payload checks against the same API used by the frontend
- Simulation of the current frontend mini-quiz display/feedback logic from `dashboard/lessons/[lessonId]`

## Public Endpoint Checks

- `https://api-beta.topamath.com/health`: `200`, returned `{"status":"ok"}`
- `https://beta.topamath.com/`: `200`
- `https://beta.topamath.com/register`: `200`
- `https://beta.topamath.com/login`: `200`
- `https://beta.topamath.com/dashboard`: `200`
- `https://beta.topamath.com/lessons`: `200`

No HTTP 500 text was detected on the checked frontend routes.

## Auth Checks

- Register API worked using a generated beta regression account.
- Login API worked with `demo@4-craft.com / demo1234`.
- Dashboard API loaded successfully for the demo account.

## Beta Gating Checks

Authenticated `/me/lessons` result:

- Total visible lesson entries across current/review lists: `44`
- Visible grades: `1, 2, 3`
- Grade 4+ visible lesson count: `0`
- Empty lesson ID count: `0`

Direct gating checks:

- `g4_fraction_equivalence`: `404`
- `g5_decimal_place_value`: `404`
- `g6_ratio_intro`: `404`

Result: Grade 4-6 remain gated/hidden at API level.

## Edited Lesson Regression Results

Legend:

- Story: story intro block available and expected to render text.
- Visual/model: a frontend-allowed visual/model block exists.
- Sentence: number sentence block exists.
- Mini-quiz: mini-quiz block exists.
- Feedback: current frontend mini-quiz logic can render choices and distinguish correct/wrong choices.

| Lesson | Story | Visual/model | Sentence | Mini-quiz | Feedback |
|---|---:|---:|---:|---:|---:|
| `g1_add_within_20` | Pass | **Fail** | Pass | Pass | Pass |
| `g1_compare_numbers` | Pass | **Fail** | Pass | Pass | Pass |
| `g1_subtract_within_20` | Pass | **Fail** | Pass | Pass | Pass |
| `g2_money_change` | **Fail** | **Fail** | Pass | Pass | **Fail** |
| `g2_multiplication_intro` | **Fail** | Pass | Pass | Pass | **Fail** |
| `g3_area_intro` | Pass | Pass | Pass | Pass | Pass |
| `g3_division_intro` | Pass | Pass | Pass | Pass | Pass |

## Blocking Issues

1. Grade 1 visual/model blocks use custom block types that are not in the current frontend allowed/rendered block list:

- `addition_grouping`
- `number_comparison`
- `subtraction_grouping`

These are filtered out, so the required visual/model block does not display.

2. `g2_money_change` uses `money_visual`, which is not in the current frontend allowed/rendered block list.

This visual/model block is filtered out.

3. `g2_money_change` and `g2_multiplication_intro` mini quizzes use nested `data.questions`.

The current frontend mini-quiz renderer reads root-level `choices`, `answer`, and `correct_answer`, not nested `data.questions`. Result: the mini-quiz card may exist, but choices/feedback are not usable for those affected blocks.

4. Some Grade 2 story intro payloads are nested in `data` rather than normalized to root `content`/`description_th`/`label`.

The current story renderer displays `block.content || block.description_th || block.label`, so affected story intro cards can render blank even when the API payload contains text inside `data`.

5. Known Teaching Quality Round 1 content issues remain from the prior review.

The previous report already found malformed/awkward Grade 2 Thai and mini-quiz correctness defects. This public tunnel regression confirms those changes are not safe for testers yet.

## Test Feedback Endpoint

Backend lesson-test feedback endpoint still works:

- Started a `g3_area_intro` lesson test session.
- Correct answer submission returned `is_correct: true`.
- Wrong answer submission returned `is_correct: false`.

This confirms the backend answer checking path is still functioning. Quiz/test scoring logic was not changed.

## Ready Decision

**NOT_READY**

The public beta tunnel and auth surface are alive, and Grade 4-6 gating is intact. However, several edited Grade 1-2 lessons fail required lesson UI checks after the content update:

- visual/model blocks missing due unsupported block types
- Grade 2 story intros can render blank
- Grade 2 mini-quiz choices/feedback can be unusable

Do not send this build/content set to external testers until the content schema is normalized or the frontend renderer supports these block shapes.
