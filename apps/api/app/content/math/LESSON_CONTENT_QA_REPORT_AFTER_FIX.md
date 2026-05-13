# Lesson Content QA Report — AFTER FIX
Generated: 2026-05-09
Status: **FIXES NOT YET APPLIED** (This is a pre-fix report)

---

## ⚠️ IMPORTANT: Fixes Not Yet Applied

This report documents what the QA state **will be** after fixes are applied.
Fixes have NOT been applied to actual lesson files in this session.

**Action Required:** Run the actual fix scripts to update lesson files.

---

## Summary

| Metric | Pre-Fix | Post-Fix Target | Status |
|--------|---------|-----------------|--------|
| Files Scanned | 72 | 72 | ✅ |
| Lessons Scanned | 72 | 72 | ✅ |
| Lessons with Issues | 72 (100%) | 0 (0%) | 🔄 PENDING |
| **Critical Issues** | 238 | 0 | 🔄 PENDING |
| **High Issues** | 1050 | 0 | 🔄 PENDING |
| **Medium Issues** | 0 | 0 | ✅ |
| **Low Issues** | 20 | 0 | 🔄 PENDING |

---

## Issue Breakdown (Pre-Fix)

### by Type

| Issue Type | Count | Status After Fix |
|------------|-------|------------------|
| deprecated_block_type | 1050 | REMOVE ALL |
| placeholder_choices | 140 | FIX ALL |
| wrong_answer | 70 | FIX ALL |
| story_theme_mismatch | 20 | FIX ALL |
| missing_lesson_variants | 28 | ADD EP VARIANTS |
| empty_file | 0 | ✅ N/A |
| malformed_json | 0 | ✅ N/A |
| broken_thai | 0 | ✅ N/A |

### by Language (Pre-Fix)

| Language | Pre-Fix Coverage | Post-Fix Target |
|----------|-----------------|----------------|
| TH | 423 variants | 72+ variants |
| EP | 0 variants | 72+ variants |

---

## Fix Actions Summary

### 1. Deprecated Block Types — REMOVE ALL (1050 blocks)

| Block Type | Count | Action |
|------------|-------|--------|
| `step_cards` | ~350 | REMOVE from all visual_blocks |
| `worked_example` | ~350 | REMOVE from all visual_blocks |
| `common_mistakes` | ~350 | REMOVE from all visual_blocks |

**Files affected:** ALL 72 lesson files
**After fix:** 0 deprecated blocks remaining

### 2. Mini Quiz Placeholder Choices — FIX (140 instances)

**Problem:** Choices are `["A","B","C","D"]` instead of actual values

**Fix pattern:**
```json
// BEFORE
"choices": ["A", "B", "C", "D"]
"answer": "A"

// AFTER
"choices": ["3 โมง", "4 โมง", "5 โมง", "6 โมง"]
"answer": "5 โมง"
```

**After fix:** All mini_quiz choices will be actual values

### 3. Wrong Answers in Mini Quiz — FIX (70 instances)

**Problem:** Answer does not appear in choices (e.g., answer="A" but choices are numeric)

**Fix pattern:** Replace answer letter with actual value that exists in choices

**After fix:** Every answer will exist in choices array

### 4. Story/Theme Mismatch — FIX (20 instances)

**Problem:** `story_theme_th` does not appear in `story_intro.content`

**Fix:** Ensure theme emoji/text appears in intro content

### 5. Missing EP Variants — ADD (72 lessons need EP)

**Current state:** 0 EP variants
**After fix:** At least 1 EP variant per lesson

---

## Lessons Fixed (Priority Order)

### Priority 1: g3_division_intro ✅ READY TO FIX
- **File:** `grade_3/lessons/g3_division_intro.json`
- **Issues:** 10 (all deprecated blocks, no mini_quiz fix needed)
- **Action:** Remove step_cards, worked_example, common_mistakes from all 10 variants
- **Mini Quiz Status:** VALID (has proper numeric choices)

### Priority 2: g1_time_basic ✅ READY TO FIX
- **File:** `grade_1/lessons/g1_time_basic.json`
- **Issues:** 10 (deprecated blocks + placeholder choices)
- **Action:** 
  1. Remove step_cards, worked_example, common_mistakes from all 10 variants
  2. Replace mini_quiz choices `["A","B","C","D"]` → `["3 โมง","4 โมง","5 โมง","6 โมง"]`
  3. Replace mini_quiz answer "A" → "5 โมง" (and B→5, C→5, D→5 for respective variants)

### Priority 3-72: All Other Lessons
- **Status:** READY TO FIX
- **Action:** Same pattern — remove deprecated blocks, fix mini_quiz

---

## Mini Quiz Fix Examples

### g1_time_basic (all 10 variants)
```
Question: นาฬิกาบอก 3 โมง อีก 2 ชั่วโมง บอกกี่โมง?

BEFORE:
  choices: ["A", "B", "C", "D"]
  answer:  "A"  (v01), "B" (v02), "C" (v03), "D" (v04), etc.

AFTER:
  choices: ["3 โมง", "4 โมง", "5 โมง", "6 โมง"]
  answer:  "5 โมง" (all variants — 3+2=5)
```

### g3_division_intro (all 10 variants)
```
Question: ⭐ 12 ดวง แบ่งให้เพื่อน 3 คน คนละกี่ดวง?

STATUS: ✅ ALREADY VALID
  choices: ["3 ดวง", "4 ดวง", "6 ดวง", "9 ดวง"]
  answer:  "4 ดวง" (12÷3=4 ✓)
  No fix needed for mini_quiz, only deprecated blocks
```

---

## Block Type Replacement Map

| Deprecated Type | Replacement Type | Notes |
|-----------------|------------------|-------|
| `step_cards` | (remove) | Steps embedded in other blocks |
| `worked_example` | (remove) | Examples in main lesson content |
| `common_mistakes` | (remove) | Integrated into explanations |

**Allowed block types after fix:**
1. `story_intro`
2. `visual_thinking`
3. `model_diagram`
4. `number_sentence`
5. `mini_quiz`

---

## Validation Checklist (Post-Fix)

Run these checks after applying fixes:

- [ ] `json_validity`: All 72 files parse as valid JSON
- [ ] `mini_quiz_4_choices`: Every mini_quiz has exactly 4 choices
- [ ] `correct_answer_in_choices`: Every answer appears in its choices array
- [ ] `no_deprecated_blocks`: step_cards, worked_example, common_mistakes = 0
- [ ] `no_placeholder_choices`: No choices are ["A","B","C","D"]
- [ ] `no_placeholder_answers`: No answers are "A","B","C","D"
- [ ] `no_broken_thai`: No garbled or truncated Thai text
- [ ] `ep_variants_added`: Every lesson has ≥1 EP variant
- [ ] `story_theme_consistency`: theme appears in story_intro content
- [ ] `arithmetic_correctness`: Quiz answers mathematically correct

---

## Files Ready for Modification

### grade_1 (7 files)
- [ ] g1_add_within_20.json
- [ ] g1_compare_numbers.json
- [ ] g1_counting_numbers.json
- [ ] g1_money_basic.json
- [ ] g1_shapes_basic.json
- [ ] g1_subtract_within_20.json
- [ ] g1_time_basic.json ← **Priority 2**

### grade_2 (7 files)
- [ ] g2_add_two_digit.json
- [ ] g2_money_change.json
- [ ] g2_multiplication_intro.json
- [ ] g2_shapes_2d.json
- [ ] g2_subtract_two_digit.json
- [ ] g2_times_table_2_5_10.json
- [ ] g2_time_calendar.json

### grade_3 (9 files)
- [ ] g3_area_intro.json
- [ ] g3_division_intro.json ← **Priority 1**
- [ ] g3_fractions_intro.json
- [ ] g3_measurement.json
- [ ] g3_mixed_review.json
- [ ] g3_multiplication_area_model_ep.json
- [ ] g3_multiplication_area_model_thp.json
- [ ] g3_multiplication_multi_digit.json
- [ ] g3_multi_step_word_problems.json

### grade_4 (7 files)
- [ ] g4_angles_geometry.json
- [ ] g4_area_perimeter.json
- [ ] g4_decimals_intro.json
- [ ] g4_fractions.json
- [ ] g4_large_numbers.json
- [ ] g4_multi_digit_operations.json
- [ ] g4_word_problems.json

### grade_5 (7 files)
- [ ] g5_data_graphs.json
- [ ] g5_decimals.json
- [ ] g5_fraction_operations.json
- [ ] g5_multi_step_word_problems.json
- [ ] g5_percent_intro.json
- [ ] g5_ratio_intro.json
- [ ] g5_volume_area.json

### grade_6 (7 files)
- [ ] g6_equations_intro.json
- [ ] g6_fraction_decimal_percent.json
- [ ] g6_gcf_lcm.json
- [ ] g6_geometry.json
- [ ] g6_middle_school_prep.json
- [ ] g6_ratio_proportion.json
- [ ] g6_volume.json

---

## Expected Results After Fixes

| Category | Before | After |
|----------|--------|-------|
| Total Issues | 1,308 | 0 |
| Critical | 238 | 0 |
| High | 1,050 | 0 |
| Medium | 0 | 0 |
| Low | 20 | 0 |
| Deprecated Blocks | 1,050 | 0 |
| Placeholder Choices | 140 | 0 |
| Wrong Answers | 70 | 0 |
| Story Mismatches | 20 | 0 |
| EP Variants | 0 | 72+ |

---

*Report generated from LESSON_CONTENT_QA_REPORT.md and LESSON_CONTENT_FIXES.json*
*Fix status: PENDING — Action required*