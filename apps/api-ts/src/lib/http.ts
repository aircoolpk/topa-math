/**
 * Shared request context helpers: CORS, error handling, and authentication.
 */
import type { Context, MiddlewareHandler } from 'hono'

import { createAccessToken, verifyAccessToken } from './auth'
import { getDbFromEnv, type Sql } from './db'
import { getEnv, type Bindings } from './env'
import { forbidden, HttpError, unauthorized } from './errors'

/** The environment + database context attached to every request. */
export interface AppEnv {
  Bindings: Bindings
  Variables: {
    /** The validated environment. */
    env: ReturnType<typeof getEnv>
    /** The Neon query function. */
    sql: Sql
    /** The authenticated user id, when the request carried valid credentials. */
    userId?: string
    /** The authenticated user's role. */
    userRole?: string
  }
}

/**
 * CORS middleware matching the FastAPI `CORSMiddleware` configuration.
 *
 * Credentials are sent with every request, so the `Origin` header is echoed
 * back verbatim instead of using a wildcard, and `Vary: Origin` is set so
 * caches do not serve one origin's response to another.
 */
export function cors(origins: string[]): MiddlewareHandler<AppEnv> {
  const allowed = new Set(origins)
  return async (c, next) => {
    const origin = c.req.header('Origin')
    if (origin && allowed.has(origin)) {
      c.header('Access-Control-Allow-Origin', origin)
      c.header('Access-Control-Allow-Credentials', 'true')
      c.header('Vary', 'Origin')
    } else if (origin) {
      // An unknown origin gets no CORS headers at all, so the browser blocks
      // the response — same behaviour as Starlette's CORSMiddleware.
      c.header('Vary', 'Origin')
    }

    if (c.req.method === 'OPTIONS') {
      c.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
      c.header('Access-Control-Allow-Headers', 'Content-Type,Authorization')
      c.header('Access-Control-Max-Age', '86400')
      return c.body(null, 204)
    }

    await next()
  }
}

/**
 * Convert an unknown thrown value into a FastAPI-shaped error body.
 *
 * FastAPI answers with `{"detail": ...}`; the frontend reads
 * `error.response.data.detail` and sometimes `detail.code`, so the envelope
 * must match exactly.
 */
export function toErrorResponse(error: unknown): { status: number; body: { detail: unknown } } {
  if (error instanceof HttpError) {
    return { status: error.status, body: { detail: error.detail } }
  }

  if (error instanceof Error && error.name === 'EnvError') {
    return { status: 500, body: { detail: { code: 'INVALID_CONFIGURATION', message: error.message } } }
  }

  if (error instanceof Error && error.name === 'ZodError') {
    return { status: 422, body: { detail: { code: 'VALIDATION_ERROR', message: error.message } } }
  }

  // Never leak internal error details to the client.
  console.error('Unhandled error', error)
  return { status: 500, body: { detail: { code: 'INTERNAL_ERROR', message: 'Internal server error' } } }
}

/**
 * Extract the bearer token or auth cookie from the request.
 *
 * The FastAPI service accepts either an `Authorization: Bearer` header or
 * the auth cookie, so both are honoured here to keep sessions valid across
 * the cutover.
 */
export function readToken(c: Context<AppEnv>): string | null {
  const header = c.req.header('Authorization')
  if (header && header.startsWith('Bearer ')) {
    const token = header.slice(7).trim()
    if (token) {
      return token
    }
  }

  const cookieHeader = c.req.header('Cookie')
  if (!cookieHeader) {
    return null
  }
  const env = c.get('env')
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === env.AUTH_COOKIE_NAME) {
      const value = rest.join('=').trim()
      if (value) {
        return decodeURIComponent(value)
      }
    }
  }
  return null
}

/**
 * Require a valid access token.
 *
 * On success the user id and role are stored on the context.
 */
export function requireAuth(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const token = readToken(c)
    if (!token) {
      throw unauthorized('Not authenticated')
    }
    const payload = await verifyAccessToken(token, c.get('env').JWT_SECRET)
    if (!payload) {
      throw unauthorized('Invalid token')
    }
    c.set('userId', payload.sub)
    c.set('userRole', payload.role)
    await next()
  }
}

/**
 * Require an authenticated user whose account is still active.
 *
 * The FastAPI service raises 403 for a disabled account (as opposed to 401
 * for a missing/invalid token), so the same distinction is kept here.
 */
export async function requireActiveUser(c: Context<AppEnv>): Promise<{ id: string; role: string }> {
  const userId = c.get('userId')
  const role = c.get('userRole') ?? 'parent'
  if (!userId) {
    throw unauthorized('Not authenticated')
  }

  const { sql } = c.get('sql') ? { sql: c.get('sql') } : { sql: getDbFromEnv(c.get('env')).sql }
  const rows = (await sql`
    SELECT id, role, is_active FROM users WHERE id = ${userId} LIMIT 1
  `) as Array<{ id: string; role: string; is_active: boolean }>

  const user = rows[0]
  if (!user) {
    throw unauthorized('User not found')
  }
  if (user.is_active === false) {
    throw forbidden('Account is disabled')
  }
  return { id: user.id, role: user.role }
}

/**
 * Build the `Set-Cookie` value for the auth cookie.
 *
 * @param name cookie name.
 * @param value cookie value.
 * @param options cookie attributes.
 */
export function buildAuthCookie(
  name: string,
  value: string,
  options: { maxAge: number; secure: boolean; sameSite: string; path: string; domain?: string },
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${options.path}`, `Max-Age=${options.maxAge}`]
  if (options.domain) {
    parts.push(`Domain=${options.domain}`)
  }
  if (options.secure) {
    parts.push('Secure')
  }
  parts.push(`SameSite=${options.sameSite}`)
  parts.push('HttpOnly')
  return parts.join('; ')
}

/**
 * Build the `Set-Cookie` value that clears the auth cookie.
 */
export function buildClearAuthCookie(
  name: string,
  options: { secure: boolean; sameSite: string; path: string; domain?: string },
): string {
  const parts = [`${name}=`, `Path=${options.path}`, 'Max-Age=0']
  if (options.domain) {
    parts.push(`Domain=${options.domain}`)
  }
  if (options.secure) {
    parts.push('Secure')
  }
  parts.push(`SameSite=${options.sameSite}`)
  parts.push('HttpOnly')
  return parts.join('; ')
}

/**
 * Issue an access token for a user.
 *
 * @param c the request context.
 * @param userId the user id.
 * @param role the user's role.
 */
export async function issueToken(c: Context<AppEnv>, userId: string, role: string): Promise<string> {
  const env = c.get('env')
  return createAccessToken(userId, role, env.JWT_SECRET, env.ACCESS_TOKEN_EXPIRE_MINUTES * 60)
}
