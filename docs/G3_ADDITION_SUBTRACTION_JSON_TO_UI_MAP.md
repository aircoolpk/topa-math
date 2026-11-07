# Grade 3 Addition/Subtraction JSON to UI Map

Target pages:
`/dashboard/lessons/g3_addition_subtraction?program_type=TH`
`/dashboard/lessons/g3_addition_subtraction?program_type=EP`

Target JSON examples:
`apps/api/app/content/math/grade_3/lessons/TH/addition_subtraction/add_sub_th_001.json`
`apps/api/app/content/math/grade_3/lessons/TH/addition_subtraction/add_sub_th_002.json`
`apps/api/app/content/math/grade_3/lessons/EP/addition_subtraction/add_sub_ep_002.json`

This document maps the Grade 3 addition/subtraction topic-folder variants into the current pilot lesson page. The student API keeps legacy fields for compatibility and also returns a cleaner `lesson_view_model` for future renderer work.

## Field Priority Rules

### Story: `visual_blocks[type=story_intro]`

EP mode priority:

1. `block.data.content_en`
2. `block.content_en`
3. `block.data.content`
4. `block.content`

TH mode priority:

1. `block.data.content_th`
2. `block.content_th`
3. `block.data.content`
4. `block.content`

The renderer must not show the short `content` summary when a richer `data.content_en` or `data.content_th` paragraph exists.

### Think Story: `visual_blocks[type=think_story]`

EP mode priority:

1. `block.data.content_en`
2. `block.content_en`
3. `block.data.content`
4. `block.content`

TH mode priority:

1. `block.data.content_th`
2. `block.content_th`
3. `block.data.content`
4. `block.content`

### Practice Mini Quiz: `visual_blocks[type=mini_quiz]`

Question priority:

1. EP: `block.data.question_en`; TH: `block.data.question_th`
2. EP: `block.question_en`; TH: `block.question_th`
3. `block.data.question`
4. `block.question`

Choices priority:

1. EP: `block.data.choices_en`; TH: `block.data.choices_th`
2. EP: `block.choices_en`; TH: `block.choices_th`
3. `block.data.choices`
4. `block.choices`

Correct answer and explanation follow the same language-specific priority:
`correct_answer_en/th` before `correct_answer`, and `explanation_en/th` before `explanation`.

## Comma-Safe Number Rendering

- Keep comma thousands separators in JSON, for example `45,200`, `23,800`, `69,000`, and `34,800`.
- Renderer code must not split display text on comma.
- Structured model values should render from `data.bars[*].display` when available.
- Numeric parsing may remove commas internally, but rendered labels must keep formatted display strings such as `45,200 baht`.
- Mini quiz choices must preserve comma-formatted values, for example `23,800 students`.

## Normalized View Model

Preferred page contract:

```json
{
  "lesson_group_id": "g3_addition_subtraction",
  "selected_variant_id": "add_sub_th_001",
  "grade_level": 3,
  "program_type": "TH",
  "topic_folder": "addition_subtraction",
  "title": "การบวกและการลบจำนวนไม่เกิน 100,000",
  "subtitle": "การบวกและการลบจำนวนไม่เกิน 100,000",
  "icon": "+-",
  "mascot_helper": {
    "mascot_id": null,
    "mascot_name": null,
    "image_src": null,
    "title": null,
    "tip": "ให้นักเรียนเขียนตัวเลขเรียงหลักให้ตรงกันก่อนบวกหรือลบ เส้นแบ่งหลักช่วยได้"
  },
  "story_label": "การบวกและการลบจำนวนไม่เกิน 100,000",
  "story": "น้องลินกับน้องมะลิออมเงิน...",
  "think_story": "การบวก: ลินมี 45,200 + มะลิมี 23,800...",
  "model_diagram": {},
  "number_sentence": {
    "steps": [],
    "final_answer": 34800,
    "unit": "บาท"
  },
  "practice": {
    "question": "โรงเรียนมีนักเรียน 52,400 คน...",
    "choices": ["23800 คน", "21800 คน", "24800 คน", "22800 คน"],
    "correct_answer": "23800 คน",
    "explanation": "52400 - 28600 = 23800 คน"
  },
  "test_available": false,
  "test_unavailable_reason": "ยังไม่มีแบบทดสอบที่อนุมัติสำหรับบทนี้"
}
```

## 1. Lesson Header

| UI item | JSON/API field path | Type | Example | Fallback | Required |
|---|---|---:|---|---|---|
| Grade badge | API `grade_level` from connector | number | `3` renders `ป.3` | `ไม่ระบุชั้น` | Yes |
| Lesson group | API `lesson_group_id` | string | `g3_addition_subtraction` | API `lesson_id` | Yes |
| Title | JSON `title_th`; API `title` / `title_th` | string | `การบวกและการลบจำนวนไม่เกิน 100,000` | `บทเรียน` | Yes |
| Subtitle | JSON `variant_title_th`; API `subtitle` / `variant_title_th` | string | `การบวกและการลบจำนวนไม่เกิน 100,000` | `title_en` or hidden | Optional |
| Icon | API `icon`; derived by backend | string | `+-` | topic illustration fallback | Optional |

Notes:
- `lesson_group_id`, `topic_folder`, and `selected_variant_id` are added by the Grade 3 topic-folder connector, not authored in the JSON file.
- Student UI does not show `source_path`.

## 2. Mascot Helper Tip

| UI item | JSON/API field path | Type | Example | Fallback | Required |
|---|---|---:|---|---|---|
| Mascot image | Frontend `defaultMascots[stableMascotIndex(...)]` | derived object | `/brand/topa/mascot-*.png` | TOPA registry fallback | Yes |
| Mascot name | Same mascot registry item | string | `Olli`, `Memo`, `Topa` | `Topa` | Yes |
| Helper title | Derived from mascot name | string | `Olli แนะนำวันนี้` | `{name} แนะนำวันนี้` | Yes |
| Helper tip text | JSON `helper_tip`; API `helper_tip`; view model `mascot_helper.tip` | string | `ให้นักเรียนเขียนตัวเลขเรียงหลักให้ตรงกันก่อนบวกหรือลบ เส้นแบ่งหลักช่วยได้` | topic-relevant safe fallback | Recommended |

## 3. Story Bar

| UI item | JSON/API field path | Type | Example | Fallback | Required |
|---|---|---:|---|---|---|
| Small label | JSON `variant_title_th`; API `variant_title_th`; view model `story_label` | string | `การบวกและการลบจำนวนไม่เกิน 100,000` | `story_theme_th` | Optional |
| Story/topic text | JSON `story_theme_th`; API `story_theme_th` | string | `น้องลินกับน้องมะลิออมเงิน...` | hidden if empty | Optional |

## 4. Story Section

| UI item | JSON/API field path | Type | Example | Fallback | Required |
|---|---|---:|---|---|---|
| Heading | Hardcoded Thai label | string | `เรื่องราว` | same label | Yes |
| Main story text | JSON `visual_blocks[type=story_intro].data.content_th` | string | `น้องลินกับน้องมะลิออมเงินเพื่อไปเที่ยวค่ายวิทยาศาสตร์...` | `story_theme_th`; then blank | Yes |

The renderer also accepts `visual_blocks[type=story_intro].content` for older block shapes.

## 5. Think Section

| UI item | JSON/API field path | Type | Example | Fallback | Required |
|---|---|---:|---|---|---|
| Heading | Hardcoded Thai label | string | `เรื่องราวชวนคิด` | same label | Yes |
| Analysis text | JSON `visual_blocks[type=think_story].data.content_th` | string | `การบวก: ลินมี 45,200 + มะลิมี 23,800 = รวม 69,000 บาท | การลบ...` | JSON `think_story_th`; then blank | Yes |
| Key numbers | Embedded in think text | string/number | `45,200`, `23,800`, `69,000`, `34,200`, `34,800` | none | Yes |
| Concept | Embedded in think text | string | addition then subtraction | none | Yes |

## 6. Model Diagram

| UI item | JSON/API field path | Type | Example | Fallback | Required |
|---|---|---:|---|---|---|
| Renderer type | `visual_blocks[type=model_diagram].data.model_type` | string | `part_whole_bar` | generic model fallback | Yes |
| Operation | `visual_blocks[type=model_diagram].data.operation` | string | `add_then_subtract` | none | Recommended |
| Part A | `data.part_a` and `data.bars[0]` | number/object | `45200`, label `ลิน` | bar display | Yes |
| Part B | `data.part_b` and `data.bars[1]` | number/object | `23800`, label `มะลิ` | bar display | Yes |
| Whole | `data.whole` and total bar | number/object | `69000`, label `รวม` | computed display if present | Yes |
| Subtract amount | `data.subtract_amount` and expense bar | number/object | `34200`, label `ค่ายวิทยาศาสตร์` | numeric display | Yes |
| Final value | `data.final_remainder` and remainder bar | number/object | `34800`, label `เงินที่เหลือ` | numeric display | Yes |
| Unit | `data.unit` | string | `บาท` | empty unit | Recommended |

Fallback behavior:
- If `part_whole_bar` data is missing, the renderer may use generic row/column model rendering for other lessons.
- The pilot no longer shows mojibake or “missing rows/columns” text.

## 7. Number Sentence

| UI item | JSON/API field path | Type | Example | Fallback | Required |
|---|---|---:|---|---|---|
| Step 1 | `visual_blocks[type=number_sentence].data.operations[0]` | object | `{ "op": "+", "a": 45200, "b": 23800, "result": 69000 }` | expression text | Yes |
| Step 2 | `data.operations[1]` | object | `{ "op": "-", "a": 69000, "b": 34200, "result": 34800 }` | expression text | Yes |
| Final answer | last operation `result` | number | `34800` | hidden if unavailable | Yes |
| Unit | backend view model default or model unit | string | `บาท` | `บาท` for this pilot | Recommended |
| Raw expression | `data.content_th` or `data.expression` | string | `45,200 + 23,800 = 69,000 | 69,000 - 34,200 = 34,800` | hidden | Optional |

## 8. Practice Mini Quiz

| UI item | JSON/API field path | Type | Example | Fallback | Required |
|---|---|---:|---|---|---|
| Question text | `visual_blocks[type=mini_quiz].data.question` | string | `โรงเรียนมีนักเรียน 52,400 คน มีนักเรียนชาย 28,600 คน มีนักเรียนหญิงกี่คน?` | root `question` | Yes |
| Choices | `data.choices` | array[string] | `["23800 คน", "21800 คน", "24800 คน", "22800 คน"]` | root `choices` | Yes |
| Correct answer | `data.correct_answer` | string | `23800 คน` | root `correct_answer`; answer index resolver | Yes |
| Feedback | frontend computed from selected choice | derived | correct / incorrect state | none | Yes |
| Explanation | `data.explanation` | string | `52400 - 28600 = 23800 คน` | root `explanation` | Recommended |

Fallback behavior:
- Placeholder mini quizzes without choices are hidden for this pilot.
- The renderer sanitizes `undefined`, `null`, and `[object Object]`.

## 9. Test Button Area

| UI item | JSON/API field path | Type | Example | Fallback | Required |
|---|---|---:|---|---|---|
| Availability | API `test_available` / `has_approved_test` | boolean | `false` | false when no approved quiz folder exists | Yes |
| Disabled reason | API `test_unavailable_reason` | string | `ยังไม่มีแบบทดสอบที่อนุมัติสำหรับบทนี้` | generic QA message | Required when unavailable |
| Start action | `POST /me/lessons/{lesson_group_id}/test/start?program_type=TH` | endpoint | `g3_addition_subtraction` | disabled when unavailable | Yes |

## Backend Mapping Summary

- `lesson_content.py` selects the first active JSON variant from:
  `grade_3/lessons/TH/addition_subtraction/*.json`
- `me.py` maps `visual_blocks` into explicit response fields:
  - `story`
  - `think_story`
  - `model_diagram`
  - `number_sentence`
  - `practice`
  - `lesson_view_model`
- Source path is logged server-side for diagnostics but not returned to student UI.

## Admin Diagnostics

For Grade 3 topic-folder lessons, admin rows include:

- `source_path`
- `source_folder`
- `selected_variant_id`
- `variant_status`
- `section_completeness.header`
- `section_completeness.mascot_helper`
- `section_completeness.story`
- `section_completeness.think_story`
- `section_completeness.model_diagram`
- `section_completeness.number_sentence`
- `section_completeness.practice`
