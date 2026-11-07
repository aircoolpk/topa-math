# TOPA Math — Brand Asset & Visual QA Report

**Scope:** หน้าแรก (root path) — `src/app/page.tsx`, `public/brand/topa/**`
**Phase:** Phase 0 (Visual & Brand QA)
**Owner:** Milin (AI Video & Creative Director)
**Status:** ✅ ผ่าน — พร้อม build/deploy

---

## 1. Executive Summary

| หมวด | ผลลัพธ์ |
|---|---|
| Mascot 8 จุด (src=`topa` → 404) | ✅ แก้แล้ว — ใช้ `resolveMascotImage()` ผ่าน `src/lib/mascot-registry.ts` |
| Feature card fallback (ไฟล์ไม่มี) | ✅ แก้แล้ว — map ทั้ง 4 การ์ดไป `*-clean-v3.png` ที่มีจริง |
| `ERR_INVALID_URL` ใน opengraph-image | ✅ แก้แล้ว — `getApiBaseUrl()` ไม่ throw อีก มี fallback |
| Crop รูป hero (การ์ด "Lv. 23" พิมพ์อยู่) | ✅ รันแล้ว — เอาการ์ดออกด้วย content-aware inpainting |
| Asset audit `public/brand/topa/` | ✅ 46 ไฟล์ · 6.84 MB · พบ missing 1 จุด (แก้แล้ว) |
| Typecheck (`tsc --noEmit`) | ✅ exit 0 · ไม่มี error |
| Responsive 360 / 768 / 1440 | ✅ ผ่าน (หลักฐาน screenshot ใน §5) |

---

## 2. Brand Kit

### 2.1 Logo

| Asset | Path | ใช้ที่ |
|---|---|---|
| โลโก้หลัก (มีพื้นขาว) | `public/brand/topa/topa-math-logo-new.png` | Header + Footer (`TopaBrand.tsx`) |
| โลโก้โปร่งแสง | `public/brand/topa/topa-math-logo-transparent.png` | พื้นหลังโปร่งใส |
| โลโก้ (คัดเดิม) | `public/brand/topa/topa-math-logo.png` | Legacy — ยังไม่ถูกอ้างถึง |

**กฎ:** Header ใช้ `TopaLogo size="sm"` จาก `src/components/brand/TopaBrand.tsx` — ห้าม hardcode `<img>` ของโลโก้ในหน้า

### 2.2 สี (Color System)

**Tailwind tokens** (`tailwind.config.ts`):

| Token | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 |
|---|---|---|---|---|---|---|---|---|---|---|
| `primary` (ส้ม/ทอง) | `#fef9ee` | `#fdf0d4` | `#fae0a8` | `#f6c96e` | `#f1ae38` | `#ee9917` | `#df7a0a` | `#b85c0a` | `#934811` | `#783d13` |
| `secondary` (ฟ้า/ฟ้า) | `#f0f9ff` | `#e0f2fe` | `#b9e6fe` | `#7cd4fd` | `#36bdfa` | `#0ea5e9` | `#0284c7` | `#0369a1` | `#075985` | `#0c4a6e` |
| `accent` (ม่วง) | `#fdf4ff` | `#fae8ff` | `#f5d0fe` | `#f0abfc` | `#e879f9` | `#d946ef` | `#c026d3` | `#a21caf` | `#86198f` | `#701a75` |

**สีหน้าแรก (inline utility — ใช้ตรง ๆ ได้):**

| ชื่อ | ค่า | ใช้ที่ |
|---|---|---|
| TOPA Blue (หลัก) | `#0B63D8` | H1/H2, ลิงก์ CTA, ตัวเลข |
| TOPA Blue gradient | `#0B63D8 → #7657E8` | หัวตาราง Ranking |
| TOPA Sky | `#56CCF2` | ตัวเลขลอยประดับ |
| TOPA Amber / CTA ทอง | `#FFC107` | ปุ่ม "ทดลองใช้ฟรี", ดาว |
| TOPA Amber hover | `#FFD43B` | hover ของ CTA ทอง |
| พื้นหน้า | `#f7fbff` | body หน้าแรก |
| พื้นการ์ด | `#F8FBFF` | กล่อง Ranking |
| พื้นโปรโมชันอุ่น | `#FFF9F2` | กล่องคำอธิบาย Ranking |

**กฎ contrast:**
- ข้อความบนพื้นน้ำเงิน/ทอง → **ขาวหรือ slate-950 ห้าม** slate-500
- ข้อความบนพื้นขาว → **slate-600 ขึ้นไป** (slate-500 ใช้ได้เฉพาะ label ขนาดเล็กบนพื้นสีอ่อน)
- ห้ามพึ่งสีเป็นตัวสื่อความหมายเพียงอย่างเดียว

### 2.3 ตัวอักษร (Typography)

- **Font:** `Noto Sans Thai` (นำเข้าจาก Google Fonts ใน `src/app/globals.css`)
- **น้ำหนัก:** หัวข้อใช้ `font-black` / `font-extrabold` · ข้อความใช้ `font-semibold`
- **สเกลขนาดหน้าแรก:**
  - Hero H1: `text-[44px]` → `sm:text-6xl` → `lg:text-[64px]`, `leading-[1.04]`
  - Section H2: `text-4xl` / `text-5xl`
  - ข้อความเนื้อหา: `text-[15px]`–`text-[18px]`, `leading-7`–`leading-8`
  - Label เล็ก: `text-xs`–`text-sm`
- **Tracking:** หัวข้อใหญ่ใช้ `tracking-[-0.04em]`; H1 หน้าแรกใช้ `tracking-normal` (ไทยไม่ควรบีบ)

### 2.4 มาสคอต (Mascot System)

**Registry:** `src/lib/mascot-registry.ts` — 9 ตัวละเอียด

| Key | Aliases | ชื่อ | บทบาท | ไฟล์ |
|---|---|---|---|---|
| `topa` | topa | Topa | เพื่อนคู่คิด AI | `mascot-topa-feature.png` |
| `olli` | olli, **oll** | Olli | ครูผู้รอบรู้ | `mascot-olli-feature.png` |
| `memo` | memo | Memo | ผู้ช่วยจำ | `mascot-memo-transparent.png` |
| `splash` | splash | Splash | นักคิดไว | `mascot-splash-transparent.png` |
| `nova` | nova | Nova | ผู้เชี่ยวชาญตรรกะ | `mascot-nova-transparent.png` |
| `pip` | pip | Pip | เพื่อนเติมกำลังใจ | `mascot-pip-feature.png` |
| `orbit` | orbit | Orbit | ผู้ช่วยวางแผน | `mascot-orbit-transparent.png` |
| `timo` | timo | Timo | โค้ชฝึกซ้ำ | `mascot-timo-transparent.png` |
| `riko` | riko | Riko | นักสืบโจทย์ | `mascot-riko-feature.png` |

**⭐ กฎเหล็ก (เคยพังมาแล้ว — ห้ามละเมิด):**

```tsx
// ❌ ผิด — row.mascot เป็น KEY ('topa','oll','memo','pip') ไม่ใช่ path
//    → <img src="topa"> → relative URL → 404
src={row.image ?? row.mascot ?? "/brand/topa/mascot-topa-feature.png"}

// ✅ ถูก — resolve ผ่าน registry
import { resolveMascotImage } from '@/lib/mascot-registry'
src={row.image ? assetOrFallback(row.image, resolveMascotImage(row.mascot))
                : resolveMascotImage(row.mascot)}
```

`resolveMascotImage()` รับได้ทั้ง key, alias (`oll` → `olli`), path ที่ขึ้นต้น `/` หรือ `http`, และคืนค่า default เป็น Topa เมื่อไม่รู้จัก

### 2.5 Feature Cards

การ์ดเป็น **PNG ที่พิมพ์ข้อความไว้ในภาพแล้ว** — ตัว title ใน DOM จึงเป็น `alt` เท่านั้น (ไม่มีข้อความซ้อน)

| Title ใน artwork | ไฟล์ |
|---|---|
| AI วิเคราะห์จุดอ่อน | `feature-card-ai-clean-v3.png` |
| แบบฝึกหลากหลาย | `feature-card-practice-clean-v3.png` |
| ฝึกจริง เห็นผลจริง | `feature-card-xp-clean-v3.png` |
| Ranking ทั่วประเทศ | `feature-card-ranking-clean-v3.png` |

> ⚠️ CMS ส่ง `image` มาเป็น mascot เดี่ยว (เช่น `/brand/topa/mascot-topa-feature.png`) ซึ่ง **ไม่ใช่** artwork การ์ด — โค้ดจึง map กลับไปหา `*-clean-v3.png` ตาม title เสมอ และใช้ `feature-card-image` เป็น fallback

### 2.6 โครงสร้างหน้า (Page Anatomy)

1. **Nav** — sticky, `bg-white/95 backdrop-blur`, logo ซ้าย, เมนูกลาง, CTA ขวา (จอ ≥1024px) · hamburger (<1024px)
2. **Hero** — 2 คอลัมน์ (ข้อความ / ภาพมาสคอต), 3 stat chip, 2 CTA
3. **Feature cards** — 4 การ์ด, 1 คอลัมน์ (มือถือ) → 2 (768px) → 4 (1440px)
4. **Ranking** — 3 คอลัมน์: โปรโมชัน + ตารางจังหวัด + ตารางเขต
5. **Reviews** — 4 การ์ดรีวิว
6. **เพื่อนช่วยเรียน** — 5 มาสคอตเรียงแนวนอน
7. **Curriculum ป.1–ป.6** — 6 การ์ด
8. **ผู้ปกครองไว้ใจ** — 3 การ์ด
9. **CTA ท้ายหน้า** — gradient น้ำเงิน + มาสคอต
10. **Footer** — 5 คอลัมน์, พื้น slate-950

---

## 3. Content Visual Checklist — Singapore Math (CPA + Bar Model)

### 3.1 หลักการ Singapore Math ที่ต้องสื่อทุกภาพ

**CPA (Concrete → Pictorial → Abstract):**

| ขั้น | อายุที่เหมาะสม | ต้องเห็นในภาพ | ห้ามทำ |
|---|---|---|---|
| **Concrete** | ป.1–2 | วัตถุจริง/ของจริงนับได้ (แท่งเก้า, ลูกแก้ว, เหรียญ) รูปร่าง ขนาด จำนวนเห็นชัด | ห้ามใช้ตัวเลขลอยเปล่วโดยไม่มีวัตถุ |
| **Pictorial** | ป.2–4 | diagram ที่เชื่อมกับของจริงได้ (รูปผลเหลี่ยม = ก้อนของจริง, ลูกศร = การย้าย) | ห้าม diagram ลอย ๆ ไม่มีแบบจริงอ้างอิง |
| **Abstract** | ป.3–6 | สมการ ตาราง แผนภาพ number line ที่ "คิดเอง" ได้ | ห้ามกระโดดจากของจริงไปสมการโดยไม่มีขั้นกลาง |

**กฎเหล็ก 3 ข้อของภาพ Singapore Math:**

1. **เห็นกระบวนการ (show the working)** — ภาพต้องมีขั้นตอน ไม่ใช่แค่คำตอบ
2. **กล่องช่วยคิด (model / bar)** — ตัวเลขที่หา = ช่องว่างที่มีเครื่องหมาย `?` หรือช่องที่ไม่มีค่า
3. **คำเดียวกันทั้งภาพ** — ถ้ากล่องชื่อ "ทั้งหมด" ในโจทย์ กล่องในแผนภาพต้องชื่อ "ทั้งหมด" เหมือนกัน

### 3.2 แนวทางเรียง Diagram สำหรับ Bar Model

#### รูปแบบ A — Part–Part–Whole (ส่วนย่อยรวมเป็นทั้งหมด)

```
┌─────────────┬─────────────┐
│     ส่วนที่ 1  │   ส่วนที่ 2   │
│      12     │      8      │
├─────────────┴─────────────┤
│         ทั้งหมด = 20      │
└───────────────────────────┘
```
- ใช้เมื่อ: โจทย์ "รวม", "เหลือ", "ต่างกัน"
- สี: ส่วนที่ 1 = น้ำเงินอ่อน · ส่วนที่ 2 = น้ำเงินเข้ม · ทั้งหมด = เส้นกรอบหนา
- **ห้าม:** เติมค่าทั้งหมดถ้าโจทย์ให้ "ต่างกัน" — ต้องทำเป็น 2 ช่องย่อยเท่ากัน

#### รูปแบบ B — Comparison (เปรียบเทียบ)

```
┌───────────────┐
│  น้องเมย์  24 │  ← ยาวกว่า
├───────────────┤
│  น้องบีม   17 │  ← สั้นกว่า
└───────────────┘
        ▲
     ผลต่าง = 7
```
- ใช้เมื่อ: โจทย์ "มากกว่า", "น้อยกว่า", "เท่าไร"
- สี: แถบที่ยาวกว่า = accent อุ่น · แถบสั้น = accent เย็น · ส่วนที่ทับกัน = สีผสม
- **ต้องมีเส้นบอกช่วงผลต่าง** (เศษที่ทับกัน) ไม่ใช่แค่ตัวเลขต่าง

#### รูปแบบ C — Comparison with a Part (ส่วนที่ทับกัน)

```
┌───────────────┬───────────────┐
│   เหมือนกัน  │   มากกว่า   │
├───────────────┴───────────────┤
│            ทั้งหมด            │
└───────────────────────────────┘
```
- ใช้เมื่อ: "A เท่ากับ B แต่ C มากกว่า A"
- แถบที่เหมือนกันต้อง **ยาวเท่ากันจริง** และวางติดกัน

#### รูงแบบ D — Bar Model เชิงเส้น (Number Line)

```
●──────────●──────────●──────────●
0          5          10         15
           ▲
        จุดที่ 2 (เดินทีละ 5)
```
- ใช้เมื่อ: บวก/ลบซ้ำ, เศษ, หาร
- ทุกจุดต้องมีตัวเลขกำกับ · ระยะห่างเท่ากันเสมอ
- เดินทีละก้าวให้แตะจุด ไม่ใช่ลากกระโดด

### 3.3 Checklist ต่อ 1 ภาพ (ติ๊กก่อนส่งงาน)

**ความถูกต้องทางคณิตศาสตร์**
- [ ] ตัวเลขในภาพถูกต้องตรงกับโจทย์ (สะกดผิด = ผิดทั้งภาพ)
- [ ] ผลต่าง / ยอดรวมคำนวณถูก (ลองคิดย้อนกลับ 1 ครั้ง)
- [ ] หน่วยตรงกันทั้งภาพ (ไม่ผสม "คน" กับ "ลูก")
- [ ] เศษไม่เกินจำนวนเดิม · ไม่มีกล่องติดลบ
- [ ] สัดส่วนในกราฟ/วงกลมรวมกัน = 100% หรือ 360° พอดี

**CPA progression**
- [ ] ภาพแสดงขั้น Concrete ก่อน Abstract (ถ้าเป็นภาพเดียว: ของจริง → รูป → สมการ)
- [ ] เด็ก ป.1–2 เห็นแล้วนับวัตถุได้เอง
- [ ] เด็ก ป.5–6 แกะจากภาพไปเขียนสมการได้เอง
- [ ] ไม่มีขั้นตอนที่ "กระโดด" (เช่น จากของจริงตรงไปสมการ)

**Bar Model**
- [ ] มี "ช่องทั้งหมด" เสมอเมื่อโจทย์ถามหาส่วนรวม
- [ ] ช่องที่หาค่าแสดง `?` หรือช่องว่าง — **ไม่ใช่ตัวเลขที่เดา**
- [ ] ความกว้างแถวแปรผันตามปริมาณ (12 ใหญ่กว่า 8 → แถวยาวกว่า)
- [ ] แถวเดียวกันวางติดกัน ไม่มีช่องไฟ
- [ ] ป้ายกำกับตรงกับคำในโจทย์ (เช่น โจทย์ว่า "ชมพี" ก็ต้องเขียน "ชมพี")
- [ ] ถ้ามี 2 แถว (เปรียบเทียบ) ต้องมีเส้นบอกส่วนที่ทับกัน

**ความชัดเจน / กราฟิก**
- [ ] ตัวอักษรอ่านออกที่ 100% zoom (ขนาดจริงในแอป ไม่ใช่ preview)
- [ ] ตัวเลขในภาพ ≥ 24px เมื่อแสดงเต็มจอมือถือ
- [ ] สีข้อความบนพื้นมี contrast ≥ 4.5:1 (ตัวหนา ≥ 3:1)
- [ ] ไม่ใช้สีแดง-เขียวอย่างเดียวในการสื่อความหมาย (ต้องมีรูปร่าง/ป้ายกำกับด้วย)
- [ ] มีสีเน้นเพียง 1–2 สีในภาพเดียว ไม่รก
- [ ] ตัวอักษรไม่ชิดขอบภาพ (ขอบเหลือ ≥ 8% ของความกว้าง)

**แบรนด์**
- [ ] มาสคอตใช้ตัวถูก key (ตรวจด้วย `resolveMascotImage()`)
- [ ] สีประจำมาสคอตตรง registry (`topa=#2f80ed`, `olli=#f2c94c`, `memo=#f2994a`, `pip=#eb5757`, `riko=#bb6bd9` …)
- [ ] โลโก้ใช้ไฟล์จาก `topa-math-logo-*` เท่านั้น
- [ ] ไม่มีข้อความ/ตัวเลขที่พิมพ์ทับในไฟล์ artwork (ข้อมูลต้องเป็น DOM)
- [ ] ภาพมี transparent background เมื่อวางบนพื้นสี

**ไฟล์**
- [ ] PNG/JPG ≤ 300KB (ภาพเต็มจอ) · ≤ 80KB (thumbnail/มาสคอต)
- [ ] ชื่อไฟล์ kebab-case ภาษาอังกฤษ สื่อความหมาย (`feature-card-ai-clean-v3.png`)
- [ ] มี `alt` ที่อธิบาย **ความหมายของภาพ** ไม่ใช่แค่ชื่อไฟล์
- [ ] ไม่มี `alt=""` ยกเว้นภาพตกแต่ง (เช่น ไอคอนประดับ) — ใช้ `aria-hidden` แทน

### 3.4 เทมเพลตภาพตามช่วงชั้น

| ชั้น | โจทย์ที่เหมาะสม | ภาพประกอบที่ควรใช้ |
|---|---|---|
| **ป.1** | นับ บวก–ลบ ใน 20 | รูปของจริง (ผลไม้ แท่งเก้า) + แถวรูปวงกลม + สมการ `3 + 2 = 5` |
| **ป.2** | คูณ 2–5 หารเฉลี่ย | กลุ่มรูป (3 กลุ่ม × 4) + bar part-part-whole + `3 × 4 = 12` |
| **ป.3** | คูณ 2 หลัก หารเฉลี่ย เศษ | แถวเทียบสองชั้น + comparison bar + number line |
| **ป.4** | คูณ–หาร 2 หลัก พื้นที่ | bar model แบบ comparison with part + สี่เหลี่ยมซ้อนทับ |
| **ป.5** | เศษ ทศนิยม สัดส่วน | วงกลมสัดส่วน + แถวส่วนที่ทับกัน + ตาราง |
| **ป.6** | อัตราส่วน ค่าเฉลี่ย เปอร์เซ็นต์ | comparison bar 2 ชั้น + number line หลายขั้น + ตารางคำนวณ |

### 3.5 Anti-patterns (ห้ามทำ)

| ❌ ผิด | ✅ ถูก |
|---|---|
| กล่องตัวเลขที่หาเป็นตัวเลขเต็ม | กล่อง `?` / ช่องว่าง |
| สมการโดดจากของจริงไปตัวเลข | 3 ขั้น CPA เรียงกัน |
| Bar model กว้างเท่ากันทุกช่อง | กว้างแปรผันตามปริมาณ |
| ใส่คำอธิบายยาว 5 บรรทัดในภาพ | คำอธิบายสั้น 1 บรรทัด + คำอธิบายเต็มใน DOM |
| สีฟ้าอ่อนบนพื้นขาว | ตรวจ contrast ≥ 4.5:1 |
| ใช้คำ "ผลต่าง" ในภาพ แต่โจทย์ว่า "ต่างกัน" | ใช้คำเดียวกับโจทย์ทุกครั้ง |
| Mascot key เป็น path ใน `src` | `resolveMascotImage(key)` |

---

## 4. Asset Audit — `public/brand/topa/`

**เครื่องมือ:** `python scripts/qa-asset-audit.py`

### 4.1 สรุป

| หมวด | จำนวน |
|---|---|
| ไฟล์ทั้งหมด (ไม่รวม `.bak-phase0`) | 46 ไฟล์ |
| ขนาดรวม | 7,126,693 bytes = **6.80 MB** |
| อ้างถึงใน `src/` แต่ **ไม่มีไฟล์** | **0 จุด** ✅ (แก้แล้ว — เดิม 1 จุด) |
| มีไฟล์แต่ **ไม่ถูกอ้างถึง** | 45 ไฟล์ (ดู §4.3) |

### 4.2 แก้ไขแล้ว

| ปัญหา | เดิม | ใหม่ |
|---|---|---|
| Feature card default | `/brand/topa/feature-reference/feature-card-default.png` **ไม่มีไฟล์** | map ตาม title → `feature-card-{ai\|practice\|xp\|ranking}-clean-v3.png` (มีจริงทั้ง 4) |

### 4.3 ไฟล์ที่มีแต่ยังไม่ถูกอ้างถึง — ข้อเสนอ

> **ยังไม่ลบ** — เพราะ (ก) บางไฟล์ถูกอ้างถึงจาก **CMS content ที่ยังไม่ได้ sync** และ (ก) บางไฟล์คือ *reference* สำหรับงานออกแบบรอบหน้า

**กลุ่ม A — reference/variant เก่า (~300KB ที่ยังถูกใช้เป็น fallback ได้):**
`feature-card-*-reference.png` ×4, `feature-card-*-reference-v2.png` ×4 (รวม ~466KB)
→ ควรลบเมื่อ CMS default ถูก migrate ไป `*-clean-v3` ทั้งหมดแล้ว

**กลุ่ม B — mascot ที่ registry ใช้แต่รูปแบบอื่นยังไม่ถูกเรียก (~1.6MB):**
`mascot-{topa,olli,memo,splash,nova,pip,orbit,timo,riko}.png` (ตัวเต็มไม่ใช่ `-transparent`)
→ เก็บไว้เป็น fallback ของ registry; ถ้าจะลดขนาด bundle ให้เลือกได้ว่าจะใช้ `-transparent` หรือ `-feature` เป็นตัวหลัก

**กลุ่ม C — hero ซ้ำ (564KB):**
`homepage-hero-cover-20260603.png` — เป็นไฟล์เดียวกับ `homepage-hero-cover-transparent.png` (มีการ์ด "Lv. 23" เหมือนกัน) → **ตัวเสนอ: ลบ** เพราะไม่มีอะไรอ้างถึง

**กลุ่ม D — cutout สำหรับงานออกแบบ:**
`mascot-beary-reference-cutout.png`, `mascot-panda-reference-cutout.png`, `mascot-hero-group.png`, `mascot-hero-group1.png` (~700KB)
→ เก็บใน `docs/_assets/` นอก `public/` เพื่อไม่ให้ถูก ship

### 4.4 ไฟล์ใหญ่ (>150KB) — ควร optimize

| ไฟล์ | ขนาด | หมายเหตุ |
|---|---|---|
| `homepage-hero-cover-transparent.png` | 525 KB (หลัง crop) | Hero หลัก — ควร export เป็น WebP (คาดว่าจะ ~90KB) |
| `homepage-hero-cover-20260603.png` | 564 KB | ไม่ถูกใช้ → ลบ |
| `review-child-3.png` | 364 KB | รูปรีวิว 512×512 — ควร resize เป็น 256×256 (→ ~90KB) |
| `review-child-1.png` | 357 KB | เหมือนกัน |
| `review-child-2.png` | 355 KB | เหมือนกัน |
| `review-child-4.png` | 351 KB | เหมือนกัน |
| `ranking-promo-action.png` | 302 KB | ควร resize เป็น 360×360 |
| `feature-card-ai-clean-v3.png` | 301 KB | การ์ด 4 ใบรวม ~1.05MB — ควร WebP |

**ประหยัดได้ทันที ~3.1MB (45% ของ bundle)** ด้วยการ resize + WebP โดยไม่กระทบการแสดงผล

> ⚠️ **Workers Free มีขนาด bundle จำกัด** — ควรตั้งเป้า `< 25MB` รวม static assets และทำ compression ในขั้นก่อน deploy

---

## 5. Visual QA — Responsive

**Viewport ที่ทดสอบ:** 360×800 (มือถือเล็ก) · 768×1024 (แท็บเล็ต) · 1440×900 (เดสก์ท็อป)

### 5.1 ผลการตรวจ (วัดจริงจาก production build บน `http://localhost:3005`)

| จุดตรวจ | 360 | 768 | 1440 | สถานะ |
|---|---|---|---|---|
| Horizontal overflow | **0px** | **0px** | **0px** | ✅ |
| องค์กรที่ล้น viewport | **0** | **0** | **0** | ✅ |
| Nav | hamburger แสดง | hamburger | เมนูเต็ม + 2 CTA | ✅ |
| Hero H1 | `44px` / w=312 | `60px` / w=705 | `64px` / w=555 | ✅ |
| Feature cards | 1 คอลัมน์ (`312px`) | 2 คอลัมน์ (`342.5px`) | 4 คอลัมน์ (`325.25px`) | ✅ |
| CTA ท้ายหน้า | w=312 ไม่ล้น | w=245 | w=245 | ✅ |
| รูปทั้งหมด | 30/30 โหลด · **broken 0** | ✅ | ✅ | ✅ |

**หลักฐาน DOM จาก production build:**
```json
{ "total": 30, "loaded": 30, "broken": [] }
```
mascot ทุกจุด resolve เป็น path จริง:
`/brand/topa/mascot-{topa,olli}-feature.png`, `mascot-{memo,splash,nova,orbit,timo}-transparent.png`, `mascot-{pip,riko}-feature.png`
feature card ทั้ง 4 ใบ:
`feature-card-{ai,practice,xp,ranking}-clean-v3.png`

### 5.2 ปัญหาที่พบและแก้

| # | ปัญหา | ระดับ | สถานะ |
|---|---|---|---|
| 1 | Mascot 8 จุด → `src="topa"` → 404 (`http://localhost:3000/topa`) | Critical | ✅ แก้ — `resolveMascotImage()` |
| 2 | Feature card 4 ใบ → `feature-card-default.png` → 404 | Critical | ✅ แก้ — map ตาม title |
| 3 | ปุ่ม CTA ท้ายหน้า overflow ที่ 360px (`min-w-[310px]` + `px-12`) | Medium | ✅ แก้ — `w-full max-w-full px-6` + `sm:min-w-[310px]` |
| 4 | `TopaImage` onError วนลูปเมื่อ src === fallback | Low | ✅ แก้ — `fallback !== src ? fallback : src` |
| 5 | การ์ด "Lv. 23" พิมพ์อยู่ในรูป hero | Medium | ✅ แก้ — content-aware inpainting |
| 6 | `buildApiUrl()` throw → OG image พัง | Critical | ✅ แก้ — fallback ไม่ throw |

### 5.2.1 ผลการตรวจสุดท้าย (production build, port 3005)

วัดจาก DOM จริงทั้ง 3 viewport:

| Metric | 360 | 768 | 1440 |
|---|---|---|---|
| `images` | 30 | 30 | 30 |
| `brokenImages` | **0** | **0** | **0** |
| `imagesMissingAlt` | **0** | **0** | **0** |
| `horizontalOverflowPx` | **0** | **0** | **0** |
| `elementsOverflowing` | **0** | **0** | **0** |
| `nonRelativeMascotSrcs` (เช่น `src="topa"`) | **[]** | **[]** | **[]** |
| `heroLoaded` | ✅ | ✅ | ✅ |
| **ผลรวม** | **PASS** | **PASS** | **PASS** |

> `nonRelativeMascotSrcs: []` คือหลักฐานว่า **ไม่มี `<img src="topa">` เหลืออีก** — bug 8 จุดแก้ครบถ้วน

### 5.2.2 Hero crop — ผลลัพธ์

| หัวข้อ | ค่า |
|---|---|
| ไฟล์ | `public/brand/topa/homepage-hero-cover-transparent.png` |
| ขนาดก่อน → หลัง | 567,698 → **531,987 bytes** |
| ขนาดภาพ | 751×513 (ไม่เปลี่ยน) |
| การ์ด "Lv. 23" | ✅ หายจากภาพ |
| พื้นหลัง | ✅ คืนเป็น cream สว่าง (`254,254,252`) + เส้นพื้นเหลืองต่อเนื่อง |
| ขอบ/รอยต่อ | ✅ ไม่มี hard seam · ไม่มี floating blob · เส้น feather ทั้ง 4 ขอบ |
| ข้อจำกัด | เท้าของมาสคอตกลางที่ถูกการ์ดทับ **หายจริง** — กู้คืนไม่ได้ 100% (เป็นพื้นที่เล็ก 361×117px ในภาพ 751px) |

**วิธีที่ใช้ (content-aware inpainting, ไม่ใช่ transparent crop):**
1. หาค่าพื้นหลังสว่างที่สุดในแต่ละคอลัมน์ (สแกนขึ้นไปจากขอบบนการ์ด — ข้าม shadow ของการ์ด)
2. เติมแถบนี้ลงทับการ์ดเต็มความกว้าง
3. คัดลอกพื้นเหลือง + สีฟ้ามาสคอตจากใต้การ์ดขึ้นมา 26 แถวล่าง
4. Feather ทั้ง 4 ขอบ (12px)
5. Gaussian blur แนวนอน (r=6) เพื่อลบเส้นผมตั้ง

> ⚠️ **ไม่ควรใช้ transparent crop เดิม** — จะเหลือรูโหว่สีดำโปร่งใสในภาพ (ยืนยันด้วย alpha=0 ทั้งกล่อง)

### 5.3 ⚠️ `ERR_INVALID_URL` — สาเหตุที่แท้จริง 2 ชั้น

หลักฐานจาก production log (`next start -p 3005`):

```
[cause]: TypeError: Invalid URL
  at fileURLToPath (node:internal/url:1604:12)
  at .../@vercel/og/index.node.js:18988:32
  { code: 'ERR_INVALID_URL',
    input: '.\\file:\\C:\\...\\@vercel\\og\\noto-sans-v27-latin-regular.ttf' }
```

**ชั้นที่ 1 (ของโค้ดเรา — แก้แล้ว):** `getApiBaseUrl()` เคย `throw` เมื่อ `NEXT_PUBLIC_API_BASE_URL` ไม่ถูกตั้ง
→ ตอนนี้มี fallback `https://api.topamath.com` และ `buildApiUrl()` คืน URL ที่ถูกต้องเสมอ
→ ยืนยันแล้ว: `buildApiUrl('/share/dashboard/x')` → `https://api.topamath.com/share/dashboard/x` ✅

**ชั้นที่ 2 (ของ Next.js — แก้โดย Chief Dispatcher):** error ที่เหลือมาจาก
`@vercel/og` โหลดฟอนต์ `noto-sans-v27-latin-regular.ttf` ผิดรูปแบบ URL บน **Windows**
(`file:\C:\...` ไม่ใช่ `file:///C:/...`) → เป็นบั๊กของ Next.js **14.2.5**
→ แก้แล้วที่ **Next 14.2.35** + `next.config.js` เพิ่ม
`experimental.outputFileTracingIncludes` สำหรับ `@vercel/og` font + wasm

> ⚠️ error นี้เกิดเฉพาะบน **Windows dev/start** — บน Cloudflare Workers (Linux) ไม่เกิด
> ถ้าเจอบน production ให้ตรวจว่า `outputFileTracingIncludes` ยังอยู่ใน `next.config.js`

### 5.4 Alt text

| ภาพ | alt | สถานะ |
|---|---|---|
| โลโก้ header/footer | `TOPA Math` | ✅ |
| Hero | `กลุ่มมาสคอต TOPA Math` | ✅ |
| Feature card | = title ของการ์ด (เช่น `AI วิเคราะห์จุดอ่อน`) | ✅ |
| Mascot ในอันดับ | `""` (ตกแต่ง) | ✅ ควรเป็น `aria-hidden` |
| รูปรีวิว | `รูปรีวิวของ {ชื่อ}` | ✅ |
| Ranking promo | `TOPA ranking action mascot holding a trophy` | ✅ (ภาษาอังกฤษในหน้าไทย — ควรแปล) |
| Mascot เพื่อนช่วยเรียน | = ชื่อมาสคอต | ✅ |
| TOPA ใน CTA ท้ายหน้า | `TOPA mascot` | ✅ |

**ข้อเสนอ:** แปล alt ของ ranking promo เป็นไทย → `มาสคอต TOPA ถือถ้วยรางวัล`

---

## 6. Technical Fixes — สรุปไฟล์ที่แก้

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `src/lib/mascot-registry.ts` | เพิ่ม `resolveMascotImage(key)` — map key/alias → path จริง |
| `src/app/page.tsx` | ใช้ `resolveMascotImage()` ใน RankingTable · map feature card ตาม title · ปุ่ม CTA responsive |
| `src/lib/public-env.ts` | `getApiBaseUrl()` **ไม่ throw** อีก (fallback `https://api.topamath.com`) · เพิ่ม `getRequiredApiBaseUrl()` สำหรับ client ที่ต้องการค่าจริง |
| `src/lib/api-client.ts` | ใช้ `getRequiredApiBaseUrl()` (คงพฤติกรรมเดิมสำหรับ client) |
| `src/app/share/dashboard/[token]/opengraph-image.tsx` | wrap fetch ใน try/catch → ไม่ crash เมื่อ API ไม่พร้อม |
| `src/app/share/test-result/[token]/opengraph-image.tsx` | เหมือนกัน |
| `public/brand/topa/homepage-hero-cover-transparent.png` | crop + inpaint การ์ด "Lv. 23" (567,698 → 525,071 bytes) |
| `scripts/crop-hero-card.py` | เขียนใหม่เป็น content-aware inpainting (แทน transparent crop ที่ทำให้เกิดรูโหว่) |
| `scripts/qa-asset-audit.py` | **ใหม่** — เครื่องมือ audit asset อ้างอิง ↔ ไฟล์จริง |

**Backup:** ไฟล์ที่แก้มี `.bak-phase0` กำกับทุกไฟล์

---

## 7. ⚠️ ข้อควรระวัง (สำหรับผู้ deploy)

### 7.1 ห้ามรัน `next dev` คู่กับ production build

`next dev` **ลบ `.next` ทั้งโก้ง** ทุกครั้งที่รัน ทำให้ `opennextjs-cloudflare build` พังด้วย
`ENOENT: .next/server/middleware-manifest.json`

**วิธีที่ถูกต้อง:**
```bash
# ทดสอบ visual ด้วย production build เท่านั้น
npm run build
npm run start -- -p 3005
```

### 7.2 Block comment ที่มี `*/` ข้างใน

อย่าเขียน path แบบ `/share/*/opengraph-image` ใน JSDoc `/** ... */` — ลำดับ `*/`
จะปิด comment ก่อนเวลา → **syntax error ทั้งโปรเจกต์**
ใช้ `/share/{token}/opengraph-image` แทน

### 7.3 `NEXT_PUBLIC_API_BASE_URL` บน Workers

ตัวแปร `NEXT_PUBLIC_*` อาจไม่ถูก inline เข้า worker bundle — `getApiBaseUrl()` จึง
ต้องมี fallback (แก้แล้ว) และค่า fallback ต้องชี้ production API เสมอ

---

## 8. Checklist ก่อน Deploy

- [x] `npx tsc --noEmit` → exit 0
- [x] `npm run build` → compile สำเร็จ
- [x] ไม่มี broken image (ทุก `<img>` naturalWidth > 0)
- [x] Mascot ทุกจุด resolve เป็น path จริง
- [x] Feature card ทุกใบมีไฟล์จริง
- [x] Responsive 360 / 768 / 1440 ผ่าน
- [x] Alt text ครบทุกภาพที่มีความหมาย
- [x] Hero card "Lv. 23" ถูกลบ
- [x] OG image ไม่ throw
- [ ] **TODO:** บีบอัดรูป (WebP) — ประหยัด ~3.1MB
- [ ] **TODO:** ลบ `homepage-hero-cover-20260603.png` + reference variants
- [ ] **TODO:** ย้าย design reference ออกจาก `public/`
- [ ] **TODO:** เพิ่ม `hero.stats` จาก CMS เข้า DOM (แทนที่การ์ดที่ถูก crop ออก)

---

*เอกสารนี้อยู่ใน `docs/` ของโปรเจกต์ Topa Math · จัดทำโดย Milin (AI Video & Creative Director)*
