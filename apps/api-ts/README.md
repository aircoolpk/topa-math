# Topa Math API (TypeScript)

A Cloudflare Workers implementation of the Topa Math API, mirroring the
FastAPI service (`apps/api`) so the Next.js frontend can point at either one
during the cut-over.

- `src/index.ts` — the Hono entry point (`wrangler.toml` points at it)
- `src/routes/` — the endpoints the frontend calls
- `src/lib/auth.ts` — HS256 JWTs (byte-compatible with the FastAPI service)
  and PBKDF2-SHA256 password hashing
- `src/db/schema.ts` — the Drizzle schema
- `drizzle/` — the generated SQL migration
- `scripts/pbkdf2.sql` — the Postgres password helpers

## Prerequisites

- **Node.js 20 or newer.**
- **A PostgreSQL database.** The integration tests exercise the real
  handlers against a real database, so they need one.

  The test database is a Neon branch. Point `TEST_ADMIN_DATABASE_URL` at
  the direct (unpooled) connection string of that branch and run:

  ```bash
  node scripts/setup-test-db.mjs
  ```

  The container's superuser credentials come from `.env.docker`
  (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_PORT`).
  `scripts/setup-test-db.mjs` reads that file, so it connects with the same
  password the container expects. Override it with `TEST_ADMIN_DATABASE_URL`
  when the credentials live somewhere else.

## Setup

```bash
npm ci
node scripts/setup-test-db.mjs
```

The setup script provisions the `topa_test` role and database, applies the
Drizzle migration, and installs the password helpers. It drops and recreates
the `public` schema, so it refuses to run against a database whose name does
not look like a test database (override with `ALLOW_SCHEMA_RESET=1`).

Environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `TEST_ADMIN_DATABASE_URL` | from `.env.docker` | Superuser connection string used to provision the role and database |
| `TEST_DB_ROLE` | `topa_test` | Role that owns the test schema |
| `TEST_DB_PASSWORD` | `topa_test_password` | Password for that role |
| `TEST_DB_NAME` | `topa_test` | Database that holds the test schema |
| `TEST_DATABASE_URL` | `postgresql://topa_test:topa_test_password@127.0.0.1:5432/topa_test` | Connection string the tests use |

## Tests

```bash
npm test          # vitest run
npm run typecheck # tsc --noEmit for the app and the tests
```

The suite runs the real handlers against the local database, so it exercises
the SQL, the password helpers and the response shapes together. It needs the
database to be reachable at `TEST_DATABASE_URL` — run
`node scripts/setup-test-db.mjs` first.

### When the suite fails to connect

| Symptom | Cause | Fix |
| --- | --- | --- |
| `password authentication failed for user "postgres"` from the setup script | The superuser password does not match the container | Check `POSTGRES_PASSWORD` in `.env.docker`, or set `TEST_ADMIN_DATABASE_URL` |
| `permission denied for table ...` | The role does not own the schema | Re-run `node scripts/setup-test-db.mjs` |
| `The password helpers in the test database are missing or inconsistent` | The helpers were left over from an older revision | Re-run `node scripts/setup-test-db.mjs` |

### Password helpers

Password hashing runs in Postgres rather than in the Worker: the Workers Free
plan allows only 10 ms of CPU per request, while the legacy 200,000-round
PBKDF2 costs far more than that. `scripts/pbkdf2.sql` installs the helpers and
stores hashes in the legacy `pbkdf2_sha256$<hex-salt>$<base64url-digest>`
format, so credentials stay interchangeable with the FastAPI service.

`scripts/pbkdf2.sql` is a multi-statement script and therefore runs as one
transaction — a single failing statement rolls back the whole install. It
drops any previous revision of the helpers first, so a database left over from
an older revision is repaired instead of failing with
`cannot change name of input parameter`.

## Deployment

```bash
npm run dev   # wrangler dev
npm run build # bundle check (dry run)
```

Secrets (`DATABASE_URL`, `JWT_SECRET`) are set with `wrangler secret put`;
see `.dev.vars.example` for the local equivalents.
