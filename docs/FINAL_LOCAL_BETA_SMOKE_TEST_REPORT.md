# Final Local Beta Smoke Test Report

Date: 2026-05-14

Decision: `READY_FOR_CLOUDFLARE_TUNNEL_BETA`

## Scope

Test-only pass against the real local ports:

- Frontend: `http://localhost:3000`
- Backend: `http://127.0.0.1:8001`

No application logic, quiz/test scoring logic, Stripe code/config, or dependency audit state was changed.

## Backend Checks

Passed:

- `GET /health` returned `{"status":"ok"}`.
- Demo login succeeded with `demo@4-craft.com / demo1234`.
- Authenticated `GET /me/lessons` returned 22 beta-visible lessons.
- Returned lesson grades were only `1,2,3`.
- First visible lessons included `g1_add_within_20`, `g1_compare_numbers`, `g1_counting_numbers`.
- Direct Grade 4 lesson request `GET /me/lessons/g4_large_numbers` returned `404`.

## Frontend Route Checks

All required frontend routes returned HTTP 200:

- `/`
- `/register`
- `/login`
- `/dashboard`
- `/lessons`

No HTTP 500 responses were observed.

## Browser Flow

Browser automation note:

- The Codex in-app Browser backend was unavailable in this session, so a fresh temporary headless Chrome profile was used through Chrome DevTools Protocol as fallback.

Passed:

- `/`, `/register`, and `/login` loaded without Next.js Server Error overlay.
- Demo account browser session reached `/dashboard`.
- Dashboard displayed the demo account and lesson/test content.
- `/lessons` loaded successfully.
- `/lessons` displayed Grade 1-3 lesson cards.
- `/lessons` displayed Grade 4, Grade 5, and Grade 6 as `Coming Soon`.
- `/lessons` had 22 lesson links total.
- No Grade 4/5/6 lesson links were present.
- Direct browser navigation to `/dashboard/lessons/g4_large_numbers` showed the app gated/not-found lesson state, not an empty lesson page.

## Test Flow

Passed:

- `POST /me/lessons/g3_area_intro/test/start` created a Grade 3 lesson test session.
- The session returned 10 questions.
- `POST /me/tests/{session_id}/submit` accepted a sample answer.
- The submit response included:
  - `is_correct` as a Boolean
  - `correct_answer`
  - normalized selected/correct answer metadata

Conclusion:

- Correct answer checking still responds normally.
- No scoring regression was detected in this smoke pass.
- Quiz/test scoring logic was not modified.
- Backend answer checking logic was not modified.

## Runtime Checks

Passed:

- No HTTP 500 observed on required routes.
- No Next.js Server Error overlay observed.
- No `ChunkLoadError` or missing `.next` chunk error observed.
- No critical browser console errors captured.
- No runtime page exceptions captured.

Non-critical note:

- An earlier synthetic form-fill attempt did not attach to the login inputs, but the authenticated browser state was confirmed afterward by the dashboard rendering the demo account. API login with the same demo credentials also passed.

## Beta Content Gate Confirmation

Confirmed:

- Grade 1-3 lessons are visible.
- Grade 4-6 lesson links are not clickable/exposed.
- Grade 4-6 are Coming Soon or gated.
- Direct Grade 4 lesson access does not expose an empty lesson page.

## Security/Constraint Confirmation

Confirmed:

- No Stripe changes were made.
- Stripe live mode was not enabled.
- `npm audit fix --force` was not run.
- No app logic changes were made during this smoke test.

## Remaining Notes Before Tunnel

- Use the Cloudflare Tunnel plan in `docs/CLOUDFLARE_TUNNEL_BETA_PLAN.md`.
- Keep tester group small.
- Keep admin account private.
- Keep Stripe in test mode.
- Stop tunnel immediately if suspicious traffic appears.
