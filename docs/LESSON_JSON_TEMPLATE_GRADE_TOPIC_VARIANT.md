# Lesson JSON Template for Grade Topic Variants

This template describes the recommended structure for future topic-folder lesson variants such as:

- `apps/api/app/content/math/grade_3/lessons/TH/money/money_th_001.json`
- `apps/api/app/content/math/grade_3/lessons/TH/division/division_th_001.json`
- `apps/api/app/content/math/grade_3/lessons/EP/division/division_ep_001.json`

## Folder Rule

```text
apps/api/app/content/math/grade_[N]/lessons/TH/[topic_folder]/[variant].json
apps/api/app/content/math/grade_[N]/lessons/EP/[topic_folder]/[variant].json
```

Quiz files should mirror the topic folder:

```text
apps/api/app/content/math/grade_[N]/quizzes/TH/[topic_folder]/[quiz_variant].json
apps/api/app/content/math/grade_[N]/quizzes/EP/[topic_folder]/[quiz_variant].json
```

## Naming Convention

- TH variant: `[topic_short]_th_001.json`
- EP variant: `[topic_short]_ep_001.json`
- Increment variants as `_002`, `_003`, and so on.
- Keep `variant_id` stable and matching the file stem when possible.
- The student lesson card uses the topic group id, not the raw file name. Example:
  `addition_subtraction` -> `g3_addition_subtraction`.

## Required Fields

```json
{
  "variant_id": "money_th_001",
  "variant_title_th": "เงินทอนในชีวิตประจำวัน",
  "status": "needs_review",
  "title_th": "เงินทอนในชีวิตประจำวัน",
  "story_theme_th": "...",
  "helper_tip": "...",
  "think_story_th": "...",
  "visual_blocks": []
}
```

Required `visual_blocks`:

- `story_intro`
- `think_story`
- `model_diagram`
- `number_sentence`
- `mini_quiz`

## Optional Fields

- `variant_title_en`
- `title_en`
- `explanation_steps`
- `worked_examples`
- `common_mistakes`
- `hints`
- `key_vocabulary`
- `teacher_notes`
- `admin_notes`

EP-specific optional fields:

- `hint_th`
- `vocabulary_th`
- `teacher_note_th`

Do not put Thai text inside English `*_en` fields.

## Example TH JSON Skeleton

```json
{
  "variant_id": "money_th_001",
  "variant_title_th": "เงินทอนในชีวิตประจำวัน",
  "variant_title_en": "Money and Change",
  "status": "needs_review",
  "title_th": "เงินทอนในชีวิตประจำวัน",
  "title_en": "Money and Change",
  "story_theme_th": "น้องมิ้นมีเงิน 50 บาท ซื้อขนมปังราคา 13 บาท เธอต้องการรู้ว่าจะได้เงินทอนกี่บาท",
  "helper_tip": "ดูว่าโจทย์ถามเงินที่เหลือหรือเงินทอน แล้วใช้การลบ",
  "think_story_th": "โจทย์บอกว่ามีเงิน 50 บาท ใช้ไป 13 บาท จึงใช้ 50 - 13 เพื่อหาเงินทอน",
  "visual_blocks": [
    {
      "type": "story_intro",
      "title": "เรื่องราว",
      "content": "น้องมิ้นมีเงิน 50 บาท ซื้อขนมปังราคา 13 บาท เธอต้องการรู้ว่าจะได้เงินทอนกี่บาท",
      "data": {
        "content_th": "น้องมิ้นมีเงิน 50 บาท ซื้อขนมปังราคา 13 บาท เธอต้องการรู้ว่าจะได้เงินทอนกี่บาท"
      }
    },
    {
      "type": "think_story",
      "title": "คิดทบทวน",
      "data": {
        "content_th": "มีเงิน 50 บาท ใช้ไป 13 บาท คำถามถามเงินที่เหลือ จึงใช้ 50 - 13"
      }
    },
    {
      "type": "model_diagram",
      "title": "แผนภาพเงินทอน",
      "data": {
        "model_type": "part_whole_bar",
        "operation": "subtract",
        "whole": 50,
        "subtract_amount": 13,
        "final_remainder": 37,
        "unit": "บาท",
        "bars": [
          { "label": "เงินที่มี", "value": 50, "display": "50 บาท", "color": "#96CEB4", "width_pct": 100, "is_total": true },
          { "label": "ค่าขนมปัง", "value": 13, "display": "13 บาท", "color": "#FF6B6B", "width_pct": 26 },
          { "label": "เงินทอน", "value": 37, "display": "37 บาท", "color": "#C7F464", "width_pct": 74, "is_remainder": true }
        ]
      }
    },
    {
      "type": "number_sentence",
      "title": "ประโยคตัวเลข",
      "data": {
        "operations": [
          { "op": "-", "a": 50, "b": 13, "result": 37 }
        ],
        "content_th": "50 - 13 = 37"
      }
    },
    {
      "type": "mini_quiz",
      "title": "ลองทำดู",
      "data": {
        "question": "พ่อให้เงินน้อง 60 บาท น้องซื้อสมุดราคา 25 บาท น้องจะเหลือเงินกี่บาท?",
        "choices": ["35 บาท", "30 บาท", "45 บาท", "25 บาท"],
        "correct_answer": "35 บาท",
        "explanation": "60 - 25 = 35 บาท"
      }
    }
  ]
}
```

## Example EP JSON Skeleton

```json
{
  "variant_id": "division_ep_001",
  "variant_title_en": "Division",
  "status": "needs_review",
  "title_en": "Division",
  "story_theme_en": "Mina has 30 cookies. She shares them equally with 6 friends. How many cookies does each friend get?",
  "helper_tip": "Equal sharing means division.",
  "hint_th": "แบ่งเท่า ๆ กัน ใช้การหาร",
  "visual_blocks": [
    {
      "type": "story_intro",
      "title": "Story",
      "content": "Mina has 30 cookies. She shares them equally with 6 friends. How many cookies does each friend get?",
      "data": {
        "content_en": "Mina has 30 cookies. She shares them equally with 6 friends. How many cookies does each friend get?"
      }
    },
    {
      "type": "think_story",
      "title": "Think",
      "data": {
        "content_en": "There are 30 cookies and 6 equal groups. Use 30 ÷ 6."
      }
    },
    {
      "type": "model_diagram",
      "data": {
        "model_type": "equal_groups",
        "total": 30,
        "groups": 6,
        "per_group": 5,
        "unit": "cookies"
      }
    },
    {
      "type": "number_sentence",
      "data": {
        "operations": [
          { "op": "÷", "a": 30, "b": 6, "result": 5 }
        ],
        "content_en": "30 ÷ 6 = 5 cookies"
      }
    },
    {
      "type": "mini_quiz",
      "data": {
        "question": "A teacher has 24 pencils. She puts them equally into 4 boxes. How many pencils are in each box?",
        "choices": ["6 pencils", "5 pencils", "8 pencils", "4 pencils"],
        "correct_answer": "6 pencils",
        "explanation": "24 ÷ 4 = 6 pencils"
      }
    }
  ]
}
```

## How the Renderer Uses Each Field

- Header: `title_th` / `title_en`, `variant_title_th` / `variant_title_en`, connector `grade_level`, connector `lesson_group_id`.
- Mascot helper: `helper_tip`; mascot image/name comes from the frontend TOPA mascot registry.
- Story: `visual_blocks[type=story_intro].data.content_th` or `content_en`.
- Think: `visual_blocks[type=think_story].data.content_th` or `content_en`.
- Model: `visual_blocks[type=model_diagram].data`.
- Number sentence: `visual_blocks[type=number_sentence].data.operations`.
- Practice: `visual_blocks[type=mini_quiz].data.question`, `choices`, `correct_answer`, `explanation`.
- Test button: backend quiz pairing for the same `grade`, `program`, and `topic_folder`.

## Admin Approval

- New AI-authored or manually drafted EP content should stay `needs_review` until a human validates it.
- TH content can be approved after section completeness, source path, and topic alignment are checked.
- Admin diagnostics should show:
  - source file
  - variant id
  - approval status
  - section completeness

## Quiz/Test Pairing

For a lesson in:

```text
apps/api/app/content/math/grade_3/lessons/TH/money/money_th_001.json
```

Matching quiz variants should live in:

```text
apps/api/app/content/math/grade_3/quizzes/TH/money/*.json
```

If no approved quiz exists, the lesson remains readable and the test button should be disabled with:

```text
ยังไม่มีแบบทดสอบที่อนุมัติสำหรับบทนี้
```
