# Grade 3 TH Content Rewrite Report

**Date:** 2026-05-25
**Scope:** Grade 3 Thai Math Lessons (8 lessons)
**Path:** `C:\web-app\4-craft.com\apps\api\app\content\math\grade_3\lessons`
**Goal:** Rewrite all generic template stories → unique child-friendly real-life stories

---

## Summary

| # | Lesson ID | Topic | Story Theme | Math Answer | Status |
|---|----------|-------|-------------|-------------|--------|
| 1 | g3_area_intro | Area of Rectangle | น้องมินปลูกผักที่สวนโรงเรียน (5 แถว × 6 ต้น) | 30 ต้น | needs_review |
| 2 | g3_division_intro | Division | พี่เชฟแบ่งคุกกี้ใส่กล่อง (30÷6) | 5 กล่อง | needs_review |
| 3 | g3_measurement | Subtraction (Length) | แม่ตัดริบบิ้น 120−35 | 85 ซม. | needs_review |
| 4 | g3_fractions_intro | Fractions 1/4 | มะลิกินเค้ก 1/4 ของถาด | 1/4 | needs_review |
| 5 | g3_mixed_review | Addition | น้องซีซาร์หยิบหนังสือ 18+7 | 25 เล่ม | needs_review |
| 6 | g3_multi_step_word_problems | Multi-step (+/−/×/÷) | ร้านขนมขายได้กำไร (15×8)−(6×8) | 72 บาท | needs_review |
| 7 | g3_multiplication_area_model_thp | Multiplication (Area) | น้องไทยวัดแปลงผัก 6×5 ม. | 30 ตร.ม. | needs_review |
| 8 | g3_multiplication_multi_digit | Multi-digit Multiplication | น้องออลิมปลูกกุหลาบ 12×3 แถว | 36 ต้น | needs_review |

**Total: 8/8 lessons rewritten** ✅

---

## What Was Done

### 1. Story / เรื่องราว
Each lesson received a unique real-life story (~300 Thai characters) anchored in a child's daily context:

| Lesson | Context | Characters |
|--------|---------|-----------|
| g3_area_intro | สวนผักโรงเรียน — น้องมินนับต้นผักแปลงสี่เหลี่ยม | มิน, ครู, สวนหัวขวัญ |
| g3_division_intro | ร้านเบเกอรี่ — พี่เชฟแบ่งคุกกี้ใส่กล่อง | พี่เชฟ, ร้านหรรษา |
| g3_measurement | ตลาด — แม่ซื้อริบบิ้นตัดทำผ้าผูกผม | แม่, น้องมิน |
| g3_fractions_intro | ชั้นเรียน — มะลิกับเพื่อนทำเค้ก | มะลิ, เพื่อนๆ, ครู |
| g3_mixed_review | ห้องสมุด — น้องซีซาร์กับพี่สาว | น้องซีซาร์, พี่สาว |
| g3_multi_step_word_problems | ร้านขนมโรงเรียน — ขายขนมคำนวณกำไร | เจ้าของร้าน |
| g3_multiplication_area_model_thp | สวนผักโรงเรียน — น้องไทยวัดพื้นที่ | น้องไทย, ครู |
| g3_multiplication_multi_digit | สวนชั้นเรียน — น้องออลิมปลูกกุหลาบ | น้องออลิม, ครู |

### 2. Think Story / เรื่องราวชวนคิด
Each includes:
- Identify key numbers from the story
- State which operation/concept to use
- Show the reasoning step-by-step

### 3. Model Diagram / ใช้แผนภาพช่วยคิด
Each updated with story-matching icons:

| Lesson | Symbol | Rows×Cols | Total | Unit |
|--------|--------|-----------|-------|------|
| g3_area_intro | 🌱 | 5 × 6 | 30 | ต้น |
| g3_division_intro | 🍪 | 5 × 6 | 5 | กล่อง |
| g3_measurement | 📏 | 4 × 6 | 85 | ซม. |
| g3_fractions_intro | 🍰 | 1 × 4 | 4 | ส่วน |
| g3_mixed_review | 📚 | 7 × 6 | 25 | เล่ม |
| g3_multi_step_word_problems | 💰 | 1 × 3 | 72 | บาท |
| g3_multiplication_area_model_thp | 🌿 | 5 × 6 | 30 | ตร.ม. |
| g3_multiplication_multi_digit | 🌹 | 3 × 12 | 36 | ต้น |

### 4. Number Sentence / เขียนเป็นประโยควิธีทำ
Exact equation with unit preserved from original math answer.

### 5. Practice / ลองทำดู
New word problem with same concept, different numbers, 4 choices, correct answer + explanation.

### 6. Status
All 8 lessons set to `status: "needs_review"` — admin must review before student visibility.

---

## Changes Made (Field-Level)

| Field | Before | After |
|-------|--------|-------|
| `story_intro_th` | Generic "น้องXX ช่วยครู..." template | Unique child-friendly story |
| `lesson_intro_th` | Generic/partial intro | Unique story intro |
| `story_theme_th` (lesson_variants[0]) | Generic template | Unique story |
| `helper_tip` | Generic tip | Concept-specific tip |
| `visual_blocks[].content` (story_intro) | Generic story | Unique story |
| `visual_blocks[].content` (think_story) | Old math reasoning | New reasoning with new numbers |
| `visual_blocks[].rows/cols/total/unit/symbol` | Old area model | Story-matching model |
| `visual_blocks[].number_sentence.expression` | Old equation | New equation matching story |
| `visual_blocks[].mini_quiz.question` | Generic practice | New practice problem |
| `visual_blocks[].mini_quiz.choices` | Generic choices | New choices matching new problem |
| `status` | `"approved"` | `"needs_review"` |

---

## Fields NOT Modified

The following were preserved as-is (not part of rewrite scope):
- `worked_examples` — kept original TH examples
- `explanation_steps` — kept original TH explanation steps
- `common_mistakes` / `hints` — kept original TH content
- Quiz files in `grade_3/quizzes/` — not touched (per scope)
- EP variant files (`g3_*_ep.json`) — not touched (per scope)
- `lesson_variants[1+]` — only [0] was updated

---

## Original Generic Template (Replaced)

The previous "น้องต้นช่วยครูจัดกิจกรรม..." template was used across all 8 lessons. This has been fully replaced with unique stories per lesson.

---

## Next Steps

1. **Admin review** — all 8 lessons are `needs_review`
2. **Quiz files** — quiz content in `grade_3/quizzes/` was not modified; may need separate review
3. **EP variants** — EP English content not modified; separate EP rewrite task needed
4. **Other grades** — Grade 1, 2, 4, 5, 6 TH lessons were not modified

---

*Report generated: 2026-05-25*
*Rewritten by: Hermes Agent (MiniMax-M2.7-highspeed)*
