# Topa Math — Readiness Assessment: Frontend → Cloudflare Workers (OpenNext vs Pages)

**Audit date:** 2026-11-07
**Project root:** `C:\web-app\4-craft.com`
**Scope:** READ-ONLY audit + preparation plan. No deploy, no `wrangler deploy`, no file/config changes to existing production files, no commit, no container restart/stop.
**Auditor:** DevOps/Infra agent (Rain)

---

## 1) สรุปสถานะปัจจุบัน (Runtime, Versions, วิธี serve ปัจจุบัน)

### 1.1 Toolchain / versions (ที่ตรวจจริง)

| Item | ค่าที่พบ | หมายเหตุ |
|---|---|---|
| Node.js (เครื่อง dev) | **v24.14.0** | ใหม่กว่า Next 14 ที่คาดหวัง — แนะนำ pin Node 20/22 ใน CI |
| npm | **11.9.0** | — |
| Docker Engine | **29.8.0** (Desktop / WSL2) | ใช้งานอยู่จริง |
| wrangler ใน `apps/web` | **3.114.17** (devDep) | มีอยู่แล้ว แต่ **ยังไม่ authenticated** |
| `wrangler whoami` | ❌ **"You are not authenticated"** | **BLOCKER #1** — ต้อง `wrangler login` หรือใช้ `CLOUDFLARE_API_TOKEN` |
| next | **14.2.5** | App Router, `output: 'standalone'` |
| `@cloudflare/next-on-pages` | **1.13.15** (ติดตั้งแล้ว) | ⚠️ **package ถูก deprecate + repo archived** (ยืนยันจาก registry/GitHub README) |
| `@opennextjs/cloudflare` | **ไม่มีในโปรเจกต์** | `npm ls` ยืนยัน: ไม่มีใน dependencies |
| `@opennextjs/cloudflare` (npm) | latest = **1.20.16** | peerDep บังคับ `next >=15.5.29` → **ใช้กับ Next 14.2.5 ไม่ได้** |
| wrangler (npm latest) | 4.158.0 | OpenNext 1.14.x ต้องการ `wrangler ^4.49.1` → **ต้องอัปเกรด wrangler จาก 3.x** |
| `wrangler.toml` / `wrangler.jsonc` | **ไม่มีไฟล์** | ต้องสร้างใหม่ |
| `open-next.config.ts` | **ไม่มีไฟล์** | ต้องสร้างใหม่ |
| Git remote | **ไม่มี remote** (`git remote -v` ว่าง), branch เดียว `master` | **BLOCKER** สำหรับ CI/CD — ไม่มีที่ push และไม่มี GitHub Actions |
| Git สถานะ | **518 ไฟล์ dirty**, HEAD = `7e01f8c` (2026-05-23) | production ไม่ได้รันจาก HEAD นี้ — ดู `docs/TOPA_MPP_PRODUCTION_DEPLOYMENT_READINESS.md` |

### 1.2 สถานะ production ที่ยืนยันด้วย request จริง

| Check | ผล |
|---|---|
| `https://topamath.com/` | **200**, `x-nextjs-cache: HIT`, `Cache-Control: s-maxage=31536000, stale-while-revalidate` |
| `https://topamath.com/ranking` | 200 |
| `https://topamath.com/dashboard` (ยังไม่ login) | 200 (client-side redirect) |
| `https://topamath.com/api/revalidate` (GET) | 405 → route handler มีอยู่จริง |
| `https://api.topamath.com/health` | **200 `{"status":"ok"}`** |
| `https://api.topamath.com/auth/me` (ไม่มี token) | 401 → auth ทำงาน |
| `https://api.topamath.com/openapi.json` | 200, title `4-craft Adaptive Learning API` v0.1.0 |
| MD5 `public api /health` vs `localhost:8001 /health` | **เท่ากัน** (0f047987…) → public API คือ container เดียวกัน |
| DNS `topamath.com` / `api.topamath.com` | ทั้งคู่ชี้ 104.21.62.59 / 172.67.220.162 (Cloudflare proxy) |

### 1.3 Containers ที่เกี่ยวข้อง (docker ps)

```
4craft-web           4craft-beta-4craft-web          Up (healthy)  0.0.0.0:3000->3000  CMD ["node","server.js"]
4craft-api           4craft-beta-4craft-api          Up (healthy)  0.0.0.0:8001->8001  CMD ["uvicorn","app.main:app","--host","0.0.0.0","--port","8001"]
4craft-postgres      postgres:16-alpine               Up (healthy)  5432
4craft-redis         redis:7-alpine                   Up (healthy)  6379
4craft-cloudflared   cloudflare/cloudflared:latest    Up            (no published port)
```

Env ที่ `4craft-web` รันจริง:
```
NEXT_PUBLIC_APP_ENV=production
NEXT_PUBLIC_API_BASE_URL=https://api.topamath.com
INTERNAL_API_BASE_URL=http://4craft-api:8001
NODE_VERSION=20.20.2   NODE_ENV=production
```

### 1.4 เส้นทางข้อมูลจริง (verified by uvicorn access log)

หนูยืนยันด้วยการยิง request จริงแล้วดู uvicorn log ว่า client IP คือใคร:

```
172.18.0.5:34594 - "GET /health HTTP/1.1" 200 OK        ← 172.18.0.5 = 4craft-web
172.18.0.5:34600 - "GET /openapi.json HTTP/1.1" 200 OK ← 172.18.0.5 = 4craft-web
```

**สรุปสถาปัตยกรรมที่ยืนยันแล้ว:**

```
Browser → Cloudflare edge → Tunnel connector (4craft-cloudflared, ingressRule=0)
       → http://4craft-web:3000  (Next.js 14.2.5 standalone)
            ├─ Host: topamath.com        → เสิร์ฟเพจ Next.js
            └─ Host: api.topamath.com    → next.config.js `beforeFiles` rewrite
                                            → http://4craft-api:8001 (FastAPI)
                                                 → postgres / redis
```

- cloudflared logs มีแต่ `originService=http://4craft-web:3000` (58/58 บรรทัด) และ **ไม่มี `api.topamath` เลย** → **ไม่มี ingress rule แยกสำหรับ API**
- `4craft-cloudflared` รันด้วย `--url http://4craft-web:3000` (quick-tunnel style) → **ทุก hostname** ไปที่ web container
- ⚠️ **นี่คือข้อเท็จจริงสำคัญที่สุด**: `api.topamath.com` **ไม่ได้**ชี้ตรงไป FastAPI — มันวิ่งผ่าน Next.js rewrite ก่อน
- ผลกระทบ: ถ้าย้าย frontend ไป Workers แล้ว **API hostname จะพังทันที** ถ้าไม่แก้ routing (ดู BLOCKER C1)

### 1.5 โครงสร้าง frontend (สำหรับข้อสรุบเรื่อง edge/runtime)

| ข้อมูล | ค่า |
|---|---|
| App Router pages | **50** (`find src/app -name page.tsx`) |
| Route handlers | **1** — `src/app/api/revalidate/route.ts` |
| Dynamic routes | **18** (โฟลเดอร์ `[param]`) |
| `export const runtime = 'edge'` | **5 ไฟล์** — `api/revalidate/route.ts`, `share/dashboard/[token]/page.tsx`, `share/dashboard/[token]/opengraph-image.tsx`, `share/test-result/[token]/page.tsx`, `share/test-result/[token]/opengraph-image.tsx` |
| `export const dynamic` | 3 ไฟล์ (`force-dynamic`) |
| Client components | 56/73 `.tsx` |
| Server components ที่ใช้ `fetch` | 4 ไฟล์ (share pages + opengraph) |
| Node builtins ใน `src` | **ไม่พบ** `fs`/`path`/`child_process` — มีแค่ `process.env` (NEXT_PUBLIC_*) และ `TextEncoder` |
| `next/image` usage | **ไม่พบเลย** — ใช้ `<img>`/CSS ล้วน → `images.unoptimized: true` ปลอดภัย 100% |
| `next/font` | ไม่พบ |
| `next/og` (`ImageResponse`) | 2 ไฟล์ (share OG cards) |
| Prerendered routes | 30 routes (`prerender-manifest.json`), `initialRevalidateSeconds: false` → SSG ไม่มี ISR |
| `export const revalidate` | ไม่พบเลย → **ไม่มี ISR time-based** มีแต่ on-demand `revalidatePath` |
| `.next/static` | 2.1 MB · `.next/server` 11 MB · `public/` 7.2 MB / 46 ไฟล์ |
| `fs`/`crypto` ในโค้ด | ไม่มี (crypto มีแค่ `jose` ซึ่งเป็น client-side + WebCrypto) |

---

## 2) เปรียบเทียบทางเลือก A vs B พร้อมข้อเสนอ + เหตุผล

### 2.1 สรุปตารางเปรียบเทียบ

| มิติ | **A) Workers + OpenNext** | **B) Pages + next-on-pages** |
|---|---|---|
| สถานะแพ็กเกจ | Active, อัปเดตล่าสุด 1.20.16 (2026) | ❌ **Deprecated / repo archived** (ยืนยันจาก GitHub README) |
| Runtime | **Node.js runtime** บน workerd + `nodejs_compat` | **Edge runtime เท่านั้น** (Node builtins ที่รองรับมีแค่ buffer/events/assert/util/async_hooks) |
| Next 14.2.5 | รองรับ (ต้อง pin OpenNext **1.14.x**, ไม่ใช่ 1.20.x — เพราะ 1.16+ ตัด Next 14 ออก) | รองรับ แต่ adapter ตายแล้ว |
| Edge runtime ในโค้ด | **ไม่รองรับ** → ต้องถอด `runtime='edge'` ออกทั้ง 5 ไฟล์ | ✅ ต้องมี `runtime='edge'` ในทุก non-static route (18 dynamic route + ISR/API) |
| `output: 'standalone'` | **ต้องเปลี่ยน** → ต้องเอาออก (OpenNext จัดการ standalone เอง) | **ต้องเปลี่ยน** → `standalone` เข้ากันไม่ได้ ต้องใช้ standard output |
| API rewrites (proxy → FastAPI) | ⚠️ `beforeFiles` rewrite + `has: host` **ต้องทดสอบ** — OpenNext ใช้ `path-to-regexp` คนละตัวกับ Next และ regex host ไม่ anchor | ✅ `rewrites` รองรับในเอกสาร next-on-pages |
| ISR / `revalidatePath` | ต้องมี R2 (incremental cache) + D1 (tag cache) + DO queue — คือ 4 resource เพิ่ม | ❌ ISR ทำได้แค่ static fallback (ไม่ regenerate) → `/api/revalidate` **ใช้ไม่ได้จริง** |
| `middleware.ts` | รองรับ (external edge middleware) — แต่โค้ดปัจจุบันเป็น no-op | รองรับ |
| `next/og` ImageResponse | ต้อง patch (OpenNext มี `patch-vercel-og-library.js` ให้อยู่แล้ว) | ต้องระวัง `import.meta.url` crash |
| Static assets | 20,000 ไฟล์/เวอร์ชัน (Free), 25 MiB/ไฟล์ — ที่นี่มี 46 ไฟล์ → **สบายมาก** | 20,000 ไฟล์/ไซต์ (Free), 25 MiB/ไฟล์ → สบายเช่นกัน |
| Rollback | `wrangler rollback <VERSION_ID>` (เก็บ 100 เวอร์ชัน) + gradual deployments % traffic | `wrangler pages deployments rollback` (เก็บได้น้อยกว่า) |
| CI/CD | Workers Builds (GitHub) หรือ GitHub Actions + `wrangler deploy` | Pages Git integration (build ต้องรัน `next-on-pages` ซึ่งใช้ Vercel CLI — เสถียรบน Windows ไม่ดี) |
| CPU time (Free) | **10 ms/request** → SSR หนัก ๆ จะเกิน → ต้อง Paid plan | เหมือนกัน (Pages Functions ใช้ Workers runtime เดียวกัน) |
| Requests (Free) | 100,000/day — **ต้องนับรวม API** ด้วยถ้า proxy API ผ่าน Worker | เหมือนกัน |
| Windows support | มี warning (แนะนำ WSL/Linux CI) | มี warning เดียวกัน (Vercel CLI บน Windows ไม่ reliable) |
| Cloudflare direction | ✅ Cloudflare แนะนำ Workers สำหรับ full-stack; ปัจจุบันแนะนำ **vinext** แม้กระทั่ง OpenNext | ⚠️ Cloudflare ระบุว่า Pages **"not sunsetting"** แต่ **"all of our investment, optimizations, and feature work"** ไปที่ Workers — ไม่มีการลงทุนฟีเจอร์ใหม่บน Pages |

### 2.2 ข้อเสนอ: **เลือก A (Workers + OpenNext) — แต่ต้องเตรียมงานเพิ่ม**

**เหตุผลเชิงวิศวกรรม (เรียงตามน้ำหนัก):**

1. **next-on-pages ถูก deprecate แล้ว — ไม่ควรลง invest ใหม่** การสร้าง pipeline ใหม่บน adapter ที่ archived คือสร้างหนี้เทคนิคที่ต้อง rewrite ทั้งหมดอยู่แล้ว
2. **Edge runtime คือข้อจำกัดตายตัวของ next-on-pages** — ต้องบังคับ `export const runtime = 'edge'` ในทุก non-static route ของโปรเจกต์ที่มี dynamic route 18 ตัว + API route + ISR + middleware ขณะที่ edge runtime ไม่รองรับ ISR ทำให้ `/api/revalidate` (ที่ admin homepage เรียกใช้จริงใน `admin/homepage/page.tsx:82`) **ทำงานไม่ได้**
3. **โปรเจกต์นี้ไม่ต้องการ edge runtime เลย** — ไม่มี Node builtins, ไม่มี `next/image`, ไม่มี `next/font`, ไม่มี ISR time-based, ไม่มี server action → OpenNext (Node runtime) เหมาะกว่าโดยไม่ต้องแก้โค้ด
4. **Rollback ดีกว่า** — Workers เก็บ 100 เวอร์ชัน + gradual deployment (% traffic) ให้ canary ก่อน 100%
5. **Static assets** ของโปรเจกต์เล็ก (46 ไฟล์, 7.2 MB) จึงไม่ติดลิมิตเลย

**ข้อควรระวังที่ต้องบอกตรง ๆ:**
- ทางเลือก A **ไม่ได้ "plug and play"** — มี blocker จริง 4 ระดับ critical (ดู §3) และต้อง pin `@opennextjs/cloudflare@1.14.x` + อัปเกรด `wrangler` 3.114.17 → 4.x
- Cloudflare ปัจจุบันแนะนำ **vinext** มากกว่า OpenNext สำหรับโปรเจกต์ใหม่ แต่ **ไม่แนะนำให้เปลี่ยนตอนนี้** เพราะ vinext อยู่ beta + ต้อง rewrite toolchain + โปรเจกต์นี้ Next 14.2.5 จะต้องขยับไป Next 16 ด้วย → ความเสี่ยงสูงเกินจำเป็น ข้อเสนอคือ **OpenNext ตอนนี้ → ประเมิน vinext ภายหลัง**
- **FastAPI ยังอยู่เดิม** — Workers รองรับ Python แต่จำกัดมากและโปรเจกต์นี้ใช้ SQLAlchemy/PostgreSQL/Redis/MinIO/Stripe → **ไม่ย้าย API** ทิ้งออก (ดู §7 คำถาม)

---

## 3) ตาราง BLOCKERS ที่ต้องแก้ (ระดับ critical/major/minor, ไฟล์, วิธีแก้)

| # | ระดับ | ไฟล์ / จุดที่กระทบ | ปัญหา | วิธีแก้ |
|---|---|---|---|---|
| **C1** | 🔴 **CRITICAL** | Cloudflare Zero Trust → Tunnel public hostnames (นอก repo) | **`api.topamath.com` วิ่งผ่าน Next.js `beforeFiles` host rewrite ไป `4craft-api:8001`** — ยืนยันจาก uvicorn log (client IP = 172.18.0.5 = web) และ cloudflared logs มีแต่ originService เดียว (`4craft-web:3000`) ไม่มี `api.topamath` เลย ถ้าย้าย frontend ไป Workers โดยไม่แก้ routing → **API domain จะ 404/502 ทันที** | ตั้ง Cloudflare Tunnel ingress ให้ `api.topamath.com → http://4craft-api:8001` แยกจาก `topamath.com` (หรือผูก Worker route เฉพาะ `topamath.com` + ให้ tunnel ชี้ API ตรง) **ต้องทำก่อน cutover และต้องมีพี่แอร์อนุมัติ** |
| **C2** | 🔴 **CRITICAL** | `apps/web/next.config.js:3` | **`output: 'standalone'` ขัดกับ OpenNext** — OpenNext ตั้ง standalone เองผ่าน `NEXT_PRIVATE_STANDALONE=true` และอ่านจาก `.next/standalone` คนละโครงสร้าง → build output ผิด | ทำแบบ **conditional** (ดู §4): `output: process.env.NEXT_OUTPUT_STANDALONE === 'true' ? 'standalone' : undefined` แล้ว Docker ใส่ env `NEXT_OUTPUT_STANDALONE=true` (คง Docker เดิมไว้ 100%) ส่วน OpenNext build ปล่อยเป็น default |
| **C3** | 🔴 **CRITICAL** | `apps/web/src/app/api/revalidate/route.ts:5`, `src/app/share/dashboard/[token]/page.tsx:7`, `src/app/share/dashboard/[token]/opengraph-image.tsx:4`, `src/app/share/test-result/[token]/page.tsx:7`, `src/app/share/test-result/[token]/opengraph-image.tsx:4` | **`export const runtime = 'edge'` 5 ไฟล์** — OpenNext **ไม่รองรับ edge runtime** (adapter บังคับ alias `next/dist/compiled/edge-runtime` → empty shim; เอกสารระบุชัดว่า "The edge runtime is not supported") → build/route พัง | ถอดบรรทัด `export const runtime = 'edge'` ออกทั้ง 5 ไฟล์ (ปล่อยให้เป็น Node runtime) **แต่คง `dynamic = 'force-dynamic'` ไว้** และต้อง smoke-test `next/og` (OG image) หลังแก้ เพราะ ImageResponse อยู่บน edge path เดิม |
| **C4** | 🔴 **CRITICAL** | `apps/web/package.json` (devDeps) | **Version matrix ไม่ compatible**: `@opennextjs/cloudflare@1.20.16` (latest) บังคับ `next >=15.5.29` → **Next 14.2.5 ใช้ไม่ได้**; ตัวที่รองรับ Next 14 คือ **1.14.2–1.15.1** ซึ่งต้องการ `wrangler ^4.49.1` แต่โปรเจกต์มี **wrangler 3.114.17** | pin `@opennextjs/cloudflare@1.14.4` (peer: `next 14 - 14.2` ✅) + อัปเกรด `wrangler` เป็น `^4.49.1` (เลข 4.158.0 ล่าสุด). หมายเหตุ: 1.14.5+ บังคับ `next ^14.2.35` → ถ้าอยากอยู่ 1.15.1 ต้องอัป Next เป็น 14.2.35 ด้วย |
| **M1** | 🟠 **MAJOR** | Cloudflare account (ไม่มีใน repo) | **`wrangler whoami` → not authenticated** → deploy ทำไม่ได้ | `wrangler login` (interactive) หรือตั้ง `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` เป็น GitHub Actions secret. **ต้องให้พี่แอร์ login เอง** (อย่าส่ง token ในแชท) |
| **M2** | 🟠 **MAJOR** | `apps/web/next.config.js:14-19` | **API proxy rewrites 2 กลุ่มที่ต้องจัดการ**: (ก) `beforeFiles` catch-all ที่ match `has: host api.topamath.com` — ถ้า Worker รับเฉพาะ `topamath.com` rule นี้จะไม่มีผลและอาจชน regex ของ OpenNext (host regex ไม่ anchor ใน OpenNext → มีประสบการณ์ redirect loop); (ข) rewrite `/auth/:path*`, `/quiz-sessions/:path*`, `/subjects`, `/skills`, `/rankings`, `/avatar/:path*`, `/health` → `INTERNAL_API_BASE_URL` ซึ่งเป็น **Docker-internal hostname ที่ Worker มองไม่เห็น** | สร้าง `API_ORIGIN` แยก: Worker ใช้ `https://api.topamath.com` (public) ส่วน Docker ยังใช้ `http://4craft-api:8001`; ตัด rewrite ที่ไม่จำเป็นออก และ **ทดสอบ host rewrite บน staging จริง** (host routing ต้อง deploy ไปทดสอบ เพราะ wrangler dev ตัด Host header) |
| **M3** | 🟠 **MAJOR** | `apps/api/app/core/config.py:24-27`, `apps/api/app/routers/auth.py:34-45,117-124` | **Cookie/session semantics ต้องตัดสินใจ**: `AUTH_COOKIE_DOMAIN` ว่างใน `.env.docker` → cookie เป็น host-only ของ `api.topamath.com`; `AUTH_COOKIE_SECURE=true`, `AUTH_COOKIE_SAMESITE=lax` → **cross-site XHR จะไม่แนบ cookie** และ `api-client.ts` ตั้ง `withCredentials: true` + bearer token ผสม localStorage → ถ้า Worker เสิร์ฟโดเมนคนละโซน (เช่น `topamath.com` vs `api.topamath.com` ยัง same-site แต่ `*.workers.dev` คนละ site) → **login/session จะพัง** | ตัดสินใจ 2 ข้อ: (1) โดเมนปลายทางสุดท้าย (2) ถ้าข้ามโซน → ต้อง `AUTH_COOKIE_SAMESITE=none` + `AUTH_COOKIE_SECURE=true` + `AUTH_COOKIE_DOMAIN=.topamath.com` **และ** เพิ่ม `CORS_ORIGINS` ให้ครบ (ตอนนี้ = `https://topamath.com,https://www.topamath.com`) |
| **M4** | 🟠 **MAJOR** | `apps/web/src/app/api/revalidate/route.ts` + `apps/web/src/app/admin/homepage/page.tsx:82` | **On-demand revalidation ต้องมี cache bindings**: `revalidatePath('/')` บน Workers ต้องมี R2 incremental cache + D1 tag cache (+ DO queue) มิฉะนั้น revalidate ไม่มีผลจริง (admin กด save แล้วหน้าไม่ refresh) | สร้าง R2 bucket + D1 database + DO queue ตาม §4 และ config `open-next.config.ts` ให้ครบ 3 ตัว |
| **M5** | 🟠 **MAJOR** | repo root (git) | **ไม่มี git remote + ไม่มี `.github/`** → CI/CD แบบ GitHub Actions ทำไม่ได้ทันที; อีกทั้ง working tree มี **518 ไฟล์ dirty** และ HEAD ไม่ใช่ release ที่ deploy อยู่ | สร้าง remote + branch `release/web-workers` + commit เฉพาะงาน migration; **ห้าม commit จนกว่าพี่แอร์อนุมัติ** |
| **M6** | 🟠 **MAJOR** | `apps/web/src/app/pricing/page.tsx:502`, `billing/page.tsx:528`, `admin/error.tsx:34`, `dashboard/lessons/[lessonId]/page.tsx:225`, `dashboard/tests/[sessionId]/page.tsx:923` | **`process.env.NEXT_PUBLIC_JWT_SECRET`** ใน `src/lib/auth.ts:24` เป็น client-side (`'use client'`) → secret ถูก inline เข้า browser bundle อยู่แล้ว (pre-existing issue, ไม่ใช่ของ Cloudflare) — แต่ **ต้องระวังว่า `NEXT_PUBLIC_*` ทั้งหมดถูก inline ณ build time** บน Workers | ตรวจว่าไม่มี secret อื่นถูก prefix `NEXT_PUBLIC_` โดยผิด; ระบุใน checklist ว่า build-time vars ≠ runtime vars บน Workers Builds |
| **m1** | 🟡 **MINOR** | `apps/web/src/middleware.ts` | Middleware เป็น **no-op** (อ่านแล้วไม่ทำอะไร — คืน `NextResponse.next()` ทุกกรณี) แต่ยังถูก build เป็น edge middleware แยก (external) → เพิ่ม bundle + เพิ่มจุดแตก | พิจารณาลบไฟล์ หรืออย่างน้อยตัด dead code (อย่าลบในเฟสแรก ถ้าอยากลดความเสี่ยง) |
| **m2** | 🟡 **MINOR** | `apps/web/src/app/ranking/page.tsx:26`, `app/dashboard/lessons/[lessonId]/page.tsx:1039` | `useSearchParams()` ใน client component — ปลอดภัยใน Next 14 แต่เป็นจุดที่พังบน Next 15+ (ต้องมี Suspense boundary) → ติดตามตอนอัปเวอร์ชัน Next | บันทึกเป็น known issue สำหรับ Next 16 migration |
| **m3** | 🟡 **MINOR** | `apps/web/src/app/share/*/opengraph-image.tsx` | `next/og` + `ImageResponse` ต้องการ `@vercel/og` — OpenNext มี AST patch ให้อยู่แล้ว แต่ **ยังไม่ได้ทดสอบจริง** (ไม่ deploy) | รวมใน smoke test: request OG URL แล้วตรวจว่าได้ PNG ไม่ใช่ 500 |
| **m4** | 🟡 **MINOR** | `apps/web/public/` (7.2 MB, 46 ไฟล์) | ไม่มีปัญหา (ลิมิต 25 MiB/ไฟล์) แต่ `.png` หนัก ๆ จะถูก serve โดย Worker (นับ request) เว้นแต่เป็น static asset (ฟรี) | ตรวจว่า asset ทั้งหมดอยู่ใน `.open-next/assets` (ไม่โดน Worker ดัก) |
| **m5** | 🟡 **MINOR** | `docker-compose.beta.yml` (working tree) | ไฟล์ compose ที่ commit ไว้ **ต่างจากที่รันจริง**: commit มี `4craft-web` service + cloudflared `--url http://4craft-web:3000`; running container ตรงกับ commit; แต่ `deploy/compose.production.candidate.yml` ชี้ `env_file: ../.env.production.release` ซึ่ง**ยังไม่มีใน repo** | กำหนด release manifest + ตรวจ env file ของ production จริงก่อน cutover |
| **m6** | 🟡 **MINOR** | `apps/web/src/app/admin/content/page.tsx`, `admin/dashboard/page.tsx`, `admin/lessons/[lessonId]/page.tsx`, `admin/qa/page.tsx`, `admin/questions/page.tsx`, `admin/students/page.tsx`, `admin/tests/by-lesson/[lessonId]/page.tsx`, `admin/tests/[testId]/page.tsx` | 8 ไฟล์เป็น server component (ไม่มี `'use client'`) และ import จาก `@/lib/api/*` ซึ่งใช้ **axios** — ถ้ามีการเรียก API ฝั่ง server ต้องยืนยันว่า axios ทำงานใน Workers (Node runtime + `nodejs_compat` → ใช้ได้ แต่ต้อง smoke test) | รวมใน smoke test ของ `/admin/*` |

---

## 4) ตัวอย่าง wrangler.toml ฉบับเตรียม (code block — **ยังไม่ save ลงดิสก์**)

> Path ที่จะวาง: `apps/web/wrangler.toml`
> **หมายเหตุสำคัญ:** ค่า `main`, `assets.directory`, `r2 bucket_name`, `d1 database_id`, `worker name` เป็น placeholder — ต้องเปลี่ยนตอนสร้างจริง และ `compatibility_date` ต้องเป็นวันที่ deploy จริง (ไม่เก่ากว่า 2024-09-23)

```toml
# apps/web/wrangler.toml
# Topa Math frontend — Cloudflare Workers via OpenNext
# STATUS: DRAFT / NOT DEPLOYED. Requires approval from พี่แอร์ before any deploy.

name = "topa-web"
main = ".open-next/worker.js"
compatibility_date = "2026-11-07"          # ต้องเป็นวันที่ deploy จริง; ต้อง >= 2024-09-23
compatibility_flags = ["nodejs_compat"]    # Node.js APIs (fs-less) + รองรับ Next Node runtime
upload_source_maps = true
workers_dev = false                        # ไม่เปิด *.workers.dev เพื่อลด surface; ใช้ custom domain เท่านั้น

[assets]
directory = ".open-next/assets"
binding = "ASSETS"
# run_worker_first = ["/api/*", "/_next/*"]  # เปิดเฉพาะเมื่อต้องให้ middleware/rewrite ทำงานกับ asset
#                                       (ปิดไว้ก่อน = static asset ฟรี ไม่นับ request)

# Self-reference สำหรับ R2 incremental cache + D1 tag cache + revalidation queue
[[services]]
binding = "WORKER_SELF_REFERENCE"
service = "topa-web"

# --- ISR / revalidatePath bindings (BLOCKER M4) ---
# npx wrangler r2 bucket create topa-web-next-cache
[[r2_buckets]]
binding = "NEXT_INC_CACHE_R2_BUCKET"
bucket_name = "topa-web-next-cache"

# npx wrangler d1 create topa-web_next_d1_next_cache   (database_id จาก output)
[[d1_databases]]
binding = "NEXT_TAG_CACHE_D1"
database_name = "topa-web_next_d1_next_cache"
database_id = "REPLACE_WITH_D1_DATABASE_ID"

[[durable_objects.bindings]]
name = "NEXT_CACHE_DO_QUEUE"
class_name = "DOQueueHandler"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["DOQueueHandler"]

# --- API proxy target (BLOCKER M2) ---
# Worker ต้องเรียก API ผ่าน public URL เท่านั้น (Docker hostname มองไม่เห็นจาก Workers)
[vars]
NEXT_PUBLIC_APP_ENV = "production"
NEXT_PUBLIC_API_BASE_URL = "https://api.topamath.com"
NEXT_PUBLIC_APP_URL = "https://topamath.com"
API_ORIGIN = "https://api.topamath.com"

# ถ้าไม่ใช้ Cloudflare Images (โปรเจกต์นี้ไม่มี next/image → ไม่ต้อง)
# [images]
# binding = "IMAGES"

[observability]
enabled = true

# --- Custom domain (ต้องผูกใน Dashboard หรือ deploy) ---
# routes = [
#   { pattern = "topamath.com",    custom_domain = true },
#   { pattern = "www.topamath.com", custom_domain = true },
# ]
#
# ⚠️ api.topamath.com ต้องผูกกับ Tunnel → 4craft-api:8001 (BLOCKER C1)
#    ห้ามผูกกับ Worker นี้ เว้นแต่พี่แอร์อนุมัติให้ API วิ่งผ่าน Worker

# --- Environment: production (สร้างด้วย `wrangler secret put`) ---
# NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY  → build var (public)
# JWT / Stripe secret / API token      → secret (ห้าม commit)
```

**ไฟล์คู่ที่ต้องสร้าง (`apps/web/open-next.config.ts`):**

```ts
import { defineCloudflareConfig } from '@opennextjs/cloudflare'
import r2IncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache'
import doQueue from '@opennextjs/cloudflare/overrides/queue/do-queue'
import d1NextTagCache from '@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache'

export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  queue: doQueue,
  tagCache: d1NextTagCache,
  enableCacheInterception: true,
})
```

**`apps/web/next.config.js` (ฉบับแก้ — BLOCKER C2 + M2):**

```js
/** @type {import('next').NextConfig} */
const apiOrigin = process.env.API_ORIGIN || process.env.INTERNAL_API_BASE_URL || 'https://api.topamath.com'
const parsed = new URL(apiOrigin)
if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
  throw new Error('API_ORIGIN must be an origin without credentials')
}

const nextConfig = {
  // Docker ใช้ standalone เดิม; OpenNext build ต้อง default output
  output: process.env.NEXT_OUTPUT_STANDALONE === 'true' ? 'standalone' : undefined,
  reactStrictMode: true,
  images: { unoptimized: true },   // โปรเจกต์นี้ไม่มี next/image → ปลอดภัย
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/:path*', has: [{ type: 'host', value: 'api.topamath.com' }], destination: `${parsed.origin}/:path*` },
        ...['/auth/:path*', '/quiz-sessions/:path*', '/subjects', '/skills', '/rankings', '/avatar/:path*', '/health']
          .map(source => ({ source, destination: `${parsed.origin}${source}` })),
      ],
      afterFiles: [],
      fallback: [],
    }
  },
}
module.exports = nextConfig
```

**`apps/web/package.json` (script ที่ต้องเพิ่ม):**

```json
{
  "scripts": {
    "cf:build": "opennextjs-cloudflare build",
    "cf:preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview",
    "cf:deploy": "opennextjs-cloudflare build && opennextjs-cloudflare deploy",
    "cf:typegen": "wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts"
  },
  "devDependencies": {
    "@opennextjs/cloudflare": "1.14.4",
    "wrangler": "^4.49.1"
  }
}
```

---

## 5) แผน CI/CD + คำสั่ง deploy + rollback (ลำดับขั้น)

### 5.1 Phase 0 — Prerequisites (ต้องพี่แอร์อนุมัติ)

```
P0.1  พี่แอร์ login Cloudflare  →  wrangler login   (หรือสร้าง API Token + Account ID)
P0.2  ตัดสินใจโดเมนปลายทาง: topamath.com เป็น Worker custom domain? api.topamath.com คง tunnel?
P0.3  สร้าง remote git + branch + commit งาน migration
P0.4  ตัดสินใจ Workers plan: Free (100k req/day, 10ms CPU) vs Paid ($5/mo, 10M req, 30s CPU)
P0.5  สร้าง Cloudflare resources: R2 bucket + D1 database (+ DO queue มากับ deploy)
P0.6  เลือก staging hostname: เช่น topa-web-staging.topamath.com (Worker) โดย API ยังชี้ production API
```

### 5.2 Phase 1 — Code changes (ทำบน branch, ยังไม่ deploy)

```
S1.1  next.config.js    → conditional output (C2) + API_ORIGIN (M2)
S1.2  ถอด runtime='edge' จาก 5 ไฟล์ (C3)
S1.3  package.json      → @opennextjs/cloudflare@1.14.4 + wrangler ^4.49.1 + scripts (C4)
S1.4  สร้าง wrangler.toml + open-next.config.ts (C1/M4) → ใส่ .gitignore: .open-next/ .wrangler/
S1.5  Dockerfile        → เพิ่ม ARG/ENV NEXT_OUTPUT_STANDALONE=true (คง Docker เดิม)
S1.6  (พิจารณา) ลด unused middleware
S1.7  npx tsc --noEmit  (npm run lint) + npm run build ผ่าน
```

### 5.3 Phase 2 — Local verification (ไม่แตะ production)

```
S2.1  npm ci
S2.2  npm run cf:build                  → ต้องเห็น .open-next/worker.js + .open-next/assets
S2.3  npx wrangler deploy --dry-run --outdir bundled
        → ตรวจ "Total Upload" ต้อง < 64 MiB (Free) และดูขนาด bundle จริง
S2.4  npm run cf:preview                → ทดสอบใน workerd runtime
S2.5  Smoke test ใน preview:
        - /            → 200 HTML
        - /login /register /pricing /lessons /ranking
        - /dashboard   → 200 (redirect logic ฝั่ง client)
        - /share/dashboard/<token> → 200 + OG PNG
        - /api/revalidate GET → 405
```

### 5.4 Phase 3 — Staging deploy (ต้องมี domain ที่แยกจาก prod)

```
S3.1  npx wrangler deploy --env staging     (หรือ worker name topa-web-staging)
S3.2  ผูก custom domain: topa-web-staging.topamath.com
S3.3  ยิง smoke test ทั้งชุดที่ staging (ดู §6)
S3.4  ทดสอบ login จริง: register → login → /dashboard → /billing → admin flow
S3.5  ทดสอบ API จาก staging: Network tab ต้องเห็น https://api.topamath.com + withCredentials OK
S3.6  ตรวจ Workers Logs (observability) ว่าไม่มี 500
S3.7  ทดสอบ host rewrite บน staging (ต้อง deploy จริง — wrangler dev ตัด Host header)
```

### 5.5 Phase 4 — Cutover (มี approval จากพี่แอร์เท่านั้น)

```
CUT.1  ยืนยัน tunnel ingress: api.topamath.com → http://4craft-api:8001  (C1)  ← ทำก่อน!
CUT.2  npx wrangler versions upload                → สร้าง version ใหม่ (ยังไม่ deploy)
CUT.3  npx wrangler versions deploy <NEW>@10% -y   → canary 10%
CUT.4  สังเกต 15-30 นาที: error rate, latency, login/quiz flow
CUT.5  npx wrangler versions deploy <NEW>@100% -y  → เต็ม
CUT.6  ผูก Worker custom domain: topamath.com (+ www)
CUT.7  ปิด container 4craft-web (ยังไม่ลบ — เก็บไว้ rollback)  ← ต้อง approval
CUT.8  smoke test ชุดเต็มบน production
```

### 5.6 Rollback

```bash
# 1) Rollback Worker version (เก็บ 100 เวอร์ชัน)
npx wrangler rollback <VERSION_ID> --message "rollback: topa-web 2026-11-07"

# 2) ถ้าใช้ gradual deployment
npx wrangler versions deploy <STABLE_VERSION_ID>@100% -y

# 3) ถ้าต้องกลับไป Docker ทั้งหมด
#    - ถอด Worker route / custom domain ของ topamath.com (Dashboard)
#    - คืน tunnel ingress เดิม (api.topamath.com + topamath.com → 4craft-web:3000)
#    - docker compose -f docker-compose.beta.yml up -d 4craft-web   (ต้อง approval!)
#    - ยืนยัน curl -sI https://topamath.com/ มี x-nextjs-cache

# 4) ดู deployment history
npx wrangler deployments list
npx wrangler versions list
```

### 5.7 CI/CD — GitHub Actions (ต้องมี remote ก่อน)

`.github/workflows/deploy-web-workers.yml` (ตัวอย่าง — **ยังไม่สร้าง**):

```yaml
name: deploy-web-workers
on:
  pull_request:
    paths: ['apps/web/**']
  push:
    branches: [main]
    paths: ['apps/web/**']
  workflow_dispatch:

concurrency:
  group: topa-web-deploy
  cancel-in-progress: false

jobs:
  verify:
    runs-on: ubuntu-latest          # Linux CI — Windows ไม่ reliable สำหรับ OpenNext
    defaults: { run: { working-directory: apps/web } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20.20.2', cache: npm, cache-dependency-path: apps/web/package-lock.json }
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npm run cf:build
      - run: npx wrangler deploy --dry-run --outdir bundled
      - uses: actions/upload-artifact@v4
        with: { name: open-next-build, path: apps/web/.open-next }

  deploy-production:
    needs: verify
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    environment: production          # ← ใส่ required reviewers ใน Settings → Environments
    permissions: { contents: read, id-token: write }
    defaults: { run: { working-directory: apps/web } }
    env:
      CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
      CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
      NEXT_PUBLIC_APP_ENV: production
      NEXT_PUBLIC_API_BASE_URL: https://api.topamath.com
      NEXT_PUBLIC_APP_URL: https://topamath.com
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: ${{ vars.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20.20.2', cache: npm, cache-dependency-path: apps/web/package-lock.json }
      - run: npm ci
      - run: npm run cf:build
      - run: npx wrangler versions upload
      - run: npx wrangler versions deploy --yes --message "sha=${{ github.sha }}"
```

> ⚠️ บน Workers Builds (Cloudflare-hosted CI) ต้องตั้ง **Build variables** แยกจาก **Runtime variables** — `NEXT_PUBLIC_*` ถูก inline ตอน build ถ้าไม่ใส่ใน build stage ค่าจะเป็น string ว่างใน bundle

---

## 6) Checklist ก่อน cutover และ verification plan

### 6.1 Pre-cutover checklist

**โค้ด & config**
- [ ] `next.config.js`: `output` เป็น conditional (`NEXT_OUTPUT_STANDALONE`) — Docker path ยังให้ `standalone`
- [ ] ถอด `export const runtime = 'edge'` ครบ 5 ไฟล์ และยืนยันด้วย `grep -rn "runtime *= *'edge'" apps/web/src` → ต้อง 0
- [ ] `package.json`: `@opennextjs/cloudflare@1.14.4` + `wrangler@^4.49.1` (peer ตรงกับ `next@14.2.5`)
- [ ] `wrangler.toml` + `open-next.config.ts` ครบ: ASSETS, WORKER_SELF_REFERENCE, R2, D1, DO queue
- [ ] `.gitignore` เพิ่ม `.open-next/`, `.wrangler/`, `cloudflare-env.d.ts`
- [ ] Dockerfile ใส่ `NEXT_OUTPUT_STANDALONE=true` → **Docker production เดิมต้องยัง build+run ได้ปกติ (regression test)**

**Cloudflare**
- [ ] `wrangler whoami` → authenticated, account ถูกตัว
- [ ] R2 bucket `topa-web-next-cache` สร้างแล้ว
- [ ] D1 `topa-web_next_d1_next_cache` สร้างแล้ว + `database_id` ใส่ใน wrangler.toml
- [ ] Secrets set: `wrangler secret put <NAME>` (ไม่ commit ลง repo)
- [ ] Custom domain `topa-web-staging.topamath.com` ผูกแล้ว (ไม่ชนกับ prod)
- [ ] **Tunnel ingress แยก `api.topamath.com` → `http://4craft-api:8001`** (C1)
- [ ] เลือก plan (Free/Paid) และเช็ค quota กับ traffic จริง

**API**
- [ ] `AUTH_COOKIE_SECURE=true` (ยืนยันแล้วใน `.env.docker`)
- [ ] `AUTH_COOKIE_SAMESITE` + `AUTH_COOKIE_DOMAIN` สอดคล้องกับโดเมนปลายทาง (M3)
- [ ] `CORS_ORIGINS` ครอบคลุม origin ที่ใช้จริง (รวม staging ถ้าจะทดสอบ auth)
- [ ] `FRONTEND_BASE_URL` / `BACKEND_BASE_URL` ตรงกับ domain สุดท้าย

**Ops**
- [ ] มี release manifest (image digest ปัจจุบัน + commit ที่ deploy) เพื่อ rollback ได้
- [ ] `docker ps` ยืนยัน container ปัจจุบัน healthy (baseline)
- [ ] มี screenshot/log ของ health check ก่อน cutover เพื่อเทียบหลัง cutover
- [ ] ประกาศ maintenance window + ผู้ติดต่อฉุกเฉิน

### 6.2 Verification plan — health check

```bash
# baseline (ก่อน cutover)
curl -sI https://topamath.com/            | grep -E 'HTTP/|x-nextjs-cache|cache-control'
curl -s  https://api.topamath.com/health
curl -sI https://topamath.com/login

# หลัง cutover (Worker)
curl -sI https://topamath.com/            | grep -E 'HTTP/|cf-cache-status|server'
curl -s  https://api.topamath.com/health  # ต้องยัง 200 {"status":"ok"}  ← C1 verification
curl -sI https://topamath.com/login
npx wrangler deployments list             # ดูว่า version ไหน active
npx wrangler tail topa-web                # ดู log สด
```

### 6.3 Verification plan — smoke test ทุก route

**Public (12 route):**
`/` · `/login` · `/register` · `/pricing` · `/lessons` · `/ranking` · `/dashboard` · `/dashboard/affiliate` · `/dashboard/referral` · `/billing` · `/billing/success` · `/not-found` (404)

**Dynamic (18 route) — ต้องมี id จริง:**
`/dashboard/lessons/[lessonId]` · `/dashboard/tests/[sessionId]` · `/children/[childId]` · `/children/[childId]/avatar` · `/children/[childId]/placement` · `/children/[childId]/quiz` · `/children/[childId]/quiz/[sessionId]` · `/children/[childId]/rankings` · `/children/[childId]/result/[sessionId]` · `/admin/users/[id]` · `/admin/lessons/[lessonId]` · `/admin/tests/[testId]` · `/admin/tests/by-lesson/[lessonId]` · `/admin/content/grade/[grade]` · `/admin/content/lesson/[lessonId]` · `/billing/payments/[orderId]` · `/share/dashboard/[token]` · `/share/test-result/[token]`

**Admin (22 route):**
`/admin` · `/admin/dashboard` · `/admin/children` · `/admin/content` · `/admin/content-quality` · `/admin/content/questions` · `/admin/generated-content` · `/admin/homepage` · `/admin/lessons` · `/admin/payment-integration-test` · `/admin/qa` · `/admin/questions` · `/admin/referrals` · `/admin/revenue` · `/admin/settings` · `/admin/students` · `/admin/subscriptions` · `/admin/system` · `/admin/tests` · `/admin/affiliates`

**API proxy (7 path ที่ rewrite):**
`/health` · `/auth/me` · `/quiz-sessions/...` · `/subjects` · `/skills` · `/rankings` · `/avatar/...`

**Functional (ต้องทำด้วย browser จริง):**
- [ ] register → auto login → token ถูกเก็บ → `/dashboard` โหลดข้อมูลจริง
- [ ] login → reload → session ยังอยู่ (ทดสอบ cookie path)
- [ ] เล่น quiz จบ 1 รอบ → บันทึก session → `/dashboard/tests/[sessionId]` เห็นผล
- [ ] avatar upload → `/children/[childId]/avatar` เห็นรูปใหม่
- [ ] admin: แก้ Homepage config → Save → กด revalidate → หน้า `/` อัปเดต (**ทดสอบ M4**)
- [ ] OG image: `/share/dashboard/<token>` → og:image ต้องเป็น PNG 200 (**ทดสอบ C3/m3**)
- [ ] Stripe checkout flow (billing) → redirect กลับมา OK
- [ ] Admin login/reset password flow

**Load/soak (ถ้าเลือก plan ที่จำกัด):**
- [ ] 10 req/วินาทีต่อ route ที่สำคัญ 5 นาที → ไม่มี 429/5xx
- [ ] ตรวจ Workers request count ว่าไม่เกิน 100,000/วัน (Free) และ API traffic ถูกนับรวมหรือไม่

---

## 7) คำถามที่ต้องการคำตอบจากพี่แอร์ก่อนดำเนินการ

1. **โดเมนปลายทาง:** `topamath.com` (apex) และ `www.topamath.com` จะผูกเป็น Worker custom domain ทั้งคู่ไหม? (ตอนนี้ CORS อนุญาตทั้งสอง)
2. **`api.topamath.com` จะคงอยู่ที่ Tunnel→FastAPI หรือย้ายเข้า Worker?** — ข้อเสนอ: **คงไว้ที่ Tunnel** เพราะ FastAPI ยังอยู่บนเครื่อง home + Postgres/Redis ที่นั่น และเป็นการตัดความเสี่ยงสูงสุดออกจาก scope
3. **Workers plan:** Free (100k req/day, 10ms CPU/req) หรือ Paid ($5/เดือน, 10M req, 30s CPU)? — ผู้เขียนแนะนำ **Paid** เพราะ SSR + revalidate ของ Next มีโอกาสเกิน 10ms CPU และ request จะรวม API traffic
4. **Traffic ปัจจุบันเท่าไหร่/วัน?** เพื่อคำนวณ quota — ตอนนี้ยังไม่มีการวัด (ไม่มี analytics binding)
5. **Secret ที่ต้องใส่ใน Worker:** ยืนยันรายการ — `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (build var), `API_ORIGIN` (var), และ secret ฝั่ง server ถ้ามี (ตอนนี้โค้ด server-side ใช้แค่ `NEXT_PUBLIC_JWT_SECRET` ซึ่งเป็น client-side อยู่แล้ว → ควรแก้เรื่องนี้ด้วย)
6. **Staging domain:** จะใช้ `topa-web-staging.topamath.com` หรือชื่ออื่น? (ต้องไม่ชนกับ production และต้องเพิ่มใน `CORS_ORIGINS` ถ้าจะทดสอบ auth flow)
7. **Git remote:** จะสร้าง GitHub repo ที่ไหน / ใช้ชื่ออะไร? (ตอนนี้ `git remote -v` ว่าง → CI/CD ทำไม่ได้จนกว่าจะมี remote) และจะ commit 518 ไฟล์ dirty อย่างไร (มีไฟล์ที่ควรไม่เข้า repo ไหม?)
8. **Docker production จะคงไว้เป็น fallback กี่นาน?** ข้อเสนอ: คง `4craft-web` container ยังไว้ (ไม่ลบ) อย่างน้อย 2 สัปดาห์หลัง cutover เพื่อให้ rollback ได้เร็ว
9. **`vinext` vs `OpenNext`:** ยืนยันว่าใช้ **OpenNext** ตอนนี้ (ปลอดภัยกว่า, Next 14 ได้) และย้ายไป vinext/Next 16 ภายหลัง — หรือพี่แอร์อยากกระโดดไป Next 16 เลย (งานชุดใหญ่กว่ามาก: async cookies/headers, React 19, middleware→proxy)
10. **เกณฑ์อนุมัติ:** ใครเป็นผู้อนุมัติ production cutover และ environment protection rules ใน GitHub จะตั้งเป็นใคร?

---

## ภาคผนวก A — สิ่งที่หนูตรวจแล้ว (verified) vs ยังไม่ได้ตรวจ (not tested)

**Verified ด้วยคำสั่ง/ผลลัพธ์จริง:**
- Node v24.14.0 / npm 11.9.0 / Docker 29.8.0
- wrangler 3.114.17 (local binary) · `whoami` → not authenticated
- `@opennextjs/cloudflare` ไม่มีในโปรเจกต์ · ไม่มี wrangler.toml/jsonc · ไม่มี open-next.config.ts
- peerDependencies matrix ของ @opennextjs/cloudflare ทุกเวอร์ชัน (ดึงจาก npm registry) → ข้อจำกัด Next 14 ยืนยันแล้ว
- source code ของ `@opennextjs/cloudflare@1.14.4` + `@opennextjs/aws@3.9.4` → ยืนยันว่า edge runtime ถูก alias เป็น empty shim, standalone ถูกจัดการผ่าน `NEXT_PRIVATE_STANDALONE`
- source code ของ `@cloudflare/next-on-pages@1.13.15` → ยืนยัน error message "The following routes were not configured to run with the Edge Runtime"
- docker ps / docker inspect ของ 5 container
- cloudflared logs (58 บรรทัด originService) → ยืนยันไม่มี ingress แยกสำหรับ API
- uvicorn access log หลังยิง request จริง → ยืนยัน API ถูกเรียกจาก IP ของ web container
- curl จริง: topamath.com (200 + cache headers), api.topamath.com/health (200), /auth/me (401), /openapi.json (200), MD5 เท่ากัน
- next.config.js, middleware.ts, api/revalidate/route.ts, auth.ts, public-env.ts, api-client.ts, auth.py, config.py — อ่านทั้งไฟล์
- นับ route/page/route-handler/dynamic-route/edge-runtime จริงใน src
- `.next/prerender-manifest.json` + `routes-manifest.json` → ยืนยัน rewrite ที่ compile ออกมาแล้ว และไม่มี ISR
- git: ไม่มี remote · 518 ไฟล์ dirty · HEAD 7e01f8c

**NOT TESTED (ต้องทำใน Phase 2/3 หลังแก้โค้ด):**
- `npm run cf:build` จริง (ยังไม่มี @opennextjs/cloudflare และยังไม่ได้แก้ config)
- bundle size จริง (`wrangler deploy --dry-run`)
- `next/og` OG image บน Workers (ยังไม่ deploy)
- host rewrite บน staging (wrangler dev ตัด Host header — ต้อง deploy จริง)
- login/session flow ข้าม origin (ต้อง staging)
- ISR/revalidatePath จริง (ต้องมี R2+D1+DO)

**Files modified by this audit:** ไม่มีไฟล์ production ใดถูกแก้ — เขียนรายงานนี้ไฟล์เดียว (`docs/CLOUDFLARE_WORKERS_FRONTEND_READINESS_ASSESSMENT.md`)
**Deploys performed:** 0 · **Containers restarted/stopped:** 0 · **Commits:** 0
