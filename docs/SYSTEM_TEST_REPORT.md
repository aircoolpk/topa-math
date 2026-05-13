# 4-Craft Full System Regression Test Report

Date: 2026-05-13  
Project: `D:\web app\4-craft.com`  
Scope: Verify only. No application code was edited.

## Final Recommendation

**NOT READY**

Frontend build/runtime basics are healthy, login works, and active content data files parse cleanly, but the three requested mini_quiz lesson pages do not render in the browser. The frontend calls `/me/lessons/{lesson_id}` without `program_type`, and the backend returns 404 for all three target lessons unless `?program_type=TH`, `?program_type=THP`, or `?program_type=EP` is supplied. The active mini_quiz schema audit also still has nonzero failures.

## Critical Issues

| Issue | Evidence | Impact |
|---|---|---|
| Target lesson pages fail after login | Browser opened `/dashboard/lessons/g3_area_intro`, `/g3_division_intro`, and `/g3_fractions_intro`; all showed `เกิดข้อผิดพลาด / ไม่พบบทเรียนนี้`. API logs show repeated `GET /me/lessons/{id}` 404. | Blocks required lesson rendering and prevents verifying correct/wrong mini_quiz behavior in the live frontend. |
| Active mini_quiz schema is not normalized | Active grade lesson audit found `155` missing `correct_answer`, `70` answer-only records, `377` duplicate `answer` + `correct_answer`, and `85` missing/non-list choices. | The stated expected status is not met; other lessons may still render broken or inconsistent mini_quiz blocks. |

## High Issues

| Issue | Evidence | Impact |
|---|---|---|
| Program-type routing mismatch | `/me/lessons/g3_area_intro` = 404, but `/me/lessons/g3_area_intro?program_type=TH`, `THP`, and `EP` = 200. Same pattern for division and fractions. | Frontend `meApi.getLesson()` currently does not pass `program_type`, so valid content is unreachable through the tested UI path. |
| Lesson block audit found empty visual-block variants | `9` empty `visual_blocks` variants across active grade lessons, including `grade_3` multiplication area model files and several `grade_5` lessons. | Some variant cycles can produce blank lesson content. |

## Medium Issues

| Issue | Evidence | Impact |
|---|---|---|
| Literal all-file content scan still finds artifacts | Broad scan under `app/content/math` found 2 invalid backup JSON files and replacement bytes in reports/scripts/caches. Active content-data scope is clean. | Not blocking active runtime content, but it conflicts with a literal “all files valid / replacement count 0” interpretation. |
| `next build` emits non-fatal ESLint config warning | `ESLint: Invalid Options: - Unknown options: useEslintrc, extensions`. Build exits 0. | Tooling noise can hide future build warnings. |

## Low Issues

| Issue | Evidence | Impact |
|---|---|---|
| Codex in-app browser backend unavailable | Browser Use `iab` backend could not attach; local Chrome + temporary Playwright outside repo was used instead. | Verification still exercised real Chrome, but not through the in-app browser surface. |
| Prior reports contain mojibake-looking prose | Existing reports display mojibake in PowerShell output. | Documentation readability issue only; live UTF-8 content checks were run directly. |

## Backend Results

| Check | Result | Notes |
|---|---:|---|
| `GET /` | PASS | 200 |
| `GET /health` | PASS | 200 |
| `GET /docs` | PASS | 200 |
| `GET /openapi.json` | PASS | 200 |
| `POST /auth/login` | PASS | 200, token returned for `demo@4-craft.com / demo1234` |
| `GET /me/dashboard` | PASS | 200 with bearer token |
| `GET /me/lessons` | PASS | 200 with bearer token |
| `GET /me/lessons/g3_area_intro` | FAIL | 404 without `program_type`; 200 with `?program_type=TH/THP/EP` |
| `GET /me/lessons/g3_division_intro` | FAIL | 404 without `program_type`; 200 with `?program_type=TH/THP/EP` |
| `GET /me/lessons/g3_fractions_intro` | FAIL | 404 without `program_type`; 200 with `?program_type=TH/THP/EP` |

## Frontend Results

Node runtime: `D:\web app\4-craft.com\.tools\node-v20.20.2-win-x64`  
Node version: `v20.20.2`  
npm version: `10.8.2`

| Check | Result | Notes |
|---|---:|---|
| Dev server stopped before build | PASS | No `3000` listener before lint/build |
| `npm run lint` | PASS | `tsc --noEmit`, exit 0 |
| `npm run build` | PASS WITH WARNING | Exit 0, 22 static pages generated; ESLint warning noted above |
| Dev server restarted | PASS | Next dev ready on port `3000` |

| Route | HTTP Result |
|---|---:|
| `/` | 200 |
| `/register` | 200 |
| `/login` | 200 |
| `/dashboard` | 200 |
| `/lessons` | 200 |
| `/admin` | 200 |
| `/billing` | 200 |

## Browser Results

| Check | Result | Evidence |
|---|---:|---|
| Login with demo account | PASS | Redirected to `/dashboard`; `localStorage.access_token` present; dashboard showed QA student context |
| Open `g3_area_intro` | FAIL | Page showed `เกิดข้อผิดพลาด / ไม่พบบทเรียนนี้` |
| Open `g3_division_intro` | FAIL | Page showed `เกิดข้อผิดพลาด / ไม่พบบทเรียนนี้` |
| Open `g3_fractions_intro` | FAIL | Page showed `เกิดข้อผิดพลาด / ไม่พบบทเรียนนี้` |
| Correct choices are correct | BLOCKED | Quiz UI did not render |
| Wrong choices are wrong | BLOCKED | Quiz UI did not render |
| No Server Error overlay | PASS | No `nextjs-portal`, `Server Error`, `Unhandled Runtime Error`, or `Application error` text |
| No missing `.next` chunk errors | PASS | Fresh dev logs had no missing module, `.next`, chunk, `ChunkLoadError`, `EPERM`, or `ENOENT` matches |

Browser captured 404 API responses for:

```text
http://127.0.0.1:8001/me/lessons/g3_area_intro
http://127.0.0.1:8001/me/lessons/g3_division_intro
http://127.0.0.1:8001/me/lessons/g3_fractions_intro
```

## Content Results

Active content-data scope excludes backup folders, scripts, reports, and caches. It includes active `.json` and `.jsonl` lesson, quiz, curriculum, quest, and question-bank data under `app/content/math`.

| Check | Result | Notes |
|---|---:|---|
| Active JSON validation | PASS | 183 active `.json` files, 0 invalid |
| Active JSONL validation | PASS | 42 `.jsonl` files, 0 invalid lines |
| Active replacement character count | PASS | U+FFFD count 0; raw `EF BF BD` count 0 |
| Literal broad `.json` scan | FAIL IN ARTIFACTS | 211 `.json` files scanned; 2 invalid backup files in `backup_miniquiz_round2` |
| Literal broad replacement scan | FAIL IN ARTIFACTS | Replacement bytes found in non-active reports/scripts/caches |

## Mini Quiz Schema Audit

Scope: active `grade_1` through `grade_6` lesson files.

| Check | Result |
|---|---:|
| Grade lesson files audited | 51 |
| Mini_quiz question records audited | 532 |
| Missing `correct_answer` | 155 |
| Answer-only records | 70 |
| Duplicate `answer` + `correct_answer` | 377 |
| Missing/non-list choices/options | 85 |

Representative samples:

| Issue | Sample |
|---|---|
| Missing `correct_answer` | `app\content\math\grade_2\lessons\g2_add_two_digit.json`, variants 0-9, block 5 |
| Answer-only | `app\content\math\grade_5\lessons\g5_data_graphs.json`, variants 0-9, block 7 |
| Duplicate answer/correct_answer | `app\content\math\grade_1\lessons\g1_add_within_20.json`, variants 0-9, block 4 |
| Missing/non-list choices/options | `app\content\math\grade_2\lessons\g2_add_two_digit.json`, variants 0-9, block 5 |

## Lesson Block Audit

| Check | Result |
|---|---:|
| Active grade lesson files audited | 51 |
| Total visual blocks audited | 2,809 |
| Missing block type | 0 |
| Unknown block types | 0 |
| Lessons with no blocks | 0 |
| Empty `visual_blocks` variants | 9 |

Empty variant samples include:

```text
app\content\math\grade_3\lessons\g3_multiplication_area_model_ep.json variant 1
app\content\math\grade_3\lessons\g3_multiplication_area_model_thp.json variant 2
app\content\math\grade_5\lessons\g5_data_graphs.json variant 10
```

## Recommended Next Step

**NOT READY.**

Fix the lesson detail routing mismatch first so the frontend can load the requested `g3_*_intro` lessons without manually adding `program_type`. Then rerun the browser mini_quiz checks. After that, normalize the remaining active mini_quiz schema issues and rerun the content audit before staging.
