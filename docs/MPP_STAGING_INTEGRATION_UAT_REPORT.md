# TOPAMath Merchant Payment Platform Staging UAT

Date: 2026-10-14 (Asia/Bangkok)

## Delivery Status

The isolated integration module is implemented and local automated tests pass.
Live end-to-end UAT is NOT verified. No live payment or withdrawal was created.
The existing regression suite is not green (33 failures).

Only files under `C:\web-app\4-craft.com` were changed. No files in
`D:\MerchantPaymentPlatform` or `D:\PaymentSystem` were read or modified.
Existing purchasing, subscription, Stripe and affiliate settlement handlers were
not connected to this module.

## Architecture

- Existing admin layout and server `require_admin` protect UAT actions.
- Dedicated FastAPI router and service call the staging platform using Python's
  standard-library HTTP client, a 10-second timeout and no redirects.
- Production environment disables UAT; exact staging API and payment hosts are
  required. API keys are added only to server-side POST requests.
- `mpp_test_transactions` stores test orders, remote IDs, payment session token/URL,
  withdrawal status token, amount, statuses, stable idempotency key and sanitized
  test results. Amount is fixed server-side at integer 1500 satang (THB 15.00).
- `mpp_test_webhook_events` uses `event_id` as its primary key and stores a body
  SHA256 digest. Duplicate delivery is acknowledged once; reuse of an event ID
  with a different body is rejected. Event insertion and order update commit in
  the same transaction. PostgreSQL row locks serialize transaction updates.
- Test orders are committed before remote creation, preserving the logical
  order/key if the external call fails. Payment retry reuses the exact payload
  and Idempotency-Key, compares payment IDs and fails on a different payment.
- A matching `payment.confirmed` updates the test order to `PAID`. Public status
  recheck can reconcile confirmation. Later pending status does not downgrade PAID.
- Withdrawal recipient fields are submitted by the admin and forwarded to staging;
  full recipient details and raw provider responses are not persisted or logged.
- Admin result views use a scalar field allowlist. Session/status tokens are kept
  out of those views. The hosted URL is returned only through a separate admin
  action; it is a payment capability, not an API credential.
- Every workflow step shows NOT_STARTED/PASS/FAIL, action, expected/actual result
  and sanitized response. Hosted-page opening is tracked in the current browser
  session and is not proof of payment completion.

## Verified Platform Contract and Remaining Gap

Inspected the live public OpenAPI:
https://staging-api.mmerchat.cc/openapi.json

Verified endpoints/headers:

- POST `/api/v1/payments`: X-API-Key + Idempotency-Key; integer amount.
- GET `/api/v1/pay/{token}`: public payment session/status.
- POST `/api/v1/withdrawals`: X-API-Key + Idempotency-Key; recipient fields.
- GET `/api/v1/withdrawals/status/{withdrawal_id}?token=...`: public status.

OpenAPI does not document outbound webhook signing or the webhook envelope, and
the free-form public withdrawal status response has no property schema.
The current adapter is an EXPLICIT UNVERIFIED contract assumption:

- Header `X-Webhook-Signature` with lowercase hex HMAC-SHA256 of the exact raw
  request body, optionally prefixed `sha256=`.
- JSON envelope `event_id`, `event_type`, `data`.
- Payment data: `payment_id`, `merchant_order_id`, integer `amount`, `currency`.
- Withdrawal data: `withdrawal_id` (or `public_id`),
  `merchant_withdrawal_reference`, integer `amount`, `currency`.
- Payment event `payment.confirmed`; withdrawal events under `withdrawal.*`,
  including `withdrawal.paid`.

Do not mark live webhook UAT PASS until the platform's documented signing header,
signing input, envelope and withdrawal response shape are confirmed. If they
differentiate timestamps or signatures, update the verifier and contract tests.
Tests currently prove local adapter behavior, not platform compatibility.

## Files Changed for This Task

Added:

- `apps/api/app/models/payment_integration.py`
- `apps/api/app/services/payment_integration.py`
- `apps/api/app/routers/payment_integration.py`
- `apps/api/alembic/versions/20261014_0002_mpp_uat.py`
- `apps/api/tests/test_payment_integration.py`
- `apps/web/src/app/admin/payment-integration-test/page.tsx`
- `docs/MPP_STAGING_INTEGRATION_UAT_REPORT.md`
- `docs/MPP_UAT_DESKTOP.png`, `docs/MPP_UAT_MOBILE.png`
- Ignored local UI verification script: `.tools/mpp_ui_check.py`

Updated:

- `apps/api/app/core/config.py`: four server-only MPP settings.
- `apps/api/app/main.py`: register dedicated router.
- `apps/api/alembic/env.py`: register model metadata.
- `apps/web/src/app/admin/layout.tsx`: Payment UAT navigation entry.
- `apps/api/.env.example`, `apps/api/.env.staging.example`, `.env.docker.example`:
  placeholders only.
- `docker-compose.beta.yml`: server-side API env pass-through only.

## Environment and Migration

```env
MPP_API_BASE_URL=https://staging-api.mmerchat.cc/api/v1
MPP_PAYMENT_BASE_URL=https://staging-pay.mmerchat.cc
MPP_PROJECT_API_KEY=
MPP_WEBHOOK_SIGNING_SECRET=
```

Set values in the API deployment environment or ignored local env. Never use
NEXT_PUBLIC variables for the API key or signing secret. Restart/redeploy the API
to load the module and settings; the running Docker API was not rebuilt here.

Migration: `20261014_0002`, parent `20260617_0001`. On a database already tracked
at the affiliate migration revision, apply `alembic upgrade head` from `apps/api`
before starting the updated app. Existing startup also uses create_all; check the
database's actual Alembic baseline first if it was never migration-managed or
the new tables were already auto-created. Do not stamp unverified schema state.
Migration round-trip was tested against a disposable SQLite connection, preserving
the existing users table. No deployment database migration was applied.

## URLs

- Page: `/admin/payment-integration-test`
- Local built frontend running at:
  `http://localhost:3002/admin/payment-integration-test`
- Admin API prefix: `/admin/payment-integration-test`
- Merchant Platform webhook destination:
  `https://<TOPA-staging-API-host>/webhooks/mpp/staging`
- Local webhook: `http://localhost:8001/webhooks/mpp/staging` after the updated
  API is started. A public HTTPS endpoint is required for platform delivery.

The local page is served by the updated frontend; its configured API must also
be restarted/redeployed before live actions are usable.

## Validation Results

- Final module suite: `python -m pytest tests/test_payment_integration.py -q`:
  **11 passed**. Includes signed webhook replay/body tampering, identity/amount
  validation, payment retry, mismatched ID/host, remote failure persistence,
  public recheck, withdrawal flow/privacy, authorization/staging guard,
  server-side headers, malformed webhook and migration upgrade/downgrade.
- Full suite: `python -m pytest -q`: **99 passed, 33 failed**. This run collected
  the initial six module tests; five additional module tests were added and
  verified in the final dedicated run above.
- Failures involve existing billing response/price expectations, ranking query,
  removed/changed content roots, lesson shapes/variants, quiz/placement/access
  and content quality. No billing/lesson/scoring code was changed to suppress them.
- Representative rerun with the MPP router removed from the in-memory app still
  fails the same three tests: `test_billing_status_returns_free_by_default`,
  `test_billing_prices_returns_free_plus_six_paid_plans`,
  `test_import_content_and_idempotency`. This is a sample, not a complete baseline
  comparison of all 33 failures.
- `python -m py_compile` on all changed/new backend modules, migration and tests:
  **PASS**.
- `npm run lint` (`tsc --noEmit`): **PASS**.
- `npm run build`: **exit 0**, new route generated. Existing Next/ESLint version
  mismatch prints `Invalid Options: useEslintrc, extensions`; that warning remains.
- Playwright mocked UI: **PASS** for admin access, create order/payment, enabled
  hosted/retry controls, 1440px desktop and 390px mobile, no page-level overflow.
  Screenshots were captured and mobile layout inspected.
- Live platform payment, withdrawal and signed webhook delivery: **NOT_STARTED**.

## Manual UAT

1. Confirm the platform webhook contract above, obtain staging project credentials
   through the server deployment environment, and configure a public HTTPS TOPA
   staging webhook URL. Verify staging accounts/recipient data are test fixtures.
2. Apply the migration with the correct existing baseline and restart API/web.
   Login as admin/owner and open `/admin/payment-integration-test`.
3. Create a test order. Verify PASS, amount 1500 and PENDING_PAYMENT.
4. Create payment. Verify payment PASS and a remote payment ID. Open Hosted
   payment and confirm it points to `staging-pay.mmerchat.cc`.
5. Run Idempotency retry. Verify PASS and the same remote payment ID; confirm only
   one payment for the merchant_order_id in Merchant Platform.
6. Complete the platform's staging payment confirmation workflow. Do not transfer
   real money. Refresh TOPA after signed webhook delivery; verify webhook PASS
   and PAID. Re-deliver the same event and verify only one stored event.
7. Recheck status and verify PASS with matching ID, amount/currency and PAID.
8. Submit withdrawal with platform-approved staging recipient fields. Verify
   withdrawal PASS, ID and pending status. Complete the staging withdrawal
   workflow in Merchant Platform, refresh to see webhook state, then recheck
   public status to verify PAID (or the expected failure/rejection status).
9. Test invalid signature, mismatched amount and event-ID/body reuse rejection.
   Verify no unauthorized order update and no sensitive data in results/logs.
10. Confirm ordinary TOPA purchase/subscription behavior and resolve the existing
    regression failures before any future production integration decision.
