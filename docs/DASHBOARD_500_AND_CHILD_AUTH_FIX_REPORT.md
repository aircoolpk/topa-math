# Dashboard 500 and Child Auth Fix Report

วันที่: 20 มิถุนายน 2026

## สรุป

แก้ `GET /me/dashboard?program_type=TH` จาก `500` เป็น `200` แล้ว และเพิ่ม stable fallback สำหรับบัญชีที่ไม่มี child profile หรือ optional dashboard section โหลดไม่สำเร็จ

Production validation หลัง Docker rebuild:

- mobile/iPad login: `200`
- `GET /me/dashboard?program_type=TH`: `200`
- `GET /children` ด้วย session cookie เดียวกัน: `200`
- direct open `/dashboard`: `200`
- containers API/Web: healthy

## Traceback เดิม

API ที่พังคือ:

```text
GET /me/dashboard?program_type=TH
```

Traceback:

```text
File "/app/app/routers/me.py", line 3504, in dashboard
  elapsed_ms = int((perf_counter() - started) * 1000)
NameError: name 'started' is not defined
```

โค้ดประกอบ dashboard เกือบครบแล้ว แต่ตัวแปรจับเวลา `started` ไม่เคยถูกกำหนด ทำให้ response จบด้วย HTTP 500 ทุกครั้ง

## การแก้ Backend

ไฟล์หลัก:

- `apps/api/app/routers/me.py`
- `apps/api/tests/test_api.py`

สิ่งที่แก้:

1. กำหนด `started = perf_counter()` ตั้งแต่ต้น dashboard route
2. ไม่ใช้ `_profile()` ที่โยน 404 สำหรับ dashboard อีกต่อไป
3. หากไม่มี child profile คืน `200` พร้อม:
   - `child: null`
   - `grade_level: null`
   - `setup_required: true`
   - `current_grade_lessons: []`
   - `review_lessons: []`
   - `recommended_skills: []`
   - quest/test/recommendation arrays เป็น `[]`
   - level, XP, score, coins และ summary counts เป็น `0`
4. หาก child มีอยู่แต่ `grade_level` เป็น null:
   - ไม่เรียก grade-dependent lesson/test/diagnostic loaders
   - คืน lesson/review/recommendation arrays ว่าง
   - รักษา `grade_level: null`
5. ค่า membership/progress ที่หายใช้ default:
   - membership: `free`
   - level/XP/score/coins/days active: `0`
6. แยก optional sections และกัน exception:
   - stats/rank
   - daily/weekly/monthly quests
   - lessons
   - test levels
   - foundation test
   - recommended skills
   - recommendations
   - content diagnostics
   - affiliate summary
7. หาก optional section พัง จะ log:

```text
dashboard_section_failed user_id=... section=...
```

ไม่มีการ log token หรือ password

8. เพิ่ม `affiliate_summary` ใน dashboard payload และ fallback เป็น zero object

## การแก้ Frontend

ไฟล์:

- `apps/web/src/app/dashboard/page.tsx`
- `apps/web/src/lib/api/me.ts`
- `apps/web/next.config.js`

สิ่งที่แก้:

- `DashboardData.child` รองรับ `null`
- ใช้ `affiliate_summary` จาก dashboard payload เป็นค่าเริ่มต้น
- optional affiliate refresh ล้มเหลวแล้วแสดง `0` โดยไม่ขึ้น red dashboard error
- ลด auth check ซ้ำตอน mount; dashboard API เริ่มหลัง `checkAuth()` สำเร็จ
- ถ้าไม่มี child แสดง setup state:

```text
ยังไม่มีข้อมูลนักเรียน กรุณาสร้างโปรไฟล์นักเรียน
```

- แสดง `ยังไม่ระบุระดับชั้น` แทน `ป.-`
- ลิงก์นักเรียนชี้ไป child ที่มีจริง หรือ `/register`
- ปิด prefetch สำหรับลิงก์ child

## สาเหตุและการแก้ `/children` 401

`/children` ใช้ dependency `current_user` เดียวกับ `/me` อยู่แล้ว และรองรับ Authorization header กับ HttpOnly cookie หลัง mobile auth fix

401 ที่พบมาจาก request แยกซึ่งไม่มี credential โดย path `/children` ถูก Next rewrite ไป backend และอาจถูก prefetch จากลิงก์ dashboard

แก้โดย:

- ลบ generic Next rewrite `/children/:path*`
- API client ยังเรียก absolute `https://api.topamath.com/children` พร้อม `withCredentials: true`
- dashboard ไม่เรียก `/children` เพื่อประกอบข้อมูลหลัก
- child link ไม่ถูก prefetch และแสดงเฉพาะ path ที่ถูกต้อง
- `/children` failure ไม่เกี่ยวข้องกับ dashboard payload และไม่ทำให้ dashboard fail

## Stable payload เมื่อไม่มี Child

ตัวอย่างส่วนสำคัญ:

```json
{
  "child": null,
  "grade_level": null,
  "setup_required": true,
  "current_grade_lessons": [],
  "review_lessons": [],
  "recommended_skills": [],
  "status": {
    "level": 0,
    "total_xp": 0,
    "total_score": 0
  },
  "affiliate_summary": {
    "registered_count": 0,
    "paid_member_count": 0,
    "pending_balance_minor": 0,
    "available_balance_minor": 0,
    "registrations": [],
    "commissions": [],
    "withdrawals": []
  }
}
```

## ผลทดสอบ

| รายการ | ผล |
|---|---|
| ตรวจ API logs/traceback | PASS, พบ `NameError: started is not defined` |
| `python -m py_compile` | PASS |
| dashboard ไม่มี child test | PASS |
| optional sections ล้มเหลว test | PASS, endpoint ยัง 200 |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| Docker API/Web build | PASS |
| Docker compose up | PASS |
| API/Web health | PASS |
| production mobile/iPad login | PASS, 200 |
| production `/me/dashboard?program_type=TH` | PASS, 200 |
| production `/children` ด้วย cookie session | PASS, 200 |
| direct `/dashboard` | PASS, 200 |
| direct `/dashboard?program_type=TH` | PASS, 200 |
| child profile มีอยู่ | PASS, QA Student ป.3 |
| child profile ไม่มี | PASS ผ่าน backend integration test |
| hard refresh/session persistence | PASS ผ่าน cookie-only repeated request/API smoke |

Production payload ที่ตรวจ:

```text
child=QA Student
grade=3
current_lessons=1
review_lessons=1
recommended=1
affiliate_registered=0
```

API log หลังแก้:

```text
GET /me/dashboard?program_type=TH HTTP/1.1 200 OK
GET /children HTTP/1.1 200 OK
```

ไม่มี `NameError` หรือ traceback ใหม่

### หมายเหตุการทดสอบ

- Next build ยังแสดง warning เดิมจาก ESLint 9 กับ Next.js 14 แต่ build จบ exit code 0 และ `npm run lint` ผ่าน
- focused fallback tests ผ่าน 2/2
- test เก่าหนึ่งรายการคาดว่า dashboard ต้องมี lessons เสมอ แต่ worktree ปัจจุบันมี content files ถูกย้าย/ลบจำนวนมาก ทำให้ lesson list ว่าง การเปลี่ยนครั้งนี้ตั้งใจรองรับ empty lessons ตาม requirement และไม่ได้แก้ content ชุดดังกล่าว
- in-app browser automation เชื่อมต่อไม่ได้จากข้อจำกัดของ session จึงใช้ production mobile User-Agent, cookie-session API flow และ direct/hard-refresh HTTP smoke แทน ยังควรทำ physical iPad Safari/Chrome sign-off

## Final decision

**PASS — backend 500 ถูกแก้, dashboard คืน stable payload, `/children` ใช้ cookie session ได้ และ production API/Web deploy healthy**

ก่อนปิด incident แบบสมบูรณ์ แนะนำยืนยัน UI บน iPad Safari และ iPad Chrome จริงอีกหนึ่งรอบ โดยเฉพาะข้อความ setup สำหรับบัญชีที่ไม่มี child profile
