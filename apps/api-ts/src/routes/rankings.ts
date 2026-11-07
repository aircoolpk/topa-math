/**
 * Leaderboard endpoint — `GET /rankings`.
 *
 * Mirrors `apps/api/app/routers/rankings.py`: real data aggregated from
 * `child_profiles`, with the same scoring formula so the ordering is
 * unchanged after the migration.
 */
import { Hono } from 'hono'

import { badRequest } from '../lib/errors'
import { requireAuth, requireActiveUser, type AppEnv } from '../lib/http'
import { rankScore } from '../lib/progression'

export const rankingsRoutes = new Hono<AppEnv>()

/** A single leaderboard row. */
interface RankingRow {
  id: string
  nickname: string
  grade_level: number
  province: string | null
  school_name: string | null
  total_score: number
  total_xp: number
  current_level: number
  total_tests_completed: number
  streak_count: number
  average_test_speed: number | null
  current_rank_title: string
  student_photo_url: string | null
}

/** Build the leaderboard payload for one row. */
function toEntry(row: RankingRow, rankPosition: number) {
  const mastery = Number(row.total_score || 0)
  const speedPoints = (() => {
    const average = row.average_test_speed === null ? null : Number(row.average_test_speed)
    if (average === null || average < 500) {
      return 0
    }
    const benchmark = 10_000
    return Math.round(Math.max(0, Math.min(100, 100 - ((average - benchmark) / benchmark) * 50)) * 100) / 100
  })()
  const improvementPoints = Math.round(Math.min(100, Number(row.total_xp || 0) / 100) * 100) / 100

  return {
    rank_position: rankPosition,
    child_profile_id: row.id,
    nickname: row.nickname,
    grade_level: row.grade_level,
    province: row.province,
    school_name: row.school_name,
    mastery_points: mastery,
    speed_points: speedPoints,
    improvement_points: improvementPoints,
    rank_score: rankScore(mastery, row.average_test_speed === null ? null : Number(row.average_test_speed), Number(row.total_xp || 0)),
    total_tests_completed: row.total_tests_completed,
    current_level: row.current_level,
    streak_count: row.streak_count,
    current_rank_title: row.current_rank_title,
    student_photo_url: row.student_photo_url,
  }
}

rankingsRoutes.get('/', requireAuth(), async (c) => {
  const user = await requireActiveUser(c)
  const sql = c.get('sql')

  const gradeLevel = Number(c.req.query('grade_level'))
  if (!Number.isInteger(gradeLevel) || gradeLevel < 1 || gradeLevel > 12) {
    throw badRequest('grade_level must be an integer between 1 and 12')
  }

  const scope = (c.req.query('scope') ?? 'country').toLowerCase().trim()
  if (!['country', 'province', 'grade', 'school'].includes(scope)) {
    throw badRequest(`Invalid scope: ${scope}`)
  }

  const province = c.req.query('province') ?? undefined
  const school = c.req.query('school') ?? undefined
  if (scope === 'province' && !province) {
    throw badRequest('scope=province requires ?province=<name>')
  }
  if (scope === 'school' && !school) {
    throw badRequest('scope=school requires ?school=<name>')
  }

  const limit = Math.min(500, Math.max(1, Number(c.req.query('limit') ?? 100) || 100))

  // The filters are assembled server-side from validated values, so the
  // SQL text stays constant and only the parameters vary.
  //
  // `filterParams` is shared by every query; the LIMIT parameter is only
  // used by the entries query and is therefore kept separate — passing an
  // unreferenced parameter makes Postgres reject the statement.
  const filters = ['cp.grade_level = $1', 'cp.total_tests_completed > 0', 'cp.province IS NOT NULL']
  const filterParams: unknown[] = [gradeLevel]
  if (scope === 'province') {
    filterParams.push(province)
    filters.push(`cp.province = $${filterParams.length}`)
  } else if (scope === 'school') {
    filterParams.push(school)
    filters.push(`cp.school_name = $${filterParams.length}`)
  }
  const where = filters.join(' AND ')

  const entriesRows = (await sql.query(
    `
    SELECT
      cp.id, cp.nickname, cp.grade_level, cp.province, cp.school_name,
      cp.total_score, cp.total_xp, cp.current_level, cp.total_tests_completed,
      cp.streak_count, cp.average_test_speed, cp.current_rank_title, cp.student_photo_url
    FROM child_profiles cp
    WHERE ${where}
    ORDER BY cp.total_score DESC, cp.total_xp DESC
    LIMIT $${filterParams.length + 1}
    `,
    [...filterParams, limit],
  )) as RankingRow[]

  const ownRows = (await sql.query(
    `
    SELECT
      cp.id, cp.nickname, cp.grade_level, cp.province, cp.school_name,
      cp.total_score, cp.total_xp, cp.current_level, cp.total_tests_completed,
      cp.streak_count, cp.average_test_speed, cp.current_rank_title, cp.student_photo_url
    FROM child_profiles cp
    WHERE cp.parent_user_id = $1
    ORDER BY cp.total_score DESC
    LIMIT 1
    `,
    [user.id],
  )) as RankingRow[]

  let childOwnRank: ReturnType<typeof toEntry> | null = null
  const best = ownRows[0]
  if (best) {
    const countRows = (await sql.query(
      `
      SELECT COUNT(*)::int AS higher
      FROM child_profiles cp
      WHERE ${where}
        AND (cp.total_score > $${filterParams.length + 1}
             OR (cp.total_score = $${filterParams.length + 1} AND cp.total_xp > $${filterParams.length + 2}))
      `,
      [...filterParams, best.total_score, best.total_xp],
    )) as Array<{ higher: number }>
    childOwnRank = toEntry(best, Number(countRows[0]?.higher ?? 0) + 1)
  }

  const summaryRows = (await sql.query(
    `
    SELECT
      cp.province,
      COUNT(*)::int AS child_count,
      AVG(cp.total_score)::numeric(10,2) AS avg_score,
      MAX(cp.total_score)::int AS top_score
    FROM child_profiles cp
    WHERE cp.grade_level = $1
      AND cp.total_tests_completed > 0
      AND cp.province IS NOT NULL
    GROUP BY cp.province
    ORDER BY top_score DESC
    `,
    [gradeLevel],
  )) as Array<{ province: string; child_count: number; avg_score: string; top_score: number }>

  const provinceSummary = summaryRows.map((row) => ({
    province: row.province,
    child_count: row.child_count,
    avg_score: Number(row.avg_score || 0),
    top_score: row.top_score,
  }))

  return c.json({
    scope,
    grade_level: gradeLevel,
    province: scope === 'province' ? (province ?? null) : null,
    school: scope === 'school' ? (school ?? null) : null,
    entries: entriesRows.map((row, index) => toEntry(row, index + 1)),
    child_own_rank: childOwnRank,
    province_summary: provinceSummary,
    is_mock: false,
  })
})
