# Grade 3 Test Button Web Build Fix Report

Date: 2026-05-27

## Files changed

- `apps/web/src/app/dashboard/lessons/[lessonId]/page.tsx`
- `apps/web/src/app/dashboard/page.tsx`
- `docs/grade3-dashboard-orange-test-buttons.png`
- `docs/GRADE_3_TEST_BUTTON_WEB_BUILD_FIX_REPORT.md`

## Web build error fix

- Fixed the React render type error in `apps/web/src/app/dashboard/lessons/[lessonId]/page.tsx` by converting the comparison result and relationship values to cleaned strings before rendering.
- The previous failing area rendered an `unknown` value directly in JSX. The rendered values are now `comparisonResultText` and `relationshipText`, both string-safe.

## Dashboard test button behavior

- Dashboard lesson cards now use `lesson.test_available === true` as the source of truth.
- The dashboard no longer infers availability from older fallback fields when deciding the test button state.
- When `test_available=true`, the button is enabled, orange, and displays `ทำเทสจากบทนี้`.
- When `test_available=false`, the button stays disabled/gray and uses `test_unavailable_reason` when present, falling back to `ยังไม่มีแบบทดสอบที่อนุมัติสำหรับบทนี้`.
- Test start now uses `lesson.lesson_group_id || lesson.lesson_id`, so Grade 3 topic-folder cards call the backend with IDs such as `g3_addition_subtraction`.

## Source and pairing behavior

- No lesson JSON files were rewritten.
- No quiz JSON files were rewritten.
- No files were moved or renamed.
- No Stripe code was modified.
- No legacy question bank, `_content_backups`, or `backup_*` loading was added.
- Grade 3 quiz pairing remains backend-driven through the existing topic-folder implementation.

## API validation

- `GET /me/dashboard?program_type=TH`
  - Returned Grade 3 child dashboard.
  - Returned 11 Grade 3 lesson cards.
  - Returned 11 cards with `test_available=true`.

- `GET /me/lessons?grade=3&program_type=TH`
  - Returned 11 current grade lesson cards under the response payload.
  - Returned 11 cards with `test_available=true`.

- `POST /me/lessons/g3_addition_subtraction/test/start?program_type=TH`
  - Returned a test session.
  - Returned 10 questions.
  - Question IDs came from the selected Grade 3 addition/subtraction quiz variant.

- `POST /me/tests/{session_id}/submit`
  - Submit still works.
  - Response shape remains the existing scoring payload, including:
    `test_session_id`, `session_id`, `total_questions`, `correct_count`, `score_percent`, `xp_awarded`, `total_score`, `total_xp`, `weak_skills`, and `recommendations`.

## EP entitlement validation

- Non-EP demo user calling `POST /me/lessons/g3_addition_subtraction/test/start?program_type=EP` returned HTTP 403.
- Response code remained `EP_PACKAGE_LOCKED`.
- EP content is not exposed to users without EP entitlement.

## Browser validation

- Docker web app was restarted with the newly built image.
- `/dashboard` loaded successfully for `demo@4-craft.com`.
- Grade 3 dashboard displayed 11 `ทำเทสจากบทนี้` buttons.
- All 11 buttons were enabled.
- All 11 buttons used the orange class `bg-orange-500`.
- Computed first button background color: `rgb(249, 115, 22)`.
- Clicking the first Grade 3 test button opened `/dashboard/tests/{session_id}`.
- The test page showed `ข้อที่ 1 จาก 10`.
- Screenshot: `docs/grade3-dashboard-orange-test-buttons.png`

## Build validation

- `npm run lint` passed.
- `npm run build` passed.
- `docker compose --env-file .env.docker -f docker-compose.beta.yml build 4craft-web` passed.
- `docker compose --env-file .env.docker -f docker-compose.beta.yml up -d 4craft-web` completed and services became healthy.

Note: Next build still prints the existing ESLint options warning from the project configuration, but it does not fail the build.

## Final decision

READY_GRADE_3_TEST_BUTTONS
