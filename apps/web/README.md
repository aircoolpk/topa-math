# 4-Craft Frontend

Next.js App Router frontend for the 4-Craft Adaptive Learning SaaS.

## Quick Start (Windows PowerShell)

### 1. Start Backend (FastAPI — port 8001)

```powershell
cd "D:\web app\4-craft.com\apps\api"
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```

### 2. Start Frontend (Next.js — port 3000)

```powershell
cd "D:\web app\4-craft.com\apps\web"
npm install
npm run dev
```

### 3. Open in Browser

| App | URL |
|-----|-----|
| **Frontend** | http://127.0.0.1:3000 |
| **Backend API** | http://127.0.0.1:8001 |
| **Backend Docs (Swagger)** | http://127.0.0.1:8001/docs |
| **Backend Health** | http://127.0.0.1:8001/health |

## Ports Summary

| Service | Port | Purpose |
|---------|------|---------|
| Frontend (Next.js) | 3000 | Web UI, pages, API proxy |
| Backend (FastAPI) | 8001 | REST API, auth, quiz, rankings |

## Environment Variables

Frontend reads from `apps/web/.env.local`:

```
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8001
```

## Available Scripts

```powershell
cd "D:\web app\4-craft.com\apps\web"
npm run dev    # Start dev server on port 3000
npm run build  # Production build
npm run lint   # TypeScript check only
npm start      # Start production server on port 3000
```

## Frontend Routes

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/register` | Parent registration (2-step) |
| `/login` | Parent login |
| `/dashboard` | Parent dashboard — manage children |
| `/children/[childId]` | Child game dashboard |
| `/children/[childId]/placement` | Placement test |
| `/children/[childId]/quiz/[sessionId]` | Quiz session |
| `/children/[childId]/result/[sessionId]` | Quiz result |
| `/children/[childId]/rankings` | Province/country rankings |
| `/children/[childId]/avatar` | Avatar editor |
| `/admin/generated-content` | Admin generated content |

## API Proxy

Next.js proxies `/auth/*`, `/children/*`, `/quiz-sessions/*`, `/skills`, `/rankings`, `/avatar/*`, `/admin/*` to `http://127.0.0.1:8001`.

Frontend pages (e.g. `/`, `/login`, `/register`) are served directly by Next.js — they are NOT proxied.
