# Replacement Character Cleanup Review Report

## Review Scope
- Project: `D:\web app\4-craft.com`
- Content reviewed: `D:\web app\4-craft.com\apps\api\app\content\math`
- Cleanup report expected: `D:\web app\4-craft.com\docs\REPLACEMENT_CHARACTER_CLEANUP_REPORT.md`
- Review report created: `D:\web app\4-craft.com\docs\REPLACEMENT_CHARACTER_REVIEW_REPORT.md`
- Review date/time: 2026-05-11, Asia/Bangkok
- Review mode: inspect and report only. No content, frontend, backend, Stripe, or schema files were rewritten.

## Executive Result
| Check | Result | Evidence |
|---|---:|---|
| All math JSON files parse | PASS | 176 JSON files checked, 176 valid, 0 invalid |
| Remaining replacement characters counted | FAIL | 4,450 `�` characters remain across 135 JSON files |
| OpenClaw cleanup report present | FAIL | `docs\REPLACEMENT_CHARACTER_CLEANUP_REPORT.md` was not found |
| Confirm unrelated lessons were not rewritten | INCONCLUSIVE | Project is not a Git repository, and cleanup report manifest is missing |
| Confirm frontend/backend/Stripe files were unchanged | INCONCLUSIVE | No Git history/diff available; timestamp scan shows recent non-content changes but cannot attribute them to OpenClaw |

## JSON Parse Validation
| Metric | Count | Status |
|---|---:|---|
| JSON files scanned under content math | 176 | PASS |
| Valid JSON files | 176 | PASS |
| Invalid JSON files | 0 | PASS |

## Remaining Replacement Characters
| Metric | Count | Status |
|---|---:|---|
| Total remaining `�` characters | 4,450 | FAIL |
| Files containing `�` | 135 | FAIL |

## Example Files Still Containing Replacement Characters
| File | Count | Example Context |
|---|---:|---|
| `apps\api\app\content\math\curriculum\grade_1\curriculum_map.json` | 4 | `7 + ? = 10` |
| `apps\api\app\content\math\curriculum\grade_2\curriculum_map.json` | 1 | `20÷5 ต้องหาว่า 5×?=20` |
| `apps\api\app\content\math\curriculum\grade_3\curriculum_map.json` | 8 | Thai/math prompt text containing `?` placeholders |
| `apps\api\app\content\math\curriculum\grade_4\curriculum_map.json` | 1 | `45,678+23,456 = ?` |
| `apps\api\app\content\math\curriculum\grade_5\curriculum_map.json` | 3 | `75% = ?/100 = ?/4 = ?` |
| `apps\api\app\content\math\curriculum\math_curriculum_p1_p6_singapore_style.json` | 1 | `8 + 7 = ?` |
| `apps\api\app\content\math\g1\lessons\g1_add_one_digit.json` | 1 | Lesson content still includes replacement-character evidence |
| `apps\api\app\content\math\g1\lessons\g1_compare_numbers.json` | 2 | Lesson content still includes replacement-character evidence |
| `apps\api\app\content\math\g1\quests.json` | 8 | Quest content still includes replacement-character evidence |
| `apps\api\app\content\math\g1\quizzes\g1_add_one_digit.json` | 22 | Quiz content still includes replacement-character evidence |
| `apps\api\app\content\math\g4\quizzes\g4_data_graphs.json` | 22 | Quiz content still includes replacement-character evidence |

## Cleanup Report Requirements
| Required Report Item | Result | Notes |
|---|---:|---|
| Files scanned | FAIL | Cleanup report file is missing |
| Files fixed | FAIL | Cleanup report file is missing |
| Files needing rewrite | FAIL | Cleanup report file is missing |
| Before/after examples | FAIL | Cleanup report file is missing |
| Remaining count of `�` | FAIL | Cleanup report file is missing; independent review found 4,450 remaining |

## Scope Review
| Check | Result | Notes |
|---|---:|---|
| Did not rewrite unrelated lessons | INCONCLUSIVE | No Git repository was available, so there is no reliable diff baseline. Cleanup report manifest is also missing. |
| Did not change frontend files | INCONCLUSIVE | Recent frontend files exist, including `apps\web\package.json`, `apps\web\package-lock.json`, `apps\web\src\app\dashboard\lessons\[lessonId]\page.tsx`, and generated `apps\web\tsconfig.tsbuildinfo`. These cannot be attributed from available evidence. |
| Did not change backend files | INCONCLUSIVE | Recent backend-area files exist, including analysis/fix scripts and `apps\api\adaptive_learning.db`. These cannot be attributed from available evidence. |
| Did not change Stripe/billing files | INCONCLUSIVE | Stripe/billing files exist with prior timestamps, including `apps\web\src\lib\api\billing.ts`, `apps\web\src\app\billing\page.tsx`, and `apps\api\app\routers\billing.py`. No diff baseline is available. |

## Suspicious Fixes / Manual Review Needed
| Severity | Area | Issue | Evidence | Recommended Owner |
|---|---|---|---|---|
| High | Cleanup evidence | The expected cleanup report is missing entirely. | `docs\REPLACEMENT_CHARACTER_CLEANUP_REPORT.md` was not found. | OpenClaw |
| High | Content cleanup | Replacement-character cleanup appears incomplete. | 4,450 `�` characters remain across 135 JSON files. | OpenClaw |
| Medium | Content correctness | Several remaining examples appear inside math prompts, quiz text, or Thai lesson text where replacing `�` with `?` may be ambiguous. | Curriculum and quiz examples still contain question-mark style placeholders and replacement-character evidence. | OpenClaw |
| Medium | Scope control | It cannot be confirmed that unrelated lessons were untouched. | No Git repository and no cleanup manifest were available for comparison. | OpenClaw |
| Medium | App scope | It cannot be confirmed that frontend, backend, or Stripe files were untouched. | Timestamp scan shows recent non-content files, but attribution is not possible without Git/report evidence. | Codex |

## Recommended Follow-Up
1. OpenClaw should provide or recreate `docs\REPLACEMENT_CHARACTER_CLEANUP_REPORT.md` with scanned files, fixed files, files needing rewrite, before/after examples, and remaining `�` count.
2. OpenClaw should run a focused second cleanup pass or explicitly mark the 135 remaining files as needing manual rewrite.
3. Codex should review a proper diff or manifest before accepting the cleanup as scoped, especially around frontend/backend/Stripe and unrelated lesson files.

## Final Review Status
The cleanup cannot be approved from the current evidence. JSON validity is intact, but the cleanup report is missing and 4,450 replacement characters remain.
