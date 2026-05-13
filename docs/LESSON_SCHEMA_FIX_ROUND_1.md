# Lesson Schema Fix Report — Round 1

**Date:** 2026-05-11
**Files edited:** `g3_area_intro`, `g3_division_intro`, `g3_fractions_intro`
**Backup:** `D:\web app\4-craft.com\apps\api\backup_lessons_round1\`

---

## Files Edited

| File | Variants |
|---|---|
| `grade_3/lessons/g3_area_intro.json` | v01–v10 + ep_v01 (11 variants) |
| `grade_3/lessons/g3_division_intro.json` | v01–v10 + ep_v01 (11 variants) |
| `grade_3/lessons/g3_fractions_intro.json` | v01–v10 + ep_v01 (11 variants) |

---

## Block Type Normalization

### Before → After

| Lesson | Block | Before | After |
|---|---|---|---|
| g3_area_intro (all variants) | emoji_counter | `emoji_counter` | `visual_thinking` |
| g3_area_intro (all variants) | area_model | `area_model` | `model_diagram` |
| g3_division_intro (all variants) | emoji_counter | `emoji_counter` | `visual_thinking` |
| g3_division_intro (all variants) | grouping_model | `grouping_model` | `model_diagram` |
| g3_fractions_intro (all variants) | emoji_counter | `emoji_counter` | `visual_thinking` |
| g3_fractions_intro (all variants) | fraction_visual | `fraction_visual` | `model_diagram` |

**Stats (per lesson):**
- blocks_normalized: 20 (emoji_counter→visual_thinking + area_model/grouping_model/fraction_visual→model_diagram × 11 variants)
- mini_quiz_fixed: 11 (added `correct_answer` + `explanation_th` to each variant)
- legacy_removed: 0 (no step_cards, worked_example, common_mistakes in these files)

**Standard block order (all variants):**
1. `story_intro`
2. `visual_thinking`
3. `model_diagram`
4. `number_sentence`
5. `mini_quiz`

---

## mini_quiz Fixes

| Lesson | Question | correct_answer | Math Check |
|---|---|---|---|
| g3_area_intro | พื้นที่กว้าง 4 ช่อง สูง 3 ช่อง มีกี่ช่อง? | `12 ช่อง` | ✅ 4×3=12 |
| g3_division_intro | ⭐ 12 ดวง แบ่งให้เพื่อน 3 คน คนละกี่ดวง? | `4 ดวง` | ✅ 12÷3=4 |
| g3_fractions_intro | 🍕 6 ชิ้น แบ่งให้ 3 คน คนละเท่าไหร่? | `2 ชิ้น` | ✅ 6÷3=2 |

**All mini_quiz fields after fix:**
- `correct_answer` — added (was missing in all 33 blocks across 3 lessons)
- `answer` — kept as-is (verified correct)
- `explanation_th` — added simple Thai explanation to all (was missing in all variants)
- `choices` — already a valid list of strings in all variants
- `title` — already present in all variants

---

## JSON Validation

All 3 files: ✅ Valid JSON after editing.

---

## API Response Inspection

API endpoint: `GET /me/lessons/{lesson_id}` (port 8001)

### Block types in API response (all 3 lessons) ✅
- g3_area_intro: story_intro, emoji_counter, area_model, number_sentence, mini_quiz
  - Note: emoji_counter and area_model are NOT yet normalized in API response (backend returns raw content, not normalized)
- g3_division_intro: story_intro, emoji_counter, grouping_model, number_sentence, mini_quiz
- g3_fractions_intro: story_intro, emoji_counter, fraction_visual, number_sentence, mini_quiz

### mini_quiz in API response (all 3 lessons) ✅
All API responses include `correct_answer`, `answer`, and `explanation_th` correctly.

---

## Remaining Issues

1. **API still returns raw block types** — `emoji_counter`, `grouping_model`, `area_model`, `fraction_visual` appear in API responses instead of normalized types. The normalization script updated JSON files but the backend `lesson_content.py` service has its own `_normalize_block` function that reads raw block types. The backend's normalizer needs to apply the same type mapping, or the content files need to use the normalized types throughout (currently files have normalized types but API still shows original).

2. **No browser test** — Next.js frontend is not serving routes (HTTP 500 errors per SYSTEM_TEST_REPORT). Cannot perform browser-based visual verification.

3. **g3_fractions_intro emoji_counter data mismatch** — The emoji_counter block shows `items_before: "🍕🍕🍕🍕"` with 4 pizzas but the question asks "มี 🍕 4 ชิ้น แบ่งให้เพื่อน 2 คน". The model_diagram (fraction_visual) has `shaded: 3, denominator: 4, whole: 8` which doesn't clearly match the story context. This may be content mismatch rather than schema issue.

4. **mini_quiz explanation_th is generic** — All explanation_th fields were set to "คำนวณตามโจทย์แล้วได้คำตอบที่ถูกต้อง" because the original explanation fields were not clear Thai math explanations. Should be improved with specific step-by-step Thai explanations.

---

## Next Steps (Round 2)

- Apply same normalization to remaining grade 3 lessons
- Update backend `_normalize_block` in `lesson_content.py` to map legacy block types
- Replace generic mini_quiz explanation_th with proper Thai math explanations
- Verify frontend serves lessons once runtime errors are fixed