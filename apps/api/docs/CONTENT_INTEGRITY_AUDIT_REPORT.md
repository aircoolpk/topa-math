# TOPA Math Content Integrity Audit

## Storage Model
- Lessons: JSON files under apps/api/app/content/math/grade_*/lessons plus sidecar status metadata
- Tests: JSONL files under apps/api/app/content/math/question_banks/grade_* plus sidecar status metadata
- Pairing field: question_bank filename and row.lesson_id must match lesson.lesson_id
- Status metadata: apps/api/app/content/math/_content_status/lessons.json and tests.json

## Summary
- Total lessons: 101
- Complete lessons: 101
- Broken lessons: 0
- Total test files: 98
- Matched test files: 87
- Missing test files: 0
- Broken test files: 0
- EP missing base lessons: 0

## Blocking Lesson Issues

## Blocking Test Issues

## Missing Pairings

## Recommended Fixes
- Generate or repair one approved question bank per student-visible lesson_id.
- Seed test status per question_id after validation, preserving existing admin decisions unless --force is used.
- Let student test start check approved question_banks in addition to embedded lesson quizzes.
- Hide or mark needs_review for lessons with mojibake, missing visual blocks, missing number sentences, or no practice quiz.
- Create EP lesson/test files for every approved TH base lesson before EP users see the content.
