/**
 * Curriculum catalogue — `/subjects` and `/skills`.
 *
 * Mirrors the two public endpoints in `apps/api/app/routers/learning.py`.
 */
import { Hono } from 'hono'

import type { AppEnv } from '../lib/http'

export const learningRoutes = new Hono<AppEnv>()

learningRoutes.get('/subjects', async (c) => {
  const sql = c.get('sql')
  const rows = (await sql.query('SELECT id, code, name FROM subjects ORDER BY name ASC')) as Array<{
    id: string
    code: string
    name: string
  }>
  return c.json(rows)
})

learningRoutes.get('/skills', async (c) => {
  const sql = c.get('sql')
  const subject = c.req.query('subject') ?? 'math'
  const gradeLevel = Number(c.req.query('grade_level') ?? 1)

  const rows = (await sql.query(
    `SELECT s.id, s.subject_id, s.grade_level, s.code, s.name, s.description,
            s.prerequisite_skill_ids, s.difficulty_order, s.created_at
     FROM skills s
     JOIN subjects sub ON sub.id = s.subject_id
     WHERE sub.code = $1 AND s.grade_level = $2
     ORDER BY s.difficulty_order ASC, s.name ASC`,
    [subject, Number.isFinite(gradeLevel) ? gradeLevel : 1],
  )) as Array<Record<string, unknown>>

  if (rows.length === 0) {
    return c.json([])
  }
  return c.json(rows)
})
