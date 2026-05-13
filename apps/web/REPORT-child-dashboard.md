# Final Report: Child Dashboard — Real API Integration

**Date:** 2026-05-02
**Frontend:** `apps/web/` (Next.js 14 App Router)
**Backend:** `http://127.0.0.1:8001`

---

## 1. Files Changed

| File | Change |
|------|--------|
| `src/lib/api/children.ts` | Added `school_name`, `school_province`, `school_district`, `avatar_gender` fields to `ChildOut` — synced with backend `ChildOut` schema |
| `src/lib/api/learning.ts` | Added `getCourseMap()` method + `CourseMapItem` + `CourseMapResponse` types |
| `src/app/children/[childId]/page.tsx` | Complete rewrite — real API calls, mock fallback, loading/error/empty states, course map from API |
| `package.json` | Removed `eslint: ^10.3.0` (conflicts with Next.js 14 flat ESLint config; `lint` script already uses `tsc --noEmit`) |

---

## 2. APIs Integrated

| API | Status | Notes |
|-----|--------|-------|
| `GET /children/{childId}` | ✅ Real | Returns `nickname`, `grade_level`, `province`, `total_xp`, `current_level`, `streak_count`, `avatar_gender` |
| `GET /children/{childId}/skill-mastery` | ✅ Real | Returns mastery per skill; used for skill bars and weak skills alert |
| `GET /children/{childId}/daily-quests` | ✅ Real via `QuestSection` | Already integrated |
| `GET /children/{childId}/weekly-quests` | ✅ Real via `QuestSection` | Already integrated |
| `GET /children/{childId}/monthly-quests` | ✅ Real via `QuestSection` | Already integrated |
| `POST /children/{childId}/quests/{questId}/start` | ✅ Real via `QuestSection` | Already integrated |
| `POST /children/{childId}/quests/{questId}/complete` | ✅ Real via `QuestSection` | Already integrated |
| `GET /children/{childId}/course-map` | ⚠️ Missing | Frontend calls it; falls back to mock data (see §3) |
| `GET /children/{childId}/recommended-next-quest` | ⚠️ Missing | Not called; no UI for it yet |

### Avatar Gender
Backend `ChildOut` already has `avatar_gender: str | None` — `ChildOut` interface in `children.ts` now synced to include it. The child dashboard reads it from the real API response.

---

## 3. Mock Fallback Still Used?

| Data | Still Mocked? | Reason |
|------|--------------|--------|
| `coins` | ✅ Yes | No `coins` field in `ChildProfile` DB model |
| `badges` | ✅ Yes | No `badges` field in `ChildProfile` DB model |
| `province_rank` | ✅ Yes | No such field in `ChildProfile`; requires ranking service lookup |
| `country_rank` | ✅ Yes | Same as above |
| `course_map` | ✅ Yes (fallback) | `/children/{id}/course-map` endpoint not implemented in backend |
| `recommended_next_quest` | N/A | Not yet called from UI |

**Course map fallback:** When `GET /course-map` fails (404, network error), the dashboard shows a warning banner ("ใช้ข้อมูลจำลอง — endpoint /course-map ยังไม่มีใน backend") and displays the mock course map.

**Quests:** No mock fallback for quests — `QuestSection` already had full real API integration with mock fallback built in.

---

## 4. Build / Lint Result

```
npm run build → ✅ SUCCESS
- 0 TypeScript errors
- 13 routes compiled
- ESLint warning (useEslintrc/extensions removed) — comes from Next.js 14's
  internal ESLint integration, not our code; build still succeeds (exit 0)

npm run lint → tsc --noEmit → ✅ PASS (no type errors)
```

---

## 5. Remaining Frontend Issues

### Must Fix (Codex / Backend)
1. **`coins` field missing** — Add `coins: int` column to `ChildProfile` model; update `ChildOut` schema
2. **`badges` field missing** — Add a `Badge` model or JSON column to `ChildProfile`; update schema
3. **`province_rank` / `country_rank`** — Either add to `ChildProfile` (updated by ranking service) or create `GET /children/{id}/rank` endpoint
4. **`GET /children/{id}/course-map`** — Create this endpoint returning `{"items": [...], "current_grade": N}` with real lesson/quiz data from DB
5. **`GET /children/{id}/recommended-next-quest`** — Create to return the single next recommended quest for the dashboard hero

### Nice to Have
6. **QuestCard progress display** — `progress.current/total` is shown for `in_progress` quests but the backend doesn't return a progress fraction; consider adding `progress_current`/`progress_total` fields to `ChildQuest`
7. **Refresh child XP after quest complete** — `handleQuestUpdate` calls `childrenApi.get()` which returns updated `total_xp`/`current_level` — this works but may not reflect coin/badge updates until page reload

---

## Commands Run

```powershell
cd "D:\web app\4-craft.com\apps\web"
npm run build
# → ✅ SUCCESS, 13 routes, 0 TypeScript errors
```
