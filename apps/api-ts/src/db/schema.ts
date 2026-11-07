/**
 * Drizzle schema — ported from `apps/api/app/models/entities.py`.
 *
 * Only the tables that the Phase-1 endpoints actually touch are declared here.
 * Column names and types mirror the existing Postgres schema exactly so the
 * TS API can run against the same database as the legacy FastAPI service.
 *
 * Mapping notes:
 *  - Python `String(36)` UUID primary keys  -> `varchar(36)` (NOT `uuid`).
 *  - Python `DateTime(timezone=True)`        -> `timestamp with time zone`.
 *  - Python `Numeric(5, 2)` / `Numeric(10, 2)` -> `numeric(p,s)`.
 *  - Python `JSON` with the postgres `JSONB` variant -> `jsonb`.
 *  - Python `metadata_json` is mapped to the column named `metadata`.
 */
import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'

const id = () => varchar('id', { length: 36 }).primaryKey()

const createdAt = () => timestamp('created_at', { withTimezone: true }).defaultNow()
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).defaultNow()

/* ─────────────────────────────── users ─────────────────────────────── */

export const users = pgTable(
  'users',
  {
    id: id(),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    role: varchar('role', { length: 20 }).default('parent'),
    plan: varchar('plan', { length: 40 }).default('free'),
    planExpiresAt: timestamp('plan_expires_at', { withTimezone: true }),
    isActive: boolean('is_active').default(true),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    referralToken: varchar('referral_token', { length: 80 }),
    referredByUserId: varchar('referred_by_user_id', { length: 36 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('users_email_idx').on(table.email),
    index('users_referral_token_idx').on(table.referralToken),
    index('users_referred_by_user_id_idx').on(table.referredByUserId),
  ],
)

/* ────────────────────────── child_profiles ────────────────────────── */

export const childProfiles = pgTable(
  'child_profiles',
  {
    id: id(),
    parentUserId: varchar('parent_user_id', { length: 36 }).notNull(),
    firstName: varchar('first_name', { length: 80 }),
    lastName: varchar('last_name', { length: 80 }),
    nickname: varchar('nickname', { length: 80 }).notNull(),
    gradeLevel: integer('grade_level').notNull(),
    province: varchar('province', { length: 120 }),
    district: varchar('district', { length: 120 }),
    schoolName: varchar('school_name', { length: 180 }),
    schoolProvince: varchar('school_province', { length: 120 }),
    schoolDistrict: varchar('school_district', { length: 120 }),
    studentPhotoUrl: text('student_photo_url'),
    studentPhotoPath: text('student_photo_path'),
    avatarGender: varchar('avatar_gender', { length: 20 }),
    avatarConfig: jsonb('avatar_config').$type<Record<string, unknown>>().default({}),
    programType: varchar('program_type', { length: 10 }).default('THP'),
    membershipStatus: varchar('membership_status', { length: 20 }).default('free'),
    membershipProvider: varchar('membership_provider', { length: 20 }),
    mppAccessEndsAt: timestamp('mpp_access_ends_at', { withTimezone: true }),
    stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
    stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
    subscriptionStatus: varchar('subscription_status', { length: 40 }).default('none'),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    accessEndsAt: timestamp('access_ends_at', { withTimezone: true }),
    planCode: varchar('plan_code', { length: 40 }).default('free'),
    planType: varchar('plan_type', { length: 40 }).default('free'),
    activePriceCode: varchar('active_price_code', { length: 80 }),
    priceType: varchar('price_type', { length: 40 }),
    billingProgramType: varchar('billing_program_type', { length: 10 }),
    adminNote: text('admin_note'),
    manualGrantReason: varchar('manual_grant_reason', { length: 120 }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    canceledAt: timestamp('canceled_at', { withTimezone: true }),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false),
    totalScore: integer('total_score').default(0),
    totalXp: integer('total_xp').default(0),
    coins: integer('coins').default(0),
    currentLevel: integer('current_level').default(1),
    daysActive: integer('days_active').default(0),
    testAttemptsUsed: integer('test_attempts_used').default(0),
    freeTestLimit: integer('free_test_limit').default(5),
    totalTestsCompleted: integer('total_tests_completed').default(0),
    averageTestAccuracy: numeric('average_test_accuracy', { precision: 5, scale: 2 }).default('0'),
    averageTestSpeed: numeric('average_test_speed', { precision: 10, scale: 2 }).default('0'),
    currentRankTitle: varchar('current_rank_title', { length: 80 }).default('เด็กหลังห้อง'),
    streakCount: integer('streak_count').default(0),
    lastActiveDate: date('last_active_date'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('child_profiles_parent_user_id_idx').on(table.parentUserId),
    index('child_profiles_stripe_customer_id_idx').on(table.stripeCustomerId),
    index('child_profiles_stripe_subscription_id_idx').on(table.stripeSubscriptionId),
  ],
)

/* ────────────────────────────── badges ────────────────────────────── */

export const badges = pgTable(
  'badges',
  {
    id: id(),
    code: varchar('code', { length: 80 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    description: text('description'),
    iconUrl: text('icon_url'),
  },
  (table) => [index('badges_code_idx').on(table.code)],
)

export const childBadges = pgTable(
  'child_badges',
  {
    id: id(),
    childProfileId: varchar('child_profile_id', { length: 36 }).notNull(),
    badgeId: varchar('badge_id', { length: 36 }).notNull(),
    awardedAt: timestamp('awarded_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [index('child_badges_child_profile_id_idx').on(table.childProfileId)],
)

/* ─────────────────────── subjects / skills / lessons ─────────────────────── */

export const subjects = pgTable('subjects', {
  id: id(),
  code: varchar('code', { length: 40 }).notNull(),
  name: varchar('name', { length: 120 }).notNull(),
})

export const skills = pgTable(
  'skills',
  {
    id: id(),
    subjectId: varchar('subject_id', { length: 36 }).notNull(),
    gradeLevel: integer('grade_level').notNull(),
    code: varchar('code', { length: 80 }).notNull(),
    name: varchar('name', { length: 160 }).notNull(),
    description: text('description'),
    prerequisiteSkillIds: jsonb('prerequisite_skill_ids').$type<string[]>().default([]),
    difficultyOrder: integer('difficulty_order').default(0),
    createdAt: createdAt(),
  },
  (table) => [index('skills_code_idx').on(table.code)],
)

export const lessons = pgTable(
  'lessons',
  {
    id: id(),
    skillId: varchar('skill_id', { length: 36 }).notNull(),
    title: varchar('title', { length: 180 }).notNull(),
    content: jsonb('content').$type<Record<string, unknown>>().notNull(),
    source: varchar('source', { length: 20 }).default('human'),
    status: varchar('status', { length: 20 }).default('draft'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('lessons_skill_id_idx').on(table.skillId)],
)

/* ─────────────────────────────── quests ─────────────────────────────── */

export const learningQuests = pgTable(
  'learning_quests',
  {
    id: id(),
    questId: varchar('quest_id', { length: 120 }).notNull(),
    gradeLevel: integer('grade_level').notNull(),
    skillCode: varchar('skill_code', { length: 80 }),
    title: varchar('title', { length: 180 }).notNull(),
    description: text('description'),
    questType: varchar('quest_type', { length: 40 }).default('lesson'),
    recurrenceType: varchar('recurrence_type', { length: 20 }).default('none'),
    xpReward: integer('xp_reward').default(0),
    coinReward: integer('coin_reward').default(0),
    estimatedMinutes: integer('estimated_minutes'),
    status: varchar('status', { length: 20 }).default('active'),
    lessonId: varchar('lesson_id', { length: 36 }),
    quizId: varchar('quiz_id', { length: 120 }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('learning_quests_quest_id_idx').on(table.questId)],
)

export const childQuests = pgTable(
  'child_quests',
  {
    id: id(),
    childProfileId: varchar('child_profile_id', { length: 36 }).notNull(),
    questId: varchar('quest_id', { length: 36 }).notNull(),
    recurrenceType: varchar('recurrence_type', { length: 20 }).default('none'),
    periodKey: varchar('period_key', { length: 40 }),
    status: varchar('status', { length: 20 }).default('not_started'),
    progressCurrent: integer('progress_current').default(0),
    progressTarget: integer('progress_target').default(1),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    xpAwarded: integer('xp_awarded').default(0),
    coinAwarded: integer('coin_awarded').default(0),
    scoreAwarded: integer('score_awarded').default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('child_quests_child_profile_id_idx').on(table.childProfileId)],
)

/* ───────────────────── progress / activity tables ───────────────────── */

export const checkInEvents = pgTable(
  'check_in_events',
  {
    id: id(),
    childProfileId: varchar('child_profile_id', { length: 36 }).notNull(),
    eventDate: date('event_date').notNull(),
    periodDay: varchar('period_day', { length: 10 }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [index('check_in_events_child_profile_id_idx').on(table.childProfileId)],
)

export const lessonActivity = pgTable(
  'lesson_activity',
  {
    id: id(),
    childProfileId: varchar('child_profile_id', { length: 36 }).notNull(),
    lessonId: varchar('lesson_id', { length: 120 }).notNull(),
    activityType: varchar('activity_type', { length: 40 }).default('started'),
    periodDay: varchar('period_day', { length: 10 }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [index('lesson_activity_child_profile_id_idx').on(table.childProfileId)],
)

export const testSessions = pgTable(
  'test_sessions',
  {
    id: id(),
    childProfileId: varchar('child_profile_id', { length: 36 }).notNull(),
    lessonId: varchar('lesson_id', { length: 36 }),
    quizId: varchar('quiz_id', { length: 120 }),
    questionIds: jsonb('question_ids').$type<string[]>().default([]),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    timerSeconds: integer('timer_seconds').default(300),
    status: varchar('status', { length: 20 }).default('in_progress'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('test_sessions_child_profile_id_idx').on(table.childProfileId)],
)

export const testResults = pgTable(
  'test_results',
  {
    id: id(),
    testSessionId: varchar('test_session_id', { length: 36 }).notNull(),
    childProfileId: varchar('child_profile_id', { length: 36 }).notNull(),
    lessonId: varchar('lesson_id', { length: 36 }),
    quizId: varchar('quiz_id', { length: 120 }),
    totalQuestions: integer('total_questions').default(0),
    correctCount: integer('correct_count').default(0),
    accuracy: numeric('accuracy', { precision: 5, scale: 2 }).default('0'),
    averageResponseTimeMs: numeric('average_response_time_ms', { precision: 10, scale: 2 }).default('0'),
    totalTimeMs: integer('total_time_ms').default(0),
    scoreAwarded: integer('score_awarded').default(0),
    xpAwarded: integer('xp_awarded').default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('test_results_child_profile_id_idx').on(table.childProfileId)],
)

export const studentStats = pgTable(
  'student_stats',
  {
    id: id(),
    childProfileId: varchar('child_profile_id', { length: 36 }).notNull(),
    lessonsCompleted: integer('lessons_completed').default(0),
    testsCompleted: integer('tests_completed').default(0),
    questsCompleted: integer('quests_completed').default(0),
    checkins: integer('checkins').default(0),
    perfectTests: integer('perfect_tests').default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('student_stats_child_profile_id_idx').on(table.childProfileId)],
)

export const skillMastery = pgTable(
  'skill_mastery',
  {
    id: id(),
    childProfileId: varchar('child_profile_id', { length: 36 }).notNull(),
    skillId: varchar('skill_id', { length: 36 }).notNull(),
    masteryScore: numeric('mastery_score', { precision: 5, scale: 2 }).default('0'),
    masteryLevel: varchar('mastery_level', { length: 40 }).default('needs_help'),
    lastPracticedAt: timestamp('last_practiced_at', { withTimezone: true }),
    correctCount: integer('correct_count').default(0),
    incorrectCount: integer('incorrect_count').default(0),
    avgResponseTimeMs: integer('avg_response_time_ms'),
    updatedAt: updatedAt(),
  },
  (table) => [index('skill_mastery_child_profile_id_idx').on(table.childProfileId)],
)

export const xpEvents = pgTable(
  'xp_events',
  {
    id: id(),
    childProfileId: varchar('child_profile_id', { length: 36 }).notNull(),
    sourceType: varchar('source_type', { length: 80 }).notNull(),
    sourceId: varchar('source_id', { length: 36 }),
    xpAmount: integer('xp_amount').notNull(),
    description: text('description'),
    createdAt: createdAt(),
  },
  (table) => [index('xp_events_child_profile_id_idx').on(table.childProfileId)],
)

export const rankTitles = pgTable('rank_titles', {
  id: id(),
  title: varchar('title', { length: 80 }).notNull(),
  minScore: integer('min_score').default(0),
  sortOrder: integer('sort_order').default(0),
})

/* ──────────────────────── referrals / coin ledger ──────────────────────── */

export const referralEvents = pgTable(
  'referral_events',
  {
    id: id(),
    referrerUserId: varchar('referrer_user_id', { length: 36 }).notNull(),
    referredUserId: varchar('referred_user_id', { length: 36 }),
    referralToken: varchar('referral_token', { length: 80 }).notNull(),
    eventType: varchar('event_type', { length: 40 }).notNull(),
    shareToken: varchar('share_token', { length: 80 }),
    visitorHash: varchar('visitor_hash', { length: 96 }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    createdAt: createdAt(),
  },
  (table) => [index('referral_events_referrer_user_id_idx').on(table.referrerUserId)],
)

export const coinLedger = pgTable(
  'coin_ledger',
  {
    id: id(),
    userId: varchar('user_id', { length: 36 }).notNull(),
    amount: integer('amount').notNull(),
    type: varchar('type', { length: 60 }).notNull(),
    status: varchar('status', { length: 20 }).default('pending'),
    referenceId: varchar('reference_id', { length: 120 }),
    activatedAt: timestamp('activated_at', { withTimezone: true }),
    note: text('note'),
    createdAt: createdAt(),
  },
  (table) => [
    index('coin_ledger_user_id_idx').on(table.userId),
    index('coin_ledger_type_idx').on(table.type),
    index('coin_ledger_status_idx').on(table.status),
  ],
)

/* ───────────────────────────── public shares ───────────────────────────── */

export const publicShares = pgTable(
  'public_shares',
  {
    id: id(),
    token: varchar('token', { length: 80 }).notNull(),
    shareType: varchar('share_type', { length: 40 }).notNull(),
    createdByUserId: varchar('created_by_user_id', { length: 36 }),
    data: jsonb('data').$type<Record<string, unknown>>().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('ix_public_shares_token').on(table.token),
    index('ix_public_shares_share_type').on(table.shareType),
    index('ix_public_shares_created_by_user_id').on(table.createdByUserId),
  ],
)

/* ─────────────────────────────── avatars ─────────────────────────────── */

export const avatarItems = pgTable('avatar_items', {
  id: id(),
  code: varchar('code', { length: 80 }).notNull(),
  name: varchar('name', { length: 120 }).notNull(),
  itemType: varchar('item_type', { length: 40 }).notNull(),
  rarity: varchar('rarity', { length: 40 }).default('common'),
  assetUrl: text('asset_url'),
  isDefault: boolean('is_default').default(false),
  createdAt: createdAt(),
})

export const childInventory = pgTable(
  'child_inventory',
  {
    id: id(),
    childProfileId: varchar('child_profile_id', { length: 36 }).notNull(),
    avatarItemId: varchar('avatar_item_id', { length: 36 }).notNull(),
    acquiredAt: timestamp('acquired_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [index('child_inventory_child_profile_id_idx').on(table.childProfileId)],
)

/* ────────────────────────────── relations ────────────────────────────── */

export const usersRelations = relations(users, ({ many }) => ({
  children: many(childProfiles),
}))

export const childProfilesRelations = relations(childProfiles, ({ one, many }) => ({
  parent: one(users, { fields: [childProfiles.parentUserId], references: [users.id] }),
  badges: many(childBadges),
}))

export const badgesRelations = relations(badges, ({ many }) => ({
  owners: many(childBadges),
}))

export const childBadgesRelations = relations(childBadges, ({ one }) => ({
  child: one(childProfiles, { fields: [childBadges.childProfileId], references: [childProfiles.id] }),
  badge: one(badges, { fields: [childBadges.badgeId], references: [badges.id] }),
}))

export const lessonsRelations = relations(lessons, ({ one }) => ({
  skill: one(skills, { fields: [lessons.skillId], references: [skills.id] }),
}))

export const skillsRelations = relations(skills, ({ one, many }) => ({
  subject: one(subjects, { fields: [skills.subjectId], references: [subjects.id] }),
  lessons: many(lessons),
}))

/* ───────────────────── questions / quizzes / attempts ───────────────────── */

export const questions = pgTable(
  'questions',
  {
    id: id(),
    skillId: varchar('skill_id', { length: 36 }).notNull(),
    gradeLevel: integer('grade_level').notNull(),
    questionType: varchar('question_type', { length: 40 }).notNull(),
    difficulty: varchar('difficulty', { length: 20 }).notNull(),
    questionText: text('question_text').notNull(),
    choices: jsonb('choices').$type<string[] | null>(),
    correctAnswer: text('correct_answer').notNull(),
    explanation: text('explanation'),
    hint: text('hint'),
    source: varchar('source', { length: 20 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull(),
    createdAt: createdAt(),
  },
  (table) => [index('ix_questions_skill_id').on(table.skillId)],
)

export const quizSessions = pgTable(
  'quiz_sessions',
  {
    id: id(),
    childProfileId: varchar('child_profile_id', { length: 36 }).notNull(),
    subjectId: varchar('subject_id', { length: 36 }).notNull(),
    mode: varchar('mode', { length: 40 }).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    totalQuestions: integer('total_questions').notNull(),
    correctCount: integer('correct_count').notNull(),
    totalXpEarned: integer('total_xp_earned').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull(),
  },
  (table) => [index('ix_quiz_sessions_child_profile_id').on(table.childProfileId)],
)

export const quizAnswers = pgTable(
  'quiz_answers',
  {
    id: id(),
    quizSessionId: varchar('quiz_session_id', { length: 36 }).notNull(),
    childProfileId: varchar('child_profile_id', { length: 36 }).notNull(),
    questionId: varchar('question_id', { length: 36 }).notNull(),
    skillId: varchar('skill_id', { length: 36 }).notNull(),
    selectedAnswer: text('selected_answer'),
    selectedAnswerRaw: text('selected_answer_raw'),
    selectedAnswerNormalized: text('selected_answer_normalized'),
    correctAnswerNormalized: text('correct_answer_normalized'),
    isCorrect: boolean('is_correct').notNull(),
    responseTimeMs: integer('response_time_ms'),
    hintUsed: boolean('hint_used').notNull(),
    attemptCount: integer('attempt_count').notNull(),
    mistakeType: varchar('mistake_type', { length: 80 }),
    createdAt: createdAt(),
  },
  (table) => [
    index('ix_quiz_answers_quiz_session_id').on(table.quizSessionId),
    index('ix_quiz_answers_child_profile_id').on(table.childProfileId),
  ],
)

export const questionAttemptHistory = pgTable(
  'question_attempt_history',
  {
    id: id(),
    childId: varchar('child_id', { length: 36 }).notNull(),
    questionId: varchar('question_id', { length: 36 }).notNull(),
    lessonId: varchar('lesson_id', { length: 120 }),
    gradeLevel: integer('grade_level').notNull(),
    topicCode: varchar('topic_code', { length: 120 }),
    skillCode: varchar('skill_code', { length: 120 }),
    questionType: varchar('question_type', { length: 20 }).notNull(),
    rotationScope: varchar('rotation_scope', { length: 40 }).notNull(),
    rotationKey: varchar('rotation_key', { length: 160 }).notNull(),
    cycleNumber: integer('cycle_number').notNull(),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).defaultNow().notNull(),
    lastAttemptedAt: timestamp('last_attempted_at', { withTimezone: true }).defaultNow().notNull(),
    attemptCount: integer('attempt_count').notNull(),
    lastIsCorrect: boolean('last_is_correct'),
  },
  (table) => [index('ix_question_attempt_history_child_id').on(table.childId)],
)

/* ─────────────────────── lesson access / variants ─────────────────────── */

export const lessonAccess = pgTable(
  'lesson_access',
  {
    id: id(),
    childProfileId: varchar('child_profile_id', { length: 36 }).notNull(),
    lessonId: varchar('lesson_id', { length: 36 }).notNull(),
    accessType: varchar('access_type', { length: 20 }).notNull(),
    isLocked: boolean('is_locked').notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('ix_lesson_access_child_profile_id').on(table.childProfileId)],
)

export const lessonVariantViews = pgTable(
  'lesson_variant_views',
  {
    id: id(),
    childId: varchar('child_id', { length: 36 }).notNull(),
    lessonId: varchar('lesson_id', { length: 120 }).notNull(),
    variantId: varchar('variant_id', { length: 80 }).notNull(),
    cycleNumber: integer('cycle_number').notNull(),
    viewedAt: timestamp('viewed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('ix_lesson_variant_views_child_id').on(table.childId)],
)

/* ───────────────────────── quest templates ───────────────────────── */

export const questTemplates = pgTable(
  'quest_templates',
  {
    id: id(),
    questId: varchar('quest_id', { length: 120 }).notNull(),
    gradeLevel: integer('grade_level').notNull(),
    skillCode: varchar('skill_code', { length: 80 }),
    title: varchar('title', { length: 180 }).notNull(),
    description: text('description'),
    questType: varchar('quest_type', { length: 40 }).notNull(),
    recurrenceType: varchar('recurrence_type', { length: 20 }).notNull(),
    xpReward: integer('xp_reward').notNull(),
    coinReward: integer('coin_reward').notNull(),
    estimatedMinutes: integer('estimated_minutes'),
    status: varchar('status', { length: 20 }).notNull(),
    lessonId: varchar('lesson_id', { length: 36 }),
    quizId: varchar('quiz_id', { length: 120 }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('ix_quest_templates_quest_id').on(table.questId)],
)

export const recurringQuestTemplates = pgTable(
  'recurring_quest_templates',
  {
    id: id(),
    questId: varchar('quest_id', { length: 120 }).notNull(),
    recurrenceType: varchar('recurrence_type', { length: 20 }).notNull(),
    gradeLevel: integer('grade_level').notNull(),
    skillCode: varchar('skill_code', { length: 80 }),
    title: varchar('title', { length: 180 }).notNull(),
    description: text('description'),
    questType: varchar('quest_type', { length: 40 }).notNull(),
    xpReward: integer('xp_reward').notNull(),
    coinReward: integer('coin_reward').notNull(),
    estimatedMinutes: integer('estimated_minutes'),
    status: varchar('status', { length: 20 }).notNull(),
    lessonId: varchar('lesson_id', { length: 36 }),
    quizId: varchar('quiz_id', { length: 120 }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('ix_recurring_quest_templates_quest_id').on(table.questId)],
)

export const childRecurringQuests = pgTable(
  'child_recurring_quests',
  {
    id: id(),
    childProfileId: varchar('child_profile_id', { length: 36 }).notNull(),
    recurringQuestTemplateId: varchar('recurring_quest_template_id', { length: 36 }).notNull(),
    recurrenceType: varchar('recurrence_type', { length: 20 }).notNull(),
    periodKey: varchar('period_key', { length: 40 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    xpAwarded: integer('xp_awarded').notNull(),
    coinAwarded: integer('coin_awarded').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('ix_child_recurring_quests_child_profile_id').on(table.childProfileId)],
)

/* ───────────────────────── rank snapshots ───────────────────────── */

export const rankSnapshots = pgTable(
  'rank_snapshots',
  {
    id: id(),
    childProfileId: varchar('child_profile_id', { length: 36 }).notNull(),
    subjectId: varchar('subject_id', { length: 36 }).notNull(),
    gradeLevel: integer('grade_level').notNull(),
    province: varchar('province', { length: 120 }),
    rankScope: varchar('rank_scope', { length: 20 }).notNull(),
    periodType: varchar('period_type', { length: 20 }).notNull(),
    periodStart: date('period_start'),
    periodEnd: date('period_end'),
    masteryPoints: numeric('mastery_points', { precision: 8, scale: 2 }).notNull(),
    speedPoints: numeric('speed_points', { precision: 8, scale: 2 }).notNull(),
    improvementPoints: numeric('improvement_points', { precision: 8, scale: 2 }).notNull(),
    rankScore: numeric('rank_score', { precision: 8, scale: 2 }).notNull(),
    rankPosition: integer('rank_position'),
    createdAt: createdAt(),
  },
  (table) => [index('ix_rank_snapshots_child_profile_id').on(table.childProfileId)],
)

/* ───────────────────── admin / affiliate / ai ───────────────────── */

export const adminAuditLogs = pgTable('admin_audit_logs', {
  id: id(),
  action: varchar('action', { length: 80 }).notNull(),
  targetUserId: varchar('target_user_id', { length: 36 }),
  oldValue: jsonb('old_value').$type<Record<string, unknown> | null>(),
  newValue: jsonb('new_value').$type<Record<string, unknown> | null>(),
  changedByAdminId: varchar('changed_by_admin_id', { length: 36 }),
  note: text('note'),
  createdAt: createdAt(),
})

export const aiGenerationJobs = pgTable(
  'ai_generation_jobs',
  {
    id: id(),
    childProfileId: varchar('child_profile_id', { length: 36 }).notNull(),
    skillId: varchar('skill_id', { length: 36 }).notNull(),
    jobType: varchar('job_type', { length: 80 }).notNull(),
    inputPayload: jsonb('input_payload').$type<Record<string, unknown>>().notNull(),
    outputPayload: jsonb('output_payload').$type<Record<string, unknown> | null>(),
    status: varchar('status', { length: 20 }).notNull(),
    errorMessage: text('error_message'),
    createdAt: createdAt(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [index('ix_ai_generation_jobs_child_profile_id').on(table.childProfileId)],
)

export const affiliateCommissionLedger = pgTable(
  'affiliate_commission_ledger',
  {
    id: id(),
    affiliateUserId: varchar('affiliate_user_id', { length: 36 }).notNull(),
    referredUserId: varchar('referred_user_id', { length: 36 }).notNull(),
    paymentReferenceId: varchar('payment_reference_id', { length: 160 }).notNull(),
    sourceEventId: varchar('source_event_id', { length: 160 }).notNull(),
    amountPaidMinor: integer('amount_paid_minor').notNull(),
    commissionMinor: integer('commission_minor').notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    rateBps: integer('rate_bps').notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    availableAt: timestamp('available_at', { withTimezone: true }),
    reversedAt: timestamp('reversed_at', { withTimezone: true }),
    withdrawalRequestId: varchar('withdrawal_request_id', { length: 36 }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('ix_affiliate_commission_ledger_affiliate_user_id').on(table.affiliateUserId)],
)

export const affiliatePayoutAccounts = pgTable(
  'affiliate_payout_accounts',
  {
    id: id(),
    userId: varchar('user_id', { length: 36 }).notNull(),
    payoutMethod: varchar('payout_method', { length: 20 }).notNull(),
    accountHolderName: varchar('account_holder_name', { length: 160 }).notNull(),
    bankName: varchar('bank_name', { length: 120 }),
    accountLast4: varchar('account_last4', { length: 8 }),
    promptpayLast4: varchar('promptpay_last4', { length: 8 }),
    payoutDetails: jsonb('payout_details').$type<Record<string, unknown>>().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('ix_affiliate_payout_accounts_user_id').on(table.userId)],
)

export const affiliateWithdrawalRequests = pgTable(
  'affiliate_withdrawal_requests',
  {
    id: id(),
    userId: varchar('user_id', { length: 36 }).notNull(),
    payoutAccountId: varchar('payout_account_id', { length: 36 }).notNull(),
    amountMinor: integer('amount_minor').notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    status: varchar('status', { length: 30 }).notNull(),
    reviewedByAdminId: varchar('reviewed_by_admin_id', { length: 36 }),
    adminNote: text('admin_note'),
    requestedAt: timestamp('requested_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: updatedAt(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
  },
  (table) => [index('ix_affiliate_withdrawal_requests_user_id').on(table.userId)],
)

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type ChildProfile = typeof childProfiles.$inferSelect
export type NewChildProfile = typeof childProfiles.$inferInsert
export type Badge = typeof badges.$inferSelect
export type ChildBadge = typeof childBadges.$inferSelect
export type Lesson = typeof lessons.$inferSelect
export type Skill = typeof skills.$inferSelect
export type LearningQuest = typeof learningQuests.$inferSelect
export type StudentStats = typeof studentStats.$inferSelect
export type TestResult = typeof testResults.$inferSelect
export type CheckInEvent = typeof checkInEvents.$inferSelect
export type LessonActivity = typeof lessonActivity.$inferSelect

/** Column list helper kept for raw SQL fragments that need a stable order. */
export const childProfileColumns = {
  id: sql`${childProfiles.id}`,
}
