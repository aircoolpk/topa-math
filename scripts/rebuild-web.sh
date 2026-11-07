#!/usr/bin/env bash
# TOPA Math — Rebuild + Restart 4craft-web after editing source code
# ใช้เมื่อแก้ไฟล์ .tsx, .ts ใน apps/web/src/ แล้วอยากเห็นผลบน topamath.com
#
# วิธีรัน (ใน WSL หรือ PowerShell):
#   cd /mnt/c/web-app/4-craft.com
#   bash scripts/rebuild-web.sh
#
# ใช้เวลา: 5-15 นาที (ขึ้นกับ cache)

set -e

cd "$(dirname "$0")/.."

echo "=== 1. Lint check (จับ TS error ก่อน build) ==="
cd apps/web
npm run lint 2>&1 | tail -20 || {
  echo "❌ Lint failed — แก้ error ก่อน build"
  exit 1
}
cd ../..

echo ""
echo "=== 2. Rebuild 4craft-web image ==="
docker compose -f docker-compose.beta.yml build 4craft-web 2>&1 | tail -30

echo ""
echo "=== 3. Restart container ==="
docker compose -f docker-compose.beta.yml up -d 4craft-web

echo ""
echo "=== 4. Wait for ready ==="
for i in {1..30}; do
  if curl -sf http://127.0.0.1:3000 > /dev/null 2>&1; then
    echo "✅ Ready after ${i}s"
    break
  fi
  sleep 1
done

echo ""
echo "=== 5. Verify topamath.com ==="
curl -s -o /dev/null -w "topamath.com HTTP %{http_code} | size %{size_download} bytes\n" https://topamath.com/ --max-time 15

echo ""
echo "=== Done! ==="
echo "เปิด browser: https://topamath.com/"
echo "ถ้ายังเห็น mock arrays เก่า: hard refresh (Ctrl+Shift+R)"