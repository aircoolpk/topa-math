# Cutover: api.topamath.com → API Worker

Target state: the frontend (OpenNext Worker) and the API (Hono Worker) both
run on Cloudflare, the database is Neon, and the machine runs nothing.

## Current state

```
browser → Cloudflare Worker (topa-math)      → topamath.com
        → Cloudflare Tunnel (topamath-beta)   → api.topamath.com
        → 127.0.0.1:8001 (native FastAPI)     → Neon
```

The tunnel is only a way in. Everything behind it already runs against
Neon, so the cutover replaces the origin, not the data.

## Preconditions

1. `node scripts/parity-check.mjs --worker <worker-url>` reports every path
   identical. The harness requests both services with the same session and
   compares the JSON bodies field by field, ignoring only volatile
   timestamps.
2. The Worker tests pass (`cd apps/api-ts && npx vitest run`).
3. The Worker is deployed with the Neon secrets.

## Steps

1. **Add the route** to `apps/api-ts/wrangler.toml`:

   ```toml
   routes = [
     { pattern = "api.topamath.com", custom_domain = true },
   ]
   ```

   A custom domain makes Cloudflare own the DNS record and overrides the
   tunnel's CNAME. If the token lacks the Workers Routes permission, use a
   plain route (`{ pattern = "api.topamath.com/*" }`) and delete the tunnel's
   DNS record.

2. **Deploy** through the GitHub workflow (`.github/workflows/deploy-api.yml`).
   The workflow also sets the Worker secrets and verifies `/health/ready`.

3. **Verify** from outside:

   ```bash
   curl -s https://api.topamath.com/health
   curl -s -X POST https://api.topamath.com/auth/login \
     -H 'Content-Type: application/json' \
     -d '{"email":"demo@4-craft.com","password":"demo1234"}'
   node scripts/parity-check.mjs --worker https://topa-math-api.<subdomain>.workers.dev
   ```

   Then load https://topamath.com/login in a browser and walk the pages.

4. **Stop the native FastAPI** and remove the autostart entry:
   delete `TopaMath.vbs` from the Startup folder and kill the process.

5. **Retire the tunnel.** Stop `cloudflared` and remove its Startup entry.
   The tunnel configuration can stay as a record, or be deleted through the
   Cloudflare API.

## Rollback

The tunnel is still in place until step 5, so the rollback is one step:

1. Remove the `routes` entry from `apps/api-ts/wrangler.toml` and deploy
   again, or restore the tunnel ingress to
   `{"ingress":[{"service":"http://127.0.0.1:8001","hostname":"api.topamath.com"},{"service":"http_status:404"}]}`.
2. Restart the native FastAPI (`scripts/run_api_native.cmd`) and the tunnel
   (`scripts/run_tunnel_native.cmd`).

The data is unaffected either way: both services read the same Neon
database.

## Notes

- The Worker reads the lesson content from the database. The legacy service
  read it from JSON files on disk. The content in Neon was copied from
  those files, so the responses match; if the lesson files change, the
  content sync has to run before the Worker sees the update.
- The profile photos were served from the filesystem by the legacy service.
  The Worker stores them in the database or in R2; the parity harness
  covers the avatar routes.
