# Homepage Hero Image Blend Fix Report

## ขอบเขต

แก้เฉพาะภาพด้านขวาใน hero section ของหน้าแรก TOPA Math เพื่อให้ภาพไม่ดูเป็นบล็อกสี่เหลี่ยมและกลืนกับพื้นหลังมากขึ้น

## ปัญหาที่พบ

- asset เดิม `/brand/topa/homepage-hero-cover-20260603.png` เป็นไฟล์ `RGBA` แต่ alpha ทึบทั้งหมด
- มุมภาพเป็นสีขาวเกือบล้วน ทำให้เห็นพื้นหลังเป็นสี่เหลี่ยมแข็ง
- composition ตัวละครดีอยู่แล้ว จึงไม่ควรเปลี่ยนภาพหลักหรือ crop ใหม่

## New Asset

- `/brand/topa/homepage-hero-cover-transparent.png`
- Workspace path: `apps/web/public/brand/topa/homepage-hero-cover-transparent.png`

สร้างจาก asset เดิมโดยลบเฉพาะพื้นหลังสีอ่อนที่เชื่อมกับขอบภาพ และทำ alpha edge ให้นุ่มขึ้น

ผลตรวจ asset:

- mode: `RGBA`
- size: `751x513`
- alpha range: `0-255`
- corner alpha: `0`
- composition เดิมยังอยู่ครบ

## Files Changed

- `apps/web/src/app/page.tsx`
- `apps/web/src/lib/topa-content.ts`
- `apps/api/app/content/site/homepage.json`
- `apps/web/public/brand/topa/homepage-hero-cover-transparent.png`
- `docs/HOMEPAGE_HERO_IMAGE_BLEND_FIX_REPORT.md`

## UI Changes

- เปลี่ยน hero image source/fallback ไปใช้ transparent asset ใหม่
- ลด drop shadow จาก `0_24px_40px` เป็น `0_18px_28px` และลด opacity เพื่อให้ภาพกลืนกับ section มากขึ้น
- คง `object-contain` เพื่อไม่ให้ตัวละครหรือ stat card ถูก crop
- ไม่เปลี่ยน layout, text, CTA หรือ section อื่น

## Validation

- `npm run lint` ผ่าน
- `npm run build` ผ่าน
- `docker compose --env-file .env.docker -f docker-compose.beta.yml build 4craft-web` ผ่าน
- `docker compose --env-file .env.docker -f docker-compose.beta.yml up -d` ผ่าน
- `4craft-web` สถานะ `healthy`

หมายเหตุ: build ยังแสดง warning เดิมของ Next.js เรื่อง ESLint option ที่ถูกถอดออก แต่ไม่ทำให้ build ล้ม

## Browser QA

ตรวจ `https://topamath.com/` แล้ว:

- hero image โหลดจาก `/brand/topa/homepage-hero-cover-transparent.png`
- image natural size เป็น `751x513`
- rendered size เป็น `713x430`
- ใช้ `object-fit: contain`
- ไม่มี broken image
- composition เดิมยังครบ
- ภาพไม่อ้างกลับไปใช้ไฟล์พื้นขาวเดิมใน hero source/fallback

## Final Decision

`READY_HOMEPAGE_HERO_IMAGE_BLEND_FIXED`
