# Homepage TOPA Ranking Section Match Report

## ขอบเขต

ปรับเฉพาะ section `TOPA Ranking` บนหน้าแรกให้ใกล้เคียง reference ล่าสุด โดยไม่เปลี่ยน section อื่นหรือข้อมูล ranking เดิม

## Files Changed

- `apps/web/src/app/page.tsx`
- `docs/HOMEPAGE_TOPA_RANKING_SECTION_MATCH_REPORT.md`

## Changes

- เปลี่ยนการ์ดหลักเป็นพื้นโทนอ่อน มุมโค้งใหญ่ และเพิ่ม spacing แบบ premium
- ปรับสัดส่วนคอลัมน์ซ้ายและตาราง ranking ให้สมดุลขึ้น
- จัดหัวข้อ `TOPA Ranking` และ `จัดอันดับเก่งเลขทั่วไทย` ให้เด่นและอยู่บรรทัดเดียวบน desktop
- เพิ่มไอคอนถ้วยใกล้หัวข้อให้ใกล้เคียง reference
- ปรับกล่องคำอธิบายเป็นพื้นสีอ่อน ขอบมน พร้อมไอคอนจุดสีเหลือง
- จัดข้อความ promo เป็น 3 บรรทัด:
  - `แข่งแบบสนุก`
  - `กระตุ้นให้เด็ก`
  - `อยากฝึกทุกวัน`
- ใช้ mascot เดิมจาก `/brand/topa/mascot-topa-transparent.png`
- วาง mascot และไอคอนถ้วยใน promo card โดยใช้ `object-fit: contain` และไม่ครอปตัวละคร
- คงตาราง `อันดับรายจังหวัด` และ `อันดับรายเขต` พร้อมปรับ radius, header, row spacing และ footer link

## Validation

- `npm run lint` ผ่าน
- `npm run build` ผ่าน
- `docker compose --env-file .env.docker -f docker-compose.beta.yml build 4craft-web` ผ่าน
- `docker compose --env-file .env.docker -f docker-compose.beta.yml up -d` ผ่าน

หมายเหตุ: build ยังแสดง warning เดิมของ Next.js เรื่อง ESLint option ที่ถูกถอดออก แต่ไม่ทำให้ build ล้ม

## Browser QA

ตรวจ `https://topamath.com/#ranking` บน desktop แล้ว:

- section แสดงผลเป็น 3 คอลัมน์โดยไม่มีข้อความหรือตารางซ้อนทับกัน
- หัวข้อใหญ่และหัวข้อรองอยู่บรรทัดเดียว
- promo text แสดงเป็น 3 บรรทัดตาม reference
- ตาราง ranking แสดงครบ 2 ตาราง
- ไม่มี horizontal overflow
- mascot โหลดสำเร็จจาก transparent asset
- mascot ใช้ `object-fit: contain` และมองเห็นครบ ไม่ถูกตัด

การจับ screenshot ผ่าน Browser QA หมดเวลา แต่ DOM และ computed-style QA ผ่านครบ

## Final Decision

`READY_HOMEPAGE_TOPA_RANKING_SECTION_MATCH`
