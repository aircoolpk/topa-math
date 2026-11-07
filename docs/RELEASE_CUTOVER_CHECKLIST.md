# Topa Math — Release & Cutover Checklist
### จาก Docker (FastAPI) → Cloudflare Workers (Hono + Neon + R2)

| | |
|---|---|
| **เอกสาร** | `docs/RELEASE_CUTOVER_CHECKLIST.md` |
| **วันที่จัดทำ** | 2026-11-08 |
| **ผู้จัดทำ** | Prim (Project Manager) |
| **เอกสารคู่กัน** | `docs/PHASE1_EXECUTION_PLAN.md` |
| **ขอบเขต** | เอกสารแผนงานเท่านั้น — ไม่มีการแก้โค้ด, ไม่มีการ deploy, ไม่มีการเปลี่ยน credentials |

---

## ภาพรวม

```
ก่อน Cutover                              หลัง Cutover
┌──────────────────────────┐              ┌──────────────────────────┐
│ เครื่องพี่แอร์            │              │ Cloudflare (ไม่มีเครื่อง)   │
│                          │   cutover    │                          │
│ 4craft-web (Next)  ──────┼──→ Workers   │  topamath.com            │
│ 4craft-api (FastAPI) ────┼──→ Workers   │  api.topamath.com        │
│ 4craft-postgres  ────────┼──→ Neon      │  Neon (scale-to-zero)    │
│ 4craft-redis    ────────┼──→ (ตัด)      │  R2 (content)            │
│ MinIO (assets)   ────────┼──→ R2         │  KV (cache)              │
│ app/content/*.json ──────┼──→ R2         │                          │
└──────────────────────────┘              └──────────────────────────┘
```

**หลักการ 4 ข้อ**
1. **Rollback = แก้ 1 บรรทัด config** (Next.js rewrites) — ไม่ต้อง redeploy, ไม่ต้อง rebuild
2. **ตัดทีละกลุ่ม** (5 รอบ) — อย่าย้าย 169 endpoint พร้อมกัน
3. **พิสูจน์ด้วยข้อมูลจริงทุกขั้น** — ไม่เชื่อ "ควรจะทำงาน"
4. **เกณฑ์สุดท้าย = ปิดเครื่องแล้วเว็บยังทำงาน**

---

## Phase 0 — Pre-Cutover (D-14 ถึง D-8)

### P0.1 Cloudflare Account

| # | ตรวจสอบ | วิธีทำ | ผ่านเมื่อ |
|---|---|---|---|
| 0.1.1 | มี Cloudflare account | `npx wrangler login` | `wrangler whoami` แสดง email |
| 0.1.2 | Domain อยู่ใน account | `npx wrangler domains list` | เห็น topamath.com |
| 0.1.3 | Billing ไม่ต้องชำระ | Cloudflare Dashboard → Billing | Free plan ใช้ได้ |
| 0.1.4 | API token สร้างแล้ว | `npx wrangler secret list` | เห็น DATABASE_URL, JWT_SECRET |
| 0.1.5 | Workers subdomain ตั้งแล้ว | `npx wrangler subdomain` | ได้ `*.workers.dev` |

> ⛔ **BLOCKER:** ถ้ายังไม่มี account → ทุกอย่างใน Phase 1 หยุดรอ

### P0.2 Neon Account

| # | ตรวจสอบ | วิธีทำ | ผ่านเมื่อ |
|---|---|---|---|
| 0.2.1 | มี Neon account | Neon Console | เห็น project |
| 0.2.2 | สร้าง project `topa-math-prod` | Neon Console | มี project |
| 0.2.3 | ได้ pooled connection string | Neon Console → Connection | มี `-pooler` URL |
| 0.2.4 | ได้ direct connection string | Neon Console → Connection | มี direct URL |
| 0.2.5 | เชื่อมต่อได้ | `psql "$DATABASE_URL" -c 'SELECT 1'` | คืน 1 |
| 0.2.6 | scale-to-zero เปิด | Neon Console | เห็น "Scale to zero" enabled |

### P0.3 Cloudflare Resources

| # | ตรวจสอบ | วิธีทำ | ผ่านเมื่อ |
|---|---|---|---|
| 0.3.1 | R2 bucket `topa-content` | `npx wrangler r2 bucket list` | เห็นชื่อ |
| 0.3.2 | R2 bucket `topa-assets` | เหมือนกัน | เห็นชื่อ |
| 0.3.3 | KV namespace `topa-content-cache` | `npx wrangler kv namespace list` | เห็นชื่อ |
| 0.3.4 | R2 CORS (ถ้ามี browser upload) | R2 Dashboard | ตั้ง allow origin topamath.com |
| 0.3.5 | R2 lifecycle (ลบ version เก่า) | R2 Dashboard | rule: delete versions หลัง 90 วัน |

### P0.4 Secrets

| # | Secret | ที่มา | ตรวจสอบ |
|---|---|---|---|
| 0.4.1 | `DATABASE_URL` | Neon pooled | `wrangler secret list` |
| 0.4.2 | `JWT_SECRET` | เดิมจาก `.env.production` (ต้องเหมือนเดิม ไม่งั้น session เก่าหลุด) | |
| 0.4.3 | `STRIPE_SECRET_KEY` | Stripe Dashboard | |
| 0.4.4 | `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard | |
| 0.4.5 | `MPP_API_KEY` / `MPP_WEBHOOK_SECRET` | MPP | |
| 0.4.6 | `INTERNAL_API_BASE_URL` | เดิม — **ใช้ระหว่าง cutover เท่านั้น ต้องลบทีหลัง** | |

> ⚠️ **ห้ามเปิดเผยค่า secret ในเอกสาร, log, หรือ chat** — ใช้ `wrangler secret put` เท่านั้น

### P0.5 Data Migration (Dry Run)

| # | ตรวจสอบ | ผ่านเมื่อ |
|---|---|---|
| 0.5.1 | Drizzle migration รันบน Neon สำเร็จ | `npx drizzle-kit migrate` ไม่ error |
| 0.5.2 | ตารางครบ 41 | `SELECT count(*) FROM information_schema.tables WHERE table_schema='public'` → 41 |
| 0.5.3 | Row count ตรงกับ Docker Postgres ทุกตาราง | เทียบ script → 0 ต่าง |
| 0.5.4 | `content_items` มี 2,798 แถว | `SELECT count(*) FROM content_items` → 2798 |
| 0.5.5 | R2 มี 494+ objects | `wrangler r2 object list` |
| 0.5.6 | ทุกไฟล์ JSON parse ผ่าน | script scan → 100% |
| 0.5.7 | ทำ backup Postgres เดิม | `pg_dump` เก็บไว้ |

---

## Phase 1 — Deploy & Smoke Test (D-7 ถึง D-5)

### P1.1 Build

| # | ตรวจสอบ | คำสั่ง | ผ่านเมื่อ |
|---|---|---|---|
| 1.1.1 | TypeScript ผ่าน | `npm run lint` (tsc --noEmit) | 0 error |
| 1.1.2 | Next build ผ่าน | `npm run build` | สำเร็จ |
| 1.1.3 | OpenNext build ผ่าน | `npm run cf:build` | สำเร็จ |
| 1.1.4 | Bundle < 64 MiB | `ls -la .open-next/` | เล็กกว่า 64 MiB |
| 1.1.5 | Static assets < 20,000 ไฟล์ | `find .open-next/assets -type f \| wc -l` | < 20000 |
| 1.1.6 | Env vars < 64 | นับใน wrangler.toml + secrets | < 64 |

### P1.2 Deploy (ยังไม่ route traffic)

| # | ตรวจสอบ | คำสั่ง | ผ่านเมื่อ |
|---|---|---|---|
| 1.2.1 | Dry run ผ่าน | `npx wrangler deploy --dry-run` | สำเร็จ |
| 1.2.2 | Deploy สำเร็จ | `npx wrangler deploy` | ได้ URL |
| 1.2.3 | Worker ตอบ | `curl https://topa-math.<subdomain>.workers.dev/health` | `{"status":"ok"}` |
| 1.2.4 | Readiness ผ่าน | `.../health/ready` | `{"status":"ready"}` |
| 1.2.5 | R2 binding ทำงาน | `.../api/_debug/r2` (ชั่วคราว) | คืนรายการ objects |
| 1.2.6 | KV binding ทำงาน | `.../api/_debug/kv` (ชั่วคราว) | อ่าน/เขียนได้ |
| 1.2.7 | Neon binding ทำงาน | `.../api/_debug/db` (ชั่วคราว) | `SELECT 1` → 1 |
| 1.2.8 | ลบ debug endpoints | redeploy | ไม่มี `_debug` |

### P1.3 Smoke Test — Workers URL (ไม่ใช่ production domain)

| # | Route | ผ่านเมื่อ |
|---|---|---|
| 1.3.1 | `GET /` | 200, หน้าแรกจริง (ไม่ใช่ "Hello Topa Math!") |
| 1.3.2 | `GET /health` | 200 `{"status":"ok"}` |
| 1.3.3 | `GET /health/ready` | 200 `{"status":"ready"}` |
| 1.3.4 | `POST /auth/register` | 201, สร้าง user ใน Neon จริง |
| 1.3.5 | `POST /auth/login` | 200 + cookie `topa_session` |
| 1.3.6 | `GET /me/dashboard` (พร้อม cookie) | 200, ไม่ timeout |
| 1.3.7 | `GET /children` | 200, array ถูกต้อง |
| 1.3.8 | `GET /lessons/{id}` (บทเรียนที่ approved) | 200 + body ครบ |
| 1.3.9 | `GET /rankings?grade_level=3` | 200, ไม่ 500 |
| 1.3.10 | `GET /subjects`, `/skills` | 200 |
| 1.3.11 | `GET /site/homepage` | 200, ข้อมูลเดิม |
| 1.3.12 | ทุกหน้า Next.js (50 route) | ไม่มี 5xx |
| 1.3.13 | ทุก static asset | 200, ไม่มี 404 |
| 1.3.14 | CPU time ทุก route | < 8ms (Wrangler logs) |
| 1.3.15 | ไม่มี request ออกนอก Cloudflare | DevTools → Network |

---

## Phase 2 — Strangler Fig: ย้ายทีละกลุ่ม (D-3 ถึง D0)

> **กฎเหล็ก: ย้ายกลุ่มหนึ่ง → ทดสอบ → สังเกต 24 ชม. → ผ่านถึงกลุ่มถัดไป**

### กลไกสลับ

```
1. แก้ next.config.js rewrites:
   beforeFiles: [
     { source: '/api/<กลุ่ม>:path*', destination: `${origin}/<กลุ่ม>:path*` },   ← ย้ายกลุ่มนี้
   ]
2. restart dev server / rebuild
3. ทดสอบ + สังเกต 24 ชม.
4. ผ่าน → ตัด FastAPI route ที่ย้ายแล้ว
   ไม่ผ่าน → ย้อนบรรทัดนั้น (rollback < 5 นาที)
```

### R1 — Health / Auth / Static (D-3)

| # | ตรวจสอบ | ผ่านเมื่อ |
|---|---|---|
| R1.1 | `/health`, `/health/ready`, `/` | 200 ทั้งหมด |
| R1.2 | `/auth/*` (4) | ทุก endpoint ตรง OpenAPI เดิม |
| R1.3 | `/subjects`, `/skills`, `/avatar/items`, `/site/homepage` | 200, ข้อมูลตรงเดิม |
| R1.4 | register → login → me ครบวงจร | สำเร็จ |
| R1.5 | error rate ต่ำกว่า 0.5% ใน 24 ชม. | ✅ |

### R2 — Children (D-2)

| # | ตรวจสอบ | ผ่านเมื่อ |
|---|---|---|
| R2.1 | `/children/*` (20 endpoint) | 200 ทุกตัว |
| R2.2 | Golden test: response shape ตรง FastAPI | 20/20 ตรง |
| R2.3 | เด็ก 3 คนใช้งานได้จริง | ผ่านจาก QA |
| R2.4 | `GET /children/{id}` ของ user อื่น → 403/404 | ไม่ leak ข้อมูล |
| R2.5 | quest complete ทำงาน + idempotent | กดซ้ำไม่เพิ่มซ้ำ |
| R2.6 | error rate < 0.5% ใน 24 ชม. | ✅ |

### R3 — Me (D-1)

| # | ตรวจสอบ | ผ่านเมื่อ |
|---|---|---|
| R3.1 | `/me/*` (35 endpoint) | 200 ทุกตัว |
| R3.2 | **`/me/dashboard` ไม่ timeout** | p95 < 800ms |
| R3.3 | ตัวเลขบน dashboard ตรงทุกตัว | เทียบ SQL 5 ตัวเลข → ตรง |
| R3.4 | badge แสดงชื่อไทย (TH) / อังกฤษ (EP) | ✅ |
| R3.5 | เควสมีชื่อ | ✅ |
| R3.6 | membership แสดงถูก | ✅ |
| R3.7 | XP ไม่เป็น undefined | ✅ |
| R3.8 | บทเรียนใน dashboard ไม่ว่าง (≥ 87 หัวข้อที่อนุมัติ) | ✅ |
| R3.9 | error rate < 0.5% ใน 24 ชม. | ✅ |

### R4 — Learning / Quest / Quiz / Ranking / Share (D0 เช้า)

| # | ตรวจสอบ | ผ่านเมื่อ |
|---|---|---|
| R4.1 | `/lessons/{id}`, `/quiz-sessions/*`, `/rankings`, `/share/*` | 200 ทุกตัว |
| R4.2 | **เล่นจบ 1 รอบจริง** — ตอบถูก → XP เพิ่ม → dashboard อัปเดต | ✅ |
| R4.3 | ตอบถูก 100% ของ 2,560 คำถาม | script ตรวจ |
| R4.4 | `/rankings` คืนข้อมูล (ไม่ว่างเมื่อมีข้อมูล) | ✅ |
| R4.5 | `/rankings?scope=province` ไม่ 500 | ✅ |
| R4.6 | share link เปิดได้ | ✅ |
| R4.7 | error rate < 0.5% ใน 24 ชม. | ✅ |

### R5 — Billing + Admin (D0 บ่าย)

> ⚠️ **ความเสี่ยงสูงสุด — ห้ามตัด FastAPI จนกว่าจะผ่านการชำระเงินจริง 1 รอบ**

| # | ตรวจสอบ | ผ่านเมื่อ |
|---|---|---|
| R5.1 | `/billing/*` (13) | 200 ทุกตัว |
| R5.2 | `/webhooks/stripe` ทดสอบ | 200 + entitlement อัปเดต |
| R5.3 | **ส่ง webhook เดิมซ้ำ 3 ครั้ง** | entitlement ไม่เพิ่มซ้ำ |
| R5.4 | webhook ลงนามผิด | 400/401 ไม่ใช่ 500 |
| R5.5 | MPP checkout (staging) | order ถูกสร้าง |
| R5.6 | **ชำระเงินจริง 1 รอบ (Stripe test)** | membership เปลี่ยนจริง |
| R5.7 | Admin endpoints ใหม่ (~28) | 200 ทุกตัว |
| R5.8 | Admin ทุกหน้า (26) โหลดได้ | ไม่มี 500 |
| R5.9 | Admin เห็นข้อมูลจริงจาก Neon (119 users) | ✅ |
| R5.10 | Admin approve → บทเรียนเห็นทันทีใน 5 วินาที | ✅ |
| R5.11 | Admin write → มีใน admin_audit_logs | ✅ |
| R5.12 | error rate < 0.5% ใน 24 ชม. | ✅ |

---

## Phase 3 — Cutover & DNS (D0)

### C3.1 Route Switch

| # | ตรวจสอบ | ผ่านเมื่อ |
|---|---|---|
| C3.1.1 | ย้าย rewrite ทุกกลุ่มไป Worker | ตรวจทุก source ใน next.config.js |
| C3.1.2 | ยังไม่ลบ `INTERNAL_API_BASE_URL` | ใช้ rollback ได้ |
| C3.1.3 | `curl` ทุก route ผ่าน public domain | 200 ทุกตัว |
| C3.1.4 | ไม่มี request ไปที่ `api.topamath.com` | DevTools → Network |
| C3.1.5 | ตรวจ log: ไม่มี `auth_unauthorized` ผิดปกติ | ✅ |

### C3.2 DNS

| # | ตรวจสอบ | ผ่านเมื่อ |
|---|---|---|
| C3.2.1 | `topamath.com` → Worker route | `npx wrangler routes list` |
| C3.2.2 | `api.topamath.com` → Worker route | เหมือนกัน |
| C3.2.3 | TLS cert ต่ออายุอัตโนมัติ | Cloudflare ใส่ให้ |
| C3.2.4 | DNS propagate ครบ | `dig topamath.com` + `dig api.topamath.com` |
| C3.2.5 | ไม่มี DNS record เก่าชี้เครื่อง | ลบ A record เก่า |

> 💡 **Cloudflare Tunnel / nginx บนเครื่อง:** ถ้าใช้อยู่ → ต้องถอดออกหลังยืนยันว่า Worker รับ traffic จริง

### C3.3 Smoke Test — Public Domain (ทุก route)

| # | Route | ผ่านเมื่อ |
|---|---|---|
| C3.3.1 | `GET /` | 200, หน้าแรกจริง |
| C3.3.2 | `GET /health` | 200 |
| C3.3.3 | `GET /health/ready` | 200 |
| C3.3.4 | `POST /auth/register` | 201 |
| C3.3.5 | `POST /auth/login` | 200 + cookie |
| C3.3.6 | `GET /me/dashboard` | 200 |
| C3.3.7 | `GET /me/lessons` | 200, ไม่ว่าง |
| C3.3.8 | `GET /children` | 200 |
| C3.3.9 | `GET /children/{id}/quests` | 200 |
| C3.3.10 | `GET /lessons/{id}` | 200 |
| C3.3.11 | `GET /rankings?grade_level=3` | 200 |
| C3.3.12 | `GET /subjects` / `/skills` | 200 |
| C3.3.13 | `GET /site/homepage` | 200 |
| C3.3.14 | `GET /billing/prices` | 200 |
| C3.3.15 | `GET /admin/metrics` (admin) | 200 |
| C3.3.16 | **หน้า Next.js ทั้ง 50 route** | ไม่มี 5xx |
| C3.3.17 | **static assets ทุกไฟล์** | ไม่มี 404 |
| C3.3.18 | ไม่มี console error | ✅ |

---

## Phase 4 — Docker Decommission (D+1 ถึง D+3)

### C4.1 ยืนยัน Workers ทำงานครบก่อนถอด Docker

| # | ตรวจสอบ | ผ่านเมื่อ |
|---|---|---|
| C4.1.1 | error rate ใน 24 ชม. หลัง cutover | < 0.5% |
| C4.1.2 | ผู้ใช้จริงใช้งานสำเร็จ | ≥ 3 คน |
| C4.1.3 | ชำระเงินจริงผ่าน | ≥ 1 รอบ |
| C4.1.4 | webhook ทำงานผ่าน Worker | ✅ |

### C4.2 ปิด Docker (ยังไม่ลบ)

```bash
# 1. ปิด compose (เก็บข้อมูลไว้)
cd C:\web-app\4-craft.com
docker compose -f docker-compose.beta.yml stop

# 2. ทดสอบทันทีหลังปิด
curl -s -o /dev/null -w "topamath: %{http_code}\n" https://topamath.com/
curl -s -o /dev/null -w "api health: %{http_code}\n" https://api.topamath.com/health
curl -s -o /dev/null -w "api ready: %{http_code}\n" https://api.topamath.com/health/ready
```

| # | ตรวจสอบ | ผ่านเมื่อ |
|---|---|---|
| C4.2.1 | ทุก route ยัง 200 หลัง `docker stop` | ✅ |
| C4.2.2 | `/health/ready` → `{"status":"ready"}` | ✅ (Neon ไม่ใช่ Docker Postgres) |
| C4.2.3 | บทเรียนยังโหลดได้ (จาก R2 ไม่ใช่ disk) | ✅ |
| C4.2.4 | admin approve/reject ยังทำงาน | ✅ |
| C4.2.5 | ชำระเงินยังทำงาน | ✅ |

### C4.3 ปิดเครื่อง (พิสูจน์เป้าหมายหลัก)

> 🎯 **นี่คือเกณฑ์สำเร็จหลักของทั้งโปรเจกต์**

| # | ตรวจสอบ | ผ่านเมื่อ |
|---|---|---|
| C4.3.1 | บันทึก timestamp ที่ปิดเครื่อง | ✅ |
| C4.3.2 | **ปิดเครื่องทั้งหมด** (shutdown) | ✅ |
| C4.3.3 | รอ 5 นาที (ให้ Neon scale-to-zero) | ✅ |
| C4.3.4 | เปิดเครื่องกลับ → `curl https://topamath.com/` | 200 |
| C4.3.5 | `curl https://api.topamath.com/health` | 200 `{"status":"ok"}` |
| C4.3.6 | **cold start ของ Neon** | query แรก < 2 วินาที |
| C4.3.7 | เข้าเว็บจากมือถือ (4G ไม่ใช่ WiFi) | ใช้งานได้ |
| C4.3.8 | login → dashboard → เล่นบทเรียน → ดูผล | ครบวงจร |

### C4.4 ลบ Docker (D+3)

| # | ตรวจสอบ | ผ่านเมื่อ |
|---|---|---|
| C4.4.1 | `docker compose down` | ไม่มี container ของ Topa |
| C4.4.2 | ลบ volume `4craft-postgres-data` | ✅ (มี backup แล้ว) |
| C4.4.3 | ลบ `docker-compose.beta.yml` (เก็บไว้ใน git history) | ✅ |
| C4.4.4 | ลบ MinIO / Redis config | ✅ |
| C4.4.5 | `docker ps` | ไม่มี container ของ Topa Math |
| C4.4.6 | **เว็บยังทำงานหลังลบ Docker ถาวร** | ✅ |

### C4.5 ลบ dependency ที่ไม่จำเป็น

| # | ตรวจสอบ | ผ่านเมื่อ |
|---|---|---|
| C4.5.1 | `grep INTERNAL_API_BASE_URL` ใน `src/` และ `next.config.js` | 0 รายการ |
| C4.5.2 | ลบ `apps/api` (FastAPI) หลัง backup | ✅ |
| C4.5.3 | ลบ `.env.docker`, `.env.production` (เก็บใน vault) | ✅ |
| C4.5.4 | `docker-compose.dev.yml` ที่ไม่ใช้ | ✅ |

> ⚠️ **ลบ `apps/api` ได้หลัง D+7 เท่านั้น** และหลังมี git tag `pre-workers-cutover` — เก็บไว้เผื่อ rollback

---

## Phase 5 — Post-Cutover (D+1 ถึง D+14)

### C5.1 Monitoring (ต่อเนื่อง)

| # | ตรวจสอบ | เครื่องมือ | ผ่านเมื่อ |
|---|---|---|---|
| C5.1.1 | Error rate | Cloudflare Analytics | < 1% |
| C5.1.2 | CPU time (เกิน 10ms = ปัญหา) | Workers Logs | < 8ms p95 |
| C5.1.3 | Worker invocations / วัน | Cloudflare Analytics | < 100,000 (Free limit) |
| C5.1.4 | D1/KV/R2 operations | Cloudflare Dashboard | ตามโควตา |
| C5.1.5 | Neon compute hours | Neon Console | ไม่เกิน Free tier |
| C5.1.6 | Neon cold start | Neon Console | < 2 วินาที |
| C5.1.7 | `exceededCpu` errors | Workers Logs | 0 |

### C5.2 Alerting (ตั้งก่อน cutover)

| # | แจ้งเตือนเมื่อ | ช่องทาง |
|---|---|---|
| C5.2.1 | Error rate > 2% ใน 5 นาที | Slack/PagerDuty |
| C5.2.2 | `exceededCpu` > 5 ครั้ง/วัน | Slack |
| C5.2.3 | `/health/ready` ≠ 200 | Slack |
| C5.2.4 | Neon storage > 80% | Email |
| C5.2.5 | Worker requests > 80,000/วัน | Email |
| C5.2.6 | R2 read error | Slack |

### C5.3 Maintenance

| # | ตรวจสอบ | รอบ |
|---|---|---|
| C5.3.1 | Neon branch backup อัตโนมัติ | ทุกวัน |
| C5.3.2 | R2 version snapshot | ทุกสัปดาห์ |
| C5.3.3 | `wrangler deployments list` — เก็บ 10 เวอร์ชันล่าสุด | ต่อเนื่อง |
| C5.3.4 | Cron: rank snapshot + streak badge | ทุกวัน 00:00 น. |
| C5.3.5 | Cron: ล้าง cache ที่หมดอายุ | ทุกวัน |

---

## Rollback Playbook

### R.1 หลักการ

> **Rollback ที่เร็วที่สุด = แก้ `next.config.js` rewrites แล้ว rebuild**
> แต่ถ้า rebuild ช้าเกิน 5 นาที → ใช้ **Cloudflare Route** ที่ชี้กลับ

### R.2 ตารางตัดสินใจ

| สถานการณ์ | อาการ | การกระทำ | เวลา |
|---|---|---|---|
| Worker error > 1% | หน้าเว็บพังบางส่วน | ย้อน rewrite กลุ่มที่พัง | < 5 นาที |
| `/me/dashboard` ผิด/timeout | dashboard ใช้ไม่ได้ | ย้อน R3 ทั้งกลุ่ม | < 5 นาที |
| Billing พัง | จ่ายเงินไม่ได้ | ย้อน R5 (อย่าแตะ webhook ที่รันแล้ว) | < 5 นาที |
| Content หาย/ผิด | บทเรียนไม่ขึ้น | ดึงจาก R2 `versions/<date>/` | < 15 นาที |
| Neon มีปัญหา | DB error | หยุด deploy + restore จาก Neon branch (Time Travel 7 วัน) | < 30 นาที |
| D1/KV binding หาย | ตอบผิด | redeploy Worker | < 10 นาที |
| Stripe secret หมดอายุ | webhook 500 | `wrangler secret put` | < 5 นาที |
| ทั้งระบบพัง | — | **ย้อนทั้งหมด + เปิด Docker** | < 30 นาที |

### R.3 ขั้นตอน Rollback (มาตรฐาน)

```bash
# 1. ยืนยันว่าปัญหาอยู่ที่ Worker (ไม่ใช่ Neon/เนื้อหา)
curl -s https://api.topamath.com/health
curl -s https://api.topamath.com/health/ready

# 2. ย้อน rewrite
#    next.config.js → beforeFiles → ย้าย source กลับไปชี้ ${origin}

# 3. Rebuild + deploy
npm run cf:build && npx wrangler deploy

# 4. ยืนยัน
curl -s -o /dev/null -w "%{http_code}\n" https://topamath.com/
```

> ⚠️ **Rollback ที่ย้อนกลับไม่ได้:** webhook Stripe/MPP ที่ประมวลผลแล้ว (ข้อมูล entitlement เปลี่ยนจริง) และข้อมูลที่เขียนเข้า Neon หลัง cutover

### R.4 Emergency: เปิด Docker กลับ (หนึ่งครั้ง)

```bash
cd C:\web-app\4-craft.com
docker compose -f docker-compose.beta.yml up -d

# ยืนยัน
curl -s http://127.0.0.1:8001/health
# แล้วชี้ rewrite กลับไปที่ http://127.0.0.1:8001
```

> ⚠️ ต้องทำให้เสร็จภายใน 24 ชม. — เป้าหมายคือ "ปิดเครื่องแล้วยังทำงาน"

---

## Pre-Flight Checklist (รันทุกครั้งก่อน deploy)

### ความถูกต้อง
- [ ] `npm run lint` → 0 error
- [ ] `npm run cf:build` → สำเร็จ, bundle < 64 MiB
- [ ] Golden test ผ่านทุก endpoint ที่ย้าย
- [ ] `curl /health/ready` → `{"status":"ready"}`

### ข้อมูล
- [ ] Neon row count ตรง Docker Postgres ทุกตาราง
- [ ] `content_items` ≥ 2,798 แถว
- [ ] R2 objects ≥ 494
- [ ] ทุกไฟล์ JSON parse ผ่าน
- [ ] `pg_dump` backup ล่าสุดมีอยู่

### ความปลอดภัย
- [ ] `wrangler secret list` ครบ
- [ ] `JWT_SECRET` เหมือนเดิม (ไม่ทำให้ session เก่าหลุด)
- [ ] Cloudflare Access ปิด admin
- [ ] ไม่มี secret ใน code / log / เอกสาร
- [ ] Webhook signature verification ทำงาน
- [ ] ไม่มี debug endpoint ใน production

### ประสิทธิภาพ
- [ ] CPU time < 8ms ทุก route
- [ ] Subrequests < 50 ทุก request
- [ ] ไม่มี N+1 query (grep query loop)
- [ ] D1/KV ถูกใช้แบบ batch

### การมองเห็น
- [ ] ทุกหน้า Next.js โหลดได้
- [ ] ไม่มี static asset 404
- [ ] mascot/brand ทุกไฟล์โหลดได้
- [ ] ไม่มี mock data ที่หลุดขึ้น production

### การสื่อสาร
- [ ] ประกาศ maintenance window
- [ ] แจ้งทีม QA ให้พร้อมทดสอบ
- [ ] มี rollback plan ที่ทดลองแล้ว (dry run)
- [ ] มีคนเฝ้า (on-call) ตอน cutover

---

## Final Exit Criteria — Phase 1 สำเร็จ

| # | เกณฑ์ | สถานะ |
|---|---|---|
| 1 | `https://topamath.com/` เป็นเว็บจริง ไม่ใช่ stub | ⬜ |
| 2 | `https://api.topamath.com/health` → `{"status":"ok"}` | ⬜ |
| 3 | `https://api.topamath.com/health/ready` → `{"status":"ready"}` | ⬜ |
| 4 | ปิด Docker แล้วทุก route ยัง 2xx | ⬜ |
| 5 | **ปิดเครื่องแล้ว topamath.com ยังใช้ได้จริง** | ⬜ |
| 6 | บทเรียนอนุมัติแล้ว ≥ 87 หัวข้อ แสดงผลได้จริง | ⬜ |
| 7 | นักเรียนทำแบบฝึกหัด → บันทึกคะแนน → เห็นบน Dashboard | ⬜ |
| 8 | Webhook Stripe/MPP ทำงานผ่าน Workers | ⬜ |
| 9 | Admin approve บทเรียน → เห็นผลทันที | ⬜ |
| 10 | ไม่มี P1 defect ค้างจาก 16 ข้อ | ⬜ |
| 11 | CPU time < 8ms, error rate < 1% | ⬜ |
| 12 | ไม่มี Docker container ของ Topa Math | ⬜ |
| 13 | มี monitoring + alerting ตั้งแล้ว | ⬜ |
| 14 | มี rollback ที่ทดลอง dry run แล้ว | ⬜ |
| 15 | เอกสารอัปเดต (README, runbook) | ⬜ |

---

## ภาคผนวก A — คำสั่งที่ใช้บ่อย

```bash
# Deploy
npm run cf:build && npx wrangler deploy
npx wrangler deploy --dry-run
npx wrangler deployments list
npx wrangler rollback [version-id]

# Logs & metrics
npx wrangler tail
npx wrangler deployments status

# Resources
npx wrangler r2 bucket list
npx wrangler r2 object list topa-content
npx wrangler kv namespace list
npx wrangler kv key put --binding=topa-content-cache --remote "key" "value"
npx wrangler d1 execute topa-db --remote --file=./seed.sql

# Secrets
npx wrangler secret list
npx wrangler secret put JWT_SECRET

# Database
npx drizzle-kit generate
npx drizzle-kit migrate

# Docker (rollback / ตรวจสอบข้อมูล)
docker compose -f docker-compose.beta.yml ps
docker compose -f docker-compose.beta.yml stop
docker exec 4craft-postgres psql -U postgres -d adaptive_learning -c '\dt'
docker exec 4craft-postgres pg_dump -U postgres adaptive_learning > backup.sql

# Production checks
curl -s -o /dev/null -w "%{http_code}\n" https://topamath.com/
curl -s https://api.topamath.com/health
curl -s https://api.topamath.com/health/ready
```

## ภาคผนวก B — ผู้รับผิดชอบตามขั้นตอน

| ขั้นตอน | ผู้นำ | ผู้ตรวจสอบ |
|---|---|---|
| P0 Pre-Cutover | Rain | Prim |
| P1 Deploy & Smoke | Rain | Milin |
| R1 Health/Auth | Milin | Linda |
| R2 Children | Milin | Linda |
| R3 Me | Milin | Herbiony |
| R4 Learning | Milin | Herbiony |
| R5 Billing | Nina | Prim |
| C3 Cutover & DNS | Rain | Prim |
| C4 Decommission | Rain | Prim |
| C5 Post-Cutover | Prim | ทั้งทีม |

---

**จบเอกสาร**
*เอกสารนี้เป็น checklist ไม่มีการ deploy จริง*
*เอกสารคู่กัน: `docs/PHASE1_EXECUTION_PLAN.md`*
