import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    // Neon pooled HTTP connection string. Override with DATABASE_URL when running
    // `drizzle-kit generate` (generate does not need a live DB, but migrate does).
    url: process.env.DATABASE_URL ?? 'postgresql://user:password@host/dbname?sslmode=require',
  },
  strict: true,
  verbose: true,
})
