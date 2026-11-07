# HOMEPAGE TOPA FRIENDS SECTION REFERENCE MATCH REPORT

Date: 2026-06-04

## Scope

ปรับเฉพาะ section homepage ชื่อ "เพื่อนช่วยเรียนของ TOPA" ใน `apps/web/src/app/page.tsx`

ไม่ได้แก้ dashboard / lessons / tests / auth / Stripe / admin

## Changes

- เปลี่ยน section เป็นแถบการ์ดยาวพื้นหลังฟ้าอ่อนแบบ soft gradient
- เพิ่ม border สีฟ้าบาง ๆ, radius ใหญ่, shadow นุ่ม เพื่อให้ดู premium
- เพิ่ม math symbols จาง ๆ ด้านหลัง เช่น `+`, `÷`, `C`, `3`, `×`
- ปรับ title ให้อยู่ด้านบนซ้าย สี blue และน้ำหนักหนา
- ปรับ desktop layout เป็น 5 columns ในแถวเดียว
- ปรับ tablet เป็น 2 columns และ mobile เป็น 1 column ตาม responsive requirement
- เปลี่ยน mascot detail เป็น white pill/card โปร่งแสงใต้รูป ไม่ใช่ card ขาวแข็งทั้งใบ
- อัปเดตชื่อและคำอธิบายตาม brief:
  - TOPA: เพื่อนคู่คิด พร้อมเก่งน้อง!
  - BUNNY: เพื่อนกระต่ายไว ช่วยการฝึกน่า ๆ
  - PANDA: เพื่อนหมีแพนด้า เก่งคำนวณไม่แพ้
  - OWLY: ที่ปรึกษาฉลาด รักการอ่านและคิด
  - BEARY: เพื่อนใจดี ใจเย็น ช่วยแนะนำ

## Assets

สร้าง asset จาก reference image ล่าสุดที่ผู้ใช้แนบไว้ใน `apps/web/public/brand/topa/`:

- `mascot-topa-reference.png`
- `mascot-bunny-reference.png`
- `mascot-panda-reference.png`
- `mascot-owly-reference.png`
- `mascot-beary-reference.png`

หมายเหตุ: ใน `apps/web/public/brand/topa/` ไม่มี high-resolution transparent asset ที่ตรงกับ reference สำหรับ PANDA และ BEARY จึงใช้ crop จาก reference screenshot เพื่อให้ตัวละคร/pose ตรงที่สุด แต่ความละเอียดต้นทางของ screenshot ต่ำกว่า asset mascot เดิม

## Validation

ผ่าน:

- `cd C:\web-app\4-craft.com\apps\web`
- `npm run lint`
- `npm run build`
- `cd C:\web-app\4-craft.com`
- `docker compose --env-file .env.docker -f docker-compose.beta.yml build 4craft-web`
- `docker compose --env-file .env.docker -f docker-compose.beta.yml up -d`

หมายเหตุ build: `npm run build` และ Docker build มี warning เดิมจาก Next/ESLint options (`useEslintrc`, `extensions`) แต่ exit code เป็น 0 และ build สำเร็จ

## Browser QA

URL: `https://topamath.com/`

Screenshot: `docs/homepage_topa_friends_section_reference_match_qa.png`

ผลตรวจ:

- พบ section "เพื่อนช่วยเรียนของ TOPA"
- มี mascot cards 5 รายการ
- Desktop layout เป็น 5 columns ในแถวเดียว
- รูป mascot ทั้ง 5 โหลดสำเร็จ ไม่มี broken image
- ขนาด column เท่ากันบน desktop
- Section อื่นไม่ได้ถูกแก้ในงานนี้

## Final Decision

READY_HOMEPAGE_TOPA_FRIENDS_REFERENCE_MATCH
