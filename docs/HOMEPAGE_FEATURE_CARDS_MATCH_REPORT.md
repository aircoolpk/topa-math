# Homepage Feature Cards Match Report

## ขอบเขต

ปรับเฉพาะ section การ์ด 4 ใบใต้ hero บนหน้าแรก:

1. `AI วิเคราะห์จุดอ่อน`
2. `แบบฝึกเฉพาะตัว`
3. `เควส XP + Level`
4. `Ranking ทั่วประเทศ`

## Files Changed

- `apps/web/src/app/page.tsx`
- `docs/HOMEPAGE_FEATURE_CARDS_MATCH_REPORT.md`

## Changes

- ปรับข้อความหัวข้อและคำอธิบายตาม reference และ line break ที่กำหนด
- คง responsive grid เป็น mobile 1 คอลัมน์, tablet 2 คอลัมน์ และ desktop 4 คอลัมน์
- ปรับการ์ดให้มีขนาดใกล้เคียงกัน มุมโค้งมน เส้นขอบบาง และเงาอ่อน
- ใช้พื้นหลัง pastel แยกสีฟ้า, mint, ครีมเหลือง และม่วง
- จัด mascot อยู่ฝั่งซ้ายและข้อความอยู่ฝั่งขวา
- จัด mascot กึ่งกลางแนวตั้งและเพิ่มขนาดให้ใกล้ reference
- ใช้ wrapper พื้นโปร่งใสและ `object-fit: contain`
- ใช้ asset เดิมในโปรเจกต์:
  - Topa: `/brand/topa/mascot-topa-feature.png`
  - Bunny: `/brand/topa/mascot-pip-feature.png`
  - Panda mapping: `/brand/topa/mascot-riko-feature.png`
  - Owly: `/brand/topa/mascot-olli-feature.png`

## CMS / Content

section นี้ render จาก static `featureCards` ใน `apps/web/src/app/page.tsx` จึงไม่มี homepage CMS reference ที่ต้องแก้

## Validation

- `npm run lint` ผ่าน
- `npm run build` ผ่าน
- `docker compose --env-file .env.docker -f docker-compose.beta.yml build 4craft-web` ผ่าน
- `docker compose --env-file .env.docker -f docker-compose.beta.yml up -d` ผ่าน

หมายเหตุ: build ยังแสดง warning เดิมของ Next.js เรื่อง ESLint option ที่ถูกถอดออก แต่ไม่ทำให้ build ล้ม

## Browser QA

ตรวจ `https://topamath.com/` แล้ว:

- พบ feature cards ครบ 4 ใบ
- desktop แสดงเป็น 4 cards หนึ่งแถว
- การ์ดมีขนาดเท่ากันและไม่มี horizontal overflow
- mascot ทุกภาพโหลดสำเร็จจาก local asset ขนาด `320x320`
- mascot แสดงผลประมาณ `128x128`, ใช้ `object-fit: contain`
- wrapper ของ mascot เป็นพื้นโปร่งใส ไม่มีกรอบหรือกล่องขาว
- ตัวละครไม่ถูกตัดและข้อความอยู่ฝั่งขวา
- หัวข้อ `แบบฝึกเฉพาะตัว` อยู่บรรทัดเดียว ส่วนหัวข้ออื่นจัดบรรทัดตาม reference

## Final Decision

`READY_HOMEPAGE_FEATURE_CARDS_MATCH`
