# Real MPP Checkout Implementation

Date: 2026-10-15. Scope: TOPAMath only, C:\web-app\4-craft.com.

## Decision

**IMPLEMENTED_CHECKOUT_PIPELINE / BLOCKED_LIVE_MPP_UAT / NOT_READY_PRODUCTION**

New checkout code now uses the MPP purchase pipeline, not the old always-503
placeholder and not Stripe. An isolated LOCAL staging deployment is running at
http://localhost:3004 with API http://localhost:8004. This is not a remote staging
deployment and it has no public webhook ingress. The existing production images
were deliberately not replaced. Production can therefore still show the old
Stripe checkout until an approved deployment after successful UAT.

No real transfer, withdrawal, production payment, fabricated runtime API key or
fabricated signed payment event was used. D:\MerchantPaymentPlatform and
D:\PaymentSystem were not modified. Existing dirty lesson/scoring work was left
alone. No database volume was deleted or reset.

## Required Answers

| Question | Result |
| --- | --- |
| Checkout handler changed? | YES in source and isolated local staging. Both /billing/mpp/checkout and the compatibility /billing/create-checkout-session route use create_checkout_session -> new_or_pending_order -> submit_order. |
| Files changed? | Listed below, including persistent orders, prices, frontend, migration and tests. |
| Actual MPP API connection? | Requested mmerchant.cc hosts fail with ConnectError / WinError 10061 from this machine. The different legacy mmerchat.cc OpenAPI returns 200. No silent host substitution. |
| Actual staging transaction created? | NO. Authorized API key and merchant/project identity are missing; amount unit is unverified. Runtime purchase order count remains zero. |
| Actual hosted payment URL obtained? | NO. The implementation accepts and stores only the URL returned by a validated MPP response. |
| Redirect to staging-pay.mmerchant.cc verified? | NO live URL exists. Real browser test reached the MPP backend route, got an explicit 503 and made zero Stripe requests. Offline URL validation tests passed. |
| Successful signed webhook? | NO. Official signature/envelope/status contract is missing. New membership webhook fails closed with 503. |
| Plus granted after actual payment? | NO actual payment was made. Idempotent 30-day activation and renewal domain logic passed offline tests, not live UAT. |
| Ready for production? | NO: connectivity, credentials, money units, official confirmation adapter, real UAT, regression failures and migration baseline must be resolved. |

## Old Versus New

Old: pricing/billing button -> /billing/create-checkout-session -> Stripe customer
and subscription Checkout Session -> checkout.stripe.com -> Stripe webhook.
The existing MPP admin integration module was separate and never purchased Plus.

New: pricing/billing button -> /billing/mpp/checkout -> authenticated owned order
and database price snapshot -> server-side POST /payments with a persistent
Idempotency-Key -> validated response/payment_session_url -> hosted MPP page.
Order details and recheck/retry are available under /billing/payments/{orderId}.

The final confirmation edge remains deliberately CLOSED: raw webhook -> official
signature verification and confirmed-status adapter -> VerifiedPaymentEvidence ->
atomic event ledger and Plus grant. That adapter is NOT implemented because its
contract cannot currently be verified. The backend-only evidence dataclass is
not an HTTP request model. Neither a frontend redirect, uploaded receipt, invented
HMAC header nor a remote string such as CONFIRMED can authorize membership.

The retained _legacy_stripe_checkout_session has no HTTP checkout route. Existing
Stripe portal, webhook processing, customer/subscription identifiers and history
remain. Active/nonterminal Stripe subscriptions block MPP checkout with 409;
the integration never cancels or modifies a remote Stripe subscription.

## Contract Verification

- Configured requested API: https://staging-api.mmerchant.cc/api/v1.
- Configured requested payment host: https://staging-pay.mmerchant.cc.
- Both requested hosts refused connections during verification; this is an
  observation from this machine, not proof of a global outage or a DNS diagnosis.
- https://staging-api.mmerchat.cc/openapi.json returned actual OpenAPI JSON.
  This is a DIFFERENT hostname, not proof of the new hostname's compatibility.
- That schema documents POST /api/v1/payments, X-API-Key, Idempotency-Key,
  merchant_order_id, amount, currency, customer_reference and session response
  fields payment_id, payment_session_token, payment_session_url, expires_at,
  merchant.display_name and project.name. Public session GET uses /api/v1/pay/{token}.
- Amount is typed integer but has no documented satang/minor-unit description.
  We do not treat that alone as sufficient evidence of the money unit. Checkout
  requires MPP_AMOUNT_UNIT=minor ONLY after vendor confirmation of integer satang.
- No recurring/subscription endpoint was found in the inspected schema. Absence
  of an endpoint is not vendor confirmation that recurring billing is unsupported.
  TOPA's new implementation explicitly sells one payment for 30 days, no auto-renew.
- No sufficient webhook signature formula, envelope or authoritative terminal
  status mapping was found. The old admin UAT adapter's assumptions are not
  reused as membership authorization.
- Before a real POST, validate_openapi fetches the configured host's actual
  schema and checks the expected operation, headers and response properties.
  This is a compatibility guard, not a substitute for official signing/unit docs.

## Data And Safety

- mpp_package_prices is the authoritative new purchase price catalog. Founder TH
  is 19900 integer satang / THB / 30 days. Frontend sends plan_code, not a trusted
  price. Annual products are not silently converted to 30-day products.
- mpp_purchase_orders stores user/profile ownership, immutable price snapshot,
  merchant order ID, stable idempotency key, payment ID, private session token,
  returned URL, expected merchant/project names, status and grant timestamp.
- Transactions serialize User -> Child -> Order; a PostgreSQL partial unique
  index also prevents two PENDING orders for the same profile. Repeated creation
  reuses the logical order; retry reuses the same key and exact request body.
- Founder reservations are checked under locked catalog rows. A repeated pending
  checkout and renewal of an active Founder do not consume a second Founder seat.
- mpp_purchase_events has a unique event_id and body digest. The internal verified
  evidence handler rejects inconsistent IDs, user, amount, currency and identity.
  granted_at prevents extension twice even with another event ID for the same order.
- Verified normalized FAILED/EXPIRED orders allow a new logical transaction. Until
  official mapping is supplied, unknown terminal status strings remain PENDING.
  An expired hosted session is not reused; it does not itself prove payment failure.
- An eventual verified grant extends max(now, previous MPP expiry) by 30 days.
  Access checks enforce that expiry. Legacy Stripe identifiers/history are retained.
- Recheck is authenticated server-to-server and identity-checked; admin reconciliation
  is role-protected and processes one pending order per invocation. Neither grants
  based on undocumented public status text. No recurring scheduler is installed.
- Missing/unsafe config fails closed, never falls back to Stripe. Production
  checkout in this NEW code remains disabled until a subsequent approved rollout.
- Secrets are server environment values only. Public JSON omits API key, signing
  secret and private session_token; an owned unexpired checkout_url is necessarily
  a capability link for its authenticated customer. Logs/reports do not print secrets.

## Files Changed For This Task

Backend:
- apps/api/app/services/mpp_checkout.py
- apps/api/app/models/mpp_purchase.py (new)
- apps/api/app/models/entities.py (additive membership fields)
- apps/api/app/routers/mpp_orders.py (new)
- apps/api/app/routers/billing.py
- apps/api/app/services/foundation.py
- apps/api/app/services/payment_integration.py (allowlisted staging host pairs)
- apps/api/app/core/config.py
- apps/api/app/main.py
- apps/api/alembic/env.py
- apps/api/alembic/versions/20261015_0003_mpp_purchases.py (new)
- apps/api/app/scripts/prepare_mpp_staging.py (new, staging-only schema bootstrap)
- apps/api/tests/test_mpp_purchase.py (new)
- apps/api/tests/test_mpp_checkout_boundary.py
- apps/api/tests/test_api.py (price fixture and checkout contract expectation)

Frontend/deployment:
- apps/web/src/lib/api/billing.ts
- apps/web/src/app/pricing/page.tsx
- apps/web/src/app/billing/page.tsx
- apps/web/src/app/billing/success/page.tsx
- apps/web/src/app/billing/payments/[orderId]/page.tsx (new)
- apps/web/next.config.js (standalone output required by existing Dockerfile)
- docker-compose.mpp-staging.yml (new, localhost-only isolated stack)
- .env.mpp-staging.example (new), .gitignore
- .env.docker.example, apps/api/.env.example, apps/api/.env.staging.example
- Ignored local env files: requested host values updated; new isolated staging env
  contains generated DB/JWT secrets and NO MPP credential values.
- docs/MPP_REAL_CHECKOUT_IMPLEMENTATION_REPORT.md and desktop/mobile QA screenshots.

Local ignored .tools helpers provision/verify staging, compare source hashes,
inspect sanitized environment flags, run the browser test and validate migration.
They are not production application dependencies.

## Migration And Deployment

Migration 20261015_0003 (parent 20261014_0002) adds the three MPP tables, catalog
seed rows, indexes and nullable ChildProfile membership fields. SQLite upgrade /
downgrade tests passed. PostgreSQL upgrade/downgrade also passed inside an isolated
temporary schema transaction that was rolled back, without modifying live tables.

The existing database lacks a verified legacy Alembic baseline. It was NOT blindly
stamped. A dedicated staging-only additive initializer prepared the restored
topa_mpp_staging database and created the pending-order unique index. Establish
the actual baseline before running the full migration chain on an existing deployment.

Only topa-mpp-staging containers were built/started. Its PostgreSQL snapshot has
109 users and 87 profiles, with SMTP disabled and no Stripe keys. Snapshot data
was transferred in process memory, not persisted as an unsecured SQL dump. Original
PostgreSQL remains on 4craft-beta_4craft-postgres-data with 109 users / 87 profiles;
production container start times and images remain unchanged.

Source SHA-256 matches the running staging API image for all seven inspected core
backend files. The staging web image contains the current built checkout UI, and
real browser network validation confirms /billing/mpp/checkout, not Stripe. This
does not claim the old production image matches the edited source.

## Test Results

- MPP purchase, checkout boundary and existing UAT module: **46 passed**.
  These are OFFLINE transport/domain tests, not successful live payments.
- Existing checkout/portal/Stripe webhook/Affiliate focused regression on the
  final source: **29 passed / 82 deselected** (SMTP transport disabled).
- Coverage includes database 19900 price, ignored frontend amount/user override,
  one RPC for duplicate checkout, exact key/body retry after network failure,
  mismatched identities/price/currency/host rejection, other-user isolation,
  Stripe subscriber protection, unverified webhook remaining pending, duplicate
  evidence, 30-day renewal/expiry, failed/expired retry and Founder quota cases.
- Full regression during implementation: **139 passed / 30 failed**, 384.79 sec.
  The previous audit recorded the same 30 failing test names: billing response/
  price visibility assumptions, ranking SQL and existing content/lesson/quiz/
  placement issues. The full suite was not rerun after final quota/unit guards;
  latest targeted tests cover those changes. Overall regression is NOT green.
- py_compile of changed backend modules and migration: PASS.
- npm run lint: PASS; this repository's command is TypeScript tsc --noEmit.
- npm run build: exit 0. Existing Next/ESLint incompatibility warning about
  useEslintrc/extensions remains; this is not a claim that ESLint itself passed.
- Docker API build: PASS. Docker Web build: PASS after enabling standalone output.
- Runtime: API healthy, /health 200, web /login 200; unauthenticated checkout 401;
  unverified membership webhook 503 and no membership activation.
- Real Playwright login 200, dashboard 200, Affiliate 200, pricing/billing status
  200. Clicking the 199-baht plan calls MPP checkout and gets explicit config 503;
  button re-enabled, no stuck loading, no pending requests, no page errors and
  zero Stripe requests. No network responses were mocked in this browser run.
- Actual MPP creation, hosted URL, hosted amount/merchant inspection, confirmed
  payment simulator, signed webhook and paid membership renewal: BLOCKED, NOT PASS.

## Required Configuration And Next Steps

Server-only values required:
- MPP_API_BASE_URL=https://staging-api.mmerchant.cc/api/v1
- MPP_PAYMENT_BASE_URL=https://staging-pay.mmerchant.cc
- MPP_PROJECT_API_KEY (authorized TOPA Math staging project key)
- MPP_WEBHOOK_SIGNING_SECRET (authorized secret, official encoding required)
- MPP_EXPECTED_MERCHANT_NAME and MPP_EXPECTED_PROJECT_NAME (exact real identities)
- MPP_AMOUNT_UNIT=minor only after vendor confirms integer satang contract
- Local isolation also requires generated MPP_STAGING_DB_PASSWORD and
  MPP_STAGING_JWT_SECRET; do not reuse production credentials.

No MPP key/secret was found in inspected project env files, process/user/machine
environment or the running API; no Docker secret mount/configured vault supplied
one. No credential was invented or copied into this report.

1. Confirm the intended hostname. Repair access to mmerchant.cc or explicitly
   authorize a different staging endpoint; do not silently use mmerchat.cc.
2. Supply authorized staging credentials through the private server environment,
   actual TOPA merchant/project identity and official satang/currency contract.
3. Supply official raw-body signature algorithm/header/timestamp/replay rules,
   event envelope/event_id semantics, successful and terminal status mappings,
   trusted recheck authorization and staging payment simulation instructions.
4. Implement that verified adapter before accepting payments for entitlement.
   Intended path: /webhooks/mpp/payments. On this local stack its address is
   http://localhost:8004/webhooks/mpp/payments, NOT publicly reachable. Configure
   an approved public STAGING HTTPS ingress before registering it with MPP.
5. Rebuild staging, login /pricing, verify backend sends 19900 only if confirmed
   satang units, receives an actual TOPA project session URL, and inspect hosted
   page amount/merchant/project. Use ONLY the vendor's authorized test mechanism.
6. Test real pending, failure, expiration, retry, signed confirmation, duplicate
   delivery and independent recheck. Verify single 30-day grant, renewal extension,
   free-user behavior, existing Stripe subscriptions and all member history.
7. Resolve regression failures, complete migration baseline review, restore/support
   runbook and operational reconciliation; obtain staging E2E UAT sign-off.
8. Only then propose an approved production provider/host configuration and rollout.
   This task has NOT enabled production MPP payments.
