/**
 * Check whether the Neon database already holds the full lesson content, or
 * only the metadata that would force the Worker to read the lesson JSON
 * files from R2.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire('C:/web-app/4-craft.com/apps/api-ts/package.json')
const { Client } = require('pg')

const env = Object.fromEntries(
  readFileSync('C:/web-app/4-craft.com/.env.local', 'utf-8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]
    }),
)

async function main() {
  const c = new Client({ connectionString: env.DATABASE_URL })
  await c.connect()

  const content = await c.query(
    `select id, title, jsonb_typeof(content) as kind, pg_column_size(content) as bytes
     from lessons order by pg_column_size(content) desc limit 3`,
  )
  console.log('largest lessons rows:')
  for (const row of content.rows) {
    console.log(`  ${row.title}  kind=${row.kind} bytes=${row.bytes}`)
  }

  const total = await c.query('select count(*)::int n, sum(pg_column_size(content))::int bytes from lessons')
  console.log(`\nlessons: ${total.rows[0].n} rows, ${total.rows[0].bytes} bytes of content`)

  // One content row in detail.
  const kinds = await c.query('select jsonb_typeof(content) as kind, count(*)::int n from lessons group by 1')
  console.log('\ncontent kinds:', kinds.rows.map((r) => `${r.kind}=${r.n}`).join(', '))
  const one = await c.query('select content from lessons limit 1')
  if (one.rows[0]) {
    const parsed = one.rows[0].content
    console.log('content keys:', Object.keys(parsed ?? {}).join(', '))
  }

  // Do the questions live in the database too?
  const tables = await c.query(
    `select table_name, (xpath('/row/c/text()', query_to_xml(format('select count(*) c from %I', table_name), false, true, '')))[1]::text::int as rows
     from information_schema.tables where table_schema='public' and table_name in ('questions','lessons','question_skills')`,
  )
  console.log('\ntables:')
  for (const t of tables.rows) console.log(`  ${t.table_name}: ${t.rows}`)

  await c.end()
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
