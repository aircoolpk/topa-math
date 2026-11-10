@echo off
REM Topa Math — Cloudflare Tunnel connector (native, no Docker).
REM The tunnel forwards api.topamath.com to http://127.0.0.1:8001, where the
REM FastAPI service runs against Neon.
setlocal
set "LOG=%LOCALAPPDATA%\TopaMath\tunnel.log"
if not exist "%LOCALAPPDATA%\TopaMath" mkdir "%LOCALAPPDATA%\TopaMath"
"C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel run 1799d3bf-feea-4e29-b181-d2ec36fca46e >> "%LOG%" 2>&1
