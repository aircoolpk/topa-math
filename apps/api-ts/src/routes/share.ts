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
