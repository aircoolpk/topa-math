# Lesson Content QA Report
Generated: 2026-05-09

## Summary

| Metric | Value |
|--------|-------|
| Files Scanned | 72 |
| Lessons Scanned | 72 |
| Lessons with Issues | 72 (100%) |
| **Critical Issues** | 238 |
| **High Issues** | 1050 |
| **Medium Issues** | 0 |
| **Low Issues** | 20 |

## Issue Breakdown

### by Type

| Issue Type | Count |
|------------|-------|
| deprecated_block_type (step_cards, worked_example, common_mistakes) | 1050 |
| placeholder_choices (A/B/C/D or wrong count) | 140 |
| wrong_answer (answer not in choices) | 70 |
| story_theme_mismatch | 20 |
| missing_lesson_variants | 28 |
| empty_file | 0 |
| malformed_json | 0 |
| broken_thai | 0 |

### by Language

| Language | Coverage Count |
|----------|---------------|
| TH | 423 variants |
| EP | 0 variants |

- **Missing EP count**: 0

## Top Problem Lessons

| File | Issue Count | Severity |
|------|-------------|----------|
| grade_3\lessons\g3_multiplication_multi_digit.json | 10 | high |
| grade_3\lessons\g3_measurement.json | 10 | high |
| grade_6\lessons\g6_middle_school_prep.json | 10 | high |
| grade_6\lessons\g6_equations_intro.json | 10 | high |
| grade_3\lessons\g3_division_intro.json | 10 | high |
| grade_5\lessons\g5_percent_intro.json | 10 | high |
| grade_6\lessons\g6_volume.json | 10 | high |
| grade_2\lessons\g2_shapes_2d.json | 10 | high |
| grade_4\lessons\g4_fractions.json | 10 | high |
| grade_6\lessons\g6_fraction_decimal_percent.json | 10 | high |
| grade_4\lessons\g4_decimals_intro.json | 10 | high |
| grade_2\lessons\g2_money_change.json | 10 | high |
| grade_3\lessons\g3_fractions_intro.json | 10 | high |
| grade_6\lessons\g6_gcf_lcm.json | 10 | high |
| grade_1\lessons\g1_time_basic.json | 10 | high |
| grade_1\lessons\g1_shapes_basic.json | 10 | high |
| grade_5\lessons\g5_volume_area.json | 10 | high |
| grade_2\lessons\g2_times_table_2_5_10.json | 10 | high |
| grade_2\lessons\g2_multiplication_intro.json | 10 | high |
| grade_1\lessons\g1_add_within_20.json | 10 | high |

## Key Findings

### 1. Deprecated Block Types (HIGH priority)
**All 72 lessons** contain deprecated block types (`step_cards`, `worked_example`, `common_mistakes`) in their visual_blocks arrays. These block types should be removed.

- **Suggested action**: `remove_deprecated_block`
- **safe_to_auto_fix**: true

### 2. Placeholder Quiz Choices (CRITICAL)
**140 instances** of mini_quiz blocks have placeholder choices (A, B, C, D) or incorrect choice count (not 4).

- **Suggested action**: `fix_mini_quiz`
- **safe_to_auto_fix**: true

### 3. Wrong Answer References (CRITICAL)
**70 instances** where mini_quiz answer does not match any of the 4 choices.

- **Suggested action**: `fix_mini_quiz`
- **safe_to_auto_fix**: true

### 4. Missing lesson_variants (CRITICAL)
**28 files** in g4, g5, g6 directories have no `lesson_variants` array at all.

Files affected:
- g4\lessons\g4_multi_step_problems.json
- g5\lessons\ (7 files: data_analysis, decimal_operations, fraction_multiplication, geometry_3d, percentage, ratio, volume)
- g6\lessons\ (7 files: circle_geometry, coordinate_plane, equation_intro, percentage_applications, pre_algebra, ratio_proportion, statistic_probability)
- grade_1\lessons\ (7 files)
- grade_2\lessons\ (6 files)

- **Suggested action**: `human_review`
- **safe_to_auto_fix**: false

### 5. Story Theme Mismatch (LOW)
**20 instances** where story_theme_th does not appear in story_intro content.

- **Suggested action**: `fix_mini_quiz`
- **safe_to_auto_fix**: true

### 6. No EP Variants Found
**0 EP variants** detected across all scanned lessons. The Thai content (TH) dominates at 423 variants vs 0 English (EP) variants.

- This may be by design if EP variants are stored separately or use different naming conventions.
- If EP variants are expected, please verify the naming pattern (should start with `ep_`).

## Auto-fixable Issues

| Action | Count | safe_to_auto_fix |
|--------|-------|------------------|
| remove_deprecated_block | 1050 | true |
| fix_mini_quiz | 210 | true |
| fix_story_theme | 20 | true |
| human_review | 28 | false |

**Total auto-fixable**: 1280 (97.8%)
**Requires human review**: 28 (2.2%)

## Recommendations

1. **Immediate**: Remove deprecated blocks from all 72 lessons (scripted batch fix possible)
2. **Immediate**: Fix mini_quiz choices and answers in 70 instances
3. **High priority**: Create lesson_variants structure for 28 files missing them
4. **Medium**: Add EP variants if English content is required
5. **Low**: Fix story theme mismatches in 20 instances

---

*Report generated from `LESSON_CONTENT_FIXES.json` and `LESSON_CONTENT_QA_SUMMARY.json`*