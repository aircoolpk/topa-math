# TOPA Math Production Infrastructure And MPP Deployment Readiness

Audit date: 2026-10-15. Project: C:\web-app\4-craft.com.

**Decision: BLOCKED / NOT READY FOR PRODUCTION CUTOVER.**

This run was a READ-ONLY production audit. Only this report was added. No image
was built, container restarted/recreated, migration executed, production variable
changed, payment created, webhook submitted or database/volume reset. Production
checks used GET requests, container/file inspection and SELECT in a READ ONLY
database transaction. No other project was modified. Commands below are a future
operator runbook, NOT actions executed during this audit.

Status definitions: VERIFIED = direct current evidence; UNKNOWN = inaccessible
or insufficient evidence; BLOCKED = prerequisite missing; NOT TESTED = behavior
not exercised here. Historical tests are identified separately from current checks.

## A. Actual Hosting Architecture

**VERIFIED data path:**

```text
Browser -> Cloudflare HTTPS edge -> Cloudflare Tunnel connector
  -> 4craft-web:3000 (Next.js)
       topamath.com                -> frontend pages
       Host: api.topamath.com      -> Next.js beforeFiles host rewrite
                                     -> http://4craft-api:8001
                                        -> 4craft-postgres:5432/adaptive_learning
                                        -> 4craft-redis:6379
```

| Item | Status and evidence |
| --- | --- |
| Reachable runtime host | VERIFIED: Docker context desktop-linux, engine OS Docker Desktop, Compose working directory /mnt/c/web-app/4-craft.com; accessible from this Windows machine. No VPS assumption is needed. |
| Production frontend | VERIFIED: container 4craft-web, Next.js, published host port 3000, Compose project 4craft-beta/network 4craft-beta_default. |
| Production backend | VERIFIED: container 4craft-api, Uvicorn port 8001, same Compose network. |
| Public frontend binding | VERIFIED: public /pricing HTML SHA-256 exactly matches localhost:3000/pricing; Tunnel's logged ingress origin is http://4craft-web:3000. |
| Public API binding | VERIFIED: public and localhost:8001 OpenAPI/health bytes match. The running Web rewrite manifest proxies Host api.topamath.com to 4craft-api:8001. GET localhost:3000/openapi.json with that Host returns JSON 200. |
| Browser API base | VERIFIED: running web environment and public pricing JavaScript contain https://api.topamath.com. |
| Cloudflare Tunnel | VERIFIED: 4craft-cloudflared running on 4craft-beta_default; token supplied in command, never printed. Logged ingress is a catch-all to Web, not a separate direct API ingress. |
| Cloudflare edge/DNS | VERIFIED: public responses carry server=cloudflare and cf-ray; current A records 104.21.62.59 and 172.67.220.162. DNS alone was NOT used to identify the origin. |
| Cloudflare account/zone/hostname management | UNKNOWN: no account dashboard/API access exercised. Need read-only account/zone/Tunnel/Public Hostname/Access/WAF configuration access or an owner-provided export. |
| Cloudflare Pages/Workers | UNKNOWN account-wide; no evidence that they serve the observed origin path, no relevant deployment config found in this repo. Cannot prove absence of a Worker route from headers/DNS. |
| Hostinger VPS | UNKNOWN: no Hostinger panel/SSH/billing inventory supplied. No evidence it hosts these observed services; do not claim there is no VPS elsewhere. |
| Database | VERIFIED: PostgreSQL 16.14 in 4craft-postgres; database adaptive_learning; named volume 4craft-beta_4craft-postgres-data at /var/lib/postgresql/data. |
| Persistence | VERIFIED: API bind-mounts math/site content and storage/uploads from /mnt/c/web-app/4-craft.com. Redis uses 4craft-beta_4craft-redis-data. |
| Cloud provider physical host, firewall and availability | UNKNOWN: Docker Desktop is observed, but ownership, off-host recovery, router/NAT/firewall and uptime guarantees were not verified. |

API, Web and PostgreSQL were healthy, and database counts were 109 users / 87
profiles. All three production containers retain their 2026-10-13 start times.
This establishes current reachability, not a load test or availability guarantee.

## B. Current Production Deployment

| Component | Current version/reference |
| --- | --- |
| Local Git HEAD | VERIFIED: master, 7e01f8ce4980ce37ce6d4c0f59b70ba989a76aba, commit dated 2026-05-23. Working tree has 501 changed/untracked entries at inspection; HEAD is not the current application release. |
| Production Git commit/branch | UNKNOWN: no trustworthy revision label/release manifest ties the images to Git. Do not call local master the deployed revision. |
| Frontend image | VERIFIED: sha256:ad9b5fb6fe0d712007a83622087e7e20282132e3c4d84eb1ddfdf309fdcfc272; inspectable; creation timestamp 2026-08-15T00:40:35Z. |
| Frontend RepoDigest | VERIFIED: 4craft-beta-4craft-web@sha256:ad9b5fb6fe0d712007a83622087e7e20282132e3c4d84eb1ddfdf309fdcfc272. This local reference does not prove a remote registry backup exists. |
| Next build ID | VERIFIED: zMiZRwi9HrKGkBVseb5FV. |
| Backend container Image field | VERIFIED: sha256:e31c19873243c9dadb309feffb5ce54ba9326bcf142700572de6a4fd80861694. |
| Backend image archive/digest/revision | BLOCKED: docker image inspect of that exact reference returns No such image, although the container is running. Creation timestamp/RepoDigest/revision are UNKNOWN. Do not assume a recreated container can use this reference. |
| API version | VERIFIED: OpenAPI title 4-craft Adaptive Learning API, version 0.1.0; not an immutable release identifier. |
| Runtime environment | VERIFIED: production; frontend/backend bases topamath.com/api.topamath.com; secure cookies and HTTPS origins configured. |
| Runtime payment credentials | VERIFIED presence only: Stripe key/webhook secret set in API; MPP key/signing secret absent. No values printed. |

Current Compose labels reference docker-compose.beta.yml, but that file NOW lacks
the 4craft-web service. This is configuration drift, not proof a second hosting
provider exists. Scripts/rebuild-web.ps1 and .sh still try to build that missing
service. The shell restart-api-with-env.sh stops/removes the API before recreating
it and is unsafe as a payment cutover/rollback procedure. None was executed.

No .github/workflows directory or other verified CI/CD pipeline was found. Manual
deployment scripts exist; remote CI/CD, registry retention and Cloudflare automation
are UNKNOWN. scripts/backup-beta.ps1 is a source ZIP backup, optionally local SQLite,
not a verified production PostgreSQL backup or restore procedure.

## C. Local Versus Production Differences

| Surface | Production | Current local / isolated staging |
| --- | --- | --- |
| Checkout route | /billing/create-checkout-session -> Stripe | Same compatibility route plus /billing/mpp/checkout -> MPP service |
| Purchase service | No app/services/mpp_checkout.py in running API | Persistent owned order, price snapshot, stable key, MPP HTTP transport |
| MPP membership routes | Absent from public/local-production OpenAPI | /billing/mpp/orders, retry/recheck, /admin/mpp/reconcile, /webhooks/mpp/payments |
| Membership webhook | No MPP handler in running API | Reads bounded raw body and returns 503 until official verifier exists |
| API proxy in Web | Host api.topamath.com beforeFiles rewrite to API | next.config.js and staging rewrite manifest contain NO rewrites |
| Compose frontend | Running service in 4craft-beta labels | Service missing in current docker-compose.beta.yml |
| New MPP schema | No mpp_package_prices or mpp_purchase_orders | Dedicated local staging has these tables and 30-day price catalog |
| Migration baseline | public.alembic_version does not exist | Three migration files; no safe inferred production revision |
| API base | https://api.topamath.com | Local staging browser uses http://localhost:8004 |
| Public stage | Not identified | localhost:3004/8004 is LOCAL only, no public webhook ingress |

Direct backend source comparison:
- Production billing.py SHA-256: e362c23fadbbdc0f2347a5edaeee3ecba441d3b805e2946d2e8a5efd4640f169.
- Local billing.py SHA-256: 55f9c8ad8d6d782b57ff963ea1079b17af14c79560d2e9e2b61f2bd3711ce083.
- Public/local-production OpenAPI SHA-256 both:
  b8e97d158e0615963816adec0b23120707e4169b351a2d7ee7812f822d5ab18a.

**BLOCKED: do not deploy current Web unchanged.** A read-only Host-header probe
returns 200 JSON through production Web but 404 HTML through local staging Web.
Because the observed Tunnel routes all traffic to Web, replacing it without the
host rewrite (or an explicitly reviewed equivalent direct API ingress) would break
api.topamath.com, including authentication and payment webhooks. This audit did
not restore rewrites or change Cloudflare routing.

## D. Stripe Redirect Root Cause

**VERIFIED, not a cache-only diagnosis:** public pricing bundle
/_next/static/chunks/app/pricing/page-824097872caa2c1b.js contains the legacy
/billing/create-checkout-session call, production API base, and no /billing/mpp/checkout.
Its SHA-256 is 138aa1c87171dc74146e6c07c5f1098c26b8ea1a586af155982ffacc7af0da62.

Inside the running production API, app/routers/billing.py:create_checkout_session
(line 593) is decorated only with the legacy route and calls
stripe_client.checkout.Session.create. Runtime Stripe credentials are present.
Local source now routes that function to mpp_checkout.new_or_pending_order and
submit_order, but those files/routes are absent from the production container.

Thus editing local code did not change the already-built/running production
images. No production checkout POST/session was created to prove what is already
visible directly in the shipped frontend and backend code.

## E. MPP Integration Readiness

| Contract/control | Status |
| --- | --- |
| Requested staging HTTPS connectivity | BLOCKED: staging-api.mmerchant.cc/openapi.json and staging-pay.mmerchant.cc fail with ConnectError from this host. No claim of a global outage. |
| Authentication | VERIFIED local code: X-API-Key on server POST, not browser. Different legacy mmerchat.cc OpenAPI documents that header. Actual new-host authentication NOT TESTED. |
| Creation endpoint | VERIFIED code: POST /payments under configured /api/v1; same logical order uses persisted Idempotency-Key. Actual transaction NOT TESTED. |
| Request | Code sends merchant_order_id, integer amount, THB, user customer_reference, metadata, description and expires_in_seconds=900. New-host schema BLOCKED; runtime schema compatibility guard must pass before POST. |
| Response | Code checks/stores payment_id, order/amount/currency, merchant.display_name, project.name, expires_at, session token and returned HTTPS session URL. No invented hosted URL. Actual response NOT TESTED. |
| Money unit | BLOCKED: available legacy schema says integer but does not document satang. DB uses minor units (19900); MPP_AMOUNT_UNIT=minor is an explicit gate, not vendor evidence. Obtain official confirmation first. |
| Hosted page / QR | NOT TESTED: no actual session URL, QR, amount or merchant/project was inspected on a real MPP page. Browser redirect is never membership proof. |
| Expiration | VERIFIED code: requests 900 seconds; stores timezone-bearing returned expiration and rejects reuse after expiry. Vendor terminal-status mapping NOT TESTED; local clock expiry alone does not prove payment failed. |
| Payment success/status | BLOCKED: no verified new-host authoritative success/failed/expired mapping. Recheck stores remote text but never grants from it. |
| Membership webhook signature | BLOCKED: official header/algorithm/key encoding/timestamp/replay/envelope contract missing. New route always fails closed with 503; it does NOT yet verify a real signature. |
| Previous admin UAT handler | VERIFIED separate test tables/assumptions: HMAC-SHA256 and CONFIRMED/PAID text mapping are not established membership contracts. Its hosted URL check still names the old mmerchat.cc host. Do not use its PASS labels as real-payment evidence. |
| Idempotency | VERIFIED code: unique order/key/payment IDs, partial unique pending profile index, event_id ledger/digest, granted_at guard. Offline tests reported previously; concurrent real vendor delivery NOT TESTED. |
| Reconciliation | VERIFIED code: owned recheck and admin one-order reconciliation endpoint. BLOCKED for actual activation until trusted evidence adapter exists; no scheduler/durable operational replay workflow verified. |
| Production provider support | BLOCKED: require_checkout_ready explicitly rejects production and non-staging hosts; transport.staging_settings also rejects production; browser URL validator accepts only staging-pay.mmerchant.cc. Changing environment variables alone cannot enable production. |
| Provider feature flag | NOT IMPLEMENTED: no safe new-payment gateway switch was found. Add a separately reviewed disabled/mpp selector for NEW orders, keep legacy Stripe servicing independent, and never auto-fallback an uncertain MPP order to Stripe. |

### Membership Requirements

**VERIFIED current public prices:** Founder TH 199 THB and Founder EP 399 THB.
Local staging database/API: TH 19900 and EP 39900 minor units, THB, duration 30
days, auto_renew=false. Local catalog also retains normal TH 299 / EP 599 THB;
do not overwrite these existing price definitions. Founder visibility/quota rules
remain distinct from a future decision to offer 199 universally.

Required product is one-time hosted QR payment, manual renewal only. No recurring
endpoint is documented in the inspected DIFFERENT legacy host schema; this does
not prove anything about an unavailable new-host contract. Do not promise auto-renew.

| Rule | Implementation review / live verification |
| --- | --- |
| First purchase +30 days | VERIFIED internal grant formula; live success NOT TESTED |
| Active renewal | VERIFIED max(now, previous MPP end) +30 days; live NOT TESTED |
| Expired renewal | VERIFIED same formula restarts from now; live NOT TESTED |
| Pending/failed/expired no grant | VERIFIED internal state handling; vendor outcome mapping BLOCKED |
| Duplicate event/order | VERIFIED unique event and granted_at guards; real duplicate/delayed delivery NOT TESTED |
| No redirect/receipt activation | VERIFIED: no frontend success authority; new webhook cannot activate without adapter |
| Verified success only | BLOCKED integration edge: normalized evidence domain exists, real verifier does not |
| Existing Stripe subscribers | VERIFIED code keeps IDs/history and blocks MPP for nonterminal Stripe subscriptions; real renewal/cancellation smoke tests NOT TESTED this audit |
| Double billing | Partial controls VERIFIED; delayed events, concurrent Stripe lifecycle changes and rollback require complete UAT |

## F. Missing Credentials And Contracts

**VERIFIED absent** in inspected process, Windows User/Machine environment,
project .env.docker, apps/api/.env, .env.mpp-staging and production API environment:
MPP project key/signing secret. Expected merchant/project names and amount-unit
acknowledgment are absent in inspected project/process configuration as well.
No production Docker secret mounts were observed. An external secret vault or
Cloudflare-managed secret store is UNKNOWN, not proven empty.

Required privately, never in report/source/browser:
- Authorized TOPA staging key and signing secret; later separate PRODUCTION key
  and secret plus confirmed production API/payment hosts (currently UNKNOWN).
- Actual merchant/project immutable identifiers if supported, exact returned names,
  ownership and production account verification.
- Official amount/currency, request/response/version and expiration documentation.
- Signature header/algorithm, raw-byte canonicalization, secret encoding, timestamp
  tolerance, replay/event uniqueness, rotation, retries, envelope and event statuses.
- Trusted server-side status API authorization/finality and delayed/out-of-order,
  refund/chargeback and canceled/expired-after-payment semantics.
- Authorized staging payment simulation instructions; no real money is authorized.
- Approved public staging HTTPS hostname/ingress and Cloudflare route/Access/WAF
  read access. Intended future production webhook is
  https://api.topamath.com/webhooks/mpp/payments, currently absent from production.
  A successful GET health check does not prove signed POST/raw-body accessibility.

## G. Exact Deployment Commands (NOT EXECUTED)

**These are gated FUTURE commands, not a deployment authorization.** Current
source cannot safely use them yet. First complete routing/provider/verifier work,
baseline mapping, staging UAT, backup/restore, immutable release and user approval.

The planned `deploy/production.release.yml` DOES NOT EXIST. It must be reviewed
and versioned in this SAME project, adding the missing 4craft-web service and
pinning both service images via TOPA_API_RELEASE_IMAGE/TOPA_WEB_RELEASE_IMAGE.
It must preserve network, content/uploads mounts, healthchecks, secure cookie/CORS
settings, legacy Stripe secrets and add server-only MPP identity/unit settings.
Do not print a full rendered Compose config: it can contain secrets. Do not
blindly use current env defaults or change live port bindings during payment cutover.

Prepare private .env.production.release after approval; it must preserve existing
database/JWT/Stripe settings and add separately approved production MPP config.
Planned NEW_PAYMENT_PROVIDER=disabled/mpp is NOT understood by current code: implement
and test it before using this runbook. It must disable new order creation only,
leaving legacy Stripe and MPP confirmation/reconciliation operational.

### Operator Preflight And Backup

PowerShell, only after explicit authorization; image names are supplied interactively,
not invented registry tags. Stop on any missing rollback artifact or nonzero exit.

```powershell
$ErrorActionPreference = 'Stop'
Set-Location 'C:\web-app\4-craft.com'
$Release = Read-Host 'Approved immutable release ID'
$ApiRollback = Read-Host 'Verified MPP-compatible API rollback image reference'
$WebRollback = Read-Host 'Verified Web rollback image reference'
$ApiRelease = Read-Host 'Approved new API image reference'
$WebRelease = Read-Host 'Approved new Web image reference'
if (-not (Test-Path -LiteralPath 'deploy/production.release.yml')) { throw 'Missing reviewed release overlay' }
$Backup = Join-Path (Join-Path (Get-Location) '.release-backups') $Release
New-Item -ItemType Directory -Path $Backup -ErrorAction Stop | Out-Null
docker image inspect --format '{{.Id}}' $ApiRollback $WebRollback $ApiRelease $WebRelease
if ($LASTEXITCODE -ne 0) { throw 'Image/rollback preflight failed' }
docker image save --output (Join-Path $Backup 'rollback-images.tar') $ApiRollback $WebRollback
if ($LASTEXITCODE -ne 0) { throw 'Rollback archive failed' }
$env:TOPA_AUDIT_BACKUP_DIR = $Backup
@'
import os, pathlib, subprocess
destination = pathlib.Path(os.environ['TOPA_AUDIT_BACKUP_DIR']) / 'adaptive_learning.dump'
with destination.open('xb') as output:
    result = subprocess.run(['docker','exec','4craft-postgres','pg_dump','-U','postgres','-d','adaptive_learning','-Fc','--no-owner','--no-acl'], stdout=output, stderr=subprocess.PIPE)
if result.returncode:
    raise SystemExit('Database backup failed; do not deploy')
'@ | python -
if ($LASTEXITCODE -ne 0) { throw 'Database backup failed' }
Get-FileHash -Algorithm SHA256 (Join-Path $Backup 'adaptive_learning.dump')
```

Backup contains personal/payment data: restrict permissions, encrypt and copy to
approved off-host storage. Separately secure the matching private config, uploads,
content and role/grant recovery material; do not echo secrets. A hash/listing is
NOT a restore test. Restore into an explicitly approved isolated target and verify
row counts, constraints, ownership and application access before sign-off. No
backup or restore was performed in this audit. The current API image reference
cannot pass the above image preflight; recover/build a tested compatible rollback
artifact BEFORE replacing the running container, not after.

### Migration And Release

Commands below require an already reviewed baseline and immutable artifacts.
`alembic_version` is absent in production; do NOT execute upgrade/stamp now.
Review existing affiliate tables/columns against 0001, UAT tables against 0002,
and additive purchase columns/tables/index/catalog in 0003. Resolve partial schema
drift explicitly. Never use the staging bootstrap on production or stamp head to
pretend missing objects exist.

```powershell
$env:TOPA_API_RELEASE_IMAGE = $ApiRelease
$env:TOPA_WEB_RELEASE_IMAGE = $WebRelease
$Compose = @('-p','4craft-beta','--env-file','.env.production.release','-f','docker-compose.beta.yml','-f','deploy/production.release.yml')
docker compose @Compose config --services
if ($LASTEXITCODE -ne 0) { throw 'Release compose validation failed' }
# REQUIRE: new checkout disabled, baseline approved, backup restored/tested.
docker compose @Compose run --rm --no-deps 4craft-api python -m alembic upgrade 20261015_0003
if ($LASTEXITCODE -ne 0) { throw 'Migration failed; stop' }
docker compose @Compose up -d --no-deps --no-build 4craft-api
if ($LASTEXITCODE -ne 0) { throw 'API release failed; stop' }
docker compose @Compose ps 4craft-api
Invoke-WebRequest 'http://127.0.0.1:8001/health' -TimeoutSec 15
docker compose @Compose up -d --no-deps --no-build 4craft-web
if ($LASTEXITCODE -ne 0) { throw 'Web release failed; stop' }
Invoke-WebRequest 'https://topamath.com/login' -TimeoutSec 15
Invoke-WebRequest 'https://api.topamath.com/health' -TimeoutSec 15
Invoke-WebRequest 'http://127.0.0.1:3000/openapi.json' -Headers @{Host='api.topamath.com'} -TimeoutSec 15
```

Neither command starts PostgreSQL/Redis/Tunnel or resets volumes. Match API+Web
revision labels and served bundle/API fingerprints to the approved artifact.
Verify Cloudflare origin routing, host header, TLS, no Access challenge or WAF
block on the signed webhook, raw body preservation and bounded request sizes.
Before enabling new orders, run login/dashboard/free/legacy-member smoke tests
and safe signed test webhook using only the official provider test facility.

Then, only with separate approval, set the IMPLEMENTED feature flag to mpp through
the private release configuration and re-create API only using the same pinned
release. Do not invent a vendor confirm/charge command. An authorized operator
must explicitly approve any production transaction, verify amount/merchant/order,
provider confirmation, webhook ledger and single 30-day entitlement grant. A GET
or frontend redirect is insufficient. No such transaction is authorized by this audit.

Staging differs from production in host allowlists, credentials/identities,
database, HTTPS/public ingress, cookie/CORS settings and compiled NEXT_PUBLIC
base URLs. Frontend public variables are BUILD-TIME values; changing container
environment alone does not replace a baked localhost/staging payment origin.
Keep all MPP secrets server-only and disable the admin UAT module in production.

## H. Production Risks

1. BLOCKED routing/config drift: missing Web service and missing API host rewrite
   can take the entire API offline even when Web health is green.
2. BLOCKED rollback: running API image reference is not inspectable/reusable; old
   code is not proven compatible with new membership expiry/payment ledger data.
3. BLOCKED schema baseline: no Alembic history; blind upgrade may collide with
   existing affiliate tables, blind stamp may skip required columns.
4. BLOCKED real payment authority: signature/status/unit contract and credentials
   missing, public staging webhook not configured, no real MPP E2E evidence.
5. BLOCKED production enablement: hardcoded staging-only backend/transport/frontend
   guards and no provider flag. Merely adding a production key cannot fix this.
6. VERIFIED exposed binds: PostgreSQL 5432, Redis 6379, API 8001 and Web 3000 bind
   0.0.0.0 and IPv6. External reachability/firewall/NAT is UNKNOWN. Review and
   restrict deliberately later; do not assume Compose's current localhost defaults
   describe the running containers, and do not silently change routing in cutover.
7. UNKNOWN backup/restore/CI provenance/HA; mutable image tags and dirty tree are
   inadequate release/rollback records. Source backup script is not DB protection.
8. NOT TESTED delayed/out-of-order events, ambiguous create timeout, concurrent
   requests/legacy subscription lifecycle and real reconciliation/finality.
9. Historical full regression is not green. Resolve relevant billing behavior and
   isolate unrelated content failures before accepting a production release.
10. Refund/chargeback/affiliate accounting for MPP requires explicit policy and
    integration review; existing Stripe invoice commission code is not proof MPP
    receipts will create/reverse commissions. Never assume ledger parity.

## I. Rollback Procedure

Do not restore a pre-cutover database over newer transactions, run Alembic downgrade,
drop MPP tables/columns or delete orders/events. Code rollback must retain schema
and all payment/entitlement records created after deployment.

1. Disable creation of NEW payments via the tested flag; keep login, read-only order
   status, legacy Stripe webhooks and verified MPP callbacks/recheck operational.
2. Capture payment high-water mark and list all PENDING/unknown-creation orders,
   keys, IDs, expires_at, event receipts and grants securely. Do not put tokens or
   customer data in incident logs. A POST timeout does not mean nothing was created.
3. Query the real provider through the documented authenticated status/lookup API,
   correlate immutable order/user/amount/currency/project, retry only with the
   original key, process valid delayed confirmations idempotently, and resolve
   terminal unpaid orders only from authoritative evidence.
4. Keep an MPP-COMPATIBLE API/verifier and durable retry/reconciliation available
   until every in-flight order is settled/reconciled and the provider retry window
   is covered. If that cannot be maintained, rollback is BLOCKED; stop new sales
   and fix forward. Do not abandon customers who can still pay a hosted session.
5. Prefer Web rollback first with new checkout disabled. Roll API only to a tested
   compatible rollback artifact. Pre-MPP API may ignore mpp_access_ends_at and
   grant indefinite Plus or mishandle servicing, so its old image ID alone is NOT
   a safe post-payment rollback target.

Future commands, AFTER those gates; same reviewed overlay/private configuration:

```powershell
# REQUIRE: feature flag disabled and persisted; in-flight reconciliation running.
$env:TOPA_WEB_RELEASE_IMAGE = $WebRollback
docker compose @Compose up -d --no-deps --no-build 4craft-web
if ($LASTEXITCODE -ne 0) { throw 'Web rollback failed' }
# ONLY a tested MPP-compatible API rollback reference is allowed here.
$env:TOPA_API_RELEASE_IMAGE = $ApiRollback
docker compose @Compose up -d --no-deps --no-build 4craft-api
if ($LASTEXITCODE -ne 0) { throw 'Compatible API rollback failed' }
Invoke-WebRequest 'https://api.topamath.com/health' -TimeoutSec 15
Invoke-WebRequest 'https://topamath.com/login' -TimeoutSec 15
```

Recheck actual MPP/Stripe event handling, member expiry, queue/backlog and provider
status after rollback. Keep an audit trail; never switch ambiguous pending MPP
customers automatically into a new Stripe charge. No rollback was tested here.

## J. Step-by-Step Next Actions

1. Request read-only Cloudflare route/Access/WAF and hosting inventory access to
   finish account-level UNKNOWNs; confirm which approved public staging hostname
   can be routed without disturbing topamath.com.
2. Recover a reusable running-release reference and produce/test a compatible
   rollback image before any deployment. Record immutable digests and Git release
   revision; isolate reviewed payment/routing changes from the 501-entry dirty tree.
3. In a separately approved coding task restore equivalent API host routing and
   version the missing Web service; add server MPP environment forwarding, a safe
   NEW-payment provider flag, production allowlists and immutable artifact labels.
4. Resolve mmerchant.cc connectivity/intended hostname, authorized staging key,
   merchant/project identity and official satang/signature/status contracts.
5. Implement the real raw-byte verifier and trusted status/reconciliation adapter;
   set up approved public HTTPS staging webhook, independent of localhost ports.
6. Complete actual staging workflow: login -> TH 199 checkout -> returned hosted
   page/QR -> official payment simulator -> verified success -> one 30-day grant.
   Verify EP remains 399 Founder (normal 599 unchanged), pending/failed/expired,
   retry, duplicated/delayed events, active/expired renewal and existing Stripe.
   Require evidence of real transaction IDs/events securely, not mock test output.
7. Review baseline/migrations against an isolated restored production snapshot;
   test concurrent orders, event uniqueness, additive compatibility and rollback.
8. Rerun membership/relevant regressions, builds and routing/raw-body ingress tests.
   Previous report recorded 46 MPP tests and 29 focused regressions passing, but
   full suite 139 passed/30 failed. These are historical, NOT rerun this read-only
   audit and NOT proof of live payments.
9. Verify encrypted/off-host database+uploads/config backup by actual isolated
   restore, test compatible rollback with in-flight events, and review runbook.
10. Verify production merchant account/credentials/hosts, obtain explicit release
    approval, deploy disabled-first via the approved runbook, then seek separate
    permission for a real production payment smoke test and gateway enablement.

### Mandatory Cutover Gates

| Criterion | Current status |
| --- | --- |
| Hosting architecture confirmed | VERIFIED observed Docker/Tunnel/Next proxy path; account-level ownership/routes UNKNOWN |
| MPP API contract confirmed | BLOCKED new host, units and confirmation/signing contract |
| Valid production credentials | BLOCKED absent from inspected runtime/env; external vault UNKNOWN |
| Production webhook verification ready | BLOCKED code/verifier/public route absent in production |
| Staging E2E passed | BLOCKED; NOT TESTED real transaction/QR/confirmation/grant |
| Membership tests passed | Historical offline coverage only; real renewal/event concurrency NOT TESTED |
| Relevant regression tests passed | Historical focused tests pass; full suite has 30 failures, final release NOT TESTED |
| Database backup verified | NOT TESTED backup/restore this audit |
| Rollback tested | BLOCKED artifact and compatibility; NOT TESTED |
| Legacy Stripe subscribers protected | VERIFIED preservation in local code; release/runtime lifecycle UAT NOT TESTED |
| Production merchant verified | UNKNOWN |
| Explicit production approval received | BLOCKED: user authorizes read-only audit only |

**Stop here. No deployment, production configuration change, restart, migration or
real-money operation is authorized until the owner reviews this report and gives
explicit approval for the next scoped step.**
