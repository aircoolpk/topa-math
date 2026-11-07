# TOPA Homepage Reference Match Redesign Report

## Files changed
- `apps/web/src/app/page.tsx`
- `apps/api/app/content/site/homepage.json`

## Sections implemented
- Top navigation with TOPA Math logo, menu items, login button, and yellow free-trial button.
- Hero section with the requested Thai headline, supporting copy, two CTA buttons, large mascot group image, floating stat cards, level card, and score mini card.
- Four feature cards under the hero: AI วิเคราะห์จุดอ่อน, แบบฝึกหลากหลาย, เควส XP + Level, and Ranking ทั่วประเทศ.
- TOPA Ranking section with one explanation/trophy card and two side-by-side ranking tables: อันดับรายจังหวัด and อันดับรายเขต.
- Real reviews section using the exact heading `รีวิวจากเด็กที่ใช้งานจริง`, four Thai child review cards, stars, names, grades, and provinces.
- TOPA Friends section with TOPA, BUNNY, PANDA, OWLY, and BEARY cards.
- Curriculum section for ป.1-ป.6, with ป.1-ป.3 active and ป.4-ป.6 locked/coming soon.
- Parent Trust section with safety, progress tracking, and no-ads cards.
- Bottom blue CTA banner with the requested copy and yellow CTA.
- Dark blue footer with logo, four content columns, contact text, and social icon placeholders.

## Assets used
- `/brand/topa/topa-math-logo.png`
- `/brand/topa/mascot-hero-group.png`
- `/brand/topa/mascot-topa.png`
- `/brand/topa/mascot-pip.png`
- `/brand/topa/mascot-riko.png`
- `/brand/topa/mascot-olli.png`
- `/brand/topa/mascot-splash.png`
- `/brand/topa/mascot-timo.png`

Safe image fallbacks are included in the homepage component so missing or failed mascot assets fall back to `/brand/topa/mascot-topa.png`.

## CMS compatibility
- The homepage still calls `/site/homepage` and accepts safe hero text/link/image overrides.
- The default `homepage.json` was refreshed to valid UTF-8 Thai content with the required top-level sections used by `/site/homepage` and `/admin/homepage`.
- The visual layout is intentionally driven by the new reference-matched component so stale or garbled CMS content cannot break the beta homepage presentation.
- Footer contact text uses `support [at] topamath.co.th` to avoid Cloudflare email-protection DOM rewrites that caused React hydration errors.

## Browser validation
- `https://topamath.com/` loads.
- Required homepage text/sections were present in the rendered page.
- Image validation found `24` images and `0` broken images.
- Login CTA points to `/login`.
- Free trial CTAs point to `/register`.
- Fresh browser console pass after redeploy showed `0` new console errors.
- Local route smoke checks returned `200` for `/dashboard`, `/lessons`, `/admin`, and `/admin/homepage`.

## Build validation
- `cd apps/web && npm run lint`: passed.
- `cd apps/web && npm run build`: passed.
- `docker compose --env-file .env.docker -f docker-compose.beta.yml build 4craft-web`: passed.
- `docker compose --env-file .env.docker -f docker-compose.beta.yml up -d`: passed.
- `4craft-web`: healthy.
- `4craft-api`: healthy at `http://localhost:8001/health`.

Note: Next build still prints the existing ESLint option warning: `Unknown options: useEslintrc, extensions`. It does not fail the build.

## Remaining visual differences from reference
- Friend card animal names are mapped to the closest available TOPA mascot assets because the repository does not contain files literally named bunny, panda, owl, or bear.
- Review cards use safe styled child-avatar initials rather than real child photos because no approved local child profile photos were available.
- The reference hero artwork includes a very specific composed mascot arrangement; this implementation uses the closest available local group image and matching overlays.

## Final decision
READY_HOMEPAGE_REFERENCE_MATCH
