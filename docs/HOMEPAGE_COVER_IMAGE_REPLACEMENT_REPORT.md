# Homepage Cover Image Replacement Report

## New Image Asset

- Source image: `C:\Users\airco\OneDrive\Pictures\Screenshots\Screenshot 2026-06-03 211034.png`
- Application asset: `/brand/topa/homepage-hero-cover-20260603.png`
- Filesystem path: `apps/web/public/brand/topa/homepage-hero-cover-20260603.png`
- Intrinsic dimensions: `751x513`

## Files Changed

- `apps/web/src/app/page.tsx`
- `apps/web/src/lib/topa-content.ts`
- `apps/api/app/content/site/homepage.json`
- `apps/web/public/brand/topa/homepage-hero-cover-20260603.png`

## Implementation

- Replaced the previous homepage hero image with the latest uploaded image.
- Updated the homepage default hero image, runtime fallback, shared fallback content, and active CMS content reference.
- Preserved the rest of the hero section content and layout.
- The hero image wrapper now centers the image.
- The image uses `object-fit: contain`, preserves aspect ratio, and is limited to its intrinsic maximum width and the existing desktop hero height.

## Validation

- `cd C:\web-app\4-craft.com\apps\web && npm run lint` passed.
- `cd C:\web-app\4-craft.com\apps\web && npm run build` passed.
- `docker compose --env-file .env.docker -f docker-compose.beta.yml build 4craft-web` passed.
- `docker compose --env-file .env.docker -f docker-compose.beta.yml up -d` passed.
- Desktop production QA at `https://topamath.com/` confirmed:
  - The rendered source is `/brand/topa/homepage-hero-cover-20260603.png`.
  - The source loads at its full intrinsic resolution of `751x513`.
  - The image uses `object-fit: contain` and centered positioning.
  - The wrapper uses flex centering.
  - No character heads, important edges, or the embedded stat card are cropped.
- Mobile responsive QA confirmed from the active responsive classes:
  - The image remains `w-full`, `h-auto`, and `object-contain`.
  - The wrapper keeps a centered `min-h-[340px]` layout below the desktop breakpoint.
  - Aspect ratio is preserved without forced stretching.
- The source image includes its own white background; no additional white background artifact was added by the implementation.
- In-app browser screenshot capture timed out, but DOM, source-path, computed-style, and responsive-class validation completed successfully.

## Final Decision

READY_HOMEPAGE_COVER_REPLACED
