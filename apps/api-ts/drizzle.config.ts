import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    // Neon pooled HTTP connection string. Override with DATABASE_URL when running
    // `drizzle-kit generate` (generate does not need a live DB, but migrate does).
    // `verify-full` asks the driver to check the server certificate; `require`
    // only encrypts the connection and would lose that check in `pg` v9.
    url: process.env.DATABASE_URL ?? 'postgresql://user:***@host/dbname?sslmode=verify-full',
  },
  strict: true,
  verbose: true,
})
