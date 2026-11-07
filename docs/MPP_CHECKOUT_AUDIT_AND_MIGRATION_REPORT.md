# TOPAMath Checkout Audit and MPP Migration

Date: 2026-10-15 (Asia/Bangkok)

## Phase 1 Audit Before Changes

Root cause: the MPP module was intentionally limited to admin UAT. The normal
purchase entry points still call the Stripe subscription checkout endpoint.

| Surface | File / function | Observed behavior |
| --- | --- | --- |
| Pricing button | apps/web/src/app/pricing/page.tsx / handleSubscribe | Calls billingApi.createCheckoutSession and navigates to checkout_url |
| Billing button | apps/web/src/app/billing/page.tsx / handleSubscribe | Same checkout call and redirect |
| Client API | apps/web/src/lib/api/billing.ts / createCheckoutSession | POST /billing/create-checkout-session |
| Backend checkout | apps/api/app/routers/billing.py / create_checkout_session | Stripe Customer.create and checkout.Session.create(mode=subscription) |
| Missing Stripe config | billing.py / _manual_pending_checkout | Mutates existing child subscription fields and returns manual_pending |
| Legacy Plus activation | billing.py / stripe_webhook, _apply_subscription_state, _apply_paid_plan | Stripe subscription/checkout/invoice events grant existing Plus fields |
| Access checks | apps/api/app/services/foundation.py / is_paid, is_th_plus, is_ep_plus | Existing member fields determine access |
| MPP UAT | routers/payment_integration.py and services/payment_integration.py | Admin test transactions only; no Plus entitlement activation |

Runtime configuration audit of ignored `.env.docker` and `apps/api/.env`:
Stripe key/secret are set; all four MPP env entries are missing. Secret values
were not printed. MPP placeholders and Docker pass-through exist in tracked
examples, but placeholders are not runtime credentials.

Re-read staging OpenAPI on 2026-10-15:
https://staging-api.mmerchat.cc/openapi.json

Confirmed POST /api/v1/payments uses X-API-Key and Idempotency-Key. PaymentCreate
uses integer amount and merchant_order_id. PaymentCreateResponse includes
payment_id, merchant_order_id, amount, currency, status, expires_at,
payment_session_token and payment_session_url. GET /api/v1/pay/{token} returns
PaymentSessionOut with matching identity/amount fields. No recurring billing
endpoint was found; this is not evidence of auto-renewal support.

OpenAPI still provides no outbound signing formula/header, webhook payload
envelope or enum of successful payment statuses. The prior UAT report explicitly
labels HMAC/header/envelope as unverified assumptions. These must not activate
real membership.

## Implementation Boundary

Implement the verified routing/policy changes now: disconnect new checkout from
Stripe and manual fallback, preserve legacy Stripe handlers/data, require
server-only staging configuration, and show an actionable blocked state.

Do not create a payment or grant Plus while credentials and confirmation
contract are missing. Actual MPP create/reconciliation/30-day entitlement logic
remains blocked rather than being implemented against invented webhook/status
semantics. Production deployment is prohibited until staging UAT passes.

## Changes Delivered

- PricingPage.handleSubscribe and BillingPage.handleSubscribe now call
  billingApi.createMppCheckout, POST `/billing/mpp/checkout`.
- The old POST `/billing/create-checkout-session` is a compatibility alias to the
  same blocked MPP boundary. It cannot call Stripe or the manual pending fallback.
- Retained Stripe creation code in `_legacy_stripe_checkout_session`, without an
  HTTP purchase entry point. Existing Stripe webhook, portal, invoices, referral
  and commission handlers remain in place for existing subscriptions.
- New checkout returns HTTP 503 with `MPP_CHECKOUT_BLOCKED`, explicit blockers,
  and no checkout URL. It is blocked even when key/secret are populated because
  signing/success-state semantics and entitlement implementation are unverified.
  There is no environment flag that bypasses that confirmation boundary.
- Frontend redirect checks provider identity and the exact staging payment origin.
  Unexpected Stripe/production URLs are rejected. Full checkout response logging
  was removed so session URLs/tokens will not be logged by these handlers.
- Errors remain visible after loading completes. Blocked retry is allowed and
  does not create records or change membership. No manual pending success is shown.
- Added the four MPP entries to ignored `.env.docker` and `apps/api/.env` with the
  staging hosts and EMPTY credentials. No credentials were invented or copied
  into browser/public environment variables.
- Tests disable real SMTP transport so regression tests do not use the configured
  local mail account. Notification behavior is tested with existing mock senders.

## Old Flow Versus Delivered Flow

Old: Select Plus -> POST /billing/create-checkout-session -> Stripe customer and
recurring subscription session (or manual pending mutation) -> checkout.stripe.com
-> Stripe webhook -> existing Plus fields.

Delivered now: Select Plus -> POST /billing/mpp/checkout -> authenticated plan /
founder checks -> HTTP 503 MPP_CHECKOUT_BLOCKED -> visible retryable error.
Neither Stripe nor MPP is called, and no membership/order mutation occurs.

Required future flow after blockers are resolved: Select Plus -> persistent order
bound to authenticated user/profile and server catalog amount -> MPP POST /payments
with stable idempotency key -> schema/identity/amount/currency/host validation ->
actual returned payment_session_url -> contract-verified raw-body webhook -> unique
event insert plus single entitlement grant in a transaction -> 30-day access and
manual renewal, with expiry enforcement and payment reconciliation.

Do not mistake the delivered blocked route for a completed MPP checkout adapter.
No actual purchase MPP order, payment URL, QR, membership webhook or expiry worker
was implemented against the unknown contract. UAT transactions remain separate.

## Remaining Blocking Issues

1. MPP_PROJECT_API_KEY and MPP_WEBHOOK_SIGNING_SECRET are absent/empty in local
   runtime env; the inspected running API container exposes no MPP env entries.
2. Need the platform's official signing header, algorithm, signing input/raw-body
   and timestamp rules, real event envelope, project identity and replay semantics.
3. Need an authoritative list of successful/pending/failed/expired statuses and
   webhook events. OpenAPI exposes status as an unconstrained string. Do not treat
   arbitrary `verified`, `confirmed` or `paid` strings as successful payment.
4. The existing `foundation.is_paid()` checks membership_status only, without
   access_ends_at/current_period_end. Granting Plus for a nominal 30 days under
   current checks could grant indefinite access. Expiry enforcement must be added
   and tested for MPP memberships without invalidating existing Stripe/manual users.
5. One-time order/entitlement persistence, authenticated-user ownership, amount /
   currency / merchant_order_id / payment_id validation, transactional event and
   grant idempotency, recheck, pending/failed/expired state transitions and retry
   remain dependent work. The monthly duration policy is 30 days with manual
   renewal; do not silently reinterpret existing yearly prices as 30-day products.
6. Staging E2E UAT and regression suite must pass before production deployment.

## Files Changed

- `apps/api/app/routers/billing.py`
- New `apps/api/app/services/mpp_checkout.py`
- `apps/web/src/lib/api/billing.ts`
- `apps/web/src/app/pricing/page.tsx`
- `apps/web/src/app/billing/page.tsx`
- `apps/api/tests/test_api.py`: update checkout assertions to the intentionally
  disconnected Stripe policy; retain subscription webhook/portal tests.
- New `apps/api/tests/test_mpp_checkout_boundary.py`
- New `docs/MPP_CHECKOUT_AUDIT_AND_MIGRATION_REPORT.md`
- UI QA: `docs/MPP_CHECKOUT_PRICING_DESKTOP.png`,
  `docs/MPP_CHECKOUT_PRICING_MOBILE.png`,
  `docs/MPP_CHECKOUT_BILLING_DESKTOP.png`,
  `docs/MPP_CHECKOUT_BILLING_MOBILE.png`
- Ignored local config: `.env.docker`, `apps/api/.env`
- Ignored local QA tooling/logs under `.tools/`.

No new database migration was added because the unverified purchase/entitlement
pipeline was not created. No files outside the TOPAMath project were modified.

## API Integration Status

| Component | Status |
| --- | --- |
| Public staging OpenAPI schemas / creation headers / session endpoint | Re-verified live |
| New purchase entry point disconnected from Stripe | PASS |
| Server-only configuration / staging-only frontend redirect validation | PASS |
| MPP purchase POST /payments with actual credentials | BLOCKED / not attempted |
| Actual hosted URL or QR for a purchase | BLOCKED / not generated |
| Real signed purchase webhook / confirmed status mapping | BLOCKED / unverified |
| Idempotent Plus activation / 30-day expiry / manual renewal | NOT IMPLEMENTED |
| Previous admin UAT adapter | Separate, assumption-based; not entitlement authority |
| Existing Stripe subscribers / portal / webhook handlers | Preserved |

## Test Results

- Checkout boundary + existing UAT module: **28 passed** (17 boundary cases and
  11 UAT tests). UAT tests are contract simulations, not proof of live compatibility.
- Final focused existing checkout/portal/Stripe webhook/affiliate regression run
  with SMTP transport disabled: **28 passed / 83 deselected**. This verifies the
  retained subscriber handlers and updated checkout assertions separately.
- Full regression run: **124 passed / 30 failed**, 303.76 seconds. Existing
  failures include billing status extra fields, founder-only price visibility,
  ranking query, active content roots/imports, lesson shapes/variants and quiz /
  placement/access/content quality. The new checkout tests passed. No unrelated
  lesson/scoring code was changed to silence these failures.
- py_compile of changed backend modules and tests: **PASS**.
- `npm run lint` (TypeScript): **PASS**.
- `npm run build`: **exit 0**. Existing Next/ESLint dependency warning remains:
  invalid options `useEslintrc` and `extensions`.
- Playwright: **4 scenarios PASS** across pricing/billing: visible blocked state
  after loading, retry enabled, correct MPP endpoint and server plan-code request,
  no Stripe navigation, and rejection of an unexpected Stripe URL returned in a
  simulated response. Desktop/mobile screenshots captured; no page overflow.
- Real transfers, live purchase payments and live withdrawals: **not performed**.

## Request Acceptance Matrix

| Requested check | Result |
| --- | --- |
| Select Plus / call correct backend | PASS in UI mocks and authenticated API tests |
| Backend creates real MPP purchase | BLOCKED: credentials and contract |
| Frontend opens actual MPP hosted payment | BLOCKED: no live transaction |
| New checkout cannot redirect to Stripe | PASS in code + UI/API tests |
| Pending cannot open new Plus access | Boundary preserves Free; real pending pipeline not implemented |
| Successful status uses actual contract | BLOCKED |
| Webhook confirms payment / activates correct Plus | BLOCKED |
| Duplicate webhook cannot extend Plus twice | Membership-grant pipeline not implemented; UAT replay tests are separate |
| Failed/expired transaction/retry lifecycle | Blocked retry tested; real lifecycle remains blocked |
| Existing Free/Plus and legacy subscriptions | Boundary preservation tests PASS; legacy handlers retained |
| All regression tests green | FAIL: 30 remaining failures |

## Preview and Production Readiness

Updated built frontend preview: `http://localhost:3003/pricing` and
`http://localhost:3003/billing`. The configured running API/Docker services were
not redeployed; they must receive the updated code in a staging environment
before real browser requests can observe the new backend 503 contract.

The previously opened localhost:3002 page belongs to the earlier preview process.
Do not infer deployed checkout state from cached assets or from these source edits.
No production deployment was performed.

Final decision: **NOT_READY / BLOCKED**. Stripe new-checkout disconnection is
implemented, but MPP purchase + verified entitlement activation is incomplete.
Provide staging credentials through the server environment and the official
webhook/success-state contract before implementing that dependent pipeline.
