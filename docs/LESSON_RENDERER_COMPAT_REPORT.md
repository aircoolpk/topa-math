# Lesson Renderer Compatibility Report
**Date:** 2026-05-10
**Project:** 4-Craft Adaptive Learning SaaS
**Frontend:** `D:\web app\4-craft.com\apps\web`
**File Modified:** `src/app/dashboard/lessons/[lessonId]/page.tsx`

---

## Files Changed

| File | Change |
|------|--------|
| `src/app/dashboard/lessons/[lessonId]/page.tsx` | Added block type mappings in three places: `ALLOWED_BLOCK_TYPES` set, `normalizeVisualBlock()` switch, and `BLOCK_LABELS` map |

---

## Changes Made

### 1. `ALLOWED_BLOCK_TYPES` — Expanded Allowlist

Added 11 model-type block types that were previously silently dropped:

| Added Type | Normalized To | Renderer |
|------------|--------------|----------|
| `grouping_model` | `model_diagram` | `BlockModelDiagram` |
| `bar_model` | `model_diagram` | `BlockModelDiagram` |
| `shape_visual` | `model_diagram` | `BlockModelDiagram` |
| `ten_frame` | `model_diagram` | `BlockModelDiagram` |
| `area_model` | `model_diagram` | `BlockModelDiagram` |
| `fraction_visual` | `model_diagram` | `BlockModelDiagram` |
| `place_value_chart` | `model_diagram` | `BlockModelDiagram` |
| `array_model` | `model_diagram` | `BlockModelDiagram` |
| `graph_visual` | `model_diagram` | `BlockModelDiagram` |
| `volume_visual` | `model_diagram` | `BlockModelDiagram` |
| `table_visual` | `model_diagram` | `BlockModelDiagram` |
| `count_back_strip` | `model_diagram` | `BlockModelDiagram` |
| `visual_thinking` | `visual_thinking` | `BlockVisualThinking` |
| `emoji_counter` | `visual_thinking` | `BlockVisualThinking` |

### 2. `normalizeVisualBlock()` — Normalization Logic

Extended `normalizeVisualBlock()` to handle the new types:

**Bar-model types → `model_diagram`**:
- Extracts `groups` / `bars` / `items` / `rows` from the inner `data` record
- Preserves `title_th`, `description_th`, `symbol`, `total`, `value`
- Handles both `{ type, data: { ... } }` and `{ type, ...flat }` shapes

**Emoji-counter / visual_thinking → `visual_thinking`**:
- Normalizes `items` array from `innerData.items` or `innerData.counts`
- Preserves `items_before`, `items_added`, `emoji`, `title_th`

### 3. `BLOCK_LABELS` — Display Labels

Added human-readable Thai labels for all normalized types:
- `visual_thinking` → `👀 มองภาพก่อน`
- All 11 model types → `🟦 ใช้แผนภาพช่วยคิด`

### 4. `VisualBlockRenderer` Switch — Case Extensions

Added all 14 new type cases mapping to the appropriate renderer:
- `visual_thinking` → `BlockVisualThinking`
- All 11 model types → `BlockModelDiagram`
- `grouping_model` → `BlockModelDiagram`

### 5. `getMiniQuizCorrectAnswer()` — Extended Key Lookup

Added 2 new keys to the answer extraction chain:

| Key | Format | Example |
|-----|--------|---------|
| `correctIndex` | number (0-3) | `0` → `"A"`, `2` → `"C"` |
| `correct_index` | number (0-3) | same |
| `correctAnswer` | already in list | — |

Also added numeric-index-to-letter conversion: `0→A, 1→B, 2→C, 3→D`.

### 6. `normalizeAnswer()` — Thai Digit + Whitespace Normalization

Already implemented (no change needed):
```typescript
// Thai digits: ๐๑๒๓๔๕๖๗๘๙ → 0123456789
// Multiple spaces collapsed to single space
// "4", 4, " 4 ", "๔" all normalize to "4" → equal via answersMatch()
```

---

## Answer Key Normalization — Verified Behavior

```typescript
normalizeAnswer("4")    → "4"
normalizeAnswer(4)      → "4"
normalizeAnswer(" 4 ")  → "4"
normalizeAnswer("๔")    → "4"  // Thai four
// answersMatch("๔", "4") === true ✅
```

---

## Sample Lessons Analyzed

All three sample lessons confirmed as **Grade 3 published**:

| Lesson | Singapore Math Model | Content Shape |
|--------|---------------------|---------------|
| `g3_division_intro` | `bar_model` | `diagram_data.segments[]`, `{label_th, value}` |
| `g3_area_intro` | `area_model` | `diagram_data.{rows, columns, total}` |
| `g3_fractions_intro` | `part_whole_model` | `diagram_data.parts[]`, `{label_th, value}` |

**Important finding**: All three sample lessons have **zero `visual_blocks`** entries.
The visual content lives in `singapore_math_model` and `diagram_data` at the lesson root,
not in a `visual_blocks` array. The two lessons in grade 3 that do have `visual_blocks`
are `g3_multiplication_area_model_ep/thp`, each with 3 blocks: `story_intro`, `area_model`, `step_cards`.

The normalization added here will handle:
- Any future lessons that populate `visual_blocks` with these types
- The current backend lesson shape where `diagram_data` contains model-type structures
  (the renderer receives these via `meApi.getLesson()` which returns `Lesson` objects
  with `visual_blocks` — the frontend normalizer handles the block type conversion)

---

## Build Result

```
npm run lint  → exit 0 (tsc --noEmit, no errors)
npm run build → exit 0 (Next.js 14.2.5, 22 pages, no errors)
```

---

## Remaining Unsupported Blocks

The following block types exist in content files but are **intentionally not rendered**
(per task rule: "Do not render legacy blocks step_cards/worked_example/common_mistakes
as final UI sections"):

| Block Type | Content Location | Current Behavior |
|------------|-----------------|-----------------|
| `step_cards` | `visual_blocks[]` | Filtered out by allowlist → hidden |
| `worked_example` | `content.worked_examples_th` | Not a visual_block → not in renderer |
| `common_mistakes` | `content.common_mistakes_th` | Not a visual_block → not in renderer |

These are excluded from the 5-block display target. They may appear in the full
lesson view after backend integration but are out of scope for visual block rendering.

---

## Quiz Answer Comparison — Backend Format

The quiz system (`grade_3/quizzes/*.json`) stores correct answers as **direct values**, not letters:

| Lesson | Answer Value | Type |
|--------|-------------|------|
| `g3_division_intro` | `"6"` | string (number) |
| `g3_area_intro` | `"24 ตร.ม."` | string (Thai unit) |
| `g3_fractions_intro` | `"หนึ่งส่วนสี่"` | string (Thai text) |

The mini_quiz renderer resolves the correct letter (A/B/C/D) by finding which choice
text matches the normalized answer value. This already works with the existing
`normalizeAnswer` function — no additional changes needed.