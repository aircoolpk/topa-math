/**
 * A tiny adapter that exposes the subset of the Neon query API the app uses
 * (`sql` tagged template and `sql.query()`) on top of a plain Postgres
 * connection.
 *
 * The integration tests run against the local Docker Postgres so the real
 * handlers, the real SQL and the real password helpers are exercised
 * together.
 */
import { Client } from 'pg'

/** A row returned by a query. */
export type Row = Record<string, unknown>

/** The shape the app relies on (`src/lib/db.ts`). */
export interface TestSql {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<Row[]>
  query(queryWithPlaceholders: string, params?: unknown[]): Promise<Row[]>
}

/**
 * Build a `sql`-compatible function backed by a `pg` client.
 *
 * @param client an open Postgres client.
 */
export function createTestSql(client: Client): TestSql {
  const run = async (text: string, params: unknown[]): Promise<Row[]> => {
    const result = await client.query(text, params as never[])
    return result.rows as Row[]
  }

  const sql = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    // The Neon tagged template turns `sql`...`` into a parameterised query
    // with $1, $2, ... placeholders — the same shape `pg` expects.
    let text = ''
    let index = 0
    for (const part of strings) {
      text += part
      if (index < values.length) {
        text += `$${index + 1}`
        index += 1
      }
    }
    return run(text, values)
  }) as TestSql

  sql.query = (queryWithPlaceholders: string, params: unknown[] = []) =>
    run(queryWithPlaceholders, params)

  return sql
}
