# Grade 3 Topic Folder Connector Report

Date: 2026-05-23

## 1. Files changed

- `apps/api/app/services/lesson_content.py`
- `apps/api/app/routers/me.py`
- `apps/web/src/app/dashboard/page.tsx`
- `apps/web/src/app/admin/lessons/page.tsx`
- `apps/web/src/lib/api/admin-content.ts`
- `apps/web/src/lib/api/admin.ts`
- `docs/GRADE_3_TOPIC_FOLDER_CONNECTOR_REPORT.md`

No Grade 3 lesson JSON content files were rewritten, moved, renamed, deleted, or regenerated.

## 2. Loader added

Added Grade 3 topic-folder support in the canonical lesson loader:

- `list_grade3_topic_lessons(program_type)`
- `get_grade3_lesson_group(lesson_group_id, program_type)`
- `select_grade3_lesson_variant(topic_folder, program_type, user_id=None)`
- `list_grade3_quiz_variants(topic_folder, program_type)`
- `has_grade3_approved_quiz(topic_folder, program_type)`
- `start_grade3_topic_test(lesson_group_id, program_type)`

The connector wraps one selected JSON variant as a stable lesson group without modifying the JSON file.

## 3. Grade 3 folder map

- `addition_subtraction` -> `g3_addition_subtraction`
- `data_charts` -> `g3_data_charts`
- `division` -> `g3_division`
- `fractions` -> `g3_fractions`
- `geometry` -> `g3_geometry`
- `length` -> `g3_length`
- `money` -> `g3_money`
- `multiplication` -> `g3_multiplication`
- `numbers` -> `g3_numbers`
- `time` -> `g3_time`
- `weight_capacity` -> `g3_weight_capacity`

Titles prefer JSON metadata when present; otherwise the connector uses the requested Thai/English mapping.

## 4. TH topic folder count

- Grade 3 TH lesson topic folders found: 11
- Grade 3 TH lesson group cards returned: 11

## 5. EP topic folder count

- Grade 3 EP lesson topic folders found: 11
- Grade 3 EP lesson group cards returned by loader: 11
- Student EP exposure still depends on existing EP entitlement checks.

## 6. Dashboard validation result

Validated in the running `4craft-api` container through the same `_json_lesson_sections` path used by `/me/dashboard`:

- Grade 3 TH current lessons: 11
- IDs: `g3_addition_subtraction`, `g3_data_charts`, `g3_division`, `g3_fractions`, `g3_geometry`, `g3_length`, `g3_money`, `g3_multiplication`, `g3_numbers`, `g3_time`, `g3_weight_capacity`
- No `_ep` IDs in TH mode.

The dashboard frontend no longer truncates Grade 3 current lessons to 6 cards.

## 7. /lessons validation result

Validated through the same grade-filtered lesson-section path used by `/me/lessons?grade=3`:

- Grade 3 TH lessons: 11
- No `_ep` IDs in TH mode.
- Existing Grade 1, 2, 4, 5, and 6 canonical behavior remains unchanged.

## 8. Lesson detail source validation

- `g3_division` resolves to `grade_3/lessons/TH/division/division_th_001.json`
- `g3_money` resolves to `grade_3/lessons/TH/money/money_th_001.json`
- Variant metadata includes `lesson_group_id`, `topic_folder`, `selected_variant_id`, and `source_path`.
- No active Grade 3 group lesson source resolves from `_content_backups`, `backup_*`, `question_banks`, or legacy folders.

## 9. Test start source validation

The connector now checks:

- TH quiz path: `grade_3/quizzes/TH/[topic_folder]/*.json`
- EP quiz path: `grade_3/quizzes/EP/[topic_folder]/*.json`

Current quiz folders with files:

- TH: `addition_subtraction` has 2 files, `numbers` has 2 files.
- EP: `addition_subtraction` has 2 files, `numbers` has 2 files.

Those quiz files are currently `needs_review`, so student `test_available` remains false and the disabled reason is:

`ยังไม่มีแบบทดสอบที่อนุมัติสำหรับบทนี้`

`g3_division` currently has no approved TH quiz and does not start a test.

## 10. Admin validation result

- `/admin/lessons` now loads TH and EP canonical rows explicitly.
- Grade 3 admin lesson rows expose topic folder, source folder, variant count, approved variant count, and variant filenames.
- `list_canonical_lessons("TH", grade=3, include_admin_status=True)` returns 11.
- `list_canonical_lessons("EP", grade=3, include_admin_status=True)` returns 11.
- `/admin/tests` can receive Grade 3 quiz variants from the new quiz topic folders when present.

## 11. Missing quiz folders/files

The topic folders exist, but these topics currently have 0 quiz JSON files in both TH and EP:

- `data_charts`
- `division`
- `fractions`
- `geometry`
- `length`
- `money`
- `multiplication`
- `time`
- `weight_capacity`

Existing quiz files under `addition_subtraction` and `numbers` are not approved yet.

## 12. Remaining limitations

- Variant selection is first-valid-file deterministic for now. The loader supports future `001` through `999` files without hardcoded filenames.
- Per-variant approve/reject/edit still uses the current admin content controls at the lesson-group level; the connector exposes source folders and variant filenames for admin visibility.
- The Next.js build still prints the repo’s existing ESLint option warning, but exits successfully.

## 13. Validation commands

- `python -m py_compile apps/api/app/services/lesson_content.py apps/api/app/routers/me.py apps/api/app/routers/admin.py`: passed
- `npm run lint`: passed
- `npm run build`: passed
- `docker compose --env-file .env.docker -f docker-compose.beta.yml build 4craft-api 4craft-web`: passed
- `docker compose --env-file .env.docker -f docker-compose.beta.yml up -d 4craft-api 4craft-web`: passed
- API health: `{"status":"ok"}`
- Web `/dashboard`: HTTP 200
- API/web containers: healthy

## Final decision

READY_GRADE_3_TOPIC_FOLDER_CONNECTOR
