import { apiClient } from '@/lib/api-client'

export type MembershipStatus = 'free' | 'trial' | 'paid' | 'plus' | 'basic' | 'family'

export interface ChildOut {
  id: string
  // ── Name fields ──────────────────────────────────────────────────────────────
  first_name: string | null
  last_name: string | null
  nickname: string
  // ── School fields ────────────────────────────────────────────────────────────
  grade_level: number
  school_name: string | null
  province: string | null
  district: string | null
  school_province: string | null
  school_district: string | null
  // ── Avatar ──────────────────────────────────────────────────────────────────
  avatar_gender: 'girl' | 'boy' | 'unspecified' | null
  avatar_config: Record<string, unknown>
  student_photo_url: string | null
  student_photo_path?: string | null
  // ── Progress ────────────────────────────────────────────────────────────────
  total_xp: number
  current_level: number
  streak_count: number
  // ── Stats ───────────────────────────────────────────────────────────────────
  total_score: number
  days_active: number
  /** Backend `ChildOut` returns `current_rank_title` — `rank_title` is legacy. */
  current_rank_title?: string | null
  rank_title?: string
  total_tests_completed?: number
  average_test_accuracy?: number
  average_test_speed?: number
  test_attempts_used?: number
  free_test_limit?: number
  program_type?: string
  updated_at?: string
  // ── Membership ───────────────────────────────────────────────────────────────
  /** Backend field name (authoritative) */
  membership_status?: MembershipStatus
  /** Legacy alias — kept for older payloads */
  membership?: MembershipStatus
  // ── Avatar share card fields ────────────────────────────────────────────────
  avatar_shares_count?: number
  avatar_top_likes?: number
  avatar_top_comments?: number
  // ── Coins ────────────────────────────────────────────────────────────────────
  coins: number
}

export interface ChildCreate {
  nickname: string
  grade_level: number
  province?: string
  district?: string
}

export interface ProgressData {
  total_xp: number
  current_level: number
  streak_count: number
}

export interface SkillMastery {
  id: string
  skill_id: string
  mastery_score: number
  mastery_level: string
  correct_count: number
  incorrect_count: number
  avg_response_time_ms: number
  last_practiced_at: string
}

// ─── Rank Summary (new — Codex) ─────────────────────────────────────────────

/**
 * GET /children/{id}/rank-summary
 *
 * Backend is switching to a richer payload (`xp_to_next_rank`, `next_rank`,
 * `current_rank`, `level`, `xp_into_level`, `xp_needed_for_next_level`).
 * Every field is optional so the UI keeps working against the old payload
 * (`province_rank`, `country_rank`, `rank_title`, `total_score`, `total_xp`).
 */
export interface RankSummary {
  /** Rank title name (e.g. "เด็กหัวแถว") — NOT a position number. */
  current_rank?: string | null
  /** Legacy alias for `current_rank`. */
  rank_title?: string | null
  /** Numeric position inside the province leaderboard. */
  province_rank?: number | null
  /** Numeric position inside the country leaderboard. */
  country_rank?: number | null
  /** XP still required to reach the next rank title. */
  xp_to_next_rank?: number | null
  /** Name of the next rank title. */
  next_rank?: string | null
  /** Current level derived from `level_from_total_xp`. */
  level?: number | null
  /** XP accumulated inside the current level. */
  xp_into_level?: number | null
  /** XP required to leave the current level. */
  xp_needed_for_next_level?: number | null
  total_xp?: number | null
  total_score?: number | null
  average_accuracy?: number | null
  average_speed_seconds?: number | null
}

// ─── Badge (new — Codex) ───────────────────────────────────────────────────

export interface Badge {
  /** Backend returns `code` as the stable identifier; `id` may be absent. */
  id?: string
  code: string
  /** English name (legacy payload). */
  name?: string | null
  /** Thai name (new payload). */
  name_th?: string | null
  description?: string | null
  /** Emoji / icon marker returned by the new payload. */
  icon?: string | null
  /** Legacy icon URL field. */
  icon_url?: string | null
  /** Whether the child has actually earned this badge. */
  earned?: boolean
  earned_at?: string | null
  category?: string | null
}

// ─── Recommended Next Quest (new — Codex) ──────────────────────────────────

export interface RecommendedNextQuest {
  quest_id: string | null
  /** English title (legacy payload). */
  title?: string | null
  /** Thai title (new payload). */
  title_th?: string | null
  description?: string | null
  description_th?: string | null
  reason_th?: string | null
  quest_type?: string | null
  skill_code?: string | null
  xp_reward: number
  coin_reward: number
  grade_level?: number | null
  estimated_minutes?: number | null
  lesson_id?: string | null
  quiz_id?: string | null
  progress_current?: number | null
  progress_total?: number | null
  status?: string | null
}

export const childrenApi = {
  async list() {
    const res = await apiClient.get('/children')
    return res.data as ChildOut[]
  },

  async get(childId: string) {
    const res = await apiClient.get(`/children/${childId}`)
    return res.data as ChildOut
  },

  async create(payload: ChildCreate) {
    const res = await apiClient.post('/children', payload)
    return res.data as ChildOut
  },

  async progress(childId: string) {
    const res = await apiClient.get(`/children/${childId}/progress`)
    return res.data as ProgressData
  },

  async skillMastery(childId: string) {
    const res = await apiClient.get(`/children/${childId}/skill-mastery`)
    return res.data as SkillMastery[]
  },

  /** Rank summary — shows current rank, XP to next rank */
  async getRankSummary(childId: string): Promise<RankSummary> {
    const res = await apiClient.get(`/children/${childId}/rank-summary`)
    return res.data as RankSummary
  },

  /** Badges earned by child */
  async getBadges(childId: string): Promise<Badge[]> {
    const res = await apiClient.get(`/children/${childId}/badges`)
    return res.data as Badge[]
  },

  /** Recommended next quest for the child */
  async getRecommendedNextQuest(childId: string): Promise<RecommendedNextQuest | null> {
    const res = await apiClient.get(`/children/${childId}/recommended-next-quest`)
    return res.data as RecommendedNextQuest | null
  },
}
