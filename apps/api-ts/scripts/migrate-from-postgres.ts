/**
 * Migrate the database from the Docker Postgres container to Neon.
 *
 * The script is deliberately *not* run automatically — Neon has no account
 * yet, so this is prepared and documented for the operator to run once the
 * Neon project exists.
 *
 * It performs three steps:
 *
 *  1. Apply the Drizzle migration (`drizzle/*.sql`) to the Neon database.
 *  2. Install the password helpers (`scripts/pbkdf2.sql`) — the login path
 *     needs `topa_verify_password` to verify the legacy 200,000-iteration
 *     hashes.
 *  3. Copy the data from the source database, table by table, in foreign-key
 *     order, using `COPY ... FROM STDIN` through `pg-copy-streams` (the
 *     fastest way to move a few megabytes of rows).
 *
 * Usage:
 *   SOURCE_DATABASE_URL=postgresql://... \
 *   TARGET_DATABASE_URL=postgresql://... \
 *   npx tsx scripts/migrate-from-postgres.ts [--dry-run]
 *
 * `--dry-run` lists the tables and row counts without copying anything.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Writable } from 'node:stream'

import { Client } from 'pg'
import { from as copyFrom } from 'pg-copy-streams'

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const SOURCE_URL = process.env.SOURCE_DATABASE_URL
const TARGET_URL = process.env.TARGET_DATABASE_URL
const DRY_RUN = process.argv.includes('--dry-run')

if (!SOURCE_URL || !TARGET_URL) {
  console.error('SOURCE_DATABASE_URL and TARGET_DATABASE_URL are required.')
  console.error(
    'Example:\n' +
      '  SOURCE_DATABASE_URL=postgresql://postgres:pw@127.0.0.1:5432/adaptive_learning \\\n' +
      '  TARGET_DATABASE_URL=postgresql://user:pw@ep-xxx.region.aws.neon.tech/neondb?sslmode=require \\\n' +
      '  npx tsx scripts/migrate-from-postgres.ts',
  )
  process.exit(1)
}

/**
 * The tables to copy, in foreign-key order.
 *
 * The order guarantees every foreign key resolves as the rows land.
 */
const TABLES = [
  'users',
  'subjects',
  'skills',
  'lessons',
  'questions',
  'badges',
  'avatar_items',
  'learning_quests',
  'quest_templates',
  'recurring_quest_templates',
  'rank_titles',
  'child_profiles',
  'child_badges',
  'child_inventory',
  'child_quests',
  'child_recurring_quests',
  'check_in_events',
  'coin_ledger',
  'lesson_access',
  'lesson_activity',
  'lesson_variant_views',
  'public_shares',
  'question_attempt_history',
  'quiz_answers',
  'quiz_sessions',
  'rank_snapshots',
  'referral_events',
  'skill_mastery',
  'student_stats',
  'test_results',
  'test_sessions',
  'xp_events',
  'admin_audit_logs',
  'affiliate_commission_ledger',
  'affiliate_payout_accounts',
  'affiliate_withdrawal_requests',
  'ai_generation_jobs',
]

/** Read the generated Drizzle migration files, in order. */
function migrationFiles(): string[] {
  const journalPath = join(PACKAGE_ROOT, 'drizzle', 'meta', '_journal.json')
  const journal = JSON.parse(readFileSync(journalPath, 'utf-8')) as {
    entries: Array<{ tag: string }>
  }
  return journal.entries.map((entry) => join(PACKAGE_ROOT, 'drizzle', `${entry.tag}.sql`))
}

/** Count the rows in a table. */
async function countRows(client: Client, table: string): Promise<number> {
  const result = await client.query<{ n: number }>(`SELECT count(*)::int AS n FROM "${table}"`)
  return result.rows[0]?.n ?? 0
}

/**
 * Make a DDL statement idempotent.
 *
 * The generated migration uses plain `CREATE TABLE`, which fails when the
 * table already exists. Adding `IF NOT EXISTS` lets the script be re-run
 * safely (for example after a partial copy).
 */
function toIdempotent(statement: string): string {
  if (/^CREATE\s+TABLE/i.test(statement)) {
    return statement.replace(/^CREATE\s+TABLE/i, 'CREATE TABLE IF NOT EXISTS')
  }
  if (/^CREATE\s+(UNIQUE\s+)?INDEX/i.test(statement)) {
    return statement.replace(/^CREATE\s+(UNIQUE\s+)?INDEX/i, 'CREATE $1INDEX IF NOT EXISTS')
  }
  return statement
}

/** Errors that mean the object is already there — safe to ignore. */
const ALREADY_EXISTS = /already exists|duplicate key value violates unique constraint/i

const source = new Client({ connectionString: SOURCE_URL })
const target = new Client({ connectionString: TARGET_URL })

try {
  await source.connect()
  await target.connect()

  console.log('source:', (await source.query('SELECT current_database() AS db')).rows[0]?.db)
  console.log('target:', (await target.query('SELECT current_database() AS db')).rows[0]?.db)

  // 1. Schema.
  //
  // The migration is applied with `IF NOT EXISTS` semantics so the script
  // can be re-run against a database that already has some of the tables
  // (a partial copy after a failure, for example).
  console.log('\n--- applying schema ---')
  for (const file of migrationFiles()) {
    const sql = readFileSync(file, 'utf-8')
    for (const statement of sql.split('--> statement-breakpoint')) {
      const trimmed = statement.trim()
      if (!trimmed) continue
      try {
        await target.query(toIdempotent(trimmed))
      } catch (error) {
        // A constraint that already exists is not a problem — the script is
        // meant to be re-runnable.
        const message = error instanceof Error ? error.message : String(error)
        if (!ALREADY_EXISTS.test(message)) {
          throw error
        }
      }
    }
    console.log(`applied ${file}`)
  }

  // 2. Password helpers.
  console.log('\n--- installing password helpers ---')
  await target.query('CREATE EXTENSION IF NOT EXISTS pgcrypto')
  await target.query(readFileSync(join(PACKAGE_ROOT, 'scripts', 'pbkdf2.sql'), 'utf-8'))
  console.log('installed scripts/pbkdf2.sql')

  // 3. Data.
  console.log('\n--- copying data ---')
  const sourceTables = new Set(
    (
      await source.query<{ tablename: string }>(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public'",
      )
    ).rows.map((row) => row.tablename),
  )
  const targetTables = new Set(
    (
      await target.query<{ tablename: string }>(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public'",
      )
    ).rows.map((row) => row.tablename),
  )

  const skipped: string[] = []

  for (const table of TABLES) {
    if (!sourceTables.has(table)) {
      console.log(`skip ${table} (not present in source)`)
      continue
    }
    if (!targetTables.has(table)) {
      // The Drizzle schema does not cover this table yet, so there is
      // nowhere to copy it to.
      skipped.push(table)
      console.log(`skip ${table} (no matching table in the target schema)`)
      continue
    }

    const count = await countRows(source, table)

    if (DRY_RUN) {
      console.log(`would copy ${table} (${count} rows)`)
      continue
    }

    // The target table must be empty for COPY to append cleanly.
    await target.query(`TRUNCATE TABLE "${table}" CASCADE`)

    const stream = source.query(copyFrom(`COPY "${table}" TO STDOUT WITH (FORMAT binary)`))
    await target.query(
      `COPY "${table}" FROM STDIN WITH (FORMAT binary)`,
      ((client: { query: (chunk: Buffer) => Promise<unknown> }) => {
        const writable = new Writable({
          write(chunk: Buffer, _encoding, callback) {
            client
              .query(chunk)
              .then(() => callback())
              .catch((error: unknown) => callback(error as Error))
          },
        })
        stream.pipe(writable)
      }) as never,
    )

    const copied = await countRows(target, table)
    console.log(`copied ${table}: ${copied}/${count} ${copied === count ? 'ok' : 'MISMATCH'}`)
  }

  console.log('\n--- summary ---')
  const totals = await target.query<Record<string, string>>(
    `SELECT
       (SELECT count(*) FROM users) AS users,
       (SELECT count(*) FROM child_profiles) AS children,
       (SELECT count(*) FROM lessons) AS lessons`,
  )
  console.log(totals.rows[0])

  if (skipped.length > 0) {
    console.log(
      `\nWARNING: ${skipped.length} table(s) exist in the source but have no counterpart in the Drizzle schema:\n  ${skipped.join(', ')}`,
    )
    console.log('Add them to src/db/schema.ts and regenerate the migration before relying on a complete copy.')
  }

  console.log('\nMigration complete.')
} catch (error) {
  console.error('\nMigration failed:', error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  await source.end().catch(() => undefined)
  await target.end().catch(() => undefined)
}
