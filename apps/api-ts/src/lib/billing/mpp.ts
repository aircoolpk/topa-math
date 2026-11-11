/**
 * MPP (one-time payment) checkout.
 *
 * Ported from `apps/api/app/services/mpp_checkout.py` and
 * `apps/api/app/services/checkout_policy.py`.
 *
 * The MPP tables (`mpp_package_prices`, `mpp_purchase_orders`,
 * `mpp_purchase_events`) are **not** part of the Drizzle schema yet, so they
 * are reached through the raw SQL escape hatch instead of the typed query
 * builder. The column names and types match the production tables exactly.
 */
import { conflict, forbidden, notFound, serviceUnavailable, HttpError } from '../errors'
import type { Sql } from '../db'
import { pythonIsoTimestamp } from './format'
import { isProductionEnvironment, type BillingSettings } from './settings'

/** The MPP staging API host the checkout contract is verified against. */
export const MPP_STAGING_API_BASE_URL = 'https://staging-api.mmerchant.cc/api/v1'
/** The MPP hosted-payment host. */
export const MPP_STAGING_PAYMENT_BASE_URL = 'https://staging-pay.mmerchant.cc'

/**
 * The blockers that prevent MPP checkout from running.
 *
 * Mirrors `require_checkout_ready()`: the MPP contract is only verified
 * against the staging hosts, never in production, and only with a project
 * key, a verified amount unit and the expected merchant/project names.
 *
 * @param settings the billing configuration.
 */
export function checkoutBlockers(settings: BillingSettings): string[] {
  const blockers: string[] = []

  if (isProductionEnvironment(settings)) {
    blockers.push('production_uat_not_approved')
  }

  const apiBase = settings.mppApiBaseUrl.replace(/\/+$/, '')
  const paymentBase = settings.mppPaymentBaseUrl.replace(/\/+$/, '')
  if (apiBase !== MPP_STAGING_API_BASE_URL || paymentBase !== MPP_STAGING_PAYMENT_BASE_URL) {
    blockers.push('staging_hosts_required')
  }

  if (!settings.mppProjectApiKey) {
    blockers.push('missing_project_api_key')
  }
  if (settings.mppAmountUnit !== 'minor') {
    blockers.push('amount_unit_unverified')
  }
  if (!settings.mppExpectedMerchantName || !settings.mppExpectedProjectName) {
    blockers.push('missing_expected_merchant_project')
  }

  return blockers
}

/**
 * Ensure MPP checkout may run at all.
 *
 * @param settings the billing configuration.
 * @throws a 503 with the blocking reasons.
 */
export function requireCheckoutReady(settings: BillingSettings): void {
  const blockers = checkoutBlockers(settings)
  if (blockers.length > 0) {
    throw serviceUnavailable({ code: 'MPP_CHECKOUT_BLOCKED', blockers })
  }
}

/**
 * Ensure the user may use MPP checkout.
 *
 * Mirrors `require_mpp_access()`: the feature has to be enabled, and the
 * account has to be on the allow-list (admins always pass).
 *
 * @param settings the billing configuration.
 * @param userId the user id.
 * @param userRole the user's role.
 */
export function requireMppAccess(
  settings: BillingSettings,
  userId: string,
  userRole: string,
): void {
  if (!settings.mppCheckoutEnabled) {
    throw serviceUnavailable({ code: 'MPP_CHECKOUT_DISABLED' })
  }

  const allowed = new Set(
    settings.mppCheckoutTestUserIds
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  )
  if (userRole !== 'admin' && !allowed.has(userId)) {
    throw forbidden({ code: 'MPP_CHECKOUT_ACCOUNT_NOT_AUTHORIZED' })
  }
}

/**
 * A row of `mpp_purchase_orders`.
 */
export interface MppPurchaseOrderRow {
  id: string
  user_id: string
  child_id: string
  plan_code: string
  amount_minor: number
  currency: string
  duration_days: number
  entitlement_plan: string
  program_type: string
  merchant_order_id: string
  idempotency_key: string
  api_origin: string
  merchant_name: string
  project_name: string
  status: string
  remote_status: string | null
  payment_id: string | null
  session_token: string | null
  session_url: string | null
  expires_at: string | null
  granted_at: string | null
  last_error: string | null
  last_rechecked_at: string | null
  created_at: string
}

/**
 * The columns read from `mpp_purchase_orders`.
 *
 * The timestamps are rendered by the caller so they match Python's
 * `datetime.isoformat()`.
 *
 * @param timestamp renders a timestamp column.
 */
export function orderColumns(timestamp: (expression: string) => string): string {
  return `
    id, user_id, child_id, plan_code, amount_minor, currency, duration_days,
    entitlement_plan, program_type, merchant_order_id, idempotency_key,
    api_origin, merchant_name, project_name, status, remote_status, payment_id,
    session_token, session_url,
    ${timestamp('expires_at')} AS expires_at,
    ${timestamp('granted_at')} AS granted_at,
    last_error, last_rechecked_at, created_at
  `
}

/**
 * A child profile, reduced to the columns the checkout needs.
 */
export interface ChildBillingRow {
  id: string
  parent_user_id: string
  membership_provider: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  subscription_status: string | null
  membership_status: string | null
  mpp_access_ends_at: string | null
}

/** The columns read from `child_profiles` for the checkout. */
export const CHILD_CHECKOUT_COLUMNS = `
  id, parent_user_id, membership_provider, stripe_customer_id,
  stripe_subscription_id, subscription_status, membership_status,
  mpp_access_ends_at
`

/**
 * The public view of an MPP purchase order.
 *
 * Mirrors `mpp_checkout.view()`.
 *
 * @param row the order row.
 */
export function orderView(row: MppPurchaseOrderRow): Record<string, unknown> {
  const expiresAt = row.expires_at ?? null
  const live =
    row.status === 'PENDING' &&
    expiresAt !== null &&
    new Date(expiresAt).getTime() > Date.now()

  return {
    order_id: row.id,
    provider: 'mpp',
    plan_code: row.plan_code,
    amount_minor: row.amount_minor,
    currency: row.currency,
    duration_days: row.duration_days,
    auto_renew: false,
    status: row.status,
    remote_status: row.remote_status,
    merchant_name: row.merchant_name,
    project_name: row.project_name,
    checkout_url: live ? row.session_url : null,
    expires_at: expiresAt,
    granted_at: row.granted_at,
    verification_blocker: row.last_error,
  }
}

/**
 * Load an order that belongs to the user.
 *
 * Mirrors `owned_order()`: an order owned by somebody else is reported as
 * "not found" so the endpoint cannot be used to probe for other users'
 * orders.
 *
 * @param sql the database handle.
 * @param userId the user id.
 * @param orderId the order id.
 * @param columns the order columns.
 */
export async function ownedOrder(
  sql: Sql,
  userId: string,
  orderId: string,
  columns: string,
): Promise<MppPurchaseOrderRow> {
  const rows = (await sql.query(
    `SELECT ${columns} FROM mpp_purchase_orders
     WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [orderId, userId],
  )) as MppPurchaseOrderRow[]

  const row = rows[0]
  if (!row) {
    throw notFound('Payment order not found')
  }
  return row
}

/**
 * Load the first child profile of a user.
 *
 * @param sql the database handle.
 * @param userId the user id.
 */
export async function optionalChildProfile(
  sql: Sql,
  userId: string,
): Promise<ChildBillingRow | null> {
  const rows = (await sql.query(
    `SELECT ${CHILD_CHECKOUT_COLUMNS} FROM child_profiles
     WHERE parent_user_id = $1 ORDER BY id LIMIT 1`,
    [userId],
  )) as ChildBillingRow[]
  return rows[0] ?? null
}

/**
 * Refuse a checkout when the child already has a live Stripe subscription.
 *
 * Mirrors `mpp_checkout.reject_live_stripe()`.
 *
 * @param child the child profile.
 */
export function rejectLiveStripe(child: ChildBillingRow): void {
  if (
    child.stripe_subscription_id &&
    !['canceled', 'incomplete_expired'].includes(child.subscription_status ?? '')
  ) {
    throw conflict({ code: 'EXISTING_STRIPE_SUBSCRIPTION' })
  }
}

/**
 * Create (or reuse) the pending MPP order for a child.
 *
 * Mirrors `new_or_pending_order()`.
 *
 * @param sql the database handle.
 * @param settings the billing configuration.
 * @param userId the user id.
 * @param planCode the plan code.
 * @param columns the order columns.
 */
export async function newOrPendingOrder(
  sql: Sql,
  settings: BillingSettings,
  userId: string,
  planCode: string,
  columns: string,
): Promise<MppPurchaseOrderRow> {
  // A pending Stripe reservation locks the user to the Stripe gateway.
  const reservations = (await sql.query(
    `SELECT id FROM billing_checkout_reservations
     WHERE user_id = $1 AND status = 'PENDING' LIMIT 1`,
    [userId],
  )) as Array<{ id: string }>
  if (reservations.length > 0) {
    throw conflict({ code: 'CHECKOUT_PROVIDER_LOCKED', provider: 'stripe' })
  }

  const child = await optionalChildProfile(sql, userId)
  if (!child) {
    throw conflict({ code: 'CHILD_PROFILE_REQUIRED' })
  }
  rejectLiveStripe(child)

  const existing = (await sql.query(
    `SELECT ${columns} FROM mpp_purchase_orders
     WHERE child_id = $1 AND status = 'PENDING' ORDER BY created_at LIMIT 1`,
    [child.id],
  )) as MppPurchaseOrderRow[]
  if (existing[0]) {
    if (existing[0].plan_code !== planCode) {
      throw conflict({ code: 'PAYMENT_ALREADY_PENDING' })
    }
    return existing[0]
  }

  if (planCode === 'th_founder_monthly' || planCode === 'ep_founder_monthly') {
    const paid = await countFounderUsers(sql)
    const reserved = await countReservedFounderOrders(sql)
    if (paid + reserved >= founderPoolLimit(settings)) {
      throw conflict({ code: 'FOUNDER_FULL' })
    }
  }

  const priceRows = (await sql.query(
    `SELECT plan_code, amount_minor, currency, duration_days, entitlement_plan,
            program_type, active
     FROM mpp_package_prices WHERE plan_code = $1 LIMIT 1`,
    [planCode],
  )) as Array<{
    plan_code: string
    amount_minor: number
    currency: string
    duration_days: number
    entitlement_plan: string
    program_type: string
    active: boolean
  }>
  const price = priceRows[0]
  if (
    !price ||
    !price.active ||
    price.currency !== 'THB' ||
    price.amount_minor <= 0 ||
    price.duration_days !== 30
  ) {
    throw conflict({ code: 'MPP_PACKAGE_UNAVAILABLE' })
  }

  const orderId = crypto.randomUUID()
  const merchantOrderId = `topa-purchase-${crypto.randomUUID()}`
  const idempotencyKey = `topa-purchase-${crypto.randomUUID()}`

  const rows = (await sql.query(
    `INSERT INTO mpp_purchase_orders (
       id, user_id, child_id, plan_code, amount_minor, currency, duration_days,
       entitlement_plan, program_type, merchant_order_id, idempotency_key,
       api_origin, merchant_name, project_name, status, created_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'PENDING', now()
     )
     RETURNING ${columns}`,
    [
      orderId,
      userId,
      child.id,
      price.plan_code,
      price.amount_minor,
      price.currency,
      price.duration_days,
      price.entitlement_plan,
      price.program_type,
      merchantOrderId,
      idempotencyKey,
      settings.mppApiBaseUrl.replace(/\/+$/, ''),
      (settings.mppExpectedMerchantName ?? '').trim(),
      (settings.mppExpectedProjectName ?? '').trim(),
    ],
  )) as MppPurchaseOrderRow[]

  return rows[0] as MppPurchaseOrderRow
}

/**
 * The founder pool limit.
 *
 * @param settings the billing configuration.
 */
function founderPoolLimit(settings: BillingSettings): number {
  return Math.max(0, settings.founderUserLimit || settings.founderPriceLimit || 100)
}

/**
 * Count the child profiles that currently hold a founder slot.
 *
 * @param sql the database handle.
 */
async function countFounderUsers(sql: Sql): Promise<number> {
  const rows = (await sql.query(
    `SELECT COUNT(*)::int AS used
     FROM child_profiles
     WHERE active_price_code IN ('th_founder_monthly', 'ep_founder_monthly')
       AND membership_status IN ('paid', 'plus')
       AND (
         ((membership_provider IS NULL OR membership_provider <> 'mpp')
            AND subscription_status IN ('active', 'trialing', 'paid'))
         OR (membership_provider = 'mpp' AND mpp_access_ends_at > now())
       )`,
  )) as Array<{ used: number }>
  return Number(rows[0]?.used ?? 0)
}

/**
 * Count the pending MPP orders that hold a founder slot.
 *
 * @param sql the database handle.
 */
async function countReservedFounderOrders(sql: Sql): Promise<number> {
  const rows = (await sql.query(
    `SELECT COUNT(*)::int AS reserved
     FROM mpp_purchase_orders
     WHERE plan_code IN ('th_founder_monthly', 'ep_founder_monthly')
       AND status = 'PENDING'`,
  )) as Array<{ reserved: number }>
  return Number(rows[0]?.reserved ?? 0)
}

/**
 * The payload sent to the MPP `POST /payments` endpoint.
 *
 * Mirrors `mpp_checkout.payload()`.
 *
 * @param row the order row.
 */
export function orderPayload(row: MppPurchaseOrderRow): Record<string, unknown> {
  return {
    merchant_order_id: row.merchant_order_id,
    amount: row.amount_minor,
    currency: row.currency,
    customer_reference: row.user_id,
    description: `TOPA Math ${row.plan_code}`,
    metadata: { topa_order_id: row.id, topa_child_id: row.child_id },
    expires_in_seconds: 900,
  }
}

/**
 * Whether an MPP response identifies the same payment as the order.
 *
 * Mirrors `mpp_checkout.identity_matches()`.
 *
 * @param row the order row.
 * @param data the MPP response.
 */
export function identityMatches(row: MppPurchaseOrderRow, data: Record<string, unknown>): boolean {
  return (
    data.merchant_order_id === row.merchant_order_id &&
    typeof data.amount === 'number' &&
    Number.isInteger(data.amount) &&
    data.amount === row.amount_minor &&
    data.currency === row.currency
  )
}

/**
 * Whether the MPP session URL points at the configured payment host.
 *
 * Mirrors the URL check inside `submit_order()`.
 *
 * @param url the session URL.
 * @param settings the billing configuration.
 */
export function isTrustedSessionUrl(url: string, settings: BillingSettings): boolean {
  try {
    const parsed = new URL(url)
    const expected = new URL(settings.mppPaymentBaseUrl)
    return (
      parsed.protocol === 'https:' &&
      parsed.host === expected.host &&
      !parsed.username &&
      !parsed.password
    )
  } catch {
    return false
  }
}

/**
 * Perform a request against the MPP staging API.
 *
 * Mirrors `payment_integration.mpp_request()`.
 *
 * @param settings the billing configuration.
 * @param method the HTTP method.
 * @param path the API path.
 * @param payload the JSON payload.
 * @param key the idempotency key (POST only).
 */
export async function mppRequest(
  settings: BillingSettings,
  method: 'GET' | 'POST',
  path: string,
  payload?: Record<string, unknown>,
  key?: string,
): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (method === 'POST') {
    if (!settings.mppProjectApiKey) {
      throw serviceUnavailable('MPP_PROJECT_API_KEY is not configured')
    }
    headers['X-API-Key'] = settings.mppProjectApiKey
    if (key) {
      headers['Idempotency-Key'] = key
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    const response = await fetch(`${settings.mppApiBaseUrl.replace(/\/+$/, '')}${path}`, {
      method,
      headers,
      body: payload ? JSON.stringify(payload) : undefined,
      signal: controller.signal,
      redirect: 'manual',
    })

    if (!response.ok) {
      throw new HttpError(502, `MPP staging returned HTTP ${response.status}`)
    }

    const text = await response.text()
    let data: unknown
    try {
      data = JSON.parse(text)
    } catch {
      throw new HttpError(502, 'MPP staging request failed or timed out')
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new HttpError(502, 'MPP staging request failed or timed out')
    }
    return data as Record<string, unknown>
  } catch (error) {
    if (error instanceof HttpError) {
      throw error
    }
    throw new HttpError(502, 'MPP staging request failed or timed out')
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Validate the MPP OpenAPI contract before the first payment.
 *
 * Mirrors `mpp_checkout.validate_openapi()`.
 *
 * @param baseUrl the MPP API base URL.
 */
export async function validateOpenApi(baseUrl: string): Promise<void> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    const origin = baseUrl.replace(/\/api\/v1$/, '')
    const response = await fetch(`${origin}/openapi.json`, {
      signal: controller.signal,
      redirect: 'manual',
    })
    if (!response.ok) {
      throw new Error('contract unavailable')
    }
    const schema = (await response.json()) as {
      paths?: Record<string, { post?: { parameters?: Array<{ name?: string }> } }>
      components?: { schemas?: Record<string, { properties?: Record<string, { type?: string }> }> }
    }

    const operation = schema.paths?.['/api/v1/payments']?.post
    const headerNames = new Set(
      (operation?.parameters ?? []).map((param) => (param.name ?? '').toLowerCase()),
    )
    const properties = schema.components?.schemas?.PaymentCreateResponse?.properties ?? {}
    const required = [
      'payment_id',
      'merchant_order_id',
      'amount',
      'currency',
      'payment_session_token',
      'payment_session_url',
      'expires_at',
      'merchant',
      'project',
    ]

    const valid =
      required.every((field) => field in properties) &&
      headerNames.has('x-api-key') &&
      headerNames.has('idempotency-key') &&
      properties.amount?.type === 'integer'

    if (!valid) {
      throw new Error('contract mismatch')
    }
  } catch {
    throw serviceUnavailable({ code: 'MPP_CONTRACT_UNAVAILABLE' })
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Submit a pending order to MPP.
 *
 * Mirrors `mpp_checkout.submit_order()`.
 *
 * @param sql the database handle.
 * @param settings the billing configuration.
 * @param userId the user id.
 * @param orderId the order id.
 * @param columns the order columns.
 */
export async function submitOrder(
  sql: Sql,
  settings: BillingSettings,
  userId: string,
  orderId: string,
  columns: string,
): Promise<MppPurchaseOrderRow> {
  requireCheckoutReady(settings)

  const row = await ownedOrder(sql, userId, orderId, columns)
  if (row.status !== 'PENDING') {
    throw conflict({ code: 'PAYMENT_NOT_PENDING' })
  }

  const childRows = (await sql.query(
    `SELECT ${CHILD_CHECKOUT_COLUMNS} FROM child_profiles WHERE id = $1 LIMIT 1`,
    [row.child_id],
  )) as ChildBillingRow[]
  const child = childRows[0]
  if (!child || child.parent_user_id !== userId) {
    throw conflict({ code: 'ORDER_OWNER_MISMATCH' })
  }
  rejectLiveStripe(child)

  if (
    row.api_origin !== settings.mppApiBaseUrl.replace(/\/+$/, '') ||
    row.merchant_name !== (settings.mppExpectedMerchantName ?? '').trim() ||
    row.project_name !== (settings.mppExpectedProjectName ?? '').trim()
  ) {
    throw conflict({ code: 'PAYMENT_PROJECT_CHANGED' })
  }

  if (row.session_url) {
    const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0
    if (expiresAt <= Date.now()) {
      throw conflict({ code: 'PAYMENT_SESSION_EXPIRED', order_id: row.id })
    }
    return row
  }

  let data: Record<string, unknown>
  try {
    await validateOpenApi(row.api_origin)
    data = await mppRequest(
      settings,
      'POST',
      '/payments',
      orderPayload(row),
      row.idempotency_key,
    )
  } catch (error) {
    // A contract failure and a transport failure are recorded differently,
    // exactly like the FastAPI service does.
    const lastError =
      error instanceof HttpError &&
      typeof error.detail === 'object' &&
      error.detail !== null &&
      (error.detail as { code?: string }).code === 'MPP_CONTRACT_UNAVAILABLE'
        ? 'MPP_CONTRACT_UNAVAILABLE'
        : 'MPP_REQUEST_FAILED'

    await sql.query('UPDATE mpp_purchase_orders SET last_error = $1 WHERE id = $2', [
      lastError,
      row.id,
    ])
    throw new HttpError(error instanceof HttpError ? error.status : 502, {
      code: lastError,
      order_id: row.id,
    })
  }

  const url = typeof data.payment_session_url === 'string' ? data.payment_session_url : null
  const expiresAtRaw = typeof data.expires_at === 'string' ? data.expires_at : null
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null

  const merchant = data.merchant as { display_name?: string } | undefined
  const project = data.project as { name?: string } | undefined
  const paymentId = typeof data.payment_id === 'string' ? data.payment_id : null
  const sessionToken =
    typeof data.payment_session_token === 'string' ? data.payment_session_token : null

  const valid =
    identityMatches(row, data) &&
    merchant?.display_name === row.merchant_name &&
    project?.name === row.project_name &&
    paymentId !== null &&
    paymentId.length > 0 &&
    paymentId.length <= 120 &&
    sessionToken !== null &&
    sessionToken.length > 0 &&
    url !== null &&
    isTrustedSessionUrl(url, settings) &&
    expiresAt !== null &&
    !Number.isNaN(expiresAt.getTime())

  if (!valid) {
    await sql.query('UPDATE mpp_purchase_orders SET last_error = $1 WHERE id = $2', [
      'MPP_RESPONSE_MISMATCH',
      row.id,
    ])
    throw new HttpError(502, { code: 'MPP_RESPONSE_MISMATCH', order_id: row.id })
  }

  const updated = (await sql.query(
    `UPDATE mpp_purchase_orders
     SET payment_id = $1, session_token = $2, session_url = $3,
         remote_status = $4, expires_at = $5, last_error = NULL
     WHERE id = $6
     RETURNING ${columns}`,
    [
      paymentId,
      sessionToken,
      url,
      String(data.status ?? '').slice(0, 40),
      expiresAt.toISOString(),
      row.id,
    ],
  )) as MppPurchaseOrderRow[]

  return updated[0] as MppPurchaseOrderRow
}

/**
 * Re-read the payment status from MPP.
 *
 * Mirrors `mpp_checkout.recheck_order()`.
 *
 * @param sql the database handle.
 * @param settings the billing configuration.
 * @param userId the user id.
 * @param orderId the order id.
 * @param columns the order columns.
 */
export async function recheckOrder(
  sql: Sql,
  settings: BillingSettings,
  userId: string,
  orderId: string,
  columns: string,
): Promise<MppPurchaseOrderRow> {
  requireCheckoutReady(settings)

  const row = await ownedOrder(sql, userId, orderId, columns)
  if (!row.session_token) {
    throw conflict({ code: 'PAYMENT_NOT_CREATED' })
  }
  if (row.api_origin !== settings.mppApiBaseUrl.replace(/\/+$/, '')) {
    throw conflict({ code: 'PAYMENT_PROJECT_CHANGED' })
  }

  const data = await mppRequest(
    settings,
    'GET',
    `/pay/${encodeURIComponent(row.session_token)}`,
  )

  const matches =
    identityMatches(row, data) &&
    data.payment_id === row.payment_id &&
    data.customer_reference === userId &&
    data.merchant_display_name === row.merchant_name &&
    data.project_name === row.project_name

  if (!matches) {
    throw new HttpError(502, { code: 'MPP_RESPONSE_MISMATCH' })
  }

  const updated = (await sql.query(
    `UPDATE mpp_purchase_orders
     SET remote_status = $1, last_rechecked_at = now(),
         last_error = CASE WHEN status = 'PENDING' THEN 'MPP_CONFIRMATION_CONTRACT_REQUIRED' ELSE NULL END
     WHERE id = $2
     RETURNING ${columns}`,
    [String(data.status ?? '').slice(0, 40), row.id],
  )) as MppPurchaseOrderRow[]

  return updated[0] as MppPurchaseOrderRow
}
