# Docker + Cloudflare Tunnel Setup

This guide extends the Docker Desktop beta stack (`docker-compose.beta.yml`) with a Cloudflare Tunnel so the app is accessible from the internet after a Windows reboot — without needing to run cloudflared manually or expose host ports.

## Prerequisites

- Docker Desktop for Windows is installed and set to start on login (Settings → General → "Start Docker Desktop when you sign in").
- A Cloudflare Zero Trust account with a configured tunnel (see below).
- The `.env.docker` file is present in the project root (copy from `.env.docker.example`).

---

## How to Get the Cloudflare Tunnel Token

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Zero Trust** (or **Access** → **Tunnels**).
2. Create a new **Cloudflare Tunnel** (formerly named "argo tunnel").
3. Name it something like `4craft-beta`.
4. In **Public Hostname**, add a record:
   - **Subdomain**: `topamath.com` (or leave blank for root)
   - **Domain**: `topamath.com`
   - **Type**: `HTTP`
   - **URL**: `web:3000` — the Docker Compose service name + internal port
5. Save the tunnel.
6. On the tunnel's **Overview** page, click **Retrieval Setup** → copy the **Token** (looks like `eyJhIjoi...`).
7. Paste the token into `.env.docker` as `CLOUDFLARE_TUNNEL_TOKEN=eyJhIjoi...`.

> The public hostname must point to the service name as known inside the Docker network, not `localhost`. Use `web:3000` (the `4craft-web` service's internal port).

---

## Cloudflare Public Hostname Configuration

| Field | Value |
|---|---|
| Subdomain | `topamath.com` (or `beta`) |
| Domain | Your registered domain |
| Type | HTTP |
| URL | `web:3000` |

The tunnel container (`4craft-cloudflared`) routes traffic from Cloudflare's edge to the `web` service inside Docker's network on port 3000.

---

## Start the Stack

From `C:\web-app\4-craft.com` in PowerShell or Windows Terminal:

```powershell
docker compose --env-file .env.docker -f docker-compose.beta.yml up -d --build
```

Docker Desktop will now start all five containers automatically on reboot.

---

## Check Status

```powershell
docker compose -f docker-compose.beta.yml ps
```

Expected running containers:

| Container | Image | Purpose |
|---|---|---|
| `4craft-web` | Next.js | Frontend |
| `4craft-api` | FastAPI | Backend API |
| `4craft-postgres` | postgres:16-alpine | Database |
| `4craft-redis` | redis:7-alpine | Cache/Sessions |
| `4craft-cloudflared` | cloudflare/cloudflared | Tunnel to Cloudflare |

---

## View Tunnel Logs

```powershell
docker compose -f docker-compose.beta.yml logs -f cloudflared
```

To see only the last 50 lines:

```powershell
docker compose -f docker-compose.beta.yml logs --tail=50 cloudflared
```

---

## Restart the Tunnel

```powershell
docker compose -f docker-compose.beta.yml restart cloudflared
```

Or recreate it without touching the other services:

```powershell
docker compose -f docker-compose.beta.yml up -d cloudflared
```

---

## Expected Containers After Reboot

After a Windows restart with Docker Desktop set to auto-start:

```
4craft-web        running   Next.js frontend on :3000
4craft-api        running   FastAPI backend on :8001
4craft-postgres   running   PostgreSQL 16 on :5432
4craft-redis      running   Redis 7 on :6379
4craft-cloudflared running  Cloudflare Tunnel (no host port)
```

All services have `restart: unless-stopped`, so Docker Desktop will bring them back up automatically.

---

## Verify the Tunnel is Routing

From a browser on a network other than localhost:

```
https://topamath.com
```

or

```
https://beta.topamath.com
```

You should see the 4-craft / TOPA Math frontend. If you see a Cloudflare error page, check:

1. The tunnel token is correct in `.env.docker`.
2. The tunnel container logs: `docker compose -f docker-compose.beta.yml logs cloudflared`
3. The `web` service is healthy: `docker compose -f docker-compose.beta.yml ps`

---

## Restart Everything After a Reboot

```powershell
# In PowerShell — start Docker Desktop first, then:
Start-Sleep -Seconds 10  # wait for Docker to fully initialize
docker compose --env-file .env.docker -f docker-compose.beta.yml up -d
```

Set Docker Desktop to auto-start: open Docker Desktop → **Settings** → **General** → check **Start Docker Desktop when you sign in**.

---

## Troubleshooting

### Tunnel shows `Connection refused`
The `web` container is not ready yet. Make sure `depends_on` with `condition: service_healthy` is respected — the web service has a health check. If the issue persists, check web logs:
```powershell
docker compose -f docker-compose.beta.yml logs web
```

### 502 Bad Gateway
The tunnel can reach Cloudflare but not the `web` container. Verify the public hostname URL is exactly `web:3000` (not `localhost:3000` or `127.0.0.1:3000`).

### Token is rejected
Make sure the token is pasted exactly as shown in the Cloudflare Zero Trust dashboard — do not add extra whitespace or line breaks. Store it only in `.env.docker`, never hardcode it in `docker-compose.beta.yml`.

### Cannot access from browser
Make sure your Cloudflare DNS A/CNAME record for `topamath.com` points to the Cloudflare tunnel address (the tunnel handles routing — you do not need a separate A record for the origin server; Cloudflare proxy handles it).