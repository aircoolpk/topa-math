# Reuse Existing TOPA Merchant API Key In Local Staging

Prepared: 2026-10-15. No key was read from another process, created, rotated,
written or sent to MPP by this task. No container was rebuilt/restarted, no
database was changed, and no production setting was modified. The operator must
run the import themselves from the ORIGINAL PowerShell process containing $apiKey.
Changing directories or opening another terminal does not transfer that variable.

Helper repair: see MPP_STAGING_KEY_HELPER_FIX_REPORT.md for reproduced ACL/null
binding failures and actual dummy-only test results on Windows PowerShell 5.1/7.
The current helper preserves ownership and emits sanitized step/category errors.

## 1. Exact Secret File And Loading Path

- Existing private file: C:\web-app\4-craft.com\.env.mpp-staging.
- Backend field: Settings.mpp_project_api_key in apps/api/app/core/config.py,
  populated by MPP_PROJECT_API_KEY.
- Compose file: C:\web-app\4-craft.com\docker-compose.mpp-staging.yml.
- Compose project: topa-mpp-staging. Backend service: api.
- Runtime container: topa-mpp-staging-api-1, localhost:8004; Web localhost:3004.
- Compose --env-file reads the private file for variable substitution and forwards
  MPP_PROJECT_API_KEY ONLY into the API environment. It is not a Web variable,
  Docker build arg or image secret. No NEXT_PUBLIC key variable is used.
- The private file is NOT mounted into the container. Editing it does not update
  an existing container environment or cached Settings; a staging-only API
  recreation is needed later. docker compose restart alone does not load new env.

## 2. Security Findings

VERIFIED:
- git check-ignore -v identifies .env.* as the ignore rule; git ls-files confirms
  the private staging file is not tracked.
- API/Web build contexts are apps/api and apps/web, so the root staging file is
  outside both contexts. Both .dockerignore files also exclude private .env.*.
- No root-context image build is needed; do not change the build context or add
  this secret as ARG, COPY, frontend config, source literal, report or command text.
- Existing ACL is TOO BROAD: inherited Authenticated Users Modify and Users Read.
  It has NOT been silently declared secure or changed by this task.

The prepared import helper removes inherited/broad ACLs before writing and allows
only the invoking Windows user, SYSTEM and Administrators. Its empty temporary
file is also restricted before receiving content, then atomically replaces the
target without a plaintext backup. Other env settings, including database/JWT
secrets, are preserved. Duplicate MPP_PROJECT_API_KEY lines are collapsed.

This is still a plaintext dotenv file, not an encrypted vault; privileged users,
Docker administrators and processes running as you can read runtime secrets.
Do not share the file, docker inspect output, resolved Compose config or debug
variable dumps. Keep original-session debugging/tracing from dumping variables.
The helper refuses multiline/NUL/apostrophe-containing keys rather than guessing
dotenv escaping. It does not validate merchant identity or authorize a payment.

## 3. Import From The Original PowerShell Session

Run this exact invocation in the session at D:\MerchantPaymentPlatform which
already owns $apiKey. It uses an absolute TOPA helper path and does not modify
that project or require changing directories. The command history contains the
variable reference, not the actual key. The helper accepts SecureString rather
than passing plaintext through a child process command line.

```powershell
if (-not [bool]$apiKey) { throw 'Use the original session containing apiKey' }
& 'C:\web-app\4-craft.com\scripts\Set-TopaMppStagingKey.ps1' -ApiKey (ConvertTo-SecureString -String $apiKey -AsPlainText -Force)
```

Only expected output:

```text
MPP_PROJECT_API_KEY_PRESENT=True
STAGING_SECRET_ACL_RESTRICTED=True
```

Do NOT paste the key into this conversation, Get-Content the secret file, use
echo $apiKey, or put a literal key into Set-Content/command history. If a corporate
execution policy prevents the helper, stop and obtain the approved signing/run
procedure; do not bypass policy. The original $apiKey is not erased or rotated.

## 4. Check Presence Only (No Payment)

After import, verify the file parser can read a nonempty key WITHOUT printing it:

```powershell
Push-Location 'C:\web-app\4-craft.com'
try {
  python -c "from dotenv import dotenv_values; print(bool(dotenv_values('.env.mpp-staging').get('MPP_PROJECT_API_KEY')))"
} finally { Pop-Location }
```

An existing container may still print False until it is recreated. Current
read-only runtime check returned False during preparation:

```powershell
docker compose --project-directory 'C:\web-app\4-craft.com' --env-file 'C:\web-app\4-craft.com\.env.mpp-staging' -f 'C:\web-app\4-craft.com\docker-compose.mpp-staging.yml' exec -T api python -c "from app.core.config import get_settings; print(bool(get_settings().mpp_project_api_key))"
```

No docker inspect/full docker compose config is needed. Do not use $env:MPP_PROJECT_API_KEY
in the shell: a shell override can silently shadow the file's value. If already
set, clear ONLY that staging operator-session environment override before Compose
commands, not the original $apiKey variable or production container environment.

## 5. Load Latest Staging Code Later (NOT Executed)

Current staging API config/service hashes do NOT match latest source; simply
recreating the old image loads the key but does not prove the new flag guards are
present. After import AND a separately approved staging-only refresh, the operator
can use this sequence. Stop on any failure. Do not run against 4craft-beta.

```powershell
$ErrorActionPreference = 'Stop'
$Topa = 'C:\web-app\4-craft.com'
$Stage = @('--project-directory', $Topa, '--env-file', "$Topa\.env.mpp-staging", '-f', "$Topa\docker-compose.mpp-staging.yml")
docker compose @Stage config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Staging config invalid' }
docker compose @Stage build api
if ($LASTEXITCODE -ne 0) { throw 'Staging API build failed' }
# Dedicated staging initializer refuses production and any other database name.
docker compose @Stage run --rm --no-deps api python -m app.scripts.prepare_mpp_staging
if ($LASTEXITCODE -ne 0) { throw 'Staging schema preparation failed' }
docker compose @Stage up -d --no-deps --no-build api
if ($LASTEXITCODE -ne 0) { throw 'Staging API refresh failed' }
docker compose @Stage exec -T api python -c "from app.core.config import get_settings; print(bool(get_settings().mpp_project_api_key))"
Invoke-WebRequest 'http://localhost:8004/health/ready' -TimeoutSec 15
```

These commands update ONLY the existing staging API/image and dedicated staging
schema, not production, Web, Tunnel or database container/volume. Do not add down,
-v, --remove-orphans, a production compose file, or production project override.
If only loading the key into an already verified current image, the build/schema
steps can be omitted; the current observed old image does not satisfy that condition.
None of this refresh sequence was executed in this task.

## 6. Prepare A Real 199 THB Staging Transaction

The claim that the key belongs to merchant topamath is operator-provided, not yet
verified by a response. Key presence/length does not prove environment, project,
merchant ownership, permissions, units or payment success. Never reuse a production
key at a staging host without confirming its allowed scope.

Required BEFORE creation:
1. Confirm the intended staging hosts are reachable and official:
   https://staging-api.mmerchant.cc/api/v1 and https://staging-pay.mmerchant.cc.
   Earlier checks failed; do not silently switch to the different mmerchat.cc host.
2. Confirm this EXISTING key is valid for the intended TOPA staging project/merchant
   with payment-create permission. No new key or rotation is required by this guide.
3. Obtain exact merchant.display_name and project.name from trusted configuration;
   set MPP_EXPECTED_MERCHANT_NAME and MPP_EXPECTED_PROJECT_NAME privately. Do not
   assume merchant slug topamath equals display name or the project name.
4. Vendor must confirm integer satang; only then set MPP_AMOUNT_UNIT=minor. TH
   Founder DB price must be 19900 / THB / 30 days. Backend ignores frontend amount.
5. In ONLY the staging env, explicitly set MPP_CHECKOUT_ENABLED=true. Keep
   PAYMENT_GATEWAY_DEFAULT=stripe. Use a session for an existing authorized TOPA
   admin, or set MPP_CHECKOUT_TEST_USER_IDS to approved TOPA user IDs. A merchant
   account/key is not itself a TOPA login or admin authorization.
6. Load those settings into the current staging API as described above. Production
   Stripe defaults are not changed. Keep webhook confirmation blocked until the
   official signing/success contract and approved test simulator are available.

Use authenticated TOPA session cookies; do NOT place the MPP key into a browser,
Authorization header to TOPA, or client JavaScript. From a logged-in authorized
TOPA browser, a future explicit checkout request is:

```javascript
const response = await fetch('http://localhost:8004/billing/mpp/checkout', {
  method: 'POST', credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ plan_code: 'th_founder_monthly' })
});
const result = await response.json();
console.log({ status: response.status, provider: result.provider,
  amount_minor: result.amount_minor, currency: result.currency,
  error_code: result.detail?.code });
```

The backend creates a real staging transaction using the imported key and its
persisted order/key. Validate the returned amount 19900, THB and exact expected
merchant/project before opening the returned payment URL. It must be the actual
MPP response URL at the approved host, never a synthesized URL. Do not log the
full response/session URL or its capability token. Retry an ambiguous attempt
through its original MPP order/key; do not create a second gateway payment.

Do not confirm/transfer real money or withdraw. Use ONLY the vendor-authorized
staging test mechanism after its contract is verified. A transaction creation or
hosted QR is not a successful payment or a Plus activation. This task has NOT
created a transaction, validated the key with MPP, received a webhook or passed E2E.

**STOP: operator imports the existing key themselves first. No import, container
refresh, schema preparation or payment creation has been executed by this guide.**
