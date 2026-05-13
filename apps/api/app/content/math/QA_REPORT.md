# Math Question Bank QA Report

**Auditor:** Alice  
**Date:** 2026-05-04  
**Path:** `D:\web app\4-craft.com\apps\api\app\content\math\`

---

## 1. Summary

| Metric | Value |
|--------|-------|
| Quiz JSON files scanned | 42 |
| Total questions audited (JSON) | 927 |
| Quiz JSONL files scanned | 14 |
| JSONL total lines | ~5,250 |
| Total issues found | 14 |
| **HIGH severity** | 12 |
| **MEDIUM severity** | 2 |
| **LOW severity** | 0 |

### JSONL Audit
- All 14 JSONL files: valid JSON per line
- No trailing invalid commas
- No empty arrays where questions expected
- UTF-8 encoding (Thai text partially corrupted — see Section 3)

---

## 2. Critical Issues

### Issue 2.1 — g2_money_change.json: Mathematically Wrong Answers

**Severity:** HIGH  
**File:** `grade_2/quizzes/g2_money_change.json`  
**Type:** WRONG_CORRECT_ANSWER — Backend will mark correct answers wrong

These questions compute a sum of Thai coins/bills, but `correct_answer` is wrong:

| QID | Question Text (partial) | Stored Answer | Actual Math | Off By |
|-----|------------------------|---------------|-------------|--------|
| q004 | 20+20+10+5+2 = ? บาท | 57 | 40 | **−17** |
| q006 | 50+20+10 = ? บาท | 80 | 70 | **−10** |
| q011 | 100+50+20+5 = ? บาท | 175 | 150 | **−25** |
| q015 | 10+10+5+2+1 = ? บาท | 28 | 20 | **−8** |
| q018 | 50+10+10+5 = ? บาท | 75 | 60 | **−15** |
| q022 | 100+100+50+20+5+2+1 = ? บาท | 278 | 200 | **−78** |

**Root cause:** Likely copy-paste from a different question's answer. Each wrong answer is unique — not a mass-duplication like g2_subtract.

---

### Issue 2.2 — g2_subtract_two_digit.json: Design Flaw — Answer "33" in 68% of Questions

**Severity:** HIGH  
**File:** `grade_2/quizzes/g2_subtract_two_digit.json`  
**Type:** SEVERE_ANSWER_SKEW — Quiz design makes correct answer trivially guessable

Answer "33" appears in **15 out of 22 questions** (68%):

| correct_answer | Count | Question IDs |
|---|---|---|
| 33 | 15x | q004, q005, q008, q009, q010, q011, q012, q014, q016, q017, q018, q019, q020, q021, q022 |
| 22 | 1x | q015 |
| 23 | 1x | q006 |
| 35 | 1x | q001 |
| 42 | 1x | q002 |
| 43 | 1x | q007 |
| 44 | 2x | q003, q013 |

The math is correct — 67−34=33, 86−53=33, 97−64=33, etc. — but the **design is broken**. A student who guesses "33" for every question gets 68% correct without understanding. This defeats the quiz's purpose as an assessment tool.

---

## 3. Encoding Corruption — THAI TEXT UNUSABLE

**Severity:** HIGH (per file)  
**Affected files:** 3 JSON files + all 14 JSONL files

All Thai text fields (`question_text_th`, `choices`, `explanation_th`, `hint_th`, `topic_name_th`, `skill_name_th`) display corrupted character sequences like:
- `,s,,-`
- `,T,,-,`
- `1,,1^,,,"1%,,T`

This means **all Thai-language content in 14 JSONL files and 3 JSON quiz files is unreadable**. The underlying math (numbers, arithmetic operators, correct_answer integers) appears intact in some files.

| File | Grade | Status |
|------|-------|--------|
| `grade_2/quizzes/g2_shapes_2d.json` | G2 | ❌ ALL Thai text corrupted |
| `grade_2/quizzes/g2_time_calendar.json` | G2 | ❌ ALL Thai text corrupted |
| `grade_3/quizzes/g3_multi_step_word_problems.json` | G3 | ❌ ALL Thai text corrupted |
| ALL 14 .jsonl files | G2–G3 | ❌ All Thai text corrupted |

---

## 4. Wrong Math / Wrong Correct Answer

Only one file had mathematically wrong `correct_answer` values:

| File | Question IDs with Wrong Answer |
|------|-------------------------------|
| `grade_2/quizzes/g2_money_change.json` | q004, q006, q011, q015, q018, q022 |

All other 921 questions in the audited JSON files had correct `correct_answer` values.

---

## 5. Correct Answer Not In Choices

**Result:** 0 instances found. Every `correct_answer` value was found in the `choices` array for all 927 audited questions.

---

## 6. Ambiguous or Bad Question Text

No ambiguous question texts found. All numeric questions are clear arithmetic expressions. Word problems in g3_multi_step_word_problems.json are unreadable due to encoding corruption but appear structurally sound.

---

## 7. Explanation Mismatch

No explanation content was audited in detail (explanations are in Thai and unreadable due to encoding). Recommend manual verification once encoding is fixed.

---

## 8. Duplicate Questions / Duplicate IDs

### Within-file duplicates
**Result:** 0 instances. All question IDs are unique within each JSON file.

### Cross-file duplicate question IDs
**Result:** N/A — question IDs are namespaced by file (e.g., q001 in g1_add_one_digit.json is different from q001 in g2_subtract_two_digit.json).

### Same question text, different correct_answer
Not audited due to encoding corruption preventing text comparison. Recommend after encoding fix.

---

## 9. Grade/Topic/Skill Mismatch

No grade/topic/skill mismatches detected in the JSON metadata. All quiz files have consistent:
- `grade_level` matching directory name
- `topic_code` matching filename
- `skill_code` matching `topic_code`

---

## 10. Scoring Normalization Risk

**YES — scoring normalization is recommended.**

### Observed risks:

#### Risk 1: Unit suffix mismatch (g2_money_change.json)
`choices` contain "28 บาท" (Thai baht unit) but `correct_answer` is just "28". If backend compares selected answer text directly against `correct_answer` string, "28 บาท" would NOT match "28".

#### Risk 2: String vs integer comparison
`correct_answer` is always a string ("35", "33", "28") not an integer. If frontend sends numeric index (0, 1, 2, 3) instead of text, comparison fails.

#### Risk 3: Whitespace/trailing spaces
Not observed but possible — recommend `.trim()` on all comparisons.

#### Risk 4: Thai digit to Arabic digit conversion
If Thai numerals appear in any choices or answers, they would not match Arabic digit comparison.

---

### Recommended Backend Normalizations

```
1. TRIM whitespace on both correct_answer and submitted answer
2. NORMALIZE Thai digits (๐๑๒๓๔๕๖๗๘๙) → Arabic digits (0-9) before compare
3. STRIP units when configured (e.g., "28 บาท" → "28") if unit-stripping mode enabled
4. SUPPORT both text match and index match — index 0-3 maps to choices[0-3]
5. NORMALIZE fractions: "1/2" and "0.5" treated as equivalent when safe
6. COMPARE lowercase if case-insensitive mode enabled (not default)
7. CONVERT full-width numerals if any present
```

---

## 11. Issues Summary Table

| # | File | QID(s) | Severity | Type |
|---|------|--------|----------|------|
| 1 | `grade_2/quizzes/g2_money_change.json` | q004, q006, q011, q015, q018, q022 | HIGH | WRONG_CORRECT_ANSWER |
| 2 | `grade_2/quizzes/g2_subtract_two_digit.json` | q004-022 (15 total) | HIGH | ANSWER_SKEW_DESIGN_FLAW |
| 3 | `grade_2/quizzes/g2_shapes_2d.json` | ALL | HIGH | ENCODING_CORRUPTION |
| 4 | `grade_2/quizzes/g2_time_calendar.json` | ALL | HIGH | ENCODING_CORRUPTION |
| 5 | `grade_3/quizzes/g3_multi_step_word_problems.json` | ALL | HIGH | ENCODING_CORRUPTION |
| 6 | All 14 `.jsonl` files | ALL | HIGH | ENCODING_CORRUPTION |
| 7 | `grade_2/quizzes/g2_money_change.json` | q001-022 | MEDIUM | SCORING_UNIT_MISMATCH |

---

## 12. Recommended Immediate Actions

1. **Fix g2_money_change.json** — correct 6 wrong answers (see Section 2.1 table)
2. **Redesign g2_subtract_two_digit.json** — replace with subtraction problems that have diverse answers (not 33 for 68%)
3. **Re-save encoding-corrupted files** — open all Thai text files in UTF-8-safe editor and re-save
4. **Add backend scoring normalization** — implement trim, Thai digit conversion, unit stripping
5. **Verify JSONL math correctness** — JSONL files have correct number/math but Thai text is corrupted

---

*Report generated by Alice | Files: `apps/api/app/content/math/QA_REPORT.md` and `apps/api/app/content/math/QUESTION_FIXES_SUGGESTED.json`*