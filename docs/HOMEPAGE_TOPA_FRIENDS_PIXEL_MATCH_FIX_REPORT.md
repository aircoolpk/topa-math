# HOMEPAGE TOPA FRIENDS PIXEL MATCH FIX REPORT

Date: 2026-06-04

## Scope

แก้เฉพาะ homepage section "เพื่อนช่วยเรียนของ TOPA" ใน `apps/web/src/app/page.tsx`

ไม่ได้แก้ dashboard / lessons / tests / admin / auth / Stripe หรือ section อื่นของ homepage

## What Changed

- เปลี่ยน mascot section ให้ใช้เฉพาะรูปที่มี alpha/transparent เท่านั้น
- ลบการใช้ screenshot crop แบบมีพื้นหลัง/กรอบสี่เหลี่ยมออกจาก section
- ปรับ section เป็นแถบฟ้าอ่อน ขอบมน border ฟ้าบาง และ shadow นุ่ม
- เพิ่ม math symbols จาง ๆ ด้านหลัง และจัดไม่ให้ชน title/mascot
- ปรับ desktop layout เป็น 5 columns ในแถวเดียว
- เพิ่ม vertical separators ระหว่าง mascot
- ปรับ mascot row ให้ไม่ชน title และให้สัดส่วนรูปใกล้ reference มากขึ้น
- ปรับ pill ใต้ mascot เป็น white rounded pill โปร่งนุ่ม พร้อมชื่อสีน้ำเงินและคำอธิบายขนาดเล็ก

## Assets Used

ใช้ transparent assets เดิม:

- TOPA: `apps/web/public/brand/topa/mascot-topa-feature.png`
- BUNNY: `apps/web/public/brand/topa/mascot-pip-feature.png`
- OWLY: `apps/web/public/brand/topa/mascot-olli-feature.png`

สร้าง transparent cutout ใหม่สำหรับตัวที่ไม่มี transparent asset ตรง reference:

- PANDA: `apps/web/public/brand/topa/mascot-panda-reference-cutout.png`
- BEARY: `apps/web/public/brand/topa/mascot-beary-reference-cutout.png`

หมายเหตุ asset ที่ยังขาด:

- ไม่มี high-resolution transparent PNG/WebP ของ PANDA pose ตาม reference ใน `apps/web/public/brand/topa/`
- ไม่มี high-resolution transparent PNG/WebP ของ BEARY pose ตาม reference ใน `apps/web/public/brand/topa/`

จึงใช้ transparent cutout จาก reference image ล่าสุดแทน โดยไม่มีพื้นหลังขาวหรือกรอบสี่เหลี่ยม แต่คุณภาพต้นทางยังจำกัดจาก screenshot

## Validation

ผ่าน:

- `cd C:\web-app\4-craft.com\apps\web`
- `npm run build`
- `npm run lint`
- `cd C:\web-app\4-craft.com`
- `docker compose --env-file .env.docker -f docker-compose.beta.yml build 4craft-web`
- `docker compose --env-file .env.docker -f docker-compose.beta.yml up -d`

หมายเหตุ:

- `npm run build` ยังมี warning เดิมจาก Next/ESLint options (`useEslintrc`, `extensions`) แต่ build exit code 0
- การรัน `npm run lint` พร้อม `npm run build` แบบ parallel ทำให้ `.next/types` ชนกันได้ จึง rerun `npm run lint` แบบเดี่ยวแล้วผ่าน

## Browser QA

URL: `https://topamath.com/`

Screenshot: `docs/homepage_topa_friends_pixel_match_qa.png`

ผลตรวจ:

- พบ section "เพื่อนช่วยเรียนของ TOPA"
- Desktop เป็น 5 mascot ในแถวเดียว
- รูป mascot ทั้ง 5 โหลดครบ ไม่มี broken image
- ไม่มี mascot ที่ใช้ opaque screenshot crop ใน section
- ไม่มีกรอบสี่เหลี่ยม/พื้นขาวแข็งรอบ mascot
- มี separator แนวตั้งระหว่าง mascot
- title, symbols, mascot และ pill แสดงครบ

## Final Decision

READY_HOMEPAGE_TOPA_FRIENDS_PIXEL_MATCH
