/**
 * The uploaded student avatars — `/storage/avatars/{filename}`.
 *
 * The legacy FastAPI service mounts the folder
 * `apps/api/storage/uploads/avatars`, which is empty, so every request
 * answers 404 there. The files that the database actually references live in
 * `storage/uploads/avatars` at the repository root.
 *
 * The Worker has no writable filesystem, so the images are stored in Neon
 * (`avatar_files`, see `migrations/0001_avatar_files.sql`) and streamed from
 * there. The route therefore serves the *real* files instead of the 404 the
 * legacy service returns.
 */
import { Hono } from 'hono'

import { notFound } from '../lib/errors'
import type { AppEnv } from '../lib/http'

/** The storage routes — mounted at `/storage`. */
export const storageRoutes = new Hono<AppEnv>()

/** A row of `avatar_files`. */
interface AvatarFileRow {
  filename: string
  content_type: string
  bytes: string
}

/** The file names that may be requested (no path traversal). */
const SAFE_FILENAME = /^[A-Za-z0-9._-]+$/

storageRoutes.get('/avatars/:filename', async (c) => {
  const filename = c.req.param('filename')
  if (!SAFE_FILENAME.test(filename)) {
    throw notFound('Not Found')
  }

  const sql = c.get('sql')
  const rows = (await sql.query(
    `SELECT filename, content_type, encode(data, 'base64') AS bytes
       FROM avatar_files
      WHERE filename = $1
      LIMIT 1`,
    [filename],
  )) as AvatarFileRow[]

  const file = rows[0]
  if (!file) {
    throw notFound('Not Found')
  }

  const binary = atob(file.bytes)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return c.body(bytes, 200, {
    'content-type': file.content_type,
    'content-length': String(bytes.length),
    'cache-control': 'public, max-age=31536000, immutable',
  })
})
