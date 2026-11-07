# รายงานการเปิดการ์ด ป.4-ป.6 และจัดกึ่งกลางมาสคอตหน้าแรก

## สรุปงานที่ทำ

- เปิดการ์ดหลักสูตร ป.4, ป.5 และ ป.6 บนหน้า homepage ให้แสดงผลแบบเดียวกับการ์ดที่เปิดใช้งานแล้ว
- ลบสถานะล็อก ข้อความ “กำลังมาเร็ว ๆ นี้” และปุ่ม “เร็ว ๆ นี้” ของ ป.4-ป.6
- จัดพื้นที่รูปมาสคอตให้มีความสูงสม่ำเสมอ และปรับตำแหน่ง BUNNY กับ PANDA ให้ดูอยู่กึ่งกลางการ์ด
- ไม่แก้ lesson content, test content, scoring, Stripe, auth, dashboard หรือ admin logic

## ไฟล์ที่แก้

- `apps/web/src/app/page.tsx`
- `apps/api/app/content/site/homepage.json`
- `docs/homepage_grade_4_6_and_mascot_alignment_qa.png`
- `docs/HOMEPAGE_GRADE_4_6_AND_MASCOT_ALIGNMENT_REPORT.md`

## วิธีที่ใช้เปิด ป.4-ป.6

- เปลี่ยนข้อมูล `grades` ที่หน้า homepage ให้ ป.4-ป.6 มี `active: true`
- เปลี่ยนข้อความการ์ดให้เหลือ “เนื้อหาเข้มข้นขึ้น” โดยไม่มีข้อความ coming soon
- การ์ดจึงใช้ visual logic เดียวกับการ์ด active ได้แก่ สีการ์ด ไอคอน ปุ่ม “เริ่มเรียนเลย” และลิงก์ `/lessons?grade=4`, `/lessons?grade=5`, `/lessons?grade=6`
- อัปเดต `homepage.json` ให้ ป.4-ป.6 มี `status: "active"` และ `button_text: "เริ่มเรียนเลย"` เพื่อให้สถานะ CMS สอดคล้องกับหน้าเว็บ

## วิธีที่ใช้จัด BUNNY และ PANDA ให้อยู่กึ่งกลาง

- เพิ่ม image wrapper แบบ `flex` ที่มีความสูง `h-40` สำหรับมาสคอตทั้ง 5 การ์ด เพื่อให้พื้นที่รูปสม่ำเสมอ
- คง `object-contain` และขนาดรูปเดิม เพื่อไม่ให้ภาพผิดสัดส่วนหรือถูกครอป
- เพิ่มการชดเชยตำแหน่งแนวนอนเฉพาะ BUNNY และ PANDA เล็กน้อย เนื่องจากตัวมาสคอตภายในไฟล์ PNG มีน้ำหนักภาพเยื้องจากกึ่งกลางกรอบ
- TOPA, OWLY และ BEARY ไม่ได้เปลี่ยนตำแหน่ง

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
- BUNNY และ PANDA แสดงผลกึ่งกลางการ์ด และพื้นที่รูปมีความสูงสม่ำเสมอ
- ป.4, ป.5 และ ป.6 แสดงแบบ active ไม่มี lock appearance และมีปุ่ม “เริ่มเรียนเลย”
- ป.4, ป.5 และ ป.6 เชื่อมไปยัง grade query ที่ถูกต้อง
- ไม่พบ broken images บน homepage

## final decision

READY_HOMEPAGE_GRADE_4_6_OPEN
