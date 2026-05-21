# Beta Readiness Fix Report

Date: 2026-05-13

## Summary

Prepared the lesson experience for closed Beta by gating incomplete or not-yet-ready lesson content. Grades 1-3 remain visible when they have renderable lesson blocks. Grades 4, 5, and 6 are not exposed as clickable lesson links and are shown as Coming Soon in the frontend lesson surfaces.

## Files Changed

- `apps/api/app/routers/me.py`
- `apps/web/src/lib/api/me.ts`
- `apps/web/src/app/lessons/page.tsx`
- `apps/web/src/app/dashboard/page.tsx`
- `apps/web/src/app/dashboard/lessons/[lessonId]/page.tsx`
- `docs/BETA_READINESS_FIX_REPORT.md`

## Lessons Hidden Or Marked Coming Soon

Visible for Beta:

- Grade 1: `g1_add_within_20`, `g1_compare_numbers`, `g1_counting_numbers`, `g1_money_basic`, `g1_shapes_basic`, `g1_subtract_within_20`, `g1_time_basic`
- Grade 2: `g2_add_two_digit`, `g2_money_change`, `g2_multiplication_intro`, `g2_shapes_2d`, `g2_subtract_two_digit`, `g2_time_calendar`, `g2_times_table_2_5_10`
- Grade 3: `g3_area_intro`, `g3_division_intro`, `g3_fractions_intro`, `g3_measurement`, `g3_mixed_review`, `g3_multi_step_word_problems`, `g3_multiplication_area_model_ep`, `g3_multiplication_area_model_thp`, `g3_multiplication_multi_digit`

Hidden from API lesson links and shown as Coming Soon in frontend grade tabs/cards:

- Grade 4: `g4_angles_geometry`, `g4_area_perimeter`, `g4_decimals_intro`, `g4_fractions`, `g4_large_numbers`, `g4_multi_digit_operations`, `g4_word_problems`
- Grade 5: `g5_data_graphs`, `g5_decimals`, `g5_fraction_operations`, `g5_multi_step_word_problems`, `g5_percent_intro`, `g5_ratio_intro`, `g5_volume_area`
- Grade 6: `g6_equations_intro`, `g6_fraction_decimal_percent`, `g6_gcf_lcm`, `g6_geometry`, `g6_middle_school_prep`, `g6_ratio_proportion`, `g6_volume`

Note: duplicate Grade 4 lesson JSON files under `grade_2/lessons` are also gated because their payload `grade_level` is 4.

## Routes Tested

Build/lint:

- `node -v`: `v24.14.0`
- `npm run lint`: passed (`tsc --noEmit`)
- `npm run build`: passed. Next reported an existing ESLint option warning, but the build exited successfully.
- `python -m py_compile app/routers/me.py`: passed

Patched validation servers:

- Backend: `http://127.0.0.1:8002`
- Frontend: `http://localhost:3001`

Routes checked on patched frontend:

- `/`: 200
- `/register`: 200
- `/login`: 200
- `/dashboard`: 200
- `/lessons`: 200

Lesson/API checks on patched backend:

- `/health`: `{"status":"ok"}`
- `/me/lessons`: returned 22 lessons, grades `1,2,3` only
- Working lessons checked: `g1_add_within_20`, `g1_compare_numbers`, `g1_counting_numbers`; each returned 5 renderable visual blocks
- Direct Grade 4 lesson check: `/me/lessons/g4_large_numbers` returned 404
- Grade 3 lesson test flow: `/me/lessons/g3_area_intro/test/start` returned a session with 10 questions; `/me/tests/{session_id}/submit` accepted a question submit and returned answer-check metadata

Current requested local ports:

- `http://127.0.0.1:8001/health` returned `{"status":"ok"}`
- `http://localhost:3000/register` and `/lessons` returned 200
- `http://localhost:3000/`, `/login`, and `/dashboard` returned 500 from a pre-existing Node process that this session could not terminate due access denied, so patched frontend validation was completed on `3001`

## Quiz/Test Logic Confirmation

Quiz/test scoring logic was not modified.

Backend answer checking logic was not modified.

Stripe/billing logic was not modified.

No `npm audit fix --force` was run.

## Remaining Blockers Before Online Beta

- Restart the live local `3000` frontend and `8001` backend processes with the patched code. The current `3000` process is stale and partially returns 500.
- Decide whether to remove or relocate the duplicate Grade 4 JSON files currently present under `apps/api/app/content/math/grade_2/lessons`.
- Finish content QA for Grades 4-6 before exposing those lesson links.
- Resolve the Next/ESLint version warning shown during `next build`.
