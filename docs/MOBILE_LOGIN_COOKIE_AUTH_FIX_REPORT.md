# Mobile Login, Cookie, and Auth Fix Report

วันที่ตรวจและแก้ไข: 20 มิถุนายน 2026

## สรุป

แก้ระบบ auth ให้รองรับ mobile Safari/Chrome โดยเพิ่ม HttpOnly session cookie เป็นช่องทางหลักที่ทนต่อข้อจำกัดของ Safari และคง bearer token เดิมไว้เพื่อ backward compatibility ระบบจะยืนยัน `/auth/me` หลัง login ก่อน redirect อยู่แล้ว และตอนนี้การยืนยันดังกล่าวทำงานได้แม้ `localStorage` ใช้งานไม่ได้

ผลตรวจ production หลัง rebuild:

- `POST https://api.topamath.com/auth/login` จาก iPad Safari User-Agent: `200`
- ได้ `Set-Cookie: topa_session=...; Secure; HttpOnly; SameSite=lax; Path=/`
- `GET /auth/me` โดยใช้ cookie อย่างเดียว: `200`
- `POST /auth/logout`: `204`
- `GET /auth/me` หลัง logout: `401`
- CORS อนุญาต `https://topamath.com` และ `https://www.topamath.com` พร้อม credentials
- origin อื่น เช่น `https://evil.example`: preflight ถูกปฏิเสธ `400`

## สาเหตุที่พบ

1. Backend เดิมคืนเฉพาะ JWT ใน response body และไม่เคยออก auth cookie จึงไม่มี session fallback สำหรับ Safari/mobile
2. Axios ตั้ง `withCredentials: false` ทำให้ browser ไม่รับ/ส่ง cross-origin cookie ระหว่าง `topamath.com` และ `api.topamath.com`
3. Frontend auth และ route guards หลายจุดบังคับว่าต้องมี `localStorage.access_token`; หาก Safari private mode/storage policy ทำให้ storage อ่านหรือเขียนไม่ได้ ผู้ใช้จะถูกมองว่าไม่ได้ login แม้ backend session ใช้งานได้
4. Login UI แสดง generic error เป็นหลัก จึงแยกไม่ได้ว่าเป็น credentials, disabled account, timeout, network/CORS หรือ API ติดต่อไม่ได้
5. Production runtime ถูกประกาศเป็น `ENVIRONMENT=local` และ `NEXT_PUBLIC_APP_ENV=beta` พร้อม localhost origins แม้ให้บริการที่ public production domain ซึ่งเปิดโอกาสให้ค่า local หลุดไป production
6. Active production API URL เป็น `https://api.topamath.com` อยู่แล้ว จึงไม่พบ localhost ใน bundle ที่ rebuild ด้วย `.env.docker`; แต่ Docker defaults/examples เดิมยังมี localhost สำหรับ local use จึงเพิ่ม production validation และตั้ง runtime จริงให้ชัดเจน

## การแก้ไข

### Backend

- Login/register ออก JWT ทั้งใน response body และ cookie `topa_session`
- `/auth/me` และ endpoint ที่ใช้ `current_user` รับ token จาก Authorization header ก่อน แล้ว fallback ไป auth cookie
- เพิ่ม `POST /auth/logout` เพื่อลบ cookie ด้วย attributes ชุดเดียวกับตอนสร้าง
- เพิ่ม safe logs:
  - `login_failed reason=user_not_found`
  - `login_failed reason=password_mismatch`
  - `login_failed reason=account_disabled`
  - `login_succeeded`
- Logs เก็บเฉพาะ user id, email fingerprint, origin และ client category (`mobile`, `tablet`, `desktop`) ไม่บันทึกรหัสผ่านหรือ token
- เพิ่ม production validation สำหรับ cookie secure, SameSite และ path

### Frontend

- Axios ใช้ `withCredentials: true`
- ยังคงแนบ bearer token เมื่ออ่านจาก storage ได้
- การอ่าน/เขียน/ลบ `localStorage` ถูกห่อด้วย `try/catch`; cookie auth ยังทำงานเมื่อ Safari ปิดกั้น storage
- `checkAuth()` เรียก `/auth/me` และคืน user/null เพื่อให้ route guard ตรวจ session จริงแทนการตรวจว่ามี localStorage key หรือไม่
- Login จะ redirect หลัง `/auth/me` สำเร็จเท่านั้น
- แสดงข้อความแยกกรณี credentials ผิด, account disabled, timeout และ network/CORS
- manual upload fetch เพิ่ม `credentials: "include"`

## ค่า Cookie และ CORS

Production:

```env
ENVIRONMENT=production
AUTH_COOKIE_NAME=topa_session
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAMESITE=lax
AUTH_COOKIE_DOMAIN=
AUTH_COOKIE_PATH=/
CORS_ORIGINS=https://topamath.com,https://www.topamath.com
NEXT_PUBLIC_APP_ENV=production
NEXT_PUBLIC_API_BASE_URL=https://api.topamath.com
```

เหตุผลที่ไม่กำหนด `Domain`:

- Cookie เป็น host-only ของ `api.topamath.com` ซึ่งเป็น host ที่ต้องรับ cookie ทุกครั้งที่ frontend เรียก API
- Frontend ไม่จำเป็นต้องอ่าน cookie เพราะเป็น HttpOnly
- `topamath.com` และ `api.topamath.com` เป็น same-site ภายใต้ HTTPS เดียวกัน จึงใช้ `SameSite=Lax` ได้โดยไม่ต้องใช้ `SameSite=None`
- Host-only cookie ลดขอบเขตและความเสี่ยงกว่าการตั้ง `.topamath.com`

## ไฟล์ที่แก้

Backend/config:

- `apps/api/app/core/config.py`
- `apps/api/app/routers/auth.py`
- `apps/api/app/routers/deps.py`
- `apps/api/tests/test_api.py`
- `apps/api/.env.example`
- `apps/api/.env.staging.example`
- `.env.docker`
- `.env.docker.example`
- `docker-compose.beta.yml`

Frontend auth/session:

- `apps/web/src/lib/api-client.ts`
- `apps/web/src/lib/auth.ts`
- `apps/web/src/store/auth.ts`
- `apps/web/src/app/login/page.tsx`
- `apps/web/src/app/dashboard/page.tsx`
- `apps/web/src/app/admin/layout.tsx`
- `apps/web/src/app/admin/generated-content/page.tsx`
- `apps/web/src/app/lessons/page.tsx`
- `apps/web/src/app/billing/page.tsx`
- `apps/web/src/app/pricing/page.tsx`
- route guards ใต้ `apps/web/src/app/children/`
- `apps/web/src/app/dashboard/lessons/[lessonId]/page.tsx`
- `apps/web/src/app/dashboard/tests/[sessionId]/page.tsx`
- `apps/web/src/app/register/page.tsx`
- `apps/web/src/components/avatar/AvatarUpload.tsx`

## Validation

| รายการ | ผล |
|---|---|
| `python -m py_compile app/core/config.py app/routers/auth.py app/routers/deps.py` | PASS |
| Cookie auth tests | PASS, 2 tests |
| expired cookie แล้ว login ใหม่ | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| Docker API/Web rebuild | PASS |
| API/Web containers healthy | PASS |
| Production login with iPad Safari User-Agent | PASS |
| Cookie-only `/auth/me` | PASS |
| logout/session removal | PASS |
| CORS topamath.com | PASS |
| CORS www.topamath.com | PASS |
| disallowed origin | PASS, rejected |
| `/login` direct HTTP | PASS, 200 |
| `/dashboard` direct HTTP | PASS, 200 |

Next build แสดงคำเตือนเดิมว่า ESLint 9 ส่ง option ที่ Next.js 14 ไม่รู้จัก แต่ build จบด้วย exit code 0 และ `npm run lint` ของโปรเจกต์ผ่าน

## วิธีทดสอบบน iPad

1. Settings > Safari > Advanced > Website Data แล้วลบข้อมูลของ `topamath.com` และ `api.topamath.com`
2. เปิด Safari แบบปกติ ไปที่ `https://topamath.com/login`
3. login แล้วตรวจว่าถูกส่งไป `/dashboard` และข้อมูล dashboard โหลดสำเร็จ
4. hard refresh หน้า dashboard และยืนยันว่า session ยังอยู่
5. ปิด Safari จาก app switcher เปิดใหม่ แล้วเปิด `https://topamath.com/dashboard` โดยตรง
6. logout แล้วเปิด `/dashboard` อีกครั้ง ต้องกลับหน้า login
7. login ใหม่หลัง logout/expired session ต้องสำเร็จและ cookie ใหม่แทนของเดิม
8. ทำซ้ำใน iPad Chrome; Chrome บน iOS ใช้ WebKit เช่นเดียวกับ Safari แต่ควรตรวจ UI/session แยก
9. ทดสอบ Private Browsing: ระบบควร login ได้ผ่าน cookie หาก browser อนุญาต cookie; หากผู้ใช้ปิด cookie ทั้งหมด ให้แสดง network/session error ที่ชัดเจนแทน generic failure
10. หากยังไม่ผ่าน ให้เก็บเวลาเกิดเหตุ, browser, iPadOS version และ response status ของ `/auth/login` กับ `/auth/me`; server log จะระบุ failure reason โดยไม่เปิดเผย password/token

## Final decision

**PASS สำหรับ code, API, cookie, CORS, build และ production deployment validation**

**ต้องทำ physical-device sign-off บน iPad Safari และ iPad Chrome อีกหนึ่งรอบก่อนปิด incident แบบสมบูรณ์** เนื่องจาก environment อัตโนมัติรอบนี้ไม่สามารถควบคุม iPad จริงได้ แต่ production API ถูกทดสอบด้วย iPad Safari User-Agent และ cookie-only session flow ผ่านครบแล้ว
