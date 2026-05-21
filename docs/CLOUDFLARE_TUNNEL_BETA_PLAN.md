# Cloudflare Tunnel Closed Beta Plan

Date: 2026-05-13

This plan exposes the local 4-Craft frontend and backend to a small closed Beta tester group through Cloudflare Tunnel. This is not a public production deployment.

## Beta URLs

- Frontend: `https://beta.4-craft.com`
- Backend API: `https://api-beta.4-craft.com`

Local targets:

- Frontend: `http://localhost:3000`
- Backend: `http://127.0.0.1:8001`

## 1. Required Cloudflare Account And Domain Setup

Prerequisites:

- The `4-craft.com` domain must be active in the Cloudflare account.
- Cloudflare nameservers for `4-craft.com` must be configured at the registrar.
- The operator must have permission to create tunnels and DNS records in Cloudflare Zero Trust.
- `cloudflared` must be installed on the local Windows machine that will host the closed Beta.
- The local machine must stay powered on and connected to the internet while Beta access is open.

Recommended Cloudflare settings:

- Use Cloudflare Zero Trust Tunnel, not direct router port forwarding.
- Keep proxying enabled for `beta.4-craft.com` and `api-beta.4-craft.com`.
- Consider Cloudflare Access in front of both hostnames if testers can sign in with allowlisted email addresses.
- Do not point apex `4-craft.com` or `www.4-craft.com` at the local Beta tunnel.

## 2. Tunnel Routing

Create one named tunnel, for example:

```powershell
cloudflared tunnel login
cloudflared tunnel create 4-craft-closed-beta
```

Create DNS routes:

```powershell
cloudflared tunnel route dns 4-craft-closed-beta beta.4-craft.com
cloudflared tunnel route dns 4-craft-closed-beta api-beta.4-craft.com
```

Example `cloudflared` config file:

Path:

```text
C:\Users\<YOUR_WINDOWS_USER>\.cloudflared\config.yml
```

Config:

```yaml
tunnel: 4-craft-closed-beta
credentials-file: C:\Users\<YOUR_WINDOWS_USER>\.cloudflared\<TUNNEL_ID>.json

ingress:
  - hostname: beta.4-craft.com
    service: http://localhost:3000
  - hostname: api-beta.4-craft.com
    service: http://127.0.0.1:8001
  - service: http_status:404
```

Expected routing:

- `beta.4-craft.com` -> `http://localhost:3000`
- `api-beta.4-craft.com` -> `http://127.0.0.1:8001`

## 3. Required Frontend Env

Set the frontend API URL to the tunnel API hostname before starting the frontend:

Path:

```text
C:\web-app\4-craft.com\apps\web\.env.local
```

Required value:

```env
NEXT_PUBLIC_API_BASE_URL=https://api-beta.4-craft.com
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
```

Keep Stripe publishable keys in test mode only. Do not use live Stripe keys for closed Beta.

## 4. Required Backend CORS

Allow the Beta frontend origin in the backend env:

Path:

```text
C:\web-app\4-craft.com\apps\api\.env
```

Required values:

```env
ENVIRONMENT=local
CORS_ORIGINS=http://127.0.0.1:3000,http://localhost:3000,https://beta.4-craft.com
FRONTEND_BASE_URL=https://beta.4-craft.com
BACKEND_BASE_URL=https://api-beta.4-craft.com
```

Keep Stripe backend keys in test mode only:

```env
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

Restart the backend after changing CORS/env values.

## 5. How To Start Backend

Use the current SSD/NVMe project path only:

```powershell
cd C:\web-app\4-craft.com\apps\api
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

Health check:

```powershell
Invoke-RestMethod http://127.0.0.1:8001/health
```

Expected:

```json
{"status":"ok"}
```

## 6. How To Start Frontend

For closed Beta, use the normal local frontend server after setting `NEXT_PUBLIC_API_BASE_URL`:

```powershell
cd C:\web-app\4-craft.com\apps\web
npm run dev
```

Local check:

```powershell
Invoke-WebRequest http://localhost:3000
```

## 7. How To Start Cloudflared Tunnel

After backend and frontend are running locally:

```powershell
cloudflared tunnel run 4-craft-closed-beta
```

Keep this terminal open during Beta access, unless `cloudflared` is installed as a Windows service.

Optional service approach:

```powershell
cloudflared service install
```

Only use the service approach after manually confirming the tunnel works.

## 8. How To Keep Machine Awake

Closed Beta access depends on this local machine staying awake.

Recommended Windows settings:

- Plug in power.
- Set sleep to `Never` during the Beta window.
- Disable hibernation during the Beta window if it interrupts long-running processes.
- Keep Wi-Fi or Ethernet stable.
- Avoid Windows Update restarts during scheduled tester sessions.

Useful command for the current power plan:

```powershell
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
```

Restore normal sleep settings after Beta testing ends.

## 9. How To Stop Beta Access Quickly

Fastest local stop:

- Stop the `cloudflared tunnel run` terminal with `Ctrl+C`.

Other quick-stop options:

- Stop frontend: close the frontend terminal or stop the Node process.
- Stop backend: close the Uvicorn terminal or stop the Python process.
- In Cloudflare Zero Trust, disable or delete the tunnel.
- In Cloudflare DNS, remove `beta.4-craft.com` and `api-beta.4-craft.com` tunnel routes.
- If using Cloudflare Access, remove tester allowlist entries.

Emergency preference:

1. Stop `cloudflared`.
2. Confirm `https://beta.4-craft.com` no longer loads externally.
3. Stop backend/frontend if needed.

## 10. Post-Tunnel Test Checklist

Local checks before external testing:

- `http://127.0.0.1:8001/health` returns `{"status":"ok"}`.
- `http://localhost:3000` loads.
- `NEXT_PUBLIC_API_BASE_URL` is `https://api-beta.4-craft.com`.
- Backend `CORS_ORIGINS` includes `https://beta.4-craft.com`.

Tunnel checks:

- `https://api-beta.4-craft.com/health` returns `{"status":"ok"}`.
- `https://beta.4-craft.com` loads.
- `/register` loads.
- `/login` loads.
- Register or log in with a Beta test account.
- `/dashboard` loads after login.
- `/lessons` loads.
- At least three Grade 1-3 lessons open and show lesson content.
- Grade 4, Grade 5, and Grade 6 lesson areas show Coming Soon or no clickable lesson links.
- Direct Grade 4/5/6 lesson URLs do not expose empty lesson pages.
- Grade 3 test flow starts and answer submission returns feedback.
- Browser DevTools Network tab shows API requests going to `https://api-beta.4-craft.com`.
- No CORS errors appear in the browser console.

External tester checks:

- Test from a phone on mobile data, not the host machine network.
- Test from a separate laptop/browser profile.
- Confirm only invited testers can access if Cloudflare Access is enabled.

## 11. Security Warnings

- Do not enable Stripe live mode.
- Use Stripe test keys only: `pk_test_*`, `sk_test_*`, and test `price_*` values.
- Keep the tester group small and known.
- Do not run public ads or post the Beta URL publicly.
- Do not use sensitive production data.
- Keep admin account credentials private.
- Do not share admin routes with testers.
- Rotate any exposed test passwords after the Beta window.
- Monitor logs during tester sessions.
- Stop the tunnel immediately if suspicious traffic appears.

## Closed Beta Operating Notes

- This setup is suitable for limited Beta validation, not production reliability.
- The local machine is a single point of failure.
- Performance depends on local machine, network, and Cloudflare Tunnel connectivity.
- Before any broader launch, move to a proper hosted staging/production environment with managed secrets, database backups, monitoring, and locked-down admin access.
