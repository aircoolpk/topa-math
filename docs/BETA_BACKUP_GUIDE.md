# Closed Beta Local Backup Guide

This guide covers safe local backups for 4-Craft closed Beta operation.

Project path:

```text
C:\web-app\4-craft.com
```

Backup output:

```text
C:\web-app\4-craft-backups\4-craft-beta-yyyyMMdd-HHmmss.zip
```

## What The Backup Includes

The script includes the operational files needed to recover the local Beta code/content state:

- `apps/api/app`
- `apps/api/app/content/math`
- `apps/api/alembic` if present
- `apps/web/src`
- `docs`
- `scripts/backup-beta.ps1`
- Root package/docs files: `package.json`, `README.md`, `AGENTS.md`, `.gitignore`
- Backend package/config files: `apps/api/pyproject.toml`, `apps/api/alembic.ini`, `apps/api/Dockerfile`
- Frontend package/config files: `apps/web/package.json`, `apps/web/package-lock.json`, `apps/web/next.config.js`, `apps/web/postcss.config.js`, `apps/web/tailwind.config.ts`, `apps/web/tsconfig.json`, `apps/web/README.md`
- Infra config: `infra/docker-compose.yml`

Local database:

- `apps/api/adaptive_learning.db` is included only when explicitly requested with `-IncludeLocalDatabase`.
- Use that option only when the database contains safe local Beta/test data and no sensitive production data.

## What Is Excluded

The script excludes:

- `node_modules`
- `.next`
- `.venv`
- `__pycache__`
- `.pytest_cache`, `.mypy_cache`, `.ruff_cache`
- `logs`
- `cache`
- `.env`
- `.env.*`
- `*.log`
- `*.tmp`, `*.temp`
- `*.cache`
- `*.pyc`, `*.pyo`
- `tsconfig.tsbuildinfo`
- temporary files matching `temp_*`

Secrets are intentionally excluded. Do not manually add `.env` files to a backup zip.

## How To Run Backup

Run a normal code/content backup:

```powershell
cd C:\web-app\4-craft.com
powershell -ExecutionPolicy Bypass -File .\scripts\backup-beta.ps1
```

Run a backup that explicitly includes the local SQLite database:

```powershell
cd C:\web-app\4-craft.com
powershell -ExecutionPolicy Bypass -File .\scripts\backup-beta.ps1 -IncludeLocalDatabase
```

After the script finishes, confirm the zip exists:

```powershell
Get-ChildItem C:\web-app\4-craft-backups\4-craft-beta-*.zip | Sort-Object LastWriteTime -Descending | Select-Object -First 5
```

## When To Backup

Create a backup:

- Before opening Cloudflare Tunnel access to Beta testers.
- Before editing lesson content.
- Before changing auth, billing, CORS, or tunnel configuration.
- Before importing or regenerating questions/lessons.
- After a successful Beta test session with useful content/data changes.
- Before Windows updates or machine maintenance.

Recommended minimum rhythm during closed Beta:

- One backup before each tester session.
- One backup after each tester session if local content or database state changed.

## How To Restore Backup

1. Stop the frontend, backend, and Cloudflare Tunnel.

2. Create a safety copy of the current project folder before overwriting anything:

```powershell
Copy-Item -LiteralPath C:\web-app\4-craft.com -Destination C:\web-app\4-craft.com-before-restore -Recurse
```

3. Extract the backup zip to a temporary restore folder:

```powershell
$zip = "C:\web-app\4-craft-backups\4-craft-beta-yyyyMMdd-HHmmss.zip"
$restore = "C:\web-app\restore-4-craft-beta"
Remove-Item -LiteralPath $restore -Recurse -Force -ErrorAction SilentlyContinue
Expand-Archive -LiteralPath $zip -DestinationPath $restore
```

4. Copy restored files back into the project:

```powershell
Copy-Item -LiteralPath "$restore\*" -Destination C:\web-app\4-craft.com -Recurse -Force
```

5. Recreate local secret env files manually from your secure notes or password manager. Backups do not contain `.env` or `.env.*`.

6. Reinstall dependencies if needed:

```powershell
cd C:\web-app\4-craft.com\apps\web
npm install
```

7. Start backend and frontend, then run smoke checks:

```powershell
cd C:\web-app\4-craft.com\apps\api
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

```powershell
cd C:\web-app\4-craft.com\apps\web
npm run dev
```

Check:

- `http://127.0.0.1:8001/health`
- `http://localhost:3000`
- `/login`
- `/dashboard`
- `/lessons`
- one known Grade 1-3 lesson
- one Grade 3 test flow

## Safety Notes

- Do not store backup zips in a public shared folder.
- Treat backups with `-IncludeLocalDatabase` as private, because they may contain Beta tester accounts or activity.
- Do not email backup zips.
- Do not upload backups to public file-sharing links.
- Keep at least the latest two known-good backups before deleting older ones.
- If a backup may contain tester data, delete it securely when no longer needed.
