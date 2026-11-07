# Homepage Feature Cards Reference Asset Fix Report

## ขอบเขต

แก้เฉพาะ section การ์ด 4 ใบใต้ hero บน homepage ของ TOPA Math ให้ใช้ภาพจาก reference ล่าสุดโดยตรง

## Source Reference

- `C:/Users/airco/OneDrive/Pictures/Screenshots/Screenshot 2026-06-03 233256.png`
- ขนาดต้นฉบับ: `974x165`

## New Assets

สร้าง asset ใหม่จากการ slice/crop reference และ normalize canvas เป็น `250x165` เพื่อให้การ์ดทั้ง 4 ใบแสดงขนาดเท่ากันบน desktop:

- `apps/web/public/brand/topa/feature-reference/feature-card-ai-reference-v2.png`
- `apps/web/public/brand/topa/feature-reference/feature-card-practice-reference-v2.png`
- `apps/web/public/brand/topa/feature-reference/feature-card-xp-reference-v2.png`
- `apps/web/public/brand/topa/feature-reference/feature-card-ranking-reference-v2.png`

## Files Changed

- `apps/web/src/app/page.tsx`
- `apps/web/public/brand/topa/feature-reference/feature-card-ai-reference-v2.png`
- `apps/web/public/brand/topa/feature-reference/feature-card-practice-reference-v2.png`
- `apps/web/public/brand/topa/feature-reference/feature-card-xp-reference-v2.png`
- `apps/web/public/brand/topa/feature-reference/feature-card-ranking-reference-v2.png`
- `docs/HOMEPAGE_FEATURE_CARDS_REFERENCE_ASSET_FIX_REPORT.md`

## Implementation

- เปลี่ยน `featureCards` ให้ชี้ไปที่ reference asset ทั้ง 4 ใบ
- เปลี่ยน renderer ของ section นี้ให้ render ภาพการ์ดเต็มใบโดยตรง
- ไม่ใช้ mascot เดิมจากโปรเจกต์มาประกอบใหม่ใน section นี้
- fallback ของแต่ละการ์ดชี้กลับไปที่ reference asset เดียวกัน
- คง responsive grid เดิม: mobile 1 คอลัมน์, tablet 2 คอลัมน์, desktop 4 คอลัมน์

หมายเหตุ: path mascot เดิมที่ยังพบใน `apps/web/src/app/page.tsx` เป็นของ section อื่น เช่น ranking table, mascot friends และ CTA banner ไม่ใช่ feature cards section นี้

## Validation

- `npm run lint` ผ่าน
- `npm run build` ผ่าน
- `docker compose --env-file .env.docker -f docker-compose.beta.yml build 4craft-web` ผ่าน
- `docker compose --env-file .env.docker -f docker-compose.beta.yml up -d` ผ่าน
- `4craft-web` สถานะ `healthy`

หมายเหตุ: build ยังแสดง warning เดิมของ Next.js เรื่อง ESLint option ที่ถูกถอดออก แต่ไม่ทำให้ build ล้ม

## Browser QA

ตรวจ `https://topamath.com/` แล้ว:

- พบ feature cards ครบ 4 ใบ
- ทุกใบโหลดจาก `/brand/topa/feature-reference/*-v2.png`
- ทุกใบมี natural size `250x165`
- ทุกใบ render บน desktop ขนาด `289x191`
- ใช้ `object-fit: contain`
- ไม่มี broken image
- ไม่มี horizontal overflow
- section นี้ไม่โหลด mascot asset เดิมเป็นภาพหลักอีกแล้ว

## Final Decision

`READY_HOMEPAGE_FEATURE_CARDS_REFERENCE_ASSET_FIX`
