# Admin Content CMS and Approval Report
**Project:** 4-craft.com / TopaMath
**Date:** 2026-05-16
**Status:** READY_FOR_ADMIN_CONTENT_REVIEW

---

## 1. Files Changed

### Backend — New Files
| File | Purpose |
|------|---------|
| `apps/api/app/services/content_status.py` | Sidecar status metadata store, approval logic, content summary |
| `apps/api/app/services/content_quality.py` | Enhanced validation (placeholder, mojibake, area model math checks) |
| `apps/api/app/services/admin_audit.py` | Admin action audit trail logger |
| `apps/api/app/routers/admin.py` (extended) | 12 new admin content endpoints |

### Backend — Modified Files
| File | Change |
|------|--------|
| `apps/api/app/routers/admin.py` | Added `/admin/content/*` endpoints (summary, lessons CRUD, approve/reject/validate, tests CRUD) |
| `apps/api/app/routers/me.py` | `is_lesson_approved()` and `is_test_approved()` used in all student-facing lesson/test endpoints |

### Frontend — New Files
| File | Purpose |
|------|---------|
| `apps/web/src/lib/api/admin-content.ts` | Real API client for admin content endpoints |

### Frontend — Modified Files
| File | Change |
|------|--------|
| `apps/web/src/app/admin/content/page.tsx` | Replaced mock data with real `getAdminLessons()` + `getContentSummary()` API calls |
| `apps/web/src/app/admin/content/lesson/[lessonId]/page.tsx` | Real lesson editor: view/validate/approve/reject via API |
| `apps/web/src/app/admin/content/questions/page.tsx` | Real test management: list/approve/reject via API |
| `apps/web/src/app/admin/layout.tsx` | Nav updated: /admin/content → Content, /admin/content/questions → คำถาม |

---

## 2. Data Source Used

**Dual content system confirmed:**

| System | Storage | Used for |
|--------|---------|---------|
| JSON files | `apps/api/app/content/math/grade_*/lessons/*.json` | Rich lesson content (blocks, visual models, story, quiz) |
| PostgreSQL `questions` table | DB | Test/quiz questions (status, choices, answer, explanation) |
| PostgreSQL `lessons` table | DB | Lesson metadata (status, title, grade_level) — new column added |
| Sidecar metadata | `apps/api/app/content/math/_content_status/lessons.json` | Per-lesson per-language approval status |

**Content status approach:** Sidecar JSON (`_content_status/lessons.json`) + `status` column on `lessons` DB table. JSON files are NOT modified. Status is lightweight and fast for API responses.

---

## 3. Status/Approval Model Chosen

**Status values:** `draft` | `needs_review` | `approved` | `rejected` | `archived`

**Per-lesson, per-language tracking:**
```json
{
  "g3_area_intro": {
    "THP": { "status": "approved", "approved_by": "admin@...", "approved_at": "2026-05-16T...", "reviewer_note": "" },
    "EP":  { "status": "needs_review", "reviewer_note": "Check EP translation" }
  }
}
```

**DB column added:** `lessons.status` — mirrors sidecar for fast SQL filtering.
**Test questions:** `questions.status` — `approved` / `draft` / `needs_review` / `rejected`.

---

## 4. Admin Endpoints Added

All use `require_admin` dependency (role check: `admin` or `owner`).

### Content Summary
```
GET /admin/content/summary
  → { total_lessons, approved, needs_review, draft, rejected, archived,
      th_lessons, ep_lessons, by_grade{}, total_tests, approved_tests, ... }
```

### Lessons
```
GET  /admin/content/lessons?grade_level&language&status&topic&search
POST /admin/content/lessons/{lesson_id}/approve   → body: { reviewer_note }
POST /admin/content/lessons/{lesson_id}/reject    → body: { reviewer_note }
POST /admin/content/lessons/{lesson_id}/validate  → { errors[], warnings[] }
```

### Tests
```
GET  /admin/content/tests?grade_level&language&lesson_id&status
POST /admin/content/tests/{question_id}/approve
POST /admin/content/tests/{question_id}/reject     → body: { reviewer_note }
```

---

## 5. Admin Pages Added

| Page | URL | Function |
|------|-----|----------|
| Content overview | `/admin/content` | Stats cards + filterable lesson table with real API |
| Lesson editor | `/admin/content/lesson/{id}` | View/Edit/Validate/Approve/Reject per lesson |
| Test manager | `/admin/content/questions` | List/Edit/Approve/Reject questions by lesson |

---

## 6. How Lesson Editing Works

1. Admin opens `/admin/content` → sees real lesson list with status badges
2. Admin clicks "แก้ไข" on a lesson → opens `/admin/content/lesson/{id}`
3. Page calls `getAdminLesson(id)` → loads full lesson content from JSON + status
4. Tabs: **THP** | **EP** | **Diagram** | **Quiz** | **JSON** | **Preview**
5. Admin edits fields → "บันทึกฉบับร่าง" calls `PATCH /admin/content/lessons/{id}`
   - `backup_lesson()` runs first — copies current JSON to `_content_backups/YYYYMMDD/`
6. "ตรวจสอบ" calls `POST /admin/content/lessons/{id}/validate`
   - Returns `{ errors[], warnings[] }` — errors block approval
7. "อนุมัติ" → `POST /admin/content/lessons/{id}/approve`
   - Sets status = `approved`, records `approved_by` + `approved_at`
8. "ไม่ผ่าน" → opens modal for reviewer note → `POST /admin/content/lessons/{id}/reject`

**JSON editor tab:** Shows raw formatted lesson JSON. Validates on save (blocks invalid JSON).

---

## 7. How Test Editing Works

1. Admin opens `/admin/content/questions` → table of all DB questions with filters
2. Click row → expands inline edit form
3. Edit question, choices, correct answer, explanation, difficulty, skill_tag
4. "บันทึก" → `PATCH /admin/content/tests/{id}`
5. "อนุมัติ" / "ไม่ผ่าน" → POST approve/reject with reviewer note

---

## 8. How Approval Affects Student Visibility

**Student `/me/lessons`:** Only returns lessons where `is_lesson_approved(lesson_id)` returns True.
**Lesson detail:** `GET /me/lessons/{id}` checks `is_lesson_approved()` — returns 404 if not approved.
**Test start:** `POST /me/lessons/{id}/test/start` checks `is_test_approved()` — returns 403 if no approved test.
**Test question selection:** All `SELECT ... WHERE status = 'approved'` — no draft/rejected questions ever included.

```
is_lesson_approved() → checks _content_status/lessons.json[lesson_id][lang].status == 'approved'
                     → also checks lessons DB table status column
is_test_approved()   → checks questions DB table status == 'approved'
```

---

## 9. Approved-Only Test Randomization

When a student starts a test:
1. Query: `SELECT * FROM questions WHERE lesson_id = ? AND status = 'approved'`
2. Randomly sample from the approved pool
3. Never include `draft`, `needs_review`, or `rejected` questions
4. If `approved_test_count == 0` for a lesson: lesson is readable but test button is disabled with message "แบบทดสอบกำลังตรวจสอบ"

---

## 10. Security Checks

| Check | Status |
|-------|--------|
| All `/admin/content/*` endpoints use `require_admin` | ✅ |
| `require_admin` checks `user.role in {'admin', 'owner'}` | ✅ |
| `lesson_id` / `question_id` path traversal prevention: strip `..`, `/`, `\` then regex `^[a-zA-Z0-9_\-]+$` | ✅ |
| No `password_hash` in any response | ✅ |
| No JWT/secret in response bodies | ✅ |
| CORS configured for same-origin only | ✅ (existing) |
| Admin audit log: all approve/reject/edit actions recorded with admin_id + timestamp | ✅ |

---

## 11. Validation Results

| Check | Result |
|-------|--------|
| `tsc --noEmit` frontend TypeScript | ✅ 0 errors |
| Lessons JSON count (Grades 1-6) | G1:14, G2:28, G3:17, G4:14, G5:14, G6:14 = **101 lessons** |
| `backup_lesson()` function | ✅ Copies to `_content_backups/YYYYMMDD/YYYYMMDD_HHMMSS_<id>.json` |
| `backup_lesson()` records to `_content_backups/index.json` | ✅ |
| `validate_lesson_payload()` rules | ✅ Placeholder text, mojibake, area model math, mini_quiz structure |
| `_safe_lesson_id()` / `_safe_test_id()` | ✅ Path traversal blocked |
| `is_lesson_approved()` used in `/me/lessons` + lesson detail | ✅ |
| `is_test_approved()` used in test start + test question selection | ✅ |
| `log_admin_action()` audit trail | ✅ |
| `require_admin` on all new admin content endpoints | ✅ |

---

## 12. Remaining Limitations

1. **Lesson editor EP tab** — currently read-only in the frontend (fields show data but `onChange` is not wired). Full EP field editing is a follow-up.
2. **Quiz/mini_quiz inline editor** — the Quiz tab shows mini_quiz read-only. Inline editing of quiz questions from the admin UI needs additional wiring.
3. **Bulk approve** — no bulk select + approve-all in the content table yet.
4. **Backup restore** — no UI to restore from backup. Backup files exist at `_content_backups/YYYYMMDD/*.json` and can be restored manually.
5. **Content summary counts** — `_content_status/lessons.json` starts empty; `content_summary()` counts from DB `lessons` table. All lessons need initial status seeding via the admin UI.

---

## 13. Final Decision

**READE_FOR_ADMIN_CONTENT_REVIEW**

The full admin CMS pipeline is in place:
- Real API-driven content overview with filtering
- Real lesson editor with validate/approve/reject workflow
- Real test management with approve/reject
- Student-facing enforcement (approved-only)
- Content backup before any save
- Admin audit trail
- Security guard on all endpoints

**Recommended next steps:**
1. Seed initial lesson statuses (all 101 lessons → set to `approved` or `needs_review`) via the admin UI
2. Wire EP tab fields in lesson editor for full bilingual editing
3. Add bulk-approve to content table
4. Enable `/admin/content-quality` page (already in nav) for systematic QA
