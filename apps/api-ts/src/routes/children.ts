/**
 * Child profile endpoints — `/children…`.
 *
 * Mirrors `apps/api/app/routers/children.py` and the child-scoped routes in
 * `quests.py` / `learning.py`.
 */
import { Hono, type Context } from 'hono'

import { badRequest, conflict, HttpError, notFound } from '../lib/errors'
import { pyFloat, toFastApiJson } from '../lib/fastapiJson'
import type { Sql } from '../lib/db'
import { requireAuth, requireActiveUser, type AppEnv } from '../lib/http'
import { levelFromTotalXp, levelProgress, nextRankTitleForScore, rankTitleForScore } from '../lib/progression'
import {
  CHILD_QUEST_COLUMNS,
  QUEST_COLUMNS,
  questScoreReward,
  questTarget,
  questToOut,
  type ChildQuestRow,
  type LearningQuestRow,
  type QuestOut,
} from '../lib/quests'

export const childrenRoutes = new Hono<AppEnv>()

/**
 * Render a payload the way Starlette's `JSONResponse` does.
 *
 * FastAPI serialises its response models with Pydantic, which renders a
 * `float` field as `0.0` where `JSON.stringify` would write `0`. The quest
 * payloads contain one such field (`progress_percent`), so they are written
 * through `toFastApiJson` to stay byte-identical to the legacy service.
 *
 * @param c the request context.
 * @param payload the payload to render.
 * @param status the HTTP status code.
 */
function fastApiJson(c: Context<AppEnv>, payload: unknown, status: 200 | 201 = 200) {
  return c.body(toFastApiJson(payload), status, { 'content-type': 'application/json' })
}

/**
 * Load the quest rows of a grade level.
 *
 * Mirrors the query in `_list_quests`: only the active quests of the
 * child's grade level, optionally narrowed to one recurrence bucket and
 * ordered by grade level and quest id.
 *
 * @param sql the database handle.
 * @param gradeLevel the child's grade level.
 * @param recurrenceType the recurrence bucket, or `null` for every quest.
 */
async function loadQuests(
  sql: Sql,
  gradeLevel: number,
  recurrenceType: string | null,
): Promise<LearningQuestRow[]> {
  const params: unknown[] = [gradeLevel]
  let recurrenceFilter = ''
  if (recurrenceType !== null) {
    params.push(recurrenceType)
    recurrenceFilter = 'AND recurrence_type = $2'
  }
  return (await sql.query(
    `SELECT ${QUEST_COLUMNS} FROM learning_quests
     WHERE grade_level = $1 AND status = 'active' ${recurrenceFilter}
     ORDER BY grade_level, quest_id`,
    params,
  )) as LearningQuestRow[]
}

/**
 * Load the child's quest rows, keyed by quest id.
 *
 * The legacy service builds a dictionary from every `child_quests` row of the
 * child, so the last row wins when a quest appears more than once. The rows
 * are ordered by creation time to reproduce that "last one wins" behaviour
 * deterministically.
 *
 * @param sql the database handle.
 * @param childId the child's profile id.
 */
async function loadChildQuests(sql: Sql, childId: string): Promise<Map<string, ChildQuestRow>> {
  const rows = (await sql.query(
    `SELECT ${CHILD_QUEST_COLUMNS} FROM child_quests
     WHERE child_profile_id = $1
     ORDER BY created_at, id`,
    [childId],
  )) as ChildQuestRow[]

  const byQuest = new Map<string, ChildQuestRow>()
  for (const row of rows) {
    byQuest.set(row.quest_id, row)
  }
  return byQuest
}

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
  current_rank_title, streak_count,
  to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_at,
  to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS updated_at
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

/* ────────────────────────────── child quests ────────────────────────────── */

/**
 * Render a `QuestOut` payload.
 *
 * `progress_percent` is a `float` in the legacy response model, so Pydantic
 * renders it as `0.0` where `JSON.stringify` would write `0`. The value is
 * wrapped in a `PyFloat` to keep the JSON byte-identical.
 *
 * @param out the quest payload.
 */
function questOutJson(out: QuestOut) {
  return { ...out, progress_percent: pyFloat(out.progress_percent) }
}

/**
 * Load the quest row of a quest id for a grade level.
 *
 * Mirrors the lookup in `start_quest` / `complete_quest`: the quest id is
 * the slug (`daily-check-in`), not the database id.
 *
 * @param sql the database handle.
 * @param questId the quest slug.
 * @param gradeLevel the child's grade level.
 */
async function loadQuestByQuestId(
  sql: Sql,
  questId: string,
  gradeLevel: number,
): Promise<LearningQuestRow | null> {
  const rows = (await sql.query(
    `SELECT ${QUEST_COLUMNS} FROM learning_quests
     WHERE quest_id = $1 AND grade_level = $2
     LIMIT 1`,
    [questId, gradeLevel],
  )) as LearningQuestRow[]
  return rows[0] ?? null
}

/**
 * Load the child's row for a quest.
 *
 * Mirrors `_child_quest`: the row is matched on the quest's database id and
 * is not scoped to a period. The rows are ordered by their creation, so the
 * oldest row wins — the legacy service reads the first row of an unordered
 * select, which is the oldest one in practice.
 *
 * @param sql the database handle.
 * @param childId the child's profile id.
 * @param questDbId the quest's database id.
 */
async function loadChildQuest(
  sql: Sql,
  childId: string,
  questDbId: string,
): Promise<ChildQuestRow | null> {
  const rows = (await sql.query(
    `SELECT ${CHILD_QUEST_COLUMNS} FROM child_quests
     WHERE child_profile_id = $1 AND quest_id = $2
     ORDER BY created_at, id
     LIMIT 1`,
    [childId, questDbId],
  )) as ChildQuestRow[]
  return rows[0] ?? null
}

/** The `QuestOut` list of a child's quests, ready to be rendered. */
async function listQuestPayloads(
  sql: Sql,
  child: ChildRow,
  recurrenceType: string | null,
): Promise<QuestOut[]> {
  const quests = await loadQuests(sql, child.grade_level, recurrenceType)
  const childQuests = await loadChildQuests(sql, child.id)
  return quests.map((quest) => questToOut(quest, childQuests.get(quest.id) ?? null))
}

childrenRoutes.get('/:childId/quests', requireAuth(), async (c) => {
  const child = await loadOwnedChild(c, c.req.param('childId'))
  const payload = await listQuestPayloads(c.get('sql'), child, null)
  return fastApiJson(c, payload.map((out) => questOutJson(out)))
})

childrenRoutes.get('/:childId/daily-quests', requireAuth(), async (c) => {
  const child = await loadOwnedChild(c, c.req.param('childId'))
  const payload = await listQuestPayloads(c.get('sql'), child, 'daily')
  return fastApiJson(c, payload.map((out) => questOutJson(out)))
})

childrenRoutes.get('/:childId/weekly-quests', requireAuth(), async (c) => {
  const child = await loadOwnedChild(c, c.req.param('childId'))
  const payload = await listQuestPayloads(c.get('sql'), child, 'weekly')
  return fastApiJson(c, payload.map((out) => questOutJson(out)))
})

childrenRoutes.get('/:childId/monthly-quests', requireAuth(), async (c) => {
  const child = await loadOwnedChild(c, c.req.param('childId'))
  const payload = await listQuestPayloads(c.get('sql'), child, 'monthly')
  return fastApiJson(c, payload.map((out) => questOutJson(out)))
})

childrenRoutes.get('/:childId/recommended-next-quest', requireAuth(), async (c) => {
  const child = await loadOwnedChild(c, c.req.param('childId'))
  const sql = c.get('sql')
  const quests = await loadQuests(sql, child.grade_level, null)
  const childQuests = await loadChildQuests(sql, child.id)

  // Daily quests come first, then the weak-skill quests, then everything
  // else; ties are broken by the quest id.
  const rank = (quest: LearningQuestRow) =>
    quest.recurrence_type === 'daily' ? 0 : quest.quest_type === 'weak_skill' ? 1 : 2
  const ordered = [...quests].sort((a, b) => {
    const byRank = rank(a) - rank(b)
    if (byRank !== 0) {
      return byRank
    }
    return a.quest_id < b.quest_id ? -1 : a.quest_id > b.quest_id ? 1 : 0
  })

  for (const quest of ordered) {
    const row = childQuests.get(quest.id) ?? null
    if (row && row.status === 'completed') {
      continue
    }
    const out = questToOut(quest, row)
    return fastApiJson(c, {
      quest_id: quest.quest_id,
      title_th: quest.title,
      description_th: quest.description,
      reason_th: 'แนะนำภารกิจที่ยังทำไม่เสร็จสำหรับวันนี้',
      title: quest.title,
      description: quest.description,
      skill_code: quest.skill_code,
      grade_level: quest.grade_level,
      estimated_minutes: quest.estimated_minutes,
      lesson_id: quest.lesson_id,
      quiz_id: quest.quiz_id,
      quest_type: quest.recurrence_type !== 'none' ? quest.recurrence_type : quest.quest_type,
      xp_reward: quest.xp_reward ?? 0,
      coin_reward: quest.coin_reward ?? 0,
      progress_current: out.progress_current,
      progress_total: out.progress_total,
      status: row && row.status === 'in_progress' ? 'in_progress' : 'available',
    })
  }

  return fastApiJson(c, {
    quest_id: null,
    title_th: 'ยังไม่มีภารกิจแนะนำ',
    description_th: 'ทำได้ดีมาก ลองกลับมาใหม่ภายหลัง',
    reason_th: 'ภารกิจพร้อมใช้งานถูกทำครบแล้ว',
    title: 'ยังไม่มีภารกิจแนะนำ',
    description: 'ทำได้ดีมาก ลองกลับมาใหม่ภายหลัง',
    skill_code: null,
    grade_level: child.grade_level,
    estimated_minutes: null,
    lesson_id: null,
    quiz_id: null,
    quest_type: 'daily',
    xp_reward: 0,
    coin_reward: 0,
    progress_current: 0,
    progress_total: 1,
    status: 'completed',
  })
})

childrenRoutes.post('/:childId/quests/:questId/start', requireAuth(), async (c) => {
  const child = await loadOwnedChild(c, c.req.param('childId'))
  const sql = c.get('sql')
  const quest = await loadQuestByQuestId(sql, c.req.param('questId'), child.grade_level)
  if (!quest) {
    throw notFound('Quest not found')
  }

  let childQuest = await loadChildQuest(sql, child.id, quest.id)
  if (!childQuest) {
    const id = crypto.randomUUID()
    const target = questTarget(quest)
    await sql.query(
      `INSERT INTO child_quests (
         id, child_profile_id, quest_id, recurrence_type, period_key, status,
         progress_current, progress_target, started_at, completed_at,
         xp_awarded, coin_awarded, score_awarded, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, NULL, 'in_progress', 0, $5, now(), NULL, 0, 0, 0, now(), now())`,
      [id, child.id, quest.id, quest.recurrence_type ?? null, target],
    )
    childQuest = {
      id,
      quest_id: quest.id,
      recurrence_type: quest.recurrence_type ?? null,
      period_key: null,
      status: 'in_progress',
      progress_current: 0,
      progress_target: target,
      started_at: new Date().toISOString(),
      completed_at: null,
      xp_awarded: 0,
      coin_awarded: 0,
      score_awarded: 0,
    }
  } else if (childQuest.status === 'not_started') {
    await sql.query(
      `UPDATE child_quests SET status = 'in_progress', started_at = now(), updated_at = now()
       WHERE id = $1`,
      [childQuest.id],
    )
    childQuest = { ...childQuest, status: 'in_progress' }
  }

  return fastApiJson(c, {
    quest: questOutJson(questToOut(quest, childQuest)),
    total_xp: child.total_xp ?? 0,
    total_score: child.total_score ?? 0,
    coins: child.coins ?? 0,
    current_level: levelFromTotalXp(child.total_xp ?? 0),
  })
})

childrenRoutes.post('/:childId/quests/:questId/complete', requireAuth(), async (c) => {
  const child = await loadOwnedChild(c, c.req.param('childId'))
  const sql = c.get('sql')
  const quest = await loadQuestByQuestId(sql, c.req.param('questId'), child.grade_level)
  if (!quest) {
    throw notFound('Quest not found')
  }

  let childQuest = await loadChildQuest(sql, child.id, quest.id)
  if (!childQuest) {
    const id = crypto.randomUUID()
    const target = questTarget(quest)
    await sql.query(
      `INSERT INTO child_quests (
         id, child_profile_id, quest_id, recurrence_type, period_key, status,
         progress_current, progress_target, started_at, completed_at,
         xp_awarded, coin_awarded, score_awarded, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, NULL, 'in_progress', 0, $5, now(), NULL, 0, 0, 0, now(), now())`,
      [id, child.id, quest.id, quest.recurrence_type ?? null, target],
    )
    childQuest = {
      id,
      quest_id: quest.id,
      recurrence_type: quest.recurrence_type ?? null,
      period_key: null,
      status: 'in_progress',
      progress_current: 0,
      progress_target: target,
      started_at: new Date().toISOString(),
      completed_at: null,
      xp_awarded: 0,
      coin_awarded: 0,
      score_awarded: 0,
    }
  }

  if (childQuest.status === 'completed') {
    // Completing an already completed quest does not award the rewards a
    // second time — the legacy service skips the whole block as well.
    return fastApiJson(c, {
      quest: questOutJson(questToOut(quest, childQuest)),
      total_xp: child.total_xp ?? 0,
      total_score: child.total_score ?? 0,
      coins: child.coins ?? 0,
      current_level: child.current_level ?? 1,
    })
  }

  const xpAwarded = quest.xp_reward ?? 0
  const coinAwarded = quest.coin_reward ?? 0
  const scoreAwarded = questScoreReward(quest)

  await sql.query(
    `UPDATE child_quests
     SET status = 'completed', completed_at = now(),
         xp_awarded = $2, coin_awarded = $3, score_awarded = $4, updated_at = now()
     WHERE id = $1`,
    [childQuest.id, xpAwarded, coinAwarded, scoreAwarded],
  )

  const nextTotalXp = (child.total_xp ?? 0) + xpAwarded
  const nextLevel = levelFromTotalXp(nextTotalXp)

  // The child's totals and the XP event are written in one statement so the
  // ledger cannot drift from the profile.
  const updated = (await sql.query(
    `WITH event AS (
       INSERT INTO xp_events (id, child_profile_id, source_type, source_id, xp_amount, description, created_at)
       VALUES ($6, $1, 'quest_complete', $7, $2, $8, now())
       RETURNING id
     )
     UPDATE child_profiles
        SET total_xp = total_xp + $2,
            coins = coins + $3,
            total_score = total_score + $4,
            current_level = $5,
            updated_at = now()
      WHERE id = $1
      RETURNING total_xp, total_score, coins, current_level`,
    [
      child.id,
      xpAwarded,
      coinAwarded,
      scoreAwarded,
      nextLevel,
      crypto.randomUUID(),
      quest.quest_id,
      quest.title,
    ],
  )) as Array<{
    total_xp: number
    total_score: number
    coins: number
    current_level: number
  }>

  const totals = updated[0]
  const completedQuest: ChildQuestRow = {
    ...childQuest,
    status: 'completed',
    xp_awarded: xpAwarded,
    coin_awarded: coinAwarded,
    score_awarded: scoreAwarded,
  }

  return fastApiJson(c, {
    quest: questOutJson(questToOut(quest, completedQuest)),
    total_xp: totals?.total_xp ?? nextTotalXp,
    total_score: totals?.total_score ?? (child.total_score ?? 0) + scoreAwarded,
    coins: totals?.coins ?? (child.coins ?? 0) + coinAwarded,
    current_level: totals?.current_level ?? nextLevel,
  })
})

/* ───────────────────── placement test / practice / avatar ───────────────────── */

/** The ratio policy the placement test follows. */
const RATIO_POLICY = '80_core_20_challenge'

/** A question row as stored in `questions`. */
interface QuestionRow {
  id: string
  skill_id: string
  grade_level: number
  question_type: string
  difficulty: string
  question_text: string
  choices: string[] | null
  correct_answer: string
  explanation: string | null
  hint: string | null
  metadata: Record<string, unknown> | null
}

/**
 * The role a question plays in the placement test.
 *
 * Mirrors `_challenge_role`: the metadata decides whether a question counts
 * as a core or as a challenge question.
 *
 * @param question the question row.
 */
function challengeRole(question: QuestionRow): 'core' | 'challenge' {
  const metadata = question.metadata ?? {}
  const questionType = String(metadata['question_type'] ?? '').toLowerCase()
  const routineLevel = String(metadata['routine_level'] ?? '').toLowerCase()
  const confidenceRole = String(metadata['confidence_role'] ?? '').toLowerCase()
  if (
    questionType === 'challenge' ||
    routineLevel === 'non_routine' ||
    confidenceRole === 'stretch_thinking'
  ) {
    return 'challenge'
  }
  return 'core'
}

/**
 * The number of core and challenge questions the placement test wants.
 *
 * Mirrors `_ratio_counts`: 20 % of the questions are challenges, rounded to
 * the nearest integer.
 *
 * @param limit the number of questions.
 */
function ratioCounts(limit: number): { core: number; challenge: number } {
  if (limit < 5) {
    return { core: limit, challenge: 0 }
  }
  const challenge = Math.trunc(limit * 0.2 + 0.5)
  return { core: limit - challenge, challenge }
}

/**
 * Pick questions that are spread over the skills and difficulties.
 *
 * Mirrors `_balanced`: the questions are grouped by skill and difficulty and
 * then taken round-robin, so no single skill fills the whole test.
 *
 * @param rows the candidate questions.
 * @param limit the number of questions to pick.
 */
function balancedQuestions(rows: QuestionRow[], limit: number): QuestionRow[] {
  const buckets = new Map<string, QuestionRow[]>()
  for (const row of rows) {
    const key = `${row.skill_id}::${row.difficulty}`
    const bucket = buckets.get(key)
    if (bucket) {
      bucket.push(row)
    } else {
      buckets.set(key, [row])
    }
  }

  const selected: QuestionRow[] = []
  const seen = new Set<string>()
  while (selected.length < limit && buckets.size > 0) {
    let progressed = false
    for (const [key, bucket] of [...buckets.entries()]) {
      while (bucket.length > 0) {
        const question = bucket.shift()
        if (question && !seen.has(question.id)) {
          selected.push(question)
          seen.add(question.id)
          progressed = true
          break
        }
      }
      if (bucket.length === 0) {
        buckets.delete(key)
      }
      if (selected.length >= limit) {
        break
      }
    }
    if (!progressed) {
      break
    }
  }
  return selected
}

/**
 * Choose the questions of a placement test.
 *
 * Mirrors `_select_ratio_questions`: the challenge questions come first, the
 * core questions fill the rest, and anything still missing is topped up from
 * the full pool.
 *
 * @param rows the candidate questions.
 * @param limit the number of questions.
 */
function selectRatioQuestions(rows: QuestionRow[], limit: number): QuestionRow[] {
  const targets = ratioCounts(limit)
  const core = rows.filter((row) => challengeRole(row) === 'core')
  const challenge = rows.filter((row) => challengeRole(row) === 'challenge')

  const selected = [
    ...balancedQuestions(challenge, targets.challenge),
    ...balancedQuestions(core, targets.core),
  ]

  if (selected.length < limit) {
    const chosen = new Set(selected.map((row) => row.id))
    for (const question of balancedQuestions(rows, limit)) {
      if (!chosen.has(question.id)) {
        selected.push(question)
        chosen.add(question.id)
      }
    }
  }

  return selected.slice(0, limit)
}

/**
 * Render a question the way the legacy service does.
 *
 * @param question the question row.
 */
function questionPayload(question: QuestionRow) {
  return {
    id: question.id,
    skill_id: question.skill_id,
    grade_level: question.grade_level,
    question_type: question.question_type,
    difficulty: question.difficulty,
    question_text: question.question_text,
    choices: question.choices ?? [],
    correct_answer: question.correct_answer,
    explanation: question.explanation,
    hint: question.hint,
  }
}

childrenRoutes.post('/:childId/placement/start', requireAuth(), async (c) => {
  const child = await loadOwnedChild(c, c.req.param('childId'))
  const sql = c.get('sql')

  const subjectRows = (await sql.query(
    `SELECT id FROM subjects WHERE code = 'math' LIMIT 1`,
  )) as Array<{ id: string }>
  const subject = subjectRows[0]
  if (!subject) {
    throw new HttpError(500, 'Internal Server Error')
  }

  const rows = (await sql.query(
    `SELECT id, skill_id, grade_level, question_type, difficulty, question_text,
            choices, correct_answer, explanation, hint, metadata
     FROM questions
     WHERE grade_level = $1 AND status = 'approved'`,
    [child.grade_level],
  )) as QuestionRow[]

  const questions = selectRatioQuestions(rows, 25)
  const coreCount = questions.filter((question) => challengeRole(question) === 'core').length
  const challengeCount = questions.length - coreCount
  const metadata = {
    question_ids: questions.map((question) => question.id),
    core_question_count: coreCount,
    challenge_question_count: challengeCount,
    ratio_policy: RATIO_POLICY,
  }

  const sessionId = crypto.randomUUID()
  await sql.query(
    `INSERT INTO quiz_sessions (
       id, child_profile_id, subject_id, mode, started_at, completed_at,
       total_questions, correct_count, total_xp_earned, metadata
     ) VALUES ($1, $2, $3, 'placement', now(), NULL, $4, 0, 0, $5::jsonb)`,
    [sessionId, child.id, subject.id, questions.length, JSON.stringify(metadata)],
  )

  return fastApiJson(c, {
    session_id: sessionId,
    questions: questions.map((question) => questionPayload(question)),
  })
})

/**
 * A validation error in the shape FastAPI's request validation produces.
 *
 * Pydantic v2 reports one entry per rejected field, and FastAPI puts the
 * list into `detail`.
 *
 * @param type the Pydantic error type.
 * @param field the field the error belongs to.
 * @param msg the human readable message.
 * @param input the rejected value.
 * @param ctx the constraint that was violated.
 */
function validationError(
  type: string,
  field: string,
  msg: string,
  input: unknown,
  ctx?: Record<string, unknown>,
): Record<string, unknown> {
  const error: Record<string, unknown> = { type, loc: ['body', field], msg, input }
  if (ctx) {
    error['ctx'] = ctx
  }
  return error
}

/**
 * Validate the personalized-practice payload.
 *
 * Mirrors `PersonalizedPracticeIn`: the grade level, the skill and the
 * mastery score are required, the rest has defaults. The error list is
 * built in the field order of the request model, the way pydantic reports
 * it.
 *
 * @param body the request body.
 */
function parsePracticePayload(body: Record<string, unknown>): {
  skill_id: string
  target_difficulty: string
  mistake_type: string
} {
  const errors: Array<Record<string, unknown>> = []

  const gradeLevel = body['grade_level']
  if (gradeLevel === undefined) {
    errors.push(validationError('missing', 'grade_level', 'Field required', body))
  } else if (typeof gradeLevel === 'number' && !Number.isInteger(gradeLevel)) {
    errors.push(
      validationError(
        'int_from_float',
        'grade_level',
        'Input should be a valid integer, got a number with a fractional part',
        gradeLevel,
      ),
    )
  } else if (typeof gradeLevel !== 'number') {
    errors.push(
      validationError(
        typeof gradeLevel === 'string' ? 'int_parsing' : 'int_type',
        'grade_level',
        typeof gradeLevel === 'string'
          ? 'Input should be a valid integer, unable to parse string as an integer'
          : 'Input should be a valid integer',
        gradeLevel,
      ),
    )
  } else if (gradeLevel < 1) {
    errors.push(
      validationError(
        'greater_than_equal',
        'grade_level',
        'Input should be greater than or equal to 1',
        gradeLevel,
        { ge: 1 },
      ),
    )
  } else if (gradeLevel > 6) {
    errors.push(
      validationError(
        'less_than_equal',
        'grade_level',
        'Input should be less than or equal to 6',
        gradeLevel,
        { le: 6 },
      ),
    )
  }

  const skillId = body['skill_id']
  if (skillId === undefined) {
    errors.push(validationError('missing', 'skill_id', 'Field required', body))
  } else if (typeof skillId !== 'string') {
    errors.push(
      validationError('string_type', 'skill_id', 'Input should be a valid string', skillId),
    )
  }

  const masteryScore = body['mastery_score']
  if (masteryScore === undefined) {
    errors.push(validationError('missing', 'mastery_score', 'Field required', body))
  } else if (typeof masteryScore !== 'number') {
    errors.push(
      validationError(
        typeof masteryScore === 'string' ? 'float_parsing' : 'float_type',
        'mastery_score',
        typeof masteryScore === 'string'
          ? 'Input should be a valid number, unable to parse string as a number'
          : 'Input should be a valid number',
        masteryScore,
      ),
    )
  } else if (masteryScore < 0) {
    errors.push(
      validationError(
        'greater_than_equal',
        'mastery_score',
        'Input should be greater than or equal to 0',
        masteryScore,
        { ge: pyFloat(0) },
      ),
    )
  } else if (masteryScore > 100) {
    errors.push(
      validationError(
        'less_than_equal',
        'mastery_score',
        'Input should be less than or equal to 100',
        masteryScore,
        { le: pyFloat(100) },
      ),
    )
  }

  if (errors.length > 0) {
    // FastAPI puts the list of validation errors into `detail`.
    throw new HttpError(422, errors as unknown as Record<string, unknown>)
  }

  return {
    skill_id: skillId as string,
    target_difficulty:
      typeof body['target_difficulty'] === 'string' ? body['target_difficulty'] : 'easy',
    mistake_type: typeof body['mistake_type'] === 'string' ? body['mistake_type'] : 'calculation_error',
  }
}

childrenRoutes.post('/:childId/personalized-practice/generate', requireAuth(), async (c) => {
  await loadOwnedChild(c, c.req.param('childId'))
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
  const payload = parsePracticePayload(body)

  // The legacy service uses the mock provider, which always produces the
  // same ten questions for a skill.
  const questions = []
  for (let index = 1; index <= 10; index += 1) {
    questions.push({
      question_text: `ข้อที่ ${index}: 2 + ${index} = ?`,
      question_type: 'multiple_choice',
      choices: [String(index + 1), String(index + 2), String(index + 3), String(index + 4)],
      correct_answer: String(index + 2),
      explanation: `2 + ${index} เท่ากับ ${index + 2}`,
      hint: 'เริ่มนับต่อจาก 2',
      skill_id: payload.skill_id,
      difficulty: payload.target_difficulty,
      mistake_type_target: payload.mistake_type,
    })
  }

  return fastApiJson(c, {
    lesson_summary: 'ลองฝึกทีละขั้น แล้วตรวจคำตอบอย่างใจเย็น',
    teaching_strategy: 'ใช้ตัวอย่างสั้น ๆ และตัวเลขไม่ซับซ้อน',
    questions,
  })
})

childrenRoutes.get('/:childId/avatar', requireAuth(), async (c) => {
  const child = await loadOwnedChild(c, c.req.param('childId'))
  return fastApiJson(c, {
    avatar_gender: child.avatar_gender,
    avatar_config: child.avatar_config || {},
  })
})
