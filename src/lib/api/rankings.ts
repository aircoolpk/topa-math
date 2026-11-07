import { apiClient } from '@/lib/api-client'

export interface RankingEntry {
  rank_position: number
  child_profile_id: string
  nickname: string
  grade_level: number
  province: string | null
  school_name: string | null
  mastery_points: number
  speed_points: number
  improvement_points: number
  rank_score: number
  total_tests_completed: number
  current_level: number
  streak_count: number
  current_rank_title: string
  student_photo_url: string | null
}

export interface ChildOwnRank extends RankingEntry {}

export interface ProvinceSummary {
  province: string
  child_count: number
  avg_score: number
  top_score: number
}

export interface RankingsResponse {
  scope: string
  grade_level: number
  province: string | null
  school: string | null
  entries: RankingEntry[]
  child_own_rank: ChildOwnRank | null
  province_summary: ProvinceSummary[]
  is_mock: false
}

export const rankingsApi = {
  async get(
    gradeLevel: number,
    scope: 'province' | 'country' | 'grade' | 'school' = 'country',
    options: { province?: string; school?: string } = {},
  ): Promise<RankingsResponse> {
    const params: Record<string, string | number> = {
      grade_level: gradeLevel,
      scope,
    }
    if (options.province) params.province = options.province
    if (options.school) params.school = options.school
    const res = await apiClient.get('/rankings', { params })
    return res.data as RankingsResponse
  },
}
