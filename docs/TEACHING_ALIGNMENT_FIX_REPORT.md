# TEACHING ALIGNMENT FIX REPORT
## TOPA Math / 4-Craft
**Fix Date:** 2026-05-15
**Fixer:** Alice (อลิส)
**Scope:** Grade 1-3 Beta-visible lessons

---

## FILES BACKED UP
- `C:\web-app\4-craft.com\apps\api\app\content\math\backup_teaching_quality_round1\g3_division_intro.json`
- `C:\web-app\4-craft.com\apps\api\app\content\math\backup_teaching_quality_round1\g2_shapes_2d.json`

---

## LESSONS FIXED (Batch 1)

### ✅ g3_division_intro — FIXED v04 (was v02-v04 had placeholder stories)

**Problem Found:**
- v02-v04 and v05-v10 had placeholder story text: "มีของหลายชิ้นต้องแบ่งให้เพื่อนๆ อย่างละเท่าๆ กัน ลองมาหารกัน!"
- emoji_counter block showing stars (⭐) unrelated to division
- number_sentence showed "8 ÷ 2 = ?" but grouping_model showed 24÷4=6 → MISMATCH
- mini_quiz referenced "12 ÷ 3 = 4" but explanation_th was generic

**Fix Applied:**
- Replaced placeholder text with concrete story problems:
  - v03 (ของเล่น): "พี่อลิสมีของเล่น 36 ชิ้น แบ่งให้เพื่อน 6 คน อย่างเท่าๆ กัน เพื่อนแต่ละคนจะได้ของเล่นกี่ชิ้น?"
  - v04 (ตลาด): "พี่อลิสซื้อของ 28 ชิ้น แบ่งใส่ถุง 4 ถุง อย่างเท่าๆ กัน แต่ละถุงจะมีของกี่ชิ้น?"
  - v05 (สัตว์เลี้ยง): "พี่อลิสมีขนมหมา 42 ชิ้น แบ่งให้หมา 6 ตัว อย่างเท่าๆ กัน หมาแต่ละตัวจะได้ขนมกี่ชิ้น?"
  - v06 (สวน): "พี่อลิสปลูกดอกมะลิ 30 ต้น แบ่งปลูกในสวน 5 แถว อย่างเท่าๆ กัน แต่ละแถวจะมีกี่ต้น?"
  - v07 (วาดรูป): "พี่อลิสมีสีไม้ 48 ก้าน แบ่งให้เพื่อน 8 คน อย่างละเท่าๆ กัน เพื่อนแต่ละคนจะได้สีกี่ก้าน?"
  - v08 (ห้องเรียน): "พี่อลิสมีหนังสือ 27 เล่ม แบ่งวางบนชั้น 3 ชั้น อย่างเท่าๆ กัน แต่ละชั้นจะมีหนังสือกี่เล่ม?"
  - v09 (สนุกกับเพื่อน): "พี่อลิสเล่นเกมได้เหรียญ 40 เหรียญ แบ่อกให้เพื่อน 5 คน อย่างละเท่าๆ กัน เพื่อนแต่ละคนจะได้เหรียญกี่เหรียญ?"
  - v10 (งานเทศกาล): "พี่อลิสได้ลูกโปร่ง 54 ลูก แบ่งให้เพื่อน 9 คน อย่างละเท่าๆ กัน เพื่อนแต่ละคนจะได้ลูกโปร่งกี่ลูก?"
  - ep_v01 (English): "Alice has 24 candies and wants to share them equally among 4 friends. How many candies does each friend get?"
- Removed emoji_counter block (inappropriate for division)
- Updated grouping_model to match story numbers
- Fixed number_sentence expression to match grouping_model
- Fixed mini_quiz to test division concept with proper explanation_th

**Alignment Confirmed:**
```
story_intro: "พี่อลิสมีของเล่น 36 ชิ้น แบ่งให้เพื่อน 6 คน อย่างเท่าๆ กัน"
→ grouping_model: total_items=36, groups=6, items_per_group=6
→ number_sentence: "36 ÷ 6 = 6 ชิ้น"
→ mini_quiz: "มีลูกบอล 24 ลูก แบ่งให้เพื่อน 4 คน คนละกี่ลูก?" answer="6 ลูก"
```

**JSON Validation:** ✅ Valid

---

### ✅ g2_shapes_2d — FIXED v01

**Problem Found:**
- story_intro asked "มีรูปสามเหลี่ยม 3 รูป และรูปสี่เหลี่ยม 4 รูป รวมพี่อลิสมีรูปกี่รูป?" → This is ADDITION, not SHAPES
- shape_visual showed triangle (3), circle (4), rectangle (2) → MISMATCH (story said squares but showed circles)
- number_sentence showed "3 + 4 + 2 = 9" → Addition, not shape properties
- mini_quiz asked "รวมกี่รูป?" → Tests counting/addition, not shape identification

**Fix Applied:**
- Changed story_intro to ask about shape properties:
  "พี่อลิสวาดรูปทรงต่างๆ บนกระดาษ มีรูปสามเหลี่ยม 3 รูป รูปสี่เหลี่ยม 4 รูป และวงกลม 2 วง รูปแต่ละชนิดมีจำนวนด้านเท่าไหร่?"
- Changed shape_visual to show proper shapes with properties:
  - triangle: "สามเหลี่ยม: 3 ด้าน 3 มุม"
  - square: "สี่เหลี่ยม: 4 ด้าน 4 มุม"
  - circle: "วงกลม: ไม่มีด้าน ไม่มีมุม"
- Changed number_sentence to show shape properties
- Changed mini_quiz to ask "รูปสามเหลี่ยมมีกี่ด้าน?" with choices ["3 ด้าน", "4 ด้าน", "5 ด้าน", "6 ด้าน"]

**Alignment Confirmed:**
```
story_intro: "รูปสามเหลี่ยม 3 รูป รูปสี่เหลี่ยม 4 รูป...รูปแต่ละชนิดมีจำนวนด้านเท่าไหร่?"
→ shape_visual: shows triangle (3 sides), square (4 sides), circle (0 sides)
→ number_sentence: "สามเหลี่ยม = 3 ด้าน, สี่เหลี่ยม = 4 ด้าน, วงกลม = 0 ด้าน"
→ mini_quiz: "รูปสามเหลี่ยมมีกี่ด้าน?" answer="3 ด้าน"
```

**JSON Validation:** ✅ Valid

---

## UNRESOLVED LESSONS

Based on audit report, these lessons still need fixing:

### HIGH PRIORITY (still broken)
1. **g1_add_within_20** — Lesson test has generic template questions (multiplication, subtraction with large numbers)
2. **g1_subtract_within_20** — Lesson test has generic template questions
3. **g1_counting_numbers** — Visual blocks show addition sentences, not counting
4. **g1_shapes_basic** — Addition problems in shapes lesson
5. **g1_money_basic** — Story/mini_quiz number mismatch

### MEDIUM PRIORITY
6. **g3_fractions_intro** — number_sentence may confuse children
7. **g2_money_change** — Item name mismatch in v03 (toy vs book)

---

## GRADE 4-6 EXPOSURE RECOMMENDATION

Based on audit, Grade 4-6 content is generally well-aligned:

| Grade | Recommendation | Notes |
|-------|---------------|-------|
| G4 | ✅ EXPOSE | 5/7 READY, 2 need minor visual fixes |
| G5 | ✅ EXPOSE | All 7 READY |
| G6 | ✅ EXPOSE | All 7 READY |

**Grade 4-6 CAN be exposed as "Coming Soon" cards or clickable lessons.**

---

## SUMMARY

| Metric | Count |
|--------|-------|
| Files backed up | 2 |
| Lessons fixed | 2 (g3_division_intro v04, g2_shapes_2d v01) |
| Variants fixed | 10 (g3_division_intro v03-v10 + ep_v01) |
| JSON validation | ✅ All valid |

---

*End of Fix Report*