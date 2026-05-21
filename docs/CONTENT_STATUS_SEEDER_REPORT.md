# Content Status Seeder Report

Date: 2026-05-16

## Summary

Created a safe initial content status seeding tool so TOPA Math does not require manually approving 101 existing lessons through the admin UI.

The seeder scans the real file content source under `apps/api/app/content/math`, initializes only missing status metadata by default, and preserves existing admin review decisions unless `--force` is explicitly used.

Final decision: READY_TO_SEED_CONTENT_STATUS

## Files Changed

- `apps/api/app/services/content_status.py`
- `apps/api/app/scripts/seed_content_status.py`
- `apps/api/app/routers/admin.py`
- `apps/api/app/services/lesson_content.py`
- `apps/web/src/lib/api/admin-content.ts`
- `apps/web/src/app/admin/content/page.tsx`

## Seeder Behavior

- Default mode preserves existing lesson/test status records.
- `--dry-run` shows proposed changes without writing sidecar files.
- `--force` recalculates and overwrites existing sidecar decisions.
- Lessons with displayable content and no blocking seeding errors are marked `approved`.
- Lessons with blocking errors are marked `needs_review`.
- EP lessons are approved only when a real EP file exists and passes seeding validation.
- Test/question rows are approved only when choices, correct answer, and explanation validation passes.
- Test/question rows with missing or invalid answer metadata are marked `needs_review`.

## Admin Endpoint

Added/updated:

- `POST /admin/content/initialize?dry_run=false&force=false`

Security:

- Protected by the existing `require_admin` dependency.
- Does not expose secrets.
- Does not touch Stripe or auth logic.

## Admin UI

Added a button on `/admin/content`:

- `Initialize missing statuses`

The button calls the safe admin endpoint without `force`, so existing admin decisions are kept.

## Docker Commands

Dry run:

```powershell
docker exec -it 4craft-api python -m app.scripts.seed_content_status --dry-run
```

Seed missing statuses:

```powershell
docker exec -it 4craft-api python -m app.scripts.seed_content_status
```

Force recalculation:

```powershell
docker exec -it 4craft-api python -m app.scripts.seed_content_status --force
```

## Dry-Run Result

Local dry run completed without writing files.

- Total lessons found: 101
- Approved lessons: 101
- Needs review lessons: 0
- Draft lessons: 0
- Total tests/questions found: 1888
- Approved tests/questions: 336
- Tests/questions needing review: 1552
- Real EP lessons found: 51
- Approved EP lessons: 51
- Total proposed changes: 1989

## Validation Results

- Python compile passed for changed backend modules.
- Seeder dry-run passed.
- Admin route import check confirmed:
  - `/admin/content/initialize`
  - `/admin/content/lessons`
  - `/admin/content/tests`
  - `/admin/content/tests/{question_id}/validate`
- Frontend production build passed.
- Next.js emitted an existing ESLint configuration warning about removed ESLint options, but the build completed successfully.

## Remaining Notes

- The seeder has not been executed in write mode during this pass.
- Existing question banks need content QA because most question rows correctly remain `needs_review`.
- Run the Docker dry-run command first inside the live beta container, then run the normal seed command if the counts match expectations.
