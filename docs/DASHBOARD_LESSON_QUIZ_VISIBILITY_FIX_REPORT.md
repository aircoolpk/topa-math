# Dashboard Lesson and Quiz Visibility Fix Report

วันที่: 21 มิถุนายน 2026

## สรุป

Dashboard Grade 3 TH ใช้ canonical topic-folder loader เดียวกับ `/me/lessons` แล้ว และ production คืน:

- current Grade 3 lessons: 11
- matching TH quizzes: 11/11 cards
- EP lessons ใน TH mode: 0
- Grade 2 review: 0 เพราะ Grade 2 canonical content ยังเป็น `needs_review`

## สาเหตุที่ Dashboard ไม่แสดงบทเรียน

มีสองปัญหาซ้อนกัน:

1. หน้า `/lessons` แบบไม่ระบุ grade ยังสามารถเห็น legacy flat Grade 3 IDs เช่น `g3_area_intro` ซึ่งมี sidecar status เดิมเป็น `approved`
2. canonical topic-folder ใหม่ใช้ IDs เช่น `g3_addition_subtraction` และ variant key เช่น:

```text
g3_addition_subtraction__TH__add_sub_th_001
```

แต่ sidecar ไม่มี key ใหม่เหล่านี้ และ JSON variants เป็น `needs_review` จึงถูก production approval gate ซ่อนทั้งหมด

เมื่อ canonical rows ว่าง `_dashboard_lessons()` จึง fallback ไป legacy DB/flat lesson source ทำให้ dashboard กับ `/lessons?grade=3` ไม่ใช้ชุดข้อมูลเดียวกัน

## Loader และ Source ที่ใช้หลังแก้

Lesson source:

```text
apps/api/app/content/math/grade_3/lessons/TH/[topic_folder]/*.json
```

Quiz source:

```text
apps/api/app/content/math/grade_3/quizzes/TH/[topic_folder]/*.json
```

ไม่มีการอ่านจาก:

- `_content_backups`
- `backup_*`
- `lessons old`
- `quizzes old`
- `question_banks`
- legacy flat Grade 3 files

Loader หลัก:

- `list_canonical_lessons()`
- `list_topic_folder_lessons()`
- `list_topic_lesson_variants()`
- `list_topic_quiz_variants()`
- `get_topic_lesson_group()`

## Approval Key

Grade 3 TH canonical approval ถูกย้ายไป key ใหม่:

Lesson group:

```text
g3_addition_subtraction
```

Lesson variant:

```text
g3_addition_subtraction__TH__add_sub_th_001
g3_addition_subtraction__TH__add_sub_th_002
```

Quiz variant:

```text
g3_addition_subtraction__TH__add_sub_th_q001
g3_addition_subtraction__TH__add_sub_th_q002
```

Migration สร้าง:

- 11 topic groups
- 24 lesson approval keys (11 group + 13 variant)
- 22 quiz variant approval keys

Sidecar files:

- `apps/api/app/content/math/_content_status/lessons.json`
- `apps/api/app/content/math/_content_status/tests.json`

ไม่ใช้ stale keys เช่น `g3_area_intro` เพื่ออนุมัติ topic-folder cards

## Quiz Pairing

`lesson_group_id` ถูกแปลงเป็น grade และ topic folder:

```text
g3_addition_subtraction
-> grade 3
-> addition_subtraction
-> grade_3/quizzes/TH/addition_subtraction/*.json
```

Quiz ต้อง:

- อยู่ใน program folder ตรงกัน
- ผ่าน approval sidecar
- มีคำถามที่ใช้งานได้อย่างน้อย 10 ข้อ

เมื่อผ่าน card จะคืน:

```json
{
  "test_available": true,
  "test_disabled_reason": null
}
```

## Stable Card Fields

Dashboard canonical cards มี:

- `lesson_group_id`
- `topic_folder`
- `grade_level`
- `program_type`
- `title`
- `description`
- `duration`
- `test_available`
- `test_disabled_reason`

Frontend ใช้ `lesson_group_id` สำหรับ:

```text
/dashboard/lessons/[lesson_group_id]?program_type=TH
```

และ test start:

```text
POST /me/lessons/[lesson_group_id]/test/start?program_type=TH
```

## Review Lessons

Grade 2 TH พบ 11 topic folders และ 22 lesson variants แต่ทั้งหมดเป็น `needs_review`

ดังนั้น dashboard คืน:

```text
review_lessons=[]
review_hidden_reason=found_files_but_needs_review
```

ระบบไม่ fallback ไป legacy Grade 2 และไม่ bypass approval

## Debug Logging

เพิ่ม log:

```text
dashboard_lesson_visibility
child_grade=3
program=TH
current_discovered=11
current_approved=11
review_discovered=11
review_approved=0
quiz_available=11
current_hidden_reason=None
review_hidden_reason=found_files_but_needs_review
```

ไม่มี token หรือ password ใน log

## Performance

canonical loader เดิมอ่าน topic files และ sidecar ซ้ำหลายรอบ ทำให้ dashboard ใช้เวลาประมาณ 23 วินาที ซึ่งเกิน frontend timeout

เพิ่ม mtime-aware cache:

- invalidate เมื่อ active JSON folder เปลี่ยน
- invalidate เมื่อ lesson/test sidecar เปลี่ยน
- ไม่ cache backup หรือ legacy paths

ผล:

- local canonical first load: ~0.235 วินาที
- cached load: ~0.017 วินาที
- production dashboard cold request: ~13.9 วินาที
- production warm request: ~3.9 วินาที
- frontend dashboard timeout เพิ่มเป็น 30 วินาทีเพื่อรองรับ cold filesystem

## ไฟล์ที่แก้

- `apps/api/app/services/lesson_content.py`
- `apps/api/app/routers/me.py`
- `apps/api/tests/test_api.py`
- `apps/api/app/content/math/_content_status/lessons.json`
- `apps/api/app/content/math/_content_status/tests.json`
- `apps/web/src/lib/api/me.ts`
- `apps/web/src/app/dashboard/page.tsx`

## Validation

| รายการ | ผล |
|---|---|
| `python -m py_compile` | PASS |
| focused Grade 3 canonical dashboard test | PASS |
| `npm run lint` | PASS หลัง build สร้าง `.next/types` |
| `npm run build` | PASS |
| Docker API/Web build | PASS |
| Docker compose up | PASS |
| API/Web containers healthy | PASS |
| `/me/dashboard?program_type=TH` | 200 |
| current Grade 3 TH cards | 11 |
| `g3_addition_subtraction` | พบ |
| EP cards ใน TH mode | 0 |
| cards with `test_available=true` | 11/11 |
| lesson detail `g3_addition_subtraction` | 200 |
| test start `g3_addition_subtraction` | 200, 10 questions |
| direct dashboard route | 200 |
| direct lesson route | 200 |

Next build ยังแสดง warning เดิมจาก ESLint 9/Next.js 14 แต่ build จบ exit code 0

In-app browser automation เชื่อมต่อไม่ได้จาก browser session metadata จึงยืนยัน UI route ผ่าน production API payload, direct page routes และ exact frontend rendering/link code

## Final Decision

`READY_DASHBOARD_LESSONS_VISIBLE`
