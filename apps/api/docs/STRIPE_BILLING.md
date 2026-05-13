# Stripe Billing

The backend uses Stripe Checkout in subscription mode. Checkout starts payment, but Stripe webhooks are the source of truth for activating or removing paid membership.

## Storage decision

For the MVP, billing fields are stored on `child_profiles` because this app currently has one student profile per parent user and the access rules already read membership from `ChildProfile`. A separate subscriptions table is a good next step if one parent can buy multiple child subscriptions or several products at once.

Stored billing fields include `membership_status`, `plan_code`, `active_price_code`, `price_type`, `billing_program_type`, Stripe customer/subscription IDs, subscription status, current period end, cancellation flag, paid time, and canceled time.

## Environment variables

Put real local/test values in `.env`. Do not commit real secret keys.

```env
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_EP_FOUNDER_MONTHLY=
STRIPE_PRICE_TH_FOUNDER_MONTHLY=
STRIPE_PRICE_EP_PLUS_MONTHLY=
STRIPE_PRICE_TH_PLUS_MONTHLY=
STRIPE_PRICE_EP_PLUS_YEARLY_PROMO=
STRIPE_PRICE_TH_PLUS_YEARLY_PROMO=
FOUNDER_PRICE_LIMIT=100
FRONTEND_BASE_URL=http://127.0.0.1:3000
BACKEND_BASE_URL=http://127.0.0.1:8001
```

Stripe Checkout must receive price IDs, not product IDs. Product IDs are kept in the backend plan catalog for metadata and display.

## Plans

| plan_code | program | amount | interval | price_type | product_id |
|---|---:|---:|---|---|---|
| `free` | FREE | 0 THB | none | free | |
| `th_founder_monthly` | TH | 199 THB | month | founder | `prod_USgNoW3SqfYosf` |
| `ep_founder_monthly` | EP | 399 THB | month | founder | `prod_USgTRV2ZTxagVu` |
| `th_plus_monthly` | TH | 299 THB | month | normal | `prod_USg9dDnZ1L1Wye` |
| `ep_plus_monthly` | EP | 599 THB | month | normal | `prod_USgHn9EzVjHbsR` |
| `th_plus_yearly_promo` | TH | 2990 THB | year | yearly_promo | `prod_USga7vRK8g1M0d` |
| `ep_plus_yearly_promo` | EP | 5990 THB | year | yearly_promo | `prod_USgai3JWRR6tQ2` |

Founder pricing is limited to `FOUNDER_PRICE_LIMIT`, default `100`, active successful subscriptions total across both TH Founder and EP Founder. Checkout sessions do not consume a Founder slot. The webhook is the source of truth: only active/trialing paid Founder subscriptions count.

## Run locally

```powershell
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```

Open `http://127.0.0.1:8001/docs`.

Run the frontend separately at `FRONTEND_BASE_URL`, usually `http://127.0.0.1:3000`.

## Backend endpoints

- `GET /billing/prices` is public and returns the Free plan plus all six paid Stripe plans.
- `GET /billing/status` requires auth and returns the current child's membership/subscription state.
- `POST /billing/create-checkout-session` requires auth and returns a Stripe Checkout URL.
- `POST /billing/create-portal-session` requires auth and returns a Stripe Billing Portal URL when a Stripe customer exists.
- `POST /webhooks/stripe` receives Stripe events and is the source of truth for paid access.

## Test Checkout

Authorize in Swagger, then call:

```http
POST /billing/create-checkout-session
{
  "plan_code": "th_founder_monthly"
}
```

Example response:

```json
{
  "checkout_url": "https://checkout.stripe.com/c/pay/cs_test_...",
  "plan_code": "th_founder_monthly",
  "price_type": "founder",
  "program_type": "TH"
}
```

Open the returned URL and pay with a Stripe test card such as `4242 4242 4242 4242`.

## Webhook forwarding

Run Stripe CLI forwarding:

```powershell
stripe listen --forward-to localhost:8001/webhooks/stripe
```

Copy the printed `whsec_...` value into:

```env
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Verify membership

After successful Checkout and webhook delivery:

```http
GET /billing/status
```

Example TH Plus response:

```json
{
  "membership_status": "plus",
  "plan_code": "th_plus",
  "active_price_code": "th_founder_monthly",
  "price_type": "founder",
  "program_type": "TH",
  "subscription_status": "active",
  "current_period_end": "2030-01-01T00:00:00+00:00",
  "cancel_at_period_end": false
}
```

## Access policy

TH Plus unlocks TH lessons and grade tests ป.1-ป.6 and removes the free test limit. EP Plus unlocks EP and TH content, all grade tests, and removes the free test limit. Current lesson data is treated as TH unless future content is tagged with `program_type = "EP"`.

`active` and `trialing` subscriptions unlock access. `unpaid`, `canceled`, `incomplete`, and `incomplete_expired` remove paid access. For `invoice.payment_failed`, the MVP records `past_due` but keeps existing access until Stripe sends a subscription status update to unpaid/canceled/incomplete_expired.

For the MVP, canceled Founder subscriptions stop counting toward the active Founder pool, so another customer may buy Founder pricing while fewer than 100 active Founder subscriptions exist. Near the 100-seat boundary, sessions created while slots were available are allowed to complete; a tiny oversubscription is accepted rather than introducing expiring reservations.
