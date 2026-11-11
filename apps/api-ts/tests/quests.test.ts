/**
 * Integration tests for the `/me/quests…` endpoints.
 *
 * The real handlers run against the Neon test branch, so the SQL, the period
 * windows and the response shapes are all exercised together. The expected
 * payloads were captured from the legacy FastAPI service, which is still
 * running as the oracle during the migration.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { Client } from 'pg'
import { Hono } from 'hono'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createAccessToken } from '../src/lib/auth'
import { getDbFromEnv } from '../src/lib/db'
import { getEnv, type Bindings } from '../src/lib/env'
import { cors, toErrorResponse, type AppEnv } from '../src/lib/http'
import { questRoutes } from '../src/routes/quests'
import { createTestSql, type TestSql } from './helpers/testSql'

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

const DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  readTestEnv('TEST_DATABASE_URL') ??
  'postgresql://topa_test:***@127.0.0.1:5432/topa_test'

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
}

let client: Client
let sql: TestSql
let app: Hono<AppEnv>

/**
 * Build the application the way `src/index.ts` does.
 *
 * The suite mounts the quest routes itself, so it stays independent of the
 * other route modules — the quest endpoints are the subject here, not the
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

  instance.route('/me', questRoutes)

  return instance
}

/** The fixed ids of the test fixtures. */
const USER_ID = 'a0000000-0000-4000-8000-00000000quest'.replace('quest', 'q001')
const CHILD_ID = 'b0000000-0000-4000-8000-00000000q002'
const USER_EMAIL = 'quest-endpoints@example.com'

let token: string

/** The key order the legacy service answers `/me/quests/daily` with. */
const FIXED_QUEST_KEYS = [
  'quest_id',
  'id',
  'title',
  'title_th',
  'description',
  'description_th',
  'quest_period',
  'recurrence_type',
  'quest_type',
  'metric_type',
  'grade_level',
  'skill_code',
  'progress_current',
  'progress_total',
  'progress_target',
  'progress_percent',
  'exp_reward',
  'xp_reward',
  'coin_reward',
  'score_reward',
  'status',
  'child_status',
  'can_claim_reward',
  'claimed_at',
  'reset_at',
  'estimated_minutes',
  'lesson_id',
  'quiz_id',
]

/**
 * Make sure the test fixtures exist.
 *
 * The rows are created with the ids the suite uses, so a second run
 * overwrites them instead of piling up.
 */
async function ensureFixtures(): Promise<void> {
  await client.query(
    `INSERT INTO users (id, email, password_hash, role, plan, is_active, created_at, updated_at)
     VALUES ($1, $2, 'pbkdf2_sha256$00$unused', 'parent', 'free', true, now(), now())
     ON CONFLICT (id) DO UPDATE SET is_active = true, updated_at = now()`,
    [USER_ID, USER_EMAIL],
  )
  await client.query(
    `INSERT INTO child_profiles (
       id, parent_user_id, nickname, grade_level, avatar_config, program_type,
       membership_status, total_score, total_xp, coins, current_level,
       current_rank_title, created_at, updated_at
     ) VALUES ($1, $2, 'ผู้ทดสอบเควส', 3, '{}'::jsonb, 'THP', 'free', 0, 0, 0, 1,
               'เด็กหลังห้อง', now(), now())
     ON CONFLICT (id) DO NOTHING`,
    [CHILD_ID, USER_ID],
  )
}

/**
 * Reset the fixtures to their initial state.
 *
 * The XP and score of the child are counters the quest endpoints move, so
 * they are restored before every test.
 */
async function resetFixtures(): Promise<void> {
  await clearQuestRows()
  await ensureFixtures()
  await client.query(
    `UPDATE child_profiles
        SET total_xp = 0, total_score = 0, coins = 0, current_level = 1,
            current_rank_title = 'เด็กหลังห้อง', updated_at = now()
      WHERE id = $1`,
    [CHILD_ID],
  )
}

/**
 * Issue a request against the app with the test environment bindings.
 *
 * The fixtures are only created — never reset — so the counters the quest
 * endpoints move survive across the requests of a test.
 */
async function request(path: string, init: RequestInit = {}): Promise<Response> {
  await ensureFixtures()
  return Promise.resolve(app.request(path, init, BINDINGS))
}

/**
 * Issue a request without touching the fixtures.
 *
 * Used by the test that needs a missing student profile.
 */
async function rawRequest(path: string, init: RequestInit = {}): Promise<Response> {
  return Promise.resolve(app.request(path, init, BINDINGS))
}

/**
 * Issue an authenticated request.
 *
 * The integration suites share one database, and `tests/api.test.ts` clears
 * the user and child tables when it boots. A request that races with that
 * cleanup sees a missing account, so it is retried once with fresh
 * fixtures.
 *
 * @param path the request path.
 * @param init the request options.
 */
async function authRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const first = await request(path, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
  })
  if (first.status !== 401 && first.status !== 404) {
    return first
  }
  const detail = ((await first.clone().json().catch(() => ({}))) as { detail?: string }).detail
  if (detail !== 'Not authenticated' && detail !== 'ไม่พบโปรไฟล์นักเรียน') {
    return first
  }
  return request(path, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
  })
}

/** Remove the quest rows of the test child. */
async function clearQuestRows(): Promise<void> {
  await client.query('DELETE FROM child_quests WHERE child_profile_id = $1', [CHILD_ID])
  await client.query('DELETE FROM xp_events WHERE child_profile_id = $1', [CHILD_ID])
  await client.query('DELETE FROM student_stats WHERE child_profile_id = $1', [CHILD_ID])
  await client.query('DELETE FROM check_in_events WHERE child_profile_id = $1', [CHILD_ID])
  await client.query('DELETE FROM lesson_activity WHERE child_profile_id = $1', [CHILD_ID])
  await client.query('DELETE FROM test_results WHERE child_profile_id = $1', [CHILD_ID])
}

/** Record one check-in inside the current period window. */
async function checkIn(): Promise<void> {
  await client.query(
    `INSERT INTO check_in_events (id, child_profile_id, event_date, period_day, created_at)
     VALUES ($1, $2, (now() AT TIME ZONE 'Asia/Bangkok')::date,
             to_char((now() AT TIME ZONE 'Asia/Bangkok'), 'YYYY-MM-DD'), now())`,
    [crypto.randomUUID(), CHILD_ID],
  )
}

beforeAll(async () => {
  client = new Client({ connectionString: DATABASE_URL })
  await client.connect()
  sql = createTestSql(client)
  app = createTestApp(sql)

  await ensureFixtures()
  token = await createAccessToken(USER_ID, 'parent', JWT_SECRET, 3600)
})

afterAll(async () => {
  await clearQuestRows()
  await client?.query('DELETE FROM child_profiles WHERE id = $1', [CHILD_ID])
  await client?.query('DELETE FROM users WHERE id = $1', [USER_ID])
  await client?.end()
})

beforeEach(async () => {
  await resetFixtures()
})

describe('/me/quests catalogue', () => {
  it('answers /me/quests/daily with the three fixed daily quests', async () => {
    const response = await authRequest('/me/quests/daily')
    expect(response.status).toBe(200)

    const body = (await response.json()) as Array<Record<string, unknown>>
    expect(body).toHaveLength(3)
    expect(body.map((quest) => quest['quest_id'])).toEqual([
      'daily-check-in',
      'daily-lesson',
      'daily-test-50',
    ])
    expect(Object.keys(body[0] as Record<string, unknown>)).toEqual(FIXED_QUEST_KEYS)
  })

  it('renders the daily payload exactly like the legacy service', async () => {
    const response = await authRequest('/me/quests/daily')
    const body = (await response.json()) as Array<Record<string, unknown>>
    const checkIn = body[0] as Record<string, unknown>

    expect(checkIn).toEqual({
      quest_id: 'daily-check-in',
      id: 'daily-check-in',
      title: 'เช็กชื่อในระบบ',
      title_th: 'เช็กชื่อในระบบ',
      description: 'เข้าใช้งานระบบวันนี้',
      description_th: 'เข้าใช้งานระบบวันนี้',
      quest_period: 'daily',
      recurrence_type: 'daily',
      quest_type: 'check_in',
      metric_type: 'check_in',
      grade_level: 3,
      skill_code: null,
      progress_current: 0,
      progress_total: 1,
      progress_target: 1,
      progress_percent: 0,
      exp_reward: 1,
      xp_reward: 1,
      coin_reward: 0,
      score_reward: 0,
      status: 'active',
      child_status: 'active',
      can_claim_reward: false,
      claimed_at: null,
      reset_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+07:00$/),
      estimated_minutes: null,
      lesson_id: null,
      quiz_id: null,
    })
  })

  it('renders progress_percent as a float, the way Pydantic does', async () => {
    const response = await authRequest('/me/quests/daily')
    const text = await response.text()
    expect(text).toContain('"progress_percent":0.0')
  })

  it('answers /me/quests/weekly with the eleven fixed weekly quests', async () => {
    const response = await authRequest('/me/quests/weekly')
    expect(response.status).toBe(200)

    const body = (await response.json()) as Array<Record<string, unknown>>
    expect(body).toHaveLength(11)
    expect(body[0]?.['quest_id']).toBe('weekly-check-in-2')
    expect(body[0]?.['quest_period']).toBe('weekly')
    expect(body[0]?.['progress_total']).toBe(2)
    expect(body[0]?.['xp_reward']).toBe(3)
  })

  it('answers /me/quests/monthly with the nine fixed monthly quests', async () => {
    const response = await authRequest('/me/quests/monthly')
    expect(response.status).toBe(200)

    const body = (await response.json()) as Array<Record<string, unknown>>
    expect(body).toHaveLength(9)
    expect(body[0]?.['quest_id']).toBe('monthly-check-in-10')
    expect(body[0]?.['quest_period']).toBe('monthly')
    expect(body[0]?.['progress_total']).toBe(10)
    expect(body[0]?.['xp_reward']).toBe(7)
  })

  it('counts the actions of the current period as progress', async () => {
    await checkIn()
    const response = await authRequest('/me/quests/daily')
    const body = (await response.json()) as Array<Record<string, unknown>>

    const checkInQuest = body[0] as Record<string, unknown>
    expect(checkInQuest['progress_current']).toBe(1)
    expect(checkInQuest['progress_percent']).toBe(100)
    expect(checkInQuest['status']).toBe('claimable')
    expect(checkInQuest['can_claim_reward']).toBe(true)

    // The other daily quests are still untouched.
    expect(body[1]?.['progress_current']).toBe(0)
    expect(body[1]?.['status']).toBe('active')
  })

  it('upserts the learning_quests template of every fixed quest', async () => {
    await authRequest('/me/quests/daily')

    const rows = await client.query(
      `SELECT quest_id, grade_level, quest_type, recurrence_type, xp_reward, coin_reward,
              estimated_minutes, status, skill_code, lesson_id, quiz_id, metadata
         FROM learning_quests WHERE quest_id = 'daily-check-in'`,
    )
    expect(rows.rows).toHaveLength(1)

    const row = rows.rows[0] as Record<string, unknown>
    expect(row['quest_id']).toBe('daily-check-in')
    expect(row['grade_level']).toBe(3)
    expect(row['quest_type']).toBe('check_in')
    expect(row['recurrence_type']).toBe('daily')
    expect(row['xp_reward']).toBe(1)
    expect(row['coin_reward']).toBe(0)
    expect(row['estimated_minutes']).toBeNull()
    expect(row['status']).toBe('active')
    expect(row['skill_code']).toBeNull()
    expect(row['lesson_id']).toBeNull()
    expect(row['quiz_id']).toBeNull()
    expect(row['metadata']).toEqual({
      metric_type: 'check_in',
      target_count: 1,
      score_reward: 0,
      fixed: true,
    })
  })

  it('requires a token', async () => {
    const response = await request('/me/quests/daily')
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ detail: 'Not authenticated' })
  })
})

describe('/me/quests actions', () => {
  it('starts a quest and marks the child row as in progress', async () => {
    const response = await authRequest('/me/quests/daily-check-in/start', { method: 'POST' })
    expect(response.status).toBe(200)

    const body = (await response.json()) as {
      quest: Record<string, unknown>
      total_xp: number
      total_score: number
      coins: number
      current_level: number
    }
    expect(body.quest['quest_id']).toBe('daily-check-in')
    expect(body.quest['status']).toBe('available')
    expect(body.quest['child_status']).toBe('in_progress')
    expect(body.quest['title_th']).toBe(body.quest['title'])
    expect(body.quest['description_th']).toBe(body.quest['description'])
    expect(body.total_xp).toBe(0)
    expect(body.total_score).toBe(0)
    expect(body.coins).toBe(0)
    expect(body.current_level).toBe(1)

    const rows = await client.query(
      'SELECT status, recurrence_type, period_key FROM child_quests WHERE child_profile_id = $1',
      [CHILD_ID],
    )
    expect(rows.rows[0]?.['status']).toBe('in_progress')
    expect(rows.rows[0]?.['recurrence_type']).toBe('daily')
    expect(rows.rows[0]?.['period_key']).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('completes a quest and awards its XP', async () => {
    const response = await authRequest('/me/quests/daily-check-in/complete', { method: 'POST' })
    expect(response.status).toBe(200)

    const body = (await response.json()) as {
      quest: Record<string, unknown>
      total_xp: number
      total_score: number
    }
    expect(body.quest['status']).toBe('completed')
    expect(body.quest['child_status']).toBe('completed')
    expect(body.quest['progress_current']).toBe(1)
    expect(body.quest['progress_total']).toBe(1)
    expect(body.quest['progress_percent']).toBe(100)
    expect(body.quest['can_claim_reward']).toBe(false)
    expect(body.total_xp).toBe(1)
    expect(body.total_score).toBe(0)

    const events = await client.query(
      `SELECT source_type, source_id, xp_amount FROM xp_events WHERE child_profile_id = $1`,
      [CHILD_ID],
    )
    expect(events.rows).toHaveLength(1)
    expect(events.rows[0]?.['source_type']).toBe('quest_complete')
    expect(events.rows[0]?.['source_id']).toBe('daily-check-in')
    expect(events.rows[0]?.['xp_amount']).toBe(1)

    const stats = await client.query(
      'SELECT quests_completed FROM student_stats WHERE child_profile_id = $1',
      [CHILD_ID],
    )
    expect(stats.rows[0]?.['quests_completed']).toBe(1)
  })

  it('does not award the XP of a completed quest twice', async () => {
    await authRequest('/me/quests/daily-check-in/complete', { method: 'POST' })
    const response = await authRequest('/me/quests/daily-check-in/complete', { method: 'POST' })
    expect(response.status).toBe(200)

    const body = (await response.json()) as { total_xp: number }
    expect(body.total_xp).toBe(1)

    const events = await client.query(
      'SELECT count(*)::int AS n FROM xp_events WHERE child_profile_id = $1',
      [CHILD_ID],
    )
    expect(events.rows[0]?.['n']).toBe(1)
  })

  it('claims the reward of a finished quest', async () => {
    await checkIn()
    const response = await authRequest('/me/quests/daily-check-in/claim', { method: 'POST' })
    expect(response.status).toBe(200)

    const body = (await response.json()) as {
      quest_id: string
      status: string
      exp_awarded: number
      xp_awarded: number
      updated_status: Record<string, unknown>
    }
    expect(body.quest_id).toBe('daily-check-in')
    expect(body.status).toBe('claimed')
    expect(body.exp_awarded).toBe(1)
    expect(body.xp_awarded).toBe(1)
    expect(body.updated_status['total_xp']).toBe(1)
    expect(body.updated_status['level']).toBe(1)
    expect(body.updated_status['rank_title']).toBe('เด็กหลังห้อง')
    expect(body.updated_status['coins']).toBe(0)
    expect(body.updated_status['total_score']).toBe(0)

    const events = await client.query(
      `SELECT source_type, source_id, xp_amount FROM xp_events WHERE child_profile_id = $1`,
      [CHILD_ID],
    )
    expect(events.rows[0]?.['source_type']).toBe('quest_claim')
    expect(events.rows[0]?.['source_id']).toBe('daily-check-in')
  })

  it('refuses to claim a quest that is not finished yet', async () => {
    const response = await authRequest('/me/quests/daily-check-in/claim', { method: 'POST' })
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ detail: 'ยังทำเควสไม่สำเร็จ' })
  })

  it('refuses to claim the same reward twice', async () => {
    await checkIn()
    const first = await authRequest('/me/quests/daily-check-in/claim', { method: 'POST' })
    expect(first.status).toBe(200)

    const second = await authRequest('/me/quests/daily-check-in/claim', { method: 'POST' })
    expect(second.status).toBe(409)
    expect(await second.json()).toEqual({ detail: 'รับรางวัลเควสนี้แล้ว' })
  })

  it('marks a claimed quest as claimed in the catalogue', async () => {
    await checkIn()
    await authRequest('/me/quests/daily-check-in/claim', { method: 'POST' })

    const response = await authRequest('/me/quests/daily')
    const body = (await response.json()) as Array<Record<string, unknown>>
    const checkInQuest = body[0] as Record<string, unknown>

    expect(checkInQuest['status']).toBe('claimed')
    expect(checkInQuest['child_status']).toBe('claimed')
    expect(checkInQuest['can_claim_reward']).toBe(false)
    expect(checkInQuest['claimed_at']).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?\+00:00$/)
  })

  it('answers 404 for an unknown quest', async () => {
    const started = await authRequest('/me/quests/does-not-exist/start', { method: 'POST' })
    expect(started.status).toBe(404)
    expect(await started.json()).toEqual({ detail: 'Quest not found' })

    const completed = await authRequest('/me/quests/does-not-exist/complete', { method: 'POST' })
    expect(completed.status).toBe(404)

    const claimed = await authRequest('/me/quests/does-not-exist/claim', { method: 'POST' })
    expect(claimed.status).toBe(404)
    expect(await claimed.json()).toEqual({ detail: 'ไม่พบเควสนี้' })
  })

  it('answers 404 when the parent has no student profile', async () => {
    await client.query('DELETE FROM child_profiles WHERE id = $1', [CHILD_ID])
    const response = await rawRequest('/me/quests/daily', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ detail: 'ไม่พบโปรไฟล์นักเรียน' })
  })
})
