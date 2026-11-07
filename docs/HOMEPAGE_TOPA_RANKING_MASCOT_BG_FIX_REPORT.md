# Homepage TOPA Ranking Mascot Background Fix Report

## Scope

- Homepage only
- TOPA Ranking left-side promo card
- No dashboard, lessons, tests, auth, Stripe, or admin changes

## Root Cause

The promo card used `/brand/topa/mascot-topa.png`. The file is a fully opaque PNG and contains a light rectangular background, so the image did not blend into the card.

## Fix

- Replaced the promo card image source with `/brand/topa/mascot-topa-transparent.png`.
- Added a transparent flex wrapper that centers the mascot.
- Kept the image fully visible with `object-fit: contain` behavior.
- Set the fallback to `/brand/topa/mascot-topa-feature.png`, which also has a transparent background.
- Preserved the existing card text, dimensions, gap, and surrounding homepage layout.

## Validation

- `cd C:\web-app\4-craft.com\apps\web && npm run lint` passed.
- `cd C:\web-app\4-craft.com\apps\web && npm run build` passed.
- `docker compose --env-file .env.docker -f docker-compose.beta.yml build 4craft-web` passed.
- `docker compose --env-file .env.docker -f docker-compose.beta.yml up -d` passed.
- Browser QA at `https://topamath.com/` confirmed:
  - The rendered image source is `/brand/topa/mascot-topa-transparent.png`.
  - The image and wrapper backgrounds are transparent.
  - The wrapper uses `display: flex`, `align-items: center`, and `justify-content: center`.
  - The image uses `object-fit: contain`.
  - The rendered image fits inside the 144 x 144 pixel wrapper and is not cropped.
  - The surrounding homepage layout and promo card text remain unchanged.

The in-app browser screenshot capture timed out, but DOM inspection and computed-style validation completed successfully.

## Final Decision

READY_TOPA_RANKING_MASCOT_BG_FIXED
