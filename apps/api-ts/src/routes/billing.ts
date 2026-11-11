/**
 * Billing endpoints — mounted at `/billing`.
 *
 * Ported from the legacy FastAPI billing router
 * (`apps/api/app/routers/billing.py`), the MPP order router
 * (`apps/api/app/routers/mpp_orders.py`) and the checkout policy
 * (`apps/api/app/services/checkout_policy.py`).
 *
 * The FastAPI service answers a malformed request with pydantic's error
 * list, so the request-body handling below mirrors FastAPI's order
 * exactly:
 *
 *  1. The body is parsed *before* the dependencies are solved, so a body
 *     CPython cannot decode answers `422` even for an anonymous caller.
 *  2. The authentication dependency is solved *before* the body model is
 *     validated, so a well-formed body of the wrong shape answers `401`
 *     first and only then `422`.
 */
import { Hono, type Context, type MiddlewareHandler } from 'hono'

import { badRequest, conflict, notFound, HttpError } from '../lib/errors'
import { requireAuth, requireActiveUser, type AppEnv } from '../lib/http'
import type { Sql } from '../lib/db'
import {
  getBillingSettings,
  defaultGateway,
  type BillingSettings,
} from '../lib/billing/settings'
import {
  PLAN_CATALOG,
  findPlan,
  isFounderPlan,
  founderSlots,
  founderOnly,
  priceIdForPlan,
  type BillingPlan,
} from '../lib/billing/plans'
import {
  createCheckoutSession,
  createCustomer,
  createPortalSession,
  StripeError,
} from '../lib/billing/stripe'
import {
  jsonInvalidError,
  missingBodyError,
  missingFieldError,
  modelAttributesError,
  parsePythonJson,
  stringTypeError,
} from '../lib/billing/validation'
import {
  FOUNDER_NOTE_TH,
  MANUAL_PENDING_MESSAGE,
  MISSING_STRIPE_CUSTOMER_MESSAGE,
  NO_CHILD_PROFILE_MESSAGE,
  pythonIsoTimestamp,
  toPythonIso,
} from '../lib/billing/format'
import {
  EP_PLAN_FALLBACK_FEATURES,
  LEGACY_EP_DESCRIPTION,
  LEGACY_EP_FEATURES,
  LEGACY_FAMILY_DESCRIPTION,
  LEGACY_FAMILY_FEATURES,
  LEGACY_FREE_DESCRIPTION,
  LEGACY_FREE_FEATURES,
  LEGACY_THP_DESCRIPTION,
  LEGACY_THP_FEATURES,
  TH_PLAN_FALLBACK_FEATURES,
} from '../lib/billing/copy'
import {
  newOrPendingOrder,
  orderColumns,
  orderView,
  ownedOrder,
  recheckOrder,
  requireCheckoutReady,
  requireMppAccess,
  submitOrder,
  type MppPurchaseOrderRow,
} from '../lib/billing/mpp'

export const billingRoutes = new Hono<AppEnv>()

/* ────────────────────────────── helpers ────────────────────────────── */

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

/** The membership statuses that count as "paid" for the non-MPP branch. */
const PAID_MEMBERSHIP_STATUSES = new Set(['paid', 'plus'])

/** The membership statuses that count as "paid" for the MPP branch. */
const PAID_MEMBERSHIP_STATUSES_MPP = new Set(['paid', 'plus', 'trial'])

/** A child profile, reduced to the columns the billing endpoints read. */
interface BillingChildRow {
  id: string
  parent_user_id: string
  membership_provider: string | null
  membership_status: string | null
  plan_code: string | null
  active_price_code: string | null
  price_type: string | null
  billing_program_type: string | null
  subscription_status: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean | null
  mpp_access_ends_at: string | null
  mpp_active: boolean
}

/** The columns read from `child_profiles` for the billing endpoints. */
const BILLING_CHILD_COLUMNS = `
  id, parent_user_id, membership_provider, membership_status, plan_code,
  active_price_code, price_type, billing_program_type, subscription_status,
  stripe_customer_id, stripe_subscription_id,
  ${pythonIsoTimestamp('current_period_end')} AS current_period_end,
  cancel_at_period_end,
  ${pythonIsoTimestamp('mpp_access_ends_at')} AS mpp_access_ends_at,
  (mpp_access_ends_at IS NOT NULL AND mpp_access_ends_at > now()) AS mpp_active
`

/**
 * Format the current time the way Python's `datetime.now(UTC).isoformat()` does.
 */
function pythonNowIso(): string {
  const iso = new Date().toISOString()
  const [datePart, timePart = ''] = iso.split('T')
  const [seconds = '', milliseconds = ''] = timePart.split('.')
  return `${datePart}T${seconds}.${milliseconds}000+00:00`
}

/**
 * Read the billing configuration from the raw bindings.
 *
 * @param c the request context.
 */
function settingsOf(c: Context<AppEnv>): BillingSettings {
  return getBillingSettings(c.env)
}

/**
 * Load the child profile of a user.
 *
 * Mirrors `billing._profile()`: the first profile of the user.
 *
 * @param sql the database handle.
 * @param userId the parent user id.
 */
async function childProfile(sql: Sql, userId: string): Promise<BillingChildRow | null> {
  const rows = (await sql.query(
    `SELECT ${BILLING_CHILD_COLUMNS} FROM child_profiles
     WHERE parent_user_id = $1 ORDER BY id LIMIT 1`,
    [userId],
  )) as BillingChildRow[]
  const row = rows[0]
  if (!row) {
    return null
  }
  // The SQL renders `2026-11-10T15:14:16.269384`; Python's `isoformat()`
  // appends the UTC offset.
  return {
    ...row,
    current_period_end: toPythonIso(row.current_period_end),
    mpp_access_ends_at: toPythonIso(row.mpp_access_ends_at),
  }
}

/**
 * Load the child profile of a user or fail with the FastAPI error.
 *
 * @param sql the database handle.
 * @param userId the parent user id.
 */
async function requiredChildProfile(sql: Sql, userId: string): Promise<BillingChildRow> {
  const child = await childProfile(sql, userId)
  if (!child) {
    throw notFound(NO_CHILD_PROFILE_MESSAGE)
  }
  return child
}

/* ───────────────────────── request-body parsing ─────────────────────── */

/** The body of a request, parsed the way FastAPI parses it. */
type ParsedBody =
  | { kind: 'missing' }
  | { kind: 'object'; value: Record<string, unknown> }
  | { kind: 'not-object'; input: unknown }

/** The parsed bodies, keyed by the request they belong to. */
const parsedBodies = new WeakMap<object, ParsedBody>()

/**
 * Whether FastAPI would decode the body as JSON.
 *
 * FastAPI uses `email.message.Message` to read the content type: only
 * `application/json` and `application/*+json` are decoded, and a request
 * without a content type is *not* decoded at all (the strict content type
 * check).
 *
 * @param contentType the raw content-type header.
 */
function isJsonContentType(contentType: string | null | undefined): boolean {
  if (!contentType) {
    return false
  }
  const [rawType = ''] = contentType.split(';')
  const [mainType = '', ...rest] = rawType.trim().toLowerCase().split('/')
  const subType = rest.join('/')
  return mainType === 'application' && (subType === 'json' || subType.endsWith('+json'))
}

/**
 * Parse a request body the way FastAPI does.
 *
 * A body CPython cannot decode raises the `json_invalid` error right away
 * (FastAPI decodes the body before it solves the dependencies); a body that
 * is not a JSON object is reported later, as a validation error.
 *
 * @param raw the raw body.
 * @param contentType the raw content-type header.
 */
function parseFastApiBody(raw: string, contentType: string | null | undefined): ParsedBody {
  if (raw.length === 0) {
    return { kind: 'missing' }
  }

  if (!isJsonContentType(contentType)) {
    // FastAPI hands the raw bytes to pydantic, which reports them as a
    // string once they are JSON-encoded.
    return { kind: 'not-object', input: raw }
  }

  // CPython decodes the bytes with `utf-8-sig` when a BOM is present, so the
  // BOM is not part of the document.
  const text = raw.startsWith('﻿') ? raw.slice(1) : raw
  const parsed = parsePythonJson(text)
  if (!parsed.ok) {
    throw jsonInvalidError(parsed.pos, parsed.msg)
  }

  if (parsed.value === null || typeof parsed.value !== 'object' || Array.isArray(parsed.value)) {
    return { kind: 'not-object', input: parsed.value }
  }

  return { kind: 'object', value: parsed.value as Record<string, unknown> }
}

/**
 * Decode the body of a request before the authentication dependency runs.
 *
 * FastAPI decodes the body before it solves the dependencies, so a body
 * CPython cannot parse answers `422` even when the caller is anonymous.
 */
const parseCheckoutBody: MiddlewareHandler<AppEnv> = async (c, next) => {
  const raw = await c.req.text()
  parsedBodies.set(c.req.raw, parseFastApiBody(raw, c.req.header('content-type')))
  await next()
}

/**
 * Validate the `CheckoutSessionIn` body of a request.
 *
 * Mirrors pydantic's validation of `plan_code: str`: a missing field and a
 * field of the wrong type are reported separately.
 *
 * @param c the request context.
 * @returns the plan code.
 */
function checkoutPlanCode(c: Context<AppEnv>): string {
  const body = parsedBodies.get(c.req.raw)
  if (!body || body.kind === 'missing') {
    throw missingBodyError()
  }
  if (body.kind === 'not-object') {
    throw modelAttributesError(body.input)
  }

  const value = body.value
  if (!('plan_code' in value)) {
    throw missingFieldError('plan_code', value)
  }
  const planCode = value.plan_code
  if (typeof planCode !== 'string') {
    throw stringTypeError('plan_code', planCode)
  }
  return planCode
}

/* ───────────────────────────── plan catalogue ───────────────────────── */

/**
 * The plan payload of the founder pricing page.
 *
 * Mirrors `billing._dev_plan_payload()`.
 *
 * @param plan the plan.
 * @param settings the billing configuration.
 */
function devPlanPayload(
  plan: BillingPlan,
  settings: BillingSettings,
): Record<string, unknown> {
  const fallback =
    plan.program_type === 'EP' ? EP_PLAN_FALLBACK_FEATURES : TH_PLAN_FALLBACK_FEATURES
  return {
    id: plan.plan_code,
    plan_code: plan.plan_code,
    name: plan.display_name,
    display_name: plan.display_name,
    program_type: plan.program_type,
    price_monthly: plan.billing_interval === 'month' ? plan.amount_thb : null,
    price_thb: plan.amount_thb,
    currency: 'THB',
    billing_interval: plan.billing_interval,
    price_type: plan.price_type,
    description: plan.program_type === 'EP' ? LEGACY_EP_DESCRIPTION : LEGACY_THP_DESCRIPTION,
    features: plan.features.length > 0 ? [...plan.features] : [...fallback],
    stripe_price_id: priceIdForPlan(plan, settings),
    product_id: plan.product_id,
    is_available: true,
    available: true,
  }
}

/**
 * The legacy plan list shown when the founder pricing is closed.
 *
 * Mirrors the second half of `billing.billing_plans()`.
 *
 * @param settings the billing configuration.
 */
function legacyPlans(settings: BillingSettings): Array<Record<string, unknown>> {
  return [
    {
      id: 'free',
      plan_code: 'free',
      name: 'Free',
      display_name: 'Free',
      program_type: 'FREE',
      price_monthly: 0,
      price_thb: 0,
      currency: 'THB',
      billing_interval: 'none',
      price_type: 'free',
      description: LEGACY_FREE_DESCRIPTION,
      features: [...LEGACY_FREE_FEATURES],
      is_current: false,
      is_available: true,
      available: true,
    },
    {
      id: 'thp_monthly',
      plan_code: 'thp_monthly',
      name: 'Thai Program',
      display_name: 'Thai Program',
      program_type: 'THP',
      price_monthly: 299,
      price_thb: 299,
      currency: 'THB',
      billing_interval: 'month',
      price_type: 'normal',
      description: LEGACY_THP_DESCRIPTION,
      features: [...LEGACY_THP_FEATURES],
      stripe_price_id: settings.stripePriceThPlusMonthly,
      is_available: true,
      available: true,
      checkout_plan_code: 'th_plus_monthly',
    },
    {
      id: 'ep_monthly',
      plan_code: 'ep_monthly',
      name: 'English Program',
      display_name: 'English Program',
      program_type: 'EP',
      price_monthly: 499,
      price_thb: 499,
      currency: 'THB',
      billing_interval: 'month',
      price_type: 'normal',
      description: LEGACY_EP_DESCRIPTION,
      features: [...LEGACY_EP_FEATURES],
      stripe_price_id: settings.stripePriceEpPlusMonthly,
      is_available: true,
      available: true,
      checkout_plan_code: 'ep_plus_monthly',
    },
    {
      id: 'family_monthly',
      plan_code: 'family_monthly',
      name: 'Family',
      display_name: 'Family',
      program_type: 'BOTH',
      price_monthly: 799,
      price_thb: 799,
      currency: 'THB',
      billing_interval: 'month',
      price_type: 'normal',
      description: LEGACY_FAMILY_DESCRIPTION,
      features: [...LEGACY_FAMILY_FEATURES],
      stripe_price_id: null,
      is_available: true,
      available: true,
    },
  ]
}

/**
 * The MPP package price of a plan.
 *
 * @param sql the database handle.
 * @param planCode the plan code.
 */
async function mppPackagePrice(
  sql: Sql,
  planCode: string,
): Promise<{ amount_minor: number; duration_days: number; active: boolean } | null> {
  try {
    const rows = (await sql.query(
      `SELECT amount_minor, duration_days, active FROM mpp_package_prices
       WHERE plan_code = $1 LIMIT 1`,
      [planCode],
    )) as Array<{ amount_minor: number; duration_days: number; active: boolean }>
    return rows[0] ?? null
  } catch {
    // The MPP tables are optional; a missing table means no MPP price.
    return null
  }
}

/* ─────────────────────────────── routes ─────────────────────────────── */

/**
 * `GET /billing/plans` — the plan catalogue of the pricing page.
 */
billingRoutes.get('/plans', async (c) => {
  const settings = settingsOf(c)
  const founder = await founderSlots(c.get('sql'), settings)

  const plans = founderOnly(settings, founder)
    ? [
        {
          id: 'free',
          plan_code: 'free',
          name: 'Free',
          display_name: 'Free',
          program_type: 'FREE',
          price_monthly: 0,
          price_thb: 0,
          currency: 'THB',
          billing_interval: 'none',
          price_type: 'free',
          stripe_price_id: null,
          is_available: true,
          available: true,
        },
        {
          ...devPlanPayload(PLAN_CATALOG[0] as BillingPlan, settings),
          checkout_plan_code: 'th_founder_monthly',
          ...founder,
        },
        {
          ...devPlanPayload(PLAN_CATALOG[1] as BillingPlan, settings),
          checkout_plan_code: 'ep_founder_monthly',
          ...founder,
        },
      ]
    : legacyPlans(settings)

  return c.json({ plans, ...founder, source: 'backend' })
})

/**
 * `GET /billing/prices` — the price catalogue of the pricing page.
 */
billingRoutes.get('/prices', async (c) => {
  const sql = c.get('sql')
  const settings = settingsOf(c)
  const founder = await founderSlots(sql, settings)
  const gateway = defaultGateway(settings)
  const onlyFounder = founderOnly(settings, founder)

  const freePlan = {
    plan_code: 'free',
    display_name: 'ทดลองใช้ฟรี',
    program_type: 'FREE',
    price_thb: 0,
    billing_interval: 'none',
    price_type: 'free',
    available: true,
  }

  const plans: Array<Record<string, unknown>> = [freePlan]
  for (const plan of PLAN_CATALOG) {
    if (!isFounderPlan(plan.plan_code) && onlyFounder) {
      continue
    }
    if (isFounderPlan(plan.plan_code)) {
      plans.push({
        plan_code: plan.plan_code,
        display_name: plan.display_name,
        program_type: plan.program_type,
        price_thb: plan.amount_thb,
        billing_interval: plan.billing_interval,
        price_type: plan.price_type,
        product_id: plan.product_id,
        stripe_price_id: priceIdForPlan(plan, settings),
        available: founder.founder_slots_remaining > 0,
        ...founder,
        note_th: FOUNDER_NOTE_TH,
        features: [...plan.features],
      })
      continue
    }
    plans.push({
      plan_code: plan.plan_code,
      display_name: plan.display_name,
      program_type: plan.program_type,
      price_thb: plan.amount_thb,
      billing_interval: plan.billing_interval,
      price_type: plan.price_type,
      product_id: plan.product_id,
      stripe_price_id: priceIdForPlan(plan, settings),
      available: true,
      features: [...plan.features],
    })
  }

  for (const item of plans) {
    if (item.plan_code === 'free') {
      continue
    }
    if (gateway === 'stripe') {
      item.auto_renew = true
      continue
    }
    const price = await mppPackagePrice(sql, String(item.plan_code))
    item.price_minor = price ? price.amount_minor : null
    item.duration_days = price ? price.duration_days : null
    item.auto_renew = false
    item.available = Boolean(item.available && price && price.active)
  }

  return c.json({ plans, checkout_provider: gateway })
})

/**
 * `GET /billing/status` — the membership of the child profile.
 */
billingRoutes.get('/status', requireAuth(), async (c) => {
  const user = await requireActiveUser(c)
  const child = await requiredChildProfile(c.get('sql'), user.id)
  return c.json(statusPayload(child))
})

/**
 * Build the status payload of a child profile.
 *
 * Mirrors `billing._status_payload()`.
 *
 * @param child the child profile.
 */
function statusPayload(child: BillingChildRow): Record<string, unknown> {
  if (child.membership_provider === 'mpp') {
    const paid =
      PAID_MEMBERSHIP_STATUSES_MPP.has((child.membership_status ?? '').toLowerCase()) &&
      child.mpp_active
    return {
      provider: 'mpp',
      auto_renew: false,
      membership_status: paid ? 'plus' : 'free',
      plan_code: paid ? (child.plan_code ?? 'free') : 'free',
      plan: paid ? 'plus' : 'free',
      is_paid: paid,
      active_price_code: child.active_price_code,
      price_type: child.price_type,
      program_type: child.billing_program_type,
      subscription_status: paid ? 'active' : 'expired',
      subscription_id: null,
      current_period_end: child.mpp_access_ends_at,
      cancel_at_period_end: false,
    }
  }

  const membershipStatus = child.membership_status || 'free'
  const subscriptionStatus = child.subscription_status || 'none'
  const paid =
    PAID_MEMBERSHIP_STATUSES.has(membershipStatus) &&
    ['active', 'trialing', 'trial', 'manual_grant'].includes(subscriptionStatus)
  return {
    membership_status: membershipStatus,
    plan_code: child.plan_code || 'free',
    plan: paid ? 'plus' : 'free',
    is_paid: paid,
    active_price_code: child.active_price_code,
    price_type: child.price_type,
    program_type: child.billing_program_type,
    subscription_status: subscriptionStatus,
    subscription_id: child.stripe_subscription_id,
    current_period_end: child.current_period_end,
    cancel_at_period_end: Boolean(child.cancel_at_period_end),
  }
}

/**
 * `GET /billing/checkouts/:reservationId` — the state of a checkout.
 */
billingRoutes.get('/checkouts/:reservationId', requireAuth(), async (c) => {
  const user = await requireActiveUser(c)
  const rows = (await c.get('sql').query(
    `SELECT id, provider, status FROM billing_checkout_reservations
     WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [c.req.param('reservationId'), user.id],
  )) as Array<{ id: string; provider: string; status: string }>

  const reservation = rows[0]
  if (!reservation) {
    throw notFound('Checkout not found')
  }
  return c.json({
    order_id: reservation.id,
    provider: reservation.provider,
    status: reservation.status,
  })
})

/**
 * `POST /billing/mpp/checkout` — start an MPP payment.
 */
billingRoutes.post('/mpp/checkout', parseCheckoutBody, requireAuth(), async (c) => {
  const user = await requireActiveUser(c)
  const planCode = checkoutPlanCode(c)

  const plan = findPlan(planCode)
  if (!plan) {
    throw badRequest('Invalid plan_code')
  }

  const settings = settingsOf(c)
  const sql = c.get('sql')
  const columns = orderColumns(pythonIsoTimestamp)

  requireMppAccess(settings, user.id, user.role)
  requireCheckoutReady(settings)

  const order = await newOrPendingOrder(sql, settings, user.id, plan.plan_code, columns)
  const submitted = await submitOrder(sql, settings, user.id, order.id, columns)
  return c.json(orderView(submitted))
})

/**
 * `POST /billing/create-checkout-session` — start a subscription checkout.
 */
billingRoutes.post('/create-checkout-session', parseCheckoutBody, requireAuth(), async (c) => {
  const user = await requireActiveUser(c)
  const planCode = checkoutPlanCode(c)

  const plan = findPlan(planCode)
  if (!plan) {
    throw badRequest('Invalid plan_code')
  }

  const sql = c.get('sql')
  const settings = settingsOf(c)

  // A pending MPP order locks the user to the MPP gateway.
  const pendingOrders = (await sql.query(
    `SELECT ${orderColumns(pythonIsoTimestamp)} FROM mpp_purchase_orders
     WHERE user_id = $1 AND status = 'PENDING' LIMIT 1`,
    [user.id],
  )) as MppPurchaseOrderRow[]
  const pending = pendingOrders[0]
  if (pending) {
    if (pending.plan_code !== plan.plan_code) {
      throw conflict({ code: 'CHECKOUT_PROVIDER_LOCKED', provider: 'mpp' })
    }
    const result = orderView(withIsoTimestamps(pending))
    if (!result.checkout_url) {
      throw conflict({
        code: 'CHECKOUT_RECONCILIATION_REQUIRED',
        provider: 'mpp',
        order_id: pending.id,
      })
    }
    return c.json(result)
  }

  // A pending Stripe reservation is replayed instead of starting a second
  // checkout.
  const reservations = (await sql.query(
    `SELECT id, provider, plan_code, checkout_url FROM billing_checkout_reservations
     WHERE user_id = $1 AND status = 'PENDING' LIMIT 1`,
    [user.id],
  )) as Array<{ id: string; provider: string; plan_code: string; checkout_url: string | null }>
  const reservation = reservations[0]
  if (reservation) {
    if (reservation.plan_code !== plan.plan_code || !reservation.checkout_url) {
      throw conflict({
        code: 'CHECKOUT_RECONCILIATION_REQUIRED',
        provider: reservation.provider,
      })
    }
    return c.json({
      provider: reservation.provider,
      order_id: reservation.id,
      checkout_url: reservation.checkout_url,
    })
  }

  if (defaultGateway(settings) === 'mpp') {
    requireMppAccess(settings, user.id, user.role)
    const columns = orderColumns(pythonIsoTimestamp)
    const order = await newOrPendingOrder(sql, settings, user.id, plan.plan_code, columns)
    const submitted = await submitOrder(sql, settings, user.id, order.id, columns)
    return c.json(orderView(submitted))
  }

  const child = await childProfile(sql, user.id)
  if (child) {
    rejectLiveStripeSubscription(child)
    if (child.membership_provider === 'mpp' && child.mpp_active) {
      throw conflict({ code: 'EXISTING_MPP_MEMBERSHIP' })
    }
  }

  if (isFounderPlan(plan.plan_code)) {
    const slots = await founderSlots(sql, settings)
    if (slots.founder_slots_remaining <= 0) {
      throw conflict({ code: 'FOUNDER_FULL' })
    }
  }

  // The reservation is created first: its id is the idempotency key of the
  // Stripe calls, so a retry of the request cannot create a second checkout.
  const reservationId = crypto.randomUUID()
  await sql.query(
    `INSERT INTO billing_checkout_reservations (id, user_id, provider, plan_code, status, created_at)
     VALUES ($1, $2, 'stripe', $3, 'PENDING', now())`,
    [reservationId, user.id, plan.plan_code],
  )

  const result = await legacyStripeCheckoutSession(c, user.id, plan, reservationId)
  await sql.query(
    `UPDATE billing_checkout_reservations SET external_id = $1, checkout_url = $2 WHERE id = $3`,
    [result.session_id ?? null, result.checkout_url ?? null, reservationId],
  )

  return c.json({ provider: 'stripe', order_id: reservationId, ...result })
})

/**
 * Refuse a checkout when the child already has a live Stripe subscription.
 *
 * Mirrors `mpp_checkout.reject_live_stripe()`.
 *
 * @param child the child profile.
 */
function rejectLiveStripeSubscription(child: BillingChildRow): void {
  if (
    child.stripe_subscription_id &&
    !['canceled', 'incomplete_expired'].includes(child.subscription_status ?? '')
  ) {
    throw conflict({ code: 'EXISTING_STRIPE_SUBSCRIPTION' })
  }
}

/**
 * Start the Stripe subscription checkout of a plan.
 *
 * Mirrors `billing._legacy_stripe_checkout_session()`. When Stripe is not
 * configured the request is recorded as a manual payment instead, exactly
 * like the FastAPI service does.
 *
 * @param c the request context.
 * @param userId the parent user id.
 * @param plan the plan.
 * @param reservationId the id of the checkout reservation.
 */
async function legacyStripeCheckoutSession(
  c: Context<AppEnv>,
  userId: string,
  plan: BillingPlan,
  reservationId: string,
): Promise<Record<string, unknown>> {
  const sql = c.get('sql')
  const settings = settingsOf(c)
  const secretKey = settings.stripeSecretKey
  const priceId = priceIdForPlan(plan, settings)

  if (!secretKey || !priceId) {
    return manualPendingCheckout(sql, userId, plan, secretKey ? 'price_id' : 'stripe_secret_key')
  }

  const child = await childProfile(sql, userId)
  const emailRows = (await sql.query(`SELECT email FROM users WHERE id = $1 LIMIT 1`, [
    userId,
  ])) as Array<{ email: string }>
  const email = emailRows[0]?.email ?? ''

  let customerId = child?.stripe_customer_id ?? null
  if (!customerId) {
    try {
      const customer = await createCustomer(
        secretKey,
        {
          email,
          metadata: {
            user_id: userId,
            ...(child ? { child_id: child.id } : {}),
          },
        },
        `customer-${reservationId}`,
      )
      customerId = customer.id
      if (child) {
        await sql.query(`UPDATE child_profiles SET stripe_customer_id = $1 WHERE id = $2`, [
          customerId,
          child.id,
        ])
      }
    } catch (error) {
      return manualPendingCheckout(sql, userId, plan, stripeFailureReason(error))
    }
  }

  try {
    const session = await createCheckoutSession(
      secretKey,
      {
        customer: customerId,
        priceId,
        successUrl: `${settings.frontendBaseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${settings.frontendBaseUrl}/pricing?canceled=1`,
        clientReferenceId: userId,
        metadata: {
          topa_checkout_reservation_id: reservationId,
          user_id: userId,
          ...(child ? { child_id: child.id } : {}),
          plan_code: plan.plan_code,
          program_type: plan.program_type,
          price_type: plan.price_type,
          product_id: plan.product_id,
        },
      },
      reservationId,
    )
    return {
      session_id: session.id,
      checkout_url: session.url,
      plan_code: plan.plan_code,
      price_type: plan.price_type,
      program_type: plan.program_type,
    }
  } catch (error) {
    return manualPendingCheckout(sql, userId, plan, stripeFailureReason(error))
  }
}

/**
 * The reason a Stripe call failed.
 *
 * @param error the caught error.
 */
function stripeFailureReason(error: unknown): string {
  if (error instanceof StripeError) {
    return error.name
  }
  return 'StripeError'
}

/**
 * Record a checkout that has to be confirmed by hand.
 *
 * Mirrors `billing._manual_pending_checkout()`.
 *
 * @param sql the database handle.
 * @param userId the parent user id.
 * @param plan the plan.
 * @param reason why the checkout could not be started.
 */
async function manualPendingCheckout(
  sql: Sql,
  userId: string,
  plan: BillingPlan,
  reason: string,
): Promise<Record<string, unknown>> {
  const child = await childProfile(sql, userId)
  const requestOwnerId = child ? child.id : userId

  if (child) {
    await sql.query(
      `UPDATE child_profiles
       SET subscription_status = 'pending', active_price_code = $1, price_type = $2,
           billing_program_type = $3, admin_note = $4, manual_grant_reason = $5
       WHERE id = $6`,
      [
        plan.plan_code,
        plan.price_type,
        plan.program_type,
        `Manual beta payment pending: ${plan.plan_code}`,
        `pending_payment:${plan.plan_code}`.slice(0, 120),
        child.id,
      ],
    )
  }

  console.warn('Manual beta payment pending', {
    user_id: userId,
    child_id: child ? child.id : null,
    plan_code: plan.plan_code,
    reason,
  })

  return {
    mode: 'manual_pending',
    status: 'pending',
    message: MANUAL_PENDING_MESSAGE,
    payment_request: {
      id: `pending-${requestOwnerId}`,
      user_id: userId,
      plan: plan.plan_code,
      program: plan.program_type,
      billing_period: plan.billing_interval,
      price: plan.amount_thb,
      status: 'pending',
      created_at: pythonNowIso(),
    },
    plan_code: plan.plan_code,
    price_type: plan.price_type,
    program_type: plan.program_type,
  }
}

/**
 * `POST /billing/create-portal-session` — open the Stripe customer portal.
 */
billingRoutes.post('/create-portal-session', requireAuth(), async (c) => {
  const settings = settingsOf(c)
  if (!settings.stripeSecretKey) {
    throw new HttpError(500, 'Stripe configuration missing: STRIPE_SECRET_KEY')
  }

  const user = await requireActiveUser(c)
  const child = await requiredChildProfile(c.get('sql'), user.id)
  if (!child.stripe_customer_id) {
    throw badRequest(MISSING_STRIPE_CUSTOMER_MESSAGE)
  }

  const portal = await createPortalSession(settings.stripeSecretKey, {
    customer: child.stripe_customer_id,
    returnUrl:
      settings.stripeCustomerPortalReturnUrl || `${settings.frontendBaseUrl}/dashboard`,
  })
  return c.json({ portal_url: portal.url })
})

/**
 * `GET /billing/mpp/orders` — the MPP orders of the user.
 */
billingRoutes.get('/mpp/orders', requireAuth(), async (c) => {
  const user = await requireActiveUser(c)
  const columns = orderColumns(pythonIsoTimestamp)
  const rows = (await c.get('sql').query(
    `SELECT ${columns} FROM mpp_purchase_orders
     WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30`,
    [user.id],
  )) as MppPurchaseOrderRow[]

  return c.json(rows.map((row) => orderView(withIsoTimestamps(row))))
})

/**
 * `GET /billing/mpp/orders/:orderId` — one MPP order of the user.
 */
billingRoutes.get('/mpp/orders/:orderId', requireAuth(), async (c) => {
  const user = await requireActiveUser(c)
  const columns = orderColumns(pythonIsoTimestamp)
  const order = await ownedOrder(c.get('sql'), user.id, c.req.param('orderId'), columns)
  return c.json(orderView(withIsoTimestamps(order)))
})

/**
 * `POST /billing/mpp/orders/:orderId/retry` — submit an MPP order again.
 */
billingRoutes.post('/mpp/orders/:orderId/retry', requireAuth(), async (c) => {
  const user = await requireActiveUser(c)
  const settings = settingsOf(c)
  const columns = orderColumns(pythonIsoTimestamp)
  const order = await submitOrder(
    c.get('sql'),
    settings,
    user.id,
    c.req.param('orderId'),
    columns,
  )
  return c.json(orderView(withIsoTimestamps(order)))
})

/**
 * `POST /billing/mpp/orders/:orderId/recheck` — read the MPP status again.
 */
billingRoutes.post('/mpp/orders/:orderId/recheck', requireAuth(), async (c) => {
  const user = await requireActiveUser(c)
  const settings = settingsOf(c)
  const columns = orderColumns(pythonIsoTimestamp)
  const order = await recheckOrder(
    c.get('sql'),
    settings,
    user.id,
    c.req.param('orderId'),
    columns,
  )
  return c.json(orderView(withIsoTimestamps(order)))
})

/**
 * Add the UTC offset to the rendered timestamps of an MPP order.
 *
 * @param row the order row.
 */
function withIsoTimestamps(row: MppPurchaseOrderRow): MppPurchaseOrderRow {
  return {
    ...row,
    expires_at: toPythonIso(row.expires_at),
    granted_at: toPythonIso(row.granted_at),
  }
}
