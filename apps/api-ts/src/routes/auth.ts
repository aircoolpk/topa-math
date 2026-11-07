/**
 * Authentication endpoints: register, login, logout, and the current user.
 *
 * Mirrors `apps/api/app/routers/auth.py`.
 */
import { Hono } from 'hono'

import { hashPassword, verifyPassword } from '../lib/auth'
import { conflict, unauthorized } from '../lib/errors'
import {
  buildAuthCookie,
  buildClearAuthCookie,
  issueToken,
  requireAuth,
  requireActiveUser,
  type AppEnv,
} from '../lib/http'

export const authRoutes = new Hono<AppEnv>()

/** Minimum password length accepted at registration. */
const MIN_PASSWORD_LENGTH = 8

/** Maximum password length accepted (bytes) — keeps hashing bounded. */
const MAX_PASSWORD_LENGTH = 1024

/** Body of `POST /auth/register` and `POST /auth/login`. */
interface CredentialsBody {
  email?: unknown
  password?: unknown
  referral_token?: unknown
}

function readCredentials(body: CredentialsBody): { email: string; password: string; referralToken?: string } {
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const referralToken = typeof body.referral_token === 'string' && body.referral_token ? body.referral_token : undefined

  if (!email || !email.includes('@')) {
    throw unauthorized('Invalid credentials')
  }
  if (!password) {
    throw unauthorized('Invalid credentials')
  }
  return { email, password, referralToken }
}

/** Random identifier used for the `users.id` column. */
function newId(): string {
  return crypto.randomUUID()
}

authRoutes.post('/register', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as CredentialsBody
  const { email, password, referralToken } = readCredentials(body)

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw conflict(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw conflict('Password is too long')
  }

  const env = c.get('env')
  const sql = c.get('sql')

  const existing = (await sql`
    SELECT id FROM users WHERE email = ${email} LIMIT 1
  `) as Array<{ id: string }>
  if (existing.length > 0) {
    throw conflict('Email already registered')
  }

  const userId = newId()
  const passwordHash = await hashPassword(password, undefined, sql)
  const referralTokenValue = referralToken ?? crypto.randomUUID().replace(/-/g, '')

  await sql`
    INSERT INTO users (id, email, password_hash, role, plan, is_active, referral_token, created_at, updated_at)
    VALUES (
      ${userId},
      ${email},
      ${passwordHash},
      'parent',
      'free',
      true,
      ${referralTokenValue},
      now(),
      now()
    )
  `

  const token = await issueToken(c, userId, 'parent')
  c.header(
    'Set-Cookie',
    buildAuthCookie(env.AUTH_COOKIE_NAME, token, {
      maxAge: env.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
      secure: env.AUTH_COOKIE_SECURE,
      sameSite: env.AUTH_COOKIE_SAMESITE,
      path: env.AUTH_COOKIE_PATH,
      domain: env.AUTH_COOKIE_DOMAIN,
    }),
  )

  return c.json({ access_token: token, token_type: 'bearer' })
})

authRoutes.post('/login', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as CredentialsBody
  const { email, password } = readCredentials(body)

  const env = c.get('env')
  const sql = c.get('sql')

  const rows = (await sql`
    SELECT id, password_hash, role, is_active FROM users WHERE email = ${email} LIMIT 1
  `) as Array<{ id: string; password_hash: string; role: string; is_active: boolean }>

  const user = rows[0]
  // The same message for "unknown email" and "wrong password" so the
  // endpoint cannot be used to enumerate accounts.
  if (!user) {
    throw unauthorized('Invalid credentials')
  }

  const valid = await verifyPassword(password, user.password_hash, sql)
  if (!valid) {
    throw unauthorized('Invalid credentials')
  }
  if (user.is_active === false) {
    throw unauthorized('Account is disabled')
  }

  await sql`UPDATE users SET last_login_at = now() WHERE id = ${user.id}`

  const token = await issueToken(c, user.id, user.role)
  c.header(
    'Set-Cookie',
    buildAuthCookie(env.AUTH_COOKIE_NAME, token, {
      maxAge: env.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
      secure: env.AUTH_COOKIE_SECURE,
      sameSite: env.AUTH_COOKIE_SAMESITE,
      path: env.AUTH_COOKIE_PATH,
      domain: env.AUTH_COOKIE_DOMAIN,
    }),
  )

  return c.json({ access_token: token, token_type: 'bearer' })
})

authRoutes.post('/logout', (c) => {
  const env = c.get('env')
  c.header(
    'Set-Cookie',
    buildClearAuthCookie(env.AUTH_COOKIE_NAME, {
      secure: env.AUTH_COOKIE_SECURE,
      sameSite: env.AUTH_COOKIE_SAMESITE,
      path: env.AUTH_COOKIE_PATH,
      domain: env.AUTH_COOKIE_DOMAIN,
    }),
  )
  return c.body(null, 204)
})

authRoutes.get('/me', requireAuth(), async (c) => {
  const user = await requireActiveUser(c)
  const sql = c.get('sql')
  const rows = (await sql`
    SELECT email FROM users WHERE id = ${user.id} LIMIT 1
  `) as Array<{ email: string }>
  return c.json({ id: user.id, email: rows[0]?.email ?? '', role: user.role })
})
