# PART 1: Content Data Source Audit
**Date:** 2026-05-16
**Project:** 4-craft.com / TopaMath

---

## 1. Content Storage — Dual System Found

### System A: JSON File Content (primary, rich lessons)
- **Path:** `apps/api/app/content/math/grade_{1-6}/lessons/*.json`
- **Format:** Rich visual block format with `lesson_id`, `title_th`, `visual_blocks[]`, `mini_quiz`, `story_intro`, etc.
- **Loaded by:** `app/services/lesson_content.py` → `find_lesson_file()`
- **Served via:** `GET /me/lessons/{id}?pt=TH|EP` (reads JSON files directly)
- **Total:** ~50 JSON lessons across Grades 1-6
- **⚠️ No status field** in JSON files — no approval system

### System B: Database Content (legacy/question bank)
- **Tables:**
  - `lessons` (id, skill_id, title, content:jsonb, source, status)
  - `questions` (id, skill_id, grade_level, question_type, difficulty, question_text, choices:jsonb, correct_answer, explanation, hint, source, **status** default "draft", metadata_json)
- **Served via:** `GET /me/lessons` (DB), `POST /me/lessons/{id}/test/start` (from `questions` table)
- **⚠️ `Question.status` already exists** in schema (default "draft")

---

## 2. Lesson Loader Mechanism

```
GET /me/lessons/{lessonId}?pt=TH|EP
  → routers/me.py: lesson_detail()
  → services/lesson_content.py: find_lesson_file(lesson_id, program_type)
    → Scans grade_N/lessons/ directories
    → Matches lesson_id to filename (e.g. g3_area_intro.json)
    → Reads JSON, normalizes visual_blocks, returns LessonOut
  → Also checks DB lessons table for metadata
  → Uses content_quality.validate_lesson_payload()
```

---

## 3. Lesson Schema (JSON files)
```json
{
  "lesson_id": "g3_area_intro",
  "grade_level": 3,
  "program_type": "THP",
  "title_th": "...",
  "title_en": "...",
  "topic_code": "area",
  "skill_code": "area_model",
  "story_intro_th": "...",
  "lesson_variants": [{
    "language": "TH",
    "visual_blocks": [
      { "type": "story_intro", "title_th": "...", "content_th": "..." },
      { "type": "area_model", "width": 5, "height": 4, "symbol": "🟧" },
      { "type": "number_sentence", "title_th": "เขียนเป็นประโยควิธีทำ", "content_th": "..." },
      { "type": "mini_quiz", "question": "...", "choices": [...], "answer": "..." }
    ],
    "mini_quiz": [...]
  }]
}
```

---

## 4. Test/Question Content Structure
- Questions come from **`questions` DB table** (NOT JSON files)
- `Question.status` defaults to "draft" — already has approval field
- Test start: `POST /me/lessons/{id}/test/start` → loads approved questions from DB
- JSON mini_quiz blocks are practice only (not scored test questions)

---

## 5. Existing Admin Pages
- `/admin/content` — exists, needs audit (static or API?)
- `/admin/lessons` — exists, needs audit
- `/admin/tests` — exists, needs audit
- All route through `apps/web/src/app/admin/` — **need to check if using real API**

---

## 6. Key Finding: Two Separate Approval Systems Needed

| Content | Storage | Status Field | Student API |
|---------|---------|-------------|-------------|
| Rich lessons (visual blocks) | JSON files | ❌ NONE | `/me/lessons/{id}` |
| Test questions | `questions` DB table | ✅ EXISTS (default "draft") | `/me/lessons/{id}/test/start` |
| Legacy lessons | `lessons` DB table | ✅ EXISTS | `/me/lessons` |

**Action items:**
1. Add approval status to JSON lesson files via **sidecar metadata** (safest — don't modify source JSON)
2. `questions.status` is already in DB — just need to filter student APIs to `status='approved'`
3. Admin CMS needs to manage both JSON lesson approvals AND DB question approvals

---

## 7. Backend Routers Found
- `routers/me.py` — student-facing `/me/*` endpoints
- `routers/admin.py` — admin endpoints (needs audit for content management)
- `routers/learning.py` — learning progression
- `routers/children.py` — child profiles
- `routers/billing.py` — Stripe billing