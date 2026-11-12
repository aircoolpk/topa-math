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
 * Make the SSL mode of a Postgres URL explicit.
 *
 * Only a URL that already asks for an SSL mode is rewritten, because a
 * URL without one may point at a server that does not speak SSL at all —
 * the CI Postgres container does not. Such a URL keeps its default
 * behaviour, which is what it was written for.
 */
export function withVerifiedSsl(connectionString: string): string {
  if (!connectionString) return connectionString
  if (!connectionString.includes('sslmode=')) return connectionString
  if (connectionString.includes('sslmode=verify-full')) return connectionString
  return connectionString.replace(/sslmode=[^&]+/, 'sslmode=verify-full')
}
