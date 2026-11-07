/**
 * Neon Postgres access.
 *
 * The Workers Free plan allows only 50 subrequests per request and Neon
 * scales to zero after 5 minutes of inactivity, so every request should use
 * as few round trips as possible. The Neon HTTP driver is used (not the
 * WebSocket driver) because Workers Free cannot open raw TCP sockets.
 *
 * `neon()` in "array mode" batches several statements into a single HTTP
 * request, which is how the multi-query endpoints stay within the
 * round-trip budget.
 */
import { neon, type NeonQueryFunction } from '@neondatabase/serverless'
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http'

import * as schema from '../db/schema'
import type { Env } from './env'

/** A Drizzle database bound to the Neon HTTP driver. */
export type Database = NeonHttpDatabase<typeof schema>

/**
 * The raw Neon query function (template-tag style).
 *
 * Only the two members the app actually uses are required, which keeps the
 * type honest and lets the tests inject a `pg`-backed adapter.
 */
export interface Sql {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]>
  query(queryWithPlaceholders: string, params?: unknown[]): Promise<unknown[]>
}

/** Everything a request handler needs to talk to the database. */
export interface DbContext {
  /** Drizzle query builder. */
  db: Database
  /** Raw SQL escape hatch for the few queries Drizzle cannot express. */
  sql: Sql
}

const cache = new Map<string, DbContext>()

/**
 * Build (and memoise) the database context for a connection string.
 *
 * The Neon HTTP driver is stateless — each query is an HTTP request — so the
 * client object itself holds no connection state and is safe to share.
 *
 * @param databaseUrl the Neon connection string.
 */
export function getDb(databaseUrl: string): DbContext {
  const cached = cache.get(databaseUrl)
  if (cached) {
    return cached
  }

  const sql = neon<boolean, false>(databaseUrl) as unknown as Sql
  const db = drizzle(sql as never, { schema })
  const context: DbContext = { db, sql }
  cache.set(databaseUrl, context)
  return context
}

/**
 * Build the database context from the validated environment.
 *
 * @param env the validated environment.
 */
export function getDbFromEnv(env: Env): DbContext {
  return getDb(env.DATABASE_URL)
}

/**
 * Run a trivial query to confirm the database is reachable and the schema
 * is present.
 *
 * @param sql the Neon query function.
 */
export async function checkDatabase(sql: Sql): Promise<{ ok: boolean; detail?: string }> {
  try {
    const rows = (await sql`
      SELECT
        to_regclass('public.users') IS NOT NULL AS has_users,
        to_regclass('public.child_profiles') IS NOT NULL AS has_children
    `) as Array<{ has_users: boolean; has_children: boolean }>
    const row = rows[0]
    if (!row?.has_users) {
      return { ok: false, detail: 'DATABASE_SCHEMA_NOT_READY' }
    }
    return { ok: true }
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : 'DATABASE_UNAVAILABLE' }
  }
}
