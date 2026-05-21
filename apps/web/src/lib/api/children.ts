import { apiClient } from '@/lib/api-client'

export interface ChildOut {
  id: string
  // ── Name fields ──────────────────────────────────────────────────────────────
  first_name: string
  last_name: string
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
  // ── Progress ────────────────────────────────────────────────────────────────
  total_xp: number
  current_level: number
  streak_count: number
  // ── Stats ───────────────────────────────────────────────────────────────────
  total_score: number
  days_active: number
  rank_title: string
  // ── Membership ───────────────────────────────────────────────────────────────
  membership: 'free' | 'basic' | 'plus' | 'family'
  // ── Avatar share card fields ────────────────────────────────────────────────
  avatar_shares_count: number
  avatar_top_likes: number
  avatar_top_comments: number
  // ── Coins (new — Codex) ───────────────────────────────────────────────────────
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

export interface RankSummary {
  current_rank: string
  xp_to_next_rank: number
  next_rank: string | null
  total_xp: number
  level: number
}

// ─── Badge (new — Codex) ───────────────────────────────────────────────────

export interface Badge {
  id: string
  code: string
  name: string
  description: string | null
  icon_url: string | null
  earned_at: string | null
  category: string | null
}

// ─── Recommended Next Quest (new — Codex) ──────────────────────────────────

export interface RecommendedNextQuest {
  quest_id: string
  title: string
  description: string | null
  skill_code: string | null
  xp_reward: number
  coin_reward: number
  grade_level: number
  quest_type: string
  estimated_minutes: number | null
  lesson_id: string | null
  quiz_id: string | null
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
