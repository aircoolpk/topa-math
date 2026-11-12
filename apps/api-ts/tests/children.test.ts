/**
 * Integration tests for the child quest, placement and avatar endpoints.
 *
 * The real handlers run against the Neon test branch (`.env.test`), so the
 * SQL, the response shapes and the FastAPI compatibility layer are all
 * exercised together.
 *
 * The fixtures are created per test and removed afterwards, so the file can
 * run next to the other integration suites without leaving rows behind.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { Client } from 'pg'
import { Hono } from 'hono'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { getDbFromEnv } from '../src/lib/db'
import { getEnv, type Bindings } from '../src/lib/env'
import { cors, toErrorResponse, type AppEnv } from '../src/lib/http'
import { authRoutes } from '../src/routes/auth'
import { childrenRoutes } from '../src/routes/children'
import { createTestSql, type TestSql } from './helpers/testSql'
import { withVerifiedSsl } from './helpers/connection'

const HERE = dirname(fileURLToPath(import.meta.url))
const PACKAGE_ROOT = join(HERE, '..')

/**
 * Connection string for the test database.
 *
 * `scripts/setup-test-db.mjs` provisions the role, the database and the
 * password helpers, so run it once before `npm test`.
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
}

let client: Client
let sql: TestSql
let app: Hono<AppEnv>

/**
 * Build the application the way `src/index.ts` does.
 *
 * The suite mounts the routes it needs itself, so it stays independent of
 * the other route modules — the child endpoints are the subject here, not
 * the whole surface of the Worker.
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
  instance.route('/children', childrenRoutes)

  return instance
}

/** The account the requests are made with. */
let userId: string
let userEmail: string
const userPassword = 'children-test-password'

/** The child the quests belong to. */
let childId: string

/**
 * The access token of the test account.
 *
 * The token is refreshed before every test, because the other integration
 * suite empties the `users` table when it starts — a token whose user is
 * gone is rejected with 401.
 */
let token: string

/** Set while the fixtures are restored, to avoid retrying in a loop. */
let restoring = false

/** The grade level of the test child. */
const GRADE = 3

/** The ids of the seeded quest rows, keyed by their quest id. */
const QUEST_IDS = {
  daily: 'children-test-daily-check-in',
  weekly: 'children-test-weekly-lesson',
  monthly: 'children-test-monthly-friend',
  none: 'children-test-weak-skill',
} as const

/** The ids of the seeded quest rows, keyed by their quest id. */
const QUEST_ROW_IDS: Record<string, string> = {
  [QUEST_IDS.daily]: 'children-test-quest-daily',
  [QUEST_IDS.weekly]: 'children-test-quest-weekly',
  [QUEST_IDS.monthly]: 'children-test-quest-monthly',
  [QUEST_IDS.none]: 'children-test-quest-none',
}

/** The ids of the seeded question rows. */
const QUESTION_IDS: string[] = []

/** The id of the seeded math subject. */
const SUBJECT_ID = 'children-test-subject-math'

/**
 * Install the password helpers, unless the database already has them.
 *
 * The helpers are needed to log in; `scripts/pbkdf2.sql` drops and recreates
 * them, so it only runs when they are missing.
 */
async function ensurePasswordHelpers(): Promise<void> {
  const probe = await client.query<{ present: boolean }>(
    `SELECT to_regprocedure('topa_hash_password(text)') IS NOT NULL AS present`,
  )
  if (probe.rows[0]?.present) {
    return
  }
  await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto')
  const pbkdf2Sql = readFileSync(join(PACKAGE_ROOT, 'scripts', 'pbkdf2.sql'), 'utf-8')
  await client.query(pbkdf2Sql)
}

/**
 * Create the rows the endpoints need.
 *
 * The fixtures are written with fixed ids so a second run overwrites them
 * instead of piling up duplicates.
 */
async function seedFixtures(): Promise<void> {
  await client.query(
    `INSERT INTO subjects (id, code, name) VALUES ($1, 'math', 'คณิตศาสตร์')
     ON CONFLICT (id) DO NOTHING`,
    [SUBJECT_ID],
  )

  // The quests the endpoints read. The metadata carries the target and the
  // score reward, exactly like the seeded catalogue of the legacy service.
  const quests = [
    {
      questId: QUEST_IDS.daily,
      title: 'เช็กชื่อในระบบ',
      description: 'เข้าใช้งานระบบวันนี้',
      questType: 'check_in',
      recurrence: 'daily',
      xp: 5,
      coin: 1,
      minutes: 3,
      metadata: { action_type: 'check_in', score_reward: 7, target_count: 2 },
    },
    {
      questId: QUEST_IDS.weekly,
      title: 'เรียนบทเรียน',
      description: 'เรียนบทเรียนให้ครบ 3 เรื่อง',
      questType: 'lesson_complete',
      recurrence: 'weekly',
      xp: 10,
      coin: 2,
      minutes: 8,
      metadata: { action_type: 'lesson_complete', score_reward: 10, target_count: 3 },
    },
    {
      questId: QUEST_IDS.monthly,
      title: 'เพิ่มเพื่อน',
      description: 'เพิ่มเพื่อนเพื่อทำภารกิจนี้',
      questType: 'friend',
      recurrence: 'monthly',
      xp: 20,
      coin: 4,
      minutes: 5,
      metadata: { action_type: 'friend', score_reward: 20, target_count: 10 },
    },
    {
      questId: QUEST_IDS.none,
      title: 'ฝึกทักษะที่อ่อน',
      description: 'ฝึกทักษะที่อ่อนเพิ่มเติม',
      questType: 'weak_skill',
      recurrence: 'none',
      xp: 12,
      coin: 3,
      minutes: 6,
      metadata: { action_type: 'weak_skill', score_reward: 12, target_count: 1 },
    },
  ]

  for (const quest of quests) {
    const rowId = QUEST_ROW_IDS[quest.questId] as string
    await client.query(
      `INSERT INTO learning_quests (
         id, quest_id, grade_level, skill_code, title, description, quest_type,
         recurrence_type, xp_reward, coin_reward, estimated_minutes, status,
         lesson_id, quiz_id, metadata, created_at, updated_at
       ) VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, $8, $9, $10, 'active', NULL, NULL, $11::jsonb, now(), now())
       ON CONFLICT (id) DO UPDATE SET
         quest_id = EXCLUDED.quest_id,
         grade_level = EXCLUDED.grade_level,
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         quest_type = EXCLUDED.quest_type,
         recurrence_type = EXCLUDED.recurrence_type,
         xp_reward = EXCLUDED.xp_reward,
         coin_reward = EXCLUDED.coin_reward,
         estimated_minutes = EXCLUDED.estimated_minutes,
         metadata = EXCLUDED.metadata`,
      [
        rowId,
        quest.questId,
        GRADE,
        quest.title,
        quest.description,
        quest.questType,
        quest.recurrence,
        quest.xp,
        quest.coin,
        quest.minutes,
        JSON.stringify(quest.metadata),
      ],
    )
  }

  // The questions the placement test picks from.
  for (let index = 0; index < 6; index += 1) {
    const id = `children-test-question-${index}`
    QUESTION_IDS.push(id)
    await client.query(
      `INSERT INTO questions (
         id, skill_id, grade_level, question_type, difficulty, question_text,
         choices, correct_answer, explanation, hint, source, status, metadata, created_at
       ) VALUES ($1, $2, $3, 'multiple_choice', $4, $5, $6::jsonb, 'A', 'คำอธิบาย', 'คำใบ้', 'human', 'approved', $7::jsonb, now())
       ON CONFLICT (id) DO UPDATE SET status = 'approved'`,
      [
        id,
        `children-test-skill-${index % 2}`,
        GRADE,
        index % 3 === 0 ? 'hard' : 'easy',
        `ข้อที่ ${index + 1}: 1 + 1 = ?`,
        JSON.stringify(['1', '2', '3', '4']),
        JSON.stringify({ routine_level: index % 3 === 0 ? 'non_routine' : 'routine' }),
      ],
    )
  }
}

/** Remove every row this file created. */
async function cleanFixtures(): Promise<void> {
  await client.query('DELETE FROM xp_events WHERE child_profile_id = $1', [childId])
  await client.query('DELETE FROM child_quests WHERE child_profile_id = $1', [childId])
  await client.query('DELETE FROM quiz_sessions WHERE child_profile_id = $1', [childId])
  await client.query('DELETE FROM child_profiles WHERE id = $1', [childId])
  await client.query('DELETE FROM users WHERE id = $1', [userId])
  await client.query('DELETE FROM learning_quests WHERE quest_id LIKE $1', ['children-test-%'])
  await client.query('DELETE FROM questions WHERE id LIKE $1', ['children-test-%'])
  await client.query('DELETE FROM subjects WHERE id = $1', [SUBJECT_ID])
}

beforeAll(async () => {
  client = new Client({ connectionString: DATABASE_URL })
  await client.connect()

  await ensurePasswordHelpers()

  sql = createTestSql(client)
  app = createTestApp(sql)

  userId = crypto.randomUUID()
  userEmail = `children-${Date.now()}@example.com`
  childId = crypto.randomUUID()

  await seedFixtures()
  await createAccount()

  const registered = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: userEmail, password: userPassword }),
  })
  if (registered.status !== 200) {
    throw new Error(`Login failed with HTTP ${registered.status}`)
  }
  token = ((await registered.json()) as { access_token: string }).access_token

  await restoreAccountAndChild()
})

afterAll(async () => {
  if (childId) {
    await cleanFixtures()
  }
  await client?.end()
})

/**
 * Make sure the account exists.
 *
 * The hash is written by the database helper, so the FastAPI service can
 * verify the very same credentials.
 */
async function createAccount(): Promise<void> {
  await client.query(
    `INSERT INTO users (id, email, password_hash, role, plan, is_active, created_at, updated_at)
     VALUES ($1, $2, topa_hash_password($3), 'parent', 'free', true, now(), now())
     ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, is_active = true`,
    [userId, userEmail, userPassword],
  )
}

/**
 * Make sure the account and its child profile exist.
 *
 * The suites share one database, and the other integration suite empties
 * `users` and `child_profiles` when it starts. The rows are therefore
 * restored before every test, which keeps this suite independent of the
 * order the files run in. The token stays valid, because it carries the
 * user id and the account is recreated with the same id.
 */
async function restoreAccountAndChild(): Promise<void> {
  await createAccount()

  // The profile keeps its id, so a request that is repeated after another
  // suite wiped the tables still addresses the same child.
  await client.query(
    `INSERT INTO child_profiles (
       id, parent_user_id, nickname, grade_level, avatar_config, program_type,
       membership_status, total_xp, coins, total_score, current_level, created_at, updated_at
     ) VALUES ($1, $2, 'น้องทดสอบ', $3, '{}'::jsonb, 'THP', 'free', 0, 0, 0, 1, now(), now())
     ON CONFLICT (id) DO UPDATE SET
       nickname = EXCLUDED.nickname,
       grade_level = EXCLUDED.grade_level,
       parent_user_id = EXCLUDED.parent_user_id`,
    [childId, userId, GRADE],
  )
}

beforeEach(async () => {
  // The other integration suite empties the shared tables when it starts, so
  // the fixtures are recreated before every test.
  await seedFixtures()
  await restoreAccountAndChild()

  // The endpoints create rows and award rewards; the next test starts from
  // a clean slate.
  await client.query('DELETE FROM xp_events WHERE child_profile_id = $1', [childId])
  await client.query('DELETE FROM child_quests WHERE child_profile_id = $1', [childId])
  await client.query('DELETE FROM quiz_sessions WHERE child_profile_id = $1', [childId])
  await client.query(
    `UPDATE child_profiles
        SET total_xp = 0, coins = 0, total_score = 0, current_level = 1, updated_at = now()
      WHERE id = $1`,
    [childId],
  )
})

/**
 * The quest id of the first daily quest of the grade level.
 *
 * The database is shared with the other suites, so the expectation is
 * derived from the rows that are actually there.
 */
async function firstDailyQuestId(): Promise<string> {
  const rows = await client.query<{ quest_id: string }>(
    `SELECT quest_id FROM learning_quests
      WHERE grade_level = $1 AND status = 'active' AND recurrence_type = 'daily'
      ORDER BY quest_id ASC LIMIT 1`,
    [GRADE],
  )
  return rows.rows[0]?.quest_id ?? ''
}

/** The quest id of the second daily quest of the grade level. */
async function secondDailyQuestId(): Promise<string> {
  const rows = await client.query<{ quest_id: string }>(
    `SELECT quest_id FROM learning_quests
      WHERE grade_level = $1 AND status = 'active' AND recurrence_type = 'daily'
      ORDER BY quest_id ASC LIMIT 1 OFFSET 1`,
    [GRADE],
  )
  return rows.rows[0]?.quest_id ?? ''
}

/**
 * Issue a request against the app with the test environment bindings.
 *
 * The suites share one database, and another suite empties the `users` and
 * `child_profiles` tables when it starts. A request that lands in that
 * window is answered with `401 User not found`, so the fixtures are
 * restored and the request is repeated once.
 */
async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const response = await Promise.resolve(app.request(path, init, BINDINGS))
  if (response.status !== 401 || restoring) {
    return response
  }

  const body = (await response.clone().json().catch(() => null)) as { detail?: string } | null
  if (body?.detail !== 'User not found') {
    return response
  }

  restoring = true
  try {
    await restoreAccountAndChild()
  } finally {
    restoring = false
  }
  return Promise.resolve(app.request(path, init, BINDINGS))
}

/** The headers of an authenticated request. */
function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

/** A quest payload as the endpoints return it. */
interface QuestPayload {
  id: string
  quest_id: string
  grade_level: number
  skill_code: string | null
  title: string
  title_th: string | null
  description: string | null
  description_th: string | null
  quest_type: string
  recurrence_type: string
  xp_reward: number
  coin_reward: number
  estimated_minutes: number | null
  status: string
  lesson_id: string | null
  quiz_id: string | null
  child_status: string
  progress_current: number
  progress_target: number
  progress_total: number
  progress_percent: number
  score_reward: number
  can_claim_reward: boolean
}

/** The payload of the start / complete endpoints. */
interface QuestActionPayload {
  quest: QuestPayload
  total_xp: number
  total_score: number
  coins: number
  current_level: number
}

describe('child quests', () => {
  it('lists the quests of the grade level', async () => {
    const response = await request(`/children/${childId}/quests`, { headers: authHeaders(token) })
    expect(response.status).toBe(200)

    const body = (await response.json()) as QuestPayload[]
    expect(body.length).toBeGreaterThanOrEqual(4)

    const daily = body.find((quest) => quest.quest_id === QUEST_IDS.daily)
    expect(daily).toBeDefined()
    expect(daily?.grade_level).toBe(GRADE)
    expect(daily?.title).toBe('เช็กชื่อในระบบ')
    expect(daily?.quest_type).toBe('check_in')
    expect(daily?.recurrence_type).toBe('daily')
    expect(daily?.xp_reward).toBe(5)
    expect(daily?.coin_reward).toBe(1)
    expect(daily?.estimated_minutes).toBe(3)
    expect(daily?.status).toBe('active')
    expect(daily?.skill_code).toBeNull()
    expect(daily?.lesson_id).toBeNull()
    expect(daily?.quiz_id).toBeNull()
    // The child-scoped endpoint leaves the Thai aliases empty and keeps the
    // raw status of the catalogue row.
    expect(daily?.title_th).toBeNull()
    expect(daily?.description_th).toBeNull()
    expect(daily?.child_status).toBe('not_started')
    expect(daily?.progress_current).toBe(0)
    expect(daily?.progress_target).toBe(2)
    expect(daily?.progress_total).toBe(2)
    expect(daily?.progress_percent).toBe(0)
    expect(daily?.score_reward).toBe(7)
    expect(daily?.can_claim_reward).toBe(false)
  })

  it('renders the fields in the order of the legacy response model', async () => {
    const response = await request(`/children/${childId}/quests`, { headers: authHeaders(token) })
    const body = (await response.json()) as QuestPayload[]
    expect(Object.keys(body[0] ?? {})).toEqual([
      'id',
      'quest_id',
      'grade_level',
      'skill_code',
      'title',
      'title_th',
      'description',
      'description_th',
      'quest_type',
      'recurrence_type',
      'xp_reward',
      'coin_reward',
      'estimated_minutes',
      'status',
      'lesson_id',
      'quiz_id',
      'child_status',
      'progress_current',
      'progress_target',
      'progress_total',
      'progress_percent',
      'score_reward',
      'can_claim_reward',
    ])
  })

  it('filters the quests by recurrence', async () => {
    for (const [path, expected] of [
      ['daily-quests', QUEST_IDS.daily],
      ['weekly-quests', QUEST_IDS.weekly],
      ['monthly-quests', QUEST_IDS.monthly],
    ] as const) {
      const response = await request(`/children/${childId}/${path}`, { headers: authHeaders(token) })
      expect(response.status).toBe(200)
      const body = (await response.json()) as QuestPayload[]
      expect(body.some((quest) => quest.quest_id === expected)).toBe(true)
      expect(body.every((quest) => quest.grade_level === GRADE)).toBe(true)
    }
  })

  it('keeps the recurrence buckets apart', async () => {
    const daily = (await (
      await request(`/children/${childId}/daily-quests`, { headers: authHeaders(token) })
    ).json()) as QuestPayload[]
    expect(daily.every((quest) => quest.recurrence_type === 'daily')).toBe(true)

    const weekly = (await (
      await request(`/children/${childId}/weekly-quests`, { headers: authHeaders(token) })
    ).json()) as QuestPayload[]
    expect(weekly.every((quest) => quest.recurrence_type === 'weekly')).toBe(true)

    const monthly = (await (
      await request(`/children/${childId}/monthly-quests`, { headers: authHeaders(token) })
    ).json()) as QuestPayload[]
    expect(monthly.every((quest) => quest.recurrence_type === 'monthly')).toBe(true)
  })

  it('requires a token', async () => {
    const response = await request(`/children/${childId}/quests`)
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ detail: 'Not authenticated' })
  })

  it('hides the quests of a child of somebody else', async () => {
    const response = await request('/children/00000000-0000-0000-0000-000000000000/quests', {
      headers: authHeaders(token),
    })
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ detail: 'Child not found' })
  })
})

describe('recommended next quest', () => {
  it('recommends a daily quest first', async () => {
    const response = await request(`/children/${childId}/recommended-next-quest`, {
      headers: authHeaders(token),
    })
    expect(response.status).toBe(200)

    const body = (await response.json()) as Record<string, unknown>
    // Daily quests are recommended before the weak-skill and the one-off
    // quests; inside the bucket the quest id decides.
    expect(body.quest_id).toBe(await firstDailyQuestId())
    expect(body.quest_type).toBe('daily')
    expect(body.title).toBe('เช็กชื่อในระบบ')
    expect(body.title_th).toBe('เช็กชื่อในระบบ')
    expect(body.description).toBe('เข้าใช้งานระบบวันนี้')
    expect(body.description_th).toBe('เข้าใช้งานระบบวันนี้')
    expect(body.reason_th).toBe('แนะนำภารกิจที่ยังทำไม่เสร็จสำหรับวันนี้')
    expect(body.grade_level).toBe(GRADE)
    expect(body.xp_reward).toBe(5)
    expect(body.coin_reward).toBe(1)
    expect(body.progress_current).toBe(0)
    expect(body.progress_total).toBe(2)
    expect(body.status).toBe('available')
  })

  it('falls back to the next quest when the daily one is done', async () => {
    await client.query(
      `INSERT INTO child_quests (
         id, child_profile_id, quest_id, recurrence_type, period_key, status,
         progress_current, progress_target, started_at, completed_at,
         xp_awarded, coin_awarded, score_awarded, created_at, updated_at
       ) VALUES ($1, $2, $3, 'daily', NULL, 'completed', 2, 2, now(), now(), 5, 1, 7, now(), now())
       ON CONFLICT (id) DO UPDATE SET status = 'completed'`,
      [crypto.randomUUID(), childId, QUEST_ROW_IDS[QUEST_IDS.daily]],
    )

    const response = await request(`/children/${childId}/recommended-next-quest`, {
      headers: authHeaders(token),
    })
    expect(response.status).toBe(200)

    const body = (await response.json()) as Record<string, unknown>
    // The completed quest is skipped and the next daily quest is recommended.
    expect(body.quest_id).not.toBe(QUEST_IDS.daily)
    expect(body.quest_type).toBe('daily')
    expect(body.quest_id).toBe(await secondDailyQuestId())
  })

  it('reports that everything is done once every quest is completed', async () => {
    const rows = (await client.query<{ id: string }>(
      `SELECT id FROM learning_quests WHERE grade_level = $1 AND status = 'active'`,
      [GRADE],
    )).rows

    for (const row of rows) {
      await client.query(
        `INSERT INTO child_quests (
           id, child_profile_id, quest_id, recurrence_type, period_key, status,
           progress_current, progress_target, started_at, completed_at,
           xp_awarded, coin_awarded, score_awarded, created_at, updated_at
         ) VALUES ($1, $2, $3, 'none', NULL, 'completed', 1, 1, now(), now(), 0, 0, 0, now(), now())
         ON CONFLICT (id) DO UPDATE SET status = 'completed'`,
        [crypto.randomUUID(), childId, row.id],
      )
    }

    const response = await request(`/children/${childId}/recommended-next-quest`, {
      headers: authHeaders(token),
    })
    expect(response.status).toBe(200)

    const body = (await response.json()) as Record<string, unknown>
    expect(body.quest_id).toBeNull()
    expect(body.title).toBe('ยังไม่มีภารกิจแนะนำ')
    expect(body.title_th).toBe('ยังไม่มีภารกิจแนะนำ')
    expect(body.description_th).toBe('ทำได้ดีมาก ลองกลับมาใหม่ภายหลัง')
    expect(body.reason_th).toBe('ภารกิจพร้อมใช้งานถูกทำครบแล้ว')
    expect(body.quest_type).toBe('daily')
    expect(body.progress_current).toBe(0)
    expect(body.progress_total).toBe(1)
    expect(body.status).toBe('completed')
  })
})

describe('quest actions', () => {
  it('starts a quest and records the progress row', async () => {
    const response = await request(
      `/children/${childId}/quests/${QUEST_IDS.daily}/start`,
      { method: 'POST', headers: authHeaders(token) },
    )
    expect(response.status).toBe(200)

    const body = (await response.json()) as QuestActionPayload
    expect(body.quest.quest_id).toBe(QUEST_IDS.daily)
    expect(body.quest.child_status).toBe('in_progress')
    expect(body.quest.progress_current).toBe(0)
    expect(body.quest.progress_target).toBe(2)
    expect(body.total_xp).toBe(0)
    expect(body.total_score).toBe(0)
    expect(body.coins).toBe(0)
    expect(body.current_level).toBe(1)

    const rows = await client.query<{ status: string; progress_target: number }>(
      `SELECT status, progress_target FROM child_quests
       WHERE child_profile_id = $1 AND quest_id = $2`,
      [childId, QUEST_ROW_IDS[QUEST_IDS.daily]],
    )
    expect(rows.rows[0]?.status).toBe('in_progress')
    expect(rows.rows[0]?.progress_target).toBe(2)
  })

  it('completes a quest and awards the rewards', async () => {
    const response = await request(
      `/children/${childId}/quests/${QUEST_IDS.weekly}/complete`,
      { method: 'POST', headers: authHeaders(token) },
    )
    expect(response.status).toBe(200)

    const body = (await response.json()) as QuestActionPayload
    expect(body.quest.quest_id).toBe(QUEST_IDS.weekly)
    expect(body.quest.child_status).toBe('completed')
    expect(body.quest.can_claim_reward).toBe(false)
    // The weekly quest awards 10 XP, 2 coins and a score of 10.
    expect(body.total_xp).toBe(10)
    expect(body.coins).toBe(2)
    expect(body.total_score).toBe(10)
    expect(body.current_level).toBe(1)

    const child = await client.query<{ total_xp: number; coins: number; total_score: number }>(
      `SELECT total_xp, coins, total_score FROM child_profiles WHERE id = $1`,
      [childId],
    )
    expect(child.rows[0]?.total_xp).toBe(10)
    expect(child.rows[0]?.coins).toBe(2)
    expect(child.rows[0]?.total_score).toBe(10)

    const events = await client.query<{ source_type: string; source_id: string; xp_amount: number }>(
      `SELECT source_type, source_id, xp_amount FROM xp_events
       WHERE child_profile_id = $1 AND source_type = 'quest_complete'`,
      [childId],
    )
    expect(events.rows).toHaveLength(1)
    expect(events.rows[0]?.source_id).toBe(QUEST_IDS.weekly)
    expect(events.rows[0]?.xp_amount).toBe(10)
  })

  it('does not award the rewards twice', async () => {
    const first = await request(
      `/children/${childId}/quests/${QUEST_IDS.monthly}/complete`,
      { method: 'POST', headers: authHeaders(token) },
    )
    expect(first.status).toBe(200)
    expect(((await first.json()) as QuestActionPayload).total_xp).toBe(20)

    const second = await request(
      `/children/${childId}/quests/${QUEST_IDS.monthly}/complete`,
      { method: 'POST', headers: authHeaders(token) },
    )
    expect(second.status).toBe(200)
    expect(((await second.json()) as QuestActionPayload).total_xp).toBe(20)

    const events = await client.query(
      `SELECT COUNT(*)::int AS n FROM xp_events
       WHERE child_profile_id = $1 AND source_type = 'quest_complete'`,
      [childId],
    )
    expect(events.rows[0]?.n).toBe(1)
  })

  it('answers 404 for an unknown quest', async () => {
    const response = await request(`/children/${childId}/quests/does-not-exist/start`, {
      method: 'POST',
      headers: authHeaders(token),
    })
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ detail: 'Quest not found' })
  })
})

describe('placement test', () => {
  it('starts a placement session', async () => {
    const response = await request(`/children/${childId}/placement/start`, {
      method: 'POST',
      headers: authHeaders(token),
    })
    expect(response.status).toBe(200)

    const body = (await response.json()) as {
      session_id: string
      questions: Array<Record<string, unknown>>
    }
    expect(typeof body.session_id).toBe('string')
    expect(body.session_id.length).toBeGreaterThan(0)
    expect(body.questions.length).toBeGreaterThan(0)

    const question = body.questions[0]
    expect(Object.keys(question ?? {})).toEqual([
      'id',
      'skill_id',
      'grade_level',
      'question_type',
      'difficulty',
      'question_text',
      'choices',
      'correct_answer',
      'explanation',
      'hint',
    ])
    expect(question?.grade_level).toBe(GRADE)
    expect(Array.isArray(question?.choices)).toBe(true)

    const sessions = await client.query<{ mode: string; total_questions: number }>(
      `SELECT mode, total_questions FROM quiz_sessions WHERE id = $1`,
      [body.session_id],
    )
    expect(sessions.rows[0]?.mode).toBe('placement')
    expect(sessions.rows[0]?.total_questions).toBe(body.questions.length)
  })

  it('answers 404 for a child of somebody else', async () => {
    const response = await request(
      '/children/00000000-0000-0000-0000-000000000000/placement/start',
      { method: 'POST', headers: authHeaders(token) },
    )
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ detail: 'Child not found' })
  })
})

describe('personalized practice', () => {
  it('generates the practice questions', async () => {
    const response = await request(`/children/${childId}/personalized-practice/generate`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        grade_level: GRADE,
        skill_id: 'children-test-skill-0',
        mastery_score: 42,
      }),
    })
    expect(response.status).toBe(200)

    const body = (await response.json()) as {
      lesson_summary: string
      teaching_strategy: string
      questions: Array<Record<string, unknown>>
    }
    expect(body.lesson_summary).toBe('ลองฝึกทีละขั้น แล้วตรวจคำตอบอย่างใจเย็น')
    expect(body.teaching_strategy).toBe('ใช้ตัวอย่างสั้น ๆ และตัวเลขไม่ซับซ้อน')
    expect(body.questions).toHaveLength(10)
    expect(body.questions[0]?.question_text).toBe('ข้อที่ 1: 2 + 1 = ?')
    expect(body.questions[0]?.correct_answer).toBe('3')
    expect(body.questions[0]?.skill_id).toBe('children-test-skill-0')
    expect(body.questions[0]?.difficulty).toBe('easy')
    expect(body.questions[0]?.mistake_type_target).toBe('calculation_error')
  })

  it('rejects a payload that misses the required fields', async () => {
    const response = await request(`/children/${childId}/personalized-practice/generate`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({}),
    })
    expect(response.status).toBe(422)

    const body = (await response.json()) as { detail: Array<Record<string, unknown>> }
    expect(Array.isArray(body.detail)).toBe(true)
    expect(body.detail.map((error) => error.loc)).toEqual([
      ['body', 'grade_level'],
      ['body', 'skill_id'],
      ['body', 'mastery_score'],
    ])
    expect(body.detail[0]?.type).toBe('missing')
    expect(body.detail[0]?.msg).toBe('Field required')
  })

  it('rejects a grade level outside the range', async () => {
    const response = await request(`/children/${childId}/personalized-practice/generate`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ grade_level: 9, skill_id: 's', mastery_score: 10 }),
    })
    expect(response.status).toBe(422)

    const body = (await response.json()) as { detail: Array<Record<string, unknown>> }
    expect(body.detail[0]?.type).toBe('less_than_equal')
    expect(body.detail[0]?.msg).toBe('Input should be less than or equal to 6')
  })
})

describe('child avatar', () => {
  it('returns the avatar of the child', async () => {
    const response = await request(`/children/${childId}/avatar`, { headers: authHeaders(token) })
    expect(response.status).toBe(200)

    const body = (await response.json()) as { avatar_gender: string | null; avatar_config: unknown }
    expect(Object.keys(body)).toEqual(['avatar_gender', 'avatar_config'])
    expect(body.avatar_gender).toBeNull()
    expect(body.avatar_config).toEqual({})
  })

  it('answers 404 for a child of somebody else', async () => {
    const response = await request('/children/00000000-0000-0000-0000-000000000000/avatar', {
      headers: authHeaders(token),
    })
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ detail: 'Child not found' })
  })
})
