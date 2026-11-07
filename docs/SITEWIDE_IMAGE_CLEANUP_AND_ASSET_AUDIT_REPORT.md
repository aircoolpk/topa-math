# Sitewide Image Cleanup and Asset Audit Report

## Scope

- Homepage
- Lessons list
- Lesson detail mascot helper
- Dashboard and quiz/test mascot helpers
- Ranking, mascot friend, CTA, login, register, and billing mascot usage
- Shared mascot registry and reusable mascot components

## Audit Method

- Scanned image usage across `apps/web/src`.
- Inspected all raster assets under `apps/web/public`.
- Checked PNG alpha channels, intrinsic dimensions, image paths, wrapper backgrounds, and `object-fit` usage.
- Verified production image sources and computed styles at `https://topamath.com/` and `https://topamath.com/lessons`.

## Issue Inventory

| Page / Section | Component / File | Previous Asset | Issue Type | Resolution |
| --- | --- | --- | --- | --- |
| Homepage header/footer logo | `apps/web/src/app/page.tsx` | `/brand/topa/topa-math-logo.png` | `[white_bg]` | Added and integrated `/brand/topa/topa-math-logo-transparent.png`. |
| Homepage hero | `apps/web/src/app/page.tsx` | `/brand/topa/mascot-hero-group.png` | `[blurry]` | Prevented rendering above the source width of 564px. |
| Homepage ranking rows | `apps/web/src/app/page.tsx` | Opaque mascot PNG files | `[white_bg] [wrong_asset]` | Switched to transparent feature or transparent sibling assets. |
| Homepage TOPA Ranking promo | `apps/web/src/app/page.tsx` | `/brand/topa/mascot-topa.png` | `[white_bg]` | Uses `/brand/topa/mascot-topa-transparent.png` in a transparent centered flex wrapper. |
| Homepage mascot friends | `apps/web/src/app/page.tsx` | Opaque mascot PNG files | `[white_bg] [misaligned]` | Switched to transparent assets and removed manual horizontal translations. |
| Homepage CTA mascot | `apps/web/src/app/page.tsx` | Opaque fallback | `[white_bg]` | Uses transparent source and transparent fallback. |
| Shared mascot registry | `apps/web/src/lib/mascot-registry.ts` | Opaque mascot PNG files | `[white_bg] [wrong_asset]` | Registry now points to transparent assets for every mascot. |
| Shared mascot avatars | `apps/web/src/components/topa/TopaUI.tsx` | White circular wrapper | `[white_bg] [cropped]` | Wrapper is transparent flex; image uses centered `object-fit: contain` without clipping. |
| Login/register/billing brand mascot | `apps/web/src/components/brand/TopaBrand.tsx` | `/brand/topa-mascot.png` | `[white_bg] [blurry]` | Switched to `/brand/topa/mascot-topa-feature.png`. |
| Lesson detail helper | `apps/web/src/app/dashboard/lessons/[lessonId]/page.tsx` | White circular clipping wrapper | `[white_bg] [cropped] [blurry]` | Uses transparent centered flex wrapper and avoids forced full-size stretching. |
| Homepage CMS content | `apps/api/app/content/site/homepage.json` | Opaque mascot PNG paths | `[white_bg] [wrong_asset]` | Updated active homepage image paths to transparent assets. |

## New Transparent Assets

- `/brand/topa/mascot-memo-transparent.png`
- `/brand/topa/mascot-splash-transparent.png`
- `/brand/topa/mascot-nova-transparent.png`
- `/brand/topa/mascot-orbit-transparent.png`
- `/brand/topa/mascot-timo-transparent.png`
- `/brand/topa/topa-math-logo-transparent.png`

All new transparent assets have an alpha channel and transparent corner pixels.

## Existing Transparent Assets Integrated

- `/brand/topa/mascot-topa-feature.png`
- `/brand/topa/mascot-pip-feature.png`
- `/brand/topa/mascot-riko-feature.png`
- `/brand/topa/mascot-olli-feature.png`
- `/brand/topa/mascot-topa-transparent.png`
- `/brand/topa/mascot-hero-group.png`

## Remaining Manual Asset Repair

The following source artwork files have content already cut off at the left edge or insufficient resolution. Background cleanup cannot reconstruct missing artwork:

| Asset Path | Remaining Issue | Affected Usage |
| --- | --- | --- |
| `/brand/topa/mascot-memo.png` | `[cut_off]` Left hand is partially outside the source canvas. | Dashboard, lesson detail, quiz/test helpers when Memo is selected. |
| `/brand/topa/mascot-nova.png` | `[cut_off]` Decorative text is cut off at the left edge. | Dashboard, lesson detail, quiz/test helpers when Nova is selected. |
| `/brand/topa/mascot-orbit.png` | `[cut_off]` Decorative text is cut off at the left edge. | Dashboard, lesson detail, quiz/test helpers when Orbit is selected. |
| `/brand/topa/mascot-timo.png` | `[cut_off] [wrong_asset]` Decorative text is cut off; the artwork is also labeled as BEARY in homepage content although it depicts a turtle. | Homepage mascot friends and shared mascot helpers. |
| `/brand/topa/mascot-hero-group.png` | `[blurry]` Source is only 564x272. | Homepage hero if a larger visual is required. Current CSS avoids upscaling. |

Recommended repair: provide new high-resolution transparent source artwork with complete canvas padding for these mascots.

## Validation

- `cd C:\web-app\4-craft.com\apps\web && npm run lint` passed.
- `cd C:\web-app\4-craft.com\apps\web && npm run build` passed.
- `docker compose --env-file .env.docker -f docker-compose.beta.yml build 4craft-web` passed.
- `docker compose --env-file .env.docker -f docker-compose.beta.yml up -d` passed.
- Production homepage QA confirmed transparent image sources, transparent image backgrounds, and `object-fit: contain`.
- Production lessons list QA confirmed the shared brand mascot uses a transparent 320x320 feature asset.
- Production dashboard redirected through the QA login but remained on the dashboard loading state, so data-dependent dashboard and lesson-detail visual QA could not be completed in the browser.

## Final Decision

READY_CODE_FIXES_DONE_NEEDS_ASSET_REPAIR
