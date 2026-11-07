/**
 * Topa Math API — Cloudflare Workers entry point.
 *
 * Wrangler bundles this file as the Worker (`main = "src/index.ts"` in
 * `wrangler.toml`). The app is a Hono router that mirrors the endpoint
 * surface of the legacy FastAPI service (`apps/api`), so the Next.js
 * frontend can point at either one during the cutover.
 *
 * Operational constraints this design targets:
 *
 *  - **Workers Free allows 10 ms of CPU per request.** Password hashing is
 *    therefore delegated to the database for the legacy 200,000-iteration
 *    hashes (see `src/lib/auth.ts`), and every other endpoint is a small
 *    number of batched queries.
 *  - **50 subrequests per request.** Each endpoint issues as few round
 *    trips as possible; the dashboard uses one batched query.
 *  - **Neon scales to zero after 5 minutes.** Connections are not pooled —
 *    the Neon HTTP driver opens a connection per query.
 */
import { Hono } from 'hono'

import { checkDatabase, getDbFromEnv } from './lib/db'
import { getEnv } from './lib/env'
import { cors, toErrorResponse, type AppEnv } from './lib/http'
import { authRoutes } from './routes/auth'
import { billingRoutes } from './routes/billing'
import { childrenRoutes } from './routes/children'
import { learningRoutes } from './routes/learning'
import { meRoutes } from './routes/me'
import { rankingsRoutes } from './routes/rankings'
import { shareRoutes } from './routes/share'
import { siteRoutes } from './routes/site'

/**
 * Build the Hono application.
 *
 * The `sql` override exists so the integration tests can run the real
 * handlers against a local database instead of Neon.
 *
 * @param overrides optional per-request context overrides.
 */
export function createApp(overrides?: Partial<AppEnv['Variables']>) {
  const app = new Hono<AppEnv>()

  /**
   * Populate the request context.
   *
   * The environment is validated once per isolate (the `getEnv` helper caches
   * on the secret values), and the Neon client is memoised per connection
   * string.
   */
  app.use('*', async (c, next) => {
    const env = getEnv(c.env)
    const { sql } = getDbFromEnv(env)
    c.set('env', env)
    c.set('sql', overrides?.sql ?? sql)
    await next()
  })

  // CORS is applied after the context is populated so it can read the
  // configured origins.
  app.use('*', async (c, next) => {
    const handler = cors(c.get('env').CORS_ORIGINS)
    return handler(c, next)
  })

  /**
   * Convert thrown errors into FastAPI-shaped JSON responses.
   *
   * Hono's default handler would return `{"message": "..."}`, which the
   * frontend does not understand — it reads `detail`.
   */
  app.onError((error, c) => {
    const { status, body } = toErrorResponse(error)
    if (status >= 500) {
      console.error('Request failed', {
        path: new URL(c.req.url).pathname,
        method: c.req.method,
        error,
      })
    }
    return c.json(body, status as 400)
  })

  /** Fallback for unmatched routes — FastAPI answers `{"detail":"Not Found"}`. */
  app.notFound((c) => c.json({ detail: 'Not Found' }, 404))

  /* ───────────────────────────── health ───────────────────────────── */

  app.get('/', (c) => c.json({ status: 'ok', service: 'topa-math-api' }))

  app.get('/health', (c) => c.json({ status: 'ok' }))

  app.get('/health/ready', async (c) => {
    const result = await checkDatabase(c.get('sql'))
    if (!result.ok) {
      return c.json({ detail: { code: 'DATABASE_SCHEMA_NOT_READY' } }, 503)
    }
    return c.json({ status: 'ready' })
  })

  /* ───────────────────────────── routes ───────────────────────────── */

  app.route('/auth', authRoutes)
  app.route('/site', siteRoutes)
  app.route('/rankings', rankingsRoutes)
  app.route('/children', childrenRoutes)
  app.route('/me', meRoutes)
  app.route('/billing', billingRoutes)
  app.route('/share', shareRoutes)
  app.route('/', learningRoutes)

  return app
}

const app = createApp()

export default app
export type { AppEnv }
