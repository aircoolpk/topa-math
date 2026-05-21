# BETA_LESSON_TEACHING_QUALITY_PASS_ROUND_1

## Date: 2026-05-15
## Subagent: teaching-quality-worker

## SUMMARY

Reviewed all 16 lesson files for Grade 1-3 Singapore Math style lessons.

**Location:** `C:\web-app\4-craft.com\apps\api\app\content\math`

**Backup folder:** `backup_teaching_quality_round1\` (16 files backed up)

## FINDINGS

### Pattern Observed in All Files

All lesson files show a **PARTIAL IMPROVEMENT** state:
- **v01, v02, v03** (first 3 variants): Properly improved with Singapore Math teaching quality
- **v04 onward** (remaining variants): Reverted to old low-quality teaching style

### Old/Problematic Block Types Still Present:
- `emoji_counter` - Generic, doesn't match lesson concept
- `ten_frame` - Misused for non-counting lessons  
- `bar_model` - Misused, values don't match story
- `shape_visual` - Generic shapes, no lesson relevance
- `step_cards` - Discouraged block type

### Story Intro Problems:
- Generic content like "มาเรียนรู้การบวกเลขกันดีกว่า! ของเยอะขึ้นต้องบวกเพิ่มนะ"
- No clear child-friendly problem statement
- No proper 3-5 sentence story structure

### Mini Quiz Problems:
- Choices are generic numbers not related to the question
- Example: `choices: [6, 4, 5, 2]` for question "5 + 7 = ?"
- `correct_answer` field missing in some places
- `explanation_th` is generic "คำนวณตามโจทย์แล้วได้คำตอบที่ถูกต้อง"

### Number Sentence Expression Issues:
- Hardcoded expressions like `8 + 7 = 15` repeated across all variants
- Doesn't match the actual story problem numbers
- Missing proper `grouping_model` for multiplication/division lessons

### Grade 2-3 Specific Issues:
- `g2_add_two_digit.json` - Uses `place_value_chart` and `ten_frame` which aren't proper Singapore Math visuals for 2-digit addition
- `g2_money_change.json` - mini_quiz has wrong answer `answer: "25"` when correct is `"25"` (string format mismatch)
- `g2_multiplication_intro.json` - mini_quiz `correct_answer: "3"` when actual answer should be `12` (3×4=12)
- `g3_fractions_intro.json` - Uses `fraction_visual` but with wrong numbers (`whole: 8, shaded: 3, denominator: 4`)
- `g3_measurement.json` - Story intro is measurement but uses `emoji_counter` with ruler emojis unrelated to actual measurement conversion problems

## STANDARDS VIOLATED

1. **Block Types Used Incorrectly:**
   - `emoji_counter` used in lessons that aren't about counting objects
   - `ten_frame` used in lessons about comparison, shapes, money
   - `bar_model` values don't match the story numbers

2. **Mini Quiz Issues:**
   - Question doesn't match lesson concept
   - Choices are generic unrelated numbers
   - `correct_answer` missing or wrong
   - `explanation_th` too generic

3. **Story Intro Not Child-Friendly:**
   - Generic template text reused
   - No clear problem statement
   - Missing 3-5 sentence structure

4. **Mathematical Correctness:**
   - Model dimensions don't match story numbers
   - Expression doesn't match model
   - Inconsistent answer formats (string vs number)

## LESSONS ANALYZED

### Grade 1 (6 lessons):
- `g1_add_within_20.json` - v01-v03 improved, v04-v08 need work
- `g1_compare_numbers.json` - v01-v03 improved, v04-v08 need work
- `g1_counting_numbers.json` - v01-v03 improved, v04-v08 need work
- `g1_money_basic.json` - v01-v03 improved, v04-v08 need work
- `g1_shapes_basic.json` - v01-v03 improved, v04-v08 need work
- `g1_subtract_within_20.json` - v01-v03 improved, v04-v08 need work

### Grade 2 (7 lessons):
- `g2_add_two_digit.json` - Mixed quality, needs complete review
- `g2_money_change.json` - Mixed quality, mini_quiz answer wrong
- `g2_multiplication_intro.json` - Mixed quality, mini_quiz correct_answer wrong
- `g2_shapes_2d.json` - Mixed quality
- `g2_subtract_two_digit.json` - Mixed quality
- `g2_time_calendar.json` - Mixed quality
- `g2_times_table_2_5_10.json` - Mixed quality

### Grade 3 (3 lessons):
- `g3_fractions_intro.json` - Mixed quality, fraction_visual numbers wrong
- `g3_measurement.json` - Mixed quality, story doesn't match visual
- `g3_mixed_review.json` - Mixed quality

## RECOMMENDATION

All 16 files need **complete re-improvement** following the standards:

1. **story_intro**: 3-5 sentences, child-friendly, clear problem
2. **visual type**: Must match lesson concept (grouping_model for multiplication, etc.)
3. **model_diagram**: Must explain the model clearly
4. **number_sentence**: Must match the story and model
5. **mini_quiz**: Question must test lesson concept, choices must be actual answer values, `correct_answer` required, `explanation_th` in simple Thai

## STATUS
- [x] All 16 files backed up to `backup_teaching_quality_round1\`
- [ ] No files have been modified yet
- [ ] Complete re-improvement needed for all 16 lessons