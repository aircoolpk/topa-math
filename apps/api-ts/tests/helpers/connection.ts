/**
 * The connection string helpers the tests and the database scripts share.
 *
 * Neon hands out a URL that ends in `sslmode=require`. The `pg` driver reads
 * that mode as an alias for `verify-full` today, but it prints a security
 * warning and it will switch to the weaker libpq meaning in `pg` v9 — the
 * certificate would then no longer be verified. Rewriting the mode here
 * keeps the strict behaviour explicit and silences the warning.
 */

/**
 * Rewrite the SSL mode of a Postgres URL to `verify-full`.
 *
 * The mode is replaced in place, so a URL that already asks for
 * `verify-full` stays untouched and a URL without any mode gains one.
 */
export function withVerifiedSsl(connectionString: string): string {
  if (!connectionString) return connectionString
  if (connectionString.includes('sslmode=verify-full')) return connectionString
  if (connectionString.includes('sslmode=')) {
    return connectionString.replace(/sslmode=[^&]+/, 'sslmode=verify-full')
  }
  return `${connectionString}${connectionString.includes('?') ? '&' : '?'}sslmode=verify-full`
}
