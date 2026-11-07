# Logo Replacement Sitewide Report

## New Logo Asset

- Source image from this conversation:
  - `C:\Users\airco\OneDrive\Pictures\Screenshots\Screenshot 2026-06-03 160917.png`
- New application asset:
  - `/brand/topa/topa-math-logo-new.png`
  - Filesystem path: `apps/web/public/brand/topa/topa-math-logo-new.png`

The new asset preserves the uploaded TOPA MATH artwork and uses a transparent outer background so it works consistently on light and dark sections.

## Files Changed

- `apps/web/src/components/brand/TopaBrand.tsx`
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/login/page.tsx`
- `apps/web/src/app/register/page.tsx`
- `apps/web/src/app/billing/success/page.tsx`
- `apps/web/src/app/dashboard/page.tsx`
- `apps/web/src/app/admin/layout.tsx`
- `apps/web/public/brand/topa/topa-math-logo-new.png`

## Integration Changes

- Added shared `TopaLogo` component as the single active logo renderer.
- Updated `TopaBrandMark` to render the new logo instead of mascot plus text.
- Updated homepage navbar and footer to use the shared logo.
- Updated login, register, billing success, dashboard, and admin branding.
- Existing lessons, pricing, billing header, and child pages inherit the new logo through `TopaBrandMark`.
- Logo sizing uses fixed heights with automatic width to preserve aspect ratio.
- The largest rendering size is limited to the uploaded asset's natural height to avoid blurry upscaling.

## Old Logo Reference Audit

No active `apps/web/src` or active `apps/api/app/content/site/homepage.json` references remain for:

- `/brand/topa/topa-math-logo.png`
- `/brand/topa/topa-math-logo-transparent.png`
- `/brand/topa-mascot.png`

Historical backup JSON files under `apps/api/app/content/site/_backups/` still contain legacy mascot paths. They are inactive backups and were not modified.

## Verification

- `cd C:\web-app\4-craft.com\apps\web && npm run lint` passed.
- `cd C:\web-app\4-craft.com\apps\web && npm run build` passed.
- `docker compose --env-file .env.docker -f docker-compose.beta.yml build 4craft-web` passed.
- `docker compose --env-file .env.docker -f docker-compose.beta.yml up -d` passed.
- Browser QA at `https://topamath.com/` confirmed:
  - Homepage header uses `/brand/topa/topa-math-logo-new.png`.
  - Homepage footer uses `/brand/topa/topa-math-logo-new.png`.
  - Both use `object-fit: contain`, preserve aspect ratio, and render below the source asset's natural dimensions.
- Browser QA confirmed login, register, and pricing use the new logo path.
- Lessons, dashboard, and admin remained in data-loading states during browser QA. Their logo integration is provided by the verified shared `TopaLogo` / `TopaBrandMark` components and passed the production build.
- QA screenshots:
  - `docs/logo_replacement_homepage_header_qa.png`
  - `docs/logo_replacement_homepage_footer_qa.png`

## Final Decision

READY_LOGO_REPLACED_SITEWIDE
