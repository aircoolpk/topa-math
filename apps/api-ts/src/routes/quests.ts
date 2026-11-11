/**
 * `/me/quests…` endpoints — the fixed quest catalogue and the quest actions.
 *
 * Mirrors `apps/api/app/routers/me.py`:
 *
 *  - `GET /me/quests/daily|weekly|monthly` → `_fixed_quests`, which answers
 *    with plain dicts (not a Pydantic model) built by `_fixed_quest_payload`.
 *  - `POST /me/quests/{quest_id}/start|complete` → `_quest_out` wrapped in a
 *    `QuestActionOut`.
 *  - `POST /me/quests/{quest_id}/claim` → the reward-claim payload.
 *
 * The catalogue is generated from the fixed quest table, so the endpoints
 * also maintain the `learning_quests` rows the legacy service upserts while
 * it renders them (`_fixed_quest_template`).
 */
import { Hono, type Context } from 'hono'

import type { Sql } from '../lib/db'
import { badRequest, conflict, notFound } from '../lib/errors'
import { pyFloat, toFastApiJson } from '../lib/fastapiJson'
import { requireAuth, requireActiveUser, type AppEnv } from '../lib/http'
import { levelFromTotalXp, rankTitleForScore } from '../lib/progression'
import {
  CHILD_QUEST_COLUMNS,
  FIXED_QUESTS,
  QUEST_COLUMNS,
  meQuestToOut,
  periodKey,
  periodWindow,
  questScoreReward,
  questTarget,
  roundLikePython,
  type ChildQuestRow,
  type LearningQuestRow,
  type QuestOut,
  type RecurrenceType,
} from '../lib/quests'

export const questRoutes = new Hono<AppEnv>()

/** The recurrence buckets the catalogue exposes. */
const PERIODS: readonly RecurrenceType[] = ['daily', 'weekly', 'monthly']

/** A fixed quest specification: slug, title, description, metric, target, reward. */
type FixedQuestSpec = readonly [string, string, string, string, number, number]

/** The child profile fields the quest endpoints read and write. */
interface ChildRow {
  id: string
  grade_level: number
  total_xp: number
  total_score: number
  coins: number
  current_level: number
  current_rank_title: string
}

/** The columns fetched for the authenticated user's child profile. */
const CHILD_COLUMNS = `
  id, grade_level, total_xp, total_score, coins, current_level, current_rank_title
`

/**
 * Render a payload the way Starlette's `JSONResponse` does.
 *
 * Pydantic renders the `progress_percent` float as `0.0` where
 * `JSON.stringify` would write `0`, so the quest payloads go through
 * `toFastApiJson` to stay byte-identical to the legacy service.
 *
 * @param c the request context.
 * @param payload the payload to render.
 */
function fastApiJson(c: Context<AppEnv>, payload: unknown) {
  return c.body(toFastApiJson(payload), 200, { 'content-type': 'application/json' })
}

/**
 * Load the child profile of the authenticated user.
 *
 * Mirrors `_profile`: a parent without a student profile gets a 404.
 *
 * @param c the request context.
 */
async function loadProfile(c: Context<AppEnv>): Promise<ChildRow> {
  const user = await requireActiveUser(c)
  const sql = c.get('sql')
  const rows = (await sql.query(
    `SELECT ${CHILD_COLUMNS} FROM child_profiles WHERE parent_user_id = $1 LIMIT 1`,
    [user.id],
  )) as ChildRow[]
  const child = rows[0]
  if (!child) {
    throw notFound('ไม่พบโปรไฟล์นักเรียน')
  }
  return child
}

/**
 * Upsert the `learning_quests` templates of a period.
 *
 * Mirrors `_fixed_quest_template`: the row is looked up by its quest id only
 * — the fixed quests are shared by every child — and is then overwritten with
 * the catalogue values, including the child's grade level.
 *
 * @param sql the database handle.
 * @param gradeLevel the child's grade level.
 * @param period the recurrence bucket.
 * @param specs the fixed quest specifications of the period.
 */
async function upsertFixedQuests(
  sql: Sql,
  gradeLevel: number,
  period: RecurrenceType,
  specs: readonly FixedQuestSpec[],
): Promise<Map<string, LearningQuestRow>> {
  const rows = specs.map(([slug, title, description, metric, target, reward]) => ({
    id: crypto.randomUUID(),
    quest_id: `${period}-${slug}`,
    grade_level: gradeLevel,
    title,
    description,
    quest_type: metric,
    recurrence_type: period,
    xp_reward: reward,
    metadata: { metric_type: metric, target_count: target, score_reward: 0, fixed: true },
  }))
  const payload = JSON.stringify(rows)

  // Rows that do not exist yet are inserted …
  await sql.query(
    `INSERT INTO learning_quests (
       id, quest_id, grade_level, title, description, quest_type, recurrence_type,
       xp_reward, coin_reward, estimated_minutes, status, skill_code, lesson_id, quiz_id, metadata
     )
     SELECT s.id, s.quest_id, s.grade_level, s.title, s.description, s.quest_type, s.recurrence_type,
            s.xp_reward, 0, NULL, 'active', NULL, NULL, NULL, s.metadata
       FROM jsonb_to_recordset($1::jsonb) AS s(
         id text, quest_id text, grade_level integer, title text, description text,
         quest_type text, recurrence_type text, xp_reward integer, metadata jsonb
       )
      WHERE NOT EXISTS (
        SELECT 1 FROM learning_quests lq WHERE lq.quest_id = s.quest_id
      )`,
    [payload],
  )

  // … and every row is overwritten with the catalogue values. The legacy
  // service updates a single row per quest id, so the same row is picked here.
  await sql.query(
    `WITH picked AS (
       SELECT DISTINCT ON (s.quest_id) lq.id, s.quest_id
         FROM learning_quests lq
         JOIN jsonb_to_recordset($1::jsonb) AS s(quest_id text) ON lq.quest_id = s.quest_id
        ORDER BY s.quest_id, lq.created_at, lq.id
     )
     UPDATE learning_quests lq
        SET grade_level = s.grade_level,
            skill_code = NULL,
            title = s.title,
            description = s.description,
            quest_type = s.quest_type,
            recurrence_type = s.recurrence_type,
            xp_reward = s.xp_reward,
            coin_reward = 0,
            estimated_minutes = NULL,
            status = 'active',
            lesson_id = NULL,
            quiz_id = NULL,
            metadata = s.metadata,
            updated_at = now()
       FROM picked p
       JOIN jsonb_to_recordset($1::jsonb) AS s(
         id text, quest_id text, grade_level integer, title text, description text,
         quest_type text, recurrence_type text, xp_reward integer, metadata jsonb
       ) ON s.quest_id = p.quest_id
      WHERE lq.id = p.id`,
    [payload],
  )

  const templates = (await sql.query(
    `SELECT ${QUEST_COLUMNS}
       FROM learning_quests lq
      WHERE lq.quest_id IN (
        SELECT s.quest_id
          FROM jsonb_to_recordset($1::jsonb) AS s(quest_id text)
      )
      ORDER BY lq.created_at, lq.id`,
    [payload],
  )) as LearningQuestRow[]

  const byQuestId = new Map<string, LearningQuestRow>()
  for (const template of templates) {
    if (!byQuestId.has(template.quest_id)) {
      byQuestId.set(template.quest_id, template)
    }
  }
  return byQuestId
}

/**
 * Count the actions a child performed inside a period window.
 *
 * Mirrors `_metric_progress`: check-ins, distinct lessons and tests are
 * counted separately, and the `friend` metric has no counter at all.
 *
 * @param sql the database handle.
 * @param childId the child's profile id.
 * @param start the inclusive start of the window.
 * @param end the exclusive end of the window.
 */
async function metricProgress(
  sql: Sql,
  childId: string,
  start: string,
  end: string,
): Promise<Record<string, number>> {
  const rows = (await sql.query(
    `SELECT
       (SELECT count(*)::int FROM check_in_events
         WHERE child_profile_id = $1 AND created_at >= $2::timestamptz AND created_at < $3::timestamptz) AS check_in,
       (SELECT count(DISTINCT lesson_id)::int FROM lesson_activity
         WHERE child_profile_id = $1 AND created_at >= $2::timestamptz AND created_at < $3::timestamptz) AS lesson,
       (SELECT count(*)::int FROM test_results
         WHERE child_profile_id = $1 AND created_at >= $2::timestamptz AND created_at < $3::timestamptz
           AND accuracy >= 50) AS test_50,
       (SELECT count(*)::int FROM test_results
         WHERE child_profile_id = $1 AND created_at >= $2::timestamptz AND created_at < $3::timestamptz
           AND accuracy >= 100) AS test_100`,
    [childId, start, end],
  )) as Array<Record<string, number>>
  return rows[0] ?? {}
}

/**
 * The claim row plus the ISO timestamp of the claim.
 *
 * The legacy service renders `claim.completed_at.isoformat()`, which keeps
 * the microseconds of the stored timestamp. A JavaScript `Date` only holds
 * milliseconds, so the exact string is rendered by the database instead.
 */
interface ClaimRow extends ChildQuestRow {
  /** `completed_at` rendered the way Python's `datetime.isoformat()` does. */
  completed_at_iso: string | null
}

/**
 * The columns of a claim row.
 *
 * `completed_at` is rendered in UTC with the `+00:00` offset, and the
 * microseconds are dropped when they are zero — exactly what Python's
 * `datetime.isoformat()` does.
 */
const CLAIM_COLUMNS = `
  cq.id, cq.quest_id, cq.recurrence_type, cq.period_key, cq.status, cq.progress_current,
  cq.progress_target, cq.started_at, cq.completed_at, cq.xp_awarded, cq.coin_awarded, cq.score_awarded,
  CASE
    WHEN cq.completed_at IS NULL THEN NULL
    ELSE
      CASE
        WHEN date_part('microseconds', cq.completed_at)::int % 1000000 = 0
          THEN to_char(cq.completed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS')
          ELSE to_char(cq.completed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US')
      END || '+00:00'
  END AS completed_at_iso
`

/**
 * Load the child's claim rows of a period, keyed by the quest template id.
 *
 * Mirrors `_claim_row`: only the row of the current period counts.
 *
 * @param sql the database handle.
 * @param childId the child's profile id.
 * @param periodKey the key of the current period.
 * @param templateIds the ids of the quest templates.
 */
async function loadClaimRows(
  sql: Sql,
  childId: string,
  periodKey: string,
  templateIds: string[],
): Promise<Map<string, ClaimRow>> {
  if (templateIds.length === 0) {
    return new Map()
  }
  const rows = (await sql.query(
    `SELECT ${CLAIM_COLUMNS}
       FROM child_quests cq
      WHERE cq.child_profile_id = $1
        AND cq.period_key = $2
        AND cq.quest_id = ANY($3::varchar[])
      ORDER BY cq.created_at, cq.id`,
    [childId, periodKey, templateIds],
  )) as ClaimRow[]

  const byTemplate = new Map<string, ClaimRow>()
  for (const row of rows) {
    if (!byTemplate.has(row.quest_id)) {
      byTemplate.set(row.quest_id, row)
    }
  }
  return byTemplate
}

/**
 * Build the payload of one fixed quest.
 *
 * Mirrors `_fixed_quest_payload`: the status is `claimed` when the child
 * already claimed the reward, `claimable` when the metric progress reached
 * the target and `active` otherwise.
 *
 * @param period the recurrence bucket.
 * @param spec the fixed quest specification.
 * @param gradeLevel the child's grade level.
 * @param progressCurrent the metric progress, capped at the target.
 * @param target the number of actions the quest asks for.
 * @param reward the XP the quest awards.
 * @param claim the child's claim row for the current period, when there is one.
 * @param resetAt the moment the bucket resets.
 */
function fixedQuestPayload(
  period: RecurrenceType,
  spec: FixedQuestSpec,
  gradeLevel: number,
  progressCurrent: number,
  target: number,
  reward: number,
  claim: ClaimRow | null,
  resetAt: string,
): Record<string, unknown> {
  const [slug, title, description, metric] = spec
  const questId = `${period}-${slug}`
  const progressPercent = target ? pyFloat(roundLikePython((progressCurrent / target) * 100, 2)) : 0
  const claimed = Boolean(claim && claim.status === 'completed')
  const status = claimed ? 'claimed' : progressCurrent >= target ? 'claimable' : 'active'

  return {
    quest_id: questId,
    id: questId,
    title,
    title_th: title,
    description,
    description_th: description,
    quest_period: period,
    recurrence_type: period,
    quest_type: metric,
    metric_type: metric,
    grade_level: gradeLevel,
    skill_code: null,
    progress_current: progressCurrent,
    progress_total: target,
    progress_target: target,
    progress_percent: progressPercent,
    exp_reward: reward,
    xp_reward: reward,
    coin_reward: 0,
    score_reward: 0,
    status,
    child_status: status,
    can_claim_reward: status === 'claimable',
    claimed_at: claimed && claim?.completed_at_iso ? claim.completed_at_iso : null,
    reset_at: resetAt,
    estimated_minutes: null,
    lesson_id: null,
    quiz_id: null,
  }
}

/** The rendered state of one recurrence bucket. */
interface RenderedQuests {
  /** The period window the quests were rendered for. */
  window: ReturnType<typeof periodWindow>
  /** The `learning_quests` templates, keyed by quest id. */
  templates: Map<string, LearningQuestRow>
  /** The payloads, in catalogue order. */
  payloads: Array<Record<string, unknown>>
}

/**
 * Render the fixed quest catalogue of one period.
 *
 * Exported for the dashboard, which serves the same three catalogues.
 *
 * @param sql the database handle.
 * @param child the child profile.
 * @param period the recurrence bucket.
 * @param specs the fixed quest specifications to render.
 */
export async function renderFixedQuests(
  sql: Sql,
  child: ChildRow,
  period: RecurrenceType,
  specs: readonly FixedQuestSpec[],
): Promise<RenderedQuests> {
  const window = periodWindow(period)
  const templates = await upsertFixedQuests(sql, child.grade_level, period, specs)
  const claims = await loadClaimRows(
    sql,
    child.id,
    window.key,
    [...templates.values()].map((template) => template.id),
  )
  const progress = await metricProgress(
    sql,
    child.id,
    new Date(window.start).toISOString(),
    new Date(window.end).toISOString(),
  )

  const payloads = specs.map((spec) => {
    const [slug, , , metric, target, reward] = spec
    const template = templates.get(`${period}-${slug}`)
    const claim = template ? claims.get(template.id) ?? null : null
    const progressCurrent = Math.min(progress[metric] ?? 0, target)
    return fixedQuestPayload(
      period,
      spec,
      child.grade_level,
      progressCurrent,
      target,
      reward,
      claim,
      window.resetAt,
    )
  })

  return { window, templates, payloads }
}

/**
 * Load the quest template of a quest id for the child's grade level.
 *
 * Mirrors the `select(LearningQuest).where(quest_id == …, grade_level == …)`
 * lookup of the legacy service.
 *
 * @param sql the database handle.
 * @param questId the quest id.
 * @param gradeLevel the child's grade level.
 */
async function loadQuestTemplate(
  sql: Sql,
  questId: string,
  gradeLevel: number,
): Promise<LearningQuestRow | null> {
  const rows = (await sql.query(
    `SELECT ${QUEST_COLUMNS}
       FROM learning_quests
      WHERE quest_id = $1 AND grade_level = $2
      ORDER BY created_at, id
      LIMIT 1`,
    [questId, gradeLevel],
  )) as LearningQuestRow[]
  return rows[0] ?? null
}

/**
 * Load — or create — the child's row for a quest and a period.
 *
 * Mirrors `get_or_create_child_quest`: the row is scoped to the period key
 * of the quest's recurrence bucket, and a row without a recurrence bucket is
 * matched regardless of its period.
 *
 * @param sql the database handle.
 * @param childId the child's profile id.
 * @param quest the quest template.
 * @param key the period key of the quest's recurrence bucket.
 */
async function getOrCreateChildQuest(
  sql: Sql,
  childId: string,
  quest: LearningQuestRow,
  key: string | null,
): Promise<ChildQuestRow> {
  const rows = (await sql.query(
    `SELECT ${CHILD_QUEST_COLUMNS}
       FROM child_quests
      WHERE child_profile_id = $1 AND quest_id = $2
        AND ($3::varchar IS NULL OR period_key = $3)
      ORDER BY created_at, id
      LIMIT 1`,
    [childId, quest.id, key],
  )) as ChildQuestRow[]

  const existing = rows[0]
  if (existing) {
    return existing
  }

  const id = crypto.randomUUID()
  await sql.query(
    `INSERT INTO child_quests (
       id, child_profile_id, quest_id, recurrence_type, period_key,
       status, progress_current, progress_target, xp_awarded, coin_awarded, score_awarded
     ) VALUES ($1, $2, $3, $4, $5, 'not_started', 0, $6, 0, 0, 0)`,
    [id, childId, quest.id, quest.recurrence_type ?? 'none', key, questTarget(quest)],
  )

  const created = (await sql.query(
    `SELECT ${CHILD_QUEST_COLUMNS} FROM child_quests WHERE id = $1 LIMIT 1`,
    [id],
  )) as ChildQuestRow[]
  const row = created[0]
  if (!row) {
    throw new Error(`child_quests row ${id} was not created`)
  }
  return row
}

/**
 * Award the XP, score and coins of a finished quest.
 *
 * Mirrors `award_progress`: the child's totals grow, the level and the rank
 * title are refreshed and an XP event is recorded.
 *
 * @param sql the database handle.
 * @param child the child profile.
 * @param quest the quest template.
 * @param xp the XP to award.
 * @param score the score to award.
 * @param coins the coins to award.
 * @param sourceType the source of the XP.
 * @param description the description of the XP event.
 */
async function awardProgress(
  sql: Sql,
  child: ChildRow,
  quest: LearningQuestRow,
  xp: number,
  score: number,
  coins: number,
  sourceType: string,
  description: string,
): Promise<void> {
  const totalXp = (child.total_xp ?? 0) + xp
  const totalScore = (child.total_score ?? 0) + score
  const totalCoins = (child.coins ?? 0) + coins

  await sql.query(
    `UPDATE child_profiles
        SET total_xp = $2, total_score = $3, coins = $4,
            current_level = $5, current_rank_title = $6, updated_at = now()
      WHERE id = $1`,
    [
      child.id,
      totalXp,
      totalScore,
      totalCoins,
      levelFromTotalXp(totalXp),
      rankTitleForScore(totalScore),
    ],
  )

  await sql.query(
    `INSERT INTO xp_events (id, child_profile_id, source_type, source_id, xp_amount, description)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [crypto.randomUUID(), child.id, sourceType, quest.quest_id, xp, description],
  )
}

/**
 * Increment the number of quests the child finished.
 *
 * Mirrors `get_or_create_stats` followed by `stats.quests_completed += 1`.
 *
 * @param sql the database handle.
 * @param childId the child's profile id.
 */
async function bumpQuestsCompleted(sql: Sql, childId: string): Promise<void> {
  const rows = (await sql.query(
    'SELECT id, quests_completed FROM student_stats WHERE child_profile_id = $1 LIMIT 1',
    [childId],
  )) as Array<{ id: string; quests_completed: number | null }>

  const stats = rows[0]
  if (!stats) {
    await sql.query(
      `INSERT INTO student_stats (id, child_profile_id, quests_completed)
       VALUES ($1, $2, 1)`,
      [crypto.randomUUID(), childId],
    )
    return
  }

  await sql.query(
    'UPDATE student_stats SET quests_completed = $2, updated_at = now() WHERE id = $1',
    [stats.id, (stats.quests_completed ?? 0) + 1],
  )
}

/**
 * Re-read the child profile after a write.
 *
 * @param sql the database handle.
 * @param childId the child's profile id.
 */
async function reloadProfile(sql: Sql, childId: string): Promise<ChildRow | null> {
  const rows = (await sql.query(
    `SELECT ${CHILD_COLUMNS} FROM child_profiles WHERE id = $1 LIMIT 1`,
    [childId],
  )) as ChildRow[]
  return rows[0] ?? null
}

/**
 * Wrap a quest into the `QuestActionOut` payload.
 *
 * @param quest the quest template.
 * @param childQuest the child's quest row.
 * @param child the child profile.
 */
function questActionOut(quest: LearningQuestRow, childQuest: ChildQuestRow, child: ChildRow) {
  const out: QuestOut = meQuestToOut(quest, childQuest)
  return {
    quest: { ...out, progress_percent: pyFloat(out.progress_percent) },
    total_xp: child.total_xp ?? 0,
    total_score: child.total_score ?? 0,
    coins: child.coins ?? 0,
    current_level: child.current_level ?? 1,
  }
}

/* ───────────────────────────── fixed catalogue ───────────────────────────── */

questRoutes.get('/quests/daily', requireAuth(), async (c) => {
  const child = await loadProfile(c)
  const sql = c.get('sql')
  const rendered = await renderFixedQuests(sql, child, 'daily', FIXED_QUESTS.daily)
  return fastApiJson(c, rendered.payloads)
})

questRoutes.get('/quests/weekly', requireAuth(), async (c) => {
  const child = await loadProfile(c)
  const sql = c.get('sql')
  const rendered = await renderFixedQuests(sql, child, 'weekly', FIXED_QUESTS.weekly)
  return fastApiJson(c, rendered.payloads)
})

questRoutes.get('/quests/monthly', requireAuth(), async (c) => {
  const child = await loadProfile(c)
  const sql = c.get('sql')
  const rendered = await renderFixedQuests(sql, child, 'monthly', FIXED_QUESTS.monthly)
  return fastApiJson(c, rendered.payloads)
})

/* ───────────────────────────── quest actions ───────────────────────────── */

questRoutes.post('/quests/:questId/start', requireAuth(), async (c) => {
  const child = await loadProfile(c)
  const sql = c.get('sql')
  const questId = c.req.param('questId')

  const quest = await loadQuestTemplate(sql, questId, child.grade_level)
  if (!quest) {
    throw notFound('Quest not found')
  }

  const key = periodKey(quest.recurrence_type ?? 'daily')
  const childQuest = await getOrCreateChildQuest(sql, child.id, quest, key)

  if (childQuest.status === 'not_started') {
    await sql.query(
      `UPDATE child_quests
          SET status = 'in_progress', started_at = now(), updated_at = now()
        WHERE id = $1`,
      [childQuest.id],
    )
    childQuest.status = 'in_progress'
    childQuest.started_at = new Date().toISOString()
  }

  return fastApiJson(c, questActionOut(quest, childQuest, child))
})

questRoutes.post('/quests/:questId/complete', requireAuth(), async (c) => {
  const child = await loadProfile(c)
  const sql = c.get('sql')
  const questId = c.req.param('questId')

  const quest = await loadQuestTemplate(sql, questId, child.grade_level)
  if (!quest) {
    throw notFound('Quest not found')
  }

  const key = periodKey(quest.recurrence_type ?? 'daily')
  const childQuest = await getOrCreateChildQuest(sql, child.id, quest, key)

  if (childQuest.status !== 'completed') {
    const xp = quest.xp_reward ?? 0
    const coins = quest.coin_reward ?? 0
    const score = questScoreReward(quest)

    await sql.query(
      `UPDATE child_quests
          SET status = 'completed',
              completed_at = now(),
              progress_current = GREATEST(progress_current, progress_target),
              xp_awarded = $2,
              coin_awarded = $3,
              score_awarded = $4,
              updated_at = now()
        WHERE id = $1`,
      [childQuest.id, xp, coins, score],
    )

    childQuest.status = 'completed'
    childQuest.completed_at = new Date().toISOString()
    childQuest.progress_current = Math.max(
      childQuest.progress_current ?? 0,
      childQuest.progress_target ?? 0,
    )
    childQuest.xp_awarded = xp
    childQuest.coin_awarded = coins
    childQuest.score_awarded = score

    await bumpQuestsCompleted(sql, child.id)
    await awardProgress(sql, child, quest, xp, score, coins, 'quest_complete', quest.title)
  }

  const refreshed = (await reloadProfile(sql, child.id)) ?? child

  return fastApiJson(c, questActionOut(quest, childQuest, refreshed))
})

questRoutes.post('/quests/:questId/claim', requireAuth(), async (c) => {
  const child = await loadProfile(c)
  const sql = c.get('sql')
  const questId = c.req.param('questId')

  let period: RecurrenceType | null = null
  let spec: FixedQuestSpec | null = null
  for (const candidate of PERIODS) {
    const found = FIXED_QUESTS[candidate].find((entry) => `${candidate}-${entry[0]}` === questId)
    if (found) {
      period = candidate
      spec = found
      break
    }
  }
  if (!period || !spec) {
    throw notFound('ไม่พบเควสนี้')
  }

  const rendered = await renderFixedQuests(sql, child, period, [spec])
  const payload = rendered.payloads[0]
  if (!payload) {
    throw notFound('ไม่พบเควสนี้')
  }
  if (payload['status'] === 'claimed') {
    throw conflict('รับรางวัลเควสนี้แล้ว')
  }
  if (payload['status'] !== 'claimable') {
    throw badRequest('ยังทำเควสไม่สำเร็จ')
  }

  const [slug, title, , , target, reward] = spec
  const template = rendered.templates.get(`${period}-${slug}`)
  if (!template) {
    throw notFound('ไม่พบเควสนี้')
  }

  const claim = await getOrCreateChildQuest(sql, child.id, template, rendered.window.key)
  await sql.query(
    `UPDATE child_quests
        SET status = 'completed',
            progress_current = $2,
            progress_target = $2,
            completed_at = now(),
            xp_awarded = $3,
            coin_awarded = 0,
            score_awarded = 0,
            updated_at = now()
      WHERE id = $1`,
    [claim.id, target, reward],
  )

  await awardProgress(sql, child, template, reward, 0, 0, 'quest_claim', title)

  const updated = (await reloadProfile(sql, child.id)) ?? child
  return fastApiJson(c, {
    quest_id: template.quest_id,
    status: 'claimed',
    exp_awarded: reward,
    xp_awarded: reward,
    updated_status: {
      total_xp: updated.total_xp ?? 0,
      level: updated.current_level ?? 1,
      rank_title: updated.current_rank_title ?? '',
      coins: updated.coins ?? 0,
      total_score: updated.total_score ?? 0,
    },
  })
})
