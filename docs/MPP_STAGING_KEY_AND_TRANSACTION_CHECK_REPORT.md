# MPP Staging Key And 199 THB Transaction Check

Date: 2026-10-15. Scope: TOPA project only.

**Result: KEY LOADED; TRANSACTION BLOCKED BY ENDPOINT SAFETY/CONNECTIVITY.**

The user explicitly confirmed that the intended domain remains mmerchant.cc.
No switch to the different mmerchat.cc hostname was made. No API key was sent
to either MPP hostname or to any redirect destination during these checks.

## 1. Key And Runtime Loading

VERIFIED without printing any secret or its length:
- Existing .env.mpp-staging contains a nonempty MPP_PROJECT_API_KEY: True.
- Before refresh the running staging API key presence was False.
- ONLY topa-mpp-staging API was recreated with the existing image to load the
  updated environment. No build, schema initializer or migration was executed.
- get_settings().mpp_project_api_key inside the running backend is nonempty: True.
- Runtime value matches the private staging file: True (compared in process
  memory; neither value was printed/written to this report).
- Container health is healthy; localhost:8004/health and OpenAPI both return 200.
- Private file DACL is protected, has three rules, and has no broad Users,
  Authenticated Users or Everyone access in the checked ACL rules.

Recreation command actually executed, with explicit staging project selection:

```powershell
docker compose -p topa-mpp-staging --env-file .env.mpp-staging -f docker-compose.mpp-staging.yml up -d --no-deps --no-build api
```

Safe backend presence check actually executed:

```powershell
docker compose -p topa-mpp-staging --env-file .env.mpp-staging -f docker-compose.mpp-staging.yml exec -T api python -c "from app.core.config import get_settings; print(bool(get_settings().mpp_project_api_key))"
```

Output: True. No key was created/rotated and the original private value was not
edited. The existing staging image is still older than current local source:
config/service SHA-256 comparisons differ. Thus new feature-flag source logic is
NOT claimed deployed merely because the environment now includes stripe/false.
No checkout enable flag was turned on, and no missing identity/unit guard was bypassed.

## 2. Staging Is Separate From Production

| Item | Staging | Production |
| --- | --- | --- |
| Compose project | topa-mpp-staging | 4craft-beta |
| API | topa-mpp-staging-api-1 / localhost:8004 | 4craft-api / api.topamath.com |
| Database target | db:5432/topa_mpp_staging | 4craft-postgres:5432/adaptive_learning |
| Docker network | topa-mpp-staging_default | 4craft-beta_default |
| PostgreSQL volume | topa-mpp-staging_mpp-staging-data | 4craft-beta_4craft-postgres-data |

Production API/Web/PostgreSQL/Tunnel image references and start times remain
unchanged (2026-10-13). Public production health/login GET checks returned 200.
Production environment and existing Stripe checkout behavior were not changed.
No production restart, deployment, DNS/Tunnel edit or member-data write occurred.

## 3. Confirmed Connectivity Findings

For BOTH staging-api.mmerchant.cc and staging-pay.mmerchant.cc:
- Windows resolution, Google DNS-over-HTTPS and Cloudflare DNS-over-HTTPS return
  the same A address: 156.241.125.238. DNS query status is NOERROR.
- Public NS answers for mmerchant.cc are ns25.domaincontrol.com and
  ns26.domaincontrol.com. This does not establish who owns or controls the zone.
- TCP 443 is refused on the Windows host (10061), before TLS/HTTP can begin.
- The actual staging API container resolves the SAME address and receives
  ConnectionRefusedError / errno 111 on HTTPS too.
- No relevant local hosts-file override was found. Proxy environment variables
  are absent; enabling/disabling trust_env did not resolve the failure.
- Unauthenticated HTTP port 80 diagnostic GET connects, but returns 302 with an
  unrelated redirect hostname, www.zjvlvb.vip, instead of an MPP API/payment page.
  Redirects were NOT followed. No credentials or customer data were included.

This is NOT just TOPA failing to read its API key. It is a reproducible public
endpoint/HTTPS routing problem, with an unrelated HTTP redirect that makes sending
credentials unsafe until ownership and routing are verified. This evidence does
NOT by itself prove domain compromise, identify the intended server, or authorize
changing public DNS. No local hosts override, insecure HTTP fallback, TLS bypass
or alternate-domain credential request was used as a workaround.

Repair needs the authorized domain/infrastructure owner to confirm the intended
API/payment origins, DNS records, HTTPS listener/certificate and reverse-proxy or
Tunnel hostname routing. TOPA-only config changes cannot establish a trustworthy
MPP origin or open port 443 on that remote server. MPP server/domain administration
was not modified or accessed in this task.

## 4. Contract, Amount And Merchant Checks

- Requested host's /openapi.json and /docs could not be fetched over HTTPS.
  Actual current mmerchant.cc API contract therefore remains BLOCKED.
- Public, UNAUTHENTICATED OpenAPI on the DIFFERENT legacy mmerchat.cc host still
  returns 200. It documents POST /api/v1/payments and response payment_id,
  merchant_order_id, amount, currency, status, expires_at, payment_session_token,
  payment_session_url, merchant and project. This is comparison evidence only,
  NOT authorization to use that host with the imported key.
- That legacy schema describes amount as integer with no explicit satang unit.
  Integer type alone does not establish whether 199 or 19900 means 199 THB.
- Existing TOPA staging database price is VERIFIED: th_founder_monthly,
  amount_minor=19900, currency=THB, duration_days=30. No trusted amount is accepted
  from the frontend. We did not change that catalog row or set a unit assumption.
- Runtime readiness guard reports 503 MPP_CHECKOUT_BLOCKED with
  amount_unit_unverified and missing_expected_merchant_project. Missing-key is no
  longer a blocker. This guard was invoked locally; it did not make a provider POST.
- Expected merchant display name and project name are still absent. Merchant
  slug topamath is user-provided context, not verified API identity. Key presence
  does not prove this key's project, environment scope, ownership or permissions.
- Signing secret and official webhook signature/success mapping are still absent.
  No unverified remote status was treated as payment or entitlement authority.

## 5. Transaction Result

| Check | Result |
| --- | --- |
| Backend reads existing API key | VERIFIED True |
| Send key to a verified MPP endpoint | NOT ATTEMPTED: endpoint is not yet safe/reachable |
| Create 199 THB payment | BLOCKED; no POST /payments made |
| Real payment_id/merchant_order_id | NONE generated by this run |
| Actual hosted payment URL/QR | NONE obtained; no URL synthesized or opened |
| Verify TOPA merchant/project on hosted page | NOT TESTED |
| Transfer funds/withdraw money | NOT PERFORMED |
| Signed confirmation / Plus activation | NOT PERFORMED; no unconfirmed grant |

Read-only staging DB checks: mpp_purchase_orders=0, mpp_purchase_events=0,
profiles with membership_provider=mpp=0. No fake transaction or mocked provider
response was inserted to represent a successful integration.

## 6. Exact Next Actions

1. Authorized owner must repair/confirm mmerchant.cc staging DNS/origins and TLS.
   Do not send keys while its HTTP route redirects to an unrelated hostname.
2. Retest HTTPS FROM the TOPA backend container, verify certificate/hostname and
   OpenAPI at the exact confirmed host, and reject unexpected redirects.
3. Obtain official amount-in-satang documentation, exact merchant/project identity
   and confirmation that the existing key belongs to that staging project. Do not
   create or rotate a key just to hide a hostname/routing problem.
4. Refresh ONLY staging to reviewed current backend source and prepare its missing
   additive staging schema as a separate approved step; verify real flag enforcement
   and preserve default Stripe/MPP-disabled policy for ordinary users.
5. Explicitly authorize only a TOPA admin/allowlisted test account for MPP, then
   create one owned logical order at DB price 19900 only AFTER satang is confirmed.
   Reuse its stable idempotency key for ambiguous retries; validate response order,
   amount/currency and exact merchant/project before opening its actual hosted URL.
6. Use only the vendor-authorized staging payment simulator, never real funds.
   Verify real signature/status contract and idempotent membership grant before
   claiming payment/Plus E2E success. Production cutover is not authorized.

**Final: KEY_READY / BLOCKED_MPP_ENDPOINT_SAFETY_AND_CONTRACT.**
