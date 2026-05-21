# Grade 4-6 Enable Report

Date: 2026-05-16

Revalidated: 2026-05-16 11:30 ICT

## Decision

READY_FOR_CLOUDFLARE_TUNNEL_BETA

Grade 4-6 Thai lessons are enabled only when the backend content-quality gate considers the lesson publishable and the lesson has displayable visual blocks. Invalid EP lesson files remain unavailable; EP requests fall back to the valid Thai lesson when available.

## Files Changed

- `apps/api/app/routers/me.py`
- `apps/web/src/app/lessons/page.tsx`
- `apps/web/src/app/dashboard/lessons/[lessonId]/page.tsx`
- `apps/web/src/lib/api/me.ts`

## Behavior Implemented

- `/me/lessons` now returns beta-visible Grades 1-6 JSON lessons when content is displayable and publishable.
- Grade 4-6 lessons are readable in closed beta without exposing empty lesson pages.
- Future-grade JSON lessons are included in lesson access checks so direct Grade 4-6 lesson URLs can open.
- `has_test` is now true only when lesson/quiz content has enough valid question records.
- If `has_test` is false, the lesson page keeps the lesson readable and shows a disabled QA message instead of a test button.
- EP toggle no longer exposes invalid EP content. If EP content is invalid or missing but TH content is valid, the API returns TH content with `ep_fallback: true`.
- Area/model diagram rendering no longer falls back to a misleading default total; it shows the actual total/unit when available and falls back to text when dimensions are not safe.

## Grade Tab Switching

The `/lessons` page uses a single `selectedGrade` number state.

Visible cards are derived with:

```ts
lessons
  .filter((lesson) => Number(lesson.grade_level) === selectedGrade)
  .filter(isReadyLesson)
```

Selecting a grade replaces the selected grade via `setSelectedGrade(grade)`, so the UI does not append or merge lessons from previous selections.

## Grade 4-6 Lessons Exposed

Grade 4:

- `g4_angles_geometry`
- `g4_area_perimeter`
- `g4_decimals_intro`
- `g4_fractions`
- `g4_large_numbers`
- `g4_multi_digit_operations`
- `g4_word_problems`

Grade 5:

- `g5_data_graphs`
- `g5_decimals`
- `g5_fraction_operations`
- `g5_multi_step_word_problems`
- `g5_percent_intro`
- `g5_ratio_intro`
- `g5_volume_area`

Grade 6:

- `g6_equations_intro`
- `g6_fraction_decimal_percent`
- `g6_gcf_lcm`
- `g6_geometry`
- `g6_middle_school_prep`
- `g6_ratio_proportion`
- `g6_volume`

Invalid EP files are not exposed as native EP lessons in this pass.

## Validation Results

Static validation:

- `python -m py_compile apps/api/app/routers/me.py`: PASS
- `npm run lint`: PASS
- `npm run build`: PASS, with a non-fatal legacy Next/ESLint option warning after successful build output

Latest static revalidation:

- `python -m py_compile apps/api/app/routers/me.py`: PASS
- `npm run lint`: PASS

Content gate validation:

- Grade 4 TH publishable lessons: 7
- Grade 5 TH publishable lessons: 7
- Grade 6 TH publishable lessons: 7
- Grade 4-6 EP files: held back by EP-specific validation issues

Backend API:

- `GET /health`: PASS, `{"status":"ok"}`
- Login `demo@4-craft.com / demo1234`: PASS
- Authenticated `GET /me/lessons`: PASS, returned grades `1:7, 2:7, 3:8, 4:7, 5:7, 6:7`
- Grade 4-6 visible lesson count: 21
- Direct Grade 4-6 API details: PASS for all exposed Grade 4-6 lessons
- `GET /me/lessons/g4_large_numbers?program_type=EP`: PASS, returned valid TH fallback with `ep_fallback: true`

Frontend HTTP checks on `http://localhost:3000`:

- `/lessons`: 200
- `/dashboard/lessons/g4_large_numbers`: 200
- `/dashboard/lessons/g5_decimals`: 200
- `/dashboard/lessons/g6_ratio_proportion`: 200
- No `Server Error`, `ChunkLoadError`, missing chunk marker, or empty lesson text detected in checked routes

Sample tests:

- `g3_area_intro`: start PASS, 10 questions, submit response shape normal
- `g4_large_numbers`: start PASS, 10 questions, submit response shape normal
- `g5_decimals`: start PASS, 10 questions, submit response shape normal
- `g6_ratio_proportion`: start PASS, 10 questions, submit response shape normal

Submit response fields verified:

- `question_id`
- `is_correct`
- `correct_answer`
- `explanation_th`
- `selected_answer_raw`
- `selected_answer_normalized`
- `correct_answer_normalized`

## Browser Validation Note

The Browser Use in-app backend was unavailable in this session, so live click automation for grade tab switching and the TH/EP toggle could not be completed through the browser tool. The route behavior was validated by API/HTTP checks, and the grade-tab switching logic was verified in source.

## Runtime Note

Port 3000 initially returned stale `.next` chunk errors after a production build while the previous dev server process could not be terminated by Windows. Clearing `apps/web/.next` allowed the running dev server to regenerate cleanly. Final checks on port 3000 returned 200 for the tested routes.

## Remaining Risks

- EP Grade 4-6 content needs a separate EP content QA pass before being exposed as real EP lessons.
- Full visual click-through QA should be repeated in a browser session once the in-app browser backend is available.
