import { apiClient } from '@/lib/api-client'

export interface RankingEntry {
  rank: number
  child_id: string
  nickname: string
  grade_level: number
  province: string | null
  total_xp: number
  current_level: number
  streak_count: number
}

export interface RankingsResponse {
  scope: string
  grade_level: number
  entries: RankingEntry[]
  child_own_rank: RankingEntry | null
}

export const rankingsApi = {
  async get(gradeLevel: number, scope: 'province' | 'country' = 'country', province?: string) {
    const params: Record<string, string | number> = { grade_level: gradeLevel, scope }
    if (province) params.province = province
    const res = await apiClient.get('/rankings', { params })
    return res.data as RankingsResponse
  },
}
