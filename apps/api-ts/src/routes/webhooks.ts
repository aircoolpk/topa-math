/**
 * Webhook endpoints — mounted at `/webhooks`.
 *
 * Ported from the legacy FastAPI service:
 *
 *  - `apps/api/app/routers/billing.py`  → `POST /webhooks/stripe`
 *  - `apps/api/app/routers/mpp_orders.py` → `POST /webhooks/mpp/payments`
 *  - `apps/api/app/routers/payment_integration.py` → `POST /webhooks/mpp/staging`
 *
 * The Stripe webhook is the only endpoint that changes the membership of a
 * child profile, so it carries the side effects of the FastAPI service:
 * the checkout reservation is closed, the subscription state is written to
 * the child profile, the referrer is paid and the affiliate commission is
 * booked.
 */
import { Hono, type Context } from 'hono'

import { badRequest, conflict, HttpError, serviceUnavailable } from '../lib/errors'
import type { Sql } from '../lib/db'
import type { AppEnv } from '../lib/http'
import {
  getBillingSettings,
  isProductionEnvironment,
  type BillingSettings,
} from '../lib/billing/settings'
import { findPlan, planFromPriceId, type BillingPlan } from '../lib/billing/plans'
import { retrieveSubscription, type StripeSubscription } from '../lib/billing/stripe'
import { verifyStripeSignature } from '../lib/billing/signature'
import { hmacSha256, prepareHmacKey, sha256 } from '../lib/sha256'
import { toHex, utf8Encode } from '../lib/base64url'

export const webhookRoutes = new Hono<AppEnv>()

/** The Stripe subscription statuses that grant access. */
const PAID_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing'])

/** The Stripe subscription statuses that revoke access. */
const UNPAID_SUBSCRIPTION_STATUSES = new Set([
  'unpaid',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'paused',
])

/** The membership statuses that count as paid. */
const PAID_MEMBERSHIP_STATUSES = new Set(['paid', 'plus', 'trial'])

/** The fields of an MPP webhook body that may be stored. */
const SAFE_FIELDS = new Set([
  'payment_id',
  'merchant_order_id',
  'amount',
  'currency',
  'status',
  'public_id',
  'event_id',
  'event_type',
])

/** The MPP staging host pairs the UAT tooling may run against. */
const STAGING_HOST_PAIRS: Array<[string, string]> = [
  ['https://staging-api.mmerchat.cc/api/v1', 'https://staging-pay.mmerchat.cc'],
  ['https://staging-api.mmerchant.cc/api/v1', 'https://staging-pay.mmerchant.cc'],
]

/** The largest webhook body the service accepts. */
const MAX_WEBHOOK_BYTES = 262144

/* ────────────────────────────── helpers ────────────────────────────── */

/**
 * Read the billing configuration from the raw bindings.
 *
 * @param c the request context.
 */
function settingsOf(c: Context<AppEnv>): BillingSettings {
  return getBillingSettings(c.env)
}

/**
 * The database handle of the request.
 *
 * @param c the request context.
 */
function sqlOf(c: Context<AppEnv>): Sql {
  return c.get('sql')
}

/**
 * The id of a Stripe object.
 *
 * Mirrors `billing._id()`: a string is its own id, an object carries it in
 * its `id` field.
 *
 * @param value the Stripe value.
 */
function stripeId(value: unknown): string | null {
  if (typeof value === 'string') {
    return value
  }
  if (value && typeof value === 'object') {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'string') {
      return id
    }
  }
  return null
}

/**
 * Read a field of a Stripe object.
 *
 * @param value the Stripe object.
 * @param key the field name.
 * @param fallback the value used when the field is missing.
 */
function stripeGet(value: unknown, key: string, fallback: unknown = null): unknown {
  if (!value || typeof value !== 'object') {
    return fallback
  }
  const record = value as Record<string, unknown>
  return key in record ? record[key] : fallback
}

/**
 * The subscription id of a Stripe subscription object.
 *
 * @param subscription the Stripe subscription.
 */
function subscriptionPriceId(subscription: unknown): string | null {
  const items = stripeGet(subscription, 'items')
  const data = stripeGet(items, 'data', [])
  if (!Array.isArray(data) || data.length === 0) {
    return null
  }
  return stripeId(stripeGet(data[0], 'price'))
}

/**
 * The status of a Stripe subscription.
 *
 * @param subscription the Stripe subscription.
 */
function subscriptionStatus(subscription: unknown): string {
  const status = stripeGet(subscription, 'status', 'none')
  const value = status === null || status === undefined || status === '' ? 'none' : String(status)
  return value
}

/**
 * The current period end of a Stripe subscription, as an ISO timestamp.
 *
 * @param subscription the Stripe subscription.
 */
function subscriptionPeriodEnd(subscription: unknown): string | null {
  const value = stripeGet(subscription, 'current_period_end')
  if (typeof value !== 'number' || !Number.isFinite(value) || value === 0) {
    return null
  }
  return new Date(Math.floor(value) * 1000).toISOString()
}

/**
 * A child profile, reduced to the columns the webhook writes.
 */
interface WebhookChildRow {
  id: string
  parent_user_id: string
  membership_provider: string | null
  membership_status: string | null
  plan_code: string | null
  active_price_code: string | null
  price_type: string | null
  billing_program_type: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  subscription_status: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean | null
  paid_at: string | null
  canceled_at: string | null
  mpp_access_ends_at: string | null
}

/** The columns read from `child_profiles` for the webhook. */
const WEBHOOK_CHILD_COLUMNS = `
  id, parent_user_id, membership_provider, membership_status, plan_code,
  active_price_code, price_type, billing_program_type, stripe_customer_id,
  stripe_subscription_id, subscription_status, current_period_end,
  cancel_at_period_end, paid_at, canceled_at, mpp_access_ends_at
`

/**
 * Find the child profile a Stripe event belongs to.
 *
 * Mirrors `billing._find_child_for_event()`: the profile of the user first,
 * then the profile carrying the Stripe customer or subscription.
 *
 * @param sql the database handle.
 * @param userId the parent user id.
 * @param customerId the Stripe customer id.
 * @param subscriptionId the Stripe subscription id.
 */
async function findChildForEvent(
  sql: Sql,
  userId: string | null,
  customerId: string | null,
  subscriptionId: string | null,
): Promise<WebhookChildRow | null> {
  if (userId) {
    const rows = (await sql.query(
      `SELECT ${WEBHOOK_CHILD_COLUMNS} FROM child_profiles
       WHERE parent_user_id = $1 ORDER BY id LIMIT 1`,
      [userId],
    )) as WebhookChildRow[]
    if (rows[0]) {
      return rows[0]
    }
  }

  const filters: string[] = []
  const params: unknown[] = []
  if (subscriptionId) {
    params.push(subscriptionId)
    filters.push(`stripe_subscription_id = $${params.length}`)
  }
  if (customerId) {
    params.push(customerId)
    filters.push(`stripe_customer_id = $${params.length}`)
  }
  if (filters.length === 0) {
    return null
  }

  const rows = (await sql.query(
    `SELECT ${WEBHOOK_CHILD_COLUMNS} FROM child_profiles
     WHERE ${filters.join(' OR ')} ORDER BY id LIMIT 1`,
    params,
  )) as WebhookChildRow[]
  return rows[0] ?? null
}

/**
 * Whether a child profile currently has a paid membership.
 *
 * Mirrors `foundation.is_paid()`.
 *
 * @param child the child profile.
 */
function childIsPaid(child: WebhookChildRow): boolean {
  if (child.membership_provider === 'mpp') {
    const endsAt = child.mpp_access_ends_at ? new Date(child.mpp_access_ends_at) : null
    return (
      PAID_MEMBERSHIP_STATUSES.has((child.membership_status ?? '').toLowerCase()) &&
      endsAt !== null &&
      endsAt.getTime() > Date.now()
    )
  }
  return PAID_MEMBERSHIP_STATUSES.has((child.membership_status ?? 'free').toLowerCase())
}

/**
 * Write the membership of a child profile.
 *
 * @param sql the database handle.
 * @param child the child profile.
 * @param values the columns to write.
 */
async function writeChild(
  sql: Sql,
  child: WebhookChildRow,
  values: Partial<WebhookChildRow>,
): Promise<void> {
  const columns = Object.keys(values)
  if (columns.length === 0) {
    return
  }
  const assignments = columns.map((column, index) => `${column} = $${index + 2}`)
  const params = columns.map((column) => values[column as keyof WebhookChildRow])
  await sql.query(
    `UPDATE child_profiles SET ${assignments.join(', ')} WHERE id = $1`,
    [child.id, ...params],
  )
}

/**
 * Apply a paid plan to a child profile.
 *
 * Mirrors `billing._apply_paid_plan()`: an MPP membership that is still paid
 * is never overwritten by Stripe.
 *
 * @param child the child profile.
 * @param plan the plan.
 */
function paidPlanValues(child: WebhookChildRow, plan: BillingPlan): Partial<WebhookChildRow> {
  const values: Partial<WebhookChildRow> = {}
  if (child.membership_provider === 'mpp') {
    if (childIsPaid(child)) {
      return values
    }
    values.membership_provider = 'stripe'
  }
  values.membership_status = 'plus'
  values.plan_code = plan.program_type === 'EP' ? 'ep_plus' : 'th_plus'
  values.active_price_code = plan.plan_code
  values.price_type = plan.price_type
  values.billing_program_type = plan.program_type
  values.paid_at = child.paid_at ?? new Date().toISOString()
  values.canceled_at = null
  return values
}

/**
 * Remove the paid access of a child profile.
 *
 * Mirrors `billing._clear_paid_access()`.
 *
 * @param child the child profile.
 */
function clearedAccessValues(child: WebhookChildRow): Partial<WebhookChildRow> {
  if (child.membership_provider === 'mpp') {
    return {}
  }
  return {
    membership_status: 'free',
    plan_code: 'free',
    active_price_code: null,
    price_type: null,
    billing_program_type: null,
  }
}

/**
 * Apply a Stripe subscription to a child profile.
 *
 * Mirrors `billing._apply_subscription_state()`.
 *
 * @param child the child profile.
 * @param subscription the Stripe subscription.
 * @param plan the plan the subscription was bought for.
 * @param settings the billing configuration.
 */
function subscriptionStateValues(
  child: WebhookChildRow,
  subscription: unknown,
  plan: BillingPlan | undefined,
  settings: BillingSettings,
): Partial<WebhookChildRow> {
  const subscriptionId = stripeId(subscription)
  const customerId = stripeId(stripeGet(subscription, 'customer'))
  const status = subscriptionStatus(subscription)
  const priceId = subscriptionPriceId(subscription)
  const resolved =
    plan ??
    planFromPriceId(priceId, settings) ??
    findPlan(child.active_price_code ?? '') ??
    undefined

  const values: Partial<WebhookChildRow> = {
    stripe_customer_id: customerId ?? child.stripe_customer_id,
    stripe_subscription_id: subscriptionId ?? child.stripe_subscription_id,
    subscription_status: status,
    current_period_end: subscriptionPeriodEnd(subscription),
    cancel_at_period_end: Boolean(stripeGet(subscription, 'cancel_at_period_end', false)),
  }

  if (PAID_SUBSCRIPTION_STATUSES.has(status) && resolved) {
    Object.assign(values, paidPlanValues(child, resolved))
    return values
  }

  if (UNPAID_SUBSCRIPTION_STATUSES.has(status)) {
    Object.assign(values, clearedAccessValues(child))
    if (status === 'canceled' || status === 'incomplete_expired') {
      values.canceled_at = child.canceled_at ?? new Date().toISOString()
    }
  }

  return values
}

/* ────────────────────────── referral & affiliate ───────────────────── */

/**
 * Record a referral event.
 *
 * Mirrors `referrals.record_referral_event()`.
 *
 * @param sql the database handle.
 * @param settings the billing configuration.
 * @param token the referral token of the referrer.
 * @param eventType the event type.
 * @param referredUserId the referred user.
 * @param metadata the event metadata.
 */
async function recordReferralEvent(
  sql: Sql,
  settings: BillingSettings,
  token: string | null,
  eventType: string,
  referredUserId: string | null,
  metadata: Record<string, unknown>,
): Promise<void> {
  if (!settings.referralEnabled || !token) {
    return
  }

  const referrers = (await sql.query(
    `SELECT id FROM users WHERE referral_token = $1 LIMIT 1`,
    [token],
  )) as Array<{ id: string }>
  const referrer = referrers[0]
  if (!referrer) {
    return
  }
  if (referredUserId && referrer.id === referredUserId) {
    return
  }

  await sql.query(
    `INSERT INTO referral_events (
       id, referrer_user_id, referred_user_id, referral_token, event_type,
       share_token, visitor_hash, metadata, created_at
     ) VALUES ($1, $2, $3, $4, $5, NULL, NULL, $6, now())`,
    [
      crypto.randomUUID(),
      referrer.id,
      referredUserId,
      token,
      eventType,
      JSON.stringify(metadata),
    ],
  )
}

/**
 * Award referral coins.
 *
 * Mirrors `referrals.award_referral_coins()`.
 *
 * @param sql the database handle.
 * @param settings the billing configuration.
 * @param referrerUserId the referrer.
 * @param amount the number of coins.
 * @param rewardType the ledger type.
 * @param referenceId the reference id (idempotency key).
 * @param note the ledger note.
 */
async function awardReferralCoins(
  sql: Sql,
  settings: BillingSettings,
  referrerUserId: string,
  amount: number,
  rewardType: string,
  referenceId: string,
  note: string,
): Promise<void> {
  if (amount <= 0) {
    return
  }

  const existing = (await sql.query(
    `SELECT id FROM coin_ledger
     WHERE user_id = $1 AND reference_id = $2 AND type = $3 LIMIT 1`,
    [referrerUserId, referenceId, rewardType],
  )) as Array<{ id: string }>
  if (existing[0]) {
    return
  }

  const holdDays = Math.max(0, settings.referralRewardHoldDays || 0)
  await sql.query(
    `INSERT INTO coin_ledger (
       id, user_id, amount, type, status, reference_id, activated_at, note, created_at
     ) VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, now())`,
    [
      crypto.randomUUID(),
      referrerUserId,
      amount,
      rewardType,
      referenceId,
      holdDays > 0 ? new Date(Date.now() + holdDays * 86_400_000).toISOString() : null,
      note,
    ],
  )
}

/**
 * Pay the referrer of a user that just became a paying member.
 *
 * Mirrors `referrals.award_paid_referral_if_needed()`.
 *
 * @param sql the database handle.
 * @param settings the billing configuration.
 * @param referredUserId the user that paid.
 * @param referenceId the payment reference.
 */
async function awardPaidReferral(
  sql: Sql,
  settings: BillingSettings,
  referredUserId: string,
  referenceId: string | null,
): Promise<void> {
  if (!settings.referralEnabled) {
    return
  }

  const users = (await sql.query(
    `SELECT id, referred_by_user_id, referral_token FROM users WHERE id = $1 LIMIT 1`,
    [referredUserId],
  )) as Array<{ id: string; referred_by_user_id: string | null; referral_token: string | null }>
  const referred = users[0]
  if (!referred || !referred.referred_by_user_id) {
    return
  }

  const reference = `paid:${referred.id}`
  const existing = (await sql.query(
    `SELECT id FROM coin_ledger WHERE type = 'referral_paid' AND reference_id = $1 LIMIT 1`,
    [reference],
  )) as Array<{ id: string }>
  if (existing[0]) {
    return
  }

  const referrers = (await sql.query(
    `SELECT id, referral_token FROM users WHERE id = $1 LIMIT 1`,
    [referred.referred_by_user_id],
  )) as Array<{ id: string; referral_token: string | null }>
  const referrer = referrers[0]
  if (!referrer || referrer.id === referred.id) {
    return
  }

  await recordReferralEvent(
    sql,
    settings,
    referrer.referral_token,
    'paid',
    referred.id,
    { payment_reference: referenceId },
  )
  await awardReferralCoins(
    sql,
    settings,
    referrer.id,
    settings.referralPaidCoins,
    'referral_paid',
    reference,
    'First paid subscription referral reward',
  )
}

/**
 * Book the affiliate commission of a payment.
 *
 * Mirrors `affiliates.create_commission_for_payment()`.
 *
 * @param sql the database handle.
 * @param settings the billing configuration.
 * @param referredUserId the user that paid.
 * @param paymentReferenceId the payment reference (idempotency key).
 * @param amountPaidMinor the amount that was paid, in minor units.
 * @param currency the currency of the payment.
 * @param sourceEventId the Stripe event that carried the payment.
 * @param metadata the commission metadata.
 */
async function createCommissionForPayment(
  sql: Sql,
  settings: BillingSettings,
  referredUserId: string,
  paymentReferenceId: string | null,
  amountPaidMinor: number | null,
  currency: string,
  sourceEventId: string | null,
  metadata: Record<string, unknown>,
): Promise<void> {
  if (!paymentReferenceId || amountPaidMinor === null || Math.trunc(amountPaidMinor) <= 0) {
    return
  }

  const existing = (await sql.query(
    `SELECT id FROM affiliate_commission_ledger WHERE payment_reference_id = $1 LIMIT 1`,
    [paymentReferenceId],
  )) as Array<{ id: string }>
  if (existing[0]) {
    return
  }

  const users = (await sql.query(
    `SELECT id, referred_by_user_id FROM users WHERE id = $1 LIMIT 1`,
    [referredUserId],
  )) as Array<{ id: string; referred_by_user_id: string | null }>
  const referred = users[0]
  if (!referred || !referred.referred_by_user_id || referred.referred_by_user_id === referred.id) {
    return
  }

  const referrers = (await sql.query(
    `SELECT id FROM users WHERE id = $1 LIMIT 1`,
    [referred.referred_by_user_id],
  )) as Array<{ id: string }>
  const referrer = referrers[0]
  if (!referrer || referrer.id === referred.id) {
    return
  }

  const amount = Math.trunc(amountPaidMinor)
  const rateBps = settings.affiliateCommissionRateBps
  const commission = Math.floor((amount * rateBps) / 10_000)
  if (commission <= 0) {
    return
  }

  const holdDays = Math.max(0, settings.affiliateCommissionHoldDays || 0)
  const now = new Date()
  await sql.query(
    `INSERT INTO affiliate_commission_ledger (
       id, affiliate_user_id, referred_user_id, payment_reference_id,
       source_event_id, amount_paid_minor, commission_minor, currency, rate_bps,
       status, available_at, metadata, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now(), now())`,
    [
      crypto.randomUUID(),
      referrer.id,
      referred.id,
      paymentReferenceId,
      sourceEventId ?? '',
      amount,
      commission,
      String(currency || 'THB').toUpperCase().slice(0, 3),
      rateBps,
      holdDays > 0 ? 'pending' : 'available',
      new Date(now.getTime() + holdDays * 86_400_000).toISOString(),
      JSON.stringify(metadata),
    ],
  )
}

/**
 * Reverse the affiliate commission of a refunded payment.
 *
 * Mirrors `affiliates.reverse_commission_for_payment()`.
 *
 * @param sql the database handle.
 * @param paymentReferenceId the payment reference.
 * @param reason why the commission is reversed.
 * @param sourceEventId the Stripe event that carried the reversal.
 */
async function reverseCommissionForPayment(
  sql: Sql,
  paymentReferenceId: string | null,
  reason: string,
  sourceEventId: string | null,
): Promise<void> {
  if (!paymentReferenceId) {
    return
  }

  const rows = (await sql.query(
    `SELECT id, status, metadata FROM affiliate_commission_ledger
     WHERE payment_reference_id = $1 LIMIT 1`,
    [paymentReferenceId],
  )) as Array<{ id: string; status: string; metadata: Record<string, unknown> | null }>
  const ledger = rows[0]
  if (!ledger || ledger.status === 'reversed') {
    return
  }

  const metadata = { ...(ledger.metadata ?? {}) }
  if (ledger.status === 'withdrawn') {
    metadata.reverse_requested_after_withdrawal = true
    metadata.reverse_reason = reason
    metadata.reverse_event_id = sourceEventId
    await sql.query(
      `UPDATE affiliate_commission_ledger SET metadata = $1, updated_at = now() WHERE id = $2`,
      [JSON.stringify(metadata), ledger.id],
    )
    return
  }

  metadata.reverse_reason = reason
  metadata.reverse_event_id = sourceEventId
  await sql.query(
    `UPDATE affiliate_commission_ledger
     SET status = 'reversed', reversed_at = now(), metadata = $1, updated_at = now()
     WHERE id = $2`,
    [JSON.stringify(metadata), ledger.id],
  )
}

/* ──────────────────────────── Stripe webhook ───────────────────────── */

/**
 * `POST /webhooks/stripe` — the Stripe webhook.
 */
webhookRoutes.post('/stripe', async (c) => {
  const settings = settingsOf(c)
  const secretKey = settings.stripeSecretKey
  if (!secretKey) {
    throw new HttpError(500, 'Stripe configuration missing: STRIPE_SECRET_KEY')
  }
  if (!settings.stripeWebhookSecret) {
    throw new HttpError(500, 'Stripe configuration missing: STRIPE_WEBHOOK_SECRET')
  }

  const payload = await c.req.text()
  const signature = c.req.header('stripe-signature') ?? ''
  const valid = await verifyStripeSignature(
    payload,
    signature,
    settings.stripeWebhookSecret,
  )
  if (!valid) {
    throw badRequest('Invalid Stripe signature')
  }

  let event: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(payload)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('not an object')
    }
    event = parsed as Record<string, unknown>
  } catch {
    throw badRequest('Invalid Stripe signature')
  }

  await handleStripeEvent(c, settings, event)
  return c.json({ received: true })
})

/**
 * Apply a Stripe event.
 *
 * Mirrors the event handling of `billing.stripe_webhook()`.
 *
 * @param c the request context.
 * @param settings the billing configuration.
 * @param event the Stripe event.
 */
async function handleStripeEvent(
  c: Context<AppEnv>,
  settings: BillingSettings,
  event: Record<string, unknown>,
): Promise<void> {
  const sql = sqlOf(c)
  const eventType = String(stripeGet(event, 'type') ?? '')
  const eventId = stripeId(event)
  const dataObject = stripeGet(stripeGet(event, 'data', {}), 'object', {})

  if (eventType === 'checkout.session.completed' || eventType === 'checkout.session.expired') {
    await closeCheckoutReservation(sql, eventType, dataObject)
  }

  if (eventType === 'checkout.session.completed') {
    const metadata = (stripeGet(dataObject, 'metadata', {}) ?? {}) as Record<string, unknown>
    const selectedPlan = findPlan(String(metadata.plan_code ?? ''))
    const userId =
      (typeof metadata.user_id === 'string' ? metadata.user_id : null) ??
      (typeof stripeGet(dataObject, 'client_reference_id') === 'string'
        ? (stripeGet(dataObject, 'client_reference_id') as string)
        : null)
    const subscriptionId = stripeId(stripeGet(dataObject, 'subscription'))
    const customerId = stripeId(stripeGet(dataObject, 'customer'))

    const child = await findChildForEvent(sql, userId, customerId, subscriptionId)
    if (child) {
      const values: Partial<WebhookChildRow> = {
        stripe_customer_id: customerId ?? child.stripe_customer_id,
        stripe_subscription_id: subscriptionId ?? child.stripe_subscription_id,
      }
      if (selectedPlan) {
        values.active_price_code = selectedPlan.plan_code
        values.price_type = selectedPlan.price_type
        values.billing_program_type = selectedPlan.program_type
      }
      if (subscriptionId) {
        const subscription = await retrieveSubscription(
          settings.stripeSecretKey as string,
          subscriptionId,
        )
        Object.assign(
          values,
          subscriptionStateValues(child, subscriptionToEvent(subscription), selectedPlan, settings),
        )
      }
      await writeChild(sql, child, values)

      if (
        subscriptionId &&
        values.subscription_status &&
        PAID_SUBSCRIPTION_STATUSES.has(values.subscription_status)
      ) {
        await awardPaidReferral(sql, settings, child.parent_user_id, subscriptionId)
      }
    }
    return
  }

  if (eventType === 'customer.subscription.created' || eventType === 'customer.subscription.updated') {
    const subscriptionId = stripeId(dataObject)
    const customerId = stripeId(stripeGet(dataObject, 'customer'))
    const child = await findChildForEvent(sql, null, customerId, subscriptionId)
    if (child) {
      await writeChild(
        sql,
        child,
        subscriptionStateValues(child, dataObject, undefined, settings),
      )
    }
    return
  }

  if (eventType === 'customer.subscription.deleted') {
    const subscriptionId = stripeId(dataObject)
    const customerId = stripeId(stripeGet(dataObject, 'customer'))
    const child = await findChildForEvent(sql, null, customerId, subscriptionId)
    if (child) {
      await writeChild(sql, child, {
        ...clearedAccessValues(child),
        subscription_status: 'canceled',
        cancel_at_period_end: false,
        canceled_at: new Date().toISOString(),
      })
    }
    return
  }

  if (eventType === 'invoice.paid') {
    const invoiceId = stripeId(dataObject)
    const subscriptionId = stripeId(stripeGet(dataObject, 'subscription'))
    const customerId = stripeId(stripeGet(dataObject, 'customer'))
    const child = await findChildForEvent(sql, null, customerId, subscriptionId)
    if (child && subscriptionId) {
      const subscription = await retrieveSubscription(
        settings.stripeSecretKey as string,
        subscriptionId,
      )
      const values = subscriptionStateValues(
        child,
        subscriptionToEvent(subscription),
        undefined,
        settings,
      )
      await writeChild(sql, child, values)

      if (values.subscription_status && PAID_SUBSCRIPTION_STATUSES.has(values.subscription_status)) {
        await awardPaidReferral(sql, settings, child.parent_user_id, subscriptionId)
        await createCommissionForPayment(
          sql,
          settings,
          child.parent_user_id,
          invoiceId ? `stripe_invoice:${invoiceId}` : null,
          typeof stripeGet(dataObject, 'amount_paid') === 'number'
            ? (stripeGet(dataObject, 'amount_paid') as number)
            : null,
          String(stripeGet(dataObject, 'currency', 'THB')),
          eventId,
          {
            stripe_invoice_id: invoiceId,
            stripe_subscription_id: subscriptionId,
            stripe_customer_id: customerId,
            stripe_payment_intent: stripeId(stripeGet(dataObject, 'payment_intent')),
          },
        )
      }
    }
    return
  }

  if (eventType === 'invoice.payment_failed') {
    const subscriptionId = stripeId(stripeGet(dataObject, 'subscription'))
    const customerId = stripeId(stripeGet(dataObject, 'customer'))
    const child = await findChildForEvent(sql, null, customerId, subscriptionId)
    if (child) {
      await writeChild(sql, child, { subscription_status: 'past_due' })
    }
    return
  }

  if (eventType === 'charge.refunded' || eventType === 'charge.dispute.created') {
    const invoiceId = stripeId(stripeGet(dataObject, 'invoice'))
    await reverseCommissionForPayment(
      sql,
      invoiceId ? `stripe_invoice:${invoiceId}` : null,
      eventType === 'charge.refunded' ? 'refund' : 'chargeback',
      eventId,
    )
  }
}

/**
 * Close the checkout reservation of a finished checkout session.
 *
 * Mirrors the reservation handling of `billing.stripe_webhook()`.
 *
 * @param sql the database handle.
 * @param eventType the Stripe event type.
 * @param dataObject the Stripe checkout session.
 */
async function closeCheckoutReservation(
  sql: Sql,
  eventType: string,
  dataObject: unknown,
): Promise<void> {
  const metadata = (stripeGet(dataObject, 'metadata', {}) ?? {}) as Record<string, unknown>
  const reservationId =
    typeof metadata.topa_checkout_reservation_id === 'string'
      ? metadata.topa_checkout_reservation_id
      : null
  if (!reservationId) {
    return
  }

  const userId = typeof metadata.user_id === 'string' ? metadata.user_id : null
  const rows = (await sql.query(
    `SELECT id, provider, user_id, status, external_id FROM billing_checkout_reservations
     WHERE id = $1 LIMIT 1`,
    [reservationId],
  )) as Array<{
    id: string
    provider: string
    user_id: string
    status: string
    external_id: string | null
  }>
  const reservation = rows[0]
  if (!reservation || reservation.provider !== 'stripe' || reservation.user_id !== userId) {
    return
  }

  const sessionId = stripeId(dataObject)
  if (reservation.external_id !== null && reservation.external_id !== sessionId) {
    return
  }

  const expired =
    eventType === 'checkout.session.expired' && reservation.status === 'PENDING'
  const completed =
    eventType === 'checkout.session.completed' &&
    stripeId(stripeGet(dataObject, 'subscription')) !== null
  if (!expired && !completed) {
    return
  }

  await sql.query(
    `UPDATE billing_checkout_reservations SET external_id = $1, status = $2 WHERE id = $3`,
    [sessionId, expired ? 'EXPIRED' : 'COMPLETED', reservation.id],
  )
}

/**
 * Turn a Stripe subscription into the shape the event handlers expect.
 *
 * @param subscription the Stripe subscription.
 */
function subscriptionToEvent(subscription: StripeSubscription): Record<string, unknown> {
  return {
    id: subscription.id,
    customer: subscription.customer,
    status: subscription.status,
    current_period_end: subscription.current_period_end,
    cancel_at_period_end: subscription.cancel_at_period_end,
    items: subscription.price_id
      ? { data: [{ price: { id: subscription.price_id } }] }
      : { data: [] },
  }
}

/* ───────────────────────────── MPP webhooks ────────────────────────── */

/**
 * `POST /webhooks/mpp/payments` — the MPP payment webhook.
 *
 * The legacy service refuses to guess the MPP webhook contract, so the
 * endpoint always answers `503` — except for a body that is too large.
 */
webhookRoutes.post('/mpp/payments', async (c) => {
  const body = await c.req.arrayBuffer()
  if (body.byteLength > MAX_WEBHOOK_BYTES) {
    throw new HttpError(413, 'Webhook too large')
  }
  throw serviceUnavailable({ code: 'MPP_WEBHOOK_CONTRACT_REQUIRED' })
})

/**
 * `POST /webhooks/mpp/staging` — the MPP staging webhook.
 */
webhookRoutes.post('/mpp/staging', async (c) => {
  const settings = settingsOf(c)
  const raw = await c.req.arrayBuffer()
  if (raw.byteLength > MAX_WEBHOOK_BYTES) {
    throw new HttpError(413, 'Webhook too large')
  }

  verifyMppSignature(c, settings, new Uint8Array(raw))

  const text = new TextDecoder().decode(raw)
  let payload: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('not an object')
    }
    payload = parsed as Record<string, unknown>
  } catch {
    throw badRequest('Invalid webhook envelope')
  }

  const eventId = payload.event_id
  const eventType = payload.event_type
  const data = payload.data
  if (
    typeof eventId !== 'string' ||
    eventId.length === 0 ||
    eventId.length > 160 ||
    typeof eventType !== 'string' ||
    eventType.length > 80 ||
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data)
  ) {
    throw badRequest('Invalid webhook envelope')
  }

  const sql = sqlOf(c)
  const digest = toHex(sha256(new Uint8Array(raw)))

  const existing = (await sql.query(
    `SELECT body_sha256 FROM mpp_test_webhook_events WHERE event_id = $1 LIMIT 1`,
    [eventId],
  )) as Array<{ body_sha256: string }>
  if (existing[0]) {
    if (existing[0].body_sha256 !== digest) {
      throw conflict('Event ID reused with different body')
    }
    return c.json({ ok: true, duplicate: true })
  }

  const isPayment = eventType.startsWith('payment.')
  const isWithdrawal = eventType.startsWith('withdrawal.')
  if (!isPayment && !isWithdrawal) {
    throw badRequest('Unsupported UAT event')
  }

  const dataRecord = data as Record<string, unknown>
  // Python's `dict.get(key, default)` only falls back when the key is absent.
  const remoteId = isPayment
    ? dataRecord.payment_id
    : ('withdrawal_id' in dataRecord ? dataRecord.withdrawal_id : dataRecord.public_id)
  if (typeof remoteId !== 'string' || remoteId.length === 0) {
    throw badRequest('Missing remote ID')
  }

  const column = isPayment ? 'payment_id' : 'withdrawal_id'
  const rows = (await sql.query(
    `SELECT id, kind, merchant_order_id, amount, status, remote_status, checks
     FROM mpp_test_transactions WHERE ${column} = $1 LIMIT 1`,
    [remoteId],
  )) as Array<{
    id: string
    kind: string
    merchant_order_id: string
    amount: number
    status: string
    remote_status: string | null
    checks: Record<string, unknown> | null
  }>
  const row = rows[0]
  if (!row) {
    throw conflict('UAT transaction not found; retry delivery')
  }

  const valid = isPayment
    ? paymentMatches(row, dataRecord)
    : dataRecord.merchant_withdrawal_reference === row.merchant_order_id &&
      typeof dataRecord.amount === 'number' &&
      Number.isInteger(dataRecord.amount) &&
      dataRecord.amount === row.amount &&
      dataRecord.currency === 'THB'
  if (!valid) {
    throw badRequest('Webhook identity or amount mismatch')
  }

  const inserted = (await sql.query(
    `INSERT INTO mpp_test_webhook_events (event_id, body_sha256, event_type, transaction_id, outcome, received_at)
     VALUES ($1, $2, $3, $4, 'processed', now())
     ON CONFLICT (event_id) DO NOTHING
     RETURNING event_id`,
    [eventId, digest, eventType, row.id],
  )) as Array<{ event_id: string }>

  if (inserted.length === 0) {
    const conflictRows = (await sql.query(
      `SELECT body_sha256 FROM mpp_test_webhook_events WHERE event_id = $1 LIMIT 1`,
      [eventId],
    )) as Array<{ body_sha256: string }>
    if (!conflictRows[0] || conflictRows[0].body_sha256 !== digest) {
      throw conflict('Webhook conflict')
    }
    return c.json({ ok: true, duplicate: true })
  }

  const remoteStatus = String(dataRecord.status ?? eventType.split('.').pop() ?? '').slice(0, 40)
  const checks = {
    ...(row.checks ?? {}),
    webhook: {
      state: 'PASS',
      action: `Receive signed ${eventType}`,
      expected: 'Signature valid; matching UAT transaction; single processing',
      actual: `Processed ${eventId}`,
      response: sanitized(dataRecord),
    },
  }

  if (row.status !== 'PAID') {
    await sql.query(
      `UPDATE mpp_test_transactions SET remote_status = $1, checks = $2 WHERE id = $3`,
      [remoteStatus, JSON.stringify(checks), row.id],
    )
  } else {
    await sql.query(`UPDATE mpp_test_transactions SET checks = $1 WHERE id = $2`, [
      JSON.stringify(checks),
      row.id,
    ])
  }

  if (eventType === 'payment.confirmed' || eventType === 'withdrawal.paid') {
    await sql.query(`UPDATE mpp_test_transactions SET status = 'PAID' WHERE id = $1`, [row.id])
  }

  return c.json({ ok: true, duplicate: false })
})

/**
 * Verify the signature of an MPP staging webhook.
 *
 * Mirrors `payment_integration.verify_signature()`.
 *
 * @param c the request context.
 * @param settings the billing configuration.
 * @param raw the raw request body.
 */
function verifyMppSignature(
  c: Context<AppEnv>,
  settings: BillingSettings,
  raw: Uint8Array,
): void {
  if (isProductionEnvironment(settings)) {
    throw new HttpError(403, 'MPP UAT is disabled in production')
  }

  const apiBase = settings.mppApiBaseUrl.replace(/\/+$/, '')
  const paymentBase = settings.mppPaymentBaseUrl.replace(/\/+$/, '')
  const allowed = STAGING_HOST_PAIRS.some(
    (pair) => pair[0] === apiBase && pair[1] === paymentBase,
  )
  if (!allowed) {
    throw new HttpError(403, 'MPP UAT requires the staging hosts')
  }

  const secret = settings.mppWebhookSigningSecret
  if (!secret) {
    throw new HttpError(503, 'MPP_WEBHOOK_SIGNING_SECRET is not configured')
  }

  const expected = toHex(hmacSha256(prepareHmacKey(utf8Encode(secret)), raw))
  const supplied = (c.req.header('X-Webhook-Signature') ?? '').replace(/^sha256=/, '')
  if (!/^[0-9a-f]{64}$/.test(supplied) || !timingSafeHex(expected, supplied)) {
    throw new HttpError(401, 'Invalid webhook signature')
  }
}

/**
 * Compare two hexadecimal strings in constant time.
 *
 * @param a the first string.
 * @param b the second string.
 */
function timingSafeHex(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }
  let diff = 0
  for (let index = 0; index < a.length; index += 1) {
    diff |= (a.charCodeAt(index) ^ b.charCodeAt(index)) | 0
  }
  return diff === 0
}

/**
 * Whether an MPP payment body identifies the same payment as the transaction.
 *
 * Mirrors `payment_integration.payment_matches()`.
 *
 * @param row the UAT transaction.
 * @param data the webhook body.
 */
function paymentMatches(
  row: { merchant_order_id: string; amount: number },
  data: Record<string, unknown>,
): boolean {
  return (
    data.merchant_order_id === row.merchant_order_id &&
    typeof data.amount === 'number' &&
    Number.isInteger(data.amount) &&
    data.amount === row.amount &&
    data.currency === 'THB'
  )
}

/**
 * Keep only the safe fields of an MPP webhook body.
 *
 * Mirrors `payment_integration.sanitized()`.
 *
 * @param data the webhook body.
 */
function sanitized(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (!SAFE_FIELDS.has(key)) {
      continue
    }
    if (value !== null && typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
      continue
    }
    if (String(value).length > 200) {
      continue
    }
    out[key] = value
  }
  return out
}
