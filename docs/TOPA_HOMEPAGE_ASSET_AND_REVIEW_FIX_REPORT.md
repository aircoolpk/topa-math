# TOPA Homepage Asset And Review Fix Report

Date: 2026-05-21

## 1. Files Changed

- `apps/web/src/app/page.tsx`
- `apps/web/src/lib/mascot-registry.ts`
- `apps/web/src/lib/topa-content.ts`
- `apps/api/app/content/site/homepage.json`
- Added static assets under `apps/web/public/brand/topa/`

## 2. Assets Added

Created production/Docker-safe public assets from the provided references:

- `topa-math-logo.png`
- `mascot-hero-group.png`
- `mascot-topa.png`
- `mascot-olli.png`
- `mascot-memo.png`
- `mascot-splash.png`
- `mascot-nova.png`
- `mascot-pip.png`
- `mascot-orbit.png`
- `mascot-timo.png`
- `mascot-riko.png`

These are served from `/brand/topa/...`.

## 3. Logo Fix

- Replaced the homepage navbar brand rendering with the provided TOPA Math logo style.
- Footer now uses the same logo asset.
- Verified Docker static serving:
  - `/brand/topa/topa-math-logo.png` -> `200`

## 4. Mascot Fix

- Updated the mascot registry so all 9 mascots point to real extracted mascot assets.
- Homepage hero now composes a richer mascot group using Pip, Olli, Topa, and Memo.
- Feature cards now include mascot illustrations instead of icon-only placeholder cards.
- `เพื่อนช่วยเรียนของ TOPA` uses all 9 mascot assets.
- Existing fallback handling remains in place so broken CMS image paths do not create blank UI.
- Verified Docker static serving:
  - `/brand/topa/mascot-olli.png` -> `200`

## 5. Review Fix

- Updated CMS homepage content title to exactly:
  - `รีวิวจากรุ่นพี่`
- Homepage review heading uses the CMS title, so it remains editable.
- Review cards continue to show image, name, quote, and optional school/program claim.
- If CMS review images are missing, the robust Thai child portrait fallback still renders instead of an empty/broken image.

## 6. CMS Live Update

- Verified `/admin/homepage` save writes to the real homepage content source.
- Verified public `/site/homepage` reflects saved review title changes immediately.
- Verified backup creation before overwrite.
- Verified restore to original content.
- Docker content persistence remains through the existing mounted `apps/api/app/content/site` volume.

## 7. Validation Results

Passed:

- `npm run lint`
- `npm run build`
- `python -m py_compile app\routers\site.py app\services\homepage_content.py`
- `docker compose --env-file .env.docker -f docker-compose.beta.yml build 4craft-web 4craft-api`
- `docker compose --env-file .env.docker -f docker-compose.beta.yml up -d 4craft-api 4craft-web`
- Docker health:
  - `4craft-api` healthy
  - `4craft-web` healthy
- Static asset checks:
  - logo `200`
  - Olli mascot `200`
- Browser homepage smoke:
  - logo asset present
  - Topa mascot asset present
  - Olli mascot asset present
  - all 9 mascot names present
  - review title exactly `รีวิวจากรุ่นพี่`
  - no old gifted-room review heading
  - 43 images checked, 0 broken
  - 0 critical console errors
- CMS smoke:
  - save updated public homepage
  - backup created
  - content restored

Notes:

- `next build` still prints the existing ESLint invalid-options warning, but the command exits successfully.
- No auth, dashboard data, lesson/test scoring, or Stripe live-mode logic was changed.

## Final Decision

READY_FOR_HOMEPAGE_ASSET_REVIEW
