/**
 * Quests API client
 *
 * Backend endpoints (already implemented in apps/api/app/routers/quests.py):
 *   GET /children/{child_id}/quests
 *   GET /children/{child_id}/daily-quests
 *   GET /children/{child_id}/weekly-quests
 *   GET /children/{child_id}/monthly-quests
 *   POST /children/{child_id}/quests/{quest_id}/start
 *   POST /children/{child_id}/quests/{quest_id}/complete
 */

import { apiClient } from '@/lib/api-client'

// ─── Types ────────────────────────────────────────────────────────────────────

export type QuestType = 'daily' | 'weekly' | 'monthly'
export type QuestStatus = 'not_started' | 'in_progress' | 'completed'
export type QuestDifficulty = 'ง่าย' | 'ปานกลาง' | 'ยาก'

export interface QuestOut {
  id: string
  quest_id: string
  grade_level: number
  skill_code: string | null
  title: string
  description: string | null
  quest_type: string
  recurrence_type: string
  xp_reward: number
  coin_reward: number
  estimated_minutes: number | null
  status: string
  lesson_id: string | null
  quiz_id: string | null
  child_status: QuestStatus
  /** Quest progress (new — Codex) */
  progress_current: number
  progress_total: number
  progress_percent: number
  /** Whether reward can be claimed (new — Codex) */
  can_claim_reward: boolean
  /** Extra field used by mock data to indicate a quest is temporarily locked */
  locked?: boolean
}

export interface QuestActionOut {
  quest: QuestOut
  total_xp: number
  current_level: number
}

// Maps backend child_status to our unified QuestStatus (for UI display)
export function toDisplayStatus(
  child_status: QuestStatus,
  xp_awarded?: number | null
): 'available' | 'in_progress' | 'completed' | 'locked' {
  switch (child_status) {
    case 'in_progress': return 'in_progress'
    case 'completed':   return xp_awarded ? 'completed' : 'available'
    default:             return 'available'
  }
}

// ─── Quest Icons (emoji by skill_code pattern) ────────────────────────────────

const ICON_MAP: Record<string, string> = {
  addition:         '🧮',
  subtraction:      '👁️',
  multiplication:   '✨',
  division:         '📖',
  word_problem:     '📖',
  speed:            '⚡',
  accuracy:         '🎯',
  fractions:        '🔢',
  shapes:           '⬜',
  measurement:      '📏',
  time:             '⏰',
  money:            '💰',
  data:             '📊',
  patterns:         '🔣',
  default:          '⭐',
}

export function getQuestIcon(skillCode: string | null): string {
  if (!skillCode) return ICON_MAP.default
  const key = skillCode.toLowerCase()
  for (const [k, emoji] of Object.entries(ICON_MAP)) {
    if (key.includes(k)) return emoji
  }
  return ICON_MAP.default
}

// ─── API Client ──────────────────────────────────────────────────────────────

export const questsApi = {
  async daily(childId: string): Promise<QuestOut[]> {
    const res = await apiClient.get(`/children/${childId}/daily-quests`)
    return res.data
  },

  async weekly(childId: string): Promise<QuestOut[]> {
    const res = await apiClient.get(`/children/${childId}/weekly-quests`)
    return res.data
  },

  async monthly(childId: string): Promise<QuestOut[]> {
    const res = await apiClient.get(`/children/${childId}/monthly-quests`)
    return res.data
  },

  async all(childId: string): Promise<QuestOut[]> {
    const res = await apiClient.get(`/children/${childId}/quests`)
    return res.data
  },

  async start(childId: string, questId: string): Promise<QuestActionOut> {
    const res = await apiClient.post(`/children/${childId}/quests/${questId}/start`)
    return res.data
  },

  async complete(childId: string, questId: string): Promise<QuestActionOut> {
    const res = await apiClient.post(`/children/${childId}/quests/${questId}/complete`)
    return res.data
  },
}
