# G3 Add/Sub Field Priority And Comma Render Fix Report

## 1. Root Cause

The pilot renderer and API view-model normalization preferred short top-level fields such as `content`, `question`, and `choices` before richer localized fields under `data`.

For EP story and think blocks, that meant the page could render a short summary such as:

`Lin and Mali save money for a school science camp.`

instead of the full paragraph in `data.content_en`.

The backend mini-quiz normalizer also inferred arithmetic answers and converted comma-formatted choices into bare numeric strings. That removed display formatting such as `23,800 students`.

## 2. Story Field Mapping Fixed

Updated API and frontend story mapping so `story_intro` uses:

- EP: `data.content_en`, then `content_en`, then `data.content`, then `content`
- TH: `data.content_th`, then `content_th`, then `data.content`, then `content`

This prevents the short summary from winning over the full story paragraph.

## 3. Think Story Field Mapping Fixed

Updated API and frontend think-story mapping so `think_story` uses:

- EP: `data.content_en`, then `content_en`, then `data.content`, then `content`
- TH: `data.content_th`, then `content_th`, then `data.content`, then `content`

EP now preserves full text such as `Together 69,000 baht`.

## 4. Mini Quiz Mapping Fixed

Updated mini quiz field selection to prefer localized data fields:

- `question_en` / `question_th` before `question`
- `choices_en` / `choices_th` before `choices`
- `correct_answer_en` / `correct_answer_th` before `correct_answer`
- `explanation_en` / `explanation_th` before `explanation`

The backend normalizer now preserves original choice display strings instead of replacing them with parsed arithmetic values.

## 5. Comma-Safe Rendering Fix

The renderer keeps comma thousands separators as display strings:

- model diagram uses structured `data.bars[*].display`
- mini quiz choices are rendered as authored strings
- internal numeric parsing still removes commas only for calculations/comparisons
- display output keeps values like `45,200`, `23,800`, `69,000`, and `34,800`

No JSON commas were removed.

## 6. Files Changed

- `apps/api/app/services/lesson_content.py`
- `apps/api/app/routers/me.py`
- `apps/web/src/app/dashboard/lessons/[lessonId]/page.tsx`
- `docs/G3_ADDITION_SUBTRACTION_JSON_TO_UI_MAP.md`
- `docs/G3_ADD_SUB_FIELD_PRIORITY_AND_COMMA_RENDER_FIX_REPORT.md`

## 7. EP Validation Result

Validated through local Docker API and browser using a disposable local EP-entitled test user.

Browser page:

`http://localhost:3000/dashboard/lessons/g3_addition_subtraction?program_type=EP`

Confirmed:

- full EP story renders from `data.content_en`
- short EP summary does not replace the full paragraph
- think story renders full `data.content_en`
- mini quiz choices preserve comma thousands separators:
  - `23,800 students`
  - `21,800 students`
  - `24,800 students`
  - `22,800 students`
- no mojibake markers, question-mark headings, or `[object Object]`

Screenshot:

- `docs/g3_add_sub_ep_field_priority_comma_fix.png`

Direct normalization against `add_sub_ep_002.json` also confirmed rich story/think fields and comma-formatted mini-quiz choices are preserved.

## 8. TH Validation Result

Browser page:

`http://localhost:3000/dashboard/lessons/g3_addition_subtraction?program_type=TH`

Confirmed:

- TH story still renders
- comma-formatted lesson numbers render in story/model/sentence areas
- no mojibake markers, question-mark headings, or `[object Object]`

Direct normalization against `add_sub_th_002.json` confirmed:

- full `data.content_th` story is selected
- full `data.content_th` think story is selected
- mini quiz choices preserve comma-formatted strings such as `18,900 ผล`

Screenshot:

- `docs/g3_add_sub_th_field_priority_comma_fix.png`

## 9. Build And Runtime Validation

Completed:

- `python -m py_compile apps\api\app\routers\me.py apps\api\app\services\lesson_content.py`
- `npm run lint`
- `npm run build`
- `docker compose --env-file .env.docker -f docker-compose.beta.yml build 4craft-api 4craft-web`
- `docker compose --env-file .env.docker -f docker-compose.beta.yml up -d 4craft-api 4craft-web`
- Docker health: `4craft-api` healthy, `4craft-web` healthy

## 10. Remaining Limitations

- The Grade 3 topic-folder selector still uses the existing first-active-variant rule. The browser currently loads the first active addition/subtraction variant for each program.
- The `_002` files were validated directly through the same normalizer/rendering data rules, but variant selection was not changed in this task.
- Existing JSON content was not rewritten.
- EP entitlement checks remain enforced; a disposable local validation user was granted EP only in the local Docker database to run the EP page check.

## 11. Final Decision

READY_FIELD_PRIORITY_AND_COMMA_RENDER_FIX
