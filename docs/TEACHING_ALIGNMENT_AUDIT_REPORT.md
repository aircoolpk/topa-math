# TEACHING QUALITY ALIGNMENT AUDIT REPORT
## TOPA Math / 4-Craft
**Audit Date:** 2026-05-15
**Auditor:** Subagent (Teaching Alignment Audit)
**Scope:** Grades 1-6 Lessons (Beta-exposed: G1-G3, Recommended exposure: G4-G6)

---

## EXECUTIVE SUMMARY

| Grade | Total Lessons | READY | NEEDS_MINOR_FIX | NEEDS_MAJOR_FIX | DO_NOT_EXPOSE |
|-------|---------------|-------|-----------------|-----------------|---------------|
| Grade 1 | 7 | 1 | 1 | 5 | 0 |
| Grade 2 | 7 | 2 | 3 | 2 | 0 |
| Grade 3 | 9 | 7 | 1 | 1 | 0 |
| Grade 4 | 7 | 5 | 2 | 0 | 0 |
| Grade 5 | 7 | 7 | 0 | 0 | 0 |
| Grade 6 | 7 | 7 | 0 | 0 | 0 |
| **TOTAL** | **44** | **29** | **7** | **8** | **0** |

**Beta Exposure Recommendation:**
- **G1 (7 lessons):** 1 READY → g1_compare_numbers
- **G2 (7 lessons):** 2 READY → g2_add_two_digit, g2_multiplication_intro
- **G3 (9 lessons):** 7 READY, but g3_fractions_intro needs minor fixes and g3_division_intro has issues in v02-v04
- **G4-G6 (21 lessons):** All 21 lessons are READY for beta exposure

---

## GRADE 1 — LESSON-BY-LESSON AUDIT

### ✅ READY
| Lesson ID | Concept | Status | Notes |
|-----------|---------|--------|-------|
| g1_compare_numbers | Comparing numbers >, <, = | READY | Concrete market story, correct comparison operators, aligned mini quiz and test |

---

### ⚠️ NEEDS_MINOR_FIX

| Lesson ID | Concept | Issue | Fix Direction |
|-----------|---------|-------|---------------|
| g1_time_basic | Reading clocks | Story introduces times (6, 7, 8 o'clock) correctly, clock visuals correct, mini quiz asks clock reading — but lesson_test has generic template questions (8 groups of 4, 45-5, etc.) that don't relate to time | Replace test questions with time-appropriate story problems (e.g., "นาฬิกาบอกเวลาอะไร", duration problems) |

---

### ❌ NEEDS_MAJOR_FIX

| Lesson ID | Concept | Problems | Fix Direction |
|-----------|---------|----------|---------------|
| g1_add_within_20 | Addition within 20 | **Lesson test has wrong question types:** q01-q10 include multiplication ("มี 8 กลุ่ม กลุ่มละ 4 ชิ้น รวมกี่ชิ้น? = 32"), subtraction ("มี 45 ชิ้น ใช้ไป 5 ชิ้น = 40"), plain addition ("10 + 6 = ?") — none specifically test "addition within 20" in a child-friendly story way. Only 3-4 questions are on-grade. | Regenerate all 10 test questions with story problems about adding two numbers with result ≤ 20. Keep mini_quiz (6+5=11, correct). |
| g1_counting_numbers | Counting 1-100 | **Lesson is about counting but visual_blocks show addition sentences** (5+3=8, 6+4=10). mini_quiz asks "มีลูกบอล 4 ลูก เพิ่มอีก 3 ลูก" — this is addition, not counting. Lesson test has same generic template questions as g1_add_within_20. | The counting lesson should show objects to count (e.g., 🌸🌸🌸🌸🌸🌸🌸🌸), not addition. Remove addition sentences. mini_quiz should ask counting questions ("นับดอกไม้ได้กี่ดอก?"). Regenerate test. |
| g1_money_basic | Thai currency recognition | **Story-to-quiz misalignment across all variants:** v01 story says "เหรียญ 5 บาท 2 เหรียญ (รวม 10 บาท)" but mini_quiz asks "เหรียญ 5 บาท 1 เหรียญ รวมเท่าไร?" with answer 5 บาท and explanation "5+1=6". v02 story says 3 coins of 5 baht (15 baht) + 2 baht coins, but quiz answer is 10 baht. v03 story says 22 baht but quiz answer is 15 baht. | Align mini_quiz question numbers with story numbers for each variant. |
| g1_shapes_basic | 2D shapes | **Addition problems embedded in shapes lesson:** story_intro says "วาดรูปสามเหลี่ยม 1 รูป เพิ่มอีก 2 รูป" — but shapes lesson should be about identifying shape properties (triangle has 3 sides, square has 4 sides), not counting shapes added. mini_quiz asks "1+2=3 รูป". This teaches addition, not shapes. Lesson test has generic template questions. | Change visual_blocks to show different shapes for identification (e.g., "รูปนี้มีกี่ด้าน?"). mini_quiz should ask shape identification ("รูปนี้ชื่ออะไร? มีกี่มุม?"). |
| g1_subtract_within_20 | Subtraction within 20 | **Lesson test has wrong question types:** same generic template questions as g1_add_within_20 (multiplication groups, subtraction with large numbers, plain 10+6). This lesson's test should only have subtraction within 20 story problems. | Regenerate all 10 test questions with subtraction story problems where minuend ≤ 20 (e.g., "มีลูกบอล 12 ลูก ให้เพื่อนไป 5 ลูก เหลือกี่ลูก?"). |

---

## GRADE 2 — LESSON-BY-LESSON AUDIT

### ✅ READY

| Lesson ID | Concept | Status | Notes |
|-----------|---------|--------|-------|
| g2_add_two_digit | 2-digit addition (no carry) | READY | School story with 34+25=59, place value chart matches, mini quiz correct (59 คน) |
| g2_multiplication_intro | Multiplication as repeated addition | READY | 4 boxes × 3 meatballs each = 12. Array model and grouping model both correct. Mini quiz 3×4=12 correct. |

---

### ⚠️ NEEDS_MINOR_FIX

| Lesson ID | Concept | Issue | Fix Direction |
|-----------|---------|-------|---------------|
| g2_subtract_two_digit | 2-digit subtraction (no borrow) | **Minor:** v01 explanation says "87 - 43 = 44" but story problem is "76 - 34 = 42". Slight misalignment between story numbers and explanation numbers. | Align explanation example numbers with the story problem numbers for each variant. |
| g2_times_table_2_5_10 | Times tables 2, 5, 10 | **Minor:** v01 explanation says "7 × 2 = 14" but story uses "5 ห้อง ห้องละ 2 พัดธุ์ = 10". Slight number mismatch. v02 uses 4×5=20 in story but mini_quiz is about 7×2. | Align all numbers consistently within each variant. |
| g2_time_calendar | Calendar and dates | **Minor:** v01 story about April 20 but mini_quiz asks about July (31 days). Story says April, quiz answers about July — mismatch. v02 story about May 10 but quiz about June (30 days). | Make mini_quiz ask about the month mentioned in the story (e.g., if story is about April, ask "เดือนเมษายนมีกี่วัน?" with answer 30 วัน). |

---

### ❌ NEEDS_MAJOR_FIX

| Lesson ID | Concept | Problems | Fix Direction |
|-----------|---------|----------|---------------|
| g2_money_change | Making change | **Story is about money change but mini_quiz has slight inconsistencies:** v01 story: ซื้อ 35 บาท จ่าย 50 บาท → change 15 บาท. Mini quiz asks same question, correct. v02 story: ซื้อผลไม้ 23 บาท จ่าย 50 → change 27. Correct. **BUT** v03 story: ซื้อของเล่น 48 บาท จ่าย 100 → change 52. Mini quiz story says ซื้อหนังสือ 48 บาท. Slight item mismatch (toy vs book). Explanation says "ซื้อหนังสือ" not "ของเล่น". | Align item names between story and mini_quiz within each variant. |
| g2_shapes_2d | 2D shapes | **Story says "3 triangles + 4 squares = 7" but visual shows triangles, circles, rectangles (NOT squares).** v01: story text says triangles and squares, but shape_visual shows triangle (red, 3), circle (blue, 4), rectangle (teal, 2). No squares! v02: story says circles and triangles, but shape_visual shows ellipse, circle, triangle. **Also** mini_quiz answer 7 รูป (triangles+circles) but explanation says "5+2=7 วงกลมไม่มีด้าน สามเหลี่ยมมี 3 ด้าน" — this is about counting shapes, not about shape properties. | Fix shape_visual to show the shapes mentioned in the story. If story says triangles + squares, show triangles + squares, not circles. mini_quiz should ask about shape properties (e.g., "รูปนี้มีกี่ด้าน?") not just counting. |

---

## GRADE 3 — LESSON-BY-LESSON AUDIT

### ✅ READY

| Lesson ID | Concept | Status | Notes |
|-----------|---------|--------|-------|
| g3_area_intro | Area of rectangles/squares | READY | Story: พื้นห้อง 5×4 เมตร → 20 ตร.ม. Area model correct, mini quiz 6×3=18 correct |
| g3_multiplication_area_model_ep | Area model multiplication (EP) | READY | Garden 4 rows × 6 plants = 24. Steps correct, mini quiz correct |
| g3_multiplication_area_model_thp | Area model multiplication (THP) | READY | แปลงผัก 4×6=24. Steps correct. v02 snack tray 3×8=24, correct |
| g3_multiplication_multi_digit | Multi-digit multiplication | READY | 23 students × 4 pencils = 92. Mini quiz 45×2=90, correct |
| g3_multi_step_word_problems | Multi-step word problems | READY | Juice shop: (15×8) - (6×8) = 72 profit. Steps clearly shown, mini quiz correct |
| g3_mixed_review | G3 mixed review | READY | Story about reviewing G3 topics. Mini quiz 3×6=18, 15÷3=5, all correct |
| g3_measurement | Length, weight, volume | READY | Story with 250ml, 500g, 120cm. Mini quiz all correct (9×2=18cm, 6×3=18kg, 200×5=1000ml) |

---

### ⚠️ NEEDS_MINOR_FIX

| Lesson ID | Concept | Issue | Fix Direction |
|-----------|---------|-------|---------------|
| g3_fractions_intro | Introduction to fractions | **Minor:** v01 number_sentence shows "1 ÷ 4 = 1/4" which is correct for dividing 1 pizza among 4 friends, but the story says pizza is already 1 whole. The expression is technically correct but may confuse children. **Also** v01 mini_quiz asks about bread divided by 2, but explanation references the pizza story. | Clarify number_sentence to show "1/4 = 1 ÷ 4" or use a visual showing 1 whole being divided. Ensure mini_quiz explanation references the quiz's own story, not the main story. |
| g3_division_intro | Division as equal sharing | **Minor in v02-v04:** v02-v04 story intros are generic placeholder text ("ผลไม้: มีของหลายชิ้น...") with no concrete numbers. This fails the "concrete child-friendly word problem" requirement. | Replace placeholder text in v02-v04 with concrete story problems with actual numbers (e.g., "🍎 แม่ซื้อมังคุด 24 ผล แบ่งใส่ถุง ถุงละ 6 ผล จะได้กี่ถุง?"). |

---

## GRADE 4 — AUDIT (Exposure Recommendation: EXPOSE TO BETA)

All G4 lessons have good teaching alignment. Minor fixes recommended for 2 lessons:

| Lesson ID | Issue | Fix Direction |
|-----------|-------|---------------|
| g4_angles_geometry | emoji_counter block is generic (👀🔢📊❓) and doesn't connect to angle measurement. shape_visual has empty visual_data. | Add a protractor or angle illustration to emoji_counter. Fill shape_visual with actual angle examples (acute, right, obtuse). |
| g4_area_perimeter | Similar generic visual blocks. | Add actual rectangle with labeled width/height for area, and labeled sides for perimeter. |

**Remaining G4 lessons (5/7):** g4_decimals_intro, g4_fractions, g4_large_numbers, g4_multi_digit_operations, g4_word_problems — All READY.

---

## GRADE 5 — AUDIT (Exposure Recommendation: EXPOSE TO BETA)

All 7 G5 lessons are READY:

| Lesson ID | Concept |
|-----------|---------|
| g5_data_graphs | Data and graphs |
| g5_decimals | Decimals (+, -, ×, ÷) |
| g5_fraction_operations | Fraction operations |
| g5_multi_step_word_problems | Multi-step word problems |
| g5_percent_intro | Percentage introduction |
| g5_ratio_intro | Ratio introduction |
| g5_volume_area | Volume and area |

All have concrete story problems, aligned visuals, correct math models, and matching mini quizzes.

---

## GRADE 6 — AUDIT (Exposure Recommendation: EXPOSE TO BETA)

All 7 G6 lessons are READY:

| Lesson ID | Concept |
|-----------|---------|
| g6_equations_intro | Solving equations with variables |
| g6_fraction_decimal_percent | Relating fractions, decimals, percents |
| g6_gcf_lcm | Greatest common factor, least common multiple |
| g6_geometry | Circle geometry |
| g6_middle_school_prep | Middle school preparation |
| g6_ratio_proportion | Ratio and proportion |
| g6_volume | Volume of 3D shapes |

All have concrete story contexts (e.g., x + 5 = 12 balls), aligned Singapore math models, correct equations, and matching mini quizzes.

---

## SPECIAL SECTION: GRADE 4-6 EXPOSURE RECOMMENDATION

### Summary

| Grade | Lessons | Beta Exposure Recommendation | Notes |
|-------|---------|------------------------------|-------|
| G4 | 7 | **EXPOSE** | 5 READY as-is, 2 need minor visual fixes |
| G5 | 7 | **EXPOSE** | All 7 READY |
| G6 | 7 | **EXPOSE** | All 7 READY |

### Detailed Assessment

**Grade 4 (Expore to Beta):**
- ✅ g4_angles_geometry — Good story (หลังคามุมเอียง), correct angle types, but needs better visual blocks for angles
- ✅ g4_area_perimeter — Good story, correct formulas, minor visual improvements needed
- ✅ g4_decimals_intro — Excellent (น้ำปลา 35.50 + น้ำมัน 42.75 = 78.25), all aligned
- ✅ g4_fractions — Good fraction story, aligned visuals and quiz
- ✅ g4_large_numbers — Good place value story, aligned
- ✅ g4_multi_digit_operations — Good multi-digit story, aligned
- ✅ g4_word_problems — Good multi-step story, aligned

**Grade 5 (Expose to Beta):**
All 7 lessons are well-aligned with teaching quality standards.

**Grade 6 (Expose to Beta):**
All 7 lessons are well-aligned with teaching quality standards.

---

## RECURRING ISSUES IDENTIFIED

### 1. Generic Test Question Templates (G1-G3)
**Issue:** Multiple lesson tests contain the same template questions:
- "มี 8 กลุ่ม กลุ่มละ 4 ชิ้น รวมกี่ชิ้น?" (multiplication)
- "มี 45 ชิ้น ใช้ไป 5 ชิ้น เหลือกี่ชิ้น?" (subtraction with large numbers)
- "10 + 6 = ?" (plain addition)
- "มี 11 กลุ่ม กลุ่มละ 2 ชิ้น รวมกี่ชิ้น?" (multiplication)

These appear in: g1_add_within_20, g1_counting_numbers, g1_money_basic, g1_shapes_basic, g1_subtract_within_20, g1_time_basic.

**Root Cause:** Test questions were generated from a generic question bank without lesson-specific customization.

**Fix:** Regenerate test questions specifically for each lesson's concept and number range.

### 2. Story-to-Quiz Mismatch (G1-G2)
**Issue:** Mini quiz numbers don't match story numbers (e.g., story says 2 coins of 5 baht, quiz asks about 1 coin).

**Root Cause:** Variants were generated with different numbers in story vs. quiz without cross-checking.

**Fix:** Review each variant to ensure mini_quiz questions use the same item/number context as the story_intro.

### 3. Addition Problems in Non-Addition Lessons (G1)
**Issue:** G1 counting and shapes lessons incorrectly use addition problems in visual_blocks and mini_quiz.

**Root Cause:** Lessons were generated with an "addition grouping" template regardless of actual concept.

**Fix:** For counting lessons: show objects to count, not add. For shapes lessons: ask shape identification questions, not addition.

### 4. Placeholder Story Text (G2-G3)
**Issue:** v02-v04 of some lessons (e.g., g3_division_intro) have placeholder text like "ผลไม้: มีของหลายชิ้นต้องแบ่งให้เพื่อนๆ อย่างละเท่าๆ กัน ลองมาหารกัน!" with no concrete numbers.

**Root Cause:** Incomplete variant generation.

**Fix:** Add concrete story numbers to all variants.

---

## RECOMMENDATIONS BY PRIORITY

### 🔴 HIGH PRIORITY (Fix before beta)
1. **g1_add_within_20** — Fix lesson test (regenerate all 10 questions)
2. **g1_subtract_within_20** — Fix lesson test (regenerate all 10 questions)
3. **g1_counting_numbers** — Fix entire lesson (counting ≠ addition)
4. **g1_shapes_basic** — Fix entire lesson (shapes ≠ addition)
5. **g1_money_basic** — Fix mini_quiz story mismatches
6. **g3_division_intro** v02-v04 — Add concrete story numbers
7. **g2_shapes_2d** — Fix shape_visual to match story (show squares not circles)
8. **g2_money_change** — Align item names in story/mini_quiz

### 🟡 MEDIUM PRIORITY (Fix soon after high priority)
1. **g1_time_basic** — Fix lesson test
2. **g3_fractions_intro** — Clarify number_sentence
3. **g2_subtract_two_digit** — Align explanation numbers with story
4. **g2_times_table_2_5_10** — Align numbers
5. **g2_time_calendar** — Align mini_quiz month with story month
6. **g4_angles_geometry** — Add angle visuals
7. **g4_area_perimeter** — Add rectangle/side visuals

### 🟢 LOW PRIORITY (Nice to have)
1. Grade 4-6 are all ready for beta exposure with minor visual improvements only.

---

*End of Report*