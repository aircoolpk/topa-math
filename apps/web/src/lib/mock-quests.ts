/**
 * MOCK QUEST DATA — Temporary placeholder
 *
 * Backend endpoints (already implemented in apps/api/app/routers/quests.py):
 *   GET /children/{child_id}/quests
 *   GET /children/{child_id}/daily-quests
 *   GET /children/{child_id}/weekly-quests
 *   GET /children/{child_id}/monthly-quests
 *   POST /children/{child_id}/quests/{quest_id}/start
 *   POST /children/{child_id}/quests/{quest_id}/complete
 *
 * NOTE: Backend child_status only supports not_started | in_progress | completed.
 * The `progress` and `locked` fields below are frontend extensions — Codex should
 * add these to the backend LearningQuest model.
 */

import type { QuestOut } from '@/lib/api/quests'

// ─── Progress tracking (frontend extension) ────────────────────────────────────

interface QuestProgress {
  current: number
  total: number
}

// ─── Quest builder ─────────────────────────────────────────────────────────────

function makeQuest(overrides: Partial<QuestOut> & {
  quest_id: string
  title: string
  skill_code: string
  recurrence_type: 'daily' | 'weekly' | 'monthly'
  xp_reward: number
  coin_reward: number
  child_status: 'not_started' | 'in_progress' | 'completed'
  locked?: boolean
  progress?: QuestProgress
}): QuestOut {
  return {
    id: overrides.quest_id,
    quest_id: overrides.quest_id,
    grade_level: 3,
    skill_code: overrides.skill_code,
    title: overrides.title,
    description: null,
    quest_type: 'practice',
    recurrence_type: overrides.recurrence_type,
    xp_reward: overrides.xp_reward,
    coin_reward: overrides.coin_reward,
    estimated_minutes: null,
    status: 'active',
    lesson_id: null,
    quiz_id: null,
    child_status: overrides.child_status,
    locked: overrides.locked ?? false,
    // Real backend fields — mocked as 0 for mock fallbacks
    progress_current: overrides.progress?.current ?? 0,
    progress_total: overrides.progress?.total ?? 1,
    progress_percent: overrides.progress && overrides.progress.total > 0
      ? Math.round((overrides.progress.current / overrides.progress.total) * 100)
      : 0,
    can_claim_reward: overrides.child_status === 'completed',
  }
}

// ─── Daily Quests ───────────────────────────────────────────────────────────────

export const MOCK_DAILY_QUESTS: QuestOut[] = [
  makeQuest({
    quest_id: 'd1',
    title: 'เช็กชื่อในระบบ',
    skill_code: 'login',
    recurrence_type: 'daily',
    xp_reward: 10,
    coin_reward: 2,
    child_status: 'in_progress',
    progress: { current: 0, total: 1 },
  }),
  makeQuest({
    quest_id: 'd2',
    title: 'เข้าเรียนเนื้อหา 1 เรื่อง',
    skill_code: 'lesson',
    recurrence_type: 'daily',
    xp_reward: 30,
    coin_reward: 8,
    child_status: 'not_started',
    progress: { current: 0, total: 1 },
  }),
  makeQuest({
    quest_id: 'd3',
    title: 'ทำเทส ตอบถูกเกิน 50%',
    skill_code: 'quiz',
    recurrence_type: 'daily',
    xp_reward: 50,
    coin_reward: 15,
    child_status: 'not_started',
    progress: { current: 0, total: 1 },
  }),
]

// ─── Weekly Quests ─────────────────────────────────────────────────────────────

export const MOCK_WEEKLY_QUESTS: QuestOut[] = [
  makeQuest({
    quest_id: 'w1',
    title: 'เช็กชื่อ 2 วัน',
    skill_code: 'login',
    recurrence_type: 'weekly',
    xp_reward: 20,
    coin_reward: 5,
    child_status: 'in_progress',
    progress: { current: 0, total: 2 },
  }),
  makeQuest({
    quest_id: 'w2',
    title: 'เช็กชื่อ 4 วัน',
    skill_code: 'login',
    recurrence_type: 'weekly',
    xp_reward: 40,
    coin_reward: 10,
    child_status: 'not_started',
    progress: { current: 0, total: 4 },
  }),
  makeQuest({
    quest_id: 'w3',
    title: 'เช็กชื่อ 6 วัน',
    skill_code: 'login',
    recurrence_type: 'weekly',
    xp_reward: 60,
    coin_reward: 15,
    child_status: 'not_started',
    locked: true,
    progress: { current: 0, total: 6 },
  }),
  makeQuest({
    quest_id: 'w4',
    title: 'เรียนบทเรียน 3 บท',
    skill_code: 'lesson',
    recurrence_type: 'weekly',
    xp_reward: 120,
    coin_reward: 30,
    child_status: 'in_progress',
    progress: { current: 1, total: 3 },
  }),
  makeQuest({
    quest_id: 'w5',
    title: 'เรียนบทเรียน 4 บท',
    skill_code: 'lesson',
    recurrence_type: 'weekly',
    xp_reward: 160,
    coin_reward: 40,
    child_status: 'not_started',
    progress: { current: 1, total: 4 },
  }),
  makeQuest({
    quest_id: 'w6',
    title: 'เรียนบทเรียน 5 บท',
    skill_code: 'lesson',
    recurrence_type: 'weekly',
    xp_reward: 200,
    coin_reward: 50,
    child_status: 'not_started',
    locked: true,
    progress: { current: 1, total: 5 },
  }),
  makeQuest({
    quest_id: 'w7',
    title: 'เพิ่มเพื่อน 3 คน',
    skill_code: 'social',
    recurrence_type: 'weekly',
    xp_reward: 90,
    coin_reward: 20,
    child_status: 'not_started',
    progress: { current: 0, total: 3 },
  }),
  makeQuest({
    quest_id: 'w8',
    title: 'ทำเทส ตอบถูกเกิน 50% ให้ครบ 5 เทส',
    skill_code: 'quiz',
    recurrence_type: 'weekly',
    xp_reward: 150,
    coin_reward: 40,
    child_status: 'not_started',
    progress: { current: 0, total: 5 },
  }),
  makeQuest({
    quest_id: 'w9',
    title: 'ทำเทส ตอบถูกเกิน 50% ให้ครบ 10 เทส',
    skill_code: 'quiz',
    recurrence_type: 'weekly',
    xp_reward: 280,
    coin_reward: 70,
    child_status: 'not_started',
    locked: true,
    progress: { current: 0, total: 10 },
  }),
  makeQuest({
    quest_id: 'w10',
    title: 'ทำเทส ตอบถูก 100% ให้ครบ 1 เทส',
    skill_code: 'quiz',
    recurrence_type: 'weekly',
    xp_reward: 100,
    coin_reward: 30,
    child_status: 'completed',
    progress: { current: 1, total: 1 },
  }),
  makeQuest({
    quest_id: 'w11',
    title: 'ทำเทส ตอบถูก 100% ให้ครบ 3 เทส',
    skill_code: 'quiz',
    recurrence_type: 'weekly',
    xp_reward: 300,
    coin_reward: 80,
    child_status: 'not_started',
    locked: true,
    progress: { current: 0, total: 3 },
  }),
]

// ─── Monthly Quests ────────────────────────────────────────────────────────────

export const MOCK_MONTHLY_QUESTS: QuestOut[] = [
  makeQuest({
    quest_id: 'm1',
    title: 'เช็กชื่อ 10 วัน',
    skill_code: 'login',
    recurrence_type: 'monthly',
    xp_reward: 100,
    coin_reward: 25,
    child_status: 'in_progress',
    progress: { current: 4, total: 10 },
  }),
  makeQuest({
    quest_id: 'm2',
    title: 'เช็กชื่อ 20 วัน',
    skill_code: 'login',
    recurrence_type: 'monthly',
    xp_reward: 200,
    coin_reward: 50,
    child_status: 'not_started',
    progress: { current: 4, total: 20 },
  }),
  makeQuest({
    quest_id: 'm3',
    title: 'เช็กชื่อ 28 วัน',
    skill_code: 'login',
    recurrence_type: 'monthly',
    xp_reward: 300,
    coin_reward: 80,
    child_status: 'not_started',
    locked: true,
    progress: { current: 4, total: 28 },
  }),
  makeQuest({
    quest_id: 'm4',
    title: 'เรียนบทเรียน 10 บท',
    skill_code: 'lesson',
    recurrence_type: 'monthly',
    xp_reward: 400,
    coin_reward: 100,
    child_status: 'not_started',
    progress: { current: 2, total: 10 },
  }),
  makeQuest({
    quest_id: 'm5',
    title: 'เพิ่มเพื่อน 10 คน',
    skill_code: 'social',
    recurrence_type: 'monthly',
    xp_reward: 350,
    coin_reward: 90,
    child_status: 'not_started',
    progress: { current: 0, total: 10 },
  }),
  makeQuest({
    quest_id: 'm6',
    title: 'ทำเทส ตอบถูกเกิน 50% ให้ครบ 10 เทส',
    skill_code: 'quiz',
    recurrence_type: 'monthly',
    xp_reward: 300,
    coin_reward: 80,
    child_status: 'in_progress',
    progress: { current: 5, total: 10 },
  }),
  makeQuest({
    quest_id: 'm7',
    title: 'ทำเทส ตอบถูกเกิน 50% ให้ครบ 20 เทส',
    skill_code: 'quiz',
    recurrence_type: 'monthly',
    xp_reward: 600,
    coin_reward: 160,
    child_status: 'not_started',
    locked: true,
    progress: { current: 5, total: 20 },
  }),
  makeQuest({
    quest_id: 'm8',
    title: 'ทำเทส ตอบถูก 100% ให้ครบ 5 เทส',
    skill_code: 'quiz',
    recurrence_type: 'monthly',
    xp_reward: 500,
    coin_reward: 130,
    child_status: 'not_started',
    progress: { current: 0, total: 5 },
  }),
  makeQuest({
    quest_id: 'm9',
    title: 'ทำเทส ตอบถูก 100% ให้ครบ 10 เทส',
    skill_code: 'quiz',
    recurrence_type: 'monthly',
    xp_reward: 900,
    coin_reward: 240,
    child_status: 'not_started',
    locked: true,
    progress: { current: 0, total: 10 },
  }),
]
