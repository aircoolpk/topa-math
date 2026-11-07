# All Grades Topic-Folder Auto Loader Report

## 1. Files Changed

- `apps/api/app/services/lesson_content.py`
- `apps/api/app/routers/me.py`
- `apps/api/app/routers/admin.py`
- `apps/web/src/lib/api/me.ts`
- `apps/web/src/app/lessons/page.tsx`

Existing dirty content files and prior reports were left untouched by this pass.

## 2. Generic Folder Discovery Logic

The student/admin content loader now discovers topic folders for grades 1-6 from:

- `grade_[N]/lessons/TH/[topic_folder]`
- `grade_[N]/lessons/EP/[topic_folder]`
- `grade_[N]/quizzes/TH/[topic_folder]`
- `grade_[N]/quizzes/EP/[topic_folder]`

Discovery ignores `_content_backups`, `_*/hidden`, `backup_*`, `old`, `question_banks`, `legacy`, and non-directory entries. Lesson group IDs are generated as `g{grade}_{topic_folder}`, for example `g1_add_sub_within_20`.

## 3. Lesson Variant Selection Logic

Lesson detail resolution now uses the generic topic-folder resolver:

`lesson_group_id -> grade_level -> topic_folder -> program_type -> grade_[N]/lessons/[TH|EP]/[topic_folder]/*.json`

Student mode selects only student-visible variants. Grade 3 remains compatible with the existing beta behavior. Grade 1 content remains hidden from students because the current files are `needs_review`. Non-repeating lesson selection reuses the existing `LessonVariantView` cycle history per child + program-scoped lesson group.

## 4. Quiz Variant Selection Logic

Test start uses the generic quiz resolver:

`lesson_group_id -> grade_level -> topic_folder -> program_type -> grade_[N]/quizzes/[TH|EP]/[topic_folder]/*.json`

TH never reads EP folders and EP never reads TH folders. Quiz non-repeat uses existing test session metadata/cycle behavior for the selected quiz variant.

## 5. Approval Visibility Rule

Normal students see approved/student-visible variants only. `needs_review` variants are visible through admin diagnostics/listing, not student cards. `/me/lessons` and `/me/dashboard` now include `content_diagnostics` with folder count, variant count, approved count, needs_review count, student-visible count, and `hidden_reason`.

## 6. /lessons Validation

API checks:

- `GET /me/lessons?grade=1&program_type=TH`: `200`, `current_grade_lessons=0`, `lessons=0`, diagnostics `hidden_reason=found_files_but_needs_review`, `topic_folders_found=14`, `lesson_variants_found=28`, `student_visible_count=0`.
- `GET /me/lessons?grade=3&program_type=TH`: `200`, `current_grade_lessons=11`, `test_available=true` on 11/11 cards.
- Non-EP demo user requesting `program_type=EP`: `403 EP_PACKAGE_LOCKED`.

The web `/lessons` page now reads selected-grade diagnostics and uses `lesson.test_available === true` for the test button state. Browser automation could not complete form entry because the in-app browser reported a virtual clipboard/fill issue, so UI verification was API/build-backed.

## 7. /dashboard Validation

`GET /me/dashboard?program_type=TH` for the demo Grade 3 child returned `200`, `grade=3`, 11 current-grade rows, and 11 rows with `test_available=true`.

Dashboard and lessons card loading now avoid legacy full-file scans for discovered topic-folder grades; topic cards use canonical summary rows, while lesson detail still loads the selected JSON variant.

## 8. Admin Validation

Admin checks:

- `/admin/content/lessons?grade=1&program_type=TH`: 14 rows; first topic `add_sub_within_20`; `variant_count=2`.
- `/admin/tests?grade=1&program_type=TH`: 14 rows; first topic `counting_1_to_10`; `quiz_variant_count=2`.
- `/admin/tests?grade=3&program_type=TH`: 11 rows; first topic `addition_subtraction`; `quiz_variant_count=2`.
- `/admin/tests?grade=6&program_type=TH`: 10 discovered quiz topic folders, currently empty/no variants.

## 9. Grade 1 Result

Grade 1 topic-folder discovery is ready for both lessons and quizzes. Student cards remain hidden until lesson variants are approved. This is expected and intentional: files exist, admin can review them, but students do not see `needs_review`.

## 10. Grade 3 Regression Check

Grade 3 remains working:

- 11 TH lesson cards found.
- 11/11 TH lesson cards report `test_available=true`.
- `POST /me/lessons/g3_addition_subtraction/test/start?program_type=TH` returned 10 questions.
- `POST /me/tests/{session_id}/submit` returned the existing scoring payload keys including `correct_count`, `total_questions`, `score_percent`, `xp_awarded`, `total_score`, and mastery/recommendation fields.

## 11. Remaining Issues

- Root `npm run lint` and root `npm run build` are not defined; `apps/web/npm run lint` and `apps/web/npm run build` were run and passed.
- Next build still prints the existing ESLint invalid-options warning, but exits successfully.
- Browser form automation was blocked by the in-app browser fill/virtual clipboard/localStorage issue; API, Docker, and build validation passed.
- Grade 1 student visibility depends on approving the `needs_review` files.

## 12. Final Decision

READY_ALL_GRADES_TOPIC_FOLDER_LOADER
