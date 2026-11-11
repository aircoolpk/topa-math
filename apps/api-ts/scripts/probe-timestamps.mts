/**
 * Probe how the Neon HTTP driver returns `timestamptz` values, and how the
 * `pg` driver returns them, so the Worker can format them exactly like
 * Python's `datetime.isoformat()`.
 *
 * Read-only; prints no credentials.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { neon } from '@neondatabase/serverless'
import { Client } from 'pg'

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const REPO_ROOT = join(PACKAGE_ROOT, '..', '..')

function readEnvValue(file: string, key: string): string {
  try {
    const match = readFileSync(file, 'utf-8').match(new RegExp(`^${key}=(.*)$`, 'm'))
    return match ? match[1].trim().replace(/^["']|["']$/g, '') : ''
  } catch {
    return ''
  }
}

const url = readEnvValue(join(REPO_ROOT, '.env.local'), 'DATABASE_URL')
const sql = neon(url)

const rows = (await sql`
  SELECT
    now() AS a,
    now()::text AS b,
    to_json(now())::text AS c,
    (now() AT TIME ZONE 'UTC') AS d
`) as any[]

const row = rows[0] as any
console.log('neon driver types:', Object.fromEntries(Object.entries(row).map(([k, v]) => [k, typeof v])))
console.log('neon raw values:', JSON.stringify(row))

const client = new Client({ connectionString: url })
await client.connect()
const pg = await client.query('SELECT now() AS a, now()::text AS b, to_json(now())::text AS c')
console.log('pg driver types:', Object.fromEntries(Object.entries(pg.rows[0] as any).map(([k, v]) => [k, typeof v])))
console.log('pg raw values:', JSON.stringify(pg.rows[0]))
await client.end()

// The env vars the billing endpoints read: presence and length only.
const nativeEnv = join(REPO_ROOT, '.env.native')
const keys = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_TH_FOUNDER_MONTHLY',
  'STRIPE_PRICE_EP_FOUNDER_MONTHLY',
  'STRIPE_PRICE_TH_PLUS_MONTHLY',
  'STRIPE_PRICE_EP_PLUS_MONTHLY',
  'STRIPE_PRICE_TH_PLUS_YEARLY',
  'STRIPE_PRICE_EP_PLUS_YEARLY',
  'FRONTEND_BASE_URL',
  'STRIPE_CUSTOMER_PORTAL_RETURN_URL',
  'MPP_PROJECT_API_KEY',
  'MPP_WEBHOOK_SIGNING_SECRET',
  'MPP_EXPECTED_MERCHANT_NAME',
  'MPP_EXPECTED_PROJECT_NAME',
  'MPP_AMOUNT_UNIT',
  'MPP_CHECKOUT_ENABLED',
  'MPP_CHECKOUT_TEST_USER_IDS',
  'PAYMENT_GATEWAY_DEFAULT',
]
for (const key of keys) {
  const value = readEnvValue(nativeEnv, key)
  console.log(`env ${key}: present=${value.length > 0} length=${value.length}`)
}
