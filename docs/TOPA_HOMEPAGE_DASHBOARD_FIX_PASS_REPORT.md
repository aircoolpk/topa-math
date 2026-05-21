# TOPA Homepage/Dashboard Fix Pass Report

Date: 2026-05-21

## 1. Files Changed

- `apps/web/src/app/page.tsx`
- `apps/web/src/app/admin/homepage/page.tsx`
- `apps/web/src/app/api/revalidate/route.ts`
- `apps/web/src/app/dashboard/page.tsx`
- `apps/web/src/app/dashboard/lessons/[lessonId]/page.tsx`
- `apps/web/src/components/topa/TopaUI.tsx`
- `apps/web/src/components/avatar/AvatarUpload.tsx`
- `apps/web/src/lib/mascot-registry.ts`
- `apps/web/src/lib/topa-content.ts`
- `apps/web/src/lib/api/me.ts`
- `apps/api/app/content/site/homepage.json`
- `apps/api/app/routers/me.py`
- `apps/api/app/routers/site.py`
- `apps/api/app/services/homepage_content.py`

## 2. Homepage Fixes

- Reworked the homepage into a richer reference-style layout with a larger hero, mascot group, floating score/level cards, CTA buttons, and stat cards.
- Added a stronger feature-card band, polished ranking table, richer review section, full mascot section, curriculum cards, parent trust cards, CTA banner, and footer.
- Ranking now has grade tabs, country/province mode, province selector, 3 rows per view, believable Thai mock names/scores, and different rows per grade.
- Review section now shows up to 5 cards and uses robust fallback child portraits when CMS images are empty or broken.
- Homepage fetch uses `Cache-Control: no-store` and a timestamp query to avoid stale CMS content.

## 3. Mascot Usage

- Added a central mascot registry for the 9-character team:
  - Topa, Olli, Memo, Splash, Nova, Pip, Orbit, Timo, Riko
- `MascotAvatar` now resolves old aliases such as `oll` to `Olli`.
- Missing mascot image paths no longer produce empty/broken image boxes. They render a stylized mascot fallback visual with each mascot's color/personality.
- Homepage, dashboard helper, test helper, and lesson helper all use the same mascot registry/default data.
- Lesson helper now selects a stable random mascot per lesson and uses topic-aware coaching lines when possible.

## 4. Homepage CMS Fixes

- Fixed admin quick-edit save behavior: quick fields now sync into the raw JSON that is saved.
- `PATCH /admin/homepage` still validates and backs up before overwrite.
- Added image-reference validation for homepage CMS fields to reject path traversal and unsafe paths.
- Added `POST /api/revalidate` on the web app and call it after admin save.
- `GET /site/homepage` now returns `Cache-Control: no-store`.
- Verified CMS save updates the public homepage API immediately, creates a backup, and can restore original content.

## 5. Dashboard Fixes

- Restored real child stats into `/me/dashboard.child`, including level, XP, total score, streak, rank title, coins, membership, and free test attempts.
- Dashboard keeps the new visual style while showing uploaded student photo through `PhotoAvatar`.
- Restored profile photo upload/change control on the dashboard.
- Restored affiliate/share entry via `/dashboard/referral`.
- Ranking card now links to the homepage ranking section.
- Dashboard lesson list now prioritizes the student's current grade.
- Added a separate previous-grade review section.
- Weak-skill cards now use real mastery data when available and fall back to a safe 3-skill diagnostic heuristic when there is not enough performance data.

## 6. Lesson/Test UX Fixes

- Lesson cards disable the test button when `has_test === false` and show a clear message.
- Lessons with approved tests keep the working `startLessonTest` flow.
- `/me/lessons` now returns current-grade lessons as primary content and previous-grade review lessons separately.
- Lesson helper uses a stable mascot from the 9-character team and a coaching line that does not reveal answers.
- Test question helper benefits from the same mascot fallback registry, so mascot visuals render instead of empty slots.

## 7. Validation Results

Passed:

- `python -m py_compile app\routers\me.py app\routers\site.py app\services\homepage_content.py`
- `npm run lint`
- `npm run build`
- `docker compose --env-file .env.docker -f docker-compose.beta.yml build 4craft-web 4craft-api`
- `docker compose --env-file .env.docker -f docker-compose.beta.yml up -d 4craft-api 4craft-web`
- Docker health:
  - `4craft-api` healthy
  - `4craft-web` healthy
- `GET http://127.0.0.1:8001/health` -> `ok`
- `GET http://127.0.0.1:3000/` -> `200`
- `GET /site/homepage` returned:
  - 9 mascots
  - 5 reviews
  - 18 ranking rows
- Browser homepage smoke:
  - hero, ranking, reviews, mascots, and CTAs present
  - no critical console errors
  - 36 rendered images checked, 0 broken images
- Dashboard API smoke with a temporary grade 3 student:
  - current lessons: 8
  - previous-grade review lessons: 6
  - weak-skill/diagnostic cards: 3
  - first current-grade lesson grade: 3
  - first review lesson grade: 2
  - first lesson has approved test: true
- CMS smoke with a temporary local admin:
  - admin homepage loaded
  - save changed public `/site/homepage` immediately
  - backup was created
  - original homepage config restored

Notes:

- Local Docker web is built with `NEXT_PUBLIC_API_BASE_URL=https://api.topamath.com` from `.env.docker`, so browser dashboard smoke against the local API was validated through direct API calls instead of the local web browser session.
- `next build` still prints the existing ESLint invalid-options warning, but exits successfully.
- No Stripe live mode, scoring logic, or approved-content gating bypass was changed.

## 8. Remaining Limitations

- The current repository only includes one real mascot bitmap (`/brand/topa-mascot.png`). The other mascots now have reliable stylized fallback visuals rather than broken slots. Dropping final mascot art into CMS/image paths will replace the fallbacks without code changes.
- Homepage ranking remains polished mock data by design; the structure now supports progressive replacement by real ranking rows.
- Weak-skill logic is intentionally heuristic when no test history exists. It becomes performance-driven once mastery data is available.

## Final Decision

READY_FOR_HOMEPAGE_FIX_REVIEW
