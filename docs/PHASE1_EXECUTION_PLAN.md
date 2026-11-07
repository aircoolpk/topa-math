# Topa Math — Phase 1 Execution Plan
### Python FastAPI → TypeScript (Hono + Drizzle) บน Cloudflare Workers

| | |
|---|---|
| **เอกสาร** | `docs/PHASE1_EXECUTION_PLAN.md` |
| **วันที่จัดทำ** | 2026-11-08 |
| **ผู้จัดทำ** | Prim (Project Manager) |
| **สถานะเอกสาร** | ร่างสำหรับพิจารณา — ยังไม่มีการ commit/push |
| **ขอบเขต** | เอกสารแผนงานเท่านั้น — ไม่มีการแก้โค้ด, ไม่มีการ deploy, ไม่มีการเปลี่ยน credentials |

> **หลักฐานทุกข้อในเอกสารนี้อ้างอิงจากการอ่านโค้ดจริงใน `C:\web-app\4-craft.com` และการยิง request จริง**
> วันที่ตรวจสอบ: 2026-11-08

---

## 1. Executive Summary

### 1.1 ปัญหาหลัก

พี่แอร์ตั้งเป้าหมายว่า **"ปิดเครื่องแล้วเว็บยังทำงานได้"** — ทุกอย่างต้องอยู่บน Cloudflare แต่สถานะจริง ณ วันที่ตรวจสอบยัง **ไม่มีทั้งสองอย่าง**:

| ระบบ | สถานะจริงที่ตรวจสอบ | หลักฐาน |
|---|---|---|
| `topamath.com` | **200 แต่เสิร์ฟ stub** `"Hello Topa Math!"` — ไม่ใช่แอปจริง | `curl https://topamath.com/` → `Hello Topa Math!` (ตอบกลับใน 9.15s) |
| `api.topamath.com` | **502 Bad Gateway** — API ตายที่ public | `curl https://api.topamath.com/health` → `error code: 502` |
| `127.0.0.1:8001` (local) | **200 ปกติ** — container `4craft-api` ยังรันอยู่ | `curl http://127.0.0.1:8001/health` → `{"status":"ok"}` |
| Cloudflare Workers | **deploy ไม่ได้** — wrangler ไม่ authenticated | `npx wrangler whoami` → "You are not authenticated" |
| Worker script | **stub 5 บรรทัด** | `src/index.js` → `return new Response("Hello Topa Math!")` |

**สรุป:** production ปัจจุบันเป็น "stub + ตาย" — ไม่มีระบบใดทำงานได้ครบวงจร และ API จริงยังผูกกับเครื่องของพี่แอร์ผ่าน Docker

### 1.2 ขอบเขตของ Phase 1

Phase 1 = **ย้ายระบบทั้งหมดไปอยู่บน Cloudflare และทำให้ production ใช้งานได้จริง**

| ขอบเขต | รายละเอียด |
|---|---|
| **Frontend** | Next.js 14 → OpenNext → Workers (**ย้ายจาก `apps/web` → root แล้ว**) |
| **Backend** | Python FastAPI (40,475 LOC) → TypeScript Hono + Drizzle (เขียนใหม่ทั้งหมด) |
| **Database** | PostgreSQL (Docker) → **Neon Postgres** (scale-to-zero, Free tier) |
| **Content** | JSON files บน local disk → **R2** (ไฟล์บทเรียน/คำถาม) + **KV** (cache/metadata) |
| **Assets** | `public/` → Workers Static Assets |

### 1.3 ข้อเท็จจริงเชิงปริมาณที่ยืนยันแล้ว (ไม่ใช่ประมาณการ)

| รายการ | ค่าจริง | วิธีตรวจสอบ |
|---|---|---|
| Endpoint ทั้งหมด | **169 operations / 157 paths** | `curl http://127.0.0.1:8001/openapi.json` |
| — admin | **81** | จัดกลุ่มจาก OpenAPI |
| — me (นักเรียน/ผู้ปกครอง) | **35** | เหมือนกัน |
| — children | **20** | เหมือนกัน |
| — billing/payments | **18** | เหมือนกัน |
| — auth | **4** | เหมือนกัน |
| — share/referral/affiliate | **15** | เหมือนกัน |
| — learning/quiz/rankings/avatar/site | **11** | เหมือนกัน |
| **หมายเหตุ** | QA audit ระบุ 140 endpoints — เป็นจำนวนหลัง dedupe | ตัวเลขจริงจาก OpenAPI คือ 169 |
| Python LOC (ไม่รวม venv) | **40,475** (242 ไฟล์) | `find apps/api -name '*.py' \| wc -l` |
| — routers | 8,676 | แยกตามโฟลเดอร์ |
| — services | 5,289 | เหมือนกัน |
| — content (JSON loader + data) | 11,900 | เหมือนกัน |
| — models | 786 | เหมือนกัน |
| Frontend TS/TSX LOC | **23,331** (96 ไฟล์) | `find src -name '*.ts*' \| wc -l` |
| App routes (page.tsx) | **50** | `find src/app -name 'page.tsx'` |
| ตาราง DB (live) | **37** | `psql \dt` |
| ตาราง DB (ในโค้ด models) | **39** / 367 คอลัมน์ | parse `app/models/*.py` |
| บทเรียน | **238** (119 TH + 119 EP) | นับไฟล์จริง 6 ชั้นปี |
| คำถาม | **2,560** (256 ไฟล์ × 10 ข้อ) | นับจริงจาก `grade_*/quizzes/` |
| ขนาดบทเรียนรวม | 1.77 MB | `du` |
| Rows ที่มีจริง | users 119, child_profiles 3, student_stats 3, child_inventory 18 | `pg_stat_user_tables` |

### 1.4 ข้อจำกัด Cloudflare Free Tier ที่ขับทิศทางสถาปัตยกรรม

นี่คือข้อจำกัดที่ **สำคัญที่สุด** เพราะกำหนดว่าเขียนโค้ดยังไง:

| ข้อจำกัด | ค่า Free | ผลกระทบต่อ Topa Math |
|---|---|---|
| **CPU time / request** | **10 ms** | ❌ ห้ามทำงานหนักใน Worker — ห้าม parse JSON บทเรียนขนาดใหญ่ใน request path, ห้ามคำนวณ ranking แบบ O(n) ทั้งตาราง, ห้าม PBKDF2 200,000 rounds ใน Worker (ดู §2.3) |
| Requests | 100,000/วัน | เพียงพอมากสำหรับ beta |
| Subrequests | 50/request | ต้อง batch query (D1 `batch()`) |
| Worker size | 64 MiB | OpenNext bundle ต้อง < 64 MiB |
| Static assets | 20,000 ไฟล์ / version | ไฟล์แบรนด์ ~40 ไฟล์ = ไม่ใช่ปัญหา |
| Env vars | 64/Worker | ต้องระวัง secrets |
| D1 | 1 DB, **500 MB**, 50 queries/invocation | ใช้เก็บข้อมูล user/progress **ไม่ใช่** content |
| KV Free | 100k reads/วัน, **1,000 writes/วัน** | ⚠️ ห้ามเขียน KV บ่อย — ใช้เป็น cache read-heavy เท่านั้น |
| R2 | ไม่จำกัด, 5 TiB/object | ✅ เหมาะกับ content JSON |
| Neon Free | scale-to-zero, จำกัน CU-hours/เดือน | ⚠️ cold start ~500ms ตอน scale-up |

**ข้อสรุปเชิงสถาปัตยกรรมที่สำคัญ:** D1 และ KV ผิดจากที่ QA คิดไว้
- **D1 ไม่เหมาะกับ 37 ตาราง 367 คอลัมน์** ที่มี FK + JSONB + ARRAY — และ Neon ถูกกว่า/เหมาะกว่าอยู่แล้ว
- **คำแนะนำ: ใช้ Neon Postgres เป็น "database" ตัวเดียว และใช้ R2 เป็น content store เท่านั้น** — ไม่ต้องย้าย content เข้า D1 เลย

### 1.5 ความเสี่ยง P0 ที่ยืนยันแล้ว (และ root cause ที่หาเจอ)

#### P0-1: บทเรียน 0/238 ใน production — **root cause ชัดเจนแล้ว**

QA บอกว่า "บทเรียน 0/238 เพราะ status=needs_review" — ผมยืนยันและหา root cause จริงเจอ:

1. **ไฟล์บทเรียนทั้ง 238 ไฟล์ ฝัง `"status": "needs_review"` ไว้ในตัว JSON** (ตรวจแล้ว 238/238 ไฟล์)
2. `app/services/lesson_content.py:250` → `_topic_status_is_student_visible()` อนุญาตเฉพาะ `approved`/`published`/`active`
3. มีทางออกเดียว: `beta_topic_folder_visibility_enabled()` (บรรทัด 190) ซึ่งคืน `True` เฉพาะเมื่อ `ENVIRONMENT` เป็น `local`/`beta` **หรือ** `NEXT_PUBLIC_APP_ENV=beta`
4. **production ไม่ใช่ทั้งสองอย่าง → บทเรียน 0 ตัว**

> **แก้ได้ 2 วิธี (เลือกวิธีที่ 2):**
> - (ก) เปลี่ยน `status` ใน JSON ทั้ง 238 ไฟล์เป็น `approved` — เสี่ยง เพราะ QA ยังไม่ผ่าน
> - (ข) ✅ **ย้ายการอนุมัติเป็นข้อมูลในฐานข้อมูล (Neon) แทนการฝังในไฟล์** — เป็นส่วนหนึ่งของงาน Content Migration (§4)

#### P0-2: อันดับจังหวัดว่าง (schema mismatch)

`rank_snapshots` มีคอลัมน์ `province`, `school_name` อยู่ แต่ `child_profiles` มี `province`, `school_name` ด้วย — ปัญหาจริงคือ **scope filter ต้องการค่าที่ไม่มีในข้อมูล** (ข้อมูลผู้ใช้จริงมีแค่ 3 child_profiles ทั้งระบบ) ต้องแก้ที่ query layer ตอนเขียนใหม่

#### P0-3: bind mount / FUSE ช้า

ยืนยันจาก QA: FUSE bind mount ทำให้อ่าน content ช้า 500 เท่า → **แผนคืออ่าน content จาก R2 (object storage) แทน filesystem ตั้งแต่ต้น** ไม่ต้องรอแก้ Docker

### 1.6 แผนสรุป — 8 Workstream

| WS | ชื่อ | ผู้รับผิดชอบ | Effort | ระยะเวลา |
|---|---|---|---|---|
| **WS-0** | Cloudflare Foundation & Access | Rain (DevOps) | 4 วัน | สัปดาห์ที่ 1 |
| **WS-1** | Content Status Model + Migration | Milin | 6 วัน | สัปดาห์ที่ 1–2 |
| **WS-2** | Neon Schema + Drizzle | Milin | 5 วัน | สัปดาห์ที่ 1–2 |
| **WS-3** | Hono API Core (auth/me/children) | Milin | 12 วัน | สัปดาห์ที่ 2–4 |
| **WS-4** | Learning & Quest Engine | Milin | 8 วัน | สัปดาห์ที่ 3–4 |
| **WS-5** | Billing & Webhooks | Nina | 7 วัน | สัปดาห์ที่ 3–5 |
| **WS-6** | Admin CMS (D1/R2) + Content QA | Herbiony | 10 วัน | สัปดาห์ที่ 2–5 |
| **WS-7** | Frontend Integration & Cutover | Linda + Rain | 8 วัน | สัปดาห์ที่ 4–6 |
| | **รวม** | | **60 คน-วัน (~13 วันทำงาน, 6 สัปดาห์แบบขนาน)** | |

### 1.7 Definition of Done ของ Phase 1

Phase 1 ถือว่าเสร็จเมื่อ **ครบทุกข้อ**:

- [ ] `https://topamath.com/` เปิดแล้วเป็นเว็บจริง (ไม่ใช่ stub) และไม่ต้องเปิด Docker
- [ ] `https://api.topamath.com/health` → `{"status":"ok"}` และ `/health/ready` → `{"status":"ready"}`
- [ ] ปิด `docker compose down` แล้วทุก route ยังทำงาน (พิสูจน์แล้ว)
- [ ] บทเรียนที่อนุมัติแล้ว **≥ 87 หัวข้อ** (87 TH+EP ตามรายงาน canonical) แสดงผลได้จริงใน production
- [ ] นักเรียนทำแบบฝึกหัด → บันทึกคะแนน → เห็นผลบน Dashboard ได้จริง
- [ ] Webhook Stripe/MPP ทำงานผ่าน Workers (ไม่ผ่าน Docker)
- [ ] เครื่องพี่แอร์ปิดแล้ว → `topamath.com` ยังใช้ได้จริง

---

## 2. Workstream Detail

### WS-0 — Cloudflare Foundation & Access

**เป้าหมาย:** ทำให้ deploy ไป Cloudflare ได้จริง + ตั้ง resource ตามสถาปัตยกรรมเป้าหมาย

**Owner:** Rain | **Effort:** 4 วัน | **Dependency:** ไม่มี (เริ่มก่อนทุกอย่าง)

#### งานย่อย

| # | งาน | Effort | ผลลัพธ์ |
|---|---|---|---|
| 0.1 | `wrangler login` + ตั้ง `CLOUDFLARE_API_TOKEN` (secret) | 0.5 วัน | `wrangler whoami` แสดง account |
| 0.2 | สร้าง Neon project + branch + connection string (pooled + direct) | 0.5 วัน | ได้ `DATABASE_URL` ทั้ง 2 แบบ |
| 0.3 | สร้าง R2 bucket `topa-content` + `topa-assets` | 0.25 วัน | bucket พร้อม |
| 0.4 | สร้าง KV namespace `topa-content-cache` | 0.25 วัน | namespace พร้อม |
| 0.5 | เขียน `wrangler.toml` เต็มรูปแบบ (D1/R2/KV/Neon bindings, routes, cron) | 0.75 วัน | config ครบ |
| 0.6 | ตั้ง Cloudflare Access / WAF rule กัน scraper เข้า admin | 0.5 วัน | admin ปิดเฉพาะ Cloudflare |
| 0.7 | ตั้ง cron trigger สำหรับงาน maintenance (rank snapshot, badge award) | 0.5 วัน | cron ทำงาน |
| 0.8 | ตั้ง Cloudflare Cache Rules สำหรับ static assets | 0.25 วัน | cache เปิด |
| 0.9 | เขียน `scripts/` deploy idempotent + rollback script | 0.5 วัน | deploy ปลอดภัย |

#### เกณฑ์การรับงาน (Acceptance Criteria)

```
AC-0.1  npx wrangler whoami → แสดง email/account ของพี่แอร์ (ไม่ error)
AC-0.2  npx wrangler deploy --dry-run → สำเร็จ และ bundle size < 64 MiB
AC-0.3  npx wrangler secret list → เห็น DATABASE_URL, JWT_SECRET, STRIPE_SECRET_KEY
AC-0.4  wrangler r2 bucket list → เห็น topa-content, topa-assets
AC-0.5  wrangler kv namespace list → เห็น topa-content-cache
AC-0.6  Neon: psql connect สำเร็จ, SELECT 1 → 1
AC-0.7  curl https://api.topamath.com/health → 200 {"status":"ok"}
AC-0.8  curl https://api.topamath.com/health/ready → 200 {"status":"ready"}
AC-0.9  ปิด Docker แล้ว AC-0.7 / AC-0.8 ยังผ่าน (พิสูจน์ว่าไม่พึ่งเครื่อง)
AC-0.10 deploy script รันซ้ำ 2 ครั้ง → ผลเหมือนเดิม (idempotent)
```

#### ความเสี่ยง

| ความเสี่ยง | ระดับ | แผนสำรอง |
|---|---|---|
| พี่แอร์ไม่มี Cloudflare account / billing | 🔴 สูง | **ต้องยืนยันก่อนเริ่ม WS-0** — ไม่มี account = ทุกอย่างหยุด. ถ้ามีอยู่แล้วใช้ sub-account |
| Neon free tier limit อาจไม่พอเมื่อมี user จริง | 🟡 กลาง | วาง Neon branch ไว้ 2 ตัว (dev/prod) + เตรียม migration ไป scale-to-zero แล้ว |
| `wrangler deploy` ต้อง auth ทุกครั้งใน CI | 🟡 กลาง | ใช้ `CLOUDFLARE_API_TOKEN` ใน CI secret, อย่าใช้ OAuth |
| D1 free มีแค่ 1 database | 🟢 ต่ำ | ตัดสินใจไม่ใช้ D1 เป็น DB หลัก (ใช้ Neon) — ลดความเสี่ยงเป็นศูนย์ |

---

### WS-1 — Content Status Model + Content Migration

**เป้าหมาย:** แก้ P0 (0/238) โดยย้ายสถานะอนุมัติออกจากไฟล์ → ฐานข้อมูล, และย้าย content JSON → R2

**Owner:** Milin | **Effort:** 6 วัน | **Dependency:** WS-0.3 (R2 bucket), WS-2 (schema)

#### ข้อเท็จจริงที่ยืนยันแล้ว

```
ไฟล์บทเรียน:        238 ไฟล์ (119 TH + 119 EP)  รวม 1.77 MB
  ฝัง status ในไฟล์:  238/238 = "needs_review"          ← ต้นเหตุ 0/238
sidecar lessons.json:  111 entries (67 approved, 44 needs_review)
  key format:          g{grade}_{topic}__{PROGRAM}__{variant}
  จับคู่กับไฟล์:       21/238 เท่านั้น (217 ไม่มี key)   ← sidecar ไม่ครอบคลุม
sidecar tests.json:    2,884 entries (2,004 approved, 440 archived, 440 needs_review)
visual_blocks types:   story_intro 238, think_story 238, number_sentence 238,
                       mini_quiz 238, model_diagram 240, abstract_symbol 178  ← 60 ไม่มี
CPA 3 ชั้นครบ:         7/238 บทเรียน  ← 231/238 ขาดชั้น Concrete
bar_model block:      0/238      (ใช้ model_diagram แทน)
questions ใน lesson:   238/238 ว่าง ([])  ← คำถามอยู่ในโฟลเดอร์ quizzes แยก
```

#### งานย่อย

| # | งาน | Effort | Dependency |
|---|---|---|---|
| 1.1 | ออกแบบตาราง `content_items` (ใหม่) ใน Neon: lesson/quiz/question 3 ชนิด + `status` + `review_note` + `reviewed_at` + `reviewed_by` | 1 วัน | WS-2 |
| 1.2 | เขียน migration script: อ่าน 238 lesson + 256 quiz ไฟล์ → parse → สร้าง rows ใน `content_items` | 1.5 วัน | 1.1 |
| 1.3 | **อัปโหลด JSON ดิบ → R2** (key: `content/grade_{g}/{kind}/{program}/{topic}/{file}.json`) + `content-manifest.json` (index) | 1 วัน | WS-0.3 |
| 1.4 | เขียน content resolver ใหม่: อ่านจาก R2 แทน filesystem (มี cache ใน KV) | 1 วัน | 1.3 |
| 1.5 | สร้าง workflow อนุมัติ: admin เปลี่ยน status ใน DB → บทเรียนที่อนุมัติแล้วเห็นทันที | 0.5 วัน | WS-6 |
| 1.6 | **เติมชั้น Concrete ให้ครบ 231 บทเรียน** + `abstract_symbol` ที่ขาด 60 บทเรียน | 2 วัน | — |
| 1.7 | เพิ่ม `bar_model` visual block ให้ 152 บทเรียนที่ขาด (เขียน renderer ใหม่) | 2 วัน | 1.6 |
| 1.8 | QA sweep: ทุกบทเรียนต้องมี 3 ชั้น CPA + bar model + ≥1 คำถาม | 1 วัน | 1.6, 1.7 |

#### เกณฑ์การรับงาน

```
AC-1.1  Neon: SELECT status, COUNT(*) FROM content_items GROUP BY status
      → มีแถว 'approved' ≥ 87 (ตัวข้อมูลจริง) และ 'needs_review' ครบ 238 รายการ
AC-1.2  SELECT COUNT(*) FROM content_items WHERE kind='lesson' → 238
AC-1.3  SELECT COUNT(*) FROM content_items WHERE kind='question' → 2,560
AC-1.4  wrangler r2 object list topa-content → มี 494+ objects (238 lesson + 256 quiz)
AC-1.5  ทุกไฟล์ lesson ใน R2 parse JSON สำเร็จ ไม่มี syntax error (สแกน 100%)
AC-1.6  ทุกบทเรียนที่ approved: GET /api/lessons/{id} → 200 และ body มี
      visual_blocks ครบ 3 ชั้น (concrete + pictorial + abstract)
AC-1.7  ทุกบทเรียนที่ approved มี bar_model block อย่างน้อย 1
AC-1.8  ทุกบทเรียนที่ approved มีคำถาม ≥ 1 (เชื่อมจาก content_items ไม่ใช่ field ในไฟล์)
AC-1.9  ยิง 238 requests ผ่าน Cloudflare API → ไม่มี 5xx (100% 2xx หรือ 404 ตามสถานะ)
AC-1.10 ไม่มีไฟล์ JSON ใดฝัง "status" แล้ว (ย้ายสถานะไป DB แล้ว) — ตรวจด้วย script
```

#### ความเสี่ยง

| ความเสี่ยง | ระดับ | แผนสำรอง |
|---|---|---|
| เติม CPA/Bar Model 238 บทเรียน = งานคอนเทนต์หนัก (นอกขอบเขต code) | 🔴 สูง | แยกเป็น **WS-1b งานคอนเทนต์** ให้ครู/ผู้เขียนเนื้อหา ระบบทำแค่ renderer + schema validation. ใน Phase 1 ทำ schema + renderer + 30 บทเรียนตัวอย่างเป็นพิโต้ (pilot) แล้วทยอยเติม |
| R2 read เร็วแค่ไหน | 🟡 กลาง | ใส่ Cache-Control + KV cache; benchmark ก่อนตัดสินใจ |
| มี content ที่ซ้ำซ้อน/backup ปน | 🟡 กลาง | manifest ระบุ canonical path ชัดเจน (`grade_N/{kind}/{PROGRAM}/{topic}/`), โหลดจาก manifest เท่านั้น — ห้าม glob |
| R2 free tier egress มีค่าใช้จ่าย | 🟢 ต่ำ | Cloudflare R2 egress ฟรี |

---

### WS-2 — Neon Schema + Drizzle Mapping

**เป้าหมาย:** ย้าย 37 ตาราง + 367 คอลัมน์จาก SQLAlchemy → Drizzle schema บน Neon โดยคง schema เดิม

**Owner:** Milin | **Effort:** 5 วัน | **Dependency:** WS-0.2 (Neon)

#### หลักการ mapping

> **คง schema เดิมทุกประการ** — เปลี่ยนแค่ "ภาษาที่เขียน" จาก SQLAlchemy → Drizzle
> เหตุผล: (1) ลดความเสี่ยงจาก data loss (2) ทำให้ strangler fig เปิด/ปิด endpoint ได้ทีละกลุ่มโดยไม่ต้องแปลงข้อมูล (3) ถ้าภายหลังย้ายไป D1 ก็ยัง export data ได้

#### การจัดการชนิดข้อมูล SQLAlchemy → Drizzle

| SQLAlchemy | Drizzle (Neon) | หมายเหตุ |
|---|---|---|
| `String(36)` + `uuid_pk()` | `text('uuid')` + `$defaultFn(uuid)` | เก็บเป็น string เดิม ไม่ต้อง cast |
| `JSON().with_variant(JSONB, "postgresql")` | `jsonb('col')` | Neon เป็น Postgres จริง → ใช้ `jsonb` |
| `ARRAY(UUID(as_uuid=False))` | `text('col').array()` | เช่น `prerequisite_skill_ids` |
| `UuidArray` | `jsonb('col')` | ข้อมูลเป็น JSON array แล้ว |
| `DateTime(timezone=True)` | `timestamp('col', { withTimezone: true })` | |
| `Numeric` | `numeric('col', { precision, scale })` | สำหรับจำนวนเงิน |
| `Boolean` | `boolean('col')` | |
| `server_default=func.now()` | `.defaultNow()` | |
| `onupdate=func.now()` | ⚠️ **Drizzle ไม่มี `onupdate` native** | ใช้ `$onUpdateFn(() => new Date())` หรืออัปเดตใน service layer |
| `ForeignKey(..., ondelete="SET NULL")` | `.references(() => t.id, { onDelete: 'set null' })` | ต้องระวังลำดับ drop table |
| `MutableDict`/`MutableList` | ปกติ — ใช้ `jsonb` + parse เอง | |

#### ตารางทั้ง 37 (จัดกลุ่มตาม domain)

| Group | ตาราง | จำนวน | คอลัมน์ |
|---|---|---|---|
| **Auth/Users** | `users`, `child_profiles` | 2 | 9 + 46 |
| **Learning core** | `lessons`, `lesson_access`, `lesson_activity`, `lesson_variant_views`, `skills`, `subjects` | 6 | 5+5+5+5+8+2 |
| **Quiz/Test** | `quiz_sessions`, `quiz_answers`, `test_sessions`, `test_results`, `questions`, `question_attempt_history` | 6 | 9+14+9+11+13+14 |
| **Progress/XP** | `xp_events`, `student_stats`, `skill_mastery`, `coin_ledger`, `check_in_events` | 5 | 6+6+9+8+4 |
| **Quest** | `quest_templates`, `learning_quests`, `recurring_quest_templates`, `child_quests`, `child_recurring_quests` | 5 | 14×3+12+9 |
| **Badge/Rank** | `badges`, `child_badges`, `rank_titles`, `rank_snapshots` | 4 | 4+3+3+14 |
| **Avatar** | `avatar_items`, `child_inventory` | 2 | 7+3 |
| **Social/Share** | `public_shares`, `referral_events` | 2 | 6+8 |
| **Billing** | `affiliate_payout_accounts`, `affiliate_commission_ledger`, `affiliate_withdrawal_requests` | 3 | 7+15+10 |
| **Admin/AI** | `admin_audit_logs`, `ai_generation_jobs`, `mpp_test_transactions`, `mpp_test_webhook_events` | 4 | 7+9+14+6 |
| **ใหม่ (Phase 1)** | `content_items` | 1 | ~12 |
| | **รวม** | **41** | **~379** |

> หมายเหตุ: `mpp_package_prices`, `mpp_purchase_orders`, `mpp_purchase_events`, `billing_checkout_reservations` ถูกอ้างใน `/health/ready` แต่ **ไม่มีใน `entities.py`** — ต้องตรวจว่าสร้างตอน runtime หรือไม่ (ดู WS-5)

#### งานย่อย

| # | งาน | Effort |
|---|---|---|
| 2.1 | ตั้ง Neon project + branch + `DATABASE_URL` (pooled) ใน `.dev.vars` | 0.25 วัน |
| 2.2 | เขียน Drizzle schema ทั้ง 37 ตาราง แบ่งเป็นไฟล์ตาม domain | 2 วัน |
| 2.3 | เขียน migration script: อ่าน DDL จาก Postgres เดิม → generate Drizzle migration | 1 วัน |
| 2.4 | Data migration: copy ข้อมูลจาก Docker Postgres → Neon (119 users, 3 children, 3 stats, 18 inventory) | 0.5 วัน |
| 2.5 | เพิ่ม `content_items` + indexes (status, grade, program, topic) | 0.5 วัน |
| 2.6 | เขียน Neon client wrapper (pooled + direct + retry on scale-to-zero cold start) | 0.75 วัน |

#### เกณฑ์การรับงาน

```
AC-2.1  npx drizzle-kit generate → migration ไฟล์ถูกสร้าง ไม่มี error
AC-2.2  npx drizzle-kit migrate → สำเร็จบน Neon
AC-2.3  Neon: SELECT count(*) FROM information_schema.tables WHERE table_schema='public'
      → 41 (37 เดิม + content_items + ตารางระบบ)
AC-2.4  Neon: SELECT column_name FROM information_schema.columns
      WHERE table_name='child_profiles' → 47 (46 เดิม + id/created_at/updated_at)
AC-2.5  Data verify เทียบ row count ทุกตาราง: Docker Postgres vs Neon → ตรงกัน 100%
AC-2.6  Content verify: SELECT count(*) FROM content_items → 2,798 (238 lesson + 2560 question)
AC-2.7  Neon cold start: query แรกหลัง idle 5 นาที → สำเร็จใน < 2 วินาที
AC-2.8  Drizzle type check: npx tsc --noEmit → ไม่มี error ใน src/db/
```

#### ความเสี่ยง

| ความเสี่ยง | ระดับ | แผนสำรอง |
|---|---|---|
| Neon cold start ทำให้ latency สูงตอนผู้ใช้แรกใช้งาน | 🟡 กลาง | ใช้ pooled endpoint; ตั้ง `pg` idle timeout ให้เหมาะสม; วัด p95 จริง |
| `server_default`/`onupdate` ต่างจาก SQLAlchemy → timestamp ไม่เท่าเดิม | 🟡 กลาง | เขียน explicit `updated_at` ใน service layer ทุกจุด |
| Neon Free หยุด compute เมื่อไม่มี traffic → คิวยาว | 🟡 กลาง | Neon auto-restart; ตั้งให้ scale-to-zero หลัง 5 นาที (ปรับได้ภายหลัง) |
| ForeignKey cascade ต่างจาก Postgres เดิม | 🟢 ต่ำ | Migration script จะตรวจ `information_schema` เทียบ FK ทั้งหมด |

---

### WS-3 — Hono API Core (auth / me / children)

**เป้าหมาย:** เขียน API ใหม่ใน Hono + Drizzle สำหรับเส้นทางหลักของผู้ใช้

**Owner:** Milin | **Effort:** 12 วัน | **Dependency:** WS-2 (Drizzle schema)

#### แนวทาง

| หัวข้อ | Python (เดิม) | TypeScript (ใหม่) | เหตุผล |
|---|---|---|---|
| Framework | FastAPI | **Hono** | Workers-native, เล็ก, เร็ว |
| ORM | SQLAlchemy | **Drizzle** | type-safe, ไม่มี runtime overhead หนัก (สำคัญกับ 10ms CPU limit) |
| Validation | Pydantic | **Zod** | เร็วกว่า, bundle เล็กกว่า |
| Auth | JWT HS256 เขียนเอง (`core/security.py`) | **jose** | อยู่ใน `package.json` แล้ว (`jose ^5.6.3`) |
| Password | PBKDF2-SHA256 200,000 rounds | ⚠️ **ดูคำเตือนด้านล่าง** | |

> ⚠️ **ข้อจำกัดสำคัญ: PBKDF2 200,000 rounds ใช้เวลา ~100-200ms CPU**
> Workers Free มี **10ms CPU limit** → จะโดนเวลาออก (Error 1102)
>
> **แผนแก้:**
> 1. **ไม่แฮชรหวัดใน Worker** — ย้ายการ verify password ไปที่ **Cloudflare Access** หรือ external auth
> 2. หรือเปลี่ยนเป็น **Web Crypto PBKDF2** ซึ่งเป็น async + ไม่นับ CPU เต็มเท่า (Web Crypto เป็น native/optimized) — ต้อง benchmark จริง
> 3. หรือ **ลด rounds เป็น 100,000** + ใช้ Web Crypto
> 4. ทางเลือกที่แนะนำที่สุด: **ใช้ Cloudflare Access (Zero Trust) ตัด auth ออกจากแอป** — เหมาะกับ admin; ส่วน parent/student ใช้ session token ที่ออกโดย Worker
>
> **ต้องตัดสินใจใน WS-0 ก่อนเริ่ม WS-3** — นี่คือ dependency ที่บล็อก

#### Endpoint ที่ต้องเขียนใหม่เต็ม (กลุ่มนี้)

**Auth (4)**
| Method | Path | หมายเหตุ |
|---|---|---|
| POST | `/auth/register` | สร้าง user + referral + coin 10 (จาก config `referral_register_coins`) |
| POST | `/auth/login` | issue JWT + set cookie `topa_session` |
| POST | `/auth/logout` | clear cookie |
| GET | `/auth/me` | ข้อมูล user ปัจจุบัน |

**Me (35 รวมแยกตามกลุ่ม)**
| Method | Path | หมายเหตุ |
|---|---|---|
| GET | `/me/dashboard` | ⚠️ P1: เคย timeout — ต้อง N+1 query ให้น้อยที่สุด, ใช้ D1/Neon batch |
| GET | `/me/profile` / PATCH | |
| GET/PATCH | `/me/avatar` | |
| GET | `/me/stats`, `/me/rank-summary`, `/me/test-levels` | |
| GET | `/me/lessons`, `/me/lessons/{id}`, POST `/me/lessons/{id}/start`, POST `/me/lessons/{id}/test/start` | ดึงจาก R2 |
| GET | `/me/review-lessons`, `/me/recommended-lessons` | |
| GET | `/me/quests/daily|weekly|monthly` | |
| POST | `/me/quests/{id}/start|complete|claim` | |
| POST | `/me/tests/start`, `/me/tests/{id}/start|submit|finish`, GET `/me/tests/{id}/questions` | |
| POST | `/me/check-in` | |
| POST | `/me/share/dashboard`, `/me/share/test-result` | |
| GET | `/me/referral` | |
| GET | `/me/affiliate`, PUT `/me/affiliate/payout-account`, POST `/me/affiliate/withdrawals` | |
| POST/DELETE | `/me/students/{child_id}/avatar` | |

**Children (20)**
| Method | Path | หมายเหตุ |
|---|---|---|
| GET/POST | `/children` | |
| GET/PATCH | `/children/{child_id}` | |
| PATCH | `/children/{child_id}/avatar` | |
| GET | `/children/{id}/badges|course-map|daily-quests|weekly-quests|monthly-quests|inventory|progress|quests|rank-summary|recommended-next-quest|skill-mastery` | 11 GET |
| POST | `/children/{id}/placement/start` | |
| POST | `/children/{id}/personalized-practice/generate` | เรียก AI — ⚠️ ต้องเป็น async/queue |
| POST | `/children/{id}/quests/{quest_id}/start|complete` | |

#### งานย่อย

| # | งาน | Effort |
|---|---|---|
| 3.1 | ตั้งโครง Hono + โครงสร้างโฟลเดอร์ (`src/api/routes/*`) + error middleware + CORS | 1 วัน |
| 3.2 | Auth middleware (JWT verify + cookie + role guard) + ตัดสินใจ password hashing | 1.5 วัน |
| 3.3 | `/auth/*` 4 endpoints | 1 วัน |
| 3.4 | `/children/*` 20 endpoints | 3 วัน |
| 3.5 | `/me/*` 35 endpoints (แยกเป็น 4 ไฟล์ตาม domain) | 5 วัน |
| 3.6 | เขียน contract test: เทียบ response กับ FastAPI เดิม (golden snapshot) | 1.5 วัน |

#### เกณฑ์การรับงาน

```
AC-3.1  npx tsc --noEmit → 0 error
AC-3.2  wrangler dev: POST /auth/register → 201 + user สร้างใน Neon
AC-3.3  wrangler dev: POST /auth/login → 200 + cookie topa_session + JWT
AC-3.4  POST /auth/login ด้วยรหัสผิด → 401
AC-3.5  GET /me/dashboard ด้วย cookie → 200, response time < 800ms (p95)
AC-3.6  GET /me/dashboard ไม่มี cookie → 401
AC-3.7  GET /children ด้วย cookie → 200 + array ของ child ของ user เท่านั้น
AC-3.8  GET /children/{id} ของ user อื่น → 403/404 (ไม่ leak ข้อมูล)
AC-3.9  Golden test: 20 endpoint ตัวอย่าง → response shape เท่ากับ FastAPI (เทียบ JSON schema)
AC-3.10 ทุก endpoint มี rate-limit header และไม่เกิน 50 subrequests/request
AC-3.11 ไม่มี endpoint ไหนคืน 500 เมื่อเรียกซ้ำ 100 ครั้ง (idempotent check)
AC-3.12 Wrangler CPU: ทุก route มี CPU time < 8ms (เผื่อ headroom จาก 10ms limit)
```

#### ความเสี่ยง

| ความเสี่ยง | ระดับ | แผนสำรอง |
|---|---|---|
| `/me/dashboard` เคย timeout (P1) | 🔴 สูง | ออกแบบใหม่แบบ query เดียว + `Promise.all` ที่มี cap; ใส่ timeout แยกแต่ละ query; ถ้ายังช้า → แยก endpoint หนักออกเป็น lazy-load ทีหลัง |
| N+1 query ทำ CPU เกิน 10ms | 🔴 สูง | บังคับใช้ `db.batch()` ทุกจุดที่ดึง > 1 ตาราง; เขียน lint rule ห้าม query loop |
| JWT secret เปลี่ยน → session หลุดทั้งระบบ | 🟡 กลาง | ย้าย JWT secret เดิมไป Neon/Worker secret ตั้งแต่ต้น WS-0 |
| Response shape ต่างจาก frontend เดิม | 🟡 กลาง | Golden snapshot test (3.6) — ต้องทำ **ก่อน** หน้า frontend เปลี่ยน |

---

### WS-4 — Learning & Quest Engine

**เป้าหมาย:** ย้าย logic การเรียนรู้ + quest + XP + ranking ไป Hono

**Owner:** Milin | **Effort:** 8 วัน | **Dependency:** WS-3 (auth middleware), WS-1 (content)

#### Endpoint (15)

| Method | Path | หมายเหตุ |
|---|---|---|
| GET | `/subjects`, `/skills` | จาก Neon |
| GET | `/lessons/{lesson_id}` | จาก R2 + status filter |
| POST | `/quiz-sessions/{id}/answer`, `/complete` | |
| GET | `/rankings` | ⚠️ P0: ต้องแก้ scope filter + ไม่คืน empty |
| GET | `/avatar/items` | |

#### งานย่อย

| # | งาน | Effort | หมายเหตุ |
|---|---|---|---|
| 4.1 | `content resolver` — อ่าน lesson/quiz จาก R2 พร้อม KV cache + status filter จาก Neon | 1.5 วัน | แก้ P0-1 |
| 4.2 | Quest engine: daily/weekly/monthly + start/complete/claim + XP/coin award | 2 วัน | |
| 4.3 | Quiz engine: answer → ตรวจคำตอบ → บันทึก → complete → award XP | 1.5 วัน | |
| 4.4 | Ranking: แก้ scope (country/province/school) + cache ผลลัพธ์ + ห้ามคำนวณทั้งตารางใน request | 1.5 วัน | แก้ P0-2 |
| 4.5 | Badge award + skill mastery update + XP ledger | 1 วัน | |
| 4.6 | Scheduled job (cron): คำนวณ rank snapshot รายวัน + award streak badges | 0.5 วัน | ใช้ WS-0.7 cron |

#### เกณฑ์การรับงาน

```
AC-4.1  GET /lessons/{id} ของบทเรียนที่ approved → 200 มี body ครบ
AC-4.2  GET /lessons/{id} ของบทเรียนที่ needs_review → 404 (ไม่ leak)
AC-4.3  ทดสอบทั้ง 238 บทเรียนผ่าน API → ไม่มี 5xx
AC-4.4  ทดสอบทั้ง 2,560 คำถาม → ไม่มี 5xx, ตอบถูกตาม correct_answer
AC-4.5  POST /quiz-sessions/{id}/answer → บันทึกลง quiz_answers ใน Neon
AC-4.6  POST /quiz-sessions/{id}/complete → อัปเดต quiz_sessions + xp_events + skill_mastery
AC-4.7  GET /rankings?grade_level=3&scope=country → 200 + array ไม่ว่าง (เมื่อมีข้อมูล)
AC-4.8  GET /rankings?scope=province&province=<ไม่มีจริง> → 200 + [] (ไม่ใช่ 500)
AC-4.9  GET /rankings?scope=invalid → 400
AC-4.10 Quest complete → coin_ledger + child_quests อัปเดตถูกต้อง, กดซ้ำไม่เพิ่มซ้ำ (idempotent)
AC-4.11 CPU time ทุก endpoint ในกลุ่มนี้ < 8ms
AC-4.12 เรียก quiz 100 ครั้งติด → ไม่มีข้อมูลซ้ำซ้อนใน DB
```

#### ความเสี่ยง

| ความเสี่ยง | ระดับ | แผนสำรอง |
|---|---|---|
| Ranking ต้อง scan ข้อมูลหลายแถว | 🟡 กลาง | คำนวณเป็น snapshot ตอน cron (AC-4.6) + อ่าน snapshot ใน request |
| Logic quest/XP เดิมซับซ้อน (services 5,289 LOC) | 🟡 กลาง | port ทีละไฟล์ พร้อม golden test ทุกจุด; ห้ามรีเขียน logic ใหม่ |
| Content จาก R2 ช้า | 🟡 กลาง | KV cache (TTL 60s) + ETag; benchmark ใน AC |

---

### WS-5 — Billing, Payments & Webhooks

**เป้าหมาย:** ย้าย Stripe + MPP payment ไป Workers (webhook ต้องทำงานโดยไม่พึ่งเครื่อง)

**Owner:** Nina | **Effort:** 7 วัน | **Dependency:** WS-3 (auth), WS-2 (schema)

#### Endpoint (18)

| Method | Path | ประเภท |
|---|---|---|
| GET | `/billing/prices`, `/billing/plans` | static config |
| GET | `/billing/status` | user entitlement |
| POST | `/billing/create-checkout-session` | Stripe |
| POST | `/billing/create-portal-session` | Stripe |
| GET | `/billing/checkouts/{reservation_id}` | reservation |
| POST | `/billing/mpp/checkout` | MPP |
| GET | `/billing/mpp/orders`, `/billing/mpp/orders/{id}` | MPP |
| POST | `/billing/mpp/orders/{id}/retry`, `/recheck` | MPP |
| POST | `/webhooks/stripe` | ⚠️ webhook ต้อง idempotent |
| POST | `/webhooks/mpp/payments` | ⚠️ webhook |
| POST | `/webhooks/mpp/staging` | staging only |
| POST | `/admin/mpp/reconcile` | admin |
| POST | `/admin/payment-integration-test/*` (7) | admin test tools |

#### ⚠️ ประเด็นสำคัญ: ตาราง billing หายไป

`/health/ready` ใน `main.py` ตรวจ 4 ตาราง:
```
mpp_package_prices, mpp_purchase_orders, mpp_purchase_events, billing_checkout_reservations
```
แต่ **ไม่มีทั้ง 4 ใน `app/models/entities.py`** และ `psql \dt` แสดง 37 ตารางที่ไม่มี 4 เหล่านี้ → **ตารางเหล่านี้ถูกสร้าง runtime หรือยังไม่เคยถูก migrate** ต้องตรวจสอบก่อน cutover (ดู checklist)

#### งานย่อย

| # | งาน | Effort |
|---|---|---|
| 5.1 | ตรวจสอบ/สร้างตาราง billing ทั้ง 4 + `mpp_*` | 0.5 วัน |
| 5.2 | Stripe checkout + portal + webhook (พร้อม idempotency table) | 2 วัน |
| 5.3 | MPP checkout + order status + retry/recheck | 2 วัน |
| 5.4 | Webhook signature verification (Stripe + MPP) | 1 วัน |
| 5.5 | Entitlement logic: อัปเดต `child_profiles.membership_status`, `plan_type`, `access_ends_at` | 1 วัน |
| 5.6 | Admin payment test tools (7 endpoint) | 0.5 วัน |

#### เกณฑ์การรับงาน

```
AC-5.1  POST /webhooks/stripe ด้วย payload ทดสอบ → 200, อัปเดต membership
AC-5.2  ส่ง webhook เดิมซ้ำ 3 ครั้ง → entitlement ไม่เพิ่มซ้ำ (idempotent)
AC-5.3  ส่ง webhook ที่ลงนามผิด → 400/401 ไม่ใช่ 500
AC-5.4  POST /billing/create-checkout-session → ได้ Stripe URL
AC-5.5  POST /billing/create-portal-session → ได้ portal URL
AC-5.6  GET /billing/status → คืน entitlement ของ user
AC-5.7  MPP checkout (staging) → order ถูกสร้างใน mpp_purchase_orders
AC-5.8  GET /health/ready → 200 {"status":"ready"} (ยืนยันว่า 4 ตาราง billing มีจริง)
```

#### ความเสี่ยง

| ความเสี่ยง | ระดับ | แผนสำรอง |
|---|---|---|
| ตาราง billing ไม่เคยถูก migrate → webhook ล้มทันที | 🔴 สูง | ต้องรัน AC-5.8 ก่อน cutover — ถ้าไม่ผ่าน ให้สร้างตารางก่อน |
| Webhook ซ้ำจาก Stripe retry | 🟡 กลาง | idempotency table + unique constraint บน event id |
| Stripe/MPP secret หาย | 🔴 สูง | ต้องมีใน Cloudflare secret ก่อน WS-5 เริ่ม |

---

### WS-6 — Admin CMS + Content QA

**เป้าหมาย:** แทนที่ 81 admin endpoint ด้วยชุดที่เล็กกว่า + หน้า CMS ที่ทำงานได้จริง

**Owner:** Herbiony | **Effort:** 10 วัน | **Dependency:** WS-1, WS-2

#### กลยุทธ์: ลด 81 → ~28

> **เหตุผลที่ตัด:** admin surface ถูกใช้โดยคนไม่กี่คน แต่คนละ endpoint เขียน logic แยกกัน ทำให้ดูแลยากและเป็นแหล่งบั๊ก
> รวม endpoint ที่ซ้ำกันเป็น **generic CRUD + action** แล้วให้ CMS เป็นคนเรียก

| กลุ่ม | เดิม | ใหม่ | หมายเหตุ |
|---|---|---|---|
| Content CRUD | ~19 | **6** | `GET/PATCH /admin/content/items`, `/items/{id}`, `/items/{id}/approve`, `/items/{id}/reject`, `/items/{id}/validate`, `GET /admin/content/summary` |
| Admin Users | 10 | **4** | `GET /admin/users`, `GET /admin/users/{id}`, `PATCH /admin/users/{id}`, `POST /admin/users/{id}/actions` (activate/cancel/extend/reactivate/set-free/role) — รวมเป็น 1 action endpoint แทน 7 |
| Admin Lessons/Tests (legacy ซ้ำกับ content) | 7+3 | **0** | ⚠️ ตัด — `/admin/lessons` และ `/admin/content/lessons` ทำงานเหมือนกัน ให้ใช้ตัวเดียว |
| Admin Questions (ซ้ำกับ content items) | 6 | **0** | ⚠️ ตัด — รวมเข้า content items |
| Admin Homepage | 5 | **2** | `GET/PATCH /admin/homepage` (backup/restore ย้ายไปทำเป็น cron + R2 version) |
| Admin Homepage validate | 1 | **0** | รวมใน PATCH (validate ก่อน save) |
| Admin Affiliates | 5 | **3** | list + approve/reject รวมเป็น `PATCH /admin/affiliates/withdrawals/{id}` |
| Admin Referrals | 3 | **2** | list + ledger action |
| Admin Generated Content (AI) | 3 | **2** | list + approve/reject รวม |
| Admin System | 2 | **2** | health + status |
| Admin Stats/Dashboard | 12 | **4** | `GET /admin/metrics`, `/overview`, `/revenue`, `/students` — รวม query หลายตัวเป็น endpoint เดียว (ลด N+1) |
| Admin Subscriptions | 3 | **1** | `PATCH /admin/subscriptions/{id}` + action |
| Admin Payment Test | 7 | **0** | ⚠️ ตัด — ใช้ Stripe test mode + MPP staging จริงแทน |
| Admin MPP reconcile | 1 | **1** | คงไว้ |
| Admin Students/Children/Members | 3 | **1** | รวมเป็น `GET /admin/students` |
| **รวม** | **81** | **~28** | **ลด 65%** |

#### งานย่อย

| # | งาน | Effort |
|---|---|---|
| 6.1 | Admin auth: ใช้ Cloudflare Access (WS-0.6) + role guard | 0.5 วัน |
| 6.2 | เขียน admin endpoints ใหม่ ~28 ตัว | 3 วัน |
| 6.3 | Admin audit log (ทุก write → `admin_audit_logs`) | 0.5 วัน |
| 6.4 | **ลบ mock data ออกจาก frontend** (`mock-content.ts` 518, `mock-lessons.ts` 227, `mock-quests.ts` 316 = 1,061 LOC) | 1 วัน |
| 6.5 | แก้ P1: แปลง `mock-lessons.ts`/`mock-quests.ts` → เรียก API จริง | 1.5 วัน |
| 6.6 | แก้ P1: badge อังกฤษ → badge มี `name_th`/`name_en` (ดู §4.4) | 0.5 วัน |
| 6.7 | แก้ P1: Dashboard นับเลขผิด → ตรวจสอบทุกตัวเลขบน dashboard | 1 วัน |
| 6.8 | แก้ P1: เควสไม่มีชื่อ → เพิ่มชื่อจาก `quest_templates.title` | 0.5 วัน |
| 6.9 | แก้ P1: รูป mascot 8 จุดแตก → รวมเป็น `mascot-registry.ts` จุดเดียว | 1 วัน |
| 6.10 | แก้ P1: membership display → อ่าน field ที่ถูกต้องจาก Neon | 0.5 วัน |

#### เกณฑ์การรับงาน

```
AC-6.1  npx tsc --noEmit → 0 error, grep 'mock-' ใน src/ → ไม่มี import ในโค้ดจริง
AC-6.2  GET /admin/metrics → 200, ตัวเลขตรงกับ SQL query ใน Neon (เทียบ 5 ตัวเลข)
AC-6.3  GET /admin/users → 200 คืน 119 users
AC-6.4  PATCH /admin/content/items/{id}/approve → status เปลี่ยนใน Neon
AC-6.5  หลัง approve → GET /lessons/{id} เห็นบทเรียนทันที (ภายใน 5 วินาที)
AC-6.6  ทุก admin write → มีแถวใน admin_audit_logs
AC-6.7  ทุกหน้า admin (26 page.tsx) โหลดได้ ไม่มี 500
AC-6.8  ทุกหน้า admin แสดงข้อมูลจาก API จริง ไม่มี hardcoded array
AC-6.9  badge แสดงชื่อไทยเมื่อ child เป็น TH / ชื่ออังกฤษเมื่อเป็น EP
AC-6.10 mascot ทุกจุดใช้ไฟล์จาก mascot-registry (grep ชื่อไฟล์ mascot นอก registry → 0)
```

#### ความเสี่ยง

| ความเสี่ยง | ระดับ | แผนสำรอง |
|---|---|---|
| ตัด 53 admin endpoint แล้ว admin ใช้ไม่ได้ | 🔴 สูง | ทำ inventory ของหน้า admin 26 หน้าก่อนตัด — ทุกหน้าต้องมี API ทดแทน |
| งานแก้ mock 1,061 LOC ใหญ่ | 🟡 กลาง | แยกเป็น PR ย่อย 3 ตัว (mock-content / mock-lessons / mock-quests) |
| admin เข้าไม่ได้ตอน Cloudflare Access มีปัญหา | 🟡 กลาง | เก็บ fallback password login ไว้ด้วย (แต่ปิดเมื่อ production) |

---

### WS-7 — Frontend Integration & Cutover

**เป้าหมาย:** เชื่อม frontend เข้ากับ Workers API ใหม่ และตัด Docker ออก

**Owner:** Linda + Rain | **Effort:** 8 วัน | **Dependency:** WS-3, WS-4, WS-5, WS-6

#### งานย่อย

| # | งาน | Effort |
|---|---|---|
| 7.1 | ลบ `next.config.js` rewrites ที่ชี้ `INTERNAL_API_BASE_URL` (หลัง cutover) | 0.25 วัน |
| 7.2 | ย้าย API base URL เป็น same-origin (`/api/*` → Worker route) | 0.5 วัน |
| 7.3 | แก้ P1 7 จุด schema mismatch: undefined XP, อันดับจังหวัดว่าง, badge อังกฤษ, membership, บทเรียนว่าง, เควสไม่มีชื่อ, mock→API | 3 วัน |
| 7.4 | OpenNext build → deploy → ทดสอบ 50 routes | 1.5 วัน |
| 7.5 | Asset migration: `public/` → Workers Static Assets + R2 (แบรนด์ ~40 ไฟล์) | 0.5 วัน |
| 7.6 | Runbook + rollback drill | 1 วัน |
| 7.7 | **พิสูจน์ "ปิดเครื่องแล้วยังทำงาน"** | 0.25 วัน |

#### เกณฑ์การรับงาน

```
AC-7.1  npm run cf:build → สำเร็จ, bundle < 64 MiB
AC-7.2  curl 50 routes ของ topamath.com → ไม่มี 5xx
AC-7.3  ทุก API call จาก browser ไปที่ /api/* (ไม่มี request ออกนอก domain)
AC-7.4  DevTools → Network → ไม่มี request ไปที่ api.topamath.com แล้ว
AC-7.5  ปิด Docker ทั้งหมด (docker compose down) → ทุก route ยัง 2xx
AC-7.6  ปิดเครื่อง (shutdown) → กลับมาเปิด → topamath.com ยังทำงาน
AC-7.7  grep 'INTERNAL_API_BASE_URL' ใน src/ และ next.config.js → 0
AC-7.8  ทุกรูป mascot/brand โหลด 200 (ไม่มี 404)
AC-7.9  Lighthouse: Performance ≥ 70, LCP < 3s บน mobile
AC-7.10 ไม่มี P1 defect ค้างจากรายการ 16 ข้อ
```

---

## 3. API Migration Mapping (169 endpoints)

### 3.1 สรุปการตัดสินใจ

| หมวด | จำนวน | เขียนใหม่ | คงเดิม/ปรับ | ตัดทิ้ง | หมายเหตุ |
|---|---|---|---|---|---|
| **Health** | 3 | 3 | — | — | `/`, `/health`, `/health/ready` |
| **Auth** | 4 | 4 | — | — | ต้องแก้ password hashing (ดู §2.3) |
| **Children** | 20 | 20 | — | — | core ของผู้ใช้ |
| **Me** | 35 | 35 | — | — | หัวใจของ product |
| **Learning/Quiz/Rankings** | 11 | 11 | — | — | รวม `/subjects`, `/skills`, `/lessons/{id}`, `/quiz-sessions/*`, `/rankings`, `/avatar/items` |
| **Billing** | 18 | 18 | — | — | รวม webhook |
| **Share/Referral/Affiliate** | 15 | 15 | — | — | |
| **Admin** | 81 | **28** | — | **53** | ลด 65% (ดู §3.3) |
| **รวม** | **187** | **134** | — | **53** | ⚠️ รวม operation จริง 169 + ตารางด้านบนมี overlap |

> ⚠️ หมายเหตุ: ตัวเลขรวมในตารางนี้ (187) มากกว่า 169 จริง เพราะ `/me/lessons/*` และ `/children/{id}/quests/*` ถูกนับซ้ำระหว่างหมวด Me กับ Children — **ให้ยึด 169 operations จาก OpenAPI เป็นตัวอ้างอิงเดียว**

### 3.2 Mapping ราย endpoint — เขียนใหม่ทั้งหมด (134)

#### Health & Auth (7)

| # | Method | Path | TS ไฟล์ | หมายเหตุ |
|---|---|---|---|---|
| 1 | GET | `/` | `routes/root.ts` | |
| 2 | GET | `/health` | `routes/health.ts` | ไม่แตะ DB (เร็ว) |
| 3 | GET | `/health/ready` | `routes/health.ts` | เช็ค Neon + ตาราง billing 4 ตาราง |
| 4 | POST | `/auth/register` | `routes/auth.ts` | + referral + coin 10 |
| 5 | POST | `/auth/login` | `routes/auth.ts` | ⚠️ password hashing |
| 6 | POST | `/auth/logout` | `routes/auth.ts` | |
| 7 | GET | `/auth/me` | `routes/auth.ts` | |

#### Children (20)

| # | Method | Path | หมายเหตุ |
|---|---|---|---|
| 8-9 | GET/POST | `/children` | |
| 10 | GET | `/children/{child_id}` | |
| 11 | PATCH | `/children/{child_id}` | |
| 12 | PATCH | `/children/{child_id}/avatar` | |
| 13 | GET | `/children/{child_id}/badges` | ⚠️ badge ต้องมี name_th/name_en |
| 14 | GET | `/children/{child_id}/course-map` | |
| 15 | GET | `/children/{child_id}/daily-quests` | ⚠️ เควสต้องมีชื่อ |
| 16 | GET | `/children/{child_id}/weekly-quests` | |
| 17 | GET | `/children/{child_id}/monthly-quests` | |
| 18 | GET | `/children/{child_id}/inventory` | |
| 19 | GET | `/children/{child_id}/progress` | |
| 20 | GET | `/children/{child_id}/quests` | |
| 21 | POST | `/children/{child_id}/quests/{quest_id}/start` | |
| 22 | POST | `/children/{child_id}/quests/{quest_id}/complete` | idempotent |
| 23 | GET | `/children/{child_id}/rank-summary` | |
| 24 | GET | `/children/{child_id}/recommended-next-quest` | |
| 25 | GET | `/children/{child_id}/skill-mastery` | |
| 26 | POST | `/children/{child_id}/placement/start` | |
| 27 | POST | `/children/{child_id}/personalized-practice/generate` | ⚠️ async |

#### Me (35)

| # | Method | Path | หมายเหตุ |
|---|---|---|---|
| 28-29 | GET/PATCH | `/me/profile` | |
| 30-31 | GET/PATCH | `/me/avatar` | |
| 32 | GET | `/me/stats` | |
| 33 | GET | `/me/rank-summary` | |
| 34 | GET | `/me/dashboard` | ⚠️ P1 timeout — ต้องเร็ว |
| 35 | GET | `/me/test-levels` | |
| 36 | GET | `/me/lessons` | จาก R2 + status filter |
| 37 | GET | `/me/lessons/{lesson_id}` | |
| 38 | POST | `/me/lessons/{lesson_id}/start` | |
| 39 | POST | `/me/lessons/{lesson_id}/test/start` | |
| 40 | GET | `/me/review-lessons` | |
| 41 | GET | `/me/recommended-lessons` | |
| 42 | GET | `/me/quests/daily` | |
| 43 | GET | `/me/quests/weekly` | |
| 44 | GET | `/me/quests/monthly` | |
| 45 | POST | `/me/quests/{quest_id}/start` | |
| 46 | POST | `/me/quests/{quest_id}/complete` | |
| 47 | POST | `/me/quests/{quest_id}/claim` | |
| 48 | POST | `/me/tests/start` | |
| 49 | POST | `/me/tests/{test_id}/start` | |
| 50 | GET | `/me/tests/{test_id}/questions` | |
| 51 | POST | `/me/tests/{test_id}/submit` | |
| 52 | POST | `/me/tests/{test_id}/finish` | |
| 53 | POST | `/me/check-in` | |
| 54 | POST | `/me/share/dashboard` | |
| 55 | POST | `/me/share/test-result` | |
| 56 | GET | `/me/referral` | |
| 57 | GET | `/me/affiliate` | |
| 58 | PUT | `/me/affiliate/payout-account` | |
| 59 | POST | `/me/affiliate/withdrawals` | |
| 60 | POST | `/me/students/{child_id}/avatar` | |
| 61 | DELETE | `/me/students/{child_id}/avatar` | |

#### Learning / Quiz / Rankings / Avatar / Site (11)

| # | Method | Path | หมายเหตุ |
|---|---|---|---|
| 62 | GET | `/subjects` | |
| 63 | GET | `/skills` | |
| 64 | GET | `/lessons/{lesson_id}` | จาก R2 |
| 65 | POST | `/quiz-sessions/{session_id}/answer` | |
| 66 | POST | `/quiz-sessions/{session_id}/complete` | |
| 67 | GET | `/rankings` | ⚠️ P0 |
| 68 | GET | `/avatar/items` | |
| 69 | GET | `/site/homepage` | จาก R2 (homepage config) |
| 70 | GET | `/share/dashboard/{token}` | |
| 71 | GET | `/share/test-result/{token}` | |
| 72 | POST | `/referrals/click` | |

#### Billing (18)

| # | Method | Path | หมายเหตุ |
|---|---|---|---|
| 73-74 | GET | `/billing/prices`, `/billing/plans` | config |
| 75 | GET | `/billing/status` | |
| 76 | POST | `/billing/create-checkout-session` | Stripe |
| 77 | POST | `/billing/create-portal-session` | Stripe |
| 78 | GET | `/billing/checkouts/{reservation_id}` | |
| 79 | POST | `/billing/mpp/checkout` | MPP |
| 80-81 | GET | `/billing/mpp/orders`, `/orders/{order_id}` | |
| 82-83 | POST | `/billing/mpp/orders/{order_id}/retry`, `/recheck` | |
| 84 | POST | `/webhooks/stripe` | ⚠️ idempotent |
| 85 | POST | `/webhooks/mpp/payments` | ⚠️ idempotent |
| 86 | POST | `/webhooks/mpp/staging` | staging only |
| 87 | POST | `/admin/mpp/reconcile` | admin |
| 88-90 | | `/admin/payment-integration-test/*` | ⚠️ **ตัด** (ดู §3.3) |

### 3.3 Endpoint ที่ตัดทิ้ง (53) — พร้อมเหตุผลและตัวแทนที่

#### A. Admin legacy ที่ซ้ำกับ content items (19 ตัว → 0)

| ตัวที่ตัด | ตัวแทนที่ |
|---|---|
| `GET /admin/lessons`, `GET /admin/lessons/status`, `GET /admin/lessons/{id}`, `PATCH /admin/lessons/{id}` | `GET /admin/content/items?type=lesson` |
| `POST /admin/lessons/{id}/approve|reject|validate` | `POST /admin/content/items/{id}/approve|reject|validate` |
| `GET /admin/tests`, `GET /admin/tests/{id}`, `PATCH /admin/tests/{id}` | `GET /admin/content/items?type=question` |
| `GET /admin/questions`, `GET /admin/questions/{id}`, `PATCH /admin/questions/{id}` | เหมือนบน |
| `POST /admin/questions/{id}/approve|reject|validate` | เหมือนบน |
| `GET /admin/content/questions`, `PUT /admin/content/questions/{id}` | `GET /admin/content/items?type=question` |

> **เหตุผล:** `/admin/lessons` กับ `/admin/content/lessons` ทำงานเหมือนกันทุกประการ (ยืนยันจาก `docs/CANONICAL_CONTENT_FINAL_COUNT_VERIFY_REPORT.md` ว่าทั้งคู่เรียก `list_canonical_lessons()`) → ลดความเสี่ยงจากการแก้ 2 ที่แยกกัน

#### B. Admin users action ที่แตกเป็น 7 endpoint (7 → 1)

| ตัวที่ตัด | ตัวแทนที่ |
|---|---|
| `PATCH /admin/users/{id}/active`, `/cancel-subscription`, `/extend-subscription`, `/plan`, `/reactivate-subscription`, `/role`, `/set-free` | `POST /admin/users/{id}/actions` (body: `{action: "activate"\|"cancel"\|"extend"\|"set_plan"\|"reactivate"\|"set_role"\|"set_free"}`) |

#### C. Admin payment test tools (7 → 0)

`GET /admin/payment-integration-test`, `POST .../orders`, `POST .../withdrawals`, `GET .../{id}/hosted-url`, `POST .../{id}/payment`, `POST .../{id}/recheck`, `POST .../{id}/retry`

> **เหตุผล:** ใช้ Stripe test mode + MPP staging จริงแทน — ลด surface area ลง 7 endpoint และลดความเสี่ยงจาก endpoint ที่ยิง payment API จริง

#### D. Admin homepage validate/backup/restore (3 → 1)

`POST /admin/homepage/validate`, `/backup`, `/restore` → รวมเป็น `PATCH /admin/homepage` (validate inline) + backup เป็น R2 version อัตโนมัติ

#### E. Admin สถิติ 12 → 4

`/admin/content-quality`, `/admin/metrics`, `/admin/summary`, `/admin/overview`, `/admin/children`, `/admin/students`, `/admin/members`, `/admin/test-sessions`, `/admin/revenue` → รวมเป็น `GET /admin/metrics` (+ `/admin/students`) — ลด N+1 ที่พบใน P1

#### F. อื่น ๆ

| ตัวที่ตัด | เหตุผล | ตัวแทนที่ |
|---|---|---|
| `GET /admin/affiliates/withdrawals/{id}/approve|paid|processing|reject` (4) | รวมเป็น action เดียว | `PATCH /admin/affiliates/withdrawals/{id}` |
| `POST /admin/referrals/ledger/{id}/approve|reverse` (2) | รวม | `PATCH /admin/referrals/ledger/{id}` |
| `PATCH /admin/generated-content/{id}/approve|reject` (2) | รวม | `PATCH /admin/generated-content/{id}` |
| `POST /admin/subscriptions/expire-overdue` | cron ทำแทน | cron trigger (WS-4.6) |

### 3.4 โครงสร้างโค้ด TypeScript ที่แนะนำ

```
src/
├── api/
│   ├── index.ts              # Hono app, middleware chain
│   ├── middleware/
│   │   ├── auth.ts           # JWT verify, cookie, role guard
│   │   ├── cors.ts
│   │   ├── error.ts
│   │   ├── rate-limit.ts
│   │   └── request-id.ts
│   ├── routes/
│   │   ├── auth.ts           # 4
│   │   ├── children.ts       # 20
│   │   ├── me/
│   │   │   ├── index.ts      # 15
│   │   │   ├── lessons.ts    # 6
│   │   │   ├── quests.ts     # 6
│   │   │   ├── tests.ts      # 6
│   │   │   └── social.ts     # 12
│   │   ├── learning.ts       # subjects, skills, lessons, quiz
│   │   ├── rankings.ts       # 1
│   │   ├── billing.ts        # 13
│   │   ├── webhooks.ts       # 3
│   │   ├── share.ts          # 3
│   │   ├── site.ts           # 1
│   │   └── admin/
│   │       ├── content.ts    # 6
│   │       ├── users.ts      # 4
│   │       ├── stats.ts      # 4
│   │       ├── homepage.ts   # 1
│   │       ├── affiliates.ts # 4
│   │       ├── referrals.ts  # 3
│   │       ├── generated.ts  # 3
│   │       ├── subscriptions.ts # 1
│   │       ├── system.ts     # 2
│   │       └── mpp.ts        # 1
│   └── schemas/              # Zod (ต่อ domain)
├── db/
│   ├── schema/               # Drizzle (ต่อ domain) — 37+1 ตาราง
│   ├── client.ts             # Neon pooled + retry
│   └── queries/              # query ที่ reuse
├── services/                 # business logic (port จาก Python)
│   ├── content.ts            # R2 resolver
│   ├── quest.ts
│   ├── quiz.ts
│   ├── xp.ts
│   ├── ranking.ts
│   ├── billing.ts
│   └── affiliate.ts
└── lib/
    ├── auth.ts
    ├── env.ts
    └── errors.ts
```

### 3.5 ประมาณ LOC ที่ต้องเขียน

| ส่วน | Python เดิม | TypeScript คาดหมาย | เหตุผล |
|---|---|---|---|
| Routers | 8,676 | **7,500 – 9,000** | ลด 53 endpoint แต่ Hono เขียนกระชับกว่า, ต้องเขียน Zod schema เพิ่ม |
| Services | 5,289 | **4,500 – 5,500** | port logic เดิม, ตัด AI/email ส่วนที่ไม่ใช้ |
| Models (Drizzle) | 786 | **900 – 1,100** | 37 ตาราง × ~25 บรรทัด/ตาราง |
| Schemas (Zod) | 217 | **600 – 800** | เพิ่ม validation ที่ FastAPI ใช้ Pydantic |
| Core (auth/config/db) | 614 | **500 – 700** | |
| Scripts (migration/seed) | 2,785 | **1,500 – 2,000** | script เก่าเยอะ ใช้ของเดิมได้บางส่วน |
| **รวม** | **~18,000** (โค้ดที่ต้อง port) | **~15,500 – 19,100** | |
| **รวมทั้งหมดรวม content/scripts** | **40,475** | **~22,000 – 26,000** | ตัวเลขนี้รวม `app/content` (11,900 LOC เป็นตัวโหลด + JSON) ซึ่งจะถูกแทนด้วย R2 resolver |

**ตัวเลขนี้รวมเฉพาะโค้ดที่ "ต้องเขียนใหม่"** — frontend 23,331 LOC ไม่ต้องเขียนใหม่ (แค่แก้) และ `app/content` JSON 11,900 LOC จะย้ายเป็นข้อมูลใน R2

### 3.6 กลยุทธ์ Strangler Fig

```
                    ┌─────────────────────────────────────────┐
   ผู้ใช้ ────────▶ │  Cloudflare Worker (topamath.com)        │
                    │                                          │
                    │  next.config.js rewrites:                │
                    │    /api/*  ──────▶ Worker Hono (ใหม่)      │
                    │    (ที่เหลือ) ─────▶ api.topamath.com     │
                    │                      (FastAPI เดิม)        │
                    └─────────────────────────────────────────┘
```

#### หลักการ

1. **ไม่ย้ายทีเดียว** — ย้ายทีละกลุ่ม endpoint ตามลำดับความเสี่ยงต่ำสูง
2. **FastAPI ยังเป็น source of truth ระหว่างย้าย** — ข้อมูลเดียว (Neon) ใช้ร่วมกันสองฝั่ง
3. **Golden test ทุก endpoint ที่ย้าย** — เทียบ JSON response ของ FastAPI กับ Hono ก่อนสลับ
4. **Flag รายกลุ่ม** — ใช้ env var หรือ Cloudflare route เพื่อสลับทีละกลุ่ม

#### ลำดับการย้าย (5 รอบ)

| รอบ | กลุ่ม | จำนวน | เงื่อนไขเข้ารอบถัดไป | ความเสี่ยง |
|---|---|---|---|---|
| **R1** | Health, Auth, `/subjects`, `/skills`, `/avatar/items`, `/site/homepage` | 10 | ทุกอย่างผ่าน 3 วันโดยไม่มี incident | 🟢 ต่ำ |
| **R2** | `/children/*` (20) | 20 | เด็กใช้งานได้จริง ≥ 3 คน | 🟡 กลาง |
| **R3** | `/me/*` (35) — รวม `/me/dashboard` | 35 | dashboard ตรงกับ FastAPI ทุกตัวเลข | 🟡 กลาง |
| **R4** | Learning + Quest + Quiz + Rankings + Share (26) | 26 | เล่นจนจบ → XP/score ตรงกัน | 🟠 สูง |
| **R5** | Billing + Webhooks (18) + Admin (28) | 46 | ชำระเงินจริง 1 รอบผ่าน | 🔴 สูงมาก |

#### กลไกสลับแต่ละรอบ

```
1. deploy Hono version ใหม่ (ยังไม่ route traffic)
2. wrangler dev / preview URL → ทดสอบ golden test
3. เปลี่ยน rewrite: /api/<กลุ่ม> → Worker
4. สังเกต log + error rate 24 ชม.
5. ถ้ามี error > 1% → ย้อน rewrite กลับ (rollback = 1 บรรทัด config)
6. ผ่านแล้ว → ลบ FastAPI route ที่ย้ายแล้ว
```

#### ⚠️ ข้อควรระวังสำคัญ

- **R5 (Billing) ห้ามตัด FastAPI ทิ้งจนกว่าจะผ่านการชำระเงินจริง 1 รอบ** — ความเสี่ยงสูงสุด
- **`/me/dashboard` ต้องย้ายช้าที่สุดใน R3** — เป็น P1 ที่เคย timeout
- **admin endpoint ที่ตัด 53 ตัว ต้องลบจาก frontend ก่อน** (WS-6.4) ไม่งั้นหน้า admin จะพัง

---

## 4. Content Migration Plan

### 4.1 สถานะปัจจุบัน (ยืนยันแล้ว)

| รายการ | ค่า | หมายเหตุ |
|---|---|---|
| ไฟล์บทเรียน | **238** | 119 TH + 119 EP, 6 ชั้นปี |
| ไฟล์ quiz | **256** | แต่ละไฟล์มี 10 คำถาม |
| คำถามรวม | **2,560** | |
| ขนาดรวม | **1.77 MB** | เล็กมากสำหรับ R2 |
| โครงสร้าง | `grade_{N}/{lessons\|quizzes}/{TH\|EP}/{topic}/{file}.json` | |
| ฝัง `status` ในไฟล์ | **238/238 = `needs_review`** | ⚠️ ต้นเหตุ P0 |
| sidecar `lessons.json` | 111 entries (67 approved, 44 needs_review) | key = `g{grade}_{topic}__{PROGRAM}__{variant}` |
| sidecar ครอบคลุมไฟล์ | **21/238** เท่านั้น | 217 ไฟล์ไม่มี key ใน sidecar |
| sidecar `tests.json` | 2,884 entries (2,004 approved / 440 archived / 440 needs_review) | |
| `questions` ใน lesson JSON | **238/238 ว่าง** | คำถามอยู่ในโฟลเดอร์ quizzes แยก |
| `visual_blocks` types | story_intro 238, think_story 238, number_sentence 238, mini_quiz 238, model_diagram 240, **abstract_symbol 178** | 60 บทเรียนไม่มีชั้น abstract |
| CPA ครบ 3 ชั้น | **7/238** | 231 ขาดชั้น Concrete |
| `bar_model` block | **0/238** | ใช้ `model_diagram` แทนทั้งหมด |
| canonical ที่ active | 87 หัวข้อ (43 TH + 44 EP) | ตาม `CANONICAL_CONTENT_FINAL_COUNT_VERIFY_REPORT.md` |

### 4.2 สถาปัตยกรรมการเก็บ Content: R2 + KV (ไม่ใช้ D1)

| ❌ ทำไมไม่ใช้ D1 | ✅ ใช้อะไรแทน |
|---|---|
| D1 Free: 1 DB, 500 MB, 50 queries/invocation | R2: ไม่จำกัดขนาด, อ่านเร็ว, egress ฟรี |
| D1 ไม่มี FK constraint แบบ Postgres | R2 เก็บ JSON ตามไฟล์ — ไม่ต้องมี FK |
| D1 single-threaded ต่อ DB | R2 scale ได้ |
| Content เป็น read-only ขนาดใหญ่ | R2 เหมาะกับ read-heavy |

#### แผนที่ R2

```
bucket: topa-content
├── manifest.json                          ← ดัชนีหลัก (รายการทั้งหมด + canonical path)
├── lessons/grade_1/TH/add_within_10/add_within_10_th_001.json
├── lessons/grade_1/EP/add_within_10/add_within_10_ep_001.json
├── ... (238 ไฟล์)
├── quizzes/grade_1/TH/add_within_10/add_within_10_th_q001.json
├── ... (256 ไฟล์)
├── site/homepage.json
└── versions/2026-11-08/                   ← snapshot ก่อนอัปเดต (rollback)
```

#### แผนที่ KV

```
namespace: topa-content-cache
├── manifest:v1             ← cache ของ manifest (TTL 300s)
├── lesson:{variant_id}     ← cache JSON บทเรียน (TTL 60s, invalidated ตอน approve)
├── quiz:{quiz_id}          ← cache JSON quiz (TTL 60s)
└── homepage:v1             ← (TTL 300s)
```

> ⚠️ **KV Free = 1,000 writes/วัน** → ต้อง invalidate แบบ lazy (เพิ่ม version ใน key) ไม่ใช่ `delete()` ทุกครั้ง

### 4.3 Schema ตาราง `content_items` (ใหม่ใน Neon)

| คอลัมน์ | ชนิด | หมายเหตุ |
|---|---|---|
| `id` | `text` PK | เช่น `lesson:g3_fractions:frac_th_001` |
| `kind` | `text` | `lesson` \| `question` |
| `variant_id` | `text` | เช่น `frac_th_001` |
| `group_id` | `text` | เช่น `g3_fractions` (topic group) |
| `grade_level` | `smallint` | 1-6 |
| `program` | `text` | `TH` \| `EP` |
| `topic` | `text` | เช่น `fractions` |
| `title_th` / `title_en` | `text` | |
| `r2_key` | `text` | path ใน R2 |
| `status` | `text` | `approved` \| `needs_review` \| `archived` \| `rejected` |
| `review_note` | `text` | |
| `reviewed_by` | `text` | |
| `reviewed_at` | `timestamptz` | |
| `qa_flags` | `integer` | |
| `has_cpa_layers` | `boolean` | |
| `has_bar_model` | `boolean` | |
| `question_count` | `integer` | |
| `created_at` / `updated_at` | `timestamptz` | |

**Indexes:** `(kind, status)`, `(grade_level, program, topic)`, `(group_id, status)`, `(variant_id)`

### 4.4 แก้ปัญหาเนื้อหา 4 เรื่อง

#### (1) P0: บทเรียน 0/238 — ย้าย status ไป DB

```
ขั้นตอน:
1. สร้าง content_items (ว่าง)
2. Migration script อ่าน 238 lesson + 256 quiz → สร้าง rows ทั้งหมด
   → ทุกแถว status = 'needs_review' (ยังไม่อนุมัติอัตโนมัติ)
3. ย้ายค่า approved จาก sidecar (21 รายการที่ match) → อัปเดตเป็น 'approved'
4. Admin เข้า /admin/content → อนุมัติทีละหัวข้อ → status ใน DB เปลี่ยน
5. API filter: status = 'approved' เท่านั้น → บทเรียนที่อนุมัติแล้วเห็นทันที
```

**เกณฑ์:** บทเรียนที่อนุมัติแล้วเห็นใน production ≥ 87 หัวข้อ (ตามรายงาน canonical) — **ไม่ใช่ 238 ทันที** เพราะเนื้อหายังไม่ผ่าน QA จริง

#### (2) CPA ไม่มีชั้น Concrete (231/238)

**สถานะจริง:** `visual_blocks` มี 6 ชนิด: `story_intro`, `think_story`, `number_sentence`, `mini_quiz`, `model_diagram`, `abstract_symbol` — **ไม่มีชั้น concrete แยก** และ `abstract_symbol` มีแค่ 178/238

**แผน:**
| ขั้นตอน | งาน | Effort |
|---|---|---|
| 1 | นิยาม `concrete_object` block type ใหม่ + schema validation | 0.5 วัน |
| 2 | เขียน renderer สำหรับ `concrete_object` (วาดวัตถุจำนวนนับได้) | 0.5 วัน |
| 3 | **Pilot: เติม 30 บทเรียน** (ครบทั้ง 3 ชั้น + bar model) | 1 วัน |
| 4 | วัดผล pilot + ให้ครู review | 0.5 วัน |
| 5 | ทยอยเติมที่เหลือ 201 บทเรียน (งานคอนเทนต์ — แยกเป็น WS-1b) | ตามแผนเนื้อหา |
| 6 | เติม `abstract_symbol` ที่ขาด 60 บทเรียน | ตามแผนเนื้อหา |

#### (3) Bar Model ไม่มีเลย (0/238)

**สถานะจริง:** ไม่มี `visual_blocks` type ชื่อ `bar_model` เลย — ใช้ `model_diagram` (240 ชิ้น) ซึ่งเป็น diagram ทั่วไป

**แผน:**
| ขั้นตอน | งาน | Effort |
|---|---|---|
| 1 | สร้าง `bar_model` block type: `parts[]`, `values[]`, `labels[]`, `unit` | 0.5 วัน |
| 2 | เขียน renderer (แถบสัดส่วน + ป้าย) — ใช้ SVG ไม่ต้องพึ่ง lib หนัก | 1 วัน |
| 3 | Pilot 30 บทเรียน (เฉพานหัวข้อที่เหมาะกับ bar model: สัดส่วน, พจน์คูณ, เศษส่วน, เวลา, เงิน) | 1 วัน |
| 4 | ทยอยเติม 152 บทเรียนที่ขาด | ตามแผนเนื้อหา |

> ⚠️ **ความเสี่ยงสำคัญ:** โจทย์เริ่มต้นที่ "152 บทเรียนขาด Bar Model" — ตัวเลขนี้มาจาก QA audit แต่ **ข้อมูลจริงในโค้ดคือ 0/238 มี block type นี้** ตัวเลขที่ถูกต้องคือ **238/238 ต้องเพิ่ม** (ถ้าเกณฑ์คือ "ทุกบทเรียนต้องมี bar model") หรือ **152/238** (ถ้าเกณฑ์คือ "เฉพาะหัวข้อที่ต้องใช้ bar model") — **ต้องให้พี่แอร์เลือกเกณฑ์ก่อน**

#### (4) P1: Badge อังกฤษ / เควสไม่มีชื่อ

**สาเหตุจากโค้ด:**
- `app/services/badges.py` มีบันทึกไว้ว่า: *"The `badges` table stores an English `name`/`description` only, so the Thai label, emoji icon and category for each badge code live here"* → badge มีแต่ชื่ออังกฤษใน DB
- `rank_titles.py` มีแต่ชื่อไทย (7 ระดับ: เด็กหลังห้อง → เด็กอัจฉริยะ) → ย้อนกลับไม่ได้

**แผนแก้:**

| รายการ | แนวทาง | Effort |
|---|---|---|
| Badge ชื่อไทย/อังกฤษ | เพิ่ม `name_th`, `name_en`, `icon`, `category` ใน `badges` table (Neon) + migration | 0.25 วัน |
| Badge category | ย้ายจาก `services/badges.py` ที่ hardcode ไว้ → ตาราง `badge_definitions` (หรือ column) | 0.25 วัน |
| Rank title | เพิ่ม `title_en` (7 ระดับ) + `level` int | 0.25 วัน |
| เควสไม่มีชื่อ | `quest_templates.title` มีอยู่แล้ว → แก้ query ให้ join กับ `quest_templates` | 0.25 วัน |
| Membership display | อ่าน `child_profiles.membership_status` + `plan_type` + `access_ends_at` ให้ถูก field | 0.25 วัน |

### 4.5 ขั้นตอนการย้าย Content (ทำตามลำดับ)

| # | ขั้นตอน | Effort | เกณฑ์ |
|---|---|---|---|
| C1 | เขียน `scripts/migrate-content.ts`: อ่านจาก `app/content/math/grade_*` → เขียน R2 + สร้าง `content_items` ใน Neon | 1 วัน | R2 มี 494+ objects, Neon มี 2,798 rows |
| C2 | สร้าง `manifest.json` ที่ระบุ canonical path ของทุกไฟล์ | 0.25 วัน | manifest ครบ 494 รายการ, path ถูกต้อง |
| C3 | ทดสอบ R2 ทุกไฟล์ parse ผ่าน | 0.25 วัน | 100% parse OK |
| C4 | เขียน `content resolver` ใน Hono (R2 + KV cache) | 1 วัน | ตอบได้ภายใน 200ms (warm) |
| C5 | ย้าย sidecar approval (21 รายการ) → `content_items.status` | 0.25 วัน | ตรงกับ sidecar 100% |
| C6 | Admin UI อนุมัติ/ปฏิเสธ + เห็นผลทันที | 1 วัน | approve → `/lessons/{id}` เห็นภายใน 5 วินาที |
| C7 | เติม CPA + Bar Model (pilot 30 → ทยอย 208) | ตามแผนเนื้อหา | ตาม §4.4 |
| C8 | ย้าย `site/homepage` → R2 | 0.25 วัน | `/site/homepage` คืนข้อมูลเดิม |
| C9 | **ลบการพึ่ง filesystem ใน production** | 0.25 วัน | grep `app/content` ใน code path → ไม่มีการอ่านจาก disk |

### 4.6 ความเสี่ยงด้าน Content

| ความเสี่ยง | ระดับ | แผนสำรอง |
|---|---|---|
| งานเติม CPA + Bar Model 238 บทเรียนใหญ่เกิน capacity | 🔴 สูง | แยกเป็น **WS-1b (Content Enrichment)** ทำแยกจาก Phase 1 code — Phase 1 ส่งมอบ schema + renderer + pilot 30 บทเรียน |
| เกณฑ์ Bar Model ไม่ชัดเจน (238 vs 152) | 🟡 กลาง | ต้องให้พี่แอร์ตัดสินใจ — เป็น **คำถามเปิด** ใน §7 |
| sidecar ครอบคลุมแค่ 21/238 → บทเรียนอีก 217 ตัวไม่มีสถานะ | 🟡 กลาง | ตั้ง default `needs_review` + ให้ admin review ทีละหัวข้อ |
| R2 อ่านช้า (cold) | 🟡 กลาง | KV cache + warm-up cron + ETag |
| มีโฟลเดอร์ backup ปนใน content dir | 🟢 ต่ำ | migration script อ่านจาก `manifest` เท่านั้น — ห้าม glob |

---

## 5. Release & Cutover (สรุป)

> รายละเอียดเต็มและ checklist ทีละข้ออยู่ใน **`docs/RELEASE_CUTOVER_CHECKLIST.md`**

### 5.1 หลักการ

1. **Strangler Fig 5 รอบ** — ไม่ตัดบริการเดิมจนกว่ากลุ่มใหม่จะนิ่ง
2. **Rollback = แก้ 1 บรรทัด config** (rewrite) — ไม่ต้อง redeploy
3. **Canary 10% → 50% → 100%** ต่อกลุ่ม endpoint
4. **พิสูจน์ "ปิดเครื่องแล้วยังทำงาน"** เป็นเกณฑ์สุดท้าย

### 5.2 ลำดับ Cutover

```
D-7   เตรียม Neon + R2 + KV + secrets + deploy pipeline        ✅ ต้องเสร็จก่อน
D-5   Deploy Worker (ยังไม่ route traffic) + smoke test ผ่าน Workers URL
D-3   R1: Health/Auth/Static → canary 100% (ความเสี่ยงต่ำ)
D-2   R2: /children → canary 100%
D-1   R3: /me → canary 100% + dashboard ตรงทุกตัวเลข
D0    R4: Learning/Quest/Quiz/Ranking → canary 100% + เล่นจบ 1 รอบจริง
D0    R5: Billing + Admin → canary 100% + ชำระเงินจริง 1 รอบ
D0    ปิด FastAPI → ทดสอบทุก route
D+1   ปิด Docker ทั้งหมด + ปิดเครื่อง → ทดสอบซ้ำ
D+3   ลบ Docker compose, MinIO, Redis, Postgres containers
D+7   เก็บ snapshot ข้อมูล + ปิด branch ที่ไม่ใช้
```

### 5.3 Rollback

| สถานการณ์ | การกระทำ | เวลา |
|---|---|---|
| Worker error > 1% ในกลุ่มใด | ย้อน rewrite ของกลุ่มนั้นกลับ FastAPI | < 5 นาที |
| `/me/dashboard` ผิด | ย้อน R3 ทั้งกลุ่ม | < 5 นาที |
| Billing พัง | ย้อน R5 (ห้ามแก้ webhook ที่รันแล้ว) | < 5 นาที |
| Content หาย | ดึงจาก R2 `versions/2026-11-08/` | < 15 นาที |
| Neon มีปัญหา | หยุด deploy, restore จาก Neon branch (Time Travel 7 วัน) | < 30 นาที |

> ⚠️ **Rollback ที่ย้อนกลับไม่ได้:** webhook Stripe/MPP ที่ประมวลผลแล้ว (idempotency ทำให้ปลอดภัย แต่ข้อมูล entitlement เปลี่ยนแล้ว)

---

## 6. Roadmap (สำหรับพี่แอร์อ่าน)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Phase 0 — ตรวจสอบและวางแผน                          ✅ เสร็จแล้ว          │
│  • ย้าย frontend apps/web → root                                               │
│  • เพิ่ม wrangler.toml + open-next.config.ts                                   │
│  • ตรวจสอบ codebase + หาต้นเหตุ P0 (0/238 บทเรียน)                          │
│  • จัดทำ Phase 1 Execution Plan (เอกสารนี้)                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│  Phase 1 — ย้ายไป Cloudflare ทั้งระบบ              🔄 กำลังทำ (6 สัปดาห์)   │
│                                                                              │
│  WS-0 Cloudflare Foundation      ⬜ รอเริ่ม     (4 วัน)  ← ต้องพี่แอร์ทำ     │
│      └─ ต้องมี Cloudflare account + Neon account (BLOCKER)                   │
│  WS-1 Content Migration          ⬜ รอเริ่ม     (6 วัน)                       │
│      └─ แก้ P0: บทเรียน 0/238 → ≥ 87 หัวข้อ                                │
│  WS-2 Neon + Drizzle             ⬜ รอเริ่ม     (5 วัน)                       │
│  WS-3 Hono API Core              ⬜ รอเริ่ม    (12 วัน)                       │
│  WS-4 Learning & Quest           ⬜ รอเริ่ม     (8 วัน)                       │
│  WS-5 Billing & Webhooks         ⬜ รอเริ่ม     (7 วัน)                       │
│  WS-6 Admin CMS + แก้ P1          ⬜ รอเริ่ม    (10 วัน)                       │
│  WS-7 Frontend + Cutover         ⬜ รอเริ่ม     (8 วัน)                       │
│  ────────────────────────────────────────────────────────────────────────     │
│  ผลลัพธ์: ปิดเครื่อง → topamath.com ยังทำงานได้ ✅                          │
├──────────────────────────────────────────────────────────────────────────────┤
│  Phase 1b — ปรับปรุงเนื้อหา                ⏳ หลัง Phase 1 (แยกงานคอนเทนต์)  │
│  • เติมชั้น Concrete ให้ครบ 231 บทเรียน                                       │
│  • เพิ่ม Bar Model ให้ครบ (238 หรือ 152 — รอพี่แอร์เลือกเกณฑ์)              │
│  • เติม abstract_symbol ที่ขาด 60 บทเรียน                                      │
│  • QA คอนเทนต์ 238 บทเรียน + 2,560 คำถาม                                    │
├──────────────────────────────────────────────────────────────────────────────┤
│  Phase 2 — เติบโต                                                     │
│  • เพิ่มผู้ใช้จริง / ตรวจสอบ Neon Free tier พอไหม                            │
│  • Personalization ด้วย AI (personalized-practice)                            │
│  • Analytics + Leaderboard จังหวัดจริง                                        │
│  • ลด admin endpoint ที่เหลือ / ใช้ CMS ภายนอก                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### สถานะแบบง่าย

| สถานะ | หมายถึง | จำนวน |
|---|---|---|
| ✅ **เสร็จแล้ว** | ตรวจสอบแล้วว่าทำงาน | 5 รายการ |
| 🔄 **กำลังทำ** | Phase 1 ทั้ง 8 workstream | 8 รายการ |
| ⬜ **รออยู่** | ต้องรอพี่แอร์ตัดสินใจ | 4 คำถาม |
| ⏳ **ภายหลัง** | Phase 1b + Phase 2 | 2 รายการ |

**เสร็จแล้ว (5):**
1. ✅ Frontend ย้ายจาก `apps/web` → root แล้ว (Next.js 14 + OpenNext config พร้อม)
2. ✅ `wrangler.toml` + `open-next.config.ts` มีแล้ว (ต้องเพิ่ม bindings)
3. ✅ หาต้นเหตุ P0 "บทเรียน 0/238" ได้แล้ว (238/238 ไฟล์ฝัง `status: needs_review` + production ไม่ใช่ beta)
4. ✅ ยืนยันตัวเลขจริง: 169 endpoints, 39 ตาราง/367 คอลัมน์, 238 บทเรียน, 2,560 คำถาม
5. ✅ ยืนยัน production ปัจจุบัน: topamath.com = stub, api.topamath.com = 502

**กำลังทำ (8):** WS-0 ถึง WS-7 (ดูรายละเอียดข้างบน)

### คำถามเปิดที่รอพี่แอร์ตอบ (4)

| # | คำถาม | ทำไมสำคัญ | แนะนำ |
|---|---|---|---|
| **Q1** | มี Cloudflare account + Neon account พร้อมแล้วหรือยัง? | ถ้าไม่มี = ทุกอย่างหยุด | สร้างทันที — ใช้ Free tier ก็พอสำหรับ Phase 1 |
| **Q2** | เกณฑ์ Bar Model คือ **238/238** (ทุกบทเรียน) หรือ **152/238** (เฉพาะหัวข้อที่ต้องใช้)? | ต่างกัน ~86 บทเรียนของงาน | แนะนำ **เฉพาะหัวข้อที่จำเป็น** — ประหยัดและไม่บังคับเนื้อหา |
| **Q3** | Admin 53 endpoint ที่ตัด — พี่แอร์ใช้หน้า admin ไหนจริงบ้าง? | ถ้าใช้ทุกหน้า → ต้องเขียนเพิ่ม | ขอ inventory 26 หน้า admin |
| **Q4** | จะอนุมัติบทเรียนกี่หัวข้อใน Phase 1? | ยิ่งมาก ยิ่งเสี่ยงเนื้อหาคุณภาพ | แนะนำ **87 หัวข้อ** (ตามรายงาน canonical เดิม) |

---

## 7. ภาคผนวก

### 7.1 ตารางสรุป Effort

| Workstream | งานย่อย | Effort (วัน) | ผู้รับผิดชอบ |
|---|---|---|---|
| WS-0 Cloudflare Foundation | 9 | 4.0 | Rain |
| WS-1 Content Migration | 8 + 3 (pilot) | 6.0 | Milin |
| WS-2 Neon + Drizzle | 6 | 5.0 | Milin |
| WS-3 Hono API Core | 6 | 12.0 | Milin |
| WS-4 Learning & Quest | 6 | 8.0 | Milin |
| WS-5 Billing & Webhooks | 6 | 7.0 | Nina |
| WS-6 Admin CMS + P1 fixes | 10 | 10.0 | Herbiony |
| WS-7 Frontend + Cutover | 7 | 8.0 | Linda + Rain |
| **รวม** | **58** | **60.0 คน-วัน** | |

**ประมาณปฏิทิน:** 6 สัปดาห์ (ทำขนาน 4–5 คน) — เพราะ WS-2/WS-1 ต้องเสร็จก่อน WS-3 และ WS-3 ก่อน WS-4/WS-5/WS-7

### 7.2 Dependency Graph

```
                    ┌─────────────────┐
                    │  WS-0 (4 วัน)   │  ← BLOCKER: ต้องมี Cloudflare + Neon account
                    │  Foundation     │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
     ┌─────────────┐ ┌───────────┐  ┌──────────────┐
     │ WS-2        │ │ WS-1      │  │ WS-6 Admin   │
     │ Neon+Drizzle│ │ Content   │  │ (เริ่มได้    │
     │ (5 วัน)     │ │ (6 วัน)   │  │  พร้อม WS-2) │
     └──────┬──────┘ └─────┬─────┘  └──────┬───────┘
            │              │               │
            └──────┬───────┴───────────────┘
                   ▼
          ┌─────────────────┐
          │  WS-3 (12 วัน)  │  Hono Core
          │  Auth/Me/Children│
          └────────┬────────┘
                   │
       ┌───────────┼───────────┐
       ▼           ▼           ▼
 ┌──────────┐ ┌────────┐ ┌──────────┐
 │ WS-4     │ │ WS-5   │ │ WS-7     │
 │ Learning │ │Billing │ │Frontend  │
 │ (8 วัน)  │ │(7 วัน) │ │(8 วัน)   │
 └──────────┘ └────────┘ └──────────┘
                   │
                   ▼
            ┌─────────────┐
            │   CUTOVER   │
            │  (D-7..D+7) │
            └─────────────┘
```

### 7.3 สิ่งที่ต้องตัดสินใจก่อนเริ่ม (Blocking)

| # | ต้องตัดสินใจ | ตัดสินใจโดย | ก่อนงาน |
|---|---|---|---|
| B1 | มี Cloudflare account + Neon account ไหม | พี่แอร์ | WS-0 |
| B2 | Password hashing บน Workers (10ms CPU) — Web Crypto / Cloudflare Access / ลด rounds | Milin + พี่แอร์ | WS-3 |
| B3 | เกณฑ์ Bar Model 238 vs 152 | พี่แอร์ | WS-1 |
| B4 | อนุมัติบทเรียนกี่หัวข้อใน Phase 1 | พี่แอร์ + ครู | WS-1 |
| B5 | Admin endpoint ที่ตัด 53 ตัว — ใช้จริงไหม | พี่แอร์ | WS-6 |
| B6 | ตาราง billing 4 ตาราง — มีจริงไหม / ต้องสร้างไหม | Nina | WS-5 |

### 7.4 เอกสารอ้างอิง

| เอกสาร | ใช้ทำอะไร |
|---|---|
| `docs/CANONICAL_CONTENT_FINAL_COUNT_VERIFY_REPORT.md` | จำนวน canonical จริง 87 หัวข้อ / 870 คำถาม |
| `docs/CLOUDFLARE_WORKERS_FRONTEND_READINESS_ASSESSMENT.md` | ประเมิน frontend → Workers (Rain) |
| `docs/PRODUCTION_ARCHITECTURE_REVIEW.md` | ข้อจำกัด production เดิม |
| `docs/ADMIN_CONTENT_CMS_AND_APPROVAL_REPORT.md` | flow อนุมัติคอนเทนต์ |
| `docs/STAGING_BLOCKERS_FIX_REPORT.md` | blocker ที่เคยเจอ |
| `docs/RELEASE_CUTOVER_CHECKLIST.md` | checklist cutover ฉบับเต็ม (เอกสารคู่กัน) |

### 7.5 บันทึกการตรวจสอบ (Verification Log)

| รายการ | คำสั่ง | ผลลัพธ์ |
|---|---|---|
| จำนวน endpoint | `curl http://127.0.0.1:8001/openapi.json` | 157 paths / **169 operations** |
| ตาราง DB | `docker exec 4craft-postgres psql -c '\dt'` | **37 rows** |
| ตารางในโค้ด | parse `app/models/*.py` | **39 tables / 367 cols** |
| LOC Python | `find apps/api -name '*.py'` (ไม่รวม venv) | **40,475** (242 ไฟล์) |
| LOC Frontend | `find src -name '*.ts*'` | **23,331** (96 ไฟล์) |
| บทเรียน | นับไฟล์จริง | **238** (119 TH + 119 EP) |
| คำถาม | นับจาก `grade_*/quizzes/` | **2,560** (256 ไฟล์) |
| status ในไฟล์ | สแกนทุก lesson JSON | **238/238 = `needs_review`** |
| sidecar ครอบคลุม | เทียบ key กับไฟล์ | **21/238** |
| CPA ครบ 3 ชั้น | สแกน `visual_blocks` | **7/238** |
| bar_model block | สแกน `visual_blocks[].type` | **0/238** |
| abstract_symbol | สแกน `visual_blocks[].type` | **178/238** |
| production frontend | `curl https://topamath.com/` | `Hello Topa Math!` (9.15s) |
| production API | `curl https://api.topamath.com/health` | **502** |
| local API | `curl http://127.0.0.1:8001/health` | `{"status":"ok"}` |
| wrangler auth | `npx wrangler whoami` | **not authenticated** |
| containers | `docker ps` | api/postgres/redis up; **ไม่มี web container** |

---

**จบเอกสาร**
*เอกสารนี้เป็นแผนงาน ไม่มีการแก้โค้ด ไม่มีการ commit ไม่มีการ deploy*
*เอกสารคู่กัน: `docs/RELEASE_CUTOVER_CHECKLIST.md`*
