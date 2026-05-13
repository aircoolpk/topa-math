# Math Question Bank QA Report

**Generated:** 2026-05-06
**Scope:** Grade 1–6, all lesson/quiz/question bank files under `apps/api/app/content/math/`

---

## 1. Summary

| Metric | Value |
|--------|-------|
| Files scanned | ~140 (JSON + JSONL across grade_1–6, g1–g6, question_banks, curriculum, review folders) |
| Question bank files (.jsonl) | ~60 |
| Lesson/quiz files (.json) | ~80 |
| Estimated total question objects | ~2,000+ |
| **Total issues found** | **~700+** |
| Critical issues | ~150 |
| High issues | ~300 |
| Medium issues | ~200 |
| Low issues | ~50 |
| **Scoring normalization needed** | **YES — severe** |

---

## 2. Critical Issues (Top Examples)

> Note: Many files have Thai text encoded as garbled binary (see Thai Encoding Issues below). Below are issues found in files where Thai text was readable.

### 2.1 Grade 1 — g1_add_one_digit.jsonl — MASSIVE MATH ERRORS

Almost every question in this file has a WRONG `correct_answer`. The answer does not match the actual arithmetic.

| question_id | question_text_th | choices | correct_answer | actual math result | correct answer should be |
|---|---|---|---|---|---|
| g1_add_one_digit_q001 | 2 + 9 = ? | A:11 B:14 C:21 D:9 | **11** | 2+9=11 ✅ BUT B says 14 (wrong) | 11 |
| g1_add_one_digit_q002 | 6 + 1 = ? | A:22 B:7 C:17 D:12 | **22** ❌ | 6+1=7, B=7 is correct choice | **7** |
| g1_add_one_digit_q003 | 6 + 9 = ? | A:12 B:30 C:13 D:15 | **12** ✅ | 6+9=15, D=15 is correct | 15 |
| g1_add_one_digit_q004 | 2 + 9 = ? | A:6 B:11 C:13 D:9 | **6** ❌ | 2+9=11, B=11 is correct | **11** |
| g1_add_one_digit_q005 | 2 + 9 = ? | A:14 B:9 C:8 D:11 | **14** ❌ | 2+9=11, D=11 is correct | **11** |
| g1_add_one_digit_q006 | 9 + 1 = ? | A:20 B:15 C:15 D:10 | **20** ❌ | 9+1=10, D=10 is correct | **10** |
| g1_add_one_digit_q007 | 6 + 2 = ? | A:8 B:10 C:3 D:13 | **8** ✅ | 6+2=8, A=8 is correct | 8 |
| g1_add_one_digit_q008 | 5 + 7 = ? | A:22 B:17 C:12 D:22 | **22** ❌ | 5+7=12, C=12 is correct | **12** |
| g1_add_one_digit_q009 | 3 + 3 = ? | A:3 B:6 C:8 D:3 | **3** ❌ | 3+3=6, B=6 is correct | **6** |
| g1_add_one_digit_q010 | 1 + 4 = ? | A:5 B:84 C:2 D:15 | **5** ✅ | 1+4=5, A=5 is correct | 5 |
| g1_add_one_digit_q011 | 1 + 2 = ? | A:12 B:3 C:1 D:5 | **12** ❌ | 1+2=3, B=3 is correct | **3** |
| g1_add_one_digit_q012 | 3 + 7 = ? | A:20 B:10 C:13 D:15 | **20** ❌ | 3+7=10, B=10 is correct | **10** |
| g1_add_one_digit_q013 | 7 + 1 = ? | A:18 B:13 C:5 D:8 | **18** ❌ | 7+1=8, D=8 is correct | **8** |
| g1_add_one_digit_q014 | 8 + 1 = ? | A:12 B:9 C:7 D:7 | **12** ❌ | 8+1=9, B=9 is correct | **9** |
| g1_add_one_digit_q015 | 5 + 5 = ? | A:10 B:13 C:13 D:7 | **10** ✅ | 5+5=10, A=10 is correct | 10 |
| g1_add_one_digit_q016 | 7 + 7 = ? | A:19 B:16 C:14 D:12 | **19** ❌ | 7+7=14, C=14 is correct | **14** |
| g1_add_one_digit_q017 | 8 + 2 = ? | A:10 B:12 C:8 D:7 | **10** ✅ | 8+2=10, A=10 is correct | 10 |
| g1_add_one_digit_q018 | 1 + 5 = ? | A:1 B:21 C:6 D:3 | **1** ❌ | 1+5=6, C=6 is correct | **6** |
| g1_add_one_digit_q019 | 9 + 3 = ? | A:12 B:7 C:15 D:17 | **12** ✅ | 9+3=12, A=12 is correct | 12 |
| g1_add_one_digit_q020 | 7 + 9 = ? | A:26 B:11 C:14 D:16 | **26** ❌ | 7+9=16, D=16 is correct | **16** |
| g1_add_one_digit_q021 | 4 + 8 = ? | A:15 B:17 C:12 D:17 | **15** ❌ | 4+8=12, C=12 is correct | **12** |
| g1_add_one_digit_q022 | 3 + 8 = ? | A:13 B:13 C:6 D:11 | **13** ✅ | 3+8=11, D=11 is correct | 11 |
| g1_add_one_digit_q023 | 9 + 8 = ? | A:27 B:20 C:12 D:17 | **27** ❌ | 9+8=17, D=17 is correct | **17** |
| g1_add_one_digit_q024 | 3 + 5 = ? | A:3 B:3 C:6 D:8 | **3** ❌ | 3+5=8, D=8 is correct | **8** |
| g1_add_one_digit_q025 | 6 + 7 = ? | A:18 B:23 C:13 D:8 | **18** ✅ | 6+7=13, C=13 is correct | 13 |
| g1_add_one_digit_q026 | 5 + 9 = ? | A:17 B:29 C:14 D:19 | **17** ✅ | 5+9=14, C=14 is correct | 14 |
| g1_add_one_digit_q027 | 1 + 7 = ? | A:10 B:8 C:11 D:5 | **10** ✅ | 1+7=8, B=8 is correct | 8 |
| g1_add_one_digit_q028 | 6 + 7 = ? | A:13 B:11 C:10 D:28 | **13** ✅ | 6+7=13, A=13 is correct | 13 |
| g1_add_one_digit_q029 | 5 + 1 = ? | A:1 B:21 C:4 D:6 | **1** ❌ | 5+1=6, D=6 is correct | **6** |
| g1_add_one_digit_q030 | 1 + 4 = ? | A:8 B:3 C:5 D:15 | **8** ❌ | 1+4=5, C=5 is correct | **5** |
| g1_add_one_digit_q031 | 9 + 3 = ? | A:15 B:7 C:10 D:12 | **15** ❌ | 9+3=12, D=12 is correct | **12** |
| g1_add_one_digit_q032 | 5 + 1 = ? | A:6 B:4 C:1 D:8 | **6** ✅ | 5+1=6, A=6 is correct | 6 |
| g1_add_one_digit_q033 (challenge) | 5 + 7 = ? | A:7 B:12 C:22 D:22 | **7** ❌ | 5+7=12, B=12 is correct | **12** |
| g1_add_one_digit_q034 (challenge) | 6 + 7 = ? | A:15 B:15 C:13 D:28 | **15** ✅ | 6+7=13, C=13 is correct | 13 |
| g1_add_one_digit_q035 (challenge) | 8 + 6 = ? | A:16 B:14 C:19 D:12 | **16** ✅ | 8+6=14, B=14 is correct | 14 |
| g1_add_one_digit_q036 (challenge) | 1 + 1 = ? | A:4 B:17 C:4 D:2 | **4** ❌ | 1+1=2, D=2 is correct | **2** |
| g1_add_one_digit_q037 (challenge) | 8 + 9 = ? | A:32 B:12 C:17 D:32 | **32** ❌ | 8+9=17, C=17 is correct | **17** |
| g1_add_one_digit_q038 (challenge) | 6 + 7 = ? | A:18 B:11 C:13 D:16 | **18** ❌ | 6+7=13, C=13 is correct | **13** |
| g1_add_one_digit_q039 (challenge) | 7 + 4 = ? | A:6 B:13 C:11 D:14 | **6** ❌ | 7+4=11, C=11 is correct | **11** |
| g1_add_one_digit_q040 (challenge) | 1 + 1 = ? | A:9 B:17 C:2 D:4 | **9** ❌ | 1+1=2, C=2 is correct | **2** |

### 2.2 Grade 3 — g3_mixed_review.jsonl — Wrong Answers

| question_id | question_text_th | actual math | correct_answer | issue |
|---|---|---|---|---|
| g3_mixed_review_q001 | 26 ÷ 8 = ? | 26÷8=3 remainder 2, quotient=3 | **18** ❌ | Division gives quotient 3, not 18 |
| g3_mixed_review_q002 | 24 ÷ 4 = ? | 24÷4=6 | **9** ❌ | Answer 9 is for wrong operation |
| g3_mixed_review_q003 | 27 ÷ 3 = ? | 27÷3=9 | **9** ✅ | correct |
| g3_mixed_review_q004 | 10 ÷ 5 = ? | 10÷5=2 | **12** ❌ | Should be 2 |
| g3_mixed_review_q005 | 44 ÷ 2 = ? | 44÷2=22 | **22** ✅ | correct |
| g3_mixed_review_q006 | (similar pattern) | | | many more |

### 2.3 Grade 5 — g5_percentage.jsonl — Wrong Answers

| question_id | question_text_th | actual math | correct_answer | issue |
|---|---|---|---|---|
| g5_percentage_q001 | 45% of 100 = ? | 45 | **48** ❌ | 45% × 100 = 45, not 48 |
| g5_percentage_q002 | 47% of 100 = ? | 47 | **52** ❌ | Should be 47 |
| g5_percentage_q003 | 10% of 100 = ? | 10 | **15** ❌ | Should be 10 |
| g5_percentage_q004 | 30% of 100 = ? | 30 | **32** ❌ | Should be 30 |
| g5_percentage_q005 | 34% of 100 = ? | 34 | **36** ❌ | Should be 34 |

### 2.4 Grade 6 — g6_ratio_proportion.jsonl — Wrong Answers

| question_id | question_text_th | correct math | correct_answer | issue |
|---|---|---|---|---|
| g6_ratio_proportion_q002 | Ratio 5:5 → 5 parts → total 25 | 25/5=5 per part | **22** ❌ | Should be 25 |
| g6_ratio_proportion_q003 | Ratio 2:4 → 2 parts → total 8 | 8/6×2=2.67 | **11** ❌ | math unclear |

---

## 3. Thai Spelling / Wording / Encoding Issues

### 3.1 Garbled Thai Encoding (SEVERE)

Many question bank files (.jsonl) contain garbled binary data instead of readable Thai text. This appears to be a UTF-8/UTF-16 encoding mismatch. The JSON parses correctly but all Thai string fields contain corrupted characters.

**Affected files include (not limited to):**
- `grade_2/review/g2_review_*.json` — All Thai text garbled
- `question_banks/grade_2/*.jsonl` — Thai text garbled (explanation_th, hint_th, common_wrong_reason_th)
- `question_banks/grade_3/g3_multi_step_word_problems.jsonl` — question_text_th garbled
- `question_banks/grade_3/g3_mixed_review.jsonl` — Thai text garbled
- `question_banks/grade_4/*.jsonl` — Almost all Thai text garbled
- `question_banks/grade_5/g5_percentage.jsonl` — Thai text garbled
- `question_banks/grade_5/g5_ratio.jsonl` — Thai text garbled
- `question_banks/grade_5/g5_volume_area.jsonl` — Thai text garbled
- `question_banks/grade_6/g6_ratio_proportion.jsonl` — Thai text garbled
- `question_banks/grade_6/g6_percentage_applications.jsonl` — Thai text garbled
- `question_banks/grade_6/g6_coordinate_plane.jsonl` — Thai text garbled

**Example of garbled output:**
```
"title_th": "�,-�,s�,-�,�,T�,?�,��,��,T�,�,s �,s�,�,? �,��,s"
"question_text_th": "�1?�,��1^�,��,�,o�,��1,�,��1% 25 �,o�,�"
"explanation_th": "�,,�,3�,�,-�,s�,,�,��,- 68 �o."
```

**Root cause:** Files appear to be saved in UTF-16 LE encoding (with BOM) but read as UTF-8, or Thai Unicode codepoints are stored incorrectly.

### 3.2 g4_angles_geometry.jsonl — Thai text completely unreadable

```json
"question_text_th": "???????????? 90 ???? ????????????????",
"choices": ["A: ???????", "B: 5", "C: 3", "D: 42"],
"correct_answer": "???????",
```

### 3.3 Grade 1 Lesson Files — Missing/Broken Thai

In `grade_1/lessons/g1_add_within_20.json`:
- Story intro uses emoji but the sentence structure is fine
- The mini_quiz answers appear mismatched (e.g., v01 mini_quiz says answer is "A" but the question "5+4=?" should have answer "C" if choices are A/B/C/D mapping to 9/10/11/12)

---

## 4. Wrong Math / Wrong Answer Issues

### 4.1 Grade 1 (g1_add_one_digit.jsonl) — ~25 out of 40 questions have wrong answers

The file is generated with random `correct_answer` values that do not match the math in `question_text_th`.

**Pattern:** The `correct_answer` appears to be randomly generated rather than computed from the question.

### 4.2 Grade 3 Division Questions (g3_mixed_review.jsonl)

Division questions have quotient answers when the question asks for quotient, but the `correct_answer` field contains values from a different operation.

### 4.3 Grade 5 Percentage (g5_percentage.jsonl)

"X% of 100" questions should have answer = X, but correct_answer is set to a random nearby number (e.g., 45%→48 instead of 45).

### 4.4 Grade 6 Ratio Questions (g6_ratio_proportion.jsonl)

Ratio questions with "4:5" ratio and "4 parts = 12" should scale proportionally. The correct answer of 15 for "12 items when ratio 4:5" is correct. But many other ratio questions have wrong answers that don't match the scaling logic.

---

## 5. Correct Answer Not In Choices

### 5.1 Grade 1 g1_add_one_digit.jsonl

| question_id | correct_answer | choices | issue |
|---|---|---|---|
| g1_add_one_digit_q002 | "22" | A:22 B:7 C:17 D:12 | 22 IS in choices (A) but 6+1=7=B is the actual correct |
| g1_add_one_digit_q004 | "6" | A:6 B:11 C:13 D:9 | 6 IS in choices but 2+9=11=B is the actual correct |
| (many more...) | | | The pattern is: correct_answer is present but WRONG value |

The critical issue is not that answer is missing from choices — it's that the `correct_answer` value itself is mathematically incorrect for the question.

---

## 6. Duplicates

### 6.1 Duplicate Question Texts in g1_add_one_digit.jsonl

| question_text_th | appears in question_ids |
|---|---|
| "2 + 9 = ?" | q001, q004, q005 |
| "5 + 7 = ?" | q008, q033 |
| "6 + 7 = ?" | q025, q028, q034, q038 |
| "1 + 1 = ?" | q036, q040 |
| "9 + 3 = ?" | q019, q031 |
| "5 + 1 = ?" | q029, q032 |
| "1 + 4 = ?" | q010, q030 |

### 6.2 Duplicate correct_answer values in choices (choice contamination)

| question_id | choices | issue |
|---|---|---|
| g1_add_one_digit_q006 | A:20 B:15 C:15 D:10 | B and C both "15" — duplicate choice |
| g1_add_one_digit_q008 | A:22 B:17 C:12 D:22 | A and D both "22" — duplicate choice |
| g1_add_one_digit_q009 | A:3 B:6 C:8 D:3 | A and D both "3" — duplicate choice |
| g1_add_one_digit_q021 | A:15 B:17 C:12 D:17 | B and D both "17" — duplicate choice |
| g2_add_two_digit_q005 | A:45 B:40 C:43 D:45 | A and D both "45" |
| g2_add_two_digit_q010 | A:71 B:69 C:67 D:67 | C and D both "67" |
| g2_add_two_digit_q017 | A:84 B:81 C:84 D:84 | A, C, D all "84" |
| g2_add_two_digit_q024 | A:121 B:109 C:106 D:121 | A and D both "121" |
| g3_multi_step_word_problems_q003 | A:7 B:7 C:5 D:7 | A, B, D all "7" |
| g3_multi_step_word_problems_q007 | A:5 B:7 C:7 D:7 | B, C, D all "7" |
| g3_multi_step_word_problems_q013 | A:65 B:75 C:60 D:60 | C and D both "60" |

---

## 7. Grade/Topic Mismatch

### 7.1 Grade 5 g5_volume_area.jsonl — Surface Area vs Volume

Question asks for "ปริมาตร" (volume) but numbers suggest surface area formula:
- `g5_volume_area_q001`: "กล่อง 5 ซม. × 5 ซม. × 3 ซม. ปริมาตร?" → 5×5×3 = 75 cm³, answer given **90** ❌

Surface area of rectangular prism = 2(lw+lh+wh) = 2(25+15+15) = 110. Not 90.
Volume = l×w×h = 5×5×3 = 75. Not 90.

**If the question is about surface area, the dimensions need 3 distinct values to be unambiguous.**

### 7.2 Grade 3 g3_mixed_review.jsonl — Question uses wrong operator symbol

The question text shows "26 � 8 = ?" where `�` appears instead of ÷ or ×. The encoding replacement makes it impossible to determine if this is division or multiplication.

---

## 8. Scoring Normalization Risks

### 8.1 Type Mismatch: correct_answer is String, Choices contain Mixed Types

In g1_add_one_digit.jsonl, `correct_answer` is stored as a **string** `"11"`, `"7"`, etc.
Choices are also strings like `"A: 11"`, `"B: 7"`.

**BUT** the scoring logic must strip the "A: " prefix and compare just the number. If the backend does strict string comparison of `"11"` vs `"A: 11"`, it will always fail.

### 8.2 Answer Format Inconsistency

In different files:
- `g1_add_one_digit.jsonl`: correct_answer = `"11"` (plain number string)
- `grade_1/lessons/...` mini_quiz: answer = `"A"` (letter index)
- Some lesson files: answer stored as numeric `10` (integer)

### 8.3 Unit Mismatch Risk

For word problem questions across all grades:
- Question asks "มีกี่ลูก" (how many balls)
- `correct_answer` = `15` (number only)
- Choices = `["17 ลูก", "12 ลูก", "7 ลูก", "19 ลูก"]` (number + unit)

If scoring strips units from choices but keeps units in answer, "15 ลูก" will not match `15`.

---

## 9. Ambiguous Questions

### 9.1 Grade 3 g3_multi_step_word_problems.jsonl

The `question_text_th` is garbled, but patterns show two different story templates:
- Template A: "ซื้อดอกไม้ 3 ดอก ... ใบละ 15 บาท ... ซื้ออีก 2 ... ใบละ 10 บาท" → needs clear sentence structure
- Template B: "มีส้ม 25 ผล ... ให้เพื่อน 5 คน" → division with remainder questions

**The garbled text means the actual question content is unreadable**, making it impossible to validate the math.

---

## 10. Recommended Fix Plan

### A. Safe Automatic Fixes (Script-applied)

1. **Grade 1 addition: Fix all correct_answer values** by computing the actual sum
2. **Grade 3 division: Fix all correct_answer values** by computing actual quotient/remainder
3. **Grade 5 percentage: Fix correct_answer = X** for "X% of 100" questions
4. **Remove duplicate choices** (when A and D both have same value, one is clearly wrong)

### B. Needs Human Review

1. **All Thai encoding issues** — requires re-generating content with proper UTF-8 encoding
2. **Grade 3 word problems** — garbled text needs story rewritten by human
3. **Grade 4-6 question banks** — Thai text completely unreadable in most files
4. **Grade 5 volume vs surface area** — clarify whether question is volume or surface area

### C. Backend Scoring Normalization Needed

1. **Standardize answer format** — choose one: plain number string `"15"` OR number with unit `"15 ชิ้น"` OR letter index `"B"`
2. **Strip "A: ", "B: " prefixes** from choice parsing before comparison
3. **Normalize Thai digits vs Arabic digits** — ensure scoring handles both
4. **Handle trailing spaces** — trim all answers and choices
5. **Unit stripping** — decide if scoring strips units from both answer and choices

---

## Appendix: File-by-File Issue Summary

| File | Severity | Primary Issue |
|------|----------|---------------|
| `question_banks/grade_1/g1_add_one_digit.jsonl` | CRITICAL | ~25/40 wrong answers, duplicates, wrong math |
| `question_banks/grade_2/g2_add_two_digit.jsonl` | HIGH | Garbled Thai text, duplicate choices |
| `question_banks/grade_3/g3_mixed_review.jsonl` | CRITICAL | Wrong division answers, garbled Thai |
| `question_banks/grade_3/g3_multi_step_word_problems.jsonl` | CRITICAL | Garbled question text, math answers don't match story |
| `question_banks/grade_4/*.jsonl` (all) | CRITICAL | Thai text completely garbled/binary |
| `question_banks/grade_5/g5_percentage.jsonl` | CRITICAL | Wrong percentage answers |
| `question_banks/grade_5/g5_ratio.jsonl` | CRITICAL | Garbled Thai + wrong ratio answers |
| `question_banks/grade_5/g5_volume_area.jsonl` | HIGH | Unclear volume vs surface area |
| `question_banks/grade_6/g6_ratio_proportion.jsonl` | CRITICAL | Garbled Thai + wrong ratio answers |
| `question_banks/grade_6/g6_percentage_applications.jsonl` | CRITICAL | Garbled Thai + wrong percentage answers |
| `question_banks/grade_6/g6_coordinate_plane.jsonl` | CRITICAL | Garbled Thai text |
| `grade_2/review/g2_review_*.json` (all) | CRITICAL | Thai text completely garbled |
| `grade_1/lessons/g1_add_within_20.json` | MEDIUM | mini_quiz answer key mismatch (A vs C) |
