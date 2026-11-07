# TOPA Math — Rebuild + Restart 4craft-web after editing source code
# ใช้เมื่อแก้ไฟล์ .tsx, .ts ใน apps/web/src/ แล้วอยากเห็นผลบน topamath.com
#
# วิธีรัน (ใน PowerShell หรือ WSL):
#   cd "D:\web app\4-craft.com"
#   .\scripts\rebuild-web.ps1
#
# ใช้เวลา: 5-15 นาที (ขึ้นกับ cache)

$ErrorActionPreference = "Stop"

Set-Location (Split-Path -Parent $PSScriptRoot)

Write-Host "=== 1. Lint check (จับ TS error ก่อน build) ===" -ForegroundColor Cyan
Set-Location apps\web
npm run lint 2>&1 | Select-Object -Last 20
if ($LASTEXITCODE -ne 0) {
  Write-Host "❌ Lint failed — แก้ error ก่อน build" -ForegroundColor Red
  exit 1
}
Set-Location ..\..

Write-Host ""
Write-Host "=== 2. Rebuild 4craft-web image ===" -ForegroundColor Cyan
docker compose -f docker-compose.beta.yml build 4craft-web 2>&1 | Select-Object -Last 30
if ($LASTEXITCODE -ne 0) {
  Write-Host "❌ Build failed" -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "=== 3. Restart container ===" -ForegroundColor Cyan
docker compose -f docker-compose.beta.yml up -d 4craft-web

Write-Host ""
Write-Host "=== 4. Wait for ready ===" -ForegroundColor Cyan
for ($i = 1; $i -le 30; $i++) {
  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:3000" -UseBasicParsing -TimeoutSec 2
    if ($response.StatusCode -eq 200) {
      Write-Host "✅ Ready after ${i}s" -ForegroundColor Green
      break
    }
  } catch {
    Start-Sleep -Seconds 1
  }
}

Write-Host ""
Write-Host "=== 5. Verify topamath.com ===" -ForegroundColor Cyan
try {
  $topamath = Invoke-WebRequest -Uri "https://topamath.com/" -UseBasicParsing -TimeoutSec 15
  Write-Host "topamath.com HTTP $($topamath.StatusCode) | size $($topamath.RawContentLength) bytes"
} catch {
  Write-Host "⚠️ Cannot reach topamath.com: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Done! ===" -ForegroundColor Green
Write-Host "เปิด browser: https://topamath.com/"
Write-Host "ถ้ายังเห็น mock arrays เก่า: hard refresh (Ctrl+Shift+R)"