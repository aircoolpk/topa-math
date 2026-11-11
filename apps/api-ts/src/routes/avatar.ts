/**
 * Avatar catalogue and the child-scoped avatar endpoints.
 *
 * Mirrors `apps/api/app/routers/avatar.py`. The legacy service serialises
 * the ORM rows directly (no response model), so the timestamps are rendered
 * the way `datetime.isoformat()` renders them — with an explicit `+00:00`
 * offset — and the keys keep the order of the captured payloads.
 */
import { Hono } from 'hono'

import { notFound } from '../lib/errors'
import { requireAuth, requireActiveUser, type AppEnv } from '../lib/http'
import { isoTimestamp, jsonBody } from './me-avatar-shared'

/** The avatar catalogue — mounted at `/avatar`. */
export const avatarRoutes = new Hono<AppEnv>()

/** The child-scoped avatar endpoints — mounted at `/children`. */
export const childrenAvatarRoutes = new Hono<AppEnv>()

/** A row of `avatar_items`. */
interface AvatarItemRow {
  id: string
  code: string
  name: string
  item_type: string
  rarity: string | null
  asset_url: string | null
  is_default: boolean | null
  created_at: string
}

avatarRoutes.get('/items', requireAuth(), async (c) => {
  const sql = c.get('sql')
  const rows = (await sql.query(
    `SELECT id, code, name, item_type, rarity, asset_url, is_default,
            to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') AS created_at
       FROM avatar_items`,
  )) as AvatarItemRow[]

  return jsonBody(
    c,
    rows.map((row) => ({
      item_type: row.item_type,
      id: row.id,
      asset_url: row.asset_url,
      created_at: isoTimestamp(row.created_at),
      name: row.name,
      rarity: row.rarity,
      code: row.code,
      is_default: row.is_default,
    })),
  )
})

/** A row of `child_inventory`. */
interface InventoryRow {
  id: string
  child_profile_id: string
  avatar_item_id: string
  acquired_at: string
}

childrenAvatarRoutes.get('/:childId/inventory', requireAuth(), async (c) => {
  const sql = c.get('sql')
  const rows = (await sql.query(
    `SELECT id, child_profile_id, avatar_item_id,
            to_char(acquired_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') AS acquired_at
       FROM child_inventory
      WHERE child_profile_id = $1`,
    [c.req.param('childId')],
  )) as InventoryRow[]

  return jsonBody(
    c,
    rows.map((row) => ({
      acquired_at: isoTimestamp(row.acquired_at),
      child_profile_id: row.child_profile_id,
      id: row.id,
      avatar_item_id: row.avatar_item_id,
    })),
  )
})

childrenAvatarRoutes.patch('/:childId/avatar', requireAuth(), async (c) => {
  await requireActiveUser(c)
  const childId = c.req.param('childId')
  const sql = c.get('sql')

  const existing = (await sql.query('SELECT id FROM child_profiles WHERE id = $1 LIMIT 1', [childId])) as Array<{
    id: string
  }>
  if (existing.length === 0) {
    throw notFound('ไม่พบโปรไฟล์นักเรียน')
  }

  // The legacy endpoint takes the avatar configuration as the request body
  // itself — it is not wrapped in a field.
  const body = (await c.req.json().catch(() => ({}))) as unknown
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw notFound('ไม่พบโปรไฟล์นักเรียน')
  }

  await sql.query(
    'UPDATE child_profiles SET avatar_config = $1::jsonb, updated_at = now() WHERE id = $2',
    [JSON.stringify(body), childId],
  )

  const rows = (await sql.query(
    'SELECT avatar_config FROM child_profiles WHERE id = $1 LIMIT 1',
    [childId],
  )) as Array<{ avatar_config: Record<string, unknown> | null }>

  return jsonBody(c, { avatar_config: rows[0]?.avatar_config || {} })
})
