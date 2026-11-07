# รายงานแก้ข้อความการ์ดระดับชั้นและมาสคอต CTA Banner หน้าแรก

## สรุปงานที่ทำ

- อัปเดตข้อความสั้นของการ์ด ป.4, ป.5 และ ป.6 ในส่วน “จัดเต็มหลักสูตร ป.1-ป.6”
- คงข้อความของ ป.3 เป็น “ต่อยอดความเข้าใจ โจทย์ซับซ้อนขึ้น”
- แก้รูป TOPA ด้านขวาของ blue CTA banner ให้ไม่มีพื้นหลังสีขาว และเห็นตัวละครครบโดยไม่ตัดศีรษะหรือหู
- ไม่แก้ dashboard, lessons, tests, auth, Stripe หรือ admin logic

## ไฟล์ที่แก้

- `apps/web/src/app/page.tsx`
- `apps/api/app/content/site/homepage.json`
- `apps/web/public/brand/topa/mascot-topa-transparent.png`
- `docs/homepage_grade_copy_and_cta_banner_mascot_qa.png`
- `docs/HOMEPAGE_GRADE_COPY_AND_CTA_BANNER_MASCOT_FIX_REPORT.md`

## ข้อความใหม่ของ ป.4-ป.6

- ป.4: “คิดเป็นระบบ แก้โจทย์หลายขั้นตอน”
- ป.5: “วิเคราะห์แม่นยำ ประยุกต์ใช้ได้มากขึ้น”
- ป.6: “เตรียมพร้อมขั้นสูง มั่นใจก่อนต่อยอด”

## วิธีแก้รูป mascot ในแบนเนอร์

- ตรวจพบว่า `mascot-topa.png` เป็นไฟล์พื้นหลังทึบ จึงสร้าง `mascot-topa-transparent.png` จากภาพต้นฉบับเดิม โดยตัดเฉพาะพื้นหลังสีขาวออกและรักษารูปลักษณ์ สี สัดส่วน และรายละเอียดของ TOPA ไว้
- เปลี่ยน CTA banner ให้ใช้ asset โปร่งใสใหม่ และอัปเดตค่า `cta_banner.mascot_image` ใน `homepage.json` ให้สอดคล้องกัน
- วางรูปด้วย `object-contain` และจัดกึ่งกลางแนวตั้งในแบนเนอร์
- ลดกรอบรูปเป็น `136px` เพื่อให้มีระยะบนและล่างประมาณ `6px` ไม่ตัดศีรษะ หู หรือส่วนตัวละคร และไม่ชนขอบแบนเนอร์

## ผลการทดสอบ

- `cd C:\web-app\4-craft.com\apps\web`
- `npm run lint` ผ่าน
- `npm run build` ผ่าน และสร้าง production build สำเร็จ
- ระหว่าง build มีคำเตือนเดิมจาก Next.js/ESLint เรื่อง option `useEslintrc` และ `extensions` แต่คำสั่งจบด้วย exit code 0
- `cd C:\web-app\4-craft.com`
- `docker compose --env-file .env.docker -f docker-compose.beta.yml build 4craft-web` ผ่าน
- `docker compose --env-file .env.docker -f docker-compose.beta.yml up -d` ผ่าน
- `docker compose --env-file .env.docker -f docker-compose.beta.yml ps` แสดง `4craft-web` เป็น healthy
- Browser QA ที่ `https://topamath.com/` ผ่านบน desktop
- ข้อความ ป.4, ป.5 และ ป.6 แสดงตรงตามที่กำหนด และการ์ดยังจัดแนวได้ปกติ
- CTA mascot ไม่มีพื้นหลังขาว เห็นศีรษะและหูครบ ไม่ถูกครอป และไม่พบ broken images บน homepage

## final decision

READY_HOMEPAGE_COPY_AND_BANNER_FIX
