# Homepage Review Child Image Report

## ขอบเขต

- หน้าแรก section `รีวิวจากเด็กที่ใช้งานจริง`
- data model ของรีวิวหน้าแรกและข้อมูล CMS ที่ใช้งานจริง
- local generated child portrait assets

## Generated Portrait Assets

- `/brand/topa/reviews/review-child-1.png`
- `/brand/topa/reviews/review-child-2.png`
- `/brand/topa/reviews/review-child-3.png`
- `/brand/topa/reviews/review-child-4.png`

ภาพทั้งหมดสร้างด้วย built-in `image_gen` สำหรับการ์ดรีวิว TOPA Math โดยเฉพาะ ไม่ได้ใช้รูปคนจริงจากภายนอกแบบสุ่ม และบันทึกเป็นไฟล์ local ขนาด `512x512` เพื่อให้แสดงผลคมชัดใน avatar วงกลม

Prompt set โดยสรุป:

- เด็กผู้ชายยิ้มแย้ม เสื้อสีน้ำเงิน
- เด็กผู้หญิงยิ้มแย้ม เสื้อสีเหลืองและผมหางม้า
- เด็กผู้ชายยิ้มแย้ม เสื้อสีเขียวอมฟ้า
- เด็กผู้หญิงยิ้มแย้ม เสื้อสีคอรัลและกิ๊บติดผม

## Data Model

review item รองรับ field ต่อไปนี้:

- `name`
- `grade_label`
- `province`
- `quote`
- `rating`
- `image_path`

ยังรองรับ legacy field `grade` และ `image` เพื่อให้ CMS data เดิมไม่เสียหาย

## Files Changed

- `apps/web/src/app/page.tsx`
- `apps/web/src/lib/topa-content.ts`
- `apps/api/app/content/site/homepage.json`
- `apps/web/public/brand/topa/reviews/review-child-1.png`
- `apps/web/public/brand/topa/reviews/review-child-2.png`
- `apps/web/public/brand/topa/reviews/review-child-3.png`
- `apps/web/public/brand/topa/reviews/review-child-4.png`

## UI Changes

- การ์ดรีวิวทุกใบแสดงรูปเด็กแบบ portrait วงกลม
- แสดงดาวรีวิว ชื่อเด็ก ระดับชั้น จังหวัด และข้อความรีวิว
- ภาพใช้ `object-fit: cover`, `object-position: center` และ wrapper `96x96` แบบวงกลม
- grid เดิมยัง responsive ที่หนึ่ง สอง และสี่คอลัมน์
- ใช้ข้อมูลรีวิวจาก CMS เมื่อมี และใช้ local fallback data เมื่อ CMS ไม่มีข้อมูล

## Validation

- `npm run lint` ผ่าน
- `npm run build` ผ่าน
- `docker compose --env-file .env.docker -f docker-compose.beta.yml build 4craft-web` ผ่าน
- `docker compose --env-file .env.docker -f docker-compose.beta.yml up -d` ผ่าน
- service `4craft-web` สถานะ `healthy`

หมายเหตุ: `npm run build` ยังแสดง warning เดิมของ Next.js เรื่อง ESLint option ที่ถูกถอดออก แต่ไม่ทำให้ build ล้ม

## Browser QA

ตรวจ `https://topamath.com/` แล้ว:

- พบ review card ครบ 4 ใบ
- พบ child portrait ครบ 4 ภาพ และไม่มี broken image
- ทุกภาพโหลดจาก `/brand/topa/reviews/review-child-1.png` ถึง `/brand/topa/reviews/review-child-4.png`
- ทุกภาพมี natural size `512x512`
- wrapper ของทุกภาพเป็นวงกลม `96x96`, `overflow-hidden`
- ภาพแสดงผลตรงกลางและไม่ยืดผิดสัดส่วน
- grid class ยังคงเป็น `grid gap-6 md:grid-cols-2 lg:grid-cols-4` สำหรับ desktop และ mobile responsive behavior

การจับ screenshot ผ่าน Browser QA หมดเวลา แต่ DOM และ computed-style QA ผ่านครบ

## Final Decision

`READY_HOMEPAGE_REVIEW_CHILD_IMAGES`
