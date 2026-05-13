# Lesson Content Fix Changelog
Generated: 2026-05-09
Status: PLANNED (not yet applied)

## Overview

| Metric | Count |
|--------|-------|
| Total Lessons to Fix | 72 |
| Total Fix Actions Planned | 1,308 |
| Deprecated Blocks to Remove | 1,050 |
| Mini Quiz Choices to Fix | 140 |
| Wrong Answers to Fix | 70 |
| Story/Theme Mismatches | 20 |
| EP Variants to Add | 72 |

---

## Fix Priority Order

### Priority 1: g3_division_intro
**File:** `grade_3/lessons/g3_division_intro.json`
**Issues Found:** 10 high

| # | Variant | Issue Type | Action |
|---|---------|------------|--------|
| 1 | v01-v10 | step_cards (deprecated) | REMOVE |
| 2 | v01-v10 | worked_example (deprecated) | REMOVE |
| 3 | v01-v10 | common_mistakes (deprecated) | REMOVE |
| 4 | v01-v10 | mini_quiz choices valid | OK (not placeholder) |

**Mini Quiz Status:** g3_division_intro mini_quiz has proper numeric choices, no fix needed.

### Priority 2: g1_time_basic
**File:** `grade_1/lessons/g1_time_basic.json`
**Issues Found:** 10 high

| # | Variant | Issue Type | Action |
|---|---------|------------|--------|
| 1 | v01-v10 | step_cards (deprecated) | REMOVE |
| 2 | v01-v10 | worked_example (deprecated) | REMOVE |
| 3 | v01-v10 | common_mistakes (deprecated) | REMOVE |
| 4 | v01-v10 | mini_quiz placeholder choices | FIX: Replace ["A","B","C","D"] with ["3 โมง","4 โมง","5 โมง","6 โมง"] |
| 5 | v01-v10 | mini_quiz answer "A" not in choices | FIX: Set answer = "5 โมง" |

**Mini Quiz Fix Required:**
- v01: answer "A" → "5 โมง", choices ["A","B","C","D"] → ["3 โมง","4 โมง","5 โมง","6 โมง"]
- v02: answer "B" → "5 โมง", choices ["A","B","C","D"] → ["3 โมง","4 โมง","5 โมง","6 โมง"]
- v03: answer "C" → "5 โมง", choices ["A","B","C","D"] → ["3 โมง","4 โมง","5 โมง","6 โมง"]
- v04: answer "D" → "5 โมง", choices ["A","B","C","D"] → ["3 โมง","4 โมง","5 โมง","6 โมง"]
- v05-v10: Same fix pattern

### Priority 3: All Mini Quiz Wrong Answers (70 instances)

| Lesson | File | Variants Affected | Fix Action |
|--------|------|-------------------|------------|
| g1_add_within_20 | grade_1 | v01-v10 | Replace placeholder answers with actual values |
| g1_compare_numbers | grade_1 | v01-v10 | Replace placeholder answers with actual values |
| g1_counting_numbers | grade_1 | v01-v10 | Replace placeholder answers with actual values |
| g1_money_basic | grade_1 | v01-v10 | Replace placeholder answers with actual values |
| g1_shapes_basic | grade_1 | v01-v10 | Replace placeholder answers with actual values |
| g1_subtract_within_20 | grade_1 | v01-v10 | Replace placeholder answers with actual values |
| g1_time_basic | grade_1 | v01-v10 | Replace placeholder answers + choices |
| g2_add_two_digit | grade_2 | v01-v10 | Replace placeholder answers with actual values |
| g2_money_change | grade_2 | v01-v10 | Replace placeholder answers with actual values |
| g2_multiplication_intro | grade_2 | v01-v10 | Replace placeholder answers with actual values |
| g2_shapes_2d | grade_2 | v01-v10 | Replace placeholder answers with actual values |
| g2_subtract_two_digit | grade_2 | v01-v10 | Replace placeholder answers with actual values |
| g2_times_table_2_5_10 | grade_2 | v01-v10 | Replace placeholder answers with actual values |
| g2_time_calendar | grade_2 | v01-v10 | Replace placeholder answers with actual values |
| g3_area_intro | grade_3 | v01-v10 | Replace placeholder answers with actual values |
| g3_division_intro | grade_3 | v01-v10 | Valid (no fix needed for mini_quiz) |
| g3_fractions_intro | grade_3 | v01-v10 | Replace placeholder answers with actual values |
| g3_measurement | grade_3 | v01-v10 | Replace placeholder answers with actual values |
| g3_mixed_review | grade_3 | v01-v10 | Replace placeholder answers with actual values |
| g3_multiplication_multi_digit | grade_3 | v01-v10 | Replace placeholder answers with actual values |
| g3_multi_step_word_problems | grade_3 | v01-v10 | Replace placeholder answers with actual values |
| g4_angles_geometry | grade_4 | v01-v10 | Replace placeholder answers with actual values |
| g4_area_perimeter | grade_4 | v01-v10 | Replace placeholder answers with actual values |
| g4_decimals_intro | grade_4 | v01-v10 | Replace placeholder answers with actual values |
| g4_fractions | grade_4 | v01-v10 | Replace placeholder answers with actual values |
| g4_large_numbers | grade_4 | v01-v10 | Replace placeholder answers with actual values |
| g4_multi_digit_operations | grade_4 | v01-v10 | Replace placeholder answers with actual values |
| g4_word_problems | grade_4 | v01-v10 | Replace placeholder answers with actual values |
| g5_data_graphs | grade_5 | v01-v10 | Replace placeholder answers with actual values |
| g5_decimals | grade_5 | v01-v10 | Replace placeholder answers with actual values |
| g5_fraction_operations | grade_5 | v01-v10 | Replace placeholder answers with actual values |
| g5_multi_step_word_problems | grade_5 | v01-v10 | Replace placeholder answers with actual values |
| g5_percent_intro | grade_5 | v01-v10 | Replace placeholder answers with actual values |
| g5_ratio_intro | grade_5 | v01-v10 | Replace placeholder answers with actual values |
| g5_volume_area | grade_5 | v01-v10 | Replace placeholder answers with actual values |
| g6_equations_intro | grade_6 | v01-v10 | Replace placeholder answers with actual values |
| g6_fraction_decimal_percent | grade_6 | v01-v10 | Replace placeholder answers with actual values |
| g6_gcf_lcm | grade_6 | v01-v10 | Replace placeholder answers with actual values |
| g6_geometry | grade_6 | v01-v10 | Replace placeholder answers with actual values |
| g6_middle_school_prep | grade_6 | v01-v10 | Replace placeholder answers with actual values |
| g6_ratio_proportion | grade_6 | v01-v10 | Replace placeholder answers with actual values |
| g6_volume | grade_6 | v01-v10 | Replace placeholder answers with actual values |

### Priority 4: Deprecated Block Removal (1,050 blocks)

All 72 lessons have these deprecated block types in visual_blocks:

| Block Type | Count | Action |
|------------|-------|--------|
| step_cards | ~350 | REMOVE |
| worked_example | ~350 | REMOVE |
| common_mistakes | ~350 | REMOVE |

**Affected Files:** All 72 lesson JSON files across grade_1 through grade_6

### Priority 5: Story/Theme Mismatches (20 instances)

| Lesson | Issue |
|--------|-------|
| grade_1/lessons/g1_shapes_basic.json | story_theme mismatch |
| grade_2/lessons/g2_shapes_2d.json | story_theme mismatch |
| grade_3/lessons/g3_fractions_intro.json | story_theme mismatch |
| grade_4/lessons/g4_fractions.json | story_theme mismatch |
| grade_5/lessons/g5_percent_intro.json | story_theme mismatch |
| grade_6/lessons/g6_fraction_decimal_percent.json | story_theme mismatch |
| (and 14 more) | |

### Priority 6: EP Variants (72 lessons need EP)

Currently: 0 EP variants
Target: At least 1 EP variant per lesson

**Format for EP variant:**
```json
{
  "variant_id": "ep_v01",
  "variant_title_en": "School Theme",
  "story_theme_en": "School",
  "visual_blocks": [
    {
      "type": "story_intro",
      "title": "🐣 Story Time",
      "content": "School 🏫: We have items to share equally with friends..."
    }
  ]
}
```

---

## Files to Modify (72 total)

### grade_1 (7 files)
- g1_add_within_20.json
- g1_compare_numbers.json
- g1_counting_numbers.json
- g1_money_basic.json
- g1_shapes_basic.json
- g1_subtract_within_20.json
- g1_time_basic.json

### grade_2 (7 files)
- g2_add_two_digit.json
- g2_money_change.json
- g2_multiplication_intro.json
- g2_shapes_2d.json
- g2_subtract_two_digit.json
- g2_times_table_2_5_10.json
- g2_time_calendar.json

### grade_3 (9 files)
- g3_area_intro.json
- g3_division_intro.json
- g3_fractions_intro.json
- g3_measurement.json
- g3_mixed_review.json
- g3_multiplication_area_model_ep.json
- g3_multiplication_area_model_thp.json
- g3_multiplication_multi_digit.json
- g3_multi_step_word_problems.json

### grade_4 (7 files)
- g4_angles_geometry.json
- g4_area_perimeter.json
- g4_decimals_intro.json
- g4_fractions.json
- g4_large_numbers.json
- g4_multi_digit_operations.json
- g4_word_problems.json

### grade_5 (7 files)
- g5_data_graphs.json
- g5_decimals.json
- g5_fraction_operations.json
- g5_multi_step_word_problems.json
- g5_percent_intro.json
- g5_ratio_intro.json
- g5_volume_area.json

### grade_6 (7 files)
- g6_equations_intro.json
- g6_fraction_decimal_percent.json
- g6_gcf_lcm.json
- g6_geometry.json
- g6_middle_school_prep.json
- g6_ratio_proportion.json
- g6_volume.json

---

## Validation Checklist (Post-Fix)

After applying fixes, verify:

- [ ] All JSON files are valid (parseable)
- [ ] Every mini_quiz block has exactly 4 choices
- [ ] Every mini_quiz correct_answer appears in choices array
- [ ] No deprecated block types remain (step_cards, worked_example, common_mistakes)
- [ ] No placeholder choices ["A","B","C","D"]
- [ ] No placeholder answers "A","B","C","D"
- [ ] No broken Thai text
- [ ] Every lesson has at least 1 TH variant
- [ ] Every lesson has at least 1 EP variant
- [ ] story_theme matches content in story_intro
- [ ] Arithmetic in mini_quiz is correct

---

*Changelog generated from LESSON_CONTENT_QA_REPORT.md and LESSON_CONTENT_FIXES.json*