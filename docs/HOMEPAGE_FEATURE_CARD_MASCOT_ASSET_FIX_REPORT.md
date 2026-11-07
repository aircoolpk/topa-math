# รายงานแก้ Mascot Asset ใน Homepage Feature Cards

## สรุปงานที่ทำ

- ตรวจสอบ image path ของ feature cards ใต้ hero ทั้ง 4 การ์ด
- ยืนยันว่า asset เดิมทั้ง 4 ไฟล์เป็น PNG พื้นหลังทึบ ไม่มี alpha และมีพื้นหลังขาวฝังอยู่
- สร้าง asset โปร่งใสสำหรับ feature cards โดยลบพื้นหลังจากตัวละครเดิม และจัดลง canvas โปร่งใสขนาด `320x320` ที่มี padding สมมาตร
- เปลี่ยนเฉพาะ path ของ feature cards ใน homepage ให้ใช้ asset ใหม่
- ปรับ image wrapper ให้ใช้ flex center และ `object-contain` โดยไม่ครอปเพิ่ม
- ไม่แก้ dashboard, lessons, tests, auth, Stripe, admin หรือ backend content

## ไฟล์ที่แก้

- `apps/web/src/app/page.tsx`
- `apps/web/public/brand/topa/mascot-topa-feature.png`
- `apps/web/public/brand/topa/mascot-pip-feature.png`
- `apps/web/public/brand/topa/mascot-riko-feature.png`
- `apps/web/public/brand/topa/mascot-olli-feature.png`
- `docs/HOMEPAGE_FEATURE_CARD_MASCOT_ASSET_FIX_REPORT.md`

## Image Path เดิมและ Image Path ใหม่

| การ์ด | Image path เดิม | Image path ใหม่ |
| --- | --- | --- |
| AI วิเคราะห์จุดอ่อน | `/brand/topa/mascot-topa.png` | `/brand/topa/mascot-topa-feature.png` |
| แบบฝึกหลากหลาย | `/brand/topa/mascot-pip.png` | `/brand/topa/mascot-pip-feature.png` |
| เควส XP + Level | `/brand/topa/mascot-riko.png` | `/brand/topa/mascot-riko-feature.png` |
| Ranking ทั่วประเทศ | `/brand/topa/mascot-olli.png` | `/brand/topa/mascot-olli-feature.png` |

## Asset ที่ยังมีปัญหา

- `mascot-topa-feature.png`: ไม่มีปัญหาที่พบ ตัวละครครบและพื้นหลังโปร่งใส
- `mascot-pip-feature.png`: พื้นหลังโปร่งใสแล้ว แต่แขนซ้ายของ BUNNY ขาดจาก source เดิมเพราะติดขอบภาพ
- `mascot-riko-feature.png`: พื้นหลังโปร่งใสแล้ว แต่แว่นขยายของ PANDA/Riko ติดขอบจาก source เดิม
- `mascot-olli-feature.png`: พื้นหลังโปร่งใสแล้ว แต่ช่วงล่างของ OWLY/Olli ขาดจาก source เดิมเพราะติดขอบภาพ

## Assets that need replacement or editing

| การ์ด | Current file path | ปัญหา | Recommended replacement filename |
| --- | --- | --- | --- |
| แบบฝึกหลากหลาย | `/brand/topa/mascot-pip-feature.png` | แขนซ้ายขาดจาก source เดิม | `mascot-pip-feature-complete.png` |
| เควส XP + Level | `/brand/topa/mascot-riko-feature.png` | แว่นขยายติดขอบจาก source เดิม | `mascot-riko-feature-complete.png` |
| Ranking ทั่วประเทศ | `/brand/topa/mascot-olli-feature.png` | ช่วงล่างขาดจาก source เดิม | `mascot-olli-feature-complete.png` |

Asset ทั้ง 3 รายการข้างต้นควรให้ designer หรือ AI image editor เติมส่วนที่ขาด โดยรักษาหน้าตา สี ชุด ท่าทาง และสัดส่วนของตัวละครเดิมให้ตรงกับแบรนด์

## ผลการทดสอบ

- `cd C:\web-app\4-craft.com\apps\web`
- `npm run lint` ผ่าน
- `npm run build` ผ่าน และสร้าง production build สำเร็จ
- ระหว่าง build มีคำเตือนเดิมจาก Next.js/ESLint เรื่อง option `useEslintrc` และ `extensions` แต่คำสั่งจบด้วย exit code 0
- `cd C:\web-app\4-craft.com`
- `docker compose --env-file .env.docker -f docker-compose.beta.yml build 4craft-web` ผ่าน
- `docker compose --env-file .env.docker -f docker-compose.beta.yml up -d` ผ่าน
- `docker compose --env-file .env.docker -f docker-compose.beta.yml ps` แสดง `4craft-web` เป็น healthy
- Browser QA ที่ `https://topamath.com/` ยืนยันว่า feature cards ทั้ง 4 โหลด asset ใหม่ ไม่มีพื้นหลังขาว ไม่มี broken images และไม่มี horizontal overflow
- Asset ใหม่ทั้ง 4 เป็น PNG โปร่งใสขนาด `320x320` มีมุมโปร่งใส และตัวละครอยู่กลาง canvas
- Layout ใช้ image wrapper ขนาด `128x160`, flex center และ `object-contain` จึงไม่ครอปเพิ่มจาก source

## final decision

NEEDS_IMAGE_EDITING
