/**
 * Stripe REST client.
 *
 * The Worker cannot use the `stripe` Python SDK, so the few endpoints the
 * billing service needs are called over the REST API with `fetch`:
 *
 *  - `POST /v1/customers`            — create the Stripe customer
 *  - `POST /v1/checkout/sessions`     — start the subscription checkout
 *  - `POST /v1/billing_portal/sessions` — open the customer portal
 *  - `GET  /v1/subscriptions/{id}`    — read a subscription (webhook)
 *
 * The Python service passes `idempotency_key=` to the SDK, which becomes
 * the `Idempotency-Key` header here.
 */

/** The Stripe API base URL. */
export const STRIPE_API_BASE = 'https://api.stripe.com/v1'

/** A Stripe error response. */
export class StripeError extends Error {
  /** The HTTP status Stripe answered with. */
  readonly status: number
  /** The Stripe error code, when the response carried one. */
  readonly code: string | null

  constructor(status: number, message: string, code: string | null = null) {
    super(message)
    this.name = 'StripeError'
    this.status = status
    this.code = code
  }
}

/** A Stripe customer. */
export interface StripeCustomer {
  id: string
}

/** A Stripe checkout session. */
export interface StripeCheckoutSession {
  id: string
  url: string | null
}

/** A Stripe billing-portal session. */
export interface StripePortalSession {
  url: string | null
}

/** A Stripe subscription, reduced to the fields the webhook needs. */
export interface StripeSubscription {
  id: string
  status: string
  customer: string | null
  current_period_end: number | null
  cancel_at_period_end: boolean
  /** The price id of the first subscription item. */
  price_id: string | null
}

/**
 * Form-encode a flat parameter map the way Stripe expects it.
 *
 * Nested keys use the bracket notation (`metadata[user_id]`,
 * `line_items[0][price]`), which is what the Python SDK produces too.
 *
 * @param params the parameters.
 */
function formEncode(params: Record<string, string | number | undefined>): string {
  const body = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      body.set(key, String(value))
    }
  }
  return body.toString()
}

/**
 * Perform a Stripe API request.
 *
 * @param secretKey the Stripe secret key.
 * @param path the API path (without the `/v1` prefix).
 * @param init the request options.
 */
async function stripeFetch(
  secretKey: string,
  path: string,
  init: { method?: string; body?: Record<string, string | number | undefined>; idempotencyKey?: string },
): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  }
  if (init.idempotencyKey) {
    headers['Idempotency-Key'] = init.idempotencyKey
  }

  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    method: init.method ?? (init.body ? 'POST' : 'GET'),
    headers,
    body: init.body ? formEncode(init.body) : undefined,
  })

  const text = await response.text()
  let payload: Record<string, unknown> = {}
  if (text.length > 0) {
    try {
      payload = JSON.parse(text) as Record<string, unknown>
    } catch {
      payload = {}
    }
  }

  if (!response.ok) {
    const error = payload.error as { message?: string; code?: string } | undefined
    throw new StripeError(
      response.status,
      error?.message ?? `Stripe request failed with status ${response.status}`,
      error?.code ?? null,
    )
  }

  return payload
}

/**
 * Create a Stripe customer.
 *
 * @param secretKey the Stripe secret key.
 * @param params the customer details.
 * @param idempotencyKey the idempotency key.
 */
export async function createCustomer(
  secretKey: string,
  params: { email: string; metadata: Record<string, string> },
  idempotencyKey?: string,
): Promise<StripeCustomer> {
  const body: Record<string, string | number | undefined> = { email: params.email }
  for (const [key, value] of Object.entries(params.metadata)) {
    body[`metadata[${key}]`] = value
  }
  const result = await stripeFetch(secretKey, '/customers', { body, idempotencyKey })
  return { id: String(result.id ?? '') }
}

/**
 * Create a subscription checkout session.
 *
 * @param secretKey the Stripe secret key.
 * @param params the session details.
 * @param idempotencyKey the idempotency key.
 */
export async function createCheckoutSession(
  secretKey: string,
  params: {
    customer: string
    priceId: string
    successUrl: string
    cancelUrl: string
    clientReferenceId: string
    metadata: Record<string, string>
  },
  idempotencyKey?: string,
): Promise<StripeCheckoutSession> {
  const body: Record<string, string | number | undefined> = {
    mode: 'subscription',
    customer: params.customer,
    'line_items[0][price]': params.priceId,
    'line_items[0][quantity]': 1,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    client_reference_id: params.clientReferenceId,
  }
  for (const [key, value] of Object.entries(params.metadata)) {
    body[`metadata[${key}]`] = value
  }

  const result = await stripeFetch(secretKey, '/checkout/sessions', { body, idempotencyKey })
  return { id: String(result.id ?? ''), url: (result.url as string | null) ?? null }
}

/**
 * Create a customer-portal session.
 *
 * @param secretKey the Stripe secret key.
 * @param params the portal session details.
 */
export async function createPortalSession(
  secretKey: string,
  params: { customer: string; returnUrl: string },
): Promise<StripePortalSession> {
  const result = await stripeFetch(secretKey, '/billing_portal/sessions', {
    body: { customer: params.customer, return_url: params.returnUrl },
  })
  return { url: (result.url as string | null) ?? null }
}

/**
 * Read a subscription.
 *
 * @param secretKey the Stripe secret key.
 * @param subscriptionId the subscription id.
 */
export async function retrieveSubscription(
  secretKey: string,
  subscriptionId: string,
): Promise<StripeSubscription> {
  const result = await stripeFetch(secretKey, `/subscriptions/${encodeURIComponent(subscriptionId)}`, {})

  const items = result.items as { data?: Array<{ price?: { id?: string } }> } | undefined
  const firstItem = items?.data?.[0]
  const customer = result.customer as { id?: string } | string | undefined

  return {
    id: String(result.id ?? subscriptionId),
    status: String(result.status ?? 'none'),
    customer: typeof customer === 'string' ? customer : (customer?.id ?? null),
    current_period_end:
      typeof result.current_period_end === 'number' ? result.current_period_end : null,
    cancel_at_period_end: Boolean(result.cancel_at_period_end),
    price_id: firstItem?.price?.id ?? null,
  }
}
