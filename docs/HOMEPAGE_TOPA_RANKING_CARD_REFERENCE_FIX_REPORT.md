# Homepage TOPA Ranking Card Reference Fix Report

## ขอบเขต

ปรับเฉพาะ intro card ฝั่งซ้ายของ section `TOPA Ranking` บนหน้า homepage เพื่อให้ใช้ภาพ mascot action pose ตาม reference และไม่ซ้ำกับ Topa เดี่ยวที่ใช้ใน feature cards

## New Asset

- `/brand/topa/ranking-promo-action.png`
- Workspace path: `apps/web/public/brand/topa/ranking-promo-action.png`
- ขนาด: `720x720`
- รูปแบบ: PNG โปร่งใส

ภาพสร้างด้วย built-in `image_gen` แล้วลบพื้น chroma-key เป็น alpha PNG ภายในเครื่อง

Prompt โดยสรุป:

> สร้าง TOPA Math orange lynx mascot แบบ action pose ร่าเริง ถือถ้วยรางวัลสีทอง โบกมือ มี confetti สำหรับวางมุมขวาล่างของ ranking promo card พื้น chroma-key สีเขียว ไม่มีข้อความ ไม่มีเงา ไม่มี watermark

## Files Changed

- `apps/web/src/app/page.tsx`
- `apps/web/src/lib/topa-content.ts`
- `apps/api/app/content/site/homepage.json`
- `apps/web/public/brand/topa/ranking-promo-action.png`
- `docs/HOMEPAGE_TOPA_RANKING_CARD_REFERENCE_FIX_REPORT.md`

## Content Model

เพิ่ม field เฉพาะ ranking intro card:

- `ranking.subtitle`
- `ranking.promo_text`
- `ranking.promo_image`

ค่าที่ใช้งาน:

- `title`: `TOPA Ranking`
- `subtitle`: `จัดอันดับเก่งเลขทั่วไทย`
- `description`: `คะแนนจัดอันดับคำนวณจากจำนวนข้อสอบที่ทำ + คะแนนที่ทำได้`
- `promo_text`: `แข่งขันสนุก\nกระตุ้นให้เด็ก\nอยากฝึกทุกวัน`
- `promo_image`: `/brand/topa/ranking-promo-action.png`

## UI Changes

- ranking card ใช้ action pose ใหม่ที่ถือถ้วยและมี confetti
- ลบไอคอนถ้วยแยกใน promo box เพราะถ้วยอยู่ในภาพ reference asset แล้ว
- รูปวางด้านขวาล่างของ promo box
- ใช้ `object-fit: contain` เพื่อไม่ครอป mascot หรือถ้วย
- fallback ของ ranking card ชี้ไปที่ action pose ใหม่เท่านั้น ไม่ใช้ mascot เดี่ยว generic
- ข้อความยัง render เป็น HTML และแก้ผ่าน CMS ได้

## Validation

- `npm run lint` ผ่าน
- `npm run build` ผ่าน
- `docker compose --env-file .env.docker -f docker-compose.beta.yml build 4craft-web` ผ่าน
- `docker compose --env-file .env.docker -f docker-compose.beta.yml up -d` ผ่าน

หมายเหตุ: build ยังแสดง warning เดิมของ Next.js เรื่อง ESLint option ที่ถูกถอดออก แต่ไม่ทำให้ build ล้ม

## Browser QA

ตรวจ `https://topamath.com/#ranking` แล้ว:

- ranking promo image โหลดสำเร็จจาก `/brand/topa/ranking-promo-action.png`
- ภาพมี natural size `720x720`
- ภาพไม่ซ้ำกับ feature card images ทั้ง 4 ใบ
- ภาพใช้ `object-fit: contain`
- ข้อความ promo แสดงครบ 3 บรรทัด
- ไม่มี horizontal overflow
- ไม่มี broken image

การจับ screenshot ผ่าน Browser QA หมดเวลา แต่ DOM และ computed-style QA ผ่านครบ

## Final Decision

`READY_HOMEPAGE_TOPA_RANKING_REFERENCE_FIX`
