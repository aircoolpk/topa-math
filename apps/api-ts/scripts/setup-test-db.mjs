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
 *   TEST_ADMIN_DATABASE_URL — superuser connection string
 *   TEST_DB_ROLE            — role that owns the schema (default: topa_test)
 *   TEST_DB_PASSWORD        — password for that role
 *   TEST_DB_NAME            — database name (default: topa_test)
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Client } from 'pg'

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Superuser connection string. The local Docker Postgres uses the password
 * from .env.docker; CI sets TEST_ADMIN_DATABASE_URL explicitly.
 */
const ADMIN_URL =
  process.env.TEST_ADMIN_DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:5432/postgres'

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
const escapedPassword = ROLE_PASSWORD.replace(/'/g, "''")
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

const existing = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [DB_NAME])
if (existing.rowCount === 0) {
  await admin.query(`CREATE DATABASE ${DB_NAME} OWNER ${ROLE}`)
  console.log(`created database ${DB_NAME}`)
} else {
  console.log(`database ${DB_NAME} already exists`)
}
await admin.end()

// Now connect as the test role and build the schema.
const client = new Client({
  connectionString: `postgresql://${ROLE}:${encodeURIComponent(ROLE_PASSWORD)}@127.0.0.1:5432/${DB_NAME}`,
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

const { rows } = await client.query(
  "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'",
)
console.log(`tables in test database: ${rows[0].n}`)

await client.end()
