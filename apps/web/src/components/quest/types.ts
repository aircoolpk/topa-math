/**
 * Shared Quest types for the UI layer.
 * These are derived from the backend QuestOut schema but include
 * UI-only fields needed for rendering.
 */

import type { QuestOut, QuestStatus } from '@/lib/api/quests'

export type QuestDisplayStatus = 'available' | 'in_progress' | 'completed' | 'locked'

export interface QuestUI extends Omit<QuestOut, 'child_status'> {
  displayStatus: QuestDisplayStatus
  icon: string
  difficulty: 'ง่าย' | 'ปานกลาง' | 'ยาก'
  /** Progress fraction shown as "3/5" — uses backend progress_current / progress_total */
  progress: { current: number; total: number }
  /** Progress percentage 0-100 from backend */
  progress_percent: number
  /** Whether reward can be claimed — from backend can_claim_reward */
  can_claim_reward: boolean
}
