# Affiliate Withdrawal Notification Flow Report

Date: 2026-06-17

## Current Flow

- User endpoint: `POST /me/affiliate/withdrawals`
- Database table: `affiliate_withdrawal_requests`
- Admin page: `/admin/affiliates`
- Admin API: `GET /admin/affiliates`
- Balance reservation: immediate in the same database transaction by locking available `affiliate_commission_ledger` rows, moving them to `status = "withdrawn"`, and setting `withdrawal_request_id`.
- Audit log: created in `admin_audit_logs` with `action = "affiliate_withdrawal_requested"` when the withdrawal request is created.

## Notification Flow

Before this change, no email or notification sender existed for affiliate withdrawal requests.

Implemented email notification after the withdrawal transaction is committed:

- Admin notification recipient: `AFFILIATE_ADMIN_NOTIFICATION_EMAIL`
- User confirmation recipient: the authenticated user's `users.email`
- Sender: `EMAIL_FROM`
- Provider: SMTP via `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, and `SMTP_USE_TLS`
- Trigger code: `apps/api/app/routers/share.py` calls `send_withdrawal_notifications()` after `db.commit()`
- Templates: plain text messages in `apps/api/app/services/affiliates.py`

If SMTP is not configured, the sender logs `email_delivery_skipped` and does not raise. If delivery raises an exception, the error is logged and the withdrawal request remains committed and visible in `/admin/affiliates`.

## Duplicate Protection

Users cannot create another withdrawal request while they already have an active request in one of these statuses:

- `pending_review`
- `approved`
- `processing`

This protects against double-submit and repeated clicks while preserving the existing manual admin review flow.

## Security Notes

- Withdrawal amount is calculated and reserved server-side only.
- The frontend does not provide or control commission amounts.
- Email addresses in admin/audit notification content are masked where appropriate.
- Admin visibility remains behind existing admin role checks.
- Money remains stored as integer minor units.

## Tests Added

Covered in `apps/api/tests/test_api.py`:

- Successful withdrawal request reserves balance.
- Insufficient balance does not create a withdrawal request.
- Duplicate active withdrawal request is rejected.
- Admin notification email is triggered.
- User confirmation email is triggered.
- Email delivery failure does not remove or hide the withdrawal request.
- Audit log is created for user-submitted withdrawal requests.

## Validation

- `python -m py_compile apps/api/app/core/config.py apps/api/app/services/email_notifications.py apps/api/app/services/affiliates.py apps/api/app/routers/share.py apps/api/tests/test_api.py`
- `python -m pytest apps/api/tests/test_api.py -k "affiliate_withdrawal or affiliate_registration_attribution or invoice_paid_creates_affiliate_commission_once or affiliate_refund_reverses_commission or user_cannot_view_other_affiliate_data" -q`

Result: 9 passed, 97 deselected.

## Required Environment Variables

```env
AFFILIATE_ADMIN_NOTIFICATION_EMAIL=
EMAIL_FROM=
SMTP_HOST=
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_USE_TLS=true
```
