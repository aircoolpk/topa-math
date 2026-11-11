/**
 * Dump the exact DDL of the billing/MPP tables from Neon (read-only).
 *
 * Used to mirror the production schema in the integration-test database,
 * which does not have the MPP tables (they were never part of the Drizzle
 * migration).
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

const target = process.argv[2] ?? 'prod'
const url =
  target === 'test'
    ? readEnvValue(join(PACKAGE_ROOT, '.env.test'), 'TEST_DATABASE_URL')
    : readEnvValue(join(REPO_ROOT, '.env.local'), 'DATABASE_URL')

if (!url) throw new Error('DATABASE_URL not found for target ' + target)

const sql = neon(url)
console.log('TARGET:', target)

const TABLES = [
  'mpp_package_prices',
  'mpp_purchase_orders',
  'mpp_purchase_events',
  'billing_checkout_reservations',
  'mpp_test_transactions',
  'mpp_test_webhook_events',
]

for (const table of TABLES) {
  const cols = await sql`
    SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table}
    ORDER BY ordinal_position
  `
  if (cols.length === 0) {
    console.log(`\n-- ${table}: MISSING`)
    continue
  }
  console.log(`\nCREATE TABLE IF NOT EXISTS public.${table} (`)
  const lines = (cols as any[]).map((c) => {
    let type = c.data_type
    if (c.data_type === 'character varying' && c.character_maximum_length) {
      type = `varchar(${c.character_maximum_length})`
    }
    if (c.data_type === 'timestamp with time zone') type = 'timestamptz'
    if (c.data_type === 'timestamp without time zone') type = 'timestamp'
    if (c.data_type === 'USER-DEFINED') type = 'uuid'
    const def = c.column_default ? ` DEFAULT ${c.column_default}` : ''
    return `  ${c.column_name} ${type}${c.is_nullable === 'YES' ? '' : ' NOT NULL'}${def}`
  })
  console.log(lines.join(',\n'))
  console.log(');')

  const cons = await sql`
    SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conrelid = ${`public.${table}`}::regclass
    ORDER BY conname
  `
  for (const c of cons as any[]) {
    console.log(`-- ${c.conname}: ${c.def}`)
  }
}
