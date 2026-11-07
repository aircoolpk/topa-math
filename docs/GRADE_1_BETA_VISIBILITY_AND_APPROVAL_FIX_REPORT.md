# Grade 1 Beta Visibility And Approval Fix Report

## 1. Root Cause

Grade 1 topic-folder lesson files existed under the active `grade_1/lessons/{TH,EP}` folders, but student visibility for topic-folder variants was gated by the status inside each variant JSON. Admin approval wrote to sidecar status metadata keyed by the lesson group id, so approving `g1_*` in admin did not make the active topic-folder variant files visible when their JSON status was still `needs_review`.

## 2. Beta Visibility Policy Added

Student-facing topic-folder lesson and quiz loaders now allow active `needs_review` variants when `ENVIRONMENT=local`, `ENVIRONMENT=beta`, or `NEXT_PUBLIC_APP_ENV=beta`.

Strict production behavior still requires approved/published/active status. Rejected, archived, disabled, inactive, invalid JSON, backup, old, legacy, and question bank paths remain excluded.

Code comment added:

> Beta mode allows needs_review active topic-folder content so testers can review student flow before formal approval.

## 3. Approval Status Key Fix

Added stable topic-folder status keys for variants:

`g{grade}_{topic_folder}__{program_type}__{variant_id_or_filename}`

Admin approval now updates the lesson group sidecar key and each active topic-folder variant key for the selected TH/EP program. The student loader reads the same sidecar keys before falling back to the JSON status.

## 4. /lessons Grade 1 Result

Validated against the running beta API:

- `GET /me/lessons?grade=1&program_type=TH` returns 14 Grade 1 TH lesson cards.
- No EP ids appear in the TH response.
- Diagnostics report 14 topic folders, 28 variant files, 28 `needs_review`, 28 beta-visible variants, and 14 student-visible lesson groups.

## 5. Dashboard Grade 1 Result

The shared canonical lesson loader now returns Grade 1 topic-folder content in beta mode, so `/dashboard` receives the same student-visible Grade 1 lesson groups when Grade 1 is in the requested/current dashboard grade set.

## 6. Test Button Result

Validated:

- `POST /me/lessons/g1_add_sub_within_20/test/start?program_type=TH`
- Loads from `grade_1/quizzes/TH/add_sub_within_20`.
- Returns 10 questions.
- Does not mix EP quiz content into TH mode.

## 7. Grade 3 Regression Result

Validated:

- `GET /me/lessons?grade=3&program_type=TH` returns 11 cards.
- `POST /me/lessons/g3_addition_subtraction/test/start?program_type=TH` returns 10 questions.

## 8. Files Changed

- `apps/api/app/services/lesson_content.py`
- `apps/api/app/routers/admin.py`
- `apps/web/src/app/admin/lessons/page.tsx`
- `apps/web/src/lib/api/admin-content.ts`
- `apps/web/src/app/lessons/page.tsx`
- `docs/GRADE_1_BETA_VISIBILITY_AND_APPROVAL_FIX_REPORT.md`

## 9. Remaining Risks

- The repo has many pre-existing uncommitted content moves/deletions unrelated to this fix; they were not reverted.
- Next.js build still prints an existing ESLint option warning, but exits successfully.
- Browser checks depend on beta auth/session state and Cloudflare routing; API-level authenticated checks passed on the rebuilt beta stack.

## 10. Final Decision

READY_GRADE_1_BETA_VISIBLE
