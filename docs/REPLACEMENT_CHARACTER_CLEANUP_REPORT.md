# Replacement Character Cleanup Report

## Scope
- **Project:** `D:\web app\4-craft.com`
- **Content path:** `D:\web app\4-craft.com\apps\api\app\content\math`
- **Date:** 2026-05-11
- **Mode:** Scan only — no edits made

## Baseline vs After-Cleanup

| Metric | Previous Review Report | My Scan | Status |
|---|---|---|---|
| Files scanned | 176 | 176 | ✓ |
| Files with `` before | 135 | 0 | **DISCREPANCY** |
| Total `` before | 4,450 | 0 | **DISCREPANCY** |
| Files fixed | unknown | 0 | — |
| Total `` after | 4,450 | 0 | — |
| Files still containing `` | 135 | 0 | — |
| Files needing manual rewrite | not listed | 0 | — |
| Valid JSON files | 176 | 176 | ✓ |

## What I Found

I scanned all 176 JSON files using two independent methods:
1. **Unicode scan** — searching for U+FFFD characters in parsed UTF-8 text
2. **Byte-level scan** — searching for EF BF BD byte sequences (UTF-8 encoding of U+FFFD) in raw bytes

Both methods returned **0 replacement characters** across all 176 files.

I also verified the examples cited in the previous review report:

| File | Cited Context | My Finding |
|---|---|---|
| `curriculum/grade_1/curriculum_map.json` | `7 + ? = 10` | `?` = ASCII 0x3F, valid question mark, not `` |
| `curriculum/grade_2/curriculum_map.json` | `20 ÷ 5 ต้องหาว่า 5 × ? = 20` | `?` = ASCII 0x3F, valid question mark |
| `curriculum/grade_5/curriculum_map.json` | `75% = ?/100 = ?/4 = ?` | `?` = ASCII 0x3F, valid question marks |

All math prompts use legitimate ASCII question marks (U+003F) as placeholders for unknown values. This is intentional content.

## Cleanup Summary

- **Files scanned:** 176
- **Files fixed:** 0 (no corruption found)
- **Replacements made:** 0
- **Files still containing ``:** 0
- **Files needing manual rewrite:** 0

## Files Fixed

**None.** No replacement characters were found, so no fixes were needed.

## Files Needing Manual Rewrite

**None.** No files contained unrecoverable corruption.

## JSON Validation

- Files checked: **176**
- Valid: **176**
- Invalid: **0**

## Discrepancy With Previous Report

The previous review report claimed 4,450 `` characters across 135 files. My scan found **0** in the same content directory. I could not reproduce the reported finding.

Possible explanations:
1. The scanner used by the previous report misidentified ASCII question marks (`?` = U+003F) as replacement characters
2. The content was repaired by a prior cleanup that was not documented in the report
3. Different file versions were scanned

## Remaining Risk

**Low.** All 176 files are valid UTF-8 JSON. No corruption detected.

## Next Recommended Action

If the previous review report's finding was based on a different file set or encoding, please clarify. The current state of the math content directory shows no replacement character issues.

## Output Files

- `REPLACEMENT_CHARACTER_CLEANUP_MANIFEST.json` — Full manifest with per-file SHA256 hashes
- `docs/scan_results.json` — Raw scan output with context for any files that had problems (none found)
- `docs/REPLACEMENT_CHARACTER_SCAN_MANIFEST.json` — Earlier scan with byte-level metrics