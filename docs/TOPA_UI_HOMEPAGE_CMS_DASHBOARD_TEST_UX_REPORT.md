# TOPA UI, Homepage CMS, Dashboard, and Test UX Report

## 1. Files changed

- `apps/api/app/content/site/homepage.json`
- `apps/api/app/main.py`
- `apps/api/app/routers/admin.py`
- `apps/api/app/routers/site.py`
- `apps/api/app/services/homepage_content.py`
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/admin/homepage/page.tsx`
- `apps/web/src/app/admin/layout.tsx`
- `apps/web/src/app/dashboard/page.tsx`
- `apps/web/src/app/dashboard/lessons/[lessonId]/page.tsx`
- `apps/web/src/app/dashboard/tests/[sessionId]/page.tsx`
- `apps/web/src/app/children/[childId]/quiz/[sessionId]/page.tsx`
- `apps/web/src/components/topa/TopaUI.tsx`
- `apps/web/src/lib/api/admin.ts`
- `apps/web/src/lib/topa-content.ts`
- `docker-compose.beta.yml`

## 2. Homepage sections implemented

- Header navigation with TOPA Math logo, Thai menu items, login, and free-trial CTA.
- Premium playful hero with Thai-first headline/subheadline, CTA buttons, mascot group, floating Level/XP and score graph cards, and stat cards.
- Four feature cards: AI weakness analysis, varied practice, real progress, and national ranking.
- TOPA Ranking preview with grade tabs, country/province mode tabs, province selector, and table columns requested.
- Gifted school review section with editable review card content.
- Nine mascot friend cards: Topa, Oll, Memo, Splash, Nova, Pip, Orbit, Timo, Riko.
- Curriculum section for ป.1-ป.6 Thai and EP positioning.
- Parent trust cards including child safety, progress tracking, weak point planning, parent usability, and no ads.
- Bottom CTA banner and footer with contact/social fields.

## 3. Homepage CMS fields added

- JSON-backed homepage config at `apps/api/app/content/site/homepage.json`.
- Public read endpoint: `GET /site/homepage`.
- Admin endpoints:
  - `GET /admin/homepage`
  - `PATCH /admin/homepage`
  - `POST /admin/homepage/validate`
  - `POST /admin/homepage/backup`
  - `POST /admin/homepage/restore`
- Admin UI route: `/admin/homepage`.
- Editable config includes hero, feature cards, ranking preview, reviews, mascots, curriculum, parent trust, CTA banner, and footer.
- Save creates a timestamped backup in `apps/api/app/content/site/_backups`.
- Docker beta mounts `./apps/api/app/content/site:/app/app/content/site` so CMS edits persist to the requested JSON path.

## 4. Dashboard UX changes

- Dashboard redesigned in the same TOPA visual language: rounded white cards, soft sky/yellow accents, mascot helper panel, and clearer child progress summary.
- Keeps existing `/me/dashboard`, lesson start, lesson test start, and placement test start API calls.
- Adds welcome header, child grade/plan status, progress cards, weak skill panel, continue learning cards, quest cards, ranking preview, mascot advice, and parent summary.
- Graceful empty states appear when weak skills, lessons, or quests are not available.

## 5. Test mascot behavior

- Each question now receives a stable mascot coach based on question id/current index.
- Coach messages are non-answer-revealing, for example reading carefully, finding important numbers, checking before submit, and drawing a helper picture.
- The mascot card is shown before submission, and the same mascot is reused in feedback.
- Existing answer submission, finish, scoring, and result APIs were not changed.

## 6. Admin routes added/changed

- Added `/admin/homepage` to the admin sidebar as `หน้าแรก`.
- Sidebar now separates:
  - `/admin/content` and `/admin/qa` for content QA
  - `/admin/homepage` for homepage CMS
  - `/admin/lessons` for lesson CMS
  - `/admin/tests` for test CMS
- Admin homepage APIs use the existing `require_admin` dependency.
- Public users can only read `/site/homepage`; unauthenticated `/admin/homepage` returns 401.

## 7. Validation results

- `npm run lint` in `apps/web`: passed.
- `npm run build` in `apps/web`: passed.
- `python -m py_compile app/main.py app/routers/admin.py app/routers/site.py app/services/homepage_content.py`: passed.
- `docker compose -f docker-compose.beta.yml build 4craft-web 4craft-api`: passed.
- Recreated beta web/API with `docker compose --env-file .env.docker -f docker-compose.beta.yml up -d 4craft-api 4craft-web`: passed.
- Recreated API after adding the site-content mount: passed.
- Docker health:
  - `4craft-api`: healthy
  - `4craft-web`: healthy
  - `4craft-postgres`: healthy
  - `4craft-redis`: healthy
- `GET http://127.0.0.1:8001/health`: 200.
- `GET http://127.0.0.1:8001/site/homepage`: returns homepage config.
- `GET http://127.0.0.1:8001/admin/homepage` without token: 401.
- `GET http://127.0.0.1:3000`: 200.
- `GET http://127.0.0.1:3000/admin/homepage`: 200 shell load; browser-side auth guard still protects UI.
- `GET http://127.0.0.1:3000/dashboard`: 200 shell load; browser-side auth guard still protects dashboard.
- `GET http://127.0.0.1:3000/login`: 200.

## 8. Remaining limitations

- The attached reference image was not available in the workspace context, so the redesign follows the written visual direction and section requirements.
- Real ranking integration is still demo-data based on the homepage CMS config; the structure is ready for a future real ranking API.
- Mascot assets beyond `topa-mascot.png` are placeholders rendered as styled initials until images are provided.
- Full `python -m compileall app` still fails on pre-existing broken generator scripts under `app/content/math/question_banks`; changed API modules compile directly.
- Visual browser screenshot QA was not run through an in-app browser tool because no callable browser automation tool was available in this session.

## 9. Final decision

READY_FOR_UI_BETA_REVIEW
