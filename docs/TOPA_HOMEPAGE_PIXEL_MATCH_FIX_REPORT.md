# รายงานแก้หน้าแรก TOPA Math ให้ใกล้ภาพต้นฉบับมากขึ้น

## สรุปงานที่ทำ
- ปรับหน้าแรกให้ใช้ layout กว้างขึ้นจากเดิม โดยใช้กรอบหลัก `max-w-[1480px]` ในส่วนสำคัญของหน้า
- ขยาย hero section ให้รูปกลุ่มมาสคอตใหญ่ขึ้น และลด overlay ซ้ำที่ทำให้ hero สูงเกินภาพต้นฉบับ
- ปรับปุ่ม hero ให้ใช้ข้อความ `ทดลองใช้ 3 เควส` ตามภาพต้นฉบับ
- ขยาย feature cards ให้รูปมาสคอตใหญ่ขึ้น และเพิ่มขนาด card ให้ใกล้ภาพ target
- ขยาย ranking section, heading, explanation box, mascot trophy และตาราง ranking ให้ดูเต็มพื้นที่มากขึ้น
- ปรับ review cards ให้ใหญ่ขึ้น ใช้ avatar ใหญ่ขึ้น และคง heading `รีวิวจากเด็กที่ใช้งานจริง`
- ปรับ TOPA Friends section ให้มาสคอตใหญ่ขึ้น เพิ่มสัญลักษณ์คณิตพื้นหลัง และจัดวางแบบ lineup มากขึ้น
- ปรับ curriculum, parent trust, bottom CTA และ footer ให้กว้างและมี spacing ใกล้ภาพ target มากขึ้น

## ไฟล์ที่แก้
- `apps/web/src/app/page.tsx`
- `docs/TOPA_HOMEPAGE_PIXEL_MATCH_FIX_REPORT.md`

หมายเหตุ: รอบนี้ไม่ได้แก้ lesson/test/scoring logic, Stripe, auth/login/register หรือ backend content

## รูป/asset ที่ใช้
- `apps/web/public/brand/topa/topa-math-logo.png`
- `apps/web/public/brand/topa/mascot-hero-group.png`
- `apps/web/public/brand/topa/mascot-topa.png`
- `apps/web/public/brand/topa/mascot-pip.png`
- `apps/web/public/brand/topa/mascot-riko.png`
- `apps/web/public/brand/topa/mascot-olli.png`
- `apps/web/public/brand/topa/mascot-splash.png`
- `apps/web/public/brand/topa/mascot-timo.png`

## จุดที่แก้ให้เหมือนต้นฉบับ
- ขยาย main container และ section width เพื่อไม่ให้หน้าแคบเหมือนเวอร์ชันก่อน
- เพิ่มขนาด hero mascot group และให้กินพื้นที่ด้านขวามากขึ้น
- เอา level/score overlay ที่ซ้ำออก เพราะ `mascot-hero-group.png` มี card อยู่ในภาพแล้ว
- ขยาย feature mascot images จากขนาดเล็กเป็นขนาดใหญ่ขึ้น
- ปรับ ranking table header เป็น gradient blue/purple และเพิ่มขนาดตาราง
- ปรับ review cards ให้เป็น card ใหญ่ขึ้นในหนึ่งแถว
- ปรับ friends mascot lineup ให้ใหญ่ขึ้นและมี math symbols background
- ปรับ CTA เป็น blue gradient banner พร้อมปุ่มสีเหลืองและมาสคอตด้านขวา

## ผลทดสอบ
- `npm run lint` ผ่าน
- `npm run build` ผ่าน
- `docker compose --env-file .env.docker -f docker-compose.beta.yml build 4craft-web` ผ่าน
- `docker compose --env-file .env.docker -f docker-compose.beta.yml up -d` ผ่าน
- ตรวจ `https://topamath.com/` ผ่าน
- ตรวจ broken images: ไม่พบ broken images
- ตรวจ console errors รอบใหม่: ไม่พบ error ใหม่
- ตรวจ route สำคัญผ่าน local container:
  - `/` ได้ `200`
  - `/dashboard` ได้ `200`
  - `/lessons` ได้ `200`
  - `/admin` ได้ `200`

หมายเหตุ: `npm run build` ยังแสดง warning เดิม `Unknown options: useEslintrc, extensions` แต่ build ไม่ล้ม

## จุดที่ยังไม่เหมือน 100%
- ไม่มีไฟล์ hero group ที่ตรงกับ reference ทุกตัวแบบเป๊ะ ๆ โดย asset ที่มีคือ `mascot-hero-group.png` ซึ่งมี TOPA, bunny, owl และ elephant ในภาพเดียว
- ไม่มีไฟล์ mascot ชื่อ `bunny`, `panda`, `owl`, `bear` โดยตรง จึง map กับ asset ที่ใกล้ที่สุดใน `apps/web/public/brand/topa/`
- ไม่มีรูปเด็กจริงสำหรับ review cards ใน local assets จึงยังใช้ safe avatar placeholder
- ภาพ target มี composition เฉพาะมากกว่า asset ที่มีใน repo ทำให้ยังไม่สามารถ pixel-match ได้ 100% โดยไม่เพิ่ม asset ใหม่

## ขั้นตอนถัดไป
- ถ้าต้องการให้เหมือน target แบบเกือบ pixel-perfect ต้องเพิ่ม asset ชุดเดียวกับภาพต้นฉบับ เช่น hero group ที่มี TOPA, BUNNY, PANDA, OWLY, BEARY และรูปเด็กรีวิว
- หลังเพิ่ม asset ใหม่ ควรปรับเฉพาะ mapping รูปและตำแหน่งใน `apps/web/src/app/page.tsx`

## Final decision
NEEDS_ASSET_FIX
