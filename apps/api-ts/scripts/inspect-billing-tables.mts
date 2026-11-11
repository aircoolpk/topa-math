/**
 * Read-only inspection of the billing/MPP tables in Neon.
 *
 * Prints the table list and the column definitions of the tables the billing
 * endpoints touch, so the Drizzle schema gap can be reported precisely.
 * Credentials are read from `.env.local` and never printed.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { neon } from '@neondatabase/serverless'

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

const target = process.argv[2] ?? 'test'
const url =
  target === 'test'
    ? readEnvValue(join(PACKAGE_ROOT, '.env.test'), 'TEST_DATABASE_URL')
    : readEnvValue(join(REPO_ROOT, '.env.local'), 'DATABASE_URL')

if (!url) throw new Error('DATABASE_URL not found for target ' + target)

const sql = neon(url)

const tables = await sql`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY table_name
`
console.log(`TARGET: ${target}`)
console.log('TABLES:', tables.map((r: any) => r.table_name).join(', '))
console.log('COUNT:', tables.length)

const wanted = [
  'mpp_package_prices',
  'mpp_purchase_orders',
  'mpp_purchase_events',
  'billing_checkout_reservations',
  'mpp_test_transactions',
  'mpp_test_webhook_events',
  'child_profiles',
  'users',
  'coin_ledger',
  'referral_events',
  'affiliate_commission_ledger',
]

// 1. Session timezone (Python's psycopg renders timestamptz in it).
const tz = await sql`SHOW timezone`
console.log('session timezone:', JSON.stringify(tz[0]))

// 2. How a timestamptz is rendered in JSON vs Python's isoformat().
const fmt = await sql`
  SELECT
    to_json(now())::text AS as_json,
    to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.USOF') AS as_char,
    (now() AT TIME ZONE 'UTC')::text AS at_utc
`
console.log('timestamp formats:', JSON.stringify(fmt[0]))

// 3. Indexes / constraints on the MPP + reservation tables.
const idx = await sql`
  SELECT tablename, indexdef
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename IN (
      'mpp_package_prices', 'mpp_purchase_orders', 'mpp_purchase_events',
      'billing_checkout_reservations', 'mpp_test_transactions', 'mpp_test_webhook_events'
    )
  ORDER BY tablename, indexname
`
for (const row of idx as any[]) {
  console.log(`IDX ${row.tablename}: ${row.indexdef}`)
}

// 4. The demo account's billing state.
const demo = await sql`
  SELECT
    u.id AS user_id, u.role,
    c.id AS child_id, c.membership_status, c.membership_provider,
    c.plan_code, c.plan_type, c.active_price_code, c.price_type,
    c.billing_program_type, c.subscription_status, c.stripe_customer_id,
    c.stripe_subscription_id, c.current_period_end, c.cancel_at_period_end,
    c.mpp_access_ends_at, c.paid_at, c.canceled_at
  FROM users u
  LEFT JOIN child_profiles c ON c.parent_user_id = u.id
  WHERE u.email = 'demo@4-craft.com'
`
console.log('demo account:', JSON.stringify(demo[0], null, 2))

// 5. Pending MPP orders / checkout reservations for the demo account.
const counts = await sql`
  SELECT
    (SELECT count(*)::int FROM mpp_purchase_orders WHERE user_id = (SELECT id FROM users WHERE email = 'demo@4-craft.com')) AS mpp_orders,
    (SELECT count(*)::int FROM billing_checkout_reservations WHERE user_id = (SELECT id FROM users WHERE email = 'demo@4-craft.com')) AS reservations,
    (SELECT count(*)::int FROM mpp_package_prices) AS prices
`
console.log('demo counts:', JSON.stringify(counts[0]))

// 6. The MPP package price catalogue.
const prices = await sql`SELECT * FROM mpp_package_prices ORDER BY plan_code`
console.log('mpp_package_prices:', JSON.stringify(prices, null, 2))

// 7. Founder counters, the way FastAPI computes them.
const founder = await sql`
  SELECT
    (SELECT count(*)::int FROM child_profiles
      WHERE active_price_code IN ('th_founder_monthly', 'ep_founder_monthly')
        AND membership_status IN ('paid', 'plus')
        AND (
          ((membership_provider IS NULL OR membership_provider <> 'mpp')
             AND subscription_status IN ('active', 'trialing', 'paid'))
          OR (membership_provider = 'mpp' AND mpp_access_ends_at > now())
        )
    ) AS founder_used,
    (SELECT count(*)::int FROM mpp_purchase_orders
      WHERE plan_code IN ('th_founder_monthly', 'ep_founder_monthly') AND status = 'PENDING'
    ) AS founder_reserved
`
console.log('founder counters:', JSON.stringify(founder[0]))

for (const table of wanted) {
  const cols = await sql`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table}
    ORDER BY ordinal_position
  `
  if (cols.length === 0) {
    console.log(`\n### ${table}: MISSING`)
    continue
  }
  console.log(`\n### ${table}`)
  for (const c of cols as any[]) {
    console.log(`  ${c.column_name} ${c.data_type} ${c.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}${c.column_default ? ` default=${c.column_default}` : ''}`)
  }
}

