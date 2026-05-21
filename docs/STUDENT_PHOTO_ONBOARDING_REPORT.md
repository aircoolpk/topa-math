# TOPA Math Student Photo Onboarding Report

Date: 2026-05-21

## 1. Files Changed

- `apps/web/src/app/register/page.tsx`
- `apps/web/src/app/dashboard/page.tsx`
- `apps/web/src/components/avatar/PhotoAvatar.tsx`
- `apps/web/src/components/profile/ProfileHero.tsx`
- `apps/web/src/lib/api/children.ts`
- `apps/web/src/lib/api/me.ts`
- `apps/api/app/routers/me.py`
- `apps/api/app/schemas/api.py`

## 2. Backend Upload Endpoint Added/Changed

Reused the existing authenticated student avatar endpoint:

- `POST /me/students/{child_id}/avatar`

Behavior:

- Requires authenticated parent user.
- Verifies the requested child belongs to the current user.
- Accepts multipart image upload.
- Allows `image/jpeg`, `image/png`, and `image/webp`.
- Rejects unsupported content types.
- Rejects files larger than 5 MB.
- Returns:
  - `student_photo_url`
  - `student_photo_absolute_url`
  - `avatar_url`

## 3. Image Resize/Compression Behavior

The API processes the uploaded image with Pillow:

- Auto-orients using EXIF.
- Converts image to RGB.
- Center-crops to a square.
- Resizes to `320x320`.
- Saves as WebP with quality `80`.
- Uses a UUID-style random suffix and child id in the saved filename.
- Does not expose local filesystem paths to the frontend.

Validation upload produced a small optimized WebP file of `1320` bytes for the synthetic test image.

## 4. Storage Path

Runtime storage path:

- Docker/container: `/app/storage/uploads/avatars`
- Host beta volume: `storage/uploads/avatars`

Public URL:

- `/storage/avatars/<filename>.webp`

Static serving was validated through:

- `GET http://127.0.0.1:8001/storage/avatars/<filename>.webp` -> `200`

## 5. Fields Added/Reused

Reused existing child profile fields:

- `student_photo_url`
- `student_photo_path`
- `avatar_gender`

Updated accepted `avatar_gender` values to include:

- `girl`
- `boy`
- `unspecified`

Updated frontend dashboard/register types to carry `student_photo_url`, `student_photo_path`, and the widened gender value.

## 6. Dashboard Binding

Dashboard welcome profile image now uses this display priority:

1. `child.student_photo_url`
2. existing `avatar_gender` fallback avatar
3. generic fallback avatar behavior inside `PhotoAvatar`

The dashboard API response now includes `student_photo_url` in the child summary and top-level avatar payload, so the uploaded photo appears immediately after onboarding redirect when `/me/dashboard` is fetched.

## 7. Validation Results

Passed:

- `python -m py_compile app\routers\me.py app\schemas\api.py`
- `npm run lint`
- `npm run build`
- `docker compose --env-file .env.docker -f docker-compose.beta.yml build 4craft-web 4craft-api`
- `docker compose --env-file .env.docker -f docker-compose.beta.yml up -d 4craft-api 4craft-web`
- API health: `GET http://127.0.0.1:8001/health` -> `ok`
- Web route: `GET http://127.0.0.1:3000/register` -> `200`
- Docker health:
  - `4craft-api` healthy
  - `4craft-web` healthy
- Browser check:
  - `/register` loaded with no console errors.
  - Step 3 shows photo upload UI.
  - Gender choices appear: girl, boy, unspecified.
  - Step 3 no longer shows the old avatar creator text.
- Upload API beta test:
  - Created temporary beta parent account and child profile.
  - Uploaded PNG image successfully.
  - Returned `/storage/avatars/...webp`.
  - Dashboard API returned the same `student_photo_url`.
  - Non-image upload rejected with `400`.
  - Oversized upload over 5 MB rejected with `400`.

Notes:

- `next build` still prints an existing ESLint option warning about removed options `useEslintrc` and `extensions`, but the build exits successfully.
- A temporary beta test account was created for validation.

## 8. Remaining Risks

- The frontend uses a local preview before final submit; if upload fails after account creation, the account and child remain created and the UI offers retry or continue to dashboard with the default avatar.
- The crop is center-based. It does not currently do face detection.
- No Stripe, login scoring, lesson approval, or test scoring logic was modified for this task.

## Final Decision

READY_FOR_STUDENT_PHOTO_BETA
