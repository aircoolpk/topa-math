/**
 * Read-only check of the checkout reservations for the demo account.
 *
 * Used to confirm whether a probe left a pending reservation behind.
 * Credentials are never printed.
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

const rows = await sql`
  SELECT r.id, r.user_id, r.provider, r.plan_code, r.status,
         (r.external_id IS NOT NULL) AS has_external_id,
         (r.checkout_url IS NOT NULL) AS has_checkout_url,
         r.created_at
  FROM billing_checkout_reservations r
  JOIN users u ON u.id = r.user_id
  WHERE u.email = 'demo@4-craft.com'
  ORDER BY r.created_at DESC
`
console.log('demo reservations:', JSON.stringify(rows, null, 2))

const all = await sql`
  SELECT r.id, r.plan_code, r.status, r.created_at,
         (r.external_id IS NOT NULL) AS has_external_id
  FROM billing_checkout_reservations r
  ORDER BY r.created_at ASC
`
console.log('all reservations:', JSON.stringify(all, null, 2))
