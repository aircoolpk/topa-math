# TOPA Math Deployment Safety Report

Date: 2026-10-15. Scope: C:\web-app\4-craft.com only.

**Decision: LOCAL SAFETY PREPARATION IMPLEMENTED; NOT READY FOR PRODUCTION DEPLOYMENT.**

No production deployment, image build, restart, migration, environment change,
Cloudflare edit, volume operation or member-data modification was performed.
Existing running local staging was not rebuilt/restarted either. This report
supersedes the old checkout-default assumption: new LOCAL code defaults to Stripe
again as explicitly requested, with MPP opt-in and account authorization.

## 1. Actual Compose Architecture

VERIFIED from current Docker labels, configurations, read-only schema inspection
and running Web rewrite manifest:

- Docker Desktop context desktop-linux; production project/network
  4craft-beta / 4craft-beta_default.
- Containers: 4craft-web, 4craft-api, 4craft-postgres, 4craft-redis,
  4craft-cloudflared. Web/API/Tunnel labels identify ONLY
  /mnt/c/web-app/4-craft.com/docker-compose.beta.yml as their config file;
  no runtime-label evidence of another production override.
- Current docker-compose.beta.yml contains API/PostgreSQL/Redis/Tunnel but has
  lost its Web definition. It was NOT edited in this task.
- IMPORTANT clarification: a 4craft-web definition DOES exist in
  docker-compose.dev.yml under project 4craft-dev. It is a development server
  (target deps, npm run dev, source/node_modules mounts), NOT the running
  production Web's owner or an appropriate production override.
- docker-compose.dev.yml also reuses production container_name values; do not
  run it against this machine as a supposed repair or create another dev stack.
- infra/docker-compose.yml is a separate legacy API/Postgres/Redis/MinIO layout,
  not the verified production stack. docker-compose.mpp-staging.yml is the
  existing isolated LOCAL staging definition, not production.
- The historical change which removed Web from beta is UNKNOWN. Current local
  Git HEAD is master / 7e01f8ce4980ce37ce6d4c0f59b70ba989a76aba with a large dirty
  working tree. Neither this HEAD nor the dev Web definition proves image provenance.

The NEW deploy/compose.production.candidate.yml is a prepared, standalone
application-service configuration for the SAME project and SAME container names,
not a new project or a second Web stack. It defines API/Web only, joins the
existing external network, retains app ports/mounts, and does not define or
recreate PostgreSQL, Redis, Tunnel or any named volume. It has not been executed.

## 2. API Routing Findings

VERIFIED current path:

```text
Cloudflare HTTPS / Tunnel -> http://4craft-web:3000
  topamath.com             -> Next.js pages
  Host api.topamath.com    -> Next.js beforeFiles rewrite
                             -> http://4craft-api:8001
                             -> existing PostgreSQL volume
```

Tunnel's last logged ingress remains a catch-all to Web. The production Web
manifest contains the API host rewrite and legacy /auth, /quiz-sessions, /subjects,
/skills, /rankings, /avatar and /health proxy paths.

FIXED IN SOURCE ONLY: apps/web/next.config.js restores those rules with an
origin-only INTERNAL_API_BASE_URL validation (no embedded credentials/query/path).
The Web Dockerfile now accepts INTERNAL_API_BASE_URL at BUILD time, preventing a
local staging build from baking the wrong internal Docker hostname. The existing
staging Compose source passes http://api:8001; production uses http://4craft-api:8001.

Source configuration assertions and the actual generated .next/routes-manifest.json
checks passed for the api.topamath.com rule and auth proxy. This is compiled route
mapping validation, NOT a deployed end-to-end signed webhook test. No DNS/Tunnel
change was made. Account-level Cloudflare Access/WAF configuration remains UNKNOWN.

## 3. Web Service Ownership And Release Configuration

Prepared artifacts:
- deploy/compose.production.candidate.yml: pinned-image inputs required, existing
  project/service/container/network identity, API readiness and Web HTTP checks.
- deploy/.env.production.release.example: blank secret fields, existing Stripe
  configuration names, private database/JWT/SMTP/Affiliate carry-over, and safe
  PAYMENT_GATEWAY_DEFAULT=stripe / MPP_CHECKOUT_ENABLED=false defaults.
- Private production env does NOT exist as a result of this task and was not
  populated from the live environment. The example is not deployment-ready until
  an authorized operator privately preserves every existing required setting.
- Candidate API healthcheck uses /health/ready. The new endpoint checks required
  membership columns and payment tables without DDL and returns a sanitized 503
  if schema/database is not ready. Existing /health remains unchanged.
- Production startup no longer runs metadata.create_all or local schema repair;
  automatic DDL remains limited to local/dev/development/test.

Do not combine the candidate with dev Compose or use --remove-orphans/down:
DB/Redis/Tunnel remain existing services in this project and are deliberately
not managed by this candidate. All future commands must name API/Web explicitly.
Existing external port exposure needs an independent firewall review; it was not
tightened or otherwise changed during this task.

## 4. Image Version And Rollback Findings

VERIFIED unchanged live references:
- Web: sha256:ad9b5fb6fe0d712007a83622087e7e20282132e3c4d84eb1ddfdf309fdcfc272.
- API container reference:
  sha256:e31c19873243c9dadb309feffb5ce54ba9326bcf142700572de6a4fd80861694.
- docker image inspect of that API reference still fails while its container is
  running. A reusable/archiveable API rollback image is therefore BLOCKED, not
  assumed available. No commit/export/save operation was attempted here.
- Production image commit provenance remains UNKNOWN. Do not rebuild the dirty
  HEAD and label it as the historical release.

PREPARED: both Dockerfiles accept RELEASE_REVISION and attach
org.opencontainers.image.revision; release config requires approved revision and
API/Web image references. Future images must be built from reviewed release
contents with that argument, pinned by digest, archived and inspected before use.
Labels defaulting to unversioned are not acceptable production provenance.

Rollback design:
1. Freeze NEW checkout creation through an approved operator procedure; keep
   Stripe and verified MPP callback/recheck processing available.
2. Inventory/reconcile every in-flight order using its ORIGINAL provider/key.
   A remote timeout is not a failed payment and must not trigger another gateway.
3. Roll Web first only if the API contract is compatible; roll API only to a
   tested MPP-aware artifact. Old pre-MPP code may ignore membership expiry.
4. Retain additive schema, reservations, payment/event records and post-release
   membership data. Never downgrade/drop payment tables or restore an old dump
   over later payments as a code rollback.
5. Safe flag setting stripe/false is NOT a universal sales kill switch: existing
   MPP orders still resolve to MPP, and new eligible users can use Stripe. An
   incident-wide new-sales freeze requires a separately reviewed operational gate.

No rollback was executed/tested against production. Recovering a compatible
artifact and exercising in-flight reconciliation remain prerequisites.

## 5. Database Migration Safety

CURRENT READ-ONLY RESULTS from scripts/audit-payment-schema.py piped into the
running API Python process with its private database environment:
- No public.alembic_version table / recorded revision.
- Affiliate payout accounts, withdrawal requests and commission ledger exist;
  the script's checked required columns are present. This is NOT a full
  type/default/index/foreign-key equivalence proof for migration 0001.
- MPP UAT tables, MPP price/order/event tables and checkout reservations absent.
- ChildProfile membership_provider and mpp_access_ends_at absent.

Lineage preserved:

```text
20260617_0001 affiliate tables
 -> 20261014_0002 isolated MPP UAT tables
 -> 20261015_0003 MPP price/order/event tables and nullable membership fields
 -> 20261015_0004 billing checkout reservations (NEW this task)
```

0004 adds the provider-reservation table, external ID uniqueness and a PostgreSQL
partial unique index for one PENDING reservation per user. It does not rewrite
memberships or existing subscriptions. Its SQLite upgrade/downgrade preservation
test passed; PostgreSQL application/concurrent migration of 0004 is NOT TESTED.

SAFE FUTURE BASELINE PLAN (no stamp/upgrade executed):
1. Obtain approved encrypted production dump, uploads/config recovery material and
   immutable images; verify an actual isolated restore, not just a dump hash.
2. Export the FULL restored schema and compare every 0001 column/type/nullability,
   default, constraint, foreign key and index, plus relevant existing core tables.
3. If partial differences exist, prepare/review explicit additive convergence SQL
   and validate on the restored snapshot first. Do not blindly rerun create-table
   migration 0001 over existing affiliate tables or change historical lineage.
4. ONLY if the full existing schema is proven equivalent to 0001, obtain explicit
   approval for a specific 0001 baseline marker; never stamp head. If equivalence
   cannot be established, stop and resolve the baseline rather than guess.
5. Apply/rehearse 0002 -> 0003 -> 0004 on the isolated restored snapshot, including
   locks/indexes, catalog, foreign keys, concurrent reservations and old-code
   compatibility; inspect generated SQL and backup/recovery timing.
6. Test readiness, checkout flags, legacy Stripe renewal, MPP expiry, and
   compatible rollback while retaining post-upgrade data. Seek separate approval
   before any production baseline or upgrade command.

The staging bootstrap is explicitly not a production baseline strategy. API
readiness will fail until the reviewed payment schema exists, even if default
checkout remains Stripe. Therefore the candidate image MUST NOT be deployed yet.

## 6. Feature Flag Implementation

Server Settings now default to:

```dotenv
PAYMENT_GATEWAY_DEFAULT=stripe
MPP_CHECKOUT_ENABLED=false
MPP_CHECKOUT_TEST_USER_IDS=
```

VERIFIED LOCAL behavior:
- Generic /billing/create-checkout-session selects new order gateway on the server.
  With defaults it calls retained Stripe subscription checkout, not MPP.
- Explicit /billing/mpp/checkout requires enabled=true AND either DB role admin
  or an authenticated user ID on the server-only test-user allowlist. No email
  wildcard or automatic test-account detection; frontend cannot grant access.
- Default=mpp still requires both flag and account authorization. Unauthorized
  callers receive 403; disabled MPP receives 503. There is no fallback to Stripe.
- Invalid default provider receives controlled 503. Missing key/identity/unit
  evidence receives the existing sanitized MPP_CHECKOUT_BLOCKED response.
- Existing production/staging-host safeguards remain: production MPP creation
  is STILL blocked even if flags are set. This task does not enable production
  hosts or implement an unverified payment/signature contract.
- Existing Stripe subscriptions are protected from a second MPP checkout. The
  generic Stripe branch also blocks active MPP members from starting a parallel
  Stripe subscription. The billing UI requests explicit MPP for MPP renewal;
  server flag/account enforcement remains authoritative.

Provider pinning and retries:
- Stripe creation first commits a billing_checkout_reservations row with provider
  stripe; User row locking serializes gateway creation and the partial unique
  index protects pending reservations. The reservation ID is a stable Stripe
  idempotency key and metadata correlation key (customer creation also has a key).
- The existing mpp_purchase_orders table is the MPP-only order authority and
  stores its original origin, identity, key, ID and session. Its provider does not
  come from the current default flag or request body.
- Generic repeat checkout returns an existing same-plan session using the original
  provider, even after flag changes. Different-plan/ambiguous pending orders fail
  with controlled 409, not a fresh cross-provider charge.
- Explicit MPP creation rejects a pending Stripe reservation. Existing MPP retry
  and recheck remain owner-protected and MPP-specific when creation is disabled.
  Returning/servicing an existing session is not creation of a new checkout.
- GET /billing/checkouts/{reservation_id} exposes only the authenticated owner's
  stored Stripe reservation status/provider, independent of current flags.
- Verified existing Stripe webhook processing releases reservations on expiration
  or correlated completed subscription sessions; duplicate expiry cannot downgrade
  a completed reservation. Existing Stripe servicing is retained.
- Ambiguous Stripe creation failures remain reserved and require reconciliation;
  this task does NOT invent a new Stripe retrieval/retry engine. No automatic
  provider switch or automatic fresh charge is used to resolve a timeout.
- Sessions created BEFORE this reservation feature cannot be retroactively proven
  absent. Inventory their open sessions/retry windows before any MPP enablement;
  production MPP remains blocked meanwhile.

Frontend pricing/billing call the generic server-selected route for new purchases
and validate provider-specific hosted origins. They display Stripe recurring versus
MPP one-time terms using server catalog metadata; the UI flag is never trusted
for payment authorization. MPP order history continues to use MPP-specific routes.

## 7. Files Modified In This Task

Prepared deployment/tooling:
- deploy/compose.production.candidate.yml (new, NOT executed)
- deploy/.env.production.release.example (new, secret-free)
- scripts/audit-payment-schema.py (new, read-only structural audit)
- scripts/validate-deployment-safety.py (new, config/compiled-route checks only)
- apps/api/Dockerfile, apps/web/Dockerfile (revision metadata/internal build origin)
- apps/web/next.config.js (restored host/auth proxy rules)
- .gitignore (track template, exclude private release backups)
- .env.docker.example, .env.mpp-staging.example, apps/api/.env.example,
  apps/api/.env.staging.example (safe feature flag placeholders)
- docker-compose.mpp-staging.yml SOURCE ONLY (forward flags/internal build origin)

Backend/frontend/tests:
- apps/api/app/core/config.py
- apps/api/app/services/checkout_policy.py (new)
- apps/api/app/models/checkout_reservation.py (new)
- apps/api/app/routers/billing.py
- apps/api/app/services/mpp_checkout.py
- apps/api/app/main.py (readiness, local-only startup DDL)
- apps/api/alembic/env.py
- apps/api/alembic/versions/20261015_0004_checkout_reservations.py (new)
- apps/api/app/scripts/prepare_mpp_staging.py (staging-only reservation preparation)
- apps/api/tests/test_checkout_gateway_policy.py (new)
- apps/api/tests/test_deployment_safety.py (new)
- apps/api/tests/test_mpp_checkout_boundary.py, tests/test_mpp_purchase.py,
  tests/test_api.py (explicit opt-in fixtures and Stripe-default assertions)
- apps/web/src/lib/api/billing.ts
- apps/web/src/app/pricing/page.tsx
- apps/web/src/app/billing/page.tsx
- docs/TOPA_MPP_DEPLOYMENT_SAFETY_REPORT.md

No live env files or production Compose file were edited. No lesson/quiz/scoring
logic was changed; unrelated dirty work was preserved.

## 8. Tests Actually Executed

| Validation | Result |
| --- | --- |
| Gateway policy + deployment safety + MPP purchase/boundary + existing UAT module | 60 PASSED, 120.63 s; offline fixture-based tests, not provider E2E |
| Existing checkout/portal/Stripe webhook/Affiliate regression selection | 29 PASSED / 82 deselected, 57.62 s; real SMTP disabled for tests |
| Feature coverage | Defaults, disabled flag, admin/test-ID authorization, client spoofing rejection, missing key, invalid provider, provider pinning after flag change, Stripe ambiguity reservation, webhook expiration and owner isolation |
| Migration safety | 0004 SQLite round trip preserves users; production-startup test forbids automatic create/alter |
| npm run lint | PASS (repository command is tsc --noEmit, not an ESLint success claim) |
| npm run build | PASS exit 0; existing Next/ESLint useEslintrc/extensions warning remains |
| py_compile | PASS for changed backend modules and migration |
| Compose configuration | PASS for beta/dev/infra/existing local staging/new release candidate; config only, no containers created |
| API source and compiled Next route mapping | PASS api.topamath.com host rewrite and auth proxy |
| Production schema inspection | Read-only successful; missing schema correctly reported, NOT a migration PASS |
| Production restart/image/env checks | Original services retain start times; no rollout performed |

Configuration validation uses --no-env-resolution for candidate service env files
and validation-only image-reference strings which are never pulled/run. Private
candidate credentials, registry artifacts and resulting deployed health are NOT
TESTED by that check. Other existing configs are parsed privately without printing
their resolved secrets. scripts/validate-deployment-safety.py emits only safe
service names/results/default flags.

Initial tests which asserted the previous MPP-only default were updated to the
new required Stripe default; annual test fixtures now include the actual legacy
yearly setting names. Final relevant reruns passed as above. Full application
regression, Docker image builds, actual new-image browser flows and production
rollout/rollback were NOT performed this round. Previous full-suite failures are
not claimed fixed. No mock was presented as real MPP payment evidence.

## 9. Remaining Blockers

1. No verified reusable historical API rollback artifact or exact deployed Git
   revision; immutable reviewed API/Web release images still need preparation.
2. Production migration baseline unresolved and additive MPP/reservation schema
   absent. Full equivalence/restore/migration/rollback rehearsal remains required.
3. Official MPP units, signature/status contract, authorized credentials and live
   staging merchant/project validation/E2E remain incomplete from the prior audit.
4. New Web routing and feature logic are source/build validated only, not deployed;
   no claim that topamath.com changed or that running localhost:3004 uses this code.
5. Production MPP guards remain intentionally closed. Production-capable payment
   verification/allowlists require a separate reviewed task after actual staging UAT.
6. Cloudflare Access/WAF/raw signed POST routing and off-host backup/restore remain
   unverified; account access and explicit operational approval are needed.
7. Ambiguous/pre-feature Stripe sessions need original-provider reconciliation
   before enabling MPP; no automatic provider fallback is safe.

## 10. Exact Next Actions (Approval Required)

1. Review these source/config changes. Obtain approval for isolated staging
   migration/routing/browser validation next; do not use current production data
   as a writable test database and do not run dev Compose over production names.
2. Recover and archive a tested compatible API rollback artifact while the old
   container still exists; preserve Web image, private config and uploads. Do not
   remove the running API first. Record immutable digests and reviewed source revision.
3. Back up and restore into an approved isolated target; complete the full 0001
   baseline equivalence review and rehearse upgrade through 0004 before deciding
   any production stamp/upgrade commands. No stamp head shortcut is authorized.
4. After approval ONLY, privately populate the release env from preserved settings
   and compare configuration. Keep stripe/false. Build reviewed images with
   --build-arg RELEASE_REVISION=<approved-revision>; Web must additionally receive
   production public URL arguments and INTERNAL_API_BASE_URL=http://4craft-api:8001.
5. Run the prepared non-deploy checks:

```powershell
Set-Location 'C:\web-app\4-craft.com'
python scripts/validate-deployment-safety.py
# Read-only runtime schema inspection, no stamp/upgrade:
Get-Content scripts/audit-payment-schema.py -Raw | docker exec -i 4craft-api python -
```

6. Complete real staging MPP contract/credentials/webhook/UAT. Explicitly enable
   MPP only for DB admins or approved test-user IDs, verify duplicates/delayed
   events and no cross-provider charges, then return defaults to stripe/false.
7. Seek a separate production authorization and reviewed migration window. Only
   then may an operator consider commands below; they are DOCUMENTATION ONLY,
   require verified schema/backups/images, and were NOT executed:

```powershell
$Compose = @('-p','4craft-beta','--env-file','.env.production.release','-f','deploy/compose.production.candidate.yml')
docker compose @Compose config --quiet
# Do NOT run until approved baseline/upgrade has completed and images are verified.
docker compose @Compose up -d --no-deps --no-build 4craft-api
docker compose @Compose up -d --no-deps --no-build 4craft-web
# Never add --remove-orphans, down, -v, or a volume reset.
```

8. Verify /health/ready, compiled host routing, login/dashboard, Stripe default,
   legacy subscriptions and matching release labels/digests. Production MPP cutover
   and any real-money test require additional explicit approval, not this report.

**Stopped after local implementation/validation/reporting. No production deployment
or financial operation has been authorized or performed.**
