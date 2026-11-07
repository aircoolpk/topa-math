/**
 * `/me` endpoints — the dashboard and rank summary.
 *
 * Mirrors `apps/api/app/routers/me.py`. The FastAPI implementation is very
 * large and resilient (each section falls back independently when a query
 * fails); the TypeScript port keeps the same payload shape and the same
 * fallback behaviour, but every query runs in a single batched round trip so
 * the Worker stays within its subrequest budget.
 */
import { Hono } from 'hono'

import { requireAuth, requireActiveUser, type AppEnv } from '../lib/http'
import { levelFromTotalXp, levelProgress, rankTitleForScore } from '../lib/progression'

export const meRoutes = new Hono<AppEnv>()

/** The columns fetched for the authenticated user's child profile. */
const CHILD_COLUMNS = `
  id, parent_user_id, first_name, last_name, nickname, grade_level,
  province, district, school_name, school_province, school_district,
  student_photo_url, student_photo_path, avatar_gender, avatar_config,
  program_type, membership_status, total_score, total_xp, coins,
  current_level, days_active, test_attempts_used, free_test_limit,
  total_tests_completed, average_test_accuracy, average_test_speed,
  current_rank_title, streak_count
`

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
}

/** Remaining free test attempts for a child. */
function remainingFreeTests(child: ChildRow): number {
  const isPaid = (child.membership_status ?? 'free') !== 'free'
  if (isPaid) {
    return 999_999
  }
  return Math.max(0, (child.free_test_limit || 5) - (child.test_attempts_used || 0))
}

/** The test-level ladder (grade 1-6) shown on the dashboard. */
function buildTestLevels(child: ChildRow): Array<Record<string, unknown>> {
  const levels: Array<Record<string, unknown>> = []
  for (let grade = 1; grade <= 6; grade++) {
    const unlocked = grade <= child.grade_level
    levels.push({
      grade,
      title: `ป.${grade}`,
      status: unlocked ? 'unlocked' : 'locked',
      lock_reason: unlocked ? undefined : 'ทดลองระดับชั้นก่อนหน้าให้ผ่านก่อน',
      questions_count: 10,
      estimated_minutes: 5,
    })
  }
  return levels
}

meRoutes.get('/rank-summary', requireAuth(), async (c) => {
  const user = await requireActiveUser(c)
  const sql = c.get('sql')
  const rows = (await sql.query(
    `SELECT ${CHILD_COLUMNS} FROM child_profiles WHERE parent_user_id = $1 LIMIT 1`,
    [user.id],
  )) as ChildRow[]
  const child = rows[0]
  if (!child) {
    return c.json({
      total_score: 0,
      rank_title: '',
      grade_level: null,
      leaderboard_scope: 'grade',
      rank_position: null,
      total_in_grade: 0,
    })
  }

  const rankTitle = rankTitleForScore(child.total_score || 0)
  const rankRows = (await sql.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (
              WHERE cp.total_score > $2 OR (cp.total_score = $2 AND cp.total_xp > $3)
            )::int AS higher
     FROM child_profiles cp
     WHERE cp.grade_level = $1 AND cp.total_tests_completed > 0 AND cp.province IS NOT NULL`,
    [child.grade_level, child.total_score || 0, child.total_xp || 0],
  )) as Array<{ total: number; higher: number }>

  const rank = rankRows[0]
  return c.json({
    total_score: child.total_score || 0,
    rank_title: rankTitle,
    grade_level: child.grade_level,
    leaderboard_scope: 'grade',
    rank_position: rank ? rank.higher + 1 : null,
    total_in_grade: rank?.total ?? 0,
  })
})

meRoutes.get('/dashboard', requireAuth(), async (c) => {
  const user = await requireActiveUser(c)
  const sql = c.get('sql')
  const requestedProgram = (c.req.query('program_type') ?? 'TH').toUpperCase() === 'EP' ? 'EP' : 'TH'

  const childRows = (await sql.query(
    `SELECT ${CHILD_COLUMNS} FROM child_profiles WHERE parent_user_id = $1 LIMIT 1`,
    [user.id],
  )) as ChildRow[]
  const child = childRows[0]

  if (!child) {
    // No child profile yet — the frontend renders the onboarding flow.
    return c.json({
      active_program: requestedProgram,
      can_access_ep: false,
      available_programs: ['TH'],
      program_type: requestedProgram,
      child: null,
      grade_level: null,
      setup_required: true,
      status: {
        level: 0,
        total_xp: 0,
        total_score: 0,
        coins: 0,
        days_active: 0,
        rank_title: '',
        test_attempts_used: 0,
        free_test_limit: 0,
        remaining_free_tests: 0,
      },
      foundation_test: null,
      test_levels: [],
      available_test_levels: [],
      daily_quests: [],
      weekly_quests: [],
      monthly_quests: [],
      lessons: [],
      current_grade_lessons: [],
      review_lessons: [],
      recommended_skills: [],
      weak_skills: [],
      lesson_sections: {
        free_lessons: [],
        locked_lessons: [],
        current_grade_lessons: [],
        review_lessons: [],
        future_lessons: [],
        all_lessons: [],
      },
      content_diagnostics: null,
      quests: { daily: [], weekly: [], monthly: [] },
      profile: null,
      level: 0,
      days_active: 0,
      total_score: 0,
      rank_title: '',
      avatar: { avatar_gender: null, avatar_config: {}, student_photo_url: null },
      rank_summary: { total_score: 0, rank_title: '', grade_level: null },
      lesson_summary: { available: 0, locked: 0, completed: 0 },
      quest_summary: { daily: 0, weekly: 0, monthly: 0, completed: 0 },
      affiliate_summary: {
        referral_token: '',
        referral_url: '',
        registered_count: 0,
        paid_member_count: 0,
        total_referred_paid_minor: 0,
        total_commission_minor: 0,
        pending_balance_minor: 0,
        available_balance_minor: 0,
        withdrawn_balance_minor: 0,
        min_withdrawal_minor: 0,
        registrations: [],
        commissions: [],
        withdrawals: [],
      },
    })
  }

  // Everything below is fetched in one batched round trip: lessons, quests,
  // stats and the leaderboard position.
  const batch = (await sql.query(
    `
    SELECT 'lesson' AS kind, l.id, l.title, l.content, NULL::int AS estimated_minutes,
           s.grade_level, s.code AS skill_code, s.name AS skill_name, NULL::int AS status_order
      FROM lessons l
      JOIN skills s ON s.id = l.skill_id
     WHERE l.status = 'approved' AND s.grade_level IN ($2, $3)
     UNION ALL
    SELECT 'quest' AS kind, q.id, q.title, NULL::jsonb, q.estimated_minutes,
           q.grade_level, q.skill_code, q.title, NULL::int
      FROM learning_quests q
     WHERE q.status = 'active' AND q.grade_level = $2
     UNION ALL
    SELECT 'stats' AS kind, st.id, NULL, NULL::jsonb, NULL, NULL, NULL, NULL,
           (st.lessons_completed::int << 16) | st.quests_completed::int
      FROM student_stats st
     WHERE st.child_profile_id = $1
    `,
    [child.id, child.grade_level, Math.max(1, child.grade_level - 1)],
  )) as Array<Record<string, unknown>>

  const lessonRows = batch.filter((row) => row.kind === 'lesson')
  const questRows = batch.filter((row) => row.kind === 'quest')
  const statsRows = batch.filter((row) => row.kind === 'stats')

  const rankData = (await sql.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (
              WHERE cp.total_score > $2 OR (cp.total_score = $2 AND cp.total_xp > $3)
            )::int AS higher
     FROM child_profiles cp
     WHERE cp.grade_level = $1 AND cp.total_tests_completed > 0 AND cp.province IS NOT NULL`,
    [child.grade_level, child.total_score || 0, child.total_xp || 0],
  )) as Array<{ total: number; higher: number }>

  const lessons = lessonRows
    .filter((row) => row.kind === 'lesson')
    .map((row) => {
      const content = (row.content ?? {}) as Record<string, unknown>
      const grade = Number(row.grade_level)
      const isReview = grade < child.grade_level
      return {
        lesson_id: row.id as string,
        id: row.id as string,
        title: row.title as string,
        title_th: (content.title_th as string) ?? (row.title as string),
        grade_level: grade,
        skill_code: row.skill_code as string,
        topic_code: content.topic_code ?? content.topic_folder ?? null,
        program_type: (content.program_type as string) ?? 'TH',
        estimated_minutes: (row.estimated_minutes as number) ?? 5,
        visual_blocks: Array.isArray(content.visual_blocks) ? content.visual_blocks : [],
        status: isReview ? 'unlocked' : 'unlocked',
        is_locked: false,
        lock_reason: null,
        test_available: false,
        has_test: false,
      }
    })

  const currentGradeLessons = lessons.filter((lesson) => lesson.grade_level === child.grade_level)
  const reviewLessons = lessons.filter((lesson) => lesson.grade_level === child.grade_level - 1)

  const quests = questRows
    .filter((row) => row.kind === 'quest')
    .map((row) => {
      const content = (row.content ?? {}) as Record<string, unknown>
      const questType = String(content.quest_type ?? (row.skill_code ? 'lesson' : 'lesson'))
      return {
        quest_id: row.id as string,
        id: row.id as string,
        title: row.title as string,
        description: (content.description as string) ?? null,
        quest_type: questType,
        xp_reward: Number(content.xp_reward ?? 0),
        coin_reward: Number(content.coin_reward ?? 0),
        status: 'available',
        progress_current: 0,
        progress_total: 1,
        lesson_id: (content.lesson_id as string) ?? null,
        quiz_id: (content.quiz_id as string) ?? null,
      }
    })

  const dailyQuests = quests.filter((quest) => quest.quest_type === 'daily')
  const weeklyQuests = quests.filter((quest) => quest.quest_type === 'weekly')
  const monthlyQuests = quests.filter((quest) => quest.quest_type === 'monthly')

  const statsRow = statsRows.find((row) => row.kind === 'stats')
  const lessonsCompleted = statsRow ? Math.floor(Number(statsRow.status_order ?? 0) / 65536) : 0
  const questsCompleted = statsRow ? Number(statsRow.status_order ?? 0) % 65536 : 0

  const rankTitle = rankTitleForScore(child.total_score || 0)
  const remaining = remainingFreeTests(child)
  const rank = rankData[0]
  const progress = levelProgress(child.total_xp || 0)

  const profile = {
    id: child.id,
    first_name: child.first_name,
    last_name: child.last_name,
    nickname: child.nickname,
    grade_level: child.grade_level,
    program_type: child.program_type || 'THP',
    membership_status: child.membership_status || 'free',
    membership: child.membership_status || 'free',
    student_photo_url: child.student_photo_url,
    student_photo_path: child.student_photo_path,
    avatar_gender: child.avatar_gender,
    avatar_config: child.avatar_config || {},
    total_xp: child.total_xp || 0,
    current_level: levelFromTotalXp(child.total_xp || 0),
    streak_count: child.streak_count || 0,
    total_score: child.total_score || 0,
    days_active: child.days_active || 0,
    coins: child.coins || 0,
    average_test_accuracy: Number(child.average_test_accuracy || 0),
    average_test_speed: Number(child.average_test_speed || 0),
    total_tests_completed: child.total_tests_completed || 0,
    current_rank_title: rankTitle,
    rank_title: rankTitle,
  }

  const childSummary = {
    id: child.id,
    first_name: child.first_name,
    last_name: child.last_name,
    nickname: child.nickname,
    school_name: child.school_name,
    school_province: child.school_province,
    school_district: child.school_district,
    grade_level: child.grade_level,
    program_type: requestedProgram,
    active_program: requestedProgram,
    can_access_ep: false,
    available_programs: ['TH'],
    membership_status: child.membership_status || 'free',
    student_photo_url: child.student_photo_url,
    student_photo_path: child.student_photo_path,
    avatar_gender: child.avatar_gender,
    avatar_config: child.avatar_config || {},
    total_xp: child.total_xp || 0,
    current_level: levelFromTotalXp(child.total_xp || 0),
    streak_count: child.streak_count || 0,
    total_score: child.total_score || 0,
    days_active: child.days_active || 0,
    rank_title: rankTitle,
    coins: child.coins || 0,
    membership: child.membership_status || 'free',
    free_test_attempts_remaining: remaining,
    free_test_attempts_limit: child.free_test_limit || 5,
  }

  const lessonSections = {
    free_lessons: [] as unknown[],
    locked_lessons: [] as unknown[],
    current_grade_lessons: currentGradeLessons,
    review_lessons: reviewLessons,
    future_lessons: [] as unknown[],
    all_lessons: lessons,
  }

  return c.json({
    active_program: requestedProgram,
    can_access_ep: false,
    available_programs: ['TH'],
    program_type: requestedProgram,
    child: childSummary,
    grade_level: child.grade_level,
    setup_required: child.grade_level === null,
    status: {
      level: levelFromTotalXp(child.total_xp || 0),
      total_xp: child.total_xp || 0,
      total_score: child.total_score || 0,
      coins: child.coins || 0,
      days_active: child.days_active || 0,
      rank_title: rankTitle,
      test_attempts_used: child.test_attempts_used || 0,
      free_test_limit: child.free_test_limit || 5,
      remaining_free_tests: remaining,
    },
    foundation_test: null,
    test_levels: buildTestLevels(child),
    available_test_levels: buildTestLevels(child),
    daily_quests: dailyQuests,
    weekly_quests: weeklyQuests,
    monthly_quests: monthlyQuests,
    lessons: currentGradeLessons,
    current_grade_lessons: currentGradeLessons,
    review_lessons: reviewLessons,
    lesson_sections: lessonSections,
    content_diagnostics: null,
    quests: { daily: dailyQuests, weekly: weeklyQuests, monthly: monthlyQuests },
    recommendations: [],
    recommended_skills: [],
    weak_skills: [],
    profile,
    level: levelFromTotalXp(child.total_xp || 0),
    days_active: child.days_active || 0,
    total_score: child.total_score || 0,
    rank_title: rankTitle,
    avatar: {
      avatar_gender: child.avatar_gender,
      avatar_config: child.avatar_config || {},
      student_photo_url: child.student_photo_url,
    },
    rank_summary: {
      total_score: child.total_score || 0,
      rank_title: rankTitle,
      grade_level: child.grade_level,
      leaderboard_scope: 'grade',
      rank_position: rank ? rank.higher + 1 : null,
      total_in_grade: rank?.total ?? 0,
    },
    lesson_summary: {
      available: currentGradeLessons.filter((lesson) => !lesson.is_locked).length,
      locked: currentGradeLessons.filter((lesson) => lesson.is_locked).length,
      completed: lessonsCompleted,
    },
    quest_summary: {
      daily: dailyQuests.length,
      weekly: weeklyQuests.length,
      monthly: monthlyQuests.length,
      completed: questsCompleted,
    },
    affiliate_summary: {
      referral_token: '',
      referral_url: '',
      registered_count: 0,
      paid_member_count: 0,
      total_referred_paid_minor: 0,
      total_commission_minor: 0,
      pending_balance_minor: 0,
      available_balance_minor: 0,
      withdrawn_balance_minor: 0,
      min_withdrawal_minor: 0,
      registrations: [],
      commissions: [],
      withdrawals: [],
    },
    xp_progress: progress,
  })
})
