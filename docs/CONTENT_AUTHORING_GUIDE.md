# TOPA Math Content Authoring Guide

## Canonical Source

Student and admin content is file-backed only under the active grade folders:

- TH/EP lessons: `C:\web-app\4-craft.com\apps\api\app\content\math\grade_[N]\lessons`
- TH/EP tests: `C:\web-app\4-craft.com\apps\api\app\content\math\grade_[N]\quizzes`
- Approval metadata: `apps/api/app/content/math/_content_status/lessons.json` and `apps/api/app/content/math/_content_status/tests.json`

Only approved sidecar entries are student-visible. Draft, needs_review, rejected, archived, missing, or invalid entries stay admin-only.

Do not add active student/admin content to:

- `_content_backups`
- `backup_*`
- `question_banks`
- old `g1`, `g4`, `g5`, or `g6` folders
- `_archived_legacy_not_loaded`
- `_content_status` except for status metadata only

The active loader supports both current flat files directly inside `lessons` or `quizzes`, and one-level lesson-specific folders. Backup, archive, legacy, and status folders are not scanned for active content.

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

Recommended lesson-specific folder structure:

```text
apps/api/app/content/math/grade_5/lessons/g5_data_graphs/
  g5_data_graphs.json
  g5_data_graphs_001.json
  ...
  g5_data_graphs_999.json

apps/api/app/content/math/grade_5/lessons/g5_data_graphs_ep/
  g5_data_graphs_ep.json
  g5_data_graphs_ep_001.json
  ...
  g5_data_graphs_ep_999.json
```

If both a flat file and a same-named lesson-specific folder exist, the loader prefers files in the lesson-specific folder.

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

Recommended quiz folder structure:

```text
apps/api/app/content/math/grade_5/quizzes/g5_data_graphs/
  g5_data_graphs.json
  g5_data_graphs_001.json
  ...
  g5_data_graphs_999.json

apps/api/app/content/math/grade_5/quizzes/g5_data_graphs_ep/
  g5_data_graphs_ep.json
  g5_data_graphs_ep_001.json
  ...
  g5_data_graphs_ep_999.json
```

Random variants can be added as `_001` through `_999` files. Keep `lesson_id`, `base_lesson_id` or `topic_code`, `grade_level`, and `program_type` consistent across variants so the loader can pair TH/EP lessons and quizzes correctly.

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

To preview a folder migration without changing files:

```powershell
docker exec -it 4craft-api python -m app.scripts.migrate_content_to_lesson_folders --dry-run
```

Run the non-dry command only after reviewing the planned moves and backup path:

```powershell
docker exec -it 4craft-api python -m app.scripts.migrate_content_to_lesson_folders
```

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

Validate active roots:

```powershell
cd C:\web-app\4-craft.com\apps\api
pytest tests/test_active_content_roots.py
```

Then verify in browser/API:

- `/admin/lessons?program_type=TH&grade=3`
- `/admin/tests?language=TH&grade=3&lesson_id=g3_area_intro`
- `/me/lessons`
- `/me/dashboard`
- `/me/lessons/g3_area_intro?program_type=TH`
- `/me/lessons/g3_area_intro/test/start?program_type=TH`
