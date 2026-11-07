# Homepage Feature Cards Image Cleanup Report

## ขอบเขต

แก้เฉพาะ section การ์ด feature 4 ใบใต้ hero บนหน้าแรก TOPA Math

## เงื่อนไขล่าสุด

ต้องใช้ 4 รูปจาก reference ล่าสุดเท่านั้น ห้ามใช้ mascot asset เดิมหรือรูปอื่นแทน

Source reference:

- `C:/Users/airco/OneDrive/Pictures/Screenshots/Screenshot 2026-06-04 010014.png`
- ขนาดต้นฉบับ: `1665x299`

## New Assets

สร้าง asset ใหม่โดย crop จาก reference ล่าสุด, ตัดขอบนอกให้แน่นขึ้น, normalize canvas ให้สม่ำเสมอ และ upscale/sharpen เล็กน้อยเพื่อให้คมขึ้นเมื่อแสดงบนเว็บ:

- `apps/web/public/brand/topa/feature-reference/feature-card-ai-clean-v3.png`
- `apps/web/public/brand/topa/feature-reference/feature-card-practice-clean-v3.png`
- `apps/web/public/brand/topa/feature-reference/feature-card-xp-clean-v3.png`
- `apps/web/public/brand/topa/feature-reference/feature-card-ranking-clean-v3.png`

ทุกไฟล์มีขนาด `720x472`

## Files Changed

- `apps/web/src/app/page.tsx`
- `apps/web/public/brand/topa/feature-reference/feature-card-ai-clean-v3.png`
- `apps/web/public/brand/topa/feature-reference/feature-card-practice-clean-v3.png`
- `apps/web/public/brand/topa/feature-reference/feature-card-xp-clean-v3.png`
- `apps/web/public/brand/topa/feature-reference/feature-card-ranking-clean-v3.png`
- `docs/HOMEPAGE_FEATURE_CARDS_IMAGE_CLEANUP_REPORT.md`

## Implementation

- `featureCards` ชี้ไปที่ asset `clean-v3` ทั้ง 4 ใบ
- renderer ของ section นี้แสดงภาพการ์ดเต็มใบโดยตรง
- fallback ของแต่ละการ์ดชี้กลับไปที่ภาพเดียวกัน
- ไม่ใช้ `mascot-topa-feature.png`, `mascot-pip-feature.png`, `mascot-riko-feature.png`, หรือ `mascot-olli-feature.png` ใน feature cards section นี้
- คง responsive grid เดิม: mobile 1 คอลัมน์, tablet 2 คอลัมน์, desktop 4 คอลัมน์

## Hermes / Asset Repair

ไม่ต้องส่ง Hermes เพิ่มในรอบนี้ เพราะใช้ภาพ reference ล่าสุดตามที่กำหนดโดยตรง และปรับด้วย crop/upscale/sharpen ภายในโปรเจกต์แล้ว

## Validation

- `npm run lint` ผ่าน
- `npm run build` ผ่าน
- `docker compose --env-file .env.docker -f docker-compose.beta.yml build 4craft-web` ผ่าน
- `docker compose --env-file .env.docker -f docker-compose.beta.yml up -d` ผ่าน

หมายเหตุ: build ยังแสดง warning เดิมของ Next.js เรื่อง ESLint option ที่ถูกถอดออก แต่ไม่ทำให้ build ล้ม

## Browser QA

ตรวจ `https://topamath.com/` แล้ว:

- feature cards แสดงครบ 4 ใบ
- ทุกใบโหลดจาก `/brand/topa/feature-reference/*clean-v3.png`
- ทุกใบมี natural size `720x472`
- ทุกใบ render บน desktop เท่ากันประมาณ `289x189`
- ใช้ `object-fit: contain`
- ไม่มี broken image
- ไม่มี horizontal overflow
- section นี้ไม่โหลด mascot asset เดิมเป็นภาพหลักอีกแล้ว

## Final Decision

`READY_HOMEPAGE_FEATURE_CARDS_IMAGE_CLEANUP`
