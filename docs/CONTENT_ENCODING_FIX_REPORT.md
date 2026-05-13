# Content Encoding Fix Report

## Summary

| Metric | Before | After |
|---|---|---|
| Total JSON files scanned | 176 | 176 |
| Invalid JSON files | 5 | 0 |
| Files with UTF-8 BOM | 2 | 0 |
| Files with replacement chars (U+FFFD) | 6 | 6 (unchanged — low-priority targeted fix needed) |
| Files with mojibake indicators | 135 | 0 (false positive — PowerShell display issue, not real corruption) |

---

## Files Fixed

### 1. LESSON_CONTENT_FIXES.json
- **Issue:** UTF-8 BOM (EF BB BF) at start of file
- **Fix:** BOM stripped, file rewritten as clean UTF-8
- **Verification:** Valid JSON with 1,308 items. First 4 bytes changed from `EF BB BF 5B` to `5B 0D 0D 0A`
- **Backup:** `D:\web app\4-craft.com\apps\api\backup_content\LESSON_CONTENT_FIXES.json`

### 2. LESSON_CONTENT_QA_SUMMARY.json
- **Issue:** UTF-8 BOM (EF BB BF) at start of file
- **Fix:** BOM stripped, file rewritten as clean UTF-8
- **Verification:** Valid JSON with 15 items. First 4 bytes changed from `EF BB BF 7B` to `7B 0D 0D 0A`
- **Backup:** `D:\web app\4-craft.com\apps\api\backup_content\LESSON_CONTENT_QA_SUMMARY.json`

### 3. QUESTION_FIXES_SUGGESTED.json
- **Issue:** Syntax error at line 106 — trailing non-JSON text `(reading from corrupted data)` after array value
- **Fix:** Removed the trailing comment text from the `current_choices` field
- **Before:** `"current_choices": ["2", "0", "3", "1"] (reading from corrupted data),`
- **After:** `"current_choices": ["2", "0", "3", "1"],`
- **Verification:** Valid JSON with 12 items
- **Backup:** `D:\web app\4-craft.com\apps\api\backup_content\QUESTION_FIXES_SUGGESTED.json`

### 4. curriculum/grade_1/curriculum_map.json
- **Issue:** Syntax error at line 621 — missing closing `]` for `real_life_contexts` array AND missing `,` to separate from next property `quest_ideas`
- **Fix:** Changed lines 620-621 to properly close the `real_life_contexts` array and separate it from `quest_ideas`
- **Before:**
  - Line 620: `"real_life_contexts": ["ลายกระเบื้อง ลายผ้า ลายปูน",` (unclosed string, missing ])
  - Line 621: `"quest_ideas": ["daily: สร้างแบบรูปด้วยสิ่งของในบ้าน"]` (sibling key)
- **After:**
  - Line 620: `"real_life_contexts": ["ลายกระเบื้อง ลายผ้า ลายปูน"],`
  - Line 621: `"quest_ideas": ["daily: สร้างแบบรูปด้วยสิ่งของในบ้าน"]`
- **Verification:** Valid JSON
- **Backup:** `D:\web app\4-craft.com\apps\api\backup_content\curriculum\grade_1\curriculum_map.json`

### 5. curriculum/grade_2/curriculum_map.json
- **Issue:** Syntax error at line 383 — two string values fused as a single key's value instead of two separate key-value pairs
- **Fix:** Split into two separate key-value pairs: `concrete` and `concrete_2`
- **Before:** `"concrete": "ใช้นิ้วมือ 5 นิ้ว นับทีละ 5", "ใช้ไม้บรรทัด 10 เซนติเมตร นับทีละ 10",`
- **After:**
  - `"concrete": "ใช้นิ้วมือ 5 นิ้ว นับทีละ 5",`
  - `"concrete_2": "ใช้ไม้บรรทัด 10 เซนติเมตร นับทีละ 10",`
- **Verification:** Valid JSON
- **Backup:** `D:\web app\4-craft.com\apps\api\backup_content\curriculum\grade_2\curriculum_map.json`

---

## Mojibake Investigation Results

### Conclusion: NOT a real encoding problem in the JSON data files

**Finding:** The Thai text stored in the JSON content files is **correct UTF-8**. The mojibake in API responses is **NOT caused by corrupted data files**.

### Evidence:

1. **JSON files contain valid Thai UTF-8:**
   - Direct file reads via `fs.readFileSync(fp, 'utf8')` show correct Thai: `บวกเลขไม่เกิน 20 กับพี่อลิส`
   - `title_th` fields display correctly when read with Node.js/Python directly from disk
   - No mojibake indicators in the 176 JSON files when scanned with Python (0 Latin-ext chars > 100 threshold)

2. **Backend reads files correctly:**
   - `me.py` line 159: `json.loads(path.read_text(encoding="utf-8"))` — correct UTF-8 read
   - Backend code uses `encoding="utf-8"` explicitly

3. **What the 135 "mojibake" files actually contained:**
   - The system test report used PowerShell `Select-String` with default encoding (Windows cp1252)
   - PowerShell's default console output encoding is NOT UTF-8
   - Thai UTF-8 bytes rendered as `à¸...` in PowerShell's cp1252 console = display artifact, not data corruption
   - This is a **terminal/display issue**, not an API or file encoding issue

4. **The 6 files with U+FFFD (replacement character):**
   - **Not mojibake** — these have a single corrupted byte at a specific position
   - The U+FFFD appears in the JSON string as a placeholder for an invalid byte
   - All 6 are in the curriculum/quiz files, not the lesson content
   - **Actual corrupted bytes found:**
     - `curriculum/grade_4/curriculum_map.json`: byte offset 46193 — one bad byte among valid Thai
     - `curriculum/grade_5/curriculum_map.json`: byte offset 32803 — similar isolated byte error
     - `curriculum/grade_6/curriculum_map.json`: byte offset 29891 — similar isolated byte error
     - `g6/quizzes/g6_pre_algebra.json`: byte offset 5191
     - `grade_2/lessons/g2_shapes_2d.json`: byte offset 13184
     - `grade_3/quizzes/g3_multi_step_word_problems.json`: byte offset 1588
   - **Root cause:** Likely single-byte corruption from file transfer, sync errors, or copy-paste accidents
   - **Severity:** Very low — only 1 byte corrupted per file among thousands of valid Thai bytes
   - **Thai text elsewhere in the same files is intact UTF-8**

---

## Whether Corruption is Real or Display-only

| Aspect | Conclusion |
|---|---|
| Thai text in JSON files | ✅ Correct UTF-8 — NOT corrupted |
| API responses (actual JSON body) | ⚠️ NOT tested directly in this session — need browser/curl verification |
| PowerShell terminal display | ❌ Shows mojibake due to wrong default encoding |
| 6 files with U+FFFD | ⚠️ Real but minimal single-byte corruption (not encoding mismatch) |
| BOM in 2 JSON files | ✅ Real — prevented JSON parsing |
| JSON syntax errors in 3 files | ✅ Real — missing ] and fused string values |

---

## Mojibake Source (Root Cause)

**Primary:** PowerShell default encoding (cp1252) interpreting Thai UTF-8 bytes as Latin-1 Supplement characters (`à-ÿ`), producing `à¸...` patterns that look like mojibake.

**Secondary:** 6 files have 1-2 genuinely corrupted bytes (not encoding issues) at isolated positions.

**Not the cause:** The API backend code correctly uses `encoding="utf-8"` when reading JSON files.

---

## Next Recommended Actions

### Priority 1 (Do next):
1. **Verify API Thai encoding in actual HTTP response** — Use curl or browser DevTools to inspect the raw JSON response body from `http://127.0.0.1:8001/me/lessons`. The API returns JSON with `application/json` content-type, which should be UTF-8. Check if the response body itself shows mojibake or correct Thai.

2. **Fix the 6 files with U+FFFD replacement characters** — Each has one bad byte. These are low-effort fixes:
   - Open each file, find and replace the U+FFFD with the correct byte (using hex editor or by rewriting the sentence)
   - Or just rewrite the specific corrupted sentence for each file

### Priority 2:
3. **Fix remaining rendering issues** — `/lessons` returns 404 (route missing), frontend missing chunk errors, mini_quiz schema problems
4. **Rewrite corrupted Thai content** — The 6 files with U+FFFD and the `g2_shapes_2d.json` emoji issue can be fixed by rewriting only the affected sentences

### NOT Needed:
- Do NOT rewrite all lesson content — Thai text in files is already correct
- Do NOT change API encoding settings — they are already correct
- Do NOT convert file encodings — files are already UTF-8

---

## Files Still Containing Corruption (Need Attention)

| File | Issue | Severity |
|---|---|---|
| `curriculum/grade_4/curriculum_map.json` | 1 bad byte at offset 46193 | Low |
| `curriculum/grade_5/curriculum_map.json` | 1 bad byte at offset 32803 | Low |
| `curriculum/grade_6/curriculum_map.json` | 1 bad byte at offset 29891 | Low |
| `g6/quizzes/g6_pre_algebra.json` | 1 bad byte at offset 5191 | Low |
| `grade_2/lessons/g2_shapes_2d.json` | 1 bad byte at offset 13184 (emoji mixed with Thai) | Low |
| `grade_3/quizzes/g3_multi_step_word_problems.json` | 1 bad byte at offset 1588 | Low |

All 6 files need a targeted sentence rewrite, not a full file rewrite.
