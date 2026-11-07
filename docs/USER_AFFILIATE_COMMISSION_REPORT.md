# USER Affiliate Commission Report

Date: 2026-06-17

## Summary

เพิ่มระบบ Affiliate แบบแยกจากระบบ referral/coins เดิม โดยยังคง referral token, click/register attribution และ coin ledger เดิมไว้ครบ ระบบใหม่ใช้ commission ledger เป็นหน่วยสตางค์ทั้งหมด และคำนวณค่าคอมมิชชันฝั่ง backend จากยอด `invoice.paid.amount_paid` ของ Stripe เท่านั้น

## Implemented

- เปลี่ยนการ์ด `STREAK` บน `/dashboard` เป็น `AFFILIATE` และคลิกไป `/dashboard/affiliate`
- เพิ่มหน้า `/dashboard/affiliate`
  - referral link พร้อม Copy และ social share
  - จำนวนผู้สมัคร, สมาชิกที่จ่ายเงิน, ยอดชำระรวม, commission รวม
  - pending, available, withdrawn balance
  - เพิ่มบัญชีรับเงินแบบ bank หรือ PromptPay
  - ส่งคำขอถอนเงินและ reserve ledger ทันที
  - ตาราง registrations, commissions, withdrawals
- เพิ่มหน้า `/admin/affiliates`
  - รายชื่อ affiliate
  - registrations, paid members, commissions, balances
  - withdrawal requests พร้อม approve, reject, processing, paid
- เพิ่ม backend affiliate service และ API
  - `GET /me/affiliate`
  - `PUT /me/affiliate/payout-account`
  - `POST /me/affiliate/withdrawals`
  - `GET /admin/affiliates`
  - `POST /admin/affiliates/withdrawals/{id}/approve`
  - `POST /admin/affiliates/withdrawals/{id}/processing`
  - `POST /admin/affiliates/withdrawals/{id}/paid`
  - `POST /admin/affiliates/withdrawals/{id}/reject`
- เพิ่ม commission จาก `invoice.paid`
  - ใช้ `amount_paid` เป็นยอดหลังหักส่วนลด
  - คำนวณ 3% ด้วย basis points: `amount_paid_minor * 300 // 10000`
  - idempotency ด้วย unique `payment_reference_id`
  - refund/chargeback reverse ledger จาก invoice reference
- เพิ่ม withdrawal reserve
  - ถอนเฉพาะ `available`
  - ขั้นต่ำตาม `AFFILIATE_MIN_WITHDRAWAL_MINOR`
  - ledger ถูกเปลี่ยนเป็น `withdrawn` ทันทีเมื่อสร้างคำขอ
  - reject จะคืน ledger เป็น `available`
- ข้อมูล user/affiliate ดึงจาก session token เท่านั้น
- frontend ไม่ส่งยอดชำระหรือ commission ที่เชื่อถือได้เข้า backend
- admin API ใช้ `require_admin`
- mask email และข้อมูลบัญชีรับเงินใน payload ที่แสดงผล

## Environment

เพิ่มค่า config:

```env
AFFILIATE_COMMISSION_RATE_BPS=300
AFFILIATE_COMMISSION_HOLD_DAYS=7
AFFILIATE_MIN_WITHDRAWAL_MINOR=50000
```

อัปเดตใน:

- `.env.docker.example`
- `apps/api/.env.example`
- `apps/api/.env.staging.example`
- `docker-compose.beta.yml`

## Migration

เพิ่ม Alembic migration:

- `apps/api/alembic/versions/20260617_0001_affiliate_commission.py`

ตารางใหม่:

- `affiliate_payout_accounts`
- `affiliate_withdrawal_requests`
- `affiliate_commission_ledger`

เพิ่ม local schema maintenance สำหรับตารางเดียวกัน เพื่อรองรับ flow dev/local ที่ใช้ `create_all` และ `ensure_local_schema`

## Tests

ผ่าน:

- `python -m py_compile` สำหรับไฟล์ backend ที่แก้
- `python -m py_compile` สำหรับ `apps/api/app` โดยไม่รวม `app/content`
- `python -m pytest apps/api/tests/test_api.py -k "affiliate or invoice_paid_creates_affiliate or refund_reverses_commission or withdrawal_cannot_exceed" -q`
  - 5 passed
- `npm run lint`
- `npm run build`
- `python -m alembic upgrade head --sql`
- `docker compose -f docker-compose.beta.yml build 4craft-api 4craft-web`

ไม่ผ่านหรือมีข้อจำกัด:

- `python -m py_compile apps/api/app` แบบรวม `app/content` ล้มที่ไฟล์เดิม `apps/api/app/content/math/question_banks/_generate_remaining.py` เพราะมี `SyntaxError: '{' was never closed`
- full backend suite:
  - `69 passed, 33 failed`
  - failures ส่วนใหญ่เกี่ยวกับ content/lesson fixtures, question bank, lesson visibility และ billing expectations เดิม
  - affiliate tests ใหม่ผ่านทั้งหมด
- Docker health check:
  - API container unhealthy เพราะ PostgreSQL volume/config เดิมรหัสผ่านไม่ตรงกับ `DATABASE_URL`
  - error: `password authentication failed for user "postgres"`
  - ไม่ได้ล้าง Docker volume เพื่อหลีกเลี่ยงการทำลายข้อมูลเดิม

## Files Changed

- `.env.docker.example`
- `docker-compose.beta.yml`
- `apps/api/.env.example`
- `apps/api/.env.staging.example`
- `apps/api/alembic/versions/20260617_0001_affiliate_commission.py`
- `apps/api/app/core/config.py`
- `apps/api/app/core/schema_maintenance.py`
- `apps/api/app/models/entities.py`
- `apps/api/app/models/__init__.py`
- `apps/api/app/services/affiliates.py`
- `apps/api/app/routers/billing.py`
- `apps/api/app/routers/share.py`
- `apps/api/app/routers/admin.py`
- `apps/api/tests/test_api.py`
- `apps/web/src/lib/api/me.ts`
- `apps/web/src/lib/api/admin.ts`
- `apps/web/src/app/dashboard/page.tsx`
- `apps/web/src/app/dashboard/affiliate/page.tsx`
- `apps/web/src/app/admin/layout.tsx`
- `apps/web/src/app/admin/affiliates/page.tsx`
- `docs/USER_AFFILIATE_COMMISSION_REPORT.md`

## Follow Up

- ตั้งค่า `AFFILIATE_*` ใน environment จริง
- แก้ Docker Postgres credential/volume ให้ตรงกันก่อน health check
- ตรวจ Stripe webhook ให้ส่ง `invoice.paid`, `charge.refunded`, และ `charge.dispute.created`
- พิจารณา policy สำหรับ partial refund หากต้องการ reverse เฉพาะสัดส่วน แทน reverse ทั้ง invoice
- ตรวจ full backend suite แยกจากงาน affiliate เพราะยังมี failures เดิมใน content/billing/lesson paths

## Final Decision

READY_AFFILIATE_BETA with noted environment/test-suite blockers
