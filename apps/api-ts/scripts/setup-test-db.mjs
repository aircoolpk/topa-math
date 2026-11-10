/**
 * Prepare the integration-test database.
 *
 * Creates the role and the database (if needed), applies the Drizzle
 * migration and installs the password helpers from `scripts/pbkdf2.sql`.
 *
 * The script connects as a superuser so it can provision the role itself —
 * connecting as the test role cannot work on a fresh machine, because the
 * password would not be known yet.
 *
 * Usage: node scripts/setup-test-db.mjs
 *
 * Environment:
 *   TEST_ADMIN_DATABASE_URL — superuser connection string (CI sets this)
 *   TEST_DB_ROLE            — role that owns the schema (default: topa_test)
 *   TEST_DB_PASSWORD        — password for that role
 *   TEST_DB_NAME            — database name (default: topa_test)
 *
 * When TEST_ADMIN_DATABASE_URL is not set the superuser credentials are read
 * from the repository's `.env.docker` — that is the file the local Docker
 * Postgres container is actually started with, so the setup script connects
 * with the same password the container expects. Without this fallback the
 * script fails with `password authentication failed for user "postgres"`.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Client } from 'pg'

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const REPO_ROOT = join(PACKAGE_ROOT, '..', '..')

/**
 * Read a `KEY=VALUE` pair out of a dotenv-style file.
 *
 * @param file path of the file to read.
 * @param key the variable name.
 */
function readEnvValue(file, key) {
  if (!existsSync(file)) return ''
  const match = readFileSync(file, 'utf-8').match(new RegExp(`^${key}=(.*)$`, 'm'))
  return match ? match[1].trim() : ''
}

/**
 * Build the superuser connection string for the local Docker Postgres.
 *
 * The container's password comes from `.env.docker` (`POSTGRES_PASSWORD`),
 * so that file is the only reliable source for it. Falls back to the stock
 * `postgres`/`postgres` pair the CI service container uses.
 */
function localAdminUrl() {
  const user = readEnvValue(join(REPO_ROOT, '.env.docker'), 'POSTGRES_USER') || 'postgres'
  const password = readEnvValue(join(REPO_ROOT, '.env.docker'), 'POSTGRES_PASSWORD') || 'postgres'
  const port = readEnvValue(join(REPO_ROOT, '.env.docker'), 'POSTGRES_PORT') || '5432'
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@127.0.0.1:${port}/postgres`
}

/**
 * Superuser connection string.
 *
 * CI sets TEST_ADMIN_DATABASE_URL explicitly; locally the credentials come
 * from `.env.docker`.
 */
const ADMIN_URL = process.env.TEST_ADMIN_DATABASE_URL ?? localAdminUrl()

/**
 * Role that owns the test schema. CI provisions Postgres with the `postgres`
 * superuser instead of a dedicated `topa_test` role, so this is configurable.
 */
const ROLE = process.env.TEST_DB_ROLE ?? 'topa_test'

/** Password for the test role. */
const ROLE_PASSWORD = process.env.TEST_DB_PASSWORD ?? 'topa_test_password'

/** Database that holds the test schema. */
const DB_NAME = process.env.TEST_DB_NAME ?? 'topa_test'

// The role and database names are interpolated into SQL, so only allow plain
// identifiers.
for (const [label, value] of [['TEST_DB_ROLE', ROLE], ['TEST_DB_NAME', DB_NAME]]) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`${label} must be a plain SQL identifier, got: ${value}`)
  }
}

// This script drops and recreates the `public` schema, which is only ever
// correct for a throwaway test database. Refuse to touch anything else.
if (!/test/i.test(DB_NAME) && process.env.ALLOW_SCHEMA_RESET !== '1') {
  throw new Error(
    `Refusing to reset the schema of "${DB_NAME}" — the name does not look like a test database. ` +
      'Set TEST_DB_NAME to a *_test database, or ALLOW_SCHEMA_RESET=1 if this really is a throwaway.',
  )
}

/** Find the generated Drizzle migration file. */
function findMigration() {
  const metaDir = join(PACKAGE_ROOT, 'drizzle', 'meta')
  const journal = JSON.parse(readFileSync(join(metaDir, '_journal.json'), 'utf-8'))
  const last = journal.entries[journal.entries.length - 1]
  return join(PACKAGE_ROOT, 'drizzle', `${last.tag}.sql`)
}

const admin = new Client({ connectionString: ADMIN_URL })
await admin.connect()

// Provision the role. ALTER ROLE keeps the password in sync with the
// configured value so a stale role cannot lock the setup out.
//
// When the requested role is the superuser we are already connected as, the
// password is left alone — changing it would invalidate the admin connection
// string that the tests use.
const currentUser = await admin.query('SELECT current_user AS u')
const escapedPassword = ROLE_PASSWORD.replace(/'/g, "''")
if (currentUser.rows[0].u === ROLE) {
  console.log(`role ${ROLE} is the current superuser — leaving its password unchanged`)
} else {
  await admin.query(
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${ROLE}') THEN
         CREATE ROLE ${ROLE} LOGIN PASSWORD '${escapedPassword}';
       ELSE
         ALTER ROLE ${ROLE} WITH LOGIN PASSWORD '${escapedPassword}';
       END IF;
     END $$;`,
  )
  console.log(`role ${ROLE} ready`)
}

const existing = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [DB_NAME])
if (existing.rowCount === 0) {
  await admin.query(`CREATE DATABASE ${DB_NAME} OWNER ${ROLE}`)
  console.log(`created database ${DB_NAME}`)
} else {
  console.log(`database ${DB_NAME} already exists`)
}
await admin.end()

// Now connect as the test role and build the schema.
//
// The connection is derived from the admin URL instead of a hard coded host,
// so the same script provisions a local Postgres, a CI service container or a
// Neon branch.
const clientUrl = new URL(ADMIN_URL)
const adminPassword = decodeURIComponent(clientUrl.password)
const clientPassword = currentUser.rows[0].u === ROLE ? adminPassword : ROLE_PASSWORD
clientUrl.username = encodeURIComponent(ROLE)
clientUrl.password = encodeURIComponent(clientPassword)
clientUrl.pathname = `/${DB_NAME}`
const client = new Client({
  connectionString: clientUrl.toString(),
})
await client.connect()

// Start from a clean schema so the migration is applied to an empty database.
await client.query('DROP SCHEMA public CASCADE')
await client.query('CREATE SCHEMA public')
await client.query(`GRANT ALL ON SCHEMA public TO ${ROLE}`)

const migrationFile = findMigration()
const migration = readFileSync(migrationFile, 'utf-8')
let applied = 0
for (const statement of migration.split('--> statement-breakpoint')) {
  const trimmed = statement.trim()
  if (!trimmed) continue
  await client.query(trimmed)
  applied += 1
}
console.log(`applied ${applied} statements from ${migrationFile}`)

await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto')
await client.query(readFileSync(join(PACKAGE_ROOT, 'scripts', 'pbkdf2.sql'), 'utf-8'))
console.log('installed pgcrypto + password helpers')

// Verify the helpers agree with each other. Registration hashes with
// `topa_hash_password` and login verifies with `topa_verify_password`, so a
// mismatch between the two only shows up as a 500 from /auth/register — very
// hard to trace back to the database.
const probe = await client.query(
  `SELECT topa_verify_password('setup-probe', topa_hash_password('setup-probe')) AS ok`,
)
if (probe.rows[0]?.ok !== true) {
  console.error('\nThe password helpers do not agree with each other — the test suite would fail.')
  process.exit(1)
}
console.log('password helpers verified (hash + verify round trip)')

const { rows } = await client.query(
  "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'",
)
console.log(`tables in test database: ${rows[0].n}`)

await client.end()
