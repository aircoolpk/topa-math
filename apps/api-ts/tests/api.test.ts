/**
 * Integration tests for the Topa Math API.
 *
 * The real handlers run against the local Docker Postgres, so the SQL, the
 * password helpers and the response shapes are all exercised together.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createApp } from '../src/index'
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
    return match ? match[1].trim() : undefined
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
let app: ReturnType<typeof createApp>


/** A registered test user. */
let userId: string
let userEmail: string
const userPassword = 'integration-test-password'

beforeAll(async () => {
  client = new Client({ connectionString: DATABASE_URL })
  await client.connect()

  // Install the password helpers the login path relies on.
  //
  // `scripts/pbkdf2.sql` is a multi-statement script, so it runs as one
  // transaction: a single failing statement rolls back the whole install and
  // leaves the database without the helpers. That failure used to surface
  // much later as `TypeError: Cannot read properties of undefined (reading
  // 'split')` on the registration response, so the install is verified here.
  const pbkdf2Sql = readFileSync(join(PACKAGE_ROOT, 'scripts', 'pbkdf2.sql'), 'utf-8')
  await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto')
  await client.query(pbkdf2Sql)

  // Registration hashes with topa_hash_password and login verifies with
  // topa_verify_password. If the two disagree — or either is missing — the
  // registration endpoint answers 500 and the suite dies with a cryptic
  // error. Check the round trip now so the cause is obvious.
  const helpers = await client.query<{ ok: boolean }>(
    `SELECT topa_verify_password('helper-probe', topa_hash_password('helper-probe')) AS ok`,
  )
  if (helpers.rows[0]?.ok !== true) {
    throw new Error(
      'The password helpers in the test database are missing or inconsistent. ' +
        'Run "node scripts/setup-test-db.mjs" to reinstall them.',
    )
  }

  sql = createTestSql(client)
  app = createApp({ sql })

  // A clean slate for the tables these tests touch.
  await client.query('DELETE FROM child_profiles')
  await client.query('DELETE FROM users')
  await client.query('DELETE FROM subjects')
  await client.query('DELETE FROM skills')
  await client.query('DELETE FROM lessons')
  await client.query('DELETE FROM public_shares')

  userEmail = `integration-${Date.now()}@example.com`
  const registered = await request('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: userEmail, password: userPassword }),
  })
  const body = (await registered.json()) as { access_token?: string; detail?: unknown }
  if (!body.access_token) {
    // Without this guard a failed registration surfaced as
    // `Cannot read properties of undefined (reading 'split')` several lines
    // below, which says nothing about the actual cause.
    throw new Error(
      `Registration failed with HTTP ${registered.status}: ${JSON.stringify(body.detail ?? body)}`,
    )
  }
  const payload = JSON.parse(Buffer.from(body.access_token.split('.')[1] as string, 'base64url').toString()) as {
    sub: string
  }
  userId = payload.sub
})

afterAll(async () => {
  await client?.end()
})

/** Issue a request against the app with the test environment bindings. */
function request(path: string, init: RequestInit = {}): Promise<Response> {
  return Promise.resolve(app.request(path, init, BINDINGS))
}

/** Log in and return the access token. */
async function login(email: string, password: string): Promise<string> {
  const response = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const body = (await response.json()) as { access_token: string }
  return body.access_token
}

describe('health', () => {
  it('GET /health returns ok', async () => {
    const response = await request('/health')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })

  it('GET /health/ready confirms the database is reachable', async () => {
    const response = await request('/health/ready')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ready' })
  })
})

describe('CORS', () => {
  it('echoes an allowed origin and allows credentials', async () => {
    const response = await request('/health', { headers: { Origin: 'http://localhost:3000' } })
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:3000')
    expect(response.headers.get('access-control-allow-credentials')).toBe('true')
  })

  it('does not allow an unknown origin', async () => {
    const response = await request('/health', { headers: { Origin: 'https://evil.example' } })
    expect(response.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('answers the preflight request', async () => {
    const response = await request('/health', {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:3000' },
    })
    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-methods')).toContain('POST')
  })
})

describe('error handling', () => {
  it('uses the FastAPI error envelope for unknown routes', async () => {
    const response = await request('/does-not-exist')
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ detail: 'Not Found' })
  })

  it('returns 401 with a detail message when no token is supplied', async () => {
    const response = await request('/children')
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ detail: 'Not authenticated' })
  })

  it('returns 401 for a malformed token', async () => {
    const response = await request('/children', { headers: { Authorization: 'Bearer not-a-token' } })
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ detail: 'Invalid token' })
  })
})

describe('auth', () => {
  it('registers a user and returns an access token', async () => {
    const email = `register-${Date.now()}@example.com`
    const response = await request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'another-test-password' }),
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as { access_token: string; token_type: string }
    expect(body.token_type).toBe('bearer')
    expect(body.access_token.split('.')).toHaveLength(3)
  })

  it('stores the hash in the legacy format so the FastAPI service can verify it', async () => {
    const email = `format-${Date.now()}@example.com`
    await request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'format-test-password' }),
    })
    const rows = await client.query<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE email = $1',
      [email],
    )
    const hash = rows.rows[0]?.password_hash ?? ''
    // pbkdf2_sha256$<hex-salt>$<base64url-digest>
    expect(hash).toMatch(/^pbkdf2_sha256\$[0-9a-f]{32}\$[A-Za-z0-9_+/=-]{44}$/)

    // The FastAPI service's own algorithm must accept the stored hash.
    const verified = await client.query<{ ok: boolean }>(
      'SELECT topa_verify_password($1, $2) AS ok',
      ['format-test-password', hash],
    )
    expect(verified.rows[0]?.ok).toBe(true)
  })

  it('sets the auth cookie', async () => {
    const email = `cookie-${Date.now()}@example.com`
    const response = await request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'cookie-test-password' }),
    })
    const cookie = response.headers.get('set-cookie') ?? ''
    expect(cookie).toContain('access_token=')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=lax')
  })

  it('rejects a duplicate email with 409', async () => {
    const response = await request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail, password: 'duplicate-test-password' }),
    })
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ detail: 'Email already registered' })
  })

  it('rejects a wrong password with 401', async () => {
    const response = await request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail, password: 'wrong-password' }),
    })
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ detail: 'Invalid credentials' })
  })

  it('logs in with the right password', async () => {
    const token = await login(userEmail, userPassword)
    expect(token.split('.')).toHaveLength(3)
  })

  it('returns the current user', async () => {
    const token = await login(userEmail, userPassword)
    const response = await request('/auth/me', { headers: { Authorization: `Bearer ${token}` } })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ id: userId, email: userEmail, role: 'parent' })
  })

  it('clears the cookie on logout', async () => {
    const response = await request('/auth/logout', { method: 'POST' })
    expect(response.status).toBe(204)
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0')
  })

  it('verifies a legacy 200,000-iteration hash created by the FastAPI service', async () => {
    // Build the hash exactly the way the legacy FastAPI service does:
    // `secrets.token_hex(16)` salt, 200,000 rounds, urlsafe-base64 digest.
    const { execFileSync } = await import('node:child_process')
    const pythonScript = `
import base64, hashlib, secrets
salt = secrets.token_hex(16)
digest = hashlib.pbkdf2_hmac("sha256", "legacy-test-password".encode(), salt.encode(), 200000)
print(f"pbkdf2_sha256\${salt}\${base64.urlsafe_b64encode(digest).decode()}")
`
    const legacyHash = execFileSync('python', ['-c', pythonScript], { encoding: 'utf-8' }).trim()

    const email = `legacy-${Date.now()}@example.com`
    await client.query(
      `INSERT INTO users (id, email, password_hash, role, plan, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, 'parent', 'free', true, now(), now())`,
      [crypto.randomUUID(), email, legacyHash],
    )

    const ok = await request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'legacy-test-password' }),
    })
    expect(ok.status).toBe(200)

    const bad = await request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'not-the-password' }),
    })
    expect(bad.status).toBe(401)
  })
})

describe('site content', () => {
  it('serves the homepage configuration', async () => {
    const response = await request('/site/homepage')
    expect(response.status).toBe(200)
    const body = (await response.json()) as Record<string, unknown>
    expect(body).toHaveProperty('hero')
    expect(body).toHaveProperty('features')
    expect(body).toHaveProperty('ranking')
    expect(body).toHaveProperty('published_at')
  })

  it('is not cached', async () => {
    const response = await request('/site/homepage')
    expect(response.headers.get('cache-control')).toBe('no-store, max-age=0')
  })
})

describe('curriculum', () => {
  beforeAll(async () => {
    const subjectId = crypto.randomUUID()
    await client.query('INSERT INTO subjects (id, code, name) VALUES ($1, $2, $3)', [
      subjectId,
      'math',
      'คณิตศาสตร์',
    ])
    const skillId = crypto.randomUUID()
    await client.query(
      `INSERT INTO skills (id, subject_id, grade_level, code, name, prerequisite_skill_ids, difficulty_order, created_at)
       VALUES ($1, $2, $3, $4, $5, '[]'::jsonb, $6, now())`,
      [skillId, subjectId, 3, 'g3_test_skill', 'ทดสอบ', 1],
    )
  })

  it('GET /subjects lists the subjects', async () => {
    const response = await request('/subjects')
    expect(response.status).toBe(200)
    const body = (await response.json()) as Array<{ code: string }>
    expect(body.some((subject) => subject.code === 'math')).toBe(true)
  })

  it('GET /skills filters by subject and grade', async () => {
    const response = await request('/skills?subject=math&grade_level=3')
    expect(response.status).toBe(200)
    const body = (await response.json()) as Array<{ code: string }>
    expect(body.some((skill) => skill.code === 'g3_test_skill')).toBe(true)
  })

  it('GET /skills returns an empty list for an unknown subject', async () => {
    const response = await request('/skills?subject=unknown&grade_level=3')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual([])
  })
})

describe('children', () => {
  let childId: string
  let token: string

  beforeAll(async () => {
    token = await login(userEmail, userPassword)
    const response = await request('/children', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ nickname: 'น้องทดสอบ', grade_level: 3, province: 'กรุงเทพมหานคร' }),
    })
    expect(response.status).toBe(201)
    const body = (await response.json()) as { id: string }
    childId = body.id
  })

  it('lists the children of the authenticated user', async () => {
    const response = await request('/children', { headers: { Authorization: `Bearer ${token}` } })
    expect(response.status).toBe(200)
    const body = (await response.json()) as Array<{ id: string; nickname: string }>
    expect(body).toHaveLength(1)
    expect(body[0]?.id).toBe(childId)
  })

  it('returns a child profile with the frontend field names', async () => {
    const response = await request(`/children/${childId}`, { headers: { Authorization: `Bearer ${token}` } })
    expect(response.status).toBe(200)
    const body = (await response.json()) as Record<string, unknown>
    expect(body.nickname).toBe('น้องทดสอบ')
    expect(body.grade_level).toBe(3)
    expect(body.membership_status).toBe('free')
    expect(body.current_rank_title).toBeDefined()
    expect(body.total_xp).toBe(0)
  })

  it('returns 404 for a child that belongs to somebody else', async () => {
    const response = await request('/children/00000000-0000-0000-0000-000000000000', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ detail: 'Child not found' })
  })

  it('rejects a second child for the same user', async () => {
    const response = await request('/children', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ nickname: 'น้องทดสอบ2', grade_level: 4 }),
    })
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ detail: 'User already has a student profile' })
  })

  it('returns the progress summary', async () => {
    const response = await request(`/children/${childId}/progress`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      total_xp: 0,
      coins: 0,
      current_level: 1,
      streak_count: 0,
    })
  })

  it('returns the rank summary', async () => {
    const response = await request(`/children/${childId}/rank-summary`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as Record<string, unknown>
    expect(body.rank_title).toBe('เด็กหลังห้อง')
    expect(body.next_rank).toBe('เด็กนักเรียน')
    expect(body.level).toBe(1)
  })

  it('returns the badges (empty for a fresh profile)', async () => {
    const response = await request(`/children/${childId}/badges`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual([])
  })

  it('returns the course map', async () => {
    const response = await request(`/children/${childId}/course-map`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as { current_grade: number; items: unknown[] }
    expect(body.current_grade).toBe(3)
    expect(Array.isArray(body.items)).toBe(true)
  })
})

describe('dashboard', () => {
  let token: string

  beforeAll(async () => {
    token = await login(userEmail, userPassword)
  })

  it('returns the dashboard payload', async () => {
    const response = await request('/me/dashboard?program_type=TH', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as Record<string, unknown>
    expect(body.program_type).toBe('TH')
    expect(body.child).not.toBeNull()
    expect(body.status).toBeDefined()
    expect(body.rank_summary).toBeDefined()
    expect(body.lesson_summary).toBeDefined()
    expect(body.quest_summary).toBeDefined()
  })

  it('returns the rank summary', async () => {
    const response = await request('/me/rank-summary', { headers: { Authorization: `Bearer ${token}` } })
    expect(response.status).toBe(200)
    const body = (await response.json()) as Record<string, unknown>
    expect(body.leaderboard_scope).toBe('grade')
    expect(body.rank_title).toBe('เด็กหลังห้อง')
  })
})

describe('rankings', () => {
  let token: string

  beforeAll(async () => {
    token = await login(userEmail, userPassword)
  })

  it('rejects an out-of-range grade level', async () => {
    const response = await request('/rankings?grade_level=99', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(response.status).toBe(400)
  })

  it('rejects an unknown scope', async () => {
    const response = await request('/rankings?grade_level=3&scope=galaxy', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(response.status).toBe(400)
  })

  it('requires a province for scope=province', async () => {
    const response = await request('/rankings?grade_level=3&scope=province', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(response.status).toBe(400)
  })

  it('returns the leaderboard payload', async () => {
    const response = await request('/rankings?grade_level=3&scope=country', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as Record<string, unknown>
    expect(body.scope).toBe('country')
    expect(body.grade_level).toBe(3)
    expect(body.is_mock).toBe(false)
    expect(Array.isArray(body.entries)).toBe(true)
    expect(Array.isArray(body.province_summary)).toBe(true)
  })
})

describe('billing', () => {
  it('returns the price catalogue', async () => {
    const response = await request('/billing/prices')
    expect(response.status).toBe(200)
    const body = (await response.json()) as { plans: Array<{ plan_code: string }>; source: string }
    expect(body.source).toBe('backend')
    expect(body.plans.some((plan) => plan.plan_code === 'free')).toBe(true)
    expect(body.plans.some((plan) => plan.plan_code === 'th_plus_monthly')).toBe(true)
  })

  it('returns the plan catalogue', async () => {
    const response = await request('/billing/plans')
    expect(response.status).toBe(200)
    const body = (await response.json()) as { plans: Array<{ plan_code: string }> }
    expect(body.plans.some((plan) => plan.plan_code === 'free')).toBe(true)
  })
})

describe('share links', () => {
  it('returns 404 for an unknown token', async () => {
    const response = await request('/share/dashboard/unknown-token')
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ detail: 'ไม่พบลิงก์แชร์นี้' })
  })

  it('returns a stored share', async () => {
    const token = `share-${Date.now()}`
    await client.query(
      `INSERT INTO public_shares (id, token, share_type, data, created_at, expires_at)
       VALUES ($1, $2, 'dashboard', $3::jsonb, now(), now() + interval '180 days')`,
      [crypto.randomUUID(), token, JSON.stringify({ display_name: 'น้องทดสอบ' })],
    )
    const response = await request(`/share/dashboard/${token}`)
    expect(response.status).toBe(200)
    const body = (await response.json()) as { token: string; data: { display_name: string } }
    expect(body.token).toBe(token)
    expect(body.data.display_name).toBe('น้องทดสอบ')
  })
})
