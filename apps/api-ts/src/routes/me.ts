/**
 * `/me` endpoints — the dashboard and rank summary.
 *
 * Mirrors `apps/api/app/routers/me.py`. The FastAPI implementation is very
 * large and resilient (each section falls back independently when a query
 * fails); the TypeScript port keeps the same payload shape and the same
 * fallback behaviour, but every query runs in a single batched round trip so
 * the Worker stays within its subrequest budget.
 */
import { Hono, type Context } from 'hono'

import { badRequest, conflict, HttpError, notFound } from '../lib/errors'
import { pyFloat } from '../lib/fastapiJson'
import type { Sql } from '../lib/db'
import { requireAuth, requireActiveUser, type AppEnv } from '../lib/http'
import { levelFromTotalXp, levelProgress, rankTitleForScore } from '../lib/progression'
import { FIXED_QUESTS, periodWindow, roundLikePython } from '../lib/quests'
import {
  avatarFileUrl,
  backendBaseUrl,
  displayName,
  fastApiValidationError,
  isoTimestamp,
  jsonBody,
  last4,
  maskEmail,
  maskLast4,
  pydanticTimestamp,
  randomToken,
  referralUrl,
  shareUrls,
} from './me-avatar-shared'
import {
  buildContentDiagnostics,
  buildLessonSections,
  loadRecommendations,
  meLearningRoutes,
} from './me-learning'
import { renderFixedQuests, type ChildRow as QuestChildRow } from './quests'

/** A JSON value the dashboard hands to the response. */
type Json = Record<string, unknown>

export const meRoutes = new Hono<AppEnv>()

/**
 * The lesson catalogue and the test-run flow.
 *
 * The routes live in `me-learning.ts`; they are mounted here so that the
 * whole `/me` surface is served by one router.
 */
meRoutes.route('/', meLearningRoutes)

/** The columns fetched for the authenticated user's child profile. */
const CHILD_COLUMNS = `
  id, parent_user_id, first_name, last_name, nickname, grade_level,
  province, district, school_name, school_province, school_district,
  student_photo_url, student_photo_path, avatar_gender, avatar_config,
  program_type, membership_status, total_score, total_xp, coins,
  current_level, days_active, test_attempts_used, free_test_limit,
  total_tests_completed, average_test_accuracy, average_test_speed,
  current_rank_title, streak_count,
  created_at, updated_at
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
  created_at: string | null
  updated_at: string | null
}

/** Remaining free test attempts for a child. */
function remainingFreeTests(child: ChildRow): number {
  return Math.max(0, (child.free_test_limit || 5) - (child.test_attempts_used || 0))
}

/**
 * The skills the child should practise next.
 *
 * A skill that the child has a low mastery in points at the lesson that
 * teaches it. A child without any test result yet gets a diagnostic hint
 * instead, so the dashboard never suggests nothing.
 *
 * @param recommendations the low mastery skills.
 * @param reviewLessons the lessons of the previous grade.
 * @param currentLessons the lessons of the current grade.
 */
function buildWeakSkills(
  recommendations: Json[],
  reviewLessons: Json[],
  currentLessons: Json[],
): Json[] {
  if (recommendations.length) {
    return recommendations.slice(0, 3).map((row) => {
      const skillCode = (row.skill_code as string) ?? (row.skill_id as string) ?? 'foundation'
      const lesson =
        [...reviewLessons, ...currentLessons].find(
          (item) =>
            item.skill_code === skillCode || item.topic_code === skillCode,
        ) ?? null
      return {
        skill_code: skillCode,
        skill_name: (row.title_th as string) ?? 'ทบทวนพื้นฐาน',
        reason:
          (row.reason_th as string) ?? 'พบจุดที่ควรฝึกเพิ่มจากผลการทำแบบทดสอบ',
        recommended_lesson_id: lesson ? lesson.lesson_id : null,
        recommended_lesson_title: lesson ? (lesson.title_th ?? lesson.title) : null,
        recommended_practice_quiz_id: null,
        source: 'performance',
      }
    })
  }

  const foundation = (reviewLessons.length ? reviewLessons : currentLessons).slice(0, 3)
  const labels = [
    'พื้นฐานก่อนเริ่มบทใหม่',
    'ความคล่องในการคำนวณ',
    'การอ่านโจทย์เป็นขั้นตอน',
  ]
  return foundation.map((lesson, index) => ({
    skill_code:
      (lesson.skill_code as string) ?? (lesson.topic_code as string) ?? `foundation_${index + 1}`,
    skill_name: index < labels.length ? labels[index] : 'ทบทวนพื้นฐาน',
    reason: 'ยังมีข้อมูลผลทดสอบไม่มากพอ ระบบจึงแนะนำจุดตรวจพื้นฐานก่อน',
    recommended_lesson_id: lesson.lesson_id ?? null,
    recommended_lesson_title:
      (lesson.title_th as string) ?? (lesson.title as string) ?? (lesson.lesson_id as string),
    recommended_practice_quiz_id: null,
    source: 'diagnostic_heuristic',
  }))
}

/** Whether the child has a paid membership. */
function isPaid(child: ChildRow): boolean {
  return (child.membership_status ?? 'free') !== 'free'
}

/** The test-level ladder (grade 1-6) shown on the dashboard. */
/**
 * The grade ladder of the placement test.
 *
 * A free member may only take the test the system recommends, so every
 * other grade is locked with the reason the legacy service gives.
 */
function buildTestLevels(child: ChildRow): Array<Record<string, unknown>> {
  const recommended = recommendedFoundationGrade(child.grade_level)
  const paid = isPaid(child)
  const noFreeTests = !paid && remainingFreeTests(child) <= 0
  const levels: Array<Record<string, unknown>> = []
  for (let grade = 1; grade <= 6; grade++) {
    const locked = !paid && (grade !== recommended || noFreeTests)
    const lockReason = locked
      ? noFreeTests
        ? 'ใช้สิทธิ์เทสฟรีครบแล้ว กรุณาอัปเกรดเพื่อทำเทสเพิ่มเติม'
        : 'สมาชิกฟรีทำได้เฉพาะเทสที่ระบบแนะนำ'
      : null
    levels.push({
      grade,
      grade_level: grade,
      title: `คณิตศาสตร์ ป.${grade}`,
      title_th: `แบบทดสอบ ป.${grade}`,
      status: locked ? 'locked' : 'unlocked',
      is_locked: locked,
      lock_reason: lockReason,
      questions_count: 10,
      estimated_minutes: 15,
    })
  }
  return levels
}

/** The grade the placement test recommends for a child. */
function recommendedFoundationGrade(gradeLevel: number | null): number {
  if (!gradeLevel || gradeLevel <= 1) return 1
  return Math.max(1, Math.min(6, gradeLevel - 1))
}

/** The placement test the dashboard recommends. */
function buildFoundationTest(child: ChildRow): Record<string, unknown> {
  const grade = recommendedFoundationGrade(child.grade_level)
  const locked = !isPaid(child) && remainingFreeTests(child) <= 0
  return {
    recommended_grade: grade,
    recommended_grade_level: grade,
    title_th: `เทสพื้นฐาน ป.${grade}`,
    description_th: `แนะนำให้ทำเทสพื้นฐาน ป.${grade} เพื่อดูว่ามีจุดไหนที่ควรทบทวน`,
    is_required: true,
    is_locked: locked,
    reason_th: locked
      ? 'ใช้สิทธิ์เทสฟรีครบแล้ว กรุณาอัปเกรดเพื่อทำเทสเพิ่มเติม'
      : 'ใช้ฟรีได้ 5 ครั้งสำหรับเทสที่ระบบแนะนำ',
  }
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
  // A child only counts in the leaderboard once it has a grade, a province
  // and at least one completed test, exactly like the legacy service.
  const rankable = Boolean(
    child.grade_level && (child.total_tests_completed || 0) > 0 && child.province,
  )
  return c.json({
    total_score: child.total_score || 0,
    rank_title: rankTitle,
    grade_level: child.grade_level,
    leaderboard_scope: 'grade',
    rank_position: rank && rankable ? rank.higher + 1 : null,
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

  // The lesson catalogue and the quests do not come from a database read
  // here: the lessons come from the content snapshot and the quests from
  // the fixed catalogue, so this round trip only fetches the student stats.
  const batch = (await sql.query(
    `
    SELECT 'stats' AS kind, st.id, NULL, NULL::jsonb, NULL, NULL, NULL, NULL,
           (st.lessons_completed::int << 16) | st.quests_completed AS status_order
      FROM student_stats st
     WHERE st.child_profile_id = $1
    `,
    [child.id],
  )) as Array<Record<string, unknown>>

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

  // The lesson catalogue comes from the content snapshot so the public
  // lesson id is the topic slug (`g3_division`) and not the row id of the
  // database (`770b66e1-…`). The lesson endpoints resolve that slug, so a
  // dashboard built from the snapshot links to lessons that exist.
  const sectionGrades = new Set<number>([
    child.grade_level,
    Math.max(1, child.grade_level - 1),
  ])
  const sections = buildLessonSections(requestedProgram, child.grade_level, sectionGrades)
  const lessons = sections.all_lessons
  const currentGradeLessons = sections.current_grade_lessons
  const reviewLessons = sections.review_lessons

  // The daily, weekly and monthly quests come from the fixed catalogue,
  // the same source `/me/quests/daily` uses. Reading them from the
  // `learning_quests` table instead would return the grade-scoped rows
  // (`daily-g3-check-in`) next to the global ones (`daily-check-in`) and
  // would report a progress of zero for every quest.
  const questChild: QuestChildRow = {
    id: child.id,
    grade_level: child.grade_level,
    total_xp: child.total_xp || 0,
    total_score: child.total_score || 0,
    coins: child.coins || 0,
    current_level: child.current_level || 0,
    current_rank_title: child.current_rank_title || '',
  }
  // The three quest buckets are rendered one after the other: they share
  // the single Postgres connection of the test harness, and `pg` refuses a
  // second query while the first one is still running.
  const dailyRendered = await renderFixedQuests(sql, questChild, 'daily', FIXED_QUESTS.daily)
  const weeklyRendered = await renderFixedQuests(sql, questChild, 'weekly', FIXED_QUESTS.weekly)
  const monthlyRendered = await renderFixedQuests(sql, questChild, 'monthly', FIXED_QUESTS.monthly)
  const dailyQuests = dailyRendered.payloads
  const weeklyQuests = weeklyRendered.payloads
  const monthlyQuests = monthlyRendered.payloads

  const statsRow = statsRows.find((row) => row.kind === 'stats')
  const lessonsCompleted = statsRow ? Math.floor(Number(statsRow.status_order ?? 0) / 65536) : 0
  const questsCompleted = statsRow ? Number(statsRow.status_order ?? 0) % 65536 : 0

  // The skills the child should practise next, and the lessons that teach
  // them. The legacy service derives the weak skills from the mastery table
  // and falls back to a diagnostic hint when the child has no test result
  // yet.
  const recommendations = await loadRecommendations(sql, child.id)
  const weakSkills = buildWeakSkills(recommendations, reviewLessons, currentGradeLessons)

  const rankTitle = rankTitleForScore(child.total_score || 0)
  const remaining = remainingFreeTests(child)
  const rank = rankData[0]
  const progress = levelProgress(child.total_xp || 0)

  const profile = {
    id: child.id,
    first_name: child.first_name,
    last_name: child.last_name,
    nickname: child.nickname,
    province: child.province,
    district: child.district,
    school_name: child.school_name,
    school_province: child.school_province,
    school_district: child.school_district,
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
    test_attempts_used: child.test_attempts_used || 0,
    free_test_limit: child.free_test_limit || 5,
    created_at: isoTimestamp(child.created_at),
    updated_at: isoTimestamp(child.updated_at),
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
    free_lessons: sections.free_lessons,
    locked_lessons: sections.locked_lessons,
    current_grade_lessons: currentGradeLessons,
    review_lessons: reviewLessons,
    future_lessons: sections.future_lessons,
    all_lessons: lessons,
  }

  // The quests carry a Python float for their progress, which only
  // serialises correctly through the FastAPI-compatible JSON writer.
  return jsonBody(c, {
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
    foundation_test: buildFoundationTest(child),
    test_levels: buildTestLevels(child),
    available_test_levels: buildTestLevels(child),
    daily_quests: dailyQuests,
    weekly_quests: weeklyQuests,
    monthly_quests: monthlyQuests,
    lessons: currentGradeLessons,
    current_grade_lessons: currentGradeLessons,
    review_lessons: reviewLessons,
    lesson_sections: lessonSections,
    content_diagnostics: buildContentDiagnostics(requestedProgram, child.grade_level),
    review_content_diagnostics: buildContentDiagnostics(
      requestedProgram,
      Math.max(1, child.grade_level - 1),
    ),
    quests: { daily: dailyQuests, weekly: weeklyQuests, monthly: monthlyQuests },
    recommendations,
    recommended_skills: weakSkills,
    weak_skills: weakSkills,
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

/* ═══════════════════════════════════════════════════════════════════════════
 * Profile, stats, check-in, referral, affiliate and share endpoints.
 *
 * These mirror the remaining handlers of `apps/api/app/routers/me.py` and the
 * `/me/…` handlers of `apps/api/app/routers/share.py`.
 *
 * Two details of the legacy service are reproduced exactly:
 *
 *  - the timestamps keep their microseconds (the database is read with
 *    `to_char(…, 'US')`, because JavaScript's `Date` only keeps
 *    milliseconds),
 *  - the responses that go through pydantic (`response_model=…` or a
 *    `-> dict` annotation) render their timestamps as `…Z`, while the
 *    endpoints that FastAPI serialises straight from the ORM render them as
 *    `…+00:00`.
 * ═══════════════════════════════════════════════════════════════════════════ */

/** The columns of `child_profiles` the profile endpoints read. */
const PROFILE_COLUMNS = `
  id, parent_user_id, first_name, last_name, nickname, grade_level,
  province, district, school_name, school_province, school_district,
  student_photo_url, student_photo_path, avatar_gender, avatar_config,
  program_type, membership_status, total_score, total_xp, coins,
  current_level, days_active, test_attempts_used, free_test_limit,
  total_tests_completed, average_test_accuracy, average_test_speed,
  current_rank_title, streak_count,
  to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') AS created_at,
  to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') AS updated_at,
  to_char(last_active_date, 'YYYY-MM-DD') AS last_active_date
`

/** A row of `child_profiles` as the profile endpoints read it. */
interface ProfileRow {
  id: string
  parent_user_id: string
  first_name: string | null
  last_name: string | null
  nickname: string | null
  grade_level: number | null
  province: string | null
  district: string | null
  school_name: string | null
  school_province: string | null
  school_district: string | null
  student_photo_url: string | null
  student_photo_path: string | null
  avatar_gender: string | null
  avatar_config: Record<string, unknown> | null
  program_type: string | null
  membership_status: string | null
  total_score: number | null
  total_xp: number | null
  coins: number | null
  current_level: number | null
  days_active: number | null
  test_attempts_used: number | null
  free_test_limit: number | null
  total_tests_completed: number | null
  average_test_accuracy: string | number | null
  average_test_speed: string | number | null
  current_rank_title: string | null
  streak_count: number | null
  created_at: string
  updated_at: string
  last_active_date: string | null
}

/** The `ChildOut` payload (`child_to_out`). */
function childOut(child: ProfileRow) {
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
    average_test_accuracy: pyFloat(Number(child.average_test_accuracy || 0)),
    average_test_speed: pyFloat(Number(child.average_test_speed || 0)),
    current_rank_title: rankTitle,
    rank_title: rankTitle,
    streak_count: child.streak_count || 0,
    created_at: pydanticTimestamp(child.created_at),
    updated_at: pydanticTimestamp(child.updated_at),
  }
}

/**
 * Load the child profile of the authenticated user.
 *
 * A missing profile is a 404 in the legacy service as well.
 *
 * @param c the request context.
 */
async function loadProfile(c: Context<AppEnv>): Promise<ProfileRow> {
  const user = await requireActiveUser(c)
  const sql = c.get('sql')
  const rows = (await sql.query(
    `SELECT ${PROFILE_COLUMNS} FROM child_profiles WHERE parent_user_id = $1 LIMIT 1`,
    [user.id],
  )) as ProfileRow[]
  const child = rows[0]
  if (!child) {
    throw notFound('ไม่พบโปรไฟล์นักเรียน')
  }
  return child
}

/**
 * Make sure the user has a referral token and return it.
 *
 * @param c the request context.
 * @param userId the id of the user.
 */
async function ensureReferralToken(c: Context<AppEnv>, userId: string): Promise<string> {
  const sql = c.get('sql')
  const rows = (await sql.query('SELECT referral_token FROM users WHERE id = $1 LIMIT 1', [userId])) as Array<{
    referral_token: string | null
  }>
  const existing = rows[0]?.referral_token
  if (existing) {
    return existing
  }
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = randomToken(12)
    const clash = (await sql.query('SELECT id FROM users WHERE referral_token = $1 LIMIT 1', [token])) as Array<{
      id: string
    }>
    if (clash.length === 0) {
      await sql.query('UPDATE users SET referral_token = $1, updated_at = now() WHERE id = $2', [token, userId])
      return token
    }
  }
  throw new HttpError(500, 'Could not create referral token')
}

/**
 * The minimum withdrawal amount, in minor units.
 *
 * @param c the request context.
 */
function minWithdrawalMinor(c: Context<AppEnv>): number {
  const configured = c.env['AFFILIATE_MIN_WITHDRAWAL_MINOR']
  const value = Number(configured)
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : 50_000
}

/* ─────────────────────────────── profile ─────────────────────────────── */

meRoutes.get('/profile', requireAuth(), async (c) => {
  const child = await loadProfile(c)
  // `refresh_rank` recomputes the level and the rank title from the stored
  // XP and score — the legacy service does not persist them on a GET.
  const rankTitle = rankTitleForScore(child.total_score || 0)
  const level = levelFromTotalXp(child.total_xp || 0)
  return jsonBody(c, childOut({ ...child, current_level: level, current_rank_title: rankTitle }))
})

/** The fields `ChildUpdate` accepts. */
const PROFILE_UPDATE_FIELDS = new Set([
  'first_name',
  'last_name',
  'nickname',
  'grade_level',
  'province',
  'district',
  'school_name',
  'school_province',
  'school_district',
  'student_photo_url',
  'student_photo_path',
  'avatar_gender',
  'avatar_config',
  'program_type',
  'membership_status',
])

/** The literal values `ChildUpdate` accepts. */
const PROFILE_UPDATE_LITERALS: Record<string, readonly string[]> = {
  avatar_gender: ['girl', 'boy', 'unspecified'],
  program_type: ['THP', 'EP'],
  membership_status: ['free', 'trial', 'paid', 'plus'],
}

/** The maximum length of the string fields `ChildUpdate` accepts. */
const PROFILE_UPDATE_MAX_LENGTH: Record<string, number> = {
  first_name: 80,
  last_name: 80,
  nickname: 80,
}

/**
 * Validate a `ChildUpdate` payload.
 *
 * The errors are shaped like pydantic's, because the legacy service answers
 * with pydantic's validation report.
 *
 * @param body the request body.
 */
function validateProfileUpdate(body: Record<string, unknown>): Array<Record<string, unknown>> {
  const errors: Array<Record<string, unknown>> = []
  for (const [field, value] of Object.entries(body)) {
    if (!PROFILE_UPDATE_FIELDS.has(field)) {
      continue
    }
    if (value === null) {
      continue
    }
    const literals = PROFILE_UPDATE_LITERALS[field]
    if (literals) {
      if (typeof value !== 'string' || !literals.includes(value)) {
        errors.push({
          type: 'literal_error',
          loc: ['body', field],
          msg: `Input should be ${literals.map((item) => `'${item}'`).join(', ')}`,
          input: value,
          ctx: { expected: literals.map((item) => `'${item}'`).join(', ') },
        })
      }
      continue
    }
    if (field === 'avatar_config') {
      if (typeof value !== 'object' || Array.isArray(value)) {
        errors.push({
          type: 'dict_type',
          loc: ['body', field],
          msg: 'Input should be a valid dictionary',
          input: value,
        })
      }
      continue
    }
    if (field === 'grade_level') {
      const grade = Number(value)
      if (!Number.isInteger(grade) || grade < 1 || grade > 6) {
        errors.push({
          type: 'int_type',
          loc: ['body', field],
          msg: 'Input should be a valid integer',
          input: value,
        })
      }
      continue
    }
    if (typeof value !== 'string') {
      errors.push({
        type: 'string_type',
        loc: ['body', field],
        msg: 'Input should be a valid string',
        input: value,
      })
      continue
    }
    const maxLength = PROFILE_UPDATE_MAX_LENGTH[field]
    if (maxLength !== undefined && value.length > maxLength) {
      errors.push({
        type: 'string_too_long',
        loc: ['body', field],
        msg: `String should have at most ${maxLength} characters`,
        input: value,
        ctx: { max_length: maxLength },
      })
    }
    if (field === 'nickname' && value.length < 1) {
      errors.push({
        type: 'string_too_short',
        loc: ['body', field],
        msg: 'String should have at least 1 character',
        input: value,
        ctx: { min_length: 1 },
      })
    }
  }
  return errors
}

meRoutes.patch('/profile', requireAuth(), async (c) => {
  const child = await loadProfile(c)
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
  const errors = validateProfileUpdate(body)
  if (errors.length > 0) {
    throw fastApiValidationError(errors)
  }

  const assignments: string[] = []
  const values: unknown[] = []
  for (const [field, value] of Object.entries(body)) {
    if (!PROFILE_UPDATE_FIELDS.has(field)) {
      continue
    }
    values.push(field === 'avatar_config' ? JSON.stringify(value ?? {}) : value)
    assignments.push(`${field} = $${values.length}${field === 'avatar_config' ? '::jsonb' : ''}`)
  }

  const sql = c.get('sql')
  if (assignments.length > 0) {
    await sql.query(
      `UPDATE child_profiles SET ${assignments.join(', ')}, updated_at = now() WHERE id = $${values.length + 1}`,
      [...values, child.id],
    )
  }

  // `refresh_rank` runs before the commit, so the level and the rank title
  // are stored as well.
  const level = levelFromTotalXp(child.total_xp || 0)
  const rankTitle = rankTitleForScore(child.total_score || 0)
  await sql.query(
    'UPDATE child_profiles SET current_level = $1, current_rank_title = $2, updated_at = now() WHERE id = $3',
    [level, rankTitle, child.id],
  )

  const rows = (await sql.query(`SELECT ${PROFILE_COLUMNS} FROM child_profiles WHERE id = $1 LIMIT 1`, [
    child.id,
  ])) as ProfileRow[]
  return jsonBody(c, childOut(rows[0] as ProfileRow))
})

/* ──────────────────────────────── avatar ──────────────────────────────── */

meRoutes.get('/avatar', requireAuth(), async (c) => {
  const child = await loadProfile(c)
  return jsonBody(c, {
    avatar_gender: child.avatar_gender,
    avatar_config: child.avatar_config || {},
  })
})

meRoutes.patch('/avatar', requireAuth(), async (c) => {
  const child = await loadProfile(c)
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
  const errors = validateProfileUpdate(body)
  if (errors.length > 0) {
    throw fastApiValidationError(errors)
  }
  const sql = c.get('sql')
  if (typeof body.avatar_gender === 'string') {
    await sql.query('UPDATE child_profiles SET avatar_gender = $1, updated_at = now() WHERE id = $2', [
      body.avatar_gender,
      child.id,
    ])
  }
  if (body.avatar_config !== undefined && body.avatar_config !== null) {
    await sql.query(
      'UPDATE child_profiles SET avatar_config = $1::jsonb, updated_at = now() WHERE id = $2',
      [JSON.stringify(body.avatar_config), child.id],
    )
  }
  const rows = (await sql.query(
    'SELECT avatar_gender, avatar_config FROM child_profiles WHERE id = $1 LIMIT 1',
    [child.id],
  )) as Array<{ avatar_gender: string | null; avatar_config: Record<string, unknown> | null }>
  const row = rows[0]
  return jsonBody(c, {
    avatar_gender: row?.avatar_gender ?? null,
    avatar_config: row?.avatar_config || {},
  })
})

/* ──────────────────────────────── stats ──────────────────────────────── */

meRoutes.get('/stats', requireAuth(), async (c) => {
  const child = await loadProfile(c)
  const sql = c.get('sql')
  const rows = (await sql.query(
    'SELECT lessons_completed FROM student_stats WHERE child_profile_id = $1 LIMIT 1',
    [child.id],
  )) as Array<{ lessons_completed: number | null }>
  return jsonBody(c, {
    score: child.total_score || 0,
    speed: pyFloat(Number(child.average_test_speed || 0)),
    lesson_count: rows[0]?.lessons_completed ?? 0,
    test_count: child.total_tests_completed || 0,
    rank_title: child.current_rank_title,
    average_test_accuracy: pyFloat(Number(child.average_test_accuracy || 0)),
  })
})

/* ─────────────────────────────── check-in ─────────────────────────────── */

/**
 * Create or refresh the `learning_quests` row of a fixed quest.
 *
 * The fixed quests are shared by every child, so the row is looked up by its
 * quest id only and is then overwritten with the catalogue values — exactly
 * like `_fixed_quest_template` does. The row that is picked is the oldest
 * one, so every endpoint that touches the same quest id agrees on its id.
 *
 * @param sql the database handle.
 * @param quest the catalogue values of the quest.
 */
async function upsertFixedQuestRow(
  sql: Sql,
  quest: {
    questId: string
    gradeLevel: number
    title: string
    description: string
    metric: string
    target: number
    reward: number
  },
): Promise<string> {
  const metadata = JSON.stringify({
    metric_type: quest.metric,
    target_count: quest.target,
    score_reward: 0,
    fixed: true,
  })

  // A row that does not exist yet is inserted …
  await sql.query(
    `INSERT INTO learning_quests (
       id, quest_id, grade_level, skill_code, title, description, quest_type,
       recurrence_type, xp_reward, coin_reward, estimated_minutes, status,
       lesson_id, quiz_id, metadata, created_at, updated_at
     )
     SELECT $1::varchar(36), $2::varchar(120), $3::int, NULL, $4::varchar(180), $5::text,
            $6::varchar(40), 'daily', $7::int, 0, NULL, 'active', NULL, NULL, $8::jsonb, now(), now()
      WHERE NOT EXISTS (SELECT 1 FROM learning_quests lq WHERE lq.quest_id = $2::varchar(120))`,
    [
      crypto.randomUUID(),
      quest.questId,
      quest.gradeLevel,
      quest.title,
      quest.description,
      quest.metric,
      quest.reward,
      metadata,
    ],
  )

  // … and the row is overwritten with the catalogue values.
  const rows = (await sql.query(
    `WITH picked AS (
       SELECT id FROM learning_quests WHERE quest_id = $1::varchar(120) ORDER BY created_at, id LIMIT 1
     )
     UPDATE learning_quests lq
        SET grade_level = $2::int, skill_code = NULL, title = $3::varchar(180), description = $4::text,
            quest_type = $5::varchar(40), recurrence_type = 'daily', xp_reward = $6::int, coin_reward = 0,
            estimated_minutes = NULL, status = 'active', lesson_id = NULL, quiz_id = NULL,
            metadata = $7::jsonb, updated_at = now()
      FROM picked
      WHERE lq.id = picked.id
     RETURNING lq.id`,
    [
      quest.questId,
      quest.gradeLevel,
      quest.title,
      quest.description,
      quest.metric,
      quest.reward,
      metadata,
    ],
  )) as Array<{ id: string }>

  const id = rows[0]?.id
  if (!id) {
    throw new HttpError(500, 'Quest not found')
  }
  return id
}

meRoutes.post('/check-in', requireAuth(), async (c) => {
  const user = await requireActiveUser(c)
  const child = await loadProfile(c)
  const sql = c.get('sql')
  const window = periodWindow('daily', Date.now())
  const today = window.key

  // `get_or_create_stats` creates the row when it is missing.
  const statsRows = (await sql.query(
    'SELECT id, checkins FROM student_stats WHERE child_profile_id = $1 LIMIT 1',
    [child.id],
  )) as Array<{ id: string; checkins: number | null }>
  let statsId = statsRows[0]?.id
  if (!statsId) {
    await sql.query(
      `INSERT INTO student_stats (
         id, child_profile_id, lessons_completed, tests_completed, quests_completed,
         checkins, perfect_tests, created_at, updated_at
       ) VALUES ($1, $2, 0, 0, 0, 0, 0, now(), now())`,
      [crypto.randomUUID(), child.id],
    )
    const created = (await sql.query(
      'SELECT id, checkins FROM student_stats WHERE child_profile_id = $1 LIMIT 1',
      [child.id],
    )) as Array<{ id: string; checkins: number | null }>
    statsId = created[0]?.id
  }

  const alreadyRows = (await sql.query(
    'SELECT id FROM check_in_events WHERE child_profile_id = $1 AND event_date = $2 LIMIT 1',
    [child.id, today],
  )) as Array<{ id: string }>
  const already = alreadyRows.length > 0

  if (child.last_active_date !== today) {
    await sql.query(
      `UPDATE child_profiles
          SET days_active = COALESCE(days_active, 0) + 1,
              streak_count = COALESCE(streak_count, 0) + 1,
              last_active_date = $2,
              updated_at = now()
        WHERE id = $1`,
      [child.id, today],
    )
    await sql.query('UPDATE student_stats SET checkins = COALESCE(checkins, 0) + 1, updated_at = now() WHERE id = $1', [
      statsId,
    ])
  }
  if (!already) {
    await sql.query(
      `INSERT INTO check_in_events (id, child_profile_id, event_date, period_day, created_at)
       VALUES ($1, $2, $3::date, $4, now())`,
      [crypto.randomUUID(), child.id, today, today],
    )
  }

  // The daily check-in quest, exactly as `_fixed_quest_payload` builds it.
  const [slug, title, description, metric, target, reward] = FIXED_QUESTS.daily[0] as [
    string,
    string,
    string,
    string,
    number,
    number,
  ]
  const questId = `daily-${slug}`
  const questRowId = await upsertFixedQuestRow(sql, {
    questId,
    gradeLevel: child.grade_level || 1,
    title,
    description,
    metric,
    target,
    reward,
  })

  const claimRows = (await sql.query(
    `SELECT cq.status, to_char(cq.completed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') AS completed_at
       FROM child_quests cq
      WHERE cq.child_profile_id = $1 AND cq.quest_id = $2 AND cq.period_key = $3
      LIMIT 1`,
    [child.id, questRowId, today],
  )) as Array<{ status: string | null; completed_at: string | null }>
  const claim = claimRows[0]

  const checkInRows = (await sql.query(
    `SELECT COUNT(*)::int AS total
       FROM check_in_events
      WHERE child_profile_id = $1 AND created_at >= $2 AND created_at < $3`,
    [child.id, window.start.toISOString(), window.end.toISOString()],
  )) as Array<{ total: number }>
  const progressCurrent = Math.min(checkInRows[0]?.total ?? 0, target)
  const progressPercent = target ? roundLikePython((progressCurrent / target) * 100, 2) : 0
  const claimed = claim?.status === 'completed'
  const status = claimed ? 'claimed' : progressCurrent >= target ? 'claimable' : 'active'

  const updated = (await sql.query(
    `SELECT days_active, streak_count FROM child_profiles WHERE id = $1 LIMIT 1`,
    [child.id],
  )) as Array<{ days_active: number | null; streak_count: number | null }>

  return jsonBody(c, {
    checked_in: true,
    already_checked_in: already,
    days_active: updated[0]?.days_active ?? 0,
    streak_count: updated[0]?.streak_count ?? 0,
    quest: {
      quest_id: questId,
      id: questId,
      title,
      title_th: title,
      description,
      description_th: description,
      quest_period: 'daily',
      recurrence_type: 'daily',
      quest_type: metric,
      metric_type: metric,
      grade_level: child.grade_level,
      skill_code: null,
      progress_current: progressCurrent,
      progress_total: target,
      progress_target: target,
      progress_percent: pyFloat(progressPercent),
      exp_reward: reward,
      xp_reward: reward,
      coin_reward: 0,
      score_reward: 0,
      status,
      child_status: status,
      can_claim_reward: status === 'claimable',
      claimed_at: claimed && claim?.completed_at ? isoTimestamp(claim.completed_at) : null,
      reset_at: window.resetAt,
      estimated_minutes: null,
      lesson_id: null,
      quiz_id: null,
    },
  })
})

/** The legacy service only exposes `POST /me/check-in`. */
meRoutes.get('/check-in', async () => {
  throw new HttpError(405, 'Method Not Allowed')
})

/* ─────────────────────────────── referral ─────────────────────────────── */

meRoutes.get('/referral', requireAuth(), async (c) => {
  const user = await requireActiveUser(c)
  const token = await ensureReferralToken(c, user.id)
  const sql = c.get('sql')

  const eventRows = (await sql.query(
    'SELECT event_type, referred_user_id FROM referral_events WHERE referrer_user_id = $1',
    [user.id],
  )) as Array<{ event_type: string; referred_user_id: string | null }>

  const registered = new Set<string>()
  const paid = new Set<string>()
  let clicks = 0
  for (const event of eventRows) {
    if (event.event_type === 'clicked') {
      clicks += 1
    }
    if (event.event_type === 'registered' && event.referred_user_id) {
      registered.add(event.referred_user_id)
    }
    if (event.event_type === 'paid' && event.referred_user_id) {
      paid.add(event.referred_user_id)
    }
  }

  const ledgerRows = (await sql.query(
    `SELECT id, amount, type, status, reference_id,
            to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') AS created_at,
            to_char(activated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') AS activated_at,
            note
       FROM coin_ledger
      WHERE user_id = $1
      ORDER BY created_at DESC`,
    [user.id],
  )) as Array<{
    id: string
    amount: number
    type: string
    status: string
    reference_id: string | null
    created_at: string
    activated_at: string | null
    note: string | null
  }>

  let pendingCoins = 0
  let activeCoins = 0
  for (const row of ledgerRows) {
    if (row.status === 'pending') {
      pendingCoins += row.amount
    }
    if (row.status === 'active') {
      activeCoins += row.amount
    }
  }

  return jsonBody(c, {
    referral_token: token,
    referral_url: referralUrl(c, token),
    click_count: clicks,
    registered_count: registered.size,
    paid_count: paid.size,
    pending_coins: pendingCoins,
    active_coins: activeCoins,
    history: ledgerRows.map((row) => ({
      id: row.id,
      amount: row.amount,
      type: row.type,
      status: row.status,
      reference_id: row.reference_id,
      created_at: pydanticTimestamp(row.created_at),
      activated_at: row.activated_at ? pydanticTimestamp(row.activated_at) : null,
      note: row.note,
    })),
  })
})

/* ─────────────────────────────── affiliate ─────────────────────────────── */

/** The withdrawal statuses that count as "withdrawn". */
const ACTIVE_WITHDRAWAL_STATUSES = ['pending_review', 'approved', 'processing', 'paid']

/** The withdrawal statuses that block a new request. */
const OPEN_WITHDRAWAL_STATUSES = ['pending_review', 'approved', 'processing']

meRoutes.get('/affiliate', requireAuth(), async (c) => {
  const user = await requireActiveUser(c)
  const token = await ensureReferralToken(c, user.id)
  const sql = c.get('sql')

  // `refresh_available_commissions` moves the matured commissions.
  await sql.query(
    `UPDATE affiliate_commission_ledger
        SET status = 'available', updated_at = now()
      WHERE status = 'pending' AND available_at <= now() AND affiliate_user_id = $1`,
    [user.id],
  )

  // The registrations are the users that this user referred; the ledger
  // rows may point at users that are not in that list any more, so their
  // emails are looked up separately.
  const registrationRows = (await sql.query(
    `SELECT id, email,
            to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') AS created_at
       FROM users
      WHERE referred_by_user_id = $1
      ORDER BY created_at DESC`,
    [user.id],
  )) as Array<{ id: string; email: string | null; created_at: string }>

  const ledgerRows = (await sql.query(
    `SELECT id, referred_user_id, payment_reference_id, amount_paid_minor, commission_minor,
            currency, rate_bps, status,
            to_char(available_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') AS available_at,
            to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') AS created_at
       FROM affiliate_commission_ledger
      WHERE affiliate_user_id = $1
      ORDER BY created_at DESC`,
    [user.id],
  )) as Array<{
    id: string
    referred_user_id: string
    payment_reference_id: string
    amount_paid_minor: number
    commission_minor: number
    currency: string
    rate_bps: number
    status: string
    available_at: string | null
    created_at: string
  }>

  const emailRows = (await sql.query(
    `SELECT id, email FROM users
      WHERE id = ANY(SELECT referred_user_id FROM affiliate_commission_ledger WHERE affiliate_user_id = $1)`,
    [user.id],
  )) as Array<{ id: string; email: string | null }>
  const emailById = new Map(emailRows.map((row) => [row.id, row.email ?? null]))
  const registrations = registrationRows

  const withdrawalRows = (await sql.query(
    `SELECT id, user_id, amount_minor, currency, status, admin_note,
            to_char(requested_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') AS requested_at,
            to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') AS updated_at,
            to_char(paid_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') AS paid_at
       FROM affiliate_withdrawal_requests
      WHERE user_id = $1
      ORDER BY requested_at DESC`,
    [user.id],
  )) as Array<{
    id: string
    user_id: string
    amount_minor: number
    currency: string
    status: string
    admin_note: string | null
    requested_at: string
    updated_at: string
    paid_at: string | null
  }>

  const accountRows = (await sql.query(
    `SELECT id, payout_method, account_holder_name, bank_name, account_last4, promptpay_last4,
            to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') AS updated_at
       FROM affiliate_payout_accounts
      WHERE user_id = $1
      LIMIT 1`,
    [user.id],
  )) as Array<{
    id: string
    payout_method: string
    account_holder_name: string
    bank_name: string | null
    account_last4: string | null
    promptpay_last4: string | null
    updated_at: string
  }>
  const account = accountRows[0]

  const paidUserIds = new Set(
    ledgerRows.filter((row) => row.status !== 'reversed').map((row) => row.referred_user_id),
  )

  let totalReferredPaid = 0
  let totalCommission = 0
  let pendingBalance = 0
  let availableBalance = 0
  for (const row of ledgerRows) {
    if (row.status !== 'reversed') {
      totalReferredPaid += row.amount_paid_minor
      totalCommission += row.commission_minor
    }
    if (row.status === 'pending') {
      pendingBalance += row.commission_minor
    }
    if (row.status === 'available') {
      availableBalance += row.commission_minor
    }
  }
  let withdrawnBalance = 0
  for (const row of withdrawalRows) {
    if (ACTIVE_WITHDRAWAL_STATUSES.includes(row.status)) {
      withdrawnBalance += row.amount_minor
    }
  }

  return jsonBody(c, {
    referral_token: token,
    referral_url: referralUrl(c, token),
    registered_count: registrations.length,
    paid_member_count: paidUserIds.size,
    total_referred_paid_minor: totalReferredPaid,
    total_commission_minor: totalCommission,
    pending_balance_minor: pendingBalance,
    available_balance_minor: availableBalance,
    withdrawn_balance_minor: withdrawnBalance,
    min_withdrawal_minor: minWithdrawalMinor(c),
    payout_account: account
      ? {
          id: account.id,
          payout_method: account.payout_method,
          account_holder_name: account.account_holder_name,
          bank_name: account.bank_name,
          account_masked: maskLast4(account.account_last4),
          promptpay_masked: maskLast4(account.promptpay_last4),
          updated_at: pydanticTimestamp(account.updated_at),
        }
      : null,
    registrations: registrations.map((row) => ({
      user_id: row.id,
      email_masked: maskEmail(row.email),
      created_at: pydanticTimestamp(row.created_at),
      has_paid: paidUserIds.has(row.id),
    })),
    commissions: ledgerRows.map((row) => ({
      id: row.id,
      referred_user_id: row.referred_user_id,
      referred_email_masked: maskEmail(emailById.get(row.referred_user_id) ?? null),
      payment_reference_id: row.payment_reference_id,
      amount_paid_minor: row.amount_paid_minor,
      commission_minor: row.commission_minor,
      currency: row.currency,
      rate_bps: row.rate_bps,
      status: row.status,
      available_at: row.available_at ? pydanticTimestamp(row.available_at) : null,
      created_at: pydanticTimestamp(row.created_at),
    })),
    withdrawals: withdrawalRows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      amount_minor: row.amount_minor,
      currency: row.currency,
      status: row.status,
      admin_note: row.admin_note,
      requested_at: pydanticTimestamp(row.requested_at),
      updated_at: pydanticTimestamp(row.updated_at),
      paid_at: row.paid_at ? pydanticTimestamp(row.paid_at) : null,
    })),
  })
})

meRoutes.put('/affiliate/payout-account', requireAuth(), async (c) => {
  const user = await requireActiveUser(c)
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
  const sql = c.get('sql')

  const errors: Array<Record<string, unknown>> = []
  if (body.payout_method === undefined || body.payout_method === null) {
    errors.push({ type: 'missing', loc: ['body', 'payout_method'], msg: 'Field required', input: body })
  }
  if (body.account_holder_name === undefined || body.account_holder_name === null) {
    errors.push({ type: 'missing', loc: ['body', 'account_holder_name'], msg: 'Field required', input: body })
  } else if (typeof body.account_holder_name !== 'string') {
    errors.push({
      type: 'string_type',
      loc: ['body', 'account_holder_name'],
      msg: 'Input should be a valid string',
      input: body.account_holder_name,
    })
  } else if (body.account_holder_name.length < 1 || body.account_holder_name.length > 160) {
    errors.push({
      type: 'string_too_short',
      loc: ['body', 'account_holder_name'],
      msg: 'String should have at least 1 character',
      input: body.account_holder_name,
      ctx: { min_length: 1 },
    })
  }
  if (errors.length > 0) {
    throw fastApiValidationError(errors)
  }

  const method = String(body.payout_method).toLowerCase().trim()
  const holder = String(body.account_holder_name).trim()
  const bankName = typeof body.bank_name === 'string' ? body.bank_name.trim() : null
  const accountNumber = typeof body.account_number === 'string' ? body.account_number.trim() : null
  const promptpayValue = typeof body.promptpay_value === 'string' ? body.promptpay_value.trim() : null

  if (method !== 'bank' && method !== 'promptpay') {
    throw badRequest('Invalid payout_method')
  }
  if (method === 'bank' && (!bankName || !accountNumber)) {
    throw badRequest('bank_name and account_number are required')
  }
  if (method === 'promptpay' && !promptpayValue) {
    throw badRequest('promptpay_value is required')
  }

  const details = JSON.stringify({
    payout_method: method,
    bank_name: bankName,
    account_number: accountNumber,
    promptpay_value: promptpayValue,
  })
  const accountLast4 = method === 'bank' ? last4(accountNumber) : null
  const promptpayLast4 = method === 'promptpay' ? last4(promptpayValue) : null

  const existing = (await sql.query(
    'SELECT id FROM affiliate_payout_accounts WHERE user_id = $1 LIMIT 1',
    [user.id],
  )) as Array<{ id: string }>
  const accountId = existing[0]?.id ?? crypto.randomUUID()

  if (existing.length > 0) {
    await sql.query(
      `UPDATE affiliate_payout_accounts
          SET payout_method = $1, account_holder_name = $2, bank_name = $3, account_last4 = $4,
              promptpay_last4 = $5, payout_details = $6::jsonb, updated_at = now()
        WHERE user_id = $7`,
      [method, holder, bankName, accountLast4, promptpayLast4, details, user.id],
    )
  } else {
    await sql.query(
      `INSERT INTO affiliate_payout_accounts (
         id, user_id, payout_method, account_holder_name, bank_name, account_last4,
         promptpay_last4, payout_details, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, now(), now())`,
      [accountId, user.id, method, holder, bankName, accountLast4, promptpayLast4, details],
    )
  }

  return jsonBody(c, { ok: true, payout_account_id: accountId })
})

/** The legacy service only exposes `PUT /me/affiliate/payout-account`. */
meRoutes.post('/affiliate/payout-account', async () => {
  throw new HttpError(405, 'Method Not Allowed')
})

meRoutes.post('/affiliate/withdrawals', requireAuth(), async (c) => {
  const user = await requireActiveUser(c)
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
  const sql = c.get('sql')

  const errors: Array<Record<string, unknown>> = []
  if (body.amount_minor === undefined || body.amount_minor === null) {
    errors.push({ type: 'missing', loc: ['body', 'amount_minor'], msg: 'Field required', input: body })
  } else if (typeof body.amount_minor !== 'number' || !Number.isFinite(body.amount_minor)) {
    errors.push({
      type: 'int_type',
      loc: ['body', 'amount_minor'],
      msg: 'Input should be a valid integer',
      input: body.amount_minor,
    })
  } else if (body.amount_minor <= 0) {
    errors.push({
      type: 'greater_than',
      loc: ['body', 'amount_minor'],
      msg: 'Input should be greater than 0',
      input: body.amount_minor,
      ctx: { gt: 0 },
    })
  }
  if (errors.length > 0) {
    throw fastApiValidationError(errors)
  }

  const amount = Math.trunc(body.amount_minor as number)

  await sql.query(
    `UPDATE affiliate_commission_ledger
        SET status = 'available', updated_at = now()
      WHERE status = 'pending' AND available_at <= now() AND affiliate_user_id = $1`,
    [user.id],
  )

  const minimum = minWithdrawalMinor(c)
  if (amount < minimum) {
    throw badRequest('Withdrawal amount is below minimum')
  }

  const accountRows = (await sql.query(
    'SELECT id FROM affiliate_payout_accounts WHERE user_id = $1 LIMIT 1',
    [user.id],
  )) as Array<{ id: string }>
  const account = accountRows[0]
  if (!account) {
    throw badRequest('Payout account is required')
  }

  const openRows = (await sql.query(
    `SELECT id FROM affiliate_withdrawal_requests
      WHERE user_id = $1 AND status = ANY($2::text[])
      ORDER BY requested_at DESC LIMIT 1`,
    [user.id, OPEN_WITHDRAWAL_STATUSES],
  )) as Array<{ id: string }>
  if (openRows.length > 0) {
    throw conflict('Withdrawal request already pending')
  }

  const availableRows = (await sql.query(
    `SELECT id, referred_user_id, payment_reference_id, source_event_id, amount_paid_minor,
            commission_minor, currency, rate_bps,
            to_char(available_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') AS available_at
       FROM affiliate_commission_ledger
      WHERE affiliate_user_id = $1 AND status = 'available'
      ORDER BY created_at`,
    [user.id],
  )) as Array<{
    id: string
    referred_user_id: string
    payment_reference_id: string
    source_event_id: string | null
    amount_paid_minor: number
    commission_minor: number
    currency: string
    rate_bps: number
    available_at: string | null
  }>

  const availableTotal = availableRows.reduce((sum, row) => sum + row.commission_minor, 0)
  if (availableTotal < amount) {
    throw conflict('Insufficient available balance')
  }

  const withdrawalId = crypto.randomUUID()
  await sql.query(
    `INSERT INTO affiliate_withdrawal_requests (
       id, user_id, payout_account_id, amount_minor, currency, status, requested_at, updated_at
     ) VALUES ($1, $2, $3, $4, 'THB', 'pending_review', now(), now())`,
    [withdrawalId, user.id, account.id, amount],
  )

  // The commissions are consumed in order; a row that is larger than the
  // remaining amount is split, exactly like `request_withdrawal` does.
  let reserved = 0
  for (const row of availableRows) {
    if (reserved >= amount) {
      break
    }
    const remaining = amount - reserved
    if (row.commission_minor > remaining) {
      await sql.query(
        `INSERT INTO affiliate_commission_ledger (
           id, affiliate_user_id, referred_user_id, payment_reference_id, source_event_id,
           amount_paid_minor, commission_minor, currency, rate_bps, status, available_at,
           metadata, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'available', $10::timestamptz, $11::jsonb, now(), now())`,
        [
          crypto.randomUUID(),
          user.id,
          row.referred_user_id,
          `${row.payment_reference_id}:remainder:${withdrawalId}`,
          row.source_event_id,
          row.amount_paid_minor,
          row.commission_minor - remaining,
          row.currency,
          row.rate_bps,
          row.available_at,
          JSON.stringify({ split_from_ledger_id: row.id }),
        ],
      )
      await sql.query('UPDATE affiliate_commission_ledger SET commission_minor = $1 WHERE id = $2', [
        remaining,
        row.id,
      ])
      row.commission_minor = remaining
    }
    await sql.query(
      `UPDATE affiliate_commission_ledger
          SET status = 'withdrawn', withdrawal_request_id = $1, updated_at = now()
        WHERE id = $2`,
      [withdrawalId, row.id],
    )
    reserved += row.commission_minor
  }

  await sql.query(
    `INSERT INTO admin_audit_logs (
       id, action, target_user_id, old_value, new_value, changed_by_admin_id, note, created_at
     ) VALUES ($1, 'affiliate_withdrawal_requested', $2, $3::jsonb, $4::jsonb, NULL, $5, now())`,
    [
      crypto.randomUUID(),
      user.id,
      JSON.stringify({ available_balance_minor: availableTotal }),
      JSON.stringify({
        withdrawal_id: withdrawalId,
        amount_minor: amount,
        currency: 'THB',
        status: 'pending_review',
      }),
      'Affiliate withdrawal requested by user',
    ],
  )

  const rows = (await sql.query(
    `SELECT id, user_id, amount_minor, currency, status, admin_note,
            to_char(requested_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') AS requested_at,
            to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') AS updated_at,
            to_char(paid_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') AS paid_at
       FROM affiliate_withdrawal_requests
      WHERE id = $1 LIMIT 1`,
    [withdrawalId],
  )) as Array<{
    id: string
    user_id: string
    amount_minor: number
    currency: string
    status: string
    admin_note: string | null
    requested_at: string
    updated_at: string
    paid_at: string | null
  }>
  const withdrawal = rows[0]
  if (!withdrawal) {
    throw new HttpError(500, 'Withdrawal request not found')
  }

  return jsonBody(c, {
    ok: true,
    withdrawal: {
      id: withdrawal.id,
      user_id: withdrawal.user_id,
      amount_minor: withdrawal.amount_minor,
      currency: withdrawal.currency,
      status: withdrawal.status,
      admin_note: withdrawal.admin_note,
      requested_at: pydanticTimestamp(withdrawal.requested_at),
      updated_at: pydanticTimestamp(withdrawal.updated_at),
      paid_at: withdrawal.paid_at ? pydanticTimestamp(withdrawal.paid_at) : null,
    },
  })
})

/* ──────────────────────────────── share ───────────────────────────────── */

/**
 * Create a public share and return its token.
 *
 * @param c the request context.
 * @param userId the id of the user creating the share.
 * @param shareType the type of the share.
 * @param data the payload of the share.
 */
async function createShare(
  c: Context<AppEnv>,
  userId: string,
  shareType: string,
  data: Record<string, unknown>,
): Promise<string> {
  const sql = c.get('sql')
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = randomToken(18)
    const clash = (await sql.query('SELECT id FROM public_shares WHERE token = $1 LIMIT 1', [token])) as Array<{
      id: string
    }>
    if (clash.length > 0) {
      continue
    }
    await sql.query(
      `INSERT INTO public_shares (
         id, token, share_type, created_by_user_id, data, expires_at, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5::jsonb, now() + interval '180 days', now(), now())`,
      [crypto.randomUUID(), token, shareType, userId, JSON.stringify(data)],
    )
    return token
  }
  throw new HttpError(500, 'ไม่สามารถสร้างลิงก์แชร์ได้')
}

meRoutes.post('/share/dashboard', requireAuth(), async (c) => {
  const user = await requireActiveUser(c)
  const child = await loadProfile(c)
  const token = await ensureReferralToken(c, user.id)

  const name = displayName(child.nickname, child.first_name)
  const rank = child.current_rank_title || rankTitleForScore(child.total_score || 0)
  const title = `${name} ชวนมาเรียนเลขสนุก ๆ กับ TOPA Math`
  const shareToken = await createShare(c, user.id, 'dashboard', {
    display_name: name,
    avatar_url: child.student_photo_url
      ? `${backendBaseUrl(c)}${child.student_photo_url.startsWith('/') ? '' : '/'}${child.student_photo_url}`
      : null,
    avatar_gender: child.avatar_gender || 'girl',
    grade_level: child.grade_level,
    level: child.current_level || 1,
    xp: child.total_xp || 0,
    score: child.total_score || 0,
    rank,
    title,
    description: 'มาเรียนเลขสนุก ๆ กับ TOPA Math กันนะ',
    referral_token: token,
    cta_url: referralUrl(c, token),
  })

  const url = referralUrl(c, token)
  return jsonBody(c, { ...shareUrls(c, url, title), mode: 'public_share', token: shareToken })
})

meRoutes.post('/share/test-result', requireAuth(), async (c) => {
  const user = await requireActiveUser(c)
  const child = await loadProfile(c)
  const token = await ensureReferralToken(c, user.id)
  const body = (await c.req.json().catch(() => ({}))) as { session_id?: string }
  const sql = c.get('sql')

  if (typeof body.session_id !== 'string' || !body.session_id) {
    throw fastApiValidationError([
      { type: 'missing', loc: ['body', 'session_id'], msg: 'Field required', input: body },
    ])
  }

  const sessionRows = (await sql.query(
    'SELECT id, child_profile_id, lesson_id FROM test_sessions WHERE id = $1 LIMIT 1',
    [body.session_id],
  )) as Array<{ id: string; child_profile_id: string; lesson_id: string | null }>
  const session = sessionRows[0]
  if (!session || session.child_profile_id !== child.id) {
    throw notFound('ไม่พบผลสอบนี้')
  }

  const resultRows = (await sql.query(
    `SELECT id, accuracy, correct_count, total_questions
       FROM test_results
      WHERE test_session_id = $1 AND child_profile_id = $2
      ORDER BY created_at DESC
      LIMIT 1`,
    [session.id, child.id],
  )) as Array<{
    id: string
    accuracy: string | number | null
    correct_count: number | null
    total_questions: number | null
  }>
  const result = resultRows[0]
  if (!result) {
    throw notFound('ยังไม่มีผลสอบสำหรับเซสชันนี้')
  }

  let lessonTitle = ''
  let gradeLevel: number | null = null
  if (session.lesson_id) {
    const lessonRows = (await sql.query(
      'SELECT title, content FROM lessons WHERE id = $1 LIMIT 1',
      [session.lesson_id],
    )) as Array<{ title: string; content: Record<string, unknown> | null }>
    const lesson = lessonRows[0]
    if (lesson) {
      const content = lesson.content || {}
      lessonTitle = String(content.title_th ?? content.title ?? lesson.title)
      const rawGrade = content.grade_level
      const parsed = Number(rawGrade)
      gradeLevel = rawGrade !== undefined && rawGrade !== null && Number.isFinite(parsed) ? parsed : null
    }
  }
  if (!lessonTitle) {
    lessonTitle = 'แบบทดสอบ TOPA Math'
  }

  const scorePercent = Number(result.accuracy || 0)
  const title = `ผลสอบ TOPA Math: ${Math.trunc(roundLikePython(scorePercent, 0))}%`
  const name = displayName(child.nickname, child.first_name)
  const shareToken = await createShare(c, user.id, 'test_result', {
    display_name: name,
    lesson_title: lessonTitle,
    grade_level: gradeLevel ?? child.grade_level,
    score_percent: scorePercent,
    correct_count: result.correct_count || 0,
    total_questions: result.total_questions || 0,
    badge: scorePercent >= 70 ? 'ทำได้ดีมาก!' : 'ฝึกต่ออีกนิด เก่งขึ้นแน่นอน',
    title,
    description: 'ลองฝึกเลขสนุก ๆ กับ TOPA Math แล้วมาเก็บคะแนนไปด้วยกัน',
    referral_token: token,
    cta_url: referralUrl(c, token),
  })

  const url = referralUrl(c, token)
  return jsonBody(c, { ...shareUrls(c, url, title), mode: 'public_share', token: shareToken })
})

/* ───────────────────────── student avatar upload ───────────────────────── */

/** The MIME types the legacy service accepts. */
const AVATAR_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/** The maximum size of an uploaded avatar. */
const AVATAR_MAX_BYTES = 5 * 1024 * 1024

/**
 * Detect the format of an uploaded image from its magic bytes.
 *
 * The legacy service re-encodes the upload with Pillow, which also rejects
 * files that only pretend to be an image.
 *
 * @param bytes the uploaded bytes.
 */
function detectImageFormat(bytes: Uint8Array): { extension: string; contentType: string } | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { extension: 'jpg', contentType: 'image/jpeg' }
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { extension: 'png', contentType: 'image/png' }
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { extension: 'webp', contentType: 'image/webp' }
  }
  return null
}

meRoutes.post('/students/:childId/avatar', requireAuth(), async (c) => {
  const user = await requireActiveUser(c)
  const childId = c.req.param('childId')
  const sql = c.get('sql')

  const owned = (await sql.query(
    'SELECT id FROM child_profiles WHERE id = $1 AND parent_user_id = $2 LIMIT 1',
    [childId, user.id],
  )) as Array<{ id: string }>
  if (owned.length === 0) {
    throw notFound('ไม่พบโปรไฟล์นักเรียน')
  }

  const form = await c.req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) {
    throw fastApiValidationError([
      { type: 'missing', loc: ['body', 'file'], msg: 'Field required', input: null },
    ])
  }

  const contentType = file.type
  if (!AVATAR_ALLOWED_TYPES.includes(contentType)) {
    throw badRequest('รองรับเฉพาะไฟล์ JPG, PNG, หรือ WebP เท่านั้น')
  }
  if (file.size > AVATAR_MAX_BYTES) {
    throw badRequest('ไฟล์รูปภาพใหญ่เกินไป กรุณาเลือกรูปไม่เกิน 5 MB')
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const format = detectImageFormat(bytes)
  if (!format) {
    throw badRequest('ไม่สามารถประมวลผลรูปภาพ: ไฟล์ไม่ใช่รูปภาพที่รองรับ')
  }

  const safeName = `${childId}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}.${format.extension}`
  await sql.query(
    `INSERT INTO avatar_files (filename, content_type, data, created_at, updated_at)
     VALUES ($1, $2, decode($3, 'base64'), now(), now())
     ON CONFLICT (filename) DO UPDATE SET content_type = EXCLUDED.content_type, data = EXCLUDED.data, updated_at = now()`,
    [safeName, format.contentType, base64Encode(bytes)],
  )

  const previous = (await sql.query(
    'SELECT student_photo_path FROM child_profiles WHERE id = $1 LIMIT 1',
    [childId],
  )) as Array<{ student_photo_path: string | null }>
  const oldPath = previous[0]?.student_photo_path
  if (oldPath) {
    await sql.query('DELETE FROM avatar_files WHERE filename = $1', [oldPath])
  }

  const url = avatarFileUrl(safeName)
  await sql.query(
    'UPDATE child_profiles SET student_photo_path = $1, student_photo_url = $2, updated_at = now() WHERE id = $3',
    [safeName, url, childId],
  )

  return jsonBody(c, {
    student_photo_url: url,
    student_photo_absolute_url: `${backendBaseUrl(c)}${url}`,
    avatar_url: url,
  })
})

meRoutes.delete('/students/:childId/avatar', requireAuth(), async (c) => {
  const user = await requireActiveUser(c)
  const childId = c.req.param('childId')
  const sql = c.get('sql')

  const rows = (await sql.query(
    'SELECT id, student_photo_path FROM child_profiles WHERE id = $1 AND parent_user_id = $2 LIMIT 1',
    [childId, user.id],
  )) as Array<{ id: string; student_photo_path: string | null }>
  const child = rows[0]
  if (!child) {
    throw notFound('ไม่พบโปรไฟล์นักเรียน')
  }

  if (child.student_photo_path) {
    await sql.query('DELETE FROM avatar_files WHERE filename = $1', [child.student_photo_path])
  }
  await sql.query(
    'UPDATE child_profiles SET student_photo_path = NULL, student_photo_url = NULL, updated_at = now() WHERE id = $1',
    [child.id],
  )

  return jsonBody(c, { success: true })
})

/**
 * Encode bytes as base64 (the Workers runtime has no `Buffer`).
 *
 * @param bytes the bytes to encode.
 */
function base64Encode(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  }
  return btoa(binary)
}
