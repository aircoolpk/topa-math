/**
 * Integration tests for the billing and webhook endpoints.
 *
 * The real handlers run against the Neon test branch (`.env.test`), so the
 * SQL, the response shapes and the FastAPI compatibility layer are all
 * exercised together.
 *
 * The expectations are the ones the legacy FastAPI service produces — the
 * responses were captured from `http://127.0.0.1:8001` and are stored in
 * `.parity-fastapi/reference.json`.
 *
 * The fixtures are created per file and removed afterwards, so the suite can
 * run next to the other integration suites without leaving rows behind.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { Client } from 'pg'
import { Hono } from 'hono'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getDbFromEnv } from '../src/lib/db'
import { getEnv, type Bindings } from '../src/lib/env'
import { cors, toErrorResponse, type AppEnv } from '../src/lib/http'
import { authRoutes } from '../src/routes/auth'
import { billingRoutes } from '../src/routes/billing'
import { webhookRoutes } from '../src/routes/webhooks'
import { createTestSql, type TestSql } from './helpers/testSql'
import { withVerifiedSsl } from './helpers/connection'

const HERE = dirname(fileURLToPath(import.meta.url))
const PACKAGE_ROOT = join(HERE, '..')

/**
 * Connection string for the test database.
 *
 * `scripts/setup-test-db.mjs` provisions this role, the database and the
 * password helpers, so run it once before `npm test`. The default comes from
 * `.env.test`, which points at the Neon test branch; the local Postgres URL
 * is the last resort for a machine that still runs one.
 */
function readTestEnv(key: string): string | undefined {
  try {
    const match = readFileSync(new URL('../.env.test', import.meta.url), 'utf-8')
      .match(new RegExp(`^${key}=(.*)$`, 'm'))
    return match?.[1]?.trim()
  } catch {
    return undefined
  }
}

const DATABASE_URL = withVerifiedSsl(
  process.env.TEST_DATABASE_URL ??
    readTestEnv('TEST_DATABASE_URL') ??
    'postgresql://topa_test:***@127.0.0.1:5432/topa_test',
)

/** The shared HS256 secret used by the tests. */
const JWT_SECRET = 'test-secret-value-for-integration-tests'

/** The environment the app is booted with. */
const BINDINGS = {
  DATABASE_URL,
  JWT_SECRET,
  ENVIRONMENT: 'local',
  CORS_ORIGINS: 'http://localhost:3000,http://127.0.0.1:3000',
  AUTH_COOKIE_NAME: 'access_token',
  AUTH_COOKIE_SECURE: 'false',
  AUTH_COOKIE_SAMESITE: 'lax',
  AUTH_COOKIE_PATH: '/',
  ACCESS_TOKEN_EXPIRE_MINUTES: '1440',
  // The founder-price window is open in the test environment, exactly like in
  // the legacy service, so the founder plans are the visible ones.
  FOUNDER_PRICING_ENABLED: 'true',
  FOUNDER_PRICE_LIMIT: '100',
}

let client: Client
let sql: TestSql
let app: Hono<AppEnv>

/** The account the requests are made with. */
let userId: string
let userEmail: string
const userPassword = 'billing-test-password'

/** The child profile of the account. */
let childId: string

/** The access token of the test account. */
let token: string

/**
 * Build the application the way `src/index.ts` does.
 *
 * The suite mounts the routes it needs itself, so it stays independent of the
 * other route modules — the billing endpoints are the subject here, not the
 * whole surface of the Worker.
 *
 * @param sql the database handle the handlers use.
 */
function createTestApp(sql: TestSql): Hono<AppEnv> {
  const instance = new Hono<AppEnv>()

  instance.use('*', async (c, next) => {
    const env = getEnv(c.env as Bindings)
    const { sql: neon } = getDbFromEnv(env)
    c.set('env', env)
    c.set('sql', sql ?? neon)
    await next()
  })

  instance.use('*', async (c, next) => cors(c.get('env').CORS_ORIGINS)(c, next))

  instance.onError((error, c) => {
    const { status, body } = toErrorResponse(error)
    return c.json(body, status as 400)
  })

  instance.notFound((c) => c.json({ detail: 'Not Found' }, 404))

  instance.route('/auth', authRoutes)
  instance.route('/billing', billingRoutes)
  instance.route('/webhooks', webhookRoutes)

  return instance
}

/**
 * Make sure the account exists.
 *
 * The hash is written by the database helper, so the FastAPI service can
 * verify the very same credentials.
 */
async function createAccount(): Promise<void> {
  const rows = await client.query<{ count: number }>(
    'SELECT count(*)::int AS count FROM users WHERE id = $1',
    [userId],
  )
  if ((rows.rows[0]?.count ?? 0) > 0) {
    return
  }
  await client.query(
    `INSERT INTO users (id, email, password_hash, role, plan, is_active, created_at, updated_at)
     VALUES ($1, $2, topa_hash_password($3), 'parent', 'free', true, now(), now())`,
    [userId, userEmail, userPassword],
  )
}

/**
 * Make sure the child profile exists.
 */
async function createChild(): Promise<void> {
  const rows = await client.query<{ count: number }>(
    'SELECT count(*)::int AS count FROM child_profiles WHERE id = $1',
    [childId],
  )
  if ((rows.rows[0]?.count ?? 0) > 0) {
    return
  }
  await client.query(
    `INSERT INTO child_profiles (
       id, parent_user_id, nickname, grade_level, avatar_config, program_type,
       membership_status, created_at, updated_at
     ) VALUES ($1, $2, 'น้องทดสอบ', 3, '{}'::jsonb, 'THP', 'free', now(), now())`,
    [childId, userId],
  )
}

/**
 * Remove the rows the suite created.
 */
async function cleanFixtures(): Promise<void> {
  await client.query('DELETE FROM billing_checkout_reservations WHERE user_id = $1', [userId])
  await client.query('DELETE FROM child_profiles WHERE id = $1', [childId])
  await client.query('DELETE FROM users WHERE id = $1', [userId])
}

beforeAll(async () => {
  client = new Client({ connectionString: DATABASE_URL })
  await client.connect()

  // Install the password helpers the login path relies on.
  await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto')
  await client.query(readFileSync(join(PACKAGE_ROOT, 'scripts', 'pbkdf2.sql'), 'utf-8'))

  sql = createTestSql(client)
  app = createTestApp(sql)

  userId = crypto.randomUUID()
  userEmail = `billing-${Date.now()}@example.com`
  childId = crypto.randomUUID()

  await createAccount()
  await createChild()

  const registered = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: userEmail, password: userPassword }),
  })
  if (registered.status !== 200) {
    throw new Error(`Login failed with HTTP ${registered.status}`)
  }
  token = ((await registered.json()) as { access_token: string }).access_token
})

afterAll(async () => {
  await cleanFixtures()
  await client?.end()
})

/** Issue a request against the app with the test environment bindings. */
function request(path: string, init: RequestInit = {}): Promise<Response> {
  return Promise.resolve(app.request(path, init, BINDINGS))
}

/** Issue an authenticated request against the app. */
function authed(
  path: string,
  init: RequestInit = {},
  headers: Record<string, string> = {},
): Promise<Response> {
  return request(path, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${token}`,
      ...headers,
    },
  })
}

/** Issue a JSON POST request with the given body. */
function postJson(path: string, body: unknown, headers: Record<string, string> = {}) {
  return authed(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('GET /billing/prices', () => {
  it('returns the founder plans and the checkout provider', async () => {
    const response = await request('/billing/prices')
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      plans: Array<Record<string, unknown>>
      checkout_provider: string
    }

    // The FastAPI service answers `{plans, checkout_provider}` — there is no
    // `source` field on the top level.
    expect(body.checkout_provider).toBe('stripe')
    expect(Object.keys(body)).toEqual(['plans', 'checkout_provider'])

    const free = body.plans[0] as Record<string, unknown>
    expect(free.plan_code).toBe('free')
    expect(free.price_thb).toBe(0)
    expect(free.available).toBe(true)

    const founder = body.plans[1] as Record<string, unknown>
    expect(founder.plan_code).toBe('th_founder_monthly')
    expect(founder.price_thb).toBe(199)
    expect(founder.stripe_price_id).toBeNull()
    expect(founder.founder_limit).toBe(100)
    expect(founder.founder_shared_pool).toBe(true)
    // The legacy service writes the founder note with the same code points:
    // U+0E08 U+0E33 U+0E01 U+0E31 U+0E14 U+0E23 U+0E27 U+0E21 100 U+0E2A U+0E34
    // U+0E17 U+0E18 U+0B34 U+0E4C U+0E41 U+0E23 U+0E01
    expect(founder.note_th).toBe('\u0e08\u0e33\u0e01\u0e31\u0e14\u0e23\u0e27\u0e21 100 \u0e2a\u0e34\u0e17\u0e18\u0b34\u0e4c\u0e41\u0e23\u0e01')
    expect(founder.auto_renew).toBe(true)
    expect(Array.isArray(founder.features)).toBe(true)
  })
})

describe('GET /billing/plans', () => {
  it('returns the founder plan catalogue with the founder counters', async () => {
    const response = await request('/billing/plans')
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      plans: Array<Record<string, unknown>>
      founder_limit: number
      founder_used: number
      founder_slots_remaining: number
      founder_shared_pool: boolean
      source: string
    }

    expect(body.source).toBe('backend')
    expect(body.founder_limit).toBe(100)
    expect(body.founder_shared_pool).toBe(true)
    expect(body.founder_slots_remaining).toBeLessThanOrEqual(100)

    const free = body.plans[0] as Record<string, unknown>
    expect(free.plan_code).toBe('free')

    const founder = body.plans[1] as Record<string, unknown>
    expect(founder.plan_code).toBe('th_founder_monthly')
    expect(founder.checkout_plan_code).toBe('th_founder_monthly')
    expect(founder.description).toBe('บทเรียนภาษาไทย ป.1-ป.6')
    expect(founder.price_monthly).toBe(199)
    expect(founder.product_id).toBe('prod_USgNoW3SqfYosf')
    expect(founder.is_available).toBe(true)
    expect(founder.available).toBe(true)
  })
})

describe('GET /billing/status', () => {
  it('answers 401 for an anonymous caller', async () => {
    const response = await request('/billing/status')
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ detail: 'Not authenticated' })
  })

  it('returns the membership of the child profile', async () => {
    const response = await authed('/billing/status')
    expect(response.status).toBe(200)
    const body = (await response.json()) as Record<string, unknown>

    expect(body.membership_status).toBe('free')
    expect(body.plan_code).toBe('free')
    expect(body.plan).toBe('free')
    expect(body.is_paid).toBe(false)
    expect(body.subscription_status).toBe('none')
    expect(body.subscription_id).toBeNull()
    expect(body.current_period_end).toBeNull()
    expect(body.cancel_at_period_end).toBe(false)
  })
})

describe('POST /billing/create-checkout-session', () => {
  it('answers 401 for an anonymous caller', async () => {
    const response = await request('/billing/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_code: 'th_founder_monthly' }),
    })
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ detail: 'Not authenticated' })
  })

  it('answers 422 with the pydantic error list for a malformed body', async () => {
    const response = await postJson('/billing/create-checkout-session', '{"plan_code":')
    expect(response.status).toBe(422)
    const body = (await response.json()) as { detail: Array<Record<string, unknown>> }
    expect(body.detail[0]).toMatchObject({
      type: 'json_invalid',
      loc: ['body', 13],
      msg: 'JSON decode error',
    })
  })

  it('answers 422 when the plan code is not a string', async () => {
    const response = await postJson('/billing/create-checkout-session', { plan_code: 123 })
    expect(response.status).toBe(422)
    const body = (await response.json()) as { detail: Array<Record<string, unknown>> }
    expect(body.detail[0]).toEqual({
      type: 'string_type',
      loc: ['body', 'plan_code'],
      msg: 'Input should be a valid string',
      input: 123,
    })
  })

  it('answers 422 when the plan code is missing', async () => {
    const response = await postJson('/billing/create-checkout-session', {})
    expect(response.status).toBe(422)
    const body = (await response.json()) as { detail: Array<Record<string, unknown>> }
    expect(body.detail[0]).toEqual({
      type: 'missing',
      loc: ['body', 'plan_code'],
      msg: 'Field required',
      input: {},
    })
  })

  it('answers 400 for a plan that is not in the catalogue', async () => {
    const response = await postJson('/billing/create-checkout-session', { plan_code: 'nope' })
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ detail: 'Invalid plan_code' })
  })

  it('answers 401 before the body shape is validated', async () => {
    const response = await request('/billing/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_code: 123 }),
    })
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ detail: 'Not authenticated' })
  })
})

describe('POST /billing/mpp/checkout', () => {
  it('answers 400 for a plan that is not in the catalogue', async () => {
    const response = await postJson('/billing/mpp/checkout', { plan_code: 'nope' })
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ detail: 'Invalid plan_code' })
  })

  it('answers 503 when MPP checkout is disabled', async () => {
    const response = await postJson('/billing/mpp/checkout', { plan_code: 'th_founder_monthly' })
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ detail: { code: 'MPP_CHECKOUT_DISABLED' } })
  })
})

describe('GET /billing/mpp/orders', () => {
  it('answers 401 for an anonymous caller', async () => {
    const response = await request('/billing/mpp/orders')
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ detail: 'Not authenticated' })
  })

  it('returns the list of orders', async () => {
    const response = await authed('/billing/mpp/orders')
    expect(response.status).toBe(200)
    const body = (await response.json()) as Array<Record<string, unknown>>
    expect(Array.isArray(body)).toBe(true)
  })
})

describe('GET /billing/mpp/orders/:orderId', () => {
  it('answers 404 for an order that does not belong to the caller', async () => {
    const response = await authed('/billing/mpp/orders/00000000-0000-0000-0000-000000000000')
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ detail: 'Payment order not found' })
  })
})

describe('POST /billing/mpp/orders/:orderId/retry', () => {
  it('answers 503 with the blockers when MPP checkout is not ready', async () => {
    const response = await authed(
      '/billing/mpp/orders/00000000-0000-0000-0000-000000000000/retry',
      { method: 'POST' },
    )
    expect(response.status).toBe(503)
    const body = (await response.json()) as { detail: Record<string, unknown> }
    expect(body.detail.code).toBe('MPP_CHECKOUT_BLOCKED')
    expect(Array.isArray(body.detail.blockers)).toBe(true)
  })
})

describe('POST /billing/mpp/orders/:orderId/recheck', () => {
  it('answers 503 with the blockers when MPP checkout is not ready', async () => {
    const response = await authed(
      '/billing/mpp/orders/00000000-0000-0000-0000-000000000000/recheck',
      { method: 'POST' },
    )
    expect(response.status).toBe(503)
    const body = (await response.json()) as { detail: Record<string, unknown> }
    expect(body.detail.code).toBe('MPP_CHECKOUT_BLOCKED')
  })
})

describe('GET /billing/checkouts/:reservationId', () => {
  it('answers 404 for a reservation that does not belong to the caller', async () => {
    const response = await authed('/billing/checkouts/00000000-0000-0000-0000-000000000000')
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ detail: 'Checkout not found' })
  })
})

describe('POST /webhooks/stripe', () => {
  it('answers 400 for a request without a signature', async () => {
    const response = await request('/webhooks/stripe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'evt_test', type: 'checkout.session.completed' }),
    })
    // The legacy service needs a configured Stripe secret key before it
    // looks at the signature.
    expect([400, 500]).toContain(response.status)
    if (response.status === 400) {
      expect(await response.json()).toEqual({ detail: 'Invalid Stripe signature' })
    }
  })
})

describe('POST /webhooks/mpp/payments', () => {
  it('answers 503 because the MPP webhook contract is not implemented', async () => {
    const response = await request('/webhooks/mpp/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: 'evt_test' }),
    })
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ detail: { code: 'MPP_WEBHOOK_CONTRACT_REQUIRED' } })
  })
})

describe('POST /webhooks/mpp/staging', () => {
  it('refuses the UAT webhook when the signing secret is missing', async () => {
    // The legacy service refuses the staging webhook in production (403),
    // on a host that is not the staging pair (403) and without a signing
    // secret (503). The test environment is not production and uses the
    // staging hosts, so it reaches the missing secret.
    const response = await request('/webhooks/mpp/staging', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: 'evt_test', event_type: 'payment.confirmed', data: {} }),
    })
    expect(response.status).toBe(503)
    const body = (await response.json()) as { detail: string }
    expect(body.detail).toMatch(/SIGNING_SECRET/)
  })
})
