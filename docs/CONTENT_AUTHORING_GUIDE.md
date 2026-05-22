# TOPA Math Content Authoring Guide

## Canonical Source

Student and admin content is file-backed under:

- TH/EP lessons: `apps/api/app/content/math/grade_<n>/lessons/*.json`
- TH/EP tests: `apps/api/app/content/math/grade_<n>/quizzes/*.json`
- Optional legacy question banks: `apps/api/app/content/math/question_banks/grade_<n>/*.jsonl`
- Approval metadata: `apps/api/app/content/math/_content_status/lessons.json` and `apps/api/app/content/math/_content_status/tests.json`

Only approved sidecar entries are student-visible. Draft, needs_review, rejected, archived, missing, or invalid entries stay admin-only.

## Lesson IDs

Use one base lesson id per concept:

```text
g3_area_intro
```

TH lesson file:

```text
apps/api/app/content/math/grade_3/lessons/g3_area_intro.json
```

EP lesson file:

```text
apps/api/app/content/math/grade_3/lessons/g3_area_intro_ep.json
```

The EP variant uses the same base lesson id plus `_ep`. TH content must not use `_ep`.

Required lesson fields:

```json
{
  "lesson_id": "g3_area_intro",
  "id": "g3_area_intro",
  "grade_level": 3,
  "program_type": "THP",
  "title_th": "พื้นที่รูปสี่เหลี่ยม",
  "objective_th": "...",
  "topic_code": "g3_area_intro",
  "skill_code": "g3_area_intro",
  "visual_blocks": []
}
```

EP example:

```json
{
  "lesson_id": "g3_area_intro_ep",
  "id": "g3_area_intro_ep",
  "grade_level": 3,
  "program_type": "EP",
  "title_en": "Area of Rectangles",
  "objective_en": "Find the area of a rectangle.",
  "topic_code": "g3_area_intro",
  "skill_code": "g3_area_intro_ep",
  "visual_blocks": []
}
```

## Tests

TH test file:

```text
apps/api/app/content/math/grade_3/quizzes/g3_area_intro.json
```

EP test file:

```text
apps/api/app/content/math/grade_3/quizzes/g3_area_intro_ep.json
```

Each question needs an approved status entry in `_content_status/tests.json`.

Question example:

```json
{
  "question_id": "g3_area_intro_q001",
  "grade_level": 3,
  "lesson_id": "g3_area_intro",
  "question_text_th": "ครูจัดแผ่นภาพเป็น 3 แถว แถวละ 5 ชิ้น มีทั้งหมดกี่ชิ้น?",
  "choices": ["8", "13", "15", "19"],
  "correct_answer": "15",
  "explanation_th": "3 × 5 = 15"
}
```

EP questions should use `lesson_id` with `_ep`, English problem text, simple choices, answer, English explanation, and Thai hint/translation fields where the schema supports them.

## Approval Workflow

Run the status scanner after adding files:

```powershell
cd C:\web-app\4-craft.com
python - <<'PY'
import sys
sys.path.insert(0, "apps/api")
from app.services.content_status import seed_initial_content_status
print(seed_initial_content_status(dry_run=False, force=False))
PY
```

Admin may then approve or reject content in `/admin/lessons` and `/admin/tests`. Students only see approved lesson files and approved test questions from the matching program.

## EP Authoring Policy

EP lessons should be written by an English teacher, a bilingual math reviewer, or AI draft plus human admin review. Hermes/OpenClaw can draft, but admin must approve.

EP requirements:

- Simple English for Thai elementary students.
- Thai hints/translations for key question text where supported.
- Real-life examples children understand.
- Avoid complex vocabulary.
- Keep the math concept identical to TH.
- Include English problem, optional Thai hint, choices, correct answer, English explanation, and optional Thai explanation/hint.
- Never auto-approve EP content without validation/review unless a beta policy explicitly allows it.

## Verification

Use the canonical service to verify source alignment:

```powershell
cd C:\web-app\4-craft.com
python - <<'PY'
import sys
sys.path.insert(0, "apps/api")
from app.services.lesson_content import list_canonical_lessons, get_canonical_test_bank
for program in ["TH", "EP"]:
    print(program, len(list_canonical_lessons(program, grade=3)))
    print(program, len(get_canonical_test_bank("g3_area_intro", program)))
PY
```

Then verify in browser/API:

- `/admin/lessons?program_type=TH&grade=3`
- `/admin/tests?language=TH&grade=3&lesson_id=g3_area_intro`
- `/me/lessons`
- `/me/dashboard`
- `/me/lessons/g3_area_intro?program_type=TH`
- `/me/lessons/g3_area_intro/test/start?program_type=TH`

