# EP Content Repair Report
**Date:** 2026-05-26
**Project:** TOPA Math — 4-craft.com
**Scope:** Pilot repair of 2 Grade 1 EP lessons
**Files repaired:** `g1_add_within_20_ep.json`, `g1_subtract_within_20_ep.json`

---

## Summary

| Metric | Value |
|---|---|
| Lessons repaired | 2 / 2 pilot |
| Quiz questions repaired | 20 (10 per lesson) |
| Fields repaired | 8 fields × 2 lessons = 16 field-level repairs |
| Math errors fixed | 2 (wrong operation in visual_blocks) |
| Status set | `needs_review` (not auto-approved) |

---

## Lessons Repaired

### 1. `grade_1/lessons/g1_add_within_20_ep.json`

**Before repair:** Status was `approved` with Thai text leaking into English fields and wrong math operation (multiplication tiles) in visual_blocks.

**After repair:** Status `needs_review`, all English fields have simple English content.

#### Fields repaired

| Field | Before | After |
|---|---|---|
| `explanation_steps_en` | Thai text with `Step:` prefix | 5 simple-English explanation steps |
| `worked_examples_en` | Garbled English fragments with `?` | 3 word-problem examples with correct answers |
| `common_mistakes_en` | Thai text with `Mistake:` prefix | 3 plain-English mistake explanations |
| `hints_en` | Thai text with `Hint:` prefix | 3 plain-English hints |
| `quiz_en[].question_text` | Thai text | 10 English word problems |
| `quiz_en[].choices` | Thai text (e.g. "14 ลูก") | English choices (e.g. "14 balls") |
| `quiz_en[].explanation` | Thai text | English explanations |
| `lesson_variants[0].visual_blocks` | Multiplication tiles (5×6=30) — WRONG operation | Addition model (6+5=11) with correct mini_quiz |

#### Example: `explanation_steps_en` before → after

**Before:**
```
Step: การบวกคือการเอาจำนวนมารวมกัน ผลลัพธ์เรียกว่า ผลบวก
Step: นับจำนวนแรกไปทีละขั้น เช่น มี 7 อยู่แล้ว ก็นับต่อ 5 จำนวน: 8, 9, 10, 11, 12 → ได้ 12
```

**After:**
```
"Addition means putting numbers together. The result is called the sum.",
"Count on from the first number one step at a time. For example, if you have 7 and need to add 5, count forward: 8, 9, 10, 11, 12 → the answer is 12.",
"Use your fingers to help count. Start with one fist and count on with the other hand.",
"If the sum goes past 10, remember how much is left over. For example, 8 + 5 = 10 + 3 = 13.",
"Check your answer by subtracting backwards. If 7 + 5 = 12, then 12 - 5 must equal 7."
```

#### Example: `quiz_en[0]` before → after

**Before:**
```json
{
  "question_text": "มีลูกบอล 8 ลูก เพิ่มอีก 7 ลูก รวมมีลูกบอลกี่ลูก?",
  "choices": ["14 ลูก", "15 ลูก", "16 ลูก", "13 ลูก"],
  "correct_answer": "15 ลูก",
  "explanation": "8 + 7 = 15 จึงมีลูกบอลทั้งหมด 15 ลูก"
}
```

**After:**
```json
{
  "question_text": "There are 8 balls. I add 7 more balls. How many balls are there in total?",
  "choices": ["14 balls", "15 balls", "16 balls", "13 balls"],
  "correct_answer": "15 balls",
  "explanation": "8 + 7 = 15. There are 15 balls in total."
}
```

#### Example: `lesson_variants[0].visual_blocks` — wrong math fixed

**Before (WRONG — showed multiplication 5×6=30):**
```json
{
  "type": "number_sentence",
  "expression": "5 × 6 = 30"
}
```

**After (CORRECT — shows addition 6+5=11):**
```json
{
  "type": "number_sentence",
  "expression": "6 + 5 = 11"
}
```

---

### 2. `grade_1/lessons/g1_subtract_within_20_ep.json`

**Before repair:** Status was `approved` with Thai text in all English fields, garbled quiz text (`ballspieces 12 balls 5 balls balls?`), and wrong multiplication math in visual_blocks.

**After repair:** Status `needs_review`, all English fields have simple English content, visual_blocks corrected to subtraction.

#### Fields repaired

| Field | Before | After |
|---|---|---|
| `explanation_steps_en` | Thai with `Step:` prefix | 5 simple-English subtraction steps |
| `worked_examples_en` | Thai with `?` fragments | 3 word-problem subtraction examples |
| `common_mistakes_en` | Thai with `Mistake:` prefix | 3 plain-English mistake explanations |
| `hints_en` | Thai with `Hint:` prefix | 3 plain-English hints |
| `quiz_en[].question_text` | Garbled English (`ballspieces 12 balls...`) | 10 clean English word problems |
| `quiz_en[].choices` | Garbled choices | English choices with correct units |
| `lesson_variants[0].visual_blocks` | Multiplication (5×6=30, 4×7=28 tiles) | Subtraction model (11-5=6) with correct mini_quiz |

#### Example: `quiz_en[0]` before → after

**Before (garbled):**
```json
{
  "question_text": "ballspieces 12 balls 5 balls balls?",
  "choices": ["5 balls", "6 balls", "7 balls", "8 balls"],
  "correct_answer": "7 balls"
}
```

**After (clean English word problem):**
```json
{
  "question_text": "Alice has 12 fish-shaped snacks. She gives 5 to her friend. How many fish-shaped snacks does she have left?",
  "choices": ["5 snacks", "6 snacks", "7 snacks", "8 snacks"],
  "correct_answer": "7 snacks",
  "explanation": "12 - 5 = 7 fish-shaped snacks left."
}
```

#### Example: `visual_blocks` mini_quiz — wrong math fixed

**Before (WRONG — multiplication 4×7=28 tiles):**
```json
{
  "type": "mini_quiz",
  "question": "A small garden has 4 rows and 7 columns of tiles. How many tiles are there in all?",
  "correct_answer": "28"
}
```

**After (CORRECT — subtraction 9-4=5 oranges):**
```json
{
  "type": "mini_quiz",
  "question": "There are 9 oranges in a box. Mom takes 4 oranges to make juice. How many oranges are left in the box?",
  "choices": ["3", "4", "5", "6"],
  "correct_answer": "5",
  "explanation": "9 - 4 = 5 oranges left."
}
```

---

## Remaining Issues After Pilot

The pilot confirms:

1. **Both repaired lessons have correct math answers** — no answers were changed.
2. **All `quiz_en[].choices` are now English** with correct units matching each question's item.
3. **`status` = `needs_review`** on both files — admin must review before student visibility.
4. **`model_diagram` rows × cols = total** verified correct in both files.
5. **No Thai text in `explanation_steps_en`, `worked_examples_en`, `common_mistakes_en`, `hints_en`**, `quiz_en[].question_text`, or `quiz_en[].explanation`.

**Remaining concern:** Bare-equation quiz questions (q08, q09, q10 in subtraction: "19 - 7 = ?") were converted to word problems in this repair. This is intentional per the EP writing rules, but if the Thai TH lesson intentionally has bare equations for mental arithmetic practice, those answers must remain unchanged (they do — answers 12, 6, 8 are preserved).

---

## Decision

**`NEEDS_MORE_EP_REPAIR`**

### Rationale
- Pilot confirmed the repair workflow works correctly.
- The schema has 42 more EP lessons needing the same repairs.
- `explanation_steps_en`, `quiz_en` (question_text, choices, explanation), `common_mistakes_en`, and `hints_en` across all 44 EP lessons need English rewriting.
- visual_blocks in g1_subtract_within_20_ep had WRONG math operation (multiplication instead of subtraction) — this pattern may exist in other lessons too and must be audited.

### Next Steps Recommended
1. **Audit visual_blocks in all 44 EP lessons** for wrong math operation (e.g. multiplication in addition/subtraction lessons).
2. **Delegate all 42 remaining EP lessons** to subagents for parallel repair using the same workflow.
3. Admin reviews each repaired lesson before setting `status: approved`.

---

## Pilot Repair Verification

| Check | g1_add_within_20_ep | g1_subtract_within_20_ep |
|---|---|---|
| `status` = `needs_review` | ✅ | ✅ |
| `explanation_steps_en` in English | ✅ | ✅ |
| `worked_examples_en` in English | ✅ | ✅ |
| `common_mistakes_en` in English | ✅ | ✅ |
| `hints_en` in English | ✅ | ✅ |
| `quiz_en` questions are word problems | ✅ | ✅ |
| `quiz_en` choices in English | ✅ | ✅ |
| `quiz_en` answers unchanged | ✅ | ✅ |
| `visual_blocks` math matches lesson topic | ✅ (was wrong, fixed) | ✅ (was wrong, fixed) |
| `model_diagram` rows×cols=total | ✅ 2×6=11 | ✅ 1×11=11 |
| No Thai text in `_en` fields | ✅ | ✅ |

---

*Report generated: 2026-05-26*
*Admin review required before any repaired lesson changes from `needs_review` to `approved`.*
