# PostgreSQL Runtime Recovery and Payment Integration Audit

Date: 2026-10-15 (Asia/Bangkok)
Project: C:\web-app\4-craft.com

## Database Root Cause and Resolution

The PostgreSQL authentication failure in the 2026-06-17 dashboard report is a
historical observation, not a currently reproducible failure. Existing containers
were created on 2026-08-15 and are now healthy. This investigation did not rotate
credentials or claim to have repaired a password that was already accepted.

Current evidence:

- Database: adaptive_learning, role: postgres.
- Original mounted volume: 4craft-beta_4craft-postgres-data at
  /var/lib/postgresql/data. It was neither removed nor replaced.
- Running API DATABASE_URL password matches PostgreSQL container POSTGRES_PASSWORD.
- Current .env.docker POSTGRES_PASSWORD and DATABASE_URL password match runtime.
- Authenticated TCP queries succeed using all three credential sources, and a
  SELECT from inside the running API succeeds against the same PostgreSQL database.
- A deliberately invalid password is rejected with a PostgreSQL authentication
  error, confirming that successful remote connections were not a trust-auth bypass.
- pg_hba uses trust for local/loopback connections, but scram-sha-256 for other
  hosts. The remote TCP/API-container checks are the relevant password evidence.
- Users: 109; child profiles: 87, unchanged before/after validation.
- PostgreSQL/API/Web health: healthy. Local and public API /health return 200.

Resolution: verify and retain the currently aligned credentials and original data
volume. No ALTER ROLE, volume reset, database creation, schema reset or credential
rewrite was needed. The available evidence cannot establish which earlier action
aligned the credentials between June and the current August-created deployment.

apps/api/.env is a separate local configuration using SQLite; it was not used as
a replacement database. All reported live API tests used the original PostgreSQL
deployment. Docker initialization env variables alone do not change a password
inside an existing PostgreSQL volume; the authenticated checks above verify the
actual database credential acceptance.

## Runtime Environment and Change Boundary

The running 4craft-api has ENVIRONMENT=production. The running Docker frontend
uses https://api.topamath.com. No production service rebuild/redeploy, database
credential change, CORS change, gateway mutation or subscription change was made.

Testing used an existing QA admin account with an existing child profile and its
already-valid credential. No new account/profile was created, no password reset
was performed, and no member/subscription records were deleted. Normal login and
affiliate-summary application side effects occurred for the QA account (login
metadata/referral token initialization); these were not entitlement grants.

The only process repair was restarting the previously-created local Node preview
on port 3002 to clear stale Next.js asset references after earlier local builds.
The first preview attempt had failed static chunk loads. After the restart its
assets loaded and its real API failure could be diagnosed as CORS.

## Actual Runtime Test Results

No mocked API responses or substituted databases were used for these results.

| Test | Actual result |
| --- | --- |
| Local API POST /auth/login | 200 |
| Public API POST /auth/login | 200 |
| Authenticated /auth/me | 200 |
| Authenticated /children | 200, existing child returned |
| /me/dashboard?program_type=TH | 200, observed 138-533 ms locally |
| /me/dashboard?program_type=EP | 200, observed 125-225 ms locally |
| Public /me/dashboard?program_type=TH | 200, observed 294 ms |
| /me/affiliate | 200, observed 11-15 ms locally; 86 ms publicly |
| /billing/status | 200 |
| Invalid token on protected endpoints | 401 as expected |
| Genuinely signed expired token | /auth/me, /children, /me/dashboard, /me/affiliate return 401 |
| Expired-token browser visit | Redirected to /login after /auth/me 401 |
| Browser form login on https://topamath.com | PASS, actual /auth/login and /auth/me 200 |
| Direct /dashboard after browser login | /me/dashboard 200; loading finished, about 1.9 s including observation delay |
| Hard refresh after browser login | /me/dashboard 200; loading finished, about 1.7 s including observation delay |
| Browser Affiliate Summary | 200 |
| Protected fetches remaining pending at final observation | 0 |
| Unauthorized /children requests after valid browser login | 0 |
| Public browser JavaScript/page errors | 0 |
| Public browser console errors | 0 |
| localhost:3002 browser form login | FAIL due to real CORS rejection |

An additional dashboard session test obtained a token from a real HTTP login,
then loaded the public dashboard with that token and refreshed it. Both dashboard
responses were 200, with no loading error or pending fetch. This supplementary
test did not replace the successful real browser form-login test above.

Cloudflare /cdn-cgi/rum telemetry requests were aborted during navigation; those
were not dashboard/auth API failures. The browser's real login regression script
initially had an incorrect URL-wait predicate, which prematurely marked login
failed. That automation error was fixed and the successful form-login results
above were re-observed; an early pending snapshot was not treated as infinite loading.

Backend log inspection confirms login/dashboard/affiliate 200 responses and
auth_unauthorized cause=invalid_token for deliberately invalid/expired test tokens.
No current database authentication failure occurred on successful API requests.
The intentionally wrong-password database negative controls can produce expected
PostgreSQL FATAL authentication log entries; do not confuse them with a new outage.

These results cover the existing QA account and normal/refresh/expired-token
cases. Slow-network and forced affiliate-delivery-failure scenarios were not
introduced into the production runtime during this investigation.

## Local Preview / Staging Browser Blocker

localhost:3002's current bundle sends login to https://api-beta.topamath.com.
Its preflight for Origin http://localhost:3002 returns 400 without an allowed
origin, and Chromium reports CORS policy plus net::ERR_FAILED. The UI displays
the connection error and ends loading; no fetch remains pending.

Production API also rejects that localhost origin: preflight 400. It permits
https://topamath.com and https://www.topamath.com, and the public form-login test
passed from the permitted origin.

api-beta.topamath.com/openapi.json returned 404 HTML, so its API contract could
not be inspected there. Do not infer that a 200 /health response establishes
staging API route/contract readiness. Configure and verify the staging origin and
API route deliberately, without adding localhost to production policy just to
make a preview pass.

## Stripe Redirect Root Cause

The deployed frontend/API are still the August-created images, while the local
workspace has October MPP changes. Runtime and workspace currently differ.

Deployed facts:

- Docker Web static bundles contain /billing/create-checkout-session and do not
  contain /billing/mpp/checkout. Their API host is api.topamath.com.
- Public API OpenAPI exposes /billing/create-checkout-session, but not
  /billing/mpp/checkout or /admin/payment-integration-test.
- Inspecting the running billing.create_checkout_session function confirms an
  active Stripe checkout.Session.create call and no MPP readiness guard.
- Running API contains no MPP_PROJECT_API_KEY or MPP_WEBHOOK_SIGNING_SECRET env
  entries. Stripe remains the configured legacy provider.

| File / function | Deployed behavior / workspace state |
| --- | --- |
| apps/web/src/app/pricing/page.tsx / handleSubscribe | Deployed button uses legacy checkout API; workspace calls createMppCheckout |
| apps/web/src/app/billing/page.tsx / handleSubscribe | Same deployed legacy call; workspace calls createMppCheckout |
| apps/web/src/lib/api/billing.ts / createCheckoutSession | Deployed POST /billing/create-checkout-session; workspace alias delegates to createMppCheckout |
| apps/api/app/routers/billing.py / create_checkout_session | Deployed Stripe customer + subscription checkout session, returning checkout_url |
| billing.py / _stripe_checkout_ready, _require_stripe | Read Stripe key/price settings; no runtime MPP provider dispatch |
| billing.py / _legacy_stripe_checkout_session | Workspace-retained Stripe implementation, detached from workspace checkout routes |
| services/mpp_checkout.py / require_checkout_ready | Workspace blocks unverified MPP checkout with 503; absent from active checkout handler |
| billing.py / stripe_webhook, _apply_subscription_state, _apply_paid_plan | Existing Stripe lifecycle activates or clears Plus fields |
| services/payment_integration.py and routers/payment_integration.py | Workspace admin UAT only; no purchase entitlement pipeline |

The active code path can obtain a checkout.stripe.com URL from Stripe's session
response and the deployed frontend navigates to checkout_url. This was verified
by deployed handler/bundle inspection, not by creating a production checkout.
No checkout/payment/withdrawal creation endpoint was invoked in this audit.

There is no PAYMENT_PROVIDER configuration dispatcher in the inspected workspace
configuration/handlers. Four MPP connection settings do not automatically select
the gateway. Current workspace routing explicitly targets an MPP blocked boundary;
the running deployed route explicitly follows the legacy Stripe path.

## MPP Integration Status and Blockers

Re-inspected https://staging-api.mmerchat.cc/openapi.json on 2026-10-15:
POST /api/v1/payments has PaymentCreate / PaymentCreateResponse schemas, integer
amount, X-API-Key and Idempotency-Key. Its response has payment_session_url/token.
GET /api/v1/pay/{token} provides a payment session/status response.

Missing/unfinished:

- Actual staging MPP project API key and signing secret: absent/empty in local
  runtime configuration and absent in the deployed API environment.
- Outbound webhook signing header/formula/input, timestamps, real event envelope
  and authoritative success-state mapping: still unverified by public OpenAPI.
- Previous UAT HMAC/header/payload assumptions must not grant actual Plus rights.
- MPP purchase order persistence, idempotent entitlement grant, authenticated user
  ownership, amount/currency/order/payment validation and failure/expiry/retry
  lifecycle remain dependent work; the workspace guard deliberately returns 503.
- Staging frontend/API deployment/origin configuration needs validation.
- No MPP staging end-to-end payment UAT has passed. No real transfer or withdrawal
  was performed. This audit does not certify payment production readiness.

## Renewal Impact Before Implementation

No recurring endpoint was found in the public MPP schema; recurring support has
not been confirmed. Plan a one-time monthly payment with 30-day access and manual
renewal unless official contract evidence establishes otherwise.

Before changing renewal:

1. Define the canonical entitlement start/end and per-provider ownership while
   preserving existing Stripe customer/subscription IDs and active members.
2. Add expiry enforcement for MPP memberships. Current foundation.is_paid checks
   membership_status only; a nominal 30-day timestamp would otherwise be insufficient.
3. Make each confirmed payment grant or extension occur exactly once, with event
   and order/grant idempotency and transactional locking.
4. Define coexistence with legacy Stripe subscription update/deletion events so
   a legacy event cannot accidentally remove or duplicate new MPP access.
5. Resolve monthly/founder/yearly product-duration rules explicitly; do not
   reinterpret existing annual prices as 30-day access.

No renewal behavior or entitlement code was changed in this audit.

## Next Steps to Change Checkout to MPP

1. Make the intended staging TOPA API and frontend origin reachable with correct
   staging CORS, and verify routes using the staging deployment's actual contract.
2. Configure MPP_API_BASE_URL, MPP_PAYMENT_BASE_URL, MPP_PROJECT_API_KEY and
   MPP_WEBHOOK_SIGNING_SECRET server-side with staging credentials only.
3. Obtain official signed webhook examples and signing/success-state specification.
4. Implement the persistent purchase/entitlement lifecycle and renewal safeguards
   listed above against the verified contract; retain legacy subscriber handling.
5. Deploy to staging, validate login/dashboard plus payment confirmations,
   duplicates, mismatches, failures, expiry/retry and existing member preservation.
6. Resolve the known regression failures documented in the earlier checkout report
   and obtain green staging E2E UAT before any production gateway deployment.

## Files / Actions This Round

- Added this report.
- Appended current runtime evidence to DASHBOARD_AUTH_AND_LOADING_FIX_REPORT.md.
- Added ignored diagnostic/Playwright scripts and sanitized result logs under
  .tools/. Secrets/cookies/tokens were held in memory and not included in reports.
- Restarted only the agent-owned local preview process on port 3002.
- No Compose/env/backend/frontend gateway code changes or production deployments.
- No files in D:\MerchantPaymentPlatform or D:\PaymentSystem were modified.

Database and public dashboard runtime: VERIFIED for the tested account/cases.
Local preview login: BLOCKED by staging CORS.
MPP purchase integration / staging UAT / production migration: BLOCKED.
