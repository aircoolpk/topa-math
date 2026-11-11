/**
 * Public share links — `/share/dashboard/{token}` and
 * `/share/test-result/{token}`.
 *
 * Mirrors `apps/api/app/routers/share.py`. Both endpoints are public (no
 * authentication) so a shared link works for anyone who has it.
 */
import { Hono, type Context } from 'hono'

import { notFound } from '../lib/errors'
import type { AppEnv } from '../lib/http'

export const shareRoutes = new Hono<AppEnv>()

/** Referral tracking is mounted at the root, like in the legacy service. */
export const referralRoutes = new Hono<AppEnv>()

/** A row from `public_shares`. */
interface ShareRow {
  token: string
  share_type: string
  data: Record<string, unknown> | null
  created_at: string | null
  expires_at: string | null
  revoked_at: string | null
}

/**
 * Load a share token and confirm it is still valid.
 */
async function loadShare(c: Context<AppEnv>, token: string, shareType: string): Promise<ShareRow> {
  const sql = c.get('sql')
  const rows = (await sql.query(
    `SELECT token, share_type, data, created_at, expires_at, revoked_at
     FROM public_shares
     WHERE token = $1 AND share_type = $2
     LIMIT 1`,
    [token, shareType],
  )) as ShareRow[]

  const share = rows[0]
  if (!share) {
    throw notFound('ไม่พบลิงก์แชร์นี้')
  }
  if (share.revoked_at) {
    throw notFound('ไม่พบลิงก์แชร์นี้')
  }
  if (share.expires_at && new Date(share.expires_at).getTime() < Date.now()) {
    throw notFound('ไม่พบลิงก์แชร์นี้')
  }
  return share
}

shareRoutes.get('/dashboard/:token', async (c) => {
  const share = await loadShare(c, c.req.param('token'), 'dashboard')
  return c.json({
    token: share.token,
    share_type: share.share_type,
    created_at: share.created_at,
    data: share.data ?? {},
  })
})

shareRoutes.get('/test-result/:token', async (c) => {
  const share = await loadShare(c, c.req.param('token'), 'test_result')
  return c.json({
    token: share.token,
    share_type: share.share_type,
    created_at: share.created_at,
    data: share.data ?? {},
  })
})

/**
 * The visitor fingerprint the legacy service stores with a click.
 *
 * `apps/api/app/services/referrals.py` hashes the client address and the
 * user agent together, so the same visitor cannot inflate the click count.
 */
async function visitorHash(c: Context<AppEnv>): Promise<string | null> {
  const address =
    c.req.header('cf-connecting-ip') ??
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    ''
  const userAgent = c.req.header('user-agent') ?? ''
  const value = `${address}|${userAgent}`.replace(/^\||\|$/g, '')
  if (!value) return null
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * `POST /referrals/click` — record that somebody followed a referral link.
 *
 * Public on purpose: the click happens before the visitor signs up.
 */
referralRoutes.post('/referrals/click', async (c) => {
  const sql = c.get('sql')
  const body = (await c.req.json().catch(() => ({}))) as {
    referral_token?: string | null
    share_token?: string | null
  }
  const referralToken = body.referral_token ?? null
  const shareToken = body.share_token ?? null

  if (!referralToken) {
    return c.json({ tracked: false })
  }

  const referrer = (
    await sql.query('SELECT id FROM users WHERE referral_token = $1 LIMIT 1', [referralToken])
  ) as Array<{ id: string }>
  if (!referrer[0]) {
    return c.json({ tracked: false })
  }

  const visitor = await visitorHash(c)
  if (visitor) {
    const existing = (
      await sql.query(
        `SELECT id FROM referral_events
         WHERE referrer_user_id = $1
           AND event_type = 'clicked'
           AND share_token IS NOT DISTINCT FROM $2
           AND visitor_hash = $3
         LIMIT 1`,
        [referrer[0].id, shareToken, visitor],
      )
    ) as Array<{ id: string }>
    if (existing[0]) {
      return c.json({ tracked: false })
    }
  }

  await sql.query(
    `INSERT INTO referral_events
       (id, referrer_user_id, referred_user_id, referral_token, event_type,
        share_token, visitor_hash, metadata, created_at)
     VALUES (gen_random_uuid(), $1, NULL, $2, 'clicked', $3, $4, $5::jsonb, now())`,
    [referrer[0].id, referralToken, shareToken, visitor, JSON.stringify({ source: 'register_or_share_page' })],
  )
  return c.json({ tracked: true })
})
