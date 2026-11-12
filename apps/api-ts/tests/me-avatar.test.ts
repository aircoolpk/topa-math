/**
 * Integration tests for the profile / stats / affiliate / referral / avatar
 * endpoints.
 *
 * The real handlers run against the Neon test branch, so the SQL, the
 * response shapes and the FastAPI-compatible JSON rendering are all
 * exercised together.
 *
 * The expected payloads were captured from the legacy FastAPI service
 * (`http://127.0.0.1:8001`) — see `apps/api-ts/tmp/fastapi-me-avatar.json`.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Client } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createAccessToken } from '../src/lib/auth'
import { createApp } from '../src/index'
import { avatarRoutes, childrenAvatarRoutes } from '../src/routes/avatar'
import { storageRoutes } from '../src/routes/storage'
import { createTestSql, type TestSql } from './helpers/testSql'
import { withVerifiedSsl } from './helpers/connection'

const HERE = dirname(fileURLToPath(import.meta.url))
const PACKAGE_ROOT = join(HERE, '..')

/**
 * Read the connection string of the test database.
 *
 * `scripts/setup-test-db.mjs` provisions it; `.env.test` points at the Neon
 * test branch.
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
  // The legacy service reads these from the environment; the referral links
  // and the absolute avatar URLs have to point at the same places.
  FRONTEND_BASE_URL: 'https://topamath.com',
  BACKEND_BASE_URL: 'https://api.topamath.com',
  AFFILIATE_MIN_WITHDRAWAL_MINOR: '50000',
}

let client: Client
let sql: TestSql
let app: ReturnType<typeof createApp>

/** The id of the test user. */
const USER_ID = 'b1f0c2d4-6a7e-4c3b-9d51-2f0a8e6b7c11'
/** The id of the test child profile. */
const CHILD_ID = 'c2e1d3f5-7b8f-4d4c-8e62-3a1b9f7c8d22'

/** The access token of the test user. */
let token: string

/** The body of the last response, parsed as JSON. */
async function json(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>
}

/** Issue a request against the app. */
function request(path: string, init: RequestInit = {}): Promise<Response> {
  return Promise.resolve(app.request(path, init, BINDINGS))
}

/**
 * Issue an authenticated request against the app.
 *
 * The suite shares the database with the other test files, and
 * `tests/api.test.ts` clears the whole `users` and `child_profiles` tables
 * when it boots. The fixtures are therefore restored before every request,
 * and the request is retried once if the row was wiped in between.
 *
 * @param path the request path.
 * @param init the request options.
 */
async function authRequest(path: string, init: RequestInit = {}): Promise<Response> {
  await seedFixture()
  const headers = { ...(init.headers ?? {}), Authorization: `Bearer ${token}` }
  const response = await request(path, { ...init, headers })
  if (response.status === 401) {
    // Another suite wiped the row between the seed and the request.
    await seedFixture()
    return request(path, { ...init, headers })
  }
  return response
}

/** The raw body of a response. */
async function text(response: Response): Promise<string> {
  return response.text()
}

beforeAll(async () => {
  client = new Client({ connectionString: DATABASE_URL })
  await client.connect()

  // The avatar storage table — the Worker keeps the uploaded images in
  // Postgres instead of on the filesystem.
  await client.query(readFileSync(join(PACKAGE_ROOT, 'migrations', '0001_avatar_files.sql'), 'utf-8'))

  sql = createTestSql(client)
  app = createApp({ sql })

  // `src/index.ts` is owned by another stream, so the new routers are
  // mounted here exactly as the production entry point will mount them:
  //
  //     app.route('/avatar', avatarRoutes)
  //     app.route('/children', childrenAvatarRoutes)
  //     app.route('/storage', storageRoutes)
  app.route('/avatar', avatarRoutes)
  app.route('/children', childrenAvatarRoutes)
  app.route('/storage', storageRoutes)

  token = await createAccessToken(USER_ID, 'parent', JWT_SECRET, 3600)
})

afterAll(async () => {
  await client?.end()
})

beforeEach(async () => {
  // Only this test's own rows are removed — the suite shares the database
  // with the other test files.
  await client.query('DELETE FROM child_inventory WHERE child_profile_id = $1', [CHILD_ID])
  await client.query('DELETE FROM student_stats WHERE child_profile_id = $1', [CHILD_ID])
  await client.query('DELETE FROM check_in_events WHERE child_profile_id = $1', [CHILD_ID])
  await client.query('DELETE FROM coin_ledger WHERE user_id = $1', [USER_ID])
  await client.query('DELETE FROM referral_events WHERE referrer_user_id = $1', [USER_ID])
  await client.query('DELETE FROM affiliate_withdrawal_requests WHERE user_id = $1', [USER_ID])
  await client.query('DELETE FROM affiliate_payout_accounts WHERE user_id = $1', [USER_ID])
  await client.query('DELETE FROM affiliate_commission_ledger WHERE affiliate_user_id = $1', [USER_ID])
  await client.query('DELETE FROM public_shares WHERE created_by_user_id = $1', [USER_ID])
  await client.query('DELETE FROM child_quests WHERE child_profile_id = $1', [CHILD_ID])
  await client.query('DELETE FROM avatar_files WHERE filename = ANY($1::text[])', [['a.webp']])
  await client.query('DELETE FROM avatar_items WHERE code = $1', ['hair_style-1'])
  await client.query('DELETE FROM child_profiles WHERE id = $1', [CHILD_ID])
  await client.query('DELETE FROM users WHERE id = $1', [USER_ID])

  await seedFixture()
})

/**
 * Create the user of this test — without a child profile.
 *
 * @param withChild whether the child profile is created as well.
 */
async function seedUserOnly(): Promise<void> {
  await client.query(
    `INSERT INTO users (id, email, password_hash, role, plan, is_active, referral_token, created_at, updated_at)
     VALUES ($1, $2, 'x', 'parent', 'free', true, 'VvBWDel3MiAs2Srf', now(), now())
     ON CONFLICT (id) DO UPDATE SET referral_token = EXCLUDED.referral_token, is_active = true`,
    [USER_ID, 'demo@4-craft.com'],
  )
}

/**
 * Create the user, the child profile and the stats row of this test.
 *
 * The fixtures are recreated before every test, so the order of the tests
 * does not matter.
 */
async function seedFixture(): Promise<void> {
  await client.query(
    `INSERT INTO users (id, email, password_hash, role, plan, is_active, referral_token, created_at, updated_at)
     VALUES ($1, $2, 'x', 'parent', 'free', true, 'VvBWDel3MiAs2Srf', now(), now())
     ON CONFLICT (id) DO UPDATE SET referral_token = EXCLUDED.referral_token, is_active = true`,
    [USER_ID, 'demo@4-craft.com'],
  )
  await client.query(
    `INSERT INTO child_profiles (
       id, parent_user_id, nickname, grade_level, program_type, membership_status,
       total_score, total_xp, coins, current_level, days_active, test_attempts_used,
       free_test_limit, total_tests_completed, average_test_accuracy, average_test_speed,
       current_rank_title, streak_count, created_at, updated_at
     ) VALUES (
       $1, $2, 'QA Student', 3, 'THP', 'plus',
       30, 30, 2, 1, 0, 0,
       999999, 2, 5.00, 500.00,
       'เด็กหลังห้อง', 0, '2026-05-22 11:27:49.708090+00', '2026-11-10 15:05:32.683270+00'
     )
     ON CONFLICT (id) DO UPDATE SET nickname = EXCLUDED.nickname`,
    [CHILD_ID, USER_ID],
  )
  await client.query(
    `INSERT INTO student_stats (id, child_profile_id, lessons_completed, tests_completed, quests_completed, checkins, perfect_tests, created_at, updated_at)
     VALUES ('d3f2e4a6-8c9f-4e5d-9f73-4b2c0a8d9e33', $1, 2, 0, 0, 0, 0, now(), now())
     ON CONFLICT (id) DO UPDATE SET lessons_completed = EXCLUDED.lessons_completed`,
    [CHILD_ID],
  )
}

describe('GET /me/profile', () => {
  it('answers with the ChildOut payload of the legacy service', async () => {
    const response = await authRequest('/me/profile')
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')

    const body = await json(response)
    // The key order is the order of the pydantic model.
    expect(Object.keys(body)).toEqual([
      'id',
      'first_name',
      'last_name',
      'nickname',
      'grade_level',
      'province',
      'district',
      'school_name',
      'school_province',
      'school_district',
      'student_photo_url',
      'student_photo_path',
      'avatar_gender',
      'avatar_config',
      'program_type',
      'membership_status',
      'membership',
      'total_score',
      'total_xp',
      'coins',
      'current_level',
      'days_active',
      'test_attempts_used',
      'free_test_limit',
      'total_tests_completed',
      'average_test_accuracy',
      'average_test_speed',
      'current_rank_title',
      'rank_title',
      'streak_count',
      'created_at',
      'updated_at',
    ])

    expect(body.id).toBe(CHILD_ID)
    expect(body.nickname).toBe('QA Student')
    expect(body.grade_level).toBe(3)
    expect(body.program_type).toBe('THP')
    expect(body.membership_status).toBe('plus')
    expect(body.membership).toBe('plus')
    expect(body.total_score).toBe(30)
    expect(body.total_xp).toBe(30)
    expect(body.coins).toBe(2)
    expect(body.free_test_limit).toBe(999999)
    expect(body.total_tests_completed).toBe(2)
    expect(body.current_rank_title).toBe('เด็กหลังห้อง')
    expect(body.rank_title).toBe('เด็กหลังห้อง')
    expect(body.streak_count).toBe(0)
    expect(body.avatar_config).toEqual({})

    // pydantic renders the timestamps with a `Z` suffix.
    expect(body.created_at).toBe('2026-05-22T11:27:49.708090Z')
    expect(body.updated_at).toBe('2026-11-10T15:05:32.683270Z')
  })

  it('keeps the `.0` of the float fields', async () => {
    const response = await authRequest('/me/profile')
    const raw = await text(response)

    expect(raw).toContain('"average_test_accuracy":5.0')
    expect(raw).toContain('"average_test_speed":500.0')
    // `total_score` is an int, not a float.
    expect(raw).toContain('"total_score":30,')
  })

  it('requires a token', async () => {
    const response = await request('/me/profile')
    expect(response.status).toBe(401)
    expect(await json(response)).toEqual({ detail: 'Not authenticated' })
  })

  it('answers 404 when the user has no child profile', async () => {
    await client.query('DELETE FROM child_profiles WHERE id = $1', [CHILD_ID])
    await seedUserOnly()
    const response = await request('/me/profile', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(response.status).toBe(404)
    expect(await json(response)).toEqual({ detail: 'ไม่พบโปรไฟล์นักเรียน' })
  })
})

describe('PATCH /me/profile', () => {
  it('updates the fields and returns the new profile', async () => {
    const response = await authRequest('/me/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'QA Student 2', province: 'กรุงเทพ' }),
    })
    expect(response.status).toBe(200)
    const body = await json(response)
    expect(body.nickname).toBe('QA Student 2')
    expect(body.province).toBe('กรุงเทพ')

    const stored = await client.query('SELECT nickname, province FROM child_profiles WHERE id = $1', [CHILD_ID])
    expect(stored.rows[0].nickname).toBe('QA Student 2')
    expect(stored.rows[0].province).toBe('กรุงเทพ')
  })

  it('recomputes the level and the rank title', async () => {
    await client.query('UPDATE child_profiles SET total_xp = 150, total_score = 350 WHERE id = $1', [CHILD_ID])
    const response = await authRequest('/me/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'QA Student' }),
    })
    const body = await json(response)
    expect(body.current_level).toBe(2)
    expect(body.current_rank_title).toBe('เด็กเก่ง')
  })

  it('rejects an invalid program type with the pydantic error list', async () => {
    const response = await authRequest('/me/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ program_type: 'XX' }),
    })
    expect(response.status).toBe(422)
    const body = await json(response)
    expect(Array.isArray(body.detail)).toBe(true)
    const detail = body.detail as Array<{ loc: string[]; type: string }>
    expect(detail[0]?.loc).toEqual(['body', 'program_type'])
    expect(detail[0]?.type).toBe('literal_error')
  })
})

describe('GET /me/stats', () => {
  it('answers with the stats payload of the legacy service', async () => {
    const response = await authRequest('/me/stats')
    expect(response.status).toBe(200)
    const raw = await text(response)
    const body = JSON.parse(raw) as Record<string, unknown>
    expect(Object.keys(body)).toEqual([
      'score',
      'speed',
      'lesson_count',
      'test_count',
      'rank_title',
      'average_test_accuracy',
    ])
    expect(body.score).toBe(30)
    expect(body.lesson_count).toBe(2)
    expect(body.test_count).toBe(2)
    expect(body.rank_title).toBe('เด็กหลังห้อง')

    expect(raw).toContain('"speed":500.0')
    expect(raw).toContain('"average_test_accuracy":5.0')
  })

  it('answers 404 without a child profile', async () => {
    await client.query('DELETE FROM child_profiles WHERE id = $1', [CHILD_ID])
    await seedUserOnly()
    const response = await request('/me/stats', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(response.status).toBe(404)
  })
})

describe('POST /me/check-in', () => {
  it('checks the child in and returns the daily quest', async () => {
    const response = await authRequest('/me/check-in', { method: 'POST' })
    expect(response.status).toBe(200)
    const raw = await text(response)
    const body = JSON.parse(raw) as Record<string, unknown>

    expect(body.checked_in).toBe(true)
    expect(body.already_checked_in).toBe(false)
    expect(body.days_active).toBe(1)
    expect(body.streak_count).toBe(1)

    const quest = body.quest as Record<string, unknown>
    expect(quest.quest_id).toBe('daily-check-in')
    expect(quest.id).toBe('daily-check-in')
    expect(quest.title).toBe('เช็กชื่อในระบบ')
    expect(quest.metric_type).toBe('check_in')
    expect(quest.progress_current).toBe(1)
    expect(quest.progress_total).toBe(1)
    expect(quest.status).toBe('claimable')
    expect(quest.can_claim_reward).toBe(true)
    expect(quest.reset_at).toMatch(/T00:00:00\+07:00$/)

    expect(raw).toContain('"progress_percent":100.0')

    const stored = await client.query(
      'SELECT days_active, streak_count FROM child_profiles WHERE id = $1',
      [CHILD_ID],
    )
    expect(stored.rows[0].days_active).toBe(1)
    expect(stored.rows[0].streak_count).toBe(1)
  })

  it('reports the second check-in of the day as already done', async () => {
    await authRequest('/me/check-in', { method: 'POST' })
    const response = await authRequest('/me/check-in', { method: 'POST' })
    const body = await json(response)
    expect(body.already_checked_in).toBe(true)
    expect(body.days_active).toBe(1)
    expect(body.streak_count).toBe(1)
  })

  it('is a 405 for GET, exactly like the legacy service', async () => {
    const response = await authRequest('/me/check-in')
    expect(response.status).toBe(405)
    expect(await json(response)).toEqual({ detail: 'Method Not Allowed' })
  })
})

describe('GET /me/referral', () => {
  it('answers with the referral summary', async () => {
    const response = await authRequest('/me/referral')
    expect(response.status).toBe(200)
    const body = await json(response)
    expect(Object.keys(body)).toEqual([
      'referral_token',
      'referral_url',
      'click_count',
      'registered_count',
      'paid_count',
      'pending_coins',
      'active_coins',
      'history',
    ])
    expect(body.referral_token).toBe('VvBWDel3MiAs2Srf')
    expect(body.referral_url).toBe('https://topamath.com?ref=VvBWDel3MiAs2Srf')
    expect(body.click_count).toBe(0)
    expect(body.registered_count).toBe(0)
    expect(body.paid_count).toBe(0)
    expect(body.pending_coins).toBe(0)
    expect(body.active_coins).toBe(0)
    expect(body.history).toEqual([])
  })

  it('counts the clicks and the coins of the ledger', async () => {
    await client.query(
      `INSERT INTO referral_events (id, referrer_user_id, referred_user_id, referral_token, event_type, created_at)
       VALUES ('e1f2a3b4-9c0d-4e5f-8a71-2b3c4d5e6f70', $1, NULL, 'VvBWDel3MiAs2Srf', 'clicked', now())`,
      [USER_ID],
    )
    await client.query(
      `INSERT INTO coin_ledger (id, user_id, amount, type, status, reference_id, note, created_at)
       VALUES ('f2a3b4c5-0d1e-4f6a-9b82-3c4d5e6f7081', $1, 10, 'referral_registered', 'pending', 'registered:x', 'n', now())`,
      [USER_ID],
    )
    const body = await json(await authRequest('/me/referral'))
    expect(body.click_count).toBe(1)
    expect(body.pending_coins).toBe(10)
    expect(body.active_coins).toBe(0)

    const history = body.history as Array<Record<string, unknown>>
    expect(history).toHaveLength(1)
    expect(history[0]?.amount).toBe(10)
    expect(history[0]?.type).toBe('referral_registered')
    expect(history[0]?.status).toBe('pending')
  })
})

describe('GET /me/affiliate', () => {
  it('answers with the affiliate summary', async () => {
    const response = await authRequest('/me/affiliate')
    expect(response.status).toBe(200)
    const body = await json(response)
    expect(Object.keys(body)).toEqual([
      'referral_token',
      'referral_url',
      'registered_count',
      'paid_member_count',
      'total_referred_paid_minor',
      'total_commission_minor',
      'pending_balance_minor',
      'available_balance_minor',
      'withdrawn_balance_minor',
      'min_withdrawal_minor',
      'payout_account',
      'registrations',
      'commissions',
      'withdrawals',
    ])
    expect(body.referral_token).toBe('VvBWDel3MiAs2Srf')
    expect(body.referral_url).toBe('https://topamath.com?ref=VvBWDel3MiAs2Srf')
    expect(body.registered_count).toBe(0)
    expect(body.paid_member_count).toBe(0)
    expect(body.min_withdrawal_minor).toBe(50000)
    expect(body.payout_account).toBeNull()
    expect(body.registrations).toEqual([])
    expect(body.commissions).toEqual([])
    expect(body.withdrawals).toEqual([])
  })

  it('sums the commissions of the ledger', async () => {
    await client.query(
      `INSERT INTO affiliate_commission_ledger (
         id, affiliate_user_id, referred_user_id, payment_reference_id, source_event_id,
         amount_paid_minor, commission_minor, currency, rate_bps, status, available_at,
         metadata, created_at, updated_at
       ) VALUES (
         'a3b4c5d6-1e2f-4a7b-8c93-4d5e6f708192', $1, $2, 'pay-1', 'src-1',
         100000, 3000, 'THB', 300, 'available', now(),
         '{}'::jsonb, now(), now()
       )`,
      [USER_ID, 'd4c5e6f7-2f3a-4b8c-9da4-5e6f70819203'],
    )
    const body = await json(await authRequest('/me/affiliate'))
    expect(body.total_referred_paid_minor).toBe(100000)
    expect(body.total_commission_minor).toBe(3000)
    expect(body.available_balance_minor).toBe(3000)
    expect(body.pending_balance_minor).toBe(0)

    const commissions = body.commissions as Array<Record<string, unknown>>
    expect(commissions).toHaveLength(1)
    expect(commissions[0]?.commission_minor).toBe(3000)
    expect(commissions[0]?.status).toBe('available')
    expect(commissions[0]?.currency).toBe('THB')
    expect(commissions[0]?.rate_bps).toBe(300)
  })
})

describe('PUT /me/affiliate/payout-account', () => {
  it('stores the payout account and masks the number', async () => {
    const response = await authRequest('/me/affiliate/payout-account', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payout_method: 'bank',
        account_holder_name: 'QA Tester',
        bank_name: 'KBANK',
        account_number: '123-4-56789-0',
      }),
    })
    expect(response.status).toBe(200)
    const body = await json(response)
    expect(body.ok).toBe(true)
    expect(typeof body.payout_account_id).toBe('string')

    const summary = await json(await authRequest('/me/affiliate'))
    const account = summary.payout_account as Record<string, unknown>
    expect(account.payout_method).toBe('bank')
    expect(account.account_holder_name).toBe('QA Tester')
    expect(account.bank_name).toBe('KBANK')
    expect(account.account_masked).toBe('****7890')
    expect(account.promptpay_masked).toBeNull()
  })

  it('rejects an unknown payout method', async () => {
    const response = await authRequest('/me/affiliate/payout-account', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payout_method: 'crypto', account_holder_name: 'QA' }),
    })
    expect(response.status).toBe(400)
    expect(await json(response)).toEqual({ detail: 'Invalid payout_method' })
  })

  it('requires the bank details', async () => {
    const response = await authRequest('/me/affiliate/payout-account', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payout_method: 'bank', account_holder_name: 'QA' }),
    })
    expect(response.status).toBe(400)
    expect(await json(response)).toEqual({ detail: 'bank_name and account_number are required' })
  })

  it('requires the account holder', async () => {
    const response = await authRequest('/me/affiliate/payout-account', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payout_method: 'bank' }),
    })
    expect(response.status).toBe(422)
    const body = await json(response)
    const detail = body.detail as Array<{ loc: string[]; type: string }>
    expect(detail[0]?.loc).toEqual(['body', 'account_holder_name'])
    expect(detail[0]?.type).toBe('missing')
  })

  it('is a 405 for POST, exactly like the legacy service', async () => {
    const response = await authRequest('/me/affiliate/payout-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(response.status).toBe(405)
    expect(await json(response)).toEqual({ detail: 'Method Not Allowed' })
  })
})

describe('POST /me/affiliate/withdrawals', () => {
  it('requires the minimum amount', async () => {
    const response = await authRequest('/me/affiliate/withdrawals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount_minor: 100 }),
    })
    expect(response.status).toBe(400)
    expect(await json(response)).toEqual({ detail: 'Withdrawal amount is below minimum' })
  })

  it('requires a payout account', async () => {
    const response = await authRequest('/me/affiliate/withdrawals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount_minor: 50000 }),
    })
    expect(response.status).toBe(400)
    expect(await json(response)).toEqual({ detail: 'Payout account is required' })
  })

  it('rejects a non-positive amount with the pydantic error list', async () => {
    const response = await authRequest('/me/affiliate/withdrawals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount_minor: 0 }),
    })
    expect(response.status).toBe(422)
    const body = await json(response)
    const detail = body.detail as Array<{ loc: string[]; type: string }>
    expect(detail[0]?.loc).toEqual(['body', 'amount_minor'])
    expect(detail[0]?.type).toBe('greater_than')
  })

  it('answers 409 when the balance is too small', async () => {
    await client.query(
      `INSERT INTO affiliate_payout_accounts (
         id, user_id, payout_method, account_holder_name, bank_name, account_last4,
         promptpay_last4, payout_details, created_at, updated_at
       ) VALUES (
         'b4c5d6e7-3a4b-4c9d-aeb5-6f7081920304', $1, 'bank', 'QA', 'KBANK', '7890',
         NULL, '{}'::jsonb, now(), now()
       )`,
      [USER_ID],
    )
    const response = await authRequest('/me/affiliate/withdrawals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount_minor: 50000 }),
    })
    expect(response.status).toBe(409)
    expect(await json(response)).toEqual({ detail: 'Insufficient available balance' })
  })
})

describe('POST /me/share/dashboard', () => {
  it('creates a share link with the social URLs', async () => {
    const response = await authRequest('/me/share/dashboard', { method: 'POST' })
    expect(response.status).toBe(200)
    const body = await json(response)
    expect(Object.keys(body)).toEqual([
      'share_url',
      'copy_url',
      'facebook_url',
      'x_url',
      'line_url',
      'mode',
      'token',
    ])
    expect(body.share_url).toBe('https://topamath.com?ref=VvBWDel3MiAs2Srf')
    expect(body.copy_url).toBe('https://topamath.com?ref=VvBWDel3MiAs2Srf')
    expect(body.facebook_url).toBe(
      'https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Ftopamath.com%3Fref%3DVvBWDel3MiAs2Srf',
    )
    expect(body.x_url).toContain('https://twitter.com/intent/tweet?url=https%3A%2F%2Ftopamath.com')
    expect(body.line_url).toBe(
      'https://social-plugins.line.me/lineit/share?url=https%3A%2F%2Ftopamath.com%3Fref%3DVvBWDel3MiAs2Srf',
    )
    expect(body.mode).toBe('public_share')
    expect(typeof body.token).toBe('string')

    const stored = await client.query('SELECT share_type, data FROM public_shares WHERE token = $1', [
      body.token,
    ])
    expect(stored.rows[0].share_type).toBe('dashboard')
    const data = stored.rows[0].data as Record<string, unknown>
    expect(data.display_name).toBe('QA Student')
    expect(data.title).toBe('QA Student ชวนมาเรียนเลขสนุก ๆ กับ TOPA Math')
    expect(data.referral_token).toBe('VvBWDel3MiAs2Srf')
    expect(data.cta_url).toBe('https://topamath.com?ref=VvBWDel3MiAs2Srf')
  })
})

describe('POST /me/share/test-result', () => {
  it('answers 404 for an unknown session', async () => {
    const response = await authRequest('/me/share/test-result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: '00000000-0000-0000-0000-000000000000' }),
    })
    expect(response.status).toBe(404)
    expect(await json(response)).toEqual({ detail: 'ไม่พบผลสอบนี้' })
  })
})

describe('GET /avatar/items', () => {
  it('answers with the avatar catalogue', async () => {
    await client.query(
      `INSERT INTO avatar_items (id, code, name, item_type, rarity, asset_url, is_default, created_at)
       VALUES (
         'e5f6a7b8-4c5d-4b0e-8cf9-708192030405', 'hair_style-1', 'hair_style 1', 'hair_style',
         'common', NULL, true, '2026-05-22 11:27:49.708090+00'
       )`,
    )
    const response = await authRequest('/avatar/items')
    expect(response.status).toBe(200)
    const body = (await response.json()) as Array<Record<string, unknown>>
    expect(body).toHaveLength(1)
    expect(Object.keys(body[0] as object)).toEqual([
      'item_type',
      'id',
      'asset_url',
      'created_at',
      'name',
      'rarity',
      'code',
      'is_default',
    ])
    expect(body[0]?.item_type).toBe('hair_style')
    expect(body[0]?.code).toBe('hair_style-1')
    expect(body[0]?.is_default).toBe(true)
    // The ORM rows are rendered with the `+00:00` offset.
    expect(body[0]?.created_at).toBe('2026-05-22T11:27:49.708090+00:00')
  })
})

describe('GET /children/{child_id}/inventory', () => {
  it('answers with the inventory of the child', async () => {
    await client.query(
      `INSERT INTO child_inventory (id, child_profile_id, avatar_item_id, acquired_at)
       VALUES ('a6b7c8d9-5e6f-4c1a-9d0e-819203040516', $1, '3e3fe990-539e-425b-b8a0-56bc32c99793', '2026-05-22 11:30:28.461561+00')`,
      [CHILD_ID],
    )
    const response = await authRequest(`/children/${CHILD_ID}/inventory`)
    expect(response.status).toBe(200)
    const body = (await response.json()) as Array<Record<string, unknown>>
    expect(body).toHaveLength(1)
    expect(Object.keys(body[0] as object)).toEqual([
      'acquired_at',
      'child_profile_id',
      'id',
      'avatar_item_id',
    ])
    expect(body[0]?.child_profile_id).toBe(CHILD_ID)
    expect(body[0]?.acquired_at).toBe('2026-05-22T11:30:28.461561+00:00')
  })
})

describe('PATCH /children/{child_id}/avatar', () => {
  it('stores the avatar configuration', async () => {
    const response = await authRequest(`/children/${CHILD_ID}/avatar`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hair_style: 'hair_style-1' }),
    })
    expect(response.status).toBe(200)
    const body = await json(response)
    expect(body.avatar_config).toEqual({ hair_style: 'hair_style-1' })
  })
})

describe('POST /me/students/{child_id}/avatar', () => {
  it('rejects a file that is not an image', async () => {
    const form = new FormData()
    form.append('file', new Blob(['hello'], { type: 'text/plain' }), 'a.txt')
    const response = await authRequest(`/me/students/${CHILD_ID}/avatar`, { method: 'POST', body: form })
    expect(response.status).toBe(400)
    expect(await json(response)).toEqual({ detail: 'รองรับเฉพาะไฟล์ JPG, PNG, หรือ WebP เท่านั้น' })
  })

  it('answers 404 for a child of another user', async () => {
    const form = new FormData()
    form.append('file', new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' }), 'a.png')
    const response = await authRequest('/me/students/00000000-0000-0000-0000-000000000000/avatar', {
      method: 'POST',
      body: form,
    })
    expect(response.status).toBe(404)
    expect(await json(response)).toEqual({ detail: 'ไม่พบโปรไฟล์นักเรียน' })
  })

  it('stores the image and returns the URLs', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01])
    const form = new FormData()
    form.append('file', new Blob([png], { type: 'image/png' }), 'a.png')
    const response = await authRequest(`/me/students/${CHILD_ID}/avatar`, { method: 'POST', body: form })
    expect(response.status).toBe(200)
    const body = await json(response)
    expect(Object.keys(body)).toEqual(['student_photo_url', 'student_photo_absolute_url', 'avatar_url'])
    expect(body.student_photo_url).toMatch(/^\/storage\/avatars\//)
    expect(body.student_photo_absolute_url).toBe(`https://api.topamath.com${body.student_photo_url as string}`)
    expect(body.avatar_url).toBe(body.student_photo_url)
  })
})

describe('DELETE /me/students/{child_id}/avatar', () => {
  it('clears the photo of the child', async () => {
    await client.query('UPDATE child_profiles SET student_photo_path = $1 WHERE id = $2', [
      'old.webp',
      CHILD_ID,
    ])
    const response = await authRequest(`/me/students/${CHILD_ID}/avatar`, { method: 'DELETE' })
    expect(response.status).toBe(200)
    expect(await json(response)).toEqual({ success: true })

    const stored = await client.query(
      'SELECT student_photo_path, student_photo_url FROM child_profiles WHERE id = $1',
      [CHILD_ID],
    )
    expect(stored.rows[0].student_photo_path).toBeNull()
    expect(stored.rows[0].student_photo_url).toBeNull()
  })

  it('answers 404 for a child of another user', async () => {
    const response = await authRequest('/me/students/00000000-0000-0000-0000-000000000000/avatar', {
      method: 'DELETE',
    })
    expect(response.status).toBe(404)
  })
})

describe('GET /storage/avatars/{filename}', () => {
  it('serves the stored image', async () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    await client.query(
      `INSERT INTO avatar_files (filename, content_type, data, created_at, updated_at)
       VALUES ('a.webp', 'image/webp', $1, now(), now())`,
      [Buffer.from(bytes)],
    )
    const response = await request('/storage/avatars/a.webp')
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/webp')
    const body = new Uint8Array(await response.arrayBuffer())
    expect(Array.from(body)).toEqual(Array.from(bytes))
  })

  it('answers 404 for an unknown file', async () => {
    const response = await request('/storage/avatars/missing.webp')
    expect(response.status).toBe(404)
    expect(await json(response)).toEqual({ detail: 'Not Found' })
  })

  it('refuses a path traversal', async () => {
    const response = await request('/storage/avatars/..%2F..%2Fetc%2Fpasswd')
    expect(response.status).toBe(404)
  })
})
