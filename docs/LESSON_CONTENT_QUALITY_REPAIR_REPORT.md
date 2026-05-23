# Lesson Content Quality Repair Report

Date: 2026-05-23

## 1. Lessons scanned

- Canonical lesson files scanned: 87
- Canonical quiz files scanned: 87
- Paths scanned only:
  - `apps/api/app/content/math/grade_[1-6]/lessons`
  - `apps/api/app/content/math/grade_[1-6]/quizzes`

## 2. Lessons repaired

- Lessons repaired: 87
- Quiz/test files repaired: 87
- Backup created before writes:
  - `apps/api/app/content/_content_backups/20260523_125717_lesson_quality_repair`

## 3. Duplicate stories found/fixed

- Baseline duplicate story/template flags: 237
- Final duplicate story/template flags: 0
- Repair approach: rewrote lesson variants with topic-specific daily-life story contexts, exact story numbers, matching think story, model, number sentence, and practice.

## 4. Generic practices found/fixed

- Baseline generic practice flags: 108
- Final generic practice flags: 0
- Generic “ถ้าเปลี่ยนจำนวนเป็น...” style prompts were replaced with mini word problems, 4 choices, answer key, and explanation.

## 5. Model mismatches found/fixed

- Baseline model mismatch flags: 18
- Final model mismatch flags: 0
- Model diagrams now carry matching numeric fields and context-aware model types such as `equal_groups`, `money_change`, `array_model`, `area_model`, `fraction_model`, `comparison_bar`, `ratio_bar`, `percent_bar`, and `unknown_part_model`.

## 6. Quiz bare equations found/fixed

- Baseline bare equation-only quiz flags: 0 in the dedicated audit, but all 87 quiz files were rewritten to enforce word-problem questions.
- Final bare equation-only quiz flags: 0
- Each quiz now has 10 word-problem questions with 4 choices, correct answer, and explanation.

## 7. TH repaired count

- TH lessons repaired: 43
- TH quiz files repaired: 43
- TH lesson status after repair: `approved`

## 8. EP repaired count / needs_review count

- EP lessons repaired: 44
- EP quiz files repaired: 44
- EP lessons marked `needs_review`: 44
- EP status sidecars were updated so rewritten EP content remains unavailable for student publishing until human review.

## 9. Examples before/after

### Division

- Before: repeated cookie-style story with generic practice and mismatched model fields.
- After: story, think story, equal-groups model, number sentence, practice, and quiz all use the same division concept and exact numbers. Example number sentence: `30 ÷ 5 = 6 ชิ้น`.

### Money Change

- Before: story template and model could be unrelated to the money context.
- After: story uses a child paying with money, model uses `money_change`, and number sentence matches the same values. Example: `40 - 17 = 23 บาท`.

### EP Ratio

- Before: EP fields could contain Thai text and repeated translated templates.
- After: EP story is simple English, `_en` fields contain English only, and status remains `needs_review`. Example: `51:31 = original proportion`.

## 10. Remaining issues

- The running `4craft-api` container was created before the new audit module existed, so `docker exec 4craft-api python -m app.scripts.audit_lesson_content_quality` cannot find the module until the service is recreated from the freshly built image.
- The freshly built API image does pass `python -m app.scripts.audit_lesson_content_quality`.
- Next.js build still prints the existing ESLint option warning about removed options, but exits successfully.
- One existing missing TH/EP pair remains in the admin quality summary; it is a catalog pairing issue, not a content-quality failure in the scanned files.

## 11. Validation

- `python -m app.scripts.audit_lesson_content_quality`: passed, 87 lessons and 87 quizzes, 0 issues.
- `python -m py_compile apps/api/app/scripts/audit_lesson_content_quality.py apps/api/app/scripts/repair_lesson_content_quality.py apps/api/app/services/content_quality.py`: passed.
- `npm run lint` in `apps/web`: passed.
- `npm run build` in `apps/web`: passed.
- `docker compose -f docker-compose.beta.yml build 4craft-api 4craft-web`: passed.
- `docker run --rm 4craft-beta-4craft-api python -m app.scripts.audit_lesson_content_quality`: passed.
- `docker compose -f docker-compose.beta.yml ps`: API and web are running healthy.
- `GET http://localhost:8001/health`: `{"status":"ok"}`.
- `GET http://localhost:3000/dashboard`: HTTP 200.

## Final decision

READY_TH_CONTENT_QUALITY_BETA

READY_EP_ADMIN_REVIEW
