# Grade 3 Addition/Subtraction Renderer Mapping Cleanup Report

## 1. Source JSON File Confirmed

- Target lesson group: `g3_addition_subtraction`
- Program: `TH`
- Topic folder: `addition_subtraction`
- Selected variant: `add_sub_th_001`
- Confirmed source file:
  `apps/api/app/content/math/grade_3/lessons/TH/addition_subtraction/add_sub_th_001.json`
- Student API response does not expose `source_path`; source diagnostics stay in backend logs and admin surfaces.

## 2. JSON-to-UI Mapping Doc Created

Created:

- `docs/G3_ADDITION_SUBTRACTION_JSON_TO_UI_MAP.md`

The document maps each pilot UI section to its JSON source path, expected type, example value, fallback behavior, and required/optional status.

## 3. Template Doc Created

Created:

- `docs/LESSON_JSON_TEMPLATE_GRADE_TOPIC_VARIANT.md`

The template defines the recommended grade/topic/variant JSON shape for future TH and EP lessons, including folder placement, naming, renderer usage, admin approval, and quiz pairing.

## 4. Renderer Cleanup Done

Updated the Grade 3 pilot renderer so the reusable section mapping is clearer:

- Header reads normalized lesson metadata.
- Story section maps from canonical story content.
- Think section maps from `think_story`.
- Model diagram maps from `model_diagram`.
- Number sentence maps from structured operation data.
- Practice mini quiz maps from `practice`.
- Test button state maps from `test_available` and `test_unavailable_reason`.

## 5. Unused Code Hidden/Removed

Cleanup focused on the pilot path without deleting branches that may still be needed by older lessons:

- Removed the unreachable duplicate visual-thinking branch from the main render flow.
- Hid empty mini-quiz placeholders when no choices exist.
- Kept legacy/fallback handling isolated behind helper functions.
- Replaced broken/mojibake display fallbacks with clean Thai labels.
- Student UI does not display debug-only source paths.

## 6. Normalized View Model Summary

The API now returns a `lesson_view_model` alongside existing compatibility fields:

```json
{
  "lesson_group_id": "g3_addition_subtraction",
  "selected_variant_id": "add_sub_th_001",
  "grade_level": 3,
  "program_type": "TH",
  "topic_folder": "addition_subtraction",
  "title": "...",
  "subtitle": "...",
  "icon": "...",
  "mascot_helper": {
    "mascot_id": null,
    "mascot_name": null,
    "image_src": null,
    "title": null,
    "tip": "..."
  },
  "story_label": "...",
  "story": "...",
  "think_story": "...",
  "model_diagram": { "...": "..." },
  "number_sentence": {
    "steps": ["..."],
    "final_answer": "...",
    "unit": "..."
  },
  "practice": {
    "question": "...",
    "choices": ["A", "B", "C", "D"],
    "correct_answer": "...",
    "explanation": "..."
  },
  "test_available": false,
  "test_unavailable_reason": "ยังไม่มีแบบทดสอบที่อนุมัติสำหรับบทนี้"
}
```

Existing fields such as `lesson_id`, `title`, `story`, `think_story`, `practice`, and `test_available` are preserved for current dashboard/detail compatibility.

## 7. Admin Diagnostics

Updated Grade 3 admin lesson rows to expose:

- `source_path`
- `source_folder`
- `selected_variant_id`
- `variant_status`
- `section_completeness`
- `variant_count`
- `approved_variant_count`
- `variant_files`

For `g3_addition_subtraction`, local service validation shows:

```json
{
  "header": true,
  "mascot_helper": true,
  "story": true,
  "think_story": true,
  "model_diagram": true,
  "number_sentence": true,
  "practice": true
}
```

## 8. Browser Validation Result

Browser validation for:

`https://topamath.com/dashboard/lessons/g3_addition_subtraction?program_type=TH`

Confirmed:

- title renders correctly
- mascot helper remains large
- story, think story, model diagram, number sentence, and practice render
- practice feedback works after selecting an answer
- test unavailable reason is visible when no approved quiz is connected
- no `????????????`
- no `ðYY¦`
- no student-facing source path

Screenshot artifact:

- `docs/g3_addition_subtraction_mapping_cleanup.png`

## 9. Build And API Validation

Completed:

- `python -m py_compile apps\api\app\routers\me.py apps\api\app\routers\admin.py apps\api\app\services\lesson_content.py`
- `npm run lint`
- `npm run build`
- `docker compose --env-file .env.docker -f docker-compose.beta.yml build 4craft-api 4craft-web`
- `docker compose --env-file .env.docker -f docker-compose.beta.yml up -d 4craft-api 4craft-web`
- Docker health: `4craft-api` healthy, `4craft-web` healthy.
- Local service check: Grade 3 TH lesson count is `11`.
- Local service check: `g3_addition_subtraction` source path resolves to the target JSON.
- API check: `GET /me/lessons/g3_addition_subtraction?program_type=TH` returns `lesson_view_model`, `topic_folder=addition_subtraction`, `selected_variant_id=add_sub_th_001`, and no student-facing `source_path`.

Additional build/runtime checks are recorded in the final handoff if they are rerun after this report.

## 10. Remaining Limitations

- The renderer cleanup is intentionally scoped to the Grade 3 TH `addition_subtraction` pilot.
- Legacy lesson rendering helpers remain available for non-pilot lessons until those lessons are migrated.
- EP lessons were not changed.
- Lesson JSON content was not rewritten.
- Approval/edit actions continue to use the existing admin status workflow.

## 11. Final Decision

READY_RENDERER_TEMPLATE_FOR_GRADE_3
