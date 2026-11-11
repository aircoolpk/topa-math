/**
 * Remove the checkout reservation a probe created for the demo account.
 *
 * The probe called the legacy FastAPI checkout endpoint, which created a
 * real (unpaid) Stripe Checkout Session and a `PENDING` reservation row.
 * The row would otherwise block every later checkout attempt for the demo
 * account with `CHECKOUT_RECONCILIATION_REQUIRED`.
 *
 * Usage: npx tsx scripts/cleanup-probe-reservation.mts <reservation-id>
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

const reservationId = process.argv[2]
if (!reservationId) {
  console.error('usage: cleanup-probe-reservation.mts <reservation-id>')
  process.exit(1)
}

const url = readEnvValue(join(REPO_ROOT, '.env.local'), 'DATABASE_URL')
if (!url) throw new Error('DATABASE_URL not found')

const sql = neon(url)

const before = await sql`
  SELECT r.id, r.plan_code, r.status, r.created_at
  FROM billing_checkout_reservations r
  JOIN users u ON u.id = r.user_id
  WHERE r.id = ${reservationId} AND u.email = 'demo@4-craft.com'
`
if (before.length === 0) {
  console.log('no matching reservation — nothing to clean up')
  process.exit(0)
}
console.log('deleting:', JSON.stringify(before[0]))

await sql`
  DELETE FROM billing_checkout_reservations
  WHERE id = ${reservationId}
    AND user_id = (SELECT id FROM users WHERE email = 'demo@4-craft.com')
`

const after = await sql`
  SELECT count(*)::int AS remaining
  FROM billing_checkout_reservations
  WHERE id = ${reservationId}
`
console.log('remaining rows with that id:', after[0].remaining)
