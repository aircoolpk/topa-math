/** Measures how long the dashboard queries take on Neon. */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
const require = createRequire('C:/web-app/4-craft.com/apps/api-ts/package.json')
const { Client } = require('pg')

const env = readFileSync('C:/web-app/4-craft.com/.env.native', 'utf-8')
const url = env.match(/^DATABASE_URL=["']?([^"'\n\r]+)/m)[1]

const client = new Client({ connectionString: url })
await client.connect()

const child = (
  await client.query(
    `SELECT cp.id, cp.grade_level, cp.total_score, cp.total_xp
       FROM child_profiles cp ORDER BY cp.created_at LIMIT 1`,
  )
).rows[0]
const grade = Number(child.grade_level)
const review = Math.max(1, grade - 1)
console.log(`child grade: ${grade} (review ${review})`)

async function time(label, sql, params) {
  const started = Date.now()
  const result = await client.query(sql, params)
  const ms = Date.now() - started
  console.log(`  ${label}: ${ms} ms | rows=${result.rowCount} | bytes=${JSON.stringify(result.rows).length}`)
  return result
}

await time(
  'batch with content (ของเดิม)',
  `
    SELECT 'lesson' AS kind, l.id, l.title, l.content, NULL::int AS estimated_minutes,
           s.grade_level, s.code AS skill_code, s.name AS skill_name, NULL::int AS status_order
      FROM lessons l
      JOIN skills s ON s.id = l.skill_id
     WHERE l.status = 'approved' AND s.grade_level IN (${grade}, ${review})
     UNION ALL
    SELECT 'quest' AS kind, q.id, q.title, NULL::jsonb, q.estimated_minutes,
           q.grade_level, q.skill_code, q.title, NULL::int
      FROM learning_quests q
     WHERE q.status = 'active' AND q.grade_level = ${grade}
    `,
  
)

await time(
  'batch ไม่ดึง content',
  `
    SELECT 'lesson' AS kind, l.id, l.title, NULL::jsonb AS content, NULL::int AS estimated_minutes,
           s.grade_level, s.code AS skill_code, s.name AS skill_name, NULL::int AS status_order
      FROM lessons l
      JOIN skills s ON s.id = l.skill_id
     WHERE l.status = 'approved' AND s.grade_level IN (${grade}, ${review})
    `,
  
)

await time(
  'นับบทเรียนที่ approved',
  `SELECT count(*)::int FROM lessons l JOIN skills s ON s.id = l.skill_id WHERE l.status='approved'`,
)

await time(
  'ขนาด content ของ 2 ชั้น',
  `SELECT sum(pg_column_size(l.content))::bigint AS bytes, count(*)::int AS n FROM lessons l JOIN skills s ON s.id=l.skill_id WHERE l.status='approved' AND s.grade_level IN (${grade}, ${review})`,
)

await client.end()
