/**
 * Seed the `avatar_files` table with the images that the database already
 * references.
 *
 * The legacy FastAPI service serves `/storage/avatars/{filename}` from
 * `storage/uploads/avatars` at the repository root, but its own mount points
 * at `apps/api/storage/uploads/avatars` — an empty folder — so every request
 * answers 404 there.
 *
 * The Worker has no writable filesystem, so the same bytes are copied into
 * Neon (`avatar_files`) and streamed from there.
 *
 * Usage:
 *     node scripts/seed-avatar-files.mjs                  # the .dev.vars database
 *     SEED_TEST_DB=1 node scripts/seed-avatar-files.mjs   # the test branch
 *     SEED_DATABASE_URL=… node scripts/seed-avatar-files.mjs
 */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { neon } from '@neondatabase/serverless'

const HERE = dirname(fileURLToPath(import.meta.url))
const PACKAGE_ROOT = resolve(HERE, '..')
const REPO_ROOT = resolve(PACKAGE_ROOT, '..', '..')
const AVATAR_DIR = join(REPO_ROOT, 'storage', 'uploads', 'avatars')

/**
 * Read a variable from a `.env`-style file.
 *
 * @param {string} file the path of the file.
 * @param {string} key the variable name.
 */
function readVar(file, key) {
  try {
    const match = readFileSync(file, 'utf-8').match(new RegExp(`^${key}=(.*)$`, 'm'))
    return match ? match[1].trim().replace(/^["']|["']$/g, '') : undefined
  } catch {
    return undefined
  }
}

// The database is picked in this order: the explicit `SEED_DATABASE_URL`,
// the test branch (only when it is asked for), the development database of
// `.dev.vars` and finally the ambient `DATABASE_URL`.
//
// The files come before the ambient variable on purpose: the shell often
// carries a truncated `DATABASE_URL` that cannot authenticate.
const databaseUrl =
  process.env.SEED_DATABASE_URL ||
  (process.env.SEED_TEST_DB === '1'
    ? readVar(join(PACKAGE_ROOT, '.env.test'), 'TEST_DATABASE_URL')
    : readVar(join(PACKAGE_ROOT, '.dev.vars'), 'DATABASE_URL')) ||
  process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('no database URL found (set TEST_DATABASE_URL or DATABASE_URL)')
}

const sql = neon(databaseUrl)

await sql`
  CREATE TABLE IF NOT EXISTS avatar_files (
    filename text PRIMARY KEY,
    content_type text NOT NULL,
    data bytea NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )
`

const files = readdirSync(AVATAR_DIR).filter((name) => /\.(webp|png|jpe?g)$/i.test(name))
if (files.length === 0) {
  console.log(`no avatar files found in ${AVATAR_DIR}`)
  process.exit(0)
}

for (const filename of files) {
  const bytes = readFileSync(join(AVATAR_DIR, filename))
  const contentType = filename.endsWith('.webp')
    ? 'image/webp'
    : filename.endsWith('.png')
      ? 'image/png'
      : 'image/jpeg'
  await sql`
    INSERT INTO avatar_files (filename, content_type, data, created_at, updated_at)
    VALUES (${filename}, ${contentType}, ${bytes}, now(), now())
    ON CONFLICT (filename) DO UPDATE
      SET content_type = EXCLUDED.content_type, data = EXCLUDED.data, updated_at = now()
  `
  console.log(`seeded ${filename} (${bytes.length} bytes)`)
}

const total = await sql`SELECT COUNT(*)::int AS n FROM avatar_files`
console.log(`avatar_files rows: ${total[0].n}`)
