# QA Review — Demo Lesson 1: การบวกและการลบเศษส่วนที่มีตัวส่วนเท่ากัน

**ไฟล์ที่รีวิว:** `docs/DEMO_LESSON_LIKE_DENOMINATORS.md` (229 บรรทัด, 12,685 bytes)
**ผู้รีวิว:** Prim (QA + Platform Fit)
**วันที่รีวิว:** 2026-11-08
**สถานะรวม:** ⚠️ **ผ่านเนื้อหา/คณิตศาสตร์ — ต้องแก้ 4 จุด (1 เรื่องเล็กในไฟล์ + 3 เรื่องร้ายแรงด้าน Platform Fit) ก่อนแปลงเป็น lesson จริง**

---

## 0. สรุปผู้บริหาร (Executive Summary)

| มิติ | ผล | หลักฐาน |
|---|---|---|
| โครงสร้างตาม Guidelines | ✅ ผ่าน 9/9 ข้อ | โครงสร้างครบทุกส่วน (L1–L229) |
| ความถูกต้องทางคณิตศาสตร์ | ✅ ผ่าน 14/14 ตัวอย่าง | ตรวจด้วย `fractions.Fraction` ทุกตัวอย่าง = ถูกต้อง |
| CPA / Bar Model | ⚠️ ผ่านโดยมีจุดผิด 1 จุด | **L116 มี 9 ช่อง แต่ควร 8 ช่อง** (2/8) |
| ภาษาและโทน | ✅ ผ่าน | อ่านสบาย เป็นกันเอง ไม่มี wall of text |
| **Platform Fit (JSON)** | ❌ **ไม่ผ่าน — ต้องแก้** | Renderer ไม่รองรับ `fraction_pie_model`, `number_sentence` format ผิด, `model_diagram` ทิ้ง `bars` |

### 3 เรื่องร้ายแรงที่ต้องแก้ก่อน deploy (Platform Fit)

| # | ปัญหา | ผลกระทบ | ไฟล์ที่เกี่ยวข้อง |
|---|---|---|---|
| **P1** | `number_sentence.operations` ที่ใช้ key `{left, operator, right, result}` **แสดงผลเป็น "undefined undefined = 5"** | ผู้เรียนเห็นข้อความเสีย | `like_denominators_th_001.json:71-77` + renderer `page.tsx:818` |
| **P2** | `model_diagram` + `data.bars` → renderer ทิ้ง `bars` ทิ้ง (เหลือแต่ข้อความ) | ภาพ Bar Model ไม่ขึ้นเลย | `like_denominators_th_001.json:24-38` + renderer `page.tsx:341-347` |
| **P3** | `fraction_pie_model` **ไม่มี branch ใน renderer** → แสดงเป็นการ์ดข้อความเปล่า | ภาพวงกลมไม่ขึ้น | `like_denominators_th_001.json:40-54` + renderer `page.tsx:540-793` |

> ⚠️ **หมายเหตุสำคัญ:** ไฟล์ `apps/api/app/content/math/grade_3/lessons/TH/fractions/like_denominators_th_001.json` **มีอยู่แล้ว** และเป็นการแปลง Demo นี้ไว้แล้ว จึงตกอยู่ใน P1–P3 ทั้งหมด ต้องแก้ไฟล์นั้น ไม่ใช่สร้างใหม่ (ดูหัวข้อ 4)

---

## 1. ตารางตรวจ Lesson Design Guidelines

> หมายเหตุ: ไม่พบไฟล์ "Lesson Design Guidelines" แยกในรีโป (`grep -rl "Lesson Design Guidelines" --include='*.md'` เจอไฟล์เดียวคือ Demo เอง) จึงใช้ **โครงสร้าง 9 ข้อที่พี่แอร์ระบุไว้ใน Task** เป็นเกณฑ์ตรวจ

| # | ข้อเกณฑ์ | ผล | หลักฐาน (บรรทัดในไฟล์ Demo) | หมายเหตุ |
|---|---|---|---|---|
| 1 | Header & Hook เชื่อมกับชีวิตประจำวันของเด็ก | ✅ ผ่าน | L1 `# 🍕 การบวกและการลบ...`, L3 `> เชื่อมกับชีวิตประจำวัน: จะบอกได้ไหมว่า "กินพิซซ่าไปกี่ชิ้น"...` | Hook เป็นคำถามจริงจากชีวิตเด็ก (กินพิซซ่า) ไม่ใช่คำถามทั่วไป ✅ |
| 2 | Metadata มี ⏱ เวลาโดยประมาณ | ✅ ผ่าน | L5 `⏱ **ประมาณ 15 นาที**` | มีครบ และสอดคล้องกับ `estimated_minutes: 35` ใน curriculum (L32) — ค่อนข้างสั้นกว่า แต่โอกาสเป็นเพราะ lesson นี้เน้น 1 skill |
| 3 | Learning Objectives: หัวข้อ "🎯 เมื่อเรียนจบบทนี้ น้องๆ จะสามารถ..." + bullet 2-3 ข้อ | ✅ ผ่าน | L9 `## 🎯 เมื่อเรียนจบบทนี้ น้องๆ จะสามารถ...`, bullets L11, L12, L13 | หัวข้อตรงตามที่กำหนด 3 bullet (บวก/ลบ/อธิบายเหตุผล) — ครบ 3 ข้อ ✅ |
| 4 | Core Content แบ่งเป็นหัวข้อย่อยมีหมายเลข (1,2,3) + ใช้ Emoji สื่อความหมาย | ✅ ผ่าน | L17 `## 1. 🍕 ...`, L47 `## 2. 🖼️ ...`, L79 `## 3. ➕ ...` + ย่อย L81 `### 3.1`, L88 `### 3.2`, L109 `### 3.3`, L130 `### 3.4` | เลขหัวข้อย่อยซ้อนถูกต้อง (3.1–3.4) Emoji สื่อความหมายจริง (🍕 ของจริง, 🖼️ ภาพ, ➕ บวก) ✅ |
| 5 | การเปรียบเทียบใช้ตาราง (Table) ไม่ใช่ย่อหน้ายาว | ✅ ผ่าน | ตาราง 4 ตาราง: L37-41 (สัญลักษณ์↔ของจริง), L68-73 (ตัวส่วนเท่ากัน vs ไม่เท่ากัน), L132-137 (สรุปวิธีทำ), L220-225 (คำศัพท์) | ไม่มีย่อหน้าเปรียบเทียบใด ๆ ทั้งไฟล์ ✅ |
| 6 | 💡 ลองคิดดูสิ: โจทย์ประยุกต์ 1 ข้อ + เฉลยซ่อนใน `<details><summary>ดูเฉลย</summary>` | ✅ ผ่าน | L141 `## 💡 ลองคิดดูสิ`, L143 โจทย์ (ขนมปัง 10 ชิ้น), L147-148 `<details>` / `<summary>👀 ดูเฉลย</summary>`, L175 `</details>` | โครงสร้าง `<details>` ถูกต้อง ✅ |
| 7 | 📌 จำให้แม่น: กล่องเน้นจุดที่มักผิด | ✅ ผ่าน | L179 `## 📌 จำให้แม่น`, L187 `> **4. ข้อผิดที่พี่สอนเห็นบ่อยที่สุด:**`, L188-191 ผิด/ถูกคู่กัน | เน้นข้อผิดพร้อมคำอธิบายเหตุผล ✅ |
| 8 | ภาษา/โทน: มิตร สนุกสนาน ให้กำลังใจ อธิบายทีละสเต็ป กระชับ ไม่มี wall of text | ✅ ผ่าน | ทั้งไฟล์: L19 "ลองนึกภาพตามนะคะ", L27 "เด็กๆ จะตอบว่า", L49 "ค่ะ", L63 "🔑 นี่คือหัวใจสำคัญของบทนี้เลยนะ!", L75 "เอ็วจัง!", L205 "เยี่ยมมาก! 🎉" | ย่อหน้ายาวสุด ~3 บรรทัด (L21, L31-33) ไม่มี wall of text ✅ |
| 9 | CPA (Concrete→Pictorial→Abstract) เรียงลำดับถูก | ✅ ผ่าน | L17 `## 1. ... (Concrete)` → L47 `## 2. ... (Pictorial)` → L100-105/L121-126 `**เขียนสัญลักษณ์:**` (Abstract) | ลำดับถูก: ของจริง → แถบรูป → สัญลักษณ์ ✅ |

### 1.1 CPA / Bar Model — ตรวจละเอียด

| จุดตรวจ | ผล | หลักฐาน |
|---|---|---|
| Bar Model แสดงชิ้นที่เท่ากัน | ✅ | L54 `🟦🟦🟦🟦🟦🟦⬜⬜` = 8 ช่อง (6+2) ✅ |
| Bar Model ตัวอย่างที่ 1 (3/8 + 2/8 = 5/8) | ✅ | L94 = 3+5 ✅, L95 = 2+6 ✅, L97 = 5+3 ✅ (ทุกแถว 8 ช่อง) |
| Bar Model ตัวอย่างที่ 2 (7/8 − 2/8 = 5/8) | ❌ **ผิด 1 จุด** | **L116 = 2+7 = 9 ช่อง** (ควรเป็น 2+6 = 8) |
| Bar Model ตารางเปรียบเทียบ (L73) | ✅ | `🟦🟦🟦⬜⬜⬜⬜⬜` = 3+5 = 8 ช่อง แทน 3/8 ✅ |
| สัญลักษณ์เศษส่วนแนวตั้ง | ✅ | L102-104 (`3/8 + 2/8 = 5/8`), L123-125 (`7/8 − 2/8 = 5/8`), L158-160 (`3/10 + 5/10 = 8/10`), L167-169 (`10/10 − 8/10 = 2/10`), L196-198 — **เส้นคีดแนวตั้ง/ตัวเลขบนล่างจัดตำแหน่งถูกต้องทุกบล็อก** ✅ |
| การใช้ Bar Model ถูกวิธีสำหรับเศษส่วนตัวส่วนเท่ากัน | ✅ | ใช้ "แถบที่แบ่งเท่ากัน" ไม่ใช่วงกลม — ถูกต้อง เพราะเศษส่วนที่มีตัวส่วนเท่ากันต้องการ "ขนาดส่วนเท่ากัน" ให้เห็นชัด ✅ |
| ไม่มีการหยุดคิด CPA ผิด | ✅ | Abstract มาหลัง Pictorial เสมอ ไม่มีการโผล่สัญลักษณ์ก่อนเห็นภาพ ✅ |

---

## 2. ความถูกต้องทางคณิตศาสตร์ — ตรวจทุกตัวอย่าง

ตรวจด้วย Python `fractions.Fraction` (exact arithmetic) ไม่ใช่การคำนวณด้วย float:

| # | ตัวอย่าง | บรรทัด | คำนวณได้ | ผลตรงเสมอ | สถานะ |
|---|---|---|---|---|---|
| 1 | กิน 3 ชิ้นจาก 8 → 3/8 | L32 | 3/8 | ✅ | ✅ |
| 2 | เหลือ 5 ชิ้นจาก 8 | L27, L41 | 5/8 | ✅ | ✅ |
| 3 | 8/8 − 2/8 = 6/8 | L57-60 | 6/8 = 3/4 | ✅ | ✅ |
| 4 | 3/8 + 2/8 = 5/8 | L90-107 | 5/8 | ✅ | ✅ |
| 5 | 7/8 − 2/8 = 5/8 | L111-128 | 5/8 | ✅ | ✅ |
| 6 | 1/5 + 3/5 = 4/5 | L136 | 4/5 | ✅ | ✅ |
| 7 | 6/9 − 4/9 = 2/9 | L137 | 2/9 | ✅ | ✅ |
| 8 | 3/10 + 5/10 = 8/10 | L152-163 | 8/10 = 4/5 | ✅ | ✅ |
| 9 | 10/10 − 8/10 = 2/10 | L166-172 | 2/10 = 1/5 | ✅ | ✅ |
| 10 | เหลือ 2 ชิ้นจาก 10 | L172-173 | 2 ชิ้น | ✅ | ✅ |
| 11 | ข้อผิด 3/8 + 2/8 = 5/16 | L188 | 5/16 ≠ 5/8 → ผิดจริง | ✅ | ✅ |
| 12 | ข้อผิด 7/8 − 2/8 = 5/16 | L190 | 5/16 ≠ 5/8 → ผิดจริง | ✅ | ✅ |
| 13 | 1/2 + 1/3 ต้องหาตัวส่วนร่วมก่อน | L70-72 | ถูก (1/2 ≠ 1/3) | ✅ | ✅ |
| 14 | สูตรในกล่องช่วยจำ L196-198 (3+2)/8 = 5/8 | L196-198 | 5/8 | ✅ | ✅ |

**สรุป: 14/14 ถูกต้องทางคณิตศาสตร์ — ไม่มีตัวอย่างที่คำนวณผิด**

### 2.1 ประเด็นน่าระวังเชิงเนื้อหา (ไม่ใช่ "ผิดทางคณิตศาสตร์" แต่ควรพิจารณา)

| # | จุด | บรรทัด | หมายเหตุ | ระดับ |
|---|---|---|---|---|
| A | 8/10 ไม่ใช่เศษส่วนอย่างต่ำ | L163, L172 | 3+5=8 ชิ้นจาก 10 → 8/10 ยังไม่ทอน แต่โจทย์ระดับ ป.3 มักยอมรับ | 🟢 ปล่อยผ่าน (แนะนำเพิ่มหมายเหตุว่ายังไม่ทอน) |
| B | 6/9 − 4/9 = 2/9 ไม่ทอน | L137 | 2/9 ย่อมไม่ได้ ถูกต้อง | 🟢 ปล่อยผ่าน |
| C | ใช้คำว่า "พี่สอน" เป็นตัวละคร | L19, L51, L152, L188 | พี่แอร์ระบุโทน "พี่สอนน้อง" → ตรงตาม ✅ | 🟢 ปล่อยผ่าน |
| D | L73 ภาพเทียบ "ตัวส่วนไม่เท่ากัน" | L73 | แสดงแค่ ❌ ไม่มีภาพ — เข้าใจได้ แต่ถ้าอยากให้เด็กเห็นภาพเทียบจริงควรมีแถบ 4+3 เทียบกับ 3+3 | 🟡 พิจารณา |

---

## 3. จุดที่ต้องแก้ในไฟล์ Demo (พร้อมข้อความที่แก้ได้เลย)

> ตามกฎ หนู **ไม่ได้แก้ไฟล์ Demo** — คำแนะนำด้านล่างสำหรับ Chief Dispatcher นำไปใช้

### แก้ที่ 1 — L116: แถบ Bar Model มี 9 ช่องแทน 8 (เรื่องเล็ก แก้ได้เลย) 🔴

**ปัญหา:** แถว `2/8 (กินไป)` มี 9 ช่อง (2 น้ำเงิน + 7 ขาว) แต่ต้องมี 8 ช่อง (2 + 6) — แถวอื่น ๆ ในไฟล์มี 8 ช่องหมด

```
เดิม (L116):  🟦🟦⬜⬜⬜⬜⬜⬜⬜   2/8  (กินไป)
แก้เป็น:      🟦🟦⬜⬜⬜⬜⬜⬜   2/8  (กินไป)
```

**หลักฐาน:** นับอัตโนมัติ — L54/L94/L95/L97/L115/L118 = 8 ช่องทุกแถว, L116 = 9 ช่อง

### แก้ที่ 2 — L145: พิมพ์ผิด "ทั้งแปดชิ้น" (เรื่องเล็ก) 🟡

```
เดิม (L145):  > **ถาม:** ทั้งคู่กินไปรวมกันกี่ส่วนของขนมปังทั้งแปดชิ้น? แล้วเหลือขนมปังกี่ชิ้น?
แก้เป็น:      > **ถาม:** ทั้งคู่กินไปรวมกันกี่ส่วนของขนมปังทั้งสิบชิ้น? แล้วเหลือขนมปังกี่ชิ้น?
```

**หลักฐาน:** โจทย์บอก "**10 ชิ้นเท่ากัน**" (L143) แต่คำถามพูดว่า "ทั้งแปดชิ้น" — ขัดแย้งกันเอง และเฉลยใช้ 10 (L152-160) → คำถามทำให้เด็กสับสน

### แก้ที่ 3 — L212: ใช้ "ครับ" (ไม่ตรงโทนที่กำหนด) 🟡

```
เดิม (L212):  **ครั้งหน้า** เราจะไปเรียนเรื่องที่ยากขึ้นนิดนึง — บวกเศษส่วนที่ **ตัวส่วนไม่เท่ากัน** 💪 แต่ไม่ต้องกลัว เพราะมีวิธีเดียวกับที่น้องๆ เพิ่งเรียน!
```

โทนที่พี่แอร์กำหนดคือ "พี่สอนน้อง" ใช้ "ค่ะ/นะ" (พบที่ L19, L49, L63) แต่ L212 ใช้ "ครับ" หนึ่งครั้ง — แนะนำปรับเป็น "**ครั้งหน้า** เราจะไปเรียนเรื่องที่ยากขึ้นนิดนึง — บวกเศษส่วนที่ **ตัวส่วนไม่เท่ากัน** 💪 แต่ไม่ต้องกลัวเลย เพราะมีวิธีเดียวกับที่น้องๆ เพิ่งเรียน!"

### แก้ที่ 4 — L73: เพิ่มแถบเทียบฝั่งขวา (แนะนำเพิ่ม ถ้าต้องการให้เด็กเห็นภาพ) 🟢 (ทางเลือก)

```
เดิม (L73):  | ภาพ | 🟦🟦🟦⬜⬜⬜⬜⬜ | ❌ หั่นคนละขนาด เทียบกันไม่ได้ |
แก้เป็น:      | ภาพ | 🟦🟦🟦⬜⬜⬜⬜⬜ | 🟦🟦🟦⬜⬜🟦⬜⬜ (4 ชิ้น vs 3 ชิ้น — ขนาดไม่เท่ากัน) |
```

---

## 4. Platform Fit — ตรวจกับ renderer จริง

### 4.1 ไฟล์ที่ตรวจ

| ไฟล์ | บทบาท |
|---|---|
| `src/app/dashboard/lessons/[lessonId]/page.tsx` (1,320 บรรทัด) | Renderer ฝั่ง client — `normalizeVisualBlock`, `BlockModelDiagram`, `BlockMiniQuiz`, `getMiniQuizChoices`, `getMiniQuizCorrectAnswer`, `isRenderableVisualBlock` |
| `apps/api/app/content/math/grade_3/lessons/TH/fractions/fractions_th_001.json` | Schema ตัวอย่าง (reference) |
| `apps/api/app/content/math/grade_3/lessons/TH/fractions/like_denominators_th_001.json` | ⚠️ **ไฟล์ที่แปลง Demo นี้ไว้แล้ว — ตกอยู่ใน P1–P3** |
| `apps/api/app/services/lesson_content.py` (2,048 บรรทัด) | Loader / discovery / status |
| `apps/api/app/routers/me.py` | `/lessons/{id}/test/start` |

### 4.2 ผลการทดสอบ renderer จริง (จำลองด้วย Node โดยคัดลอกฟังก์ชันตรงจาก `page.tsx`)

| โครงสร้าง JSON | ผลที่เรนเดอร์จริง | สถานะ |
|---|---|---|
| `type:"mini_quiz"`, `data:{question_th, choices_th, correctAnswer}` | `renderable=true`, choices `[8/10,5/10,10/8,2/10]`, correct `8/10` | ✅ **ใช้ได้** |
| `type:"mini_quiz"`, `data:{questions:[{question_th, choices, correctAnswer}]}` | `renderable=false`, choices `[]` | ❌ **ใช้ไม่ได้** |
| `type:"mini_quiz"`, keys อยู่ที่ root (ไม่มี `data`) | `renderable=false` | ❌ **ใช้ไม่ได้** |
| `type:"model_diagram"`, `model_type:"bar_model"`, `data:{bars:[...]}` | การ์ดข้อความเปล่า — **`bars` ถูกทิ้ง** | ❌ **P2** |
| `type:"bar_model"`, `data:{bars:[{label,items,count}]}` | แถบอีโมจิจริง (8/3/2/3 ช่อง) + footer total | ✅ **ใช้ได้** |
| `type:"model_diagram"`, `model_type:"fraction_pie_model"` | การ์ดข้อความเปล่า — **ไม่มี branch ใน renderer** | ❌ **P3** |
| `type:"number_sentence"`, `data:{operations:[{op,a,b,result}]}` | `"3 + 2 = 5"` | ✅ **ใช้ได้** |
| `type:"number_sentence"`, `data:{operations:[{left,operator,right,result}]}` | **`"undefined undefined = 5"`** | ❌ **P1** |
| `type:"number_sentence"`, `data:{expression:"..."}` | แสดง expression เป็นข้อความ | ✅ ใช้ได้ (ทางเลือก) |
| `type:"abstract_symbol"` | **ไม่เรนเดอร์เลย** (`isRenderableVisualBlock` คืน false) | ⚠️ ต้องรู้ |

### 4.3 P1 — `number_sentence` แสดง "undefined undefined = 5" 🔴

**รหัสผิด** (`like_denominators_th_001.json:71-77`):
```json
"operations": [
  { "left": "3/8", "operator": "+", "right": "2/8", "result": "5/8" },
  { "left": "7/8", "operator": "-", "right": "2/8", "result": "5/8" }
]
```

**Renderer อ่าน** (`page.tsx:818`):
```tsx
{getNumber(operation.a)?.toLocaleString()} {cleanText(operation.op)} {getNumber(operation.b)?.toLocaleString()} = {getNumber(operation.result)?.toLocaleString()}
```
→ `a`/`op`/`b` ไม่มีใน JSON → `undefined undefined = 5` (ส่วน `result` เป็น string `"5/8"` → `getNumber` ดึงได้แค่ `5`)

**แก้เป็น** (ให้ผลเป็น `"3 + 2 = 5"`):
```json
"operations": [
  { "op": "+", "a": 3, "b": 2, "result": 5 },
  { "op": "-", "a": 7, "b": 2, "result": 5 },
  { "op": "+", "a": 1, "b": 3, "result": 4 },
  { "op": "-", "a": 6, "b": 4, "result": 2 }
]
```

> ⚠️ ข้อจำกัด: renderer แสดง "Final answer: 5 บาท" แบบ hard-coded คำว่า "บาท" (`page.tsx:824`) → **ไม่เหมาะกับเศษส่วน** แนะนำให้ใช้ `data.expression` แทน หรือยอมรับข้อความ "บาท" ที่ไม่ตรงบริบท

### 4.4 P2 — `model_diagram` ทิ้ง `bars` 🔴

**รหัสผิด** (`like_denominators_th_001.json:24-38`): ใช้ `"type": "model_diagram"` + `"data": { "bars": [...] }`

**สาเหตุ** (`page.tsx:274-347`): `normalizeVisualBlock` มี 2 ทาง:
- ทางที่มี `data: inner` → เฉพาะ `grouping_model` และ types ใน `modelTypes` set
- **default branch** (`page.tsx:341-347`) → **ไม่มีคีย์ `data`** เลย — spread `...innerRecord` ไปที่ root เท่านั้น

ดังนั้น `type: "model_diagram"` → `block.data === undefined` → `bars` ใน `BlockModelDiagram` (`page.tsx:545`) อ่าน `data.bars ?? block.bars` ได้ `undefined` → ไม่เข้า branch `part_whole_bar`/`comparison_bar`, `rawGroups` ว่าง, `rows/cols` ไม่มี → ตกไปที่ fallback การ์ดข้อความ (`page.tsx:751-766`)

**แก้เป็น** — เปลี่ยน `type` เป็น `"bar_model"` (อยู่ใน `modelTypes` set) และเพิ่ม `items` เป็นสตริงอีโมจิ:
```json
{
  "type": "bar_model",
  "title": "🖼️ แถบ Bar Model: ตัวส่วนเท่ากัน",
  "description": "แถบพิซซ่าทั้งถาดแบ่งเป็น 8 ส่วนเท่ากัน น้องกิน 3 ส่วน (3/8) เพื่อนกิน 2 ส่วน (2/8) รวมกันได้ 5 ส่วน (5/8)",
  "data": {
    "model_type": "bar_model",
    "unit": "ชิ้น",
    "symbol": "🟦",
    "total": 8,
    "bars": [
      { "label": "ทั้งหมด (8/8)", "items": "🟦🟦🟦🟦🟦🟦🟦🟦", "count": 8 },
      { "label": "น้องกิน (3/8)",   "items": "🟦🟦🟦",               "count": 3 },
      { "label": "เพื่อนกิน (2/8)",  "items": "🟦🟦",                 "count": 2 },
      { "label": "เหลือ (3/8)",      "items": "🟦🟦🟦",               "count": 3 }
    ]
  }
}
```
> `items` (สตริงอีโมจิ) สำคัญมาก — ถ้าไม่ใส่จะได้ symbol เริ่มต้น `🔢` แทน `🟦`

### 4.5 P3 — `fraction_pie_model` ไม่มีใน renderer 🔴

**รหัสผิด** (`like_denominators_th_001.json:40-54`) และอีก 2 ไฟล์ (`fractions_th_001.json:32`, `fractions_ep_001.json:31`)

**หลักฐาน:** `grep -rn "fraction_pie_model" --include='*.tsx'` → **ไม่พบใน renderer** เลย
`BlockModelDiagram` มี branch แค่ 2 ตัว: `part_whole_bar` (L547) และ `comparison_bar` (L608) — ทั้งคู่ต้องมี `bars.length > 0` ด้วย

ผลลัพธ์: วงกลม 8 ส่วนแบ่งเท่ากัน (ที่ Demo อธิบายดีมากใน L21-43) **จะไม่ปรากฏบนหน้าจอเลย**

**ทางเลือก 2 ทาง:**
- **(ก) ตัดบล็อก `fraction_pie_model` ออกจาก lesson นี้** — ใช้ `bar_model` (P2) รับหน้าที่แทน ซึ่งตรงกับสิ่งที่ Demo สอนจริงอยู่แล้ว (L47 "วาดเป็นภาพ (Pictorial) — แถบ Bar Model")
- **(ข) เพิ่ม branch `fraction_pie_model` ใน renderer** — ต้องแก้ `page.tsx` (อยู่นอกขอบเขตของ Demo Review และต้องมีการอนุมัติ)

> **ข้อเสนอ: ตัดออก (ก)** — เร็ว ปลอดภัย และไม่ทำให้เนื้อหาเสีย

### 4.6 สิ่งที่ renderer ไม่แสดงต้องรู้ ⚠️

`worked_examples`, `explanation_steps`, `key_vocabulary`, `common_mistakes`, `hints`, `title_en` **ไม่ถูกเรนเดอร์บนหน้า lesson** — `grep` ใน `src/app/dashboard/lessons/[lessonId]/page.tsx` ไม่พบเลย (มีแต่ใน `src/lib/api/admin.ts` และ `src/lib/mock-content.ts`)

→ ดังนั้นเนื้อหาทั้งหมดใน Demo **ต้องถูกบรรจุลงใน `visual_blocks`** ไม่ใช่ฝากไว้ใน `worked_examples` / `common_mistakes` / `hints` เพราะเด็กจะไม่เห็น

### 4.7 ปุ่ม "ทำเทสจากบทนี้" — ไม่ได้มาจาก `questions` ของ lesson

**หลักฐาน:** `apps/api/app/routers/me.py:3111` → `_ensure_lesson_content_questions(...)` → `me.py:1878`:
```python
rows = rows_override if rows_override is not None else get_canonical_test_bank(lesson_id, content_program)
```
→ `lesson_content.py:1603` `get_canonical_test_bank()` → `get_topic_test_bank(grade, topic_folder, program)` → อ่านจากโฟลเดอร์ **`grade_3/quizzes/TH/fractions/`** ไม่ใช่ `questions` ในไฟล์ lesson

และเงื่อนไขขั้นต่ำ: `lesson_content.py:266` → `len(questions) < 10` → **ไม่ผ่าน** (มีแค่ 10 พอดี) + `me.py:3098` → `len(rows) < 5` → ต้อง ≥ 5

→ ดังนั้น `questions: []` ใน lesson JSON **ไม่กระทบปุ่มเทส** แต่ก็**ไม่ช่วยอะไร** — เทสมาจากโฟลเดอร์ quizzes แยก

---

## 5. Mapping Table: Markdown → JSON field

### 5.1 ระดับ Lesson (ไฟล์เดียว = 1 variant)

| ส่วนใน Markdown | บรรทัด | JSON field | หมายเหตุ |
|---|---|---|---|
| `# 🍕 การบวกและการลบเศษส่วนที่มีตัวส่วนเท่ากัน` | L1 | `title_th` | ตัด emoji ออกหรือคงได้ (renderer แสดง `title_th` ใน cover card) |
| — | — | `title_en` | `"Adding and Subtracting Fractions with Like Denominators"` |
| — | — | `variant_id` | `"like_denominators_th_001"` ⚠️ **มีไฟล์นี้อยู่แล้ว → ต้องแก้ ไม่ใช่สร้างใหม่** |
| — | — | `variant_title_th` | `"การบวกและการลบเศษส่วนที่มีตัวส่วนเท่ากัน"` (ข้าม L1 ซ้ำได้) |
| — | — | `variant_title_en` | `"Adding and Subtracting Fractions with Like Denominators"` |
| — | — | `status` | `"needs_review"` (ช่วงให้ผู้เรียนเห็นได้: `lesson_content.py:246-251`) |
| — (L21-33 รวบ) | L21-33 | `story_theme_th` | เรื่องพิซซ่า 8 ชิ้น กิน 3 + 2 |
| `> เชื่อมกับชีวิตประจำวัน...` + กฎ L84-86 | L3, L84-86 | `helper_tip` | ข้อความสั้น 1-2 บรรทัด (renderer แสดงในกล่องมาสคอต) |
| `## 3.1 กฎที่ใช้เลย` | L81-86 | `think_story_th` | ใช้กฎ `a/c ± b/c = (a±b)/c` |
| `## 🎯 เมื่อเรียนจบบทนี้...` | L9-13 | *(ไม่มี field)* | ⚠️ **Objectives ไม่มีที่เก็บใน schema → รวมเข้า `explanation_steps` หรือทิ้ง** |
| `⏱ ประมาณ 15 นาที` | L5 | *(ไม่มี field)* | ⚠️ **ไม่มี duration field → ข้าม** |
| `## 📌 จำให้แม่น` | L179-199 | `common_mistakes` (ข้อความ) | ⚠️ **ไม่เรนเดอร์ → ต้องย้ายเข้า `explanation_steps` หรือ `visual_blocks`** |
| `## 📚 คำศัพท์สำคัญ` | L218-225 | `key_vocabulary` | ⚠️ **ไม่เรนเดอร์ → ข้อมูลยังควรคงไว้ แต่อย่าคิดว่าเด็กเห็น** |
| `### 3.2 / 3.3 ตัวอย่าง` | L88-128 | `worked_examples` | ⚠️ **ไม่เรนเดอร์ → ย้ายเนื้อหาไป `explanation_steps` + `number_sentence`** |
| `## 1,2,3` ทั้งหมด | L17-137 | `explanation_steps` | อาร์เรย์ข้อความสอน (ไม่เรนเดอร์ แต่เป็นที่เก็บมาตรฐาน) |

### 5.2 ระดับ `visual_blocks` (ส่วนที่เด็กเห็นจริง)

| Markdown | บรรทัด | `type` | `data` (สำคัญ) | สถานะ |
|---|---|---|---|---|
| Hook + เรื่องพิซซ่า 8 ชิ้น | L3, L21-33 | `story_intro` | `{ content_th, content_en }` | ✅ ใช้ได้ |
| ขั้นตอนคิดแบบ Bar Model | L57-64 | `think_story` | `{ content_th, content_en }` | ✅ ใช้ได้ |
| **แถบ Bar Model (L53-61)** | L47-64 | **`bar_model`** ⚠️ *ไม่ใช่ `model_diagram`* | `{ model_type:"bar_model", unit:"ชิ้น", symbol:"🟦", total:8, bars:[{label,items,count}] }` | 🔴 **ต้องแก้ P2** |
| กฎ `ตัวส่วนเท่ากัน` | L84-86 | `abstract_symbol` | `{ content_th, formula_th }` | ⚠️ **ไม่เรนเดอร์เลย** → ย้ายไป `think_story` |
| ตัวอย่างบวก/ลบ | L100-105, L121-126 | `number_sentence` | `{ content_th:"3/8 + 2/8 = 5/8", operations:[{op:"+",a:3,b:2,result:5},...] }` | 🔴 **ต้องแก้ P1** |
| **💡 ลองคิดดูสิ** | L141-175 | `mini_quiz` | `{ question_th, choices_th:[...], correctAnswer:"8/10", explanation_th }` | ✅ **ใช้ได้** (ยืนยันด้วย Node) |
| ตารางสรุปวิธีทำ | L132-137 | *(ไม่มี block รองรับตาราง)* | — | ⚠️ ต้องแยกเป็น `number_sentence` 4 อัน หรือฝังใน `explanation_steps` |
| 📌 จำให้แม่น | L179-199 | *(ไม่มี block รองรับ)* | — | ⚠️ ย้ายไป `explanation_steps` / `common_mistakes` (แต่ไม่เรนเดอร์) |
| ท้ายบท + เรื่องถัดไป | L203-214 | *(ไม่มี block รองรับ)* | — | ⚠️ ข้ามหรือรวมใน `explanation_steps` |

### 5.3 `visual_blocks` ที่แนะนำ (ลำดับการแสดงผลจริง)

```
1. story_intro    → เรื่องพิซซ่า 8 ชิ้น (L21-33)
2. think_story   → กฎ/ขั้นตอนคิด (L57-64 + L84-86)
3. bar_model      → แถบ 8 ส่วน + 3/8 + 2/8 = 5/8 (L53-61, L94-97)   🔴 P2
4. bar_model      → แถบ 8 ส่วน + 7/8 − 2/8 = 5/8 (L115-118)          🔴 P2
5. number_sentence→ 3/8 + 2/8 = 5/8                                🔴 P1
6. number_sentence→ 7/8 − 2/8 = 5/8                                🔴 P1
7. mini_quiz      → ขนมปัง 10 ชิ้น (L141-175)                      ✅
```

> หมายเหตุ: renderer แสดง `BLOCK_LABELS` กำกับหัวข้ออัตโนมัติ (`page.tsx:1013-1031`) — ชื่อที่เด็กเห็นจะเป็น "เรื่องราว", "เรื่องราวชวนคิด", "🟦 ใช้แผนภาพช่วยคิด", "เขียนเป็นประโยควิธีทำ", "ลองทำดู" — **ไม่ใช่** หัวข้อย่อย 1/2/3 ของ Markdown ดังนั้นหัวข้อ "1. 2. 3." ใน Demo **จะหายไป** บน platform ถ้าอยากคงไว้ต้องใส่ใน `title_th` ของแต่ละ block (แต่ `title_th` ก็ถูก override โดย `BLOCK_LABELS` สำหรับ `model_diagram`/`bar_model`)

---

## 6. โจทย์ควรเป็น Quiz กี่ข้อ และควรดึงจากไหน

### 6.1 สรุป

| จุด | คำตอบ |
|---|---|
| **Mini quiz ใน `visual_blocks`** | **1 ข้อ** (renderer รองรับแค่ `questions[0]` — `page.tsx:851`, `page.tsx:205`) → ใช้โจทย์ "ขนมปัง 10 ชิ้น" จาก L143 ตามที่ Demo เตรียมไว้ |
| **`questions` ใน lesson JSON** | **ไม่จำเป็น / ไม่มีผลกับปุ่มเทส** — ดู 4.7 |
| **แบบทดสอบจริง (ปุ่ม "ทำเทส")** | **≥ 10 ข้อ** จากโฟลเดอร์ `grade_3/quizzes/TH/fractions/` (`lesson_content.py:266`) |

### 6.2 หลักฐานว่า `questions` ของ lesson ไม่ได้ใช้

- `me.py:3111` → `_ensure_lesson_content_questions(db, lesson, skill, canonical_lesson_id, rows_override=...)`
- `me.py:1878` → `rows = rows_override if rows_override is not None else get_canonical_test_bank(lesson_id, content_program)`
- `lesson_content.py:1603-1608` → `get_canonical_test_bank()` → `get_topic_test_bank(grade, topic_folder, program)`
- `lesson_content.py:901-925` → `get_topic_test_bank()` อ่านจาก `grade_3/quizzes/{PROGRAM}/{topic_folder}/*.json` เท่านั้น

### 6.3 สถานะปัจจุบันของแหล่งโจทย์

| แหล่ง | ไฟล์ | จำนวน | สถานะ | ครอบคลุมเนื้อหา "บวก/ลบตัวส่วนเท่ากัน"? |
|---|---|---|---|---|
| Quiz variant (สร้างเทส) | `grade_3/quizzes/TH/fractions/fractions_th_q001.json` | 10 | `needs_review` | ❌ เป็นโจทย์ "1/8 ของพิซซ่า 8 ชิ้น = กี่ชิ้น" (แปลงหน่วย) ไม่ใช่บวกเศษส่วน |
| Quiz variant | `grade_3/quizzes/TH/fractions/fractions_th_q002.json` | 10 | `needs_review` | ❌ เหมือนกัน |
| question_banks | `question_banks/grade_3/g3_fractions_intro.jsonl` | 10 | — | ❌ เป็นโจทย์ "แบ่งเค้ก 4 ส่วน หยิบ 2 ส่วน = เศษส่วนอะไร" ทั้ง 10 ข้อ |
| **ค่าตัวเลข** | — | — | — | 🔍 **ไม่มีแหล่งไหนเลยที่เป็นโจทย์ "a/b + c/b" / "a/b − c/b" จริง ๆ** |

### 6.4 ข้อเสนอ

> **เขียน quiz variant ใหม่** สำหรับหัวข้อนี้ เพราะแหล่งเดิมไม่มีโจทย์บวก/ลบเศษส่วนตัวส่วนเท่ากันเลย

**ตัวเลือกที่แนะนำ** — สร้าง `grade_3/quizzes/TH/fractions/like_denominators_th_q001.json`:

```json
{
  "lesson_id": "g3_fractions",
  "grade_level": 3,
  "program": "TH",
  "program_type": "TH",
  "status": "needs_review",
  "questions": [ /* 10 ข้อ, ดูโครงสร้างด้านล่าง */ ]
}
```

**โครงสร้างข้อ (ต้องใช้ `question_text_th` + `choices` + `correct_answer` — ตาม `lesson_content.py:271-282`):**
```json
{
  "question_id": "like_den_th_q01",
  "question_text": "น้องกินพิซซ่าไป 3/8 ของถาด แล้วเพื่อนกินไปอีก 2/8 ถาดนี้กินไปรวมกันกี่ส่วน?",
  "question_text_th": "น้องกินพิซซ่าไป 3/8 ของถาด แล้วเพื่อนกินไปอีก 2/8 ถาดนี้กินไปรวมกันกี่ส่วน?",
  "choices": ["5/8", "5/16", "6/8", "11/8"],
  "correct_answer": "5/8",
  "explanation_th": "ตัวส่วนเท่ากัน (8 = 8) จึงบวกเฉพาะตัวเศษ 3 + 2 = 5 คงตัวส่วน 8 ไว้ ได้ 5/8",
  "difficulty": "easy",
  "hint_th": "ดูที่ตัวส่วนก่อน ถ้าเหมือนกันให้บวกเฉพาะตัวเศษ"
}
```

**หมายเหตุสำคัญ:** ชื่อไฟล์ quiz ต้องอยู่ใน `grade_3/quizzes/TH/fractions/` และต้องมี `lesson_id` ตรงกับ lesson group (`g3_fractions`) เพื่อให้ `_select_grade3_quiz_file_variant` (`me.py:3089`) จับคู่ได้

> ⚠️ ข้อควรระวัง: โฟลเดอร์ `quizzes/TH/fractions/` ปัจจุบันมี `fractions_th_q001.json` / `fractions_th_q002.json` ซึ่งเป็นโจทย์ของบท "เศษส่วน" (คนละบท) — ถ้าสร้างไฟล์ใหม่ในโฟลเดอร์เดียวกัน ระบบจะเลือก variant ตาม logic การหมุนเวียน ต้องทดสอบการจับคู่ด้วย

### 6.5 เทียบกับ `questions` ที่มีอยู่แล้วใน `like_denominators_th_001.json` (5 ข้อ)

ไฟล์ที่มีอยู่มี `questions` 5 ข้อ (L148-208) คุณภาพดี ครอบคลุมทั้งบวก/ลบ/ประยุกต์/แนวคิด — **สามารถย้ายไปใช้เป็น quiz variant ได้เลย** แต่ต้องเพิ่มเป็น ≥ 10 ข้อ (เงื่อนไข `lesson_content.py:266`) และเปลี่ยน field เป็น `question_text_th` + `correct_answer` (ของเดิมใช้ `question_th` + `correct_index`)

---

## 7. Checklist ก่อนแปลงเป็น Lesson จริง

### 7.1 แก้ในไฟล์ Demo (`docs/DEMO_LESSON_LIKE_DENOMINATORS.md`)

- [ ] **L116** — แถบ `2/8` มี 9 ช่อง → แก้เป็น 8 (ลบ ⬜ 1 ตัว)
- [ ] **L145** — "ทั้งแปดชิ้น" → "ทั้งสิบชิ้น"
- [ ] **L212** — "ครับ" → ปรับให้เข้ากับโทน "ค่ะ/นะ"

### 7.2 แก้ในไฟล์ JSON ของ platform

- [ ] **P1** — `number_sentence.operations` เปลี่ยนจาก `{left,operator,right,result}` → `{op,a,b,result}` (หรือใช้ `data.expression` แทนเพื่อเลี่ยงคำว่า "บาท")
- [ ] **P2** — `model_diagram` + `bars` → เปลี่ยน `type` เป็น `"bar_model"` + เพิ่ม `items` (อีโมจิ) + `symbol`
- [ ] **P3** — ตัด `fraction_pie_model` ออก (หรือขออนุมัติเพิ่ม branch ใน renderer)
- [ ] ย้ายเนื้อหาจาก `worked_examples` / `common_mistakes` / `hints` / `key_vocabulary` ที่ไม่เรนเดอร์ → ไป `explanation_steps` (บันทึกไว้) และ/หรือฝังใน `visual_blocks`
- [ ] เติม `story_theme_th`, `helper_tip`, `think_story_th`, `key_vocabulary` (พร้อม `definition_en`), `explanation_en`
- [ ] ตรวจ `status` = `"needs_review"` ให้เห็นได้ช่วงเบต้า (`lesson_content.py:246-251`)

### 7.3 สร้างแบบทดสอบ

- [ ] สร้าง `grade_3/quizzes/TH/fractions/` variant ใหม่ สำหรับโจทย์บวก/ลบตัวส่วนเท่ากัน
- [ ] ≥ 10 ข้อ, field `question_text_th` + `choices` (≥2) + `correct_answer`
- [ ] ทดสอบว่าปุ่ม "ทำเทสจากบทนี้" ทำงาน (`me.py:3098` ต้อง ≥ 5 แถว)

### 7.4 ภาษา

- [ ] สร้าง `*_en` เพิ่มสำหรับ `title_en`, `variant_title_en`, `story_intro`, `think_story`, `mini_quiz`, `key_vocabulary`, `worked_examples` (renderer รองรับสลับ TH/EP)

---

## 8. ข้อจำกัดของรายงานนี้

1. **ไม่พบไฟล์ "Lesson Design Guidelines" แยก** — ใช้โครงสร้าง 9 ข้อจาก Task description เป็นเกณฑ์ ถ้าพี่แอร์มีไฟล์จริง ควรเทียบซ้ำ
2. **ทดสอบ renderer ด้วย Node simulation** โดยคัดลอกฟังก์ชันตรงจาก `page.tsx` (ไม่ได้รัน Next.js dev server จริง) — ผลตรงกับโค้ดจริงทุกจุดที่ตรวจ แต่ยังไม่ได้ยืนยันแบบ end-to-end ในเบราว์เซอร์
3. **ไม่ได้แก้ไฟล์ Demo** ตามกฎ — หัวข้อ 3 ให้ "ข้อความที่แก้ได้เลย" สำหรับ Chief Dispatcher
4. **ไม่ได้ commit / push / deploy / restart container**

---

*รายงานโดย Prim (QA + Platform Fit) · Topa Math · 2026-11-08*
