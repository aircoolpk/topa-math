# 4-craft Adaptive Learning SaaS

MVP backend-first scaffold for a Thai elementary math adaptive learning platform.

## Stack

- API: FastAPI, SQLAlchemy, Pydantic
- DB: PostgreSQL in Docker, SQLite for local quick runs/tests
- Cache/queue ready: Redis
- Object storage ready: MinIO
- AI: MiniMax provider placeholder plus MockAIProvider for local development

## Windows PowerShell Setup

Run these commands from a Windows PowerShell terminal:

```powershell
cd "D:\web app\4-craft.com\apps\api"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[test]"
python -m app.seeds.seed
pytest
uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```

Root endpoint: http://127.0.0.1:8001/
API docs: http://127.0.0.1:8001/docs
Health check: http://127.0.0.1:8001/health

## Migrations

```powershell
cd "D:\web app\4-craft.com\apps\api"
alembic revision --autogenerate -m "initial schema"
alembic upgrade head
```

## Run Tests

```powershell
cd "D:\web app\4-craft.com\apps\api"
pytest
```

## Docker

```powershell
cd "D:\web app\4-craft.com\infra"
docker compose up --build
```

`docker-compose.yml` currently lives in `infra`, not at the project root.

## Seeded Admin

- Email: `admin@4-craft.local`
- Password: `admin12345`

## Troubleshooting

### Editable install says multiple top-level packages were discovered

Run the install command from the API folder:

```powershell
cd "D:\web app\4-craft.com\apps\api"
pip install -e ".[test]"
```

The package config intentionally installs only the `app` package. The `alembic` folder remains available for migrations but is not installed as a Python package.

### docker-compose.yml is missing at the project root

Use the compose file inside `infra`:

```powershell
cd "D:\web app\4-craft.com\infra"
docker compose up --build
```

### Activate.ps1 is blocked by PowerShell execution policy

For the current terminal session only, run:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
.\.venv\Scripts\Activate.ps1
```

### Port 8001 is already in use

Check which process owns the port:

```powershell
Get-NetTCPConnection -LocalPort 8001 -State Listen | Select-Object LocalAddress,LocalPort,OwningProcess
```

If it is another local service, stop that service first. For a quick local check, use another free port:

```powershell
uvicorn app.main:app --reload --host 127.0.0.1 --port 8002
```

---

## Frontend (apps/web)

Child-friendly Thai adaptive learning MVP frontend built with Next.js App Router, TypeScript, and Tailwind CSS.

### Architecture

**Frontend (Next.js) → http://127.0.0.1:8001/**
- Serves all pages and static assets
- Proxies API calls to the FastAPI backend via Next.js rewrites

**Backend (FastAPI) → http://127.0.0.1:8002/**
- All API endpoints live here
- Run separately on port 8002

### Backend Setup

```powershell
cd "D:\web app\4-craft.com\apps\api"
.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 127.0.0.1 --port 8002
```

### Frontend Setup

```powershell
cd "D:\web app\4-craft.com\apps\web"
npm install --legacy-peer-deps
npm run dev
```

Frontend: http://127.0.0.1:8001
API: http://127.0.0.1:8002/docs

### Build

```powershell
npm run build
```

### Pages

| Route | Description |
|-------|-------------|
| `/register` | Parent registration |
| `/login` | Parent login |
| `/dashboard` | Parent: list/create child profiles |
| `/children/[childId]` | Child dashboard: XP, level, streak, avatar preview |
| `/children/[childId]/placement` | Placement test flow |
| `/children/[childId]/quiz` | Quiz intro / start |
| `/children/[childId]/quiz/[sessionId]` | Active quiz with feedback |
| `/children/[childId]/result/[sessionId]` | Session result + XP earned |
| `/children/[childId]/rankings` | Province / country rankings |
| `/children/[childId]/avatar` | Avatar editor |
| `/admin/generated-content` | Admin: approve/reject AI content |

### Admin Login

- Email: `admin@4-craft.local`
- Password: `admin12345`
