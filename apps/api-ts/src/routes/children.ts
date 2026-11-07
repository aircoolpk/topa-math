/**
 * Child profile endpoints — `/children…`.
 *
 * Mirrors `apps/api/app/routers/children.py` and the child-scoped routes in
 * `quests.py` / `learning.py`.
 */
import { Hono, type Context } from 'hono'

import { badRequest, conflict, notFound } from '../lib/errors'
import { requireAuth, requireActiveUser, type AppEnv } from '../lib/http'
import { levelFromTotalXp, levelProgress, nextRankTitleForScore, rankTitleForScore } from '../lib/progression'

export const childrenRoutes = new Hono<AppEnv>()

/** A child profile row as stored in `child_profiles`. */
interface ChildRow {
  id: string
  parent_user_id: string
  first_name: string | null
  last_name: string | null
  nickname: string
  grade_level: number
  province: string | null
  district: string | null
  school_name: string | null
  school_province: string | null
  school_district: string | null
  student_photo_url: string | null
  student_photo_path: string | null
  avatar_gender: string | null
  avatar_config: Record<string, unknown> | null
  program_type: string
  membership_status: string
  total_score: number
  total_xp: number
  coins: number
  current_level: number
  days_active: number
  test_attempts_used: number
  free_test_limit: number
  total_tests_completed: number
  average_test_accuracy: string | number
  average_test_speed: string | number
  current_rank_title: string
  streak_count: number
  created_at: string
  updated_at: string
}

/** The columns fetched for a child profile. */
const CHILD_COLUMNS = `
  id, parent_user_id, first_name, last_name, nickname, grade_level,
  province, district, school_name, school_province, school_district,
  student_photo_url, student_photo_path, avatar_gender, avatar_config,
  program_type, membership_status, total_score, total_xp, coins,
  current_level, days_active, test_attempts_used, free_test_limit,
  total_tests_completed, average_test_accuracy, average_test_speed,
  current_rank_title, streak_count, created_at, updated_at
`

/** Convert a child row into the `ChildOut` payload the frontend expects. */
function childToOut(child: ChildRow) {
  const rankTitle = child.current_rank_title || 'Beginner'
  return {
    id: child.id,
    first_name: child.first_name,
    last_name: child.last_name,
    nickname: child.nickname || '',
    grade_level: child.grade_level || 1,
    province: child.province,
    district: child.district,
    school_name: child.school_name,
    school_province: child.school_province,
    school_district: child.school_district,
    student_photo_url: child.student_photo_url,
    student_photo_path: child.student_photo_path,
    avatar_gender: child.avatar_gender,
    avatar_config: child.avatar_config || {},
    program_type: child.program_type || 'THP',
    membership_status: child.membership_status || 'free',
    membership: child.membership_status || 'free',
    total_score: child.total_score || 0,
    total_xp: child.total_xp || 0,
    coins: child.coins || 0,
    current_level: child.current_level || 1,
    days_active: child.days_active || 0,
    test_attempts_used: child.test_attempts_used || 0,
    free_test_limit: child.free_test_limit || 5,
    total_tests_completed: child.total_tests_completed || 0,
    average_test_accuracy: Number(child.average_test_accuracy || 0),
    average_test_speed: Number(child.average_test_speed || 0),
    current_rank_title: rankTitle,
    rank_title: rankTitle,
    streak_count: child.streak_count || 0,
    created_at: child.created_at,
    updated_at: child.updated_at,
  }
}

/**
 * Load a child and verify that it belongs to the authenticated user.
 *
 * A missing child and a child owned by somebody else both produce 404 so
 * the endpoint cannot be used to probe for other users' children.
 */
async function loadOwnedChild(c: Context<AppEnv>, childId: string): Promise<ChildRow> {
  const user = await requireActiveUser(c)
  const sql = c.get('sql')
  const rows = (await sql.query(
    `SELECT ${CHILD_COLUMNS} FROM child_profiles WHERE id = $1 AND parent_user_id = $2 LIMIT 1`,
    [childId, user.id],
  )) as ChildRow[]
  const child = rows[0]
  if (!child) {
    throw notFound('Child not found')
  }
  return child
}

childrenRoutes.get('/', requireAuth(), async (c) => {
  const user = await requireActiveUser(c)
  const sql = c.get('sql')
  const rows = (await sql.query(
    `SELECT ${CHILD_COLUMNS} FROM child_profiles WHERE parent_user_id = $1 ORDER BY created_at ASC`,
    [user.id],
  )) as ChildRow[]
  return c.json(rows.map(childToOut))
})

childrenRoutes.get('/:childId', requireAuth(), async (c) => {
  const child = await loadOwnedChild(c, c.req.param('childId'))
  // The FastAPI service recomputes the level from the stored XP on read.
  const level = levelFromTotalXp(child.total_xp || 0)
  return c.json(childToOut({ ...child, current_level: level }))
})

childrenRoutes.post('/', requireAuth(), async (c) => {
  const user = await requireActiveUser(c)
  const sql = c.get('sql')
  const body = (await c.req.json().catch(() => ({}))) as {
    nickname?: unknown
    grade_level?: unknown
    province?: unknown
    district?: unknown
  }

  const nickname = typeof body.nickname === 'string' ? body.nickname.trim() : ''
  const gradeLevel = Number(body.grade_level)
  if (!nickname) {
    throw badRequest('nickname is required')
  }
  if (!Number.isInteger(gradeLevel) || gradeLevel < 1 || gradeLevel > 12) {
    throw badRequest('grade_level must be an integer between 1 and 12')
  }

  const existing = (await sql.query(
    'SELECT id FROM child_profiles WHERE parent_user_id = $1 LIMIT 1',
    [user.id],
  )) as Array<{ id: string }>
  if (existing.length > 0) {
    throw conflict('User already has a student profile')
  }

  const childId = crypto.randomUUID()
  const province = typeof body.province === 'string' ? body.province : null
  const district = typeof body.district === 'string' ? body.district : null

  await sql.query(
    `INSERT INTO child_profiles (
       id, parent_user_id, nickname, grade_level, province, district,
       avatar_config, program_type, membership_status, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, '{}'::jsonb, 'THP', 'free', now(), now())`,
    [childId, user.id, nickname, gradeLevel, province, district],
  )

  const rows = (await sql.query(
    `SELECT ${CHILD_COLUMNS} FROM child_profiles WHERE id = $1 LIMIT 1`,
    [childId],
  )) as ChildRow[]
  return c.json(childToOut(rows[0] as ChildRow), 201)
})

childrenRoutes.get('/:childId/progress', requireAuth(), async (c) => {
  const child = await loadOwnedChild(c, c.req.param('childId'))
  return c.json({
    total_xp: child.total_xp || 0,
    coins: child.coins || 0,
    current_level: levelFromTotalXp(child.total_xp || 0),
    streak_count: child.streak_count || 0,
  })
})

childrenRoutes.get('/:childId/skill-mastery', requireAuth(), async (c) => {
  const child = await loadOwnedChild(c, c.req.param('childId'))
  const sql = c.get('sql')
  const rows = (await sql.query(
    `SELECT id, skill_id, mastery_score, mastery_level, correct_count,
            incorrect_count, avg_response_time_ms, last_practiced_at
     FROM skill_mastery WHERE child_profile_id = $1 ORDER BY mastery_score DESC`,
    [child.id],
  )) as Array<Record<string, unknown>>
  return c.json(rows)
})

childrenRoutes.get('/:childId/badges', requireAuth(), async (c) => {
  const child = await loadOwnedChild(c, c.req.param('childId'))
  const sql = c.get('sql')
  const rows = (await sql.query(
    `SELECT b.id, b.code, b.name, b.description, b.icon_url, cb.awarded_at
     FROM child_badges cb
     JOIN badges b ON b.id = cb.badge_id
     WHERE cb.child_profile_id = $1
     ORDER BY b.code ASC`,
    [child.id],
  )) as Array<{
    id: string
    code: string
    name: string
    description: string | null
    icon_url: string | null
    awarded_at: string | null
  }>

  return c.json(
    rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      name_th: row.name,
      description: row.description,
      icon: row.icon_url,
      icon_url: row.icon_url,
      category: null,
      earned: true,
      earned_at: row.awarded_at,
    })),
  )
})

childrenRoutes.get('/:childId/rank-summary', requireAuth(), async (c) => {
  const child = await loadOwnedChild(c, c.req.param('childId'))
  const sql = c.get('sql')
  const scoreForTitle = child.total_score || child.total_xp
  const rankTitle = rankTitleForScore(scoreForTitle)
  const progress = levelProgress(child.total_xp || 0)

  const ranked = child.total_tests_completed > 0 && child.province
  const countryFilters = ['cp.grade_level = $1', 'cp.total_tests_completed > 0', 'cp.province IS NOT NULL']
  const provinceFilters = [...countryFilters, 'cp.province = $2']

  const countryRows = (await sql.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (
              WHERE cp.total_score > $2 OR (cp.total_score = $2 AND cp.total_xp > $3)
            )::int AS higher
     FROM child_profiles cp
     WHERE ${countryFilters.join(' AND ')}`,
    [child.grade_level, child.total_score || 0, child.total_xp || 0],
  )) as Array<{ total: number; higher: number }>

  const provinceRows = ranked
    ? ((await sql.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (
                  WHERE cp.total_score > $3 OR (cp.total_score = $3 AND cp.total_xp > $4)
                )::int AS higher
         FROM child_profiles cp
         WHERE ${provinceFilters.join(' AND ')}`,
        [child.grade_level, child.province, child.total_score || 0, child.total_xp || 0],
      )) as Array<{ total: number; higher: number }>)
    : []

  const country = countryRows[0]
  const province = provinceRows[0]

  return c.json({
    province_rank: province ? province.higher + 1 : null,
    country_rank: country ? country.higher + 1 : null,
    total_in_country: country?.total ?? 0,
    rank_title: rankTitle,
    current_rank: rankTitle,
    next_rank: nextRankTitleForScore(scoreForTitle),
    total_score: child.total_score || 0,
    total_xp: child.total_xp || 0,
    level: progress.level,
    xp_into_level: progress.xpIntoLevel,
    xp_to_next_rank: progress.xpNeededForNextLevel,
    xp_needed_for_next_level: progress.xpNeededForNextLevel,
    xp_remaining_to_next_level: Math.max(0, progress.xpNeededForNextLevel - progress.xpIntoLevel),
    average_accuracy: child.total_tests_completed ? Number(child.average_test_accuracy || 0) : null,
    average_speed_seconds: child.total_tests_completed
      ? Math.round((Number(child.average_test_speed || 0) / 1000) * 100) / 100
      : null,
  })
})

childrenRoutes.get('/:childId/course-map', requireAuth(), async (c) => {
  const child = await loadOwnedChild(c, c.req.param('childId'))
  const sql = c.get('sql')
  const rows = (await sql.query(
    `SELECT
       l.id, l.title, l.status, l.content,
       s.id AS skill_id, s.code AS skill_code, s.name AS skill_name,
       s.grade_level, s.difficulty_order
     FROM lessons l
     JOIN skills s ON s.id = l.skill_id
     WHERE l.status = 'approved'
       AND s.grade_level IN ($1, $2)
     ORDER BY s.grade_level, s.difficulty_order, l.title`,
    [child.grade_level, Math.max(1, child.grade_level - 1)],
  )) as Array<{
    id: string
    title: string
    status: string
    content: Record<string, unknown> | null
    skill_id: string
    skill_code: string
    skill_name: string
    grade_level: number
    difficulty_order: number
  }>

  const isPaid = (child.membership_status ?? 'free') !== 'free'
  const items = rows.map((row) => {
    const content = (row.content ?? {}) as Record<string, unknown>
    const reviewOnly = row.grade_level < child.grade_level
    const isLocked = !isPaid && reviewOnly
    return {
      id: row.id,
      lesson_id: row.id,
      title: row.title,
      skill_id: row.skill_id,
      skill_code: row.skill_code,
      skill_name: row.skill_name,
      grade_level: row.grade_level,
      lesson_type: content.lesson_type ?? 'lesson',
      estimated_minutes: (content.estimated_minutes as number | undefined) ?? 5,
      difficulty: content.difficulty ?? 'easy',
      xp_reward: content.xp_reward ?? 50,
      is_locked: isLocked,
      lock_reason: isLocked ? 'Free users can access review lessons only' : null,
      status: isLocked ? 'locked' : 'available',
      linked_lesson_id: row.id,
      linked_quiz_id: content.quiz_id ?? null,
    }
  })

  return c.json({ current_grade: child.grade_level, items })
})
