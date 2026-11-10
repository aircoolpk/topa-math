@echo off
REM Topa Math — FastAPI service (native, no Docker).
REM Runs against Neon; the connection strings live in .env.native next to this
REM repository, outside apps/api so the secrets are never baked into an image.
setlocal
cd /d "C:\web-app\4-craft.com"
if not exist "%LOCALAPPDATA%\TopaMath" mkdir "%LOCALAPPDATA%\TopaMath"
"C:\web-app\4-craft.com\apps\api\.venv\Scripts\pythonw.exe" "C:\web-app\4-craft.com\scripts\run_api_native.py" >> "%LOCALAPPDATA%\TopaMath\api.log" 2>&1
