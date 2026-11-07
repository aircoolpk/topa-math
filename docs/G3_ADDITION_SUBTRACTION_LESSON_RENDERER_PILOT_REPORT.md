# Grade 3 Addition/Subtraction Lesson Renderer Pilot Report

## 1. Source File Confirmed

- Target route: `https://topamath.com/dashboard/lessons/g3_addition_subtraction?program_type=TH`
- Confirmed canonical loader source:
  `apps/api/app/content/math/grade_3/lessons/TH/addition_subtraction/add_sub_th_001.json`
- Confirmed selected metadata:
  - `lesson_group_id`: `g3_addition_subtraction`
  - `program_type`: `TH`
  - `topic_folder`: `addition_subtraction`
  - `selected_variant_id`: `add_sub_th_001`
- Backend log now emits:
  `grade3_lesson_variant_selected lesson_group_id=... program_type=... topic_folder=... selected_variant_id=... source_path=...`
- Student API response does not expose `source_path`.

## 2. API Fields Mapped

`GET /me/lessons/g3_addition_subtraction?program_type=TH` now returns first-class fields for:

- `lesson_group_id`
- `topic_folder`
- `selected_variant_id`
- `grade_level`
- `program_type`
- `title`
- `subtitle`
- `icon`
- `helper_tip`
- `story`
- `think_story`
- `model_diagram`
- `number_sentence`
- `practice`
- `test_available`
- `test_unavailable_reason`

Existing compatibility fields remain intact, including `lesson_id`, `title_th`, `visual_blocks`, `has_test`, and `has_approved_test`.

## 3. Frontend Sections Rendered

Pilot renderer now cleanly renders:

- Header with ป.3 badge and lesson title
- Mascot helper card
- เรื่องราว
- เรื่องราวชวนคิด
- ใช้แผนภาพช่วยคิด
- เขียนเป็นประโยควิธีทำ
- ลองทำดู mini quiz
- Test button unavailable state

## 4. Mascot Helper Changes

- Uses the existing TOPA mascot registry.
- Deterministically selects one of 9 mascots by lesson id and date to avoid hydration mismatch.
- Mascot name matches image.
- Desktop mascot size is about 300x300 px.
- Mobile size scales down to about 176-224 px.
- Helper title renders as `{MascotName} แนะนำวันนี้`.
- Helper tip text comes from JSON `helper_tip`.

## 5. Broken Heading / Mojibake Fixes

- Replaced the broken `???????????????` think-story label with `เรื่องราวชวนคิด`.
- Added text sanitization to avoid rendering `undefined`, `null`, or `[object Object]`.
- Browser validation found no `????????` and no mojibake markers.

## 6. Model Diagram Rendering Result

- Added a renderer for `part_whole_bar`.
- The model shows:
  - Lin + Mali amount bars
  - Total money
  - Expense subtraction
  - Remaining money
- It uses the numbers and labels from `add_sub_th_001.json`.
- It no longer falls back to “แผนภาพยังไม่มีข้อมูล...”.

## 7. Practice Mini Quiz Result

- The JSON mini quiz renders as selectable choices.
- Selecting the correct answer shows success feedback.
- Explanation from JSON is displayed after answer selection.

## 8. Test Button Result

- `test_available` is currently `false`.
- The page shows the disabled reason:
  `ยังไม่มีแบบทดสอบที่อนุมัติสำหรับบทนี้`
- Test start/scoring logic was not changed.

## 9. Screenshot / Browser Validation Notes

Browser validation was run against:
`https://topamath.com/dashboard/lessons/g3_addition_subtraction?program_type=TH`

Observed checks:

- Title rendered: pass
- Mascot helper title rendered: pass
- Story sections rendered: pass
- `เรื่องราวชวนคิด` heading rendered: pass
- Model diagram rendered: pass
- Number sentence rendered step-by-step: pass
- Practice choices rendered: pass
- Practice feedback worked after selection: pass
- Disabled test reason rendered: pass
- No `????????`: pass
- No mojibake markers: pass

Screenshot artifact:
`docs/g3_addition_subtraction_pilot.png`

## 10. Files Changed

- `apps/api/app/routers/me.py`
- `apps/web/src/app/dashboard/lessons/[lessonId]/page.tsx`
- `apps/web/src/lib/api/me.ts`
- `docs/G3_ADDITION_SUBTRACTION_LESSON_RENDERER_PILOT_REPORT.md`
- `docs/g3_addition_subtraction_pilot.png`

No Grade 3 lesson JSON files were edited by this pilot.

## 11. Validation Commands

- `python -m py_compile apps\api\app\routers\me.py apps\api\app\services\lesson_content.py`
- `npm run lint`
- `npm run build`
- `docker compose --env-file .env.docker -f docker-compose.beta.yml build 4craft-api 4craft-web`
- `docker compose --env-file .env.docker -f docker-compose.beta.yml up -d 4craft-api 4craft-web`
- `docker compose --env-file .env.docker -f docker-compose.beta.yml ps 4craft-api 4craft-web`

Results:

- Python compile: pass
- TypeScript lint: pass
- Next build: pass
- Docker beta API/web build: pass
- API health: healthy
- Web health: healthy

Note: `next build` still prints an existing Next/ESLint option warning, but the build exits successfully and `npm run lint` passes.

## 12. Remaining Limitations

- The improved renderer is validated only for the Grade 3 TH `addition_subtraction` pilot.
- Other Grade 3 topic shapes still need separate renderer validation.
- EP rendering was not touched.
- Quiz/test pairing was not changed; this lesson currently has no approved quiz connected.
- The local beta database now contains a temporary validation user created for authenticated browser/API testing.

## 13. Final Decision

READY_G3_ADDITION_SUBTRACTION_RENDERER_PILOT
