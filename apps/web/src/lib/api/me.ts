import { apiClient } from '@/lib/api-client'

// ─── Types ───────────────────────────────────────────────────────────────────

export type MembershipStatus = 'free' | 'trial' | 'paid' | 'plus' | 'family' | 'basic'
export type QuestType = 'daily' | 'weekly' | 'monthly'

export interface DashboardChild {
  id: string
  first_name: string
  last_name: string
  nickname: string
  grade_level: number
  school_name: string | null
  province: string | null
  avatar_gender: 'girl' | 'boy' | 'unspecified' | null
  avatar_config: Record<string, unknown>
  student_photo_url?: string | null
  student_photo_path?: string | null
  // Stats
  total_xp: number
  current_level: number
  streak_count: number
  total_score: number
  days_active: number
  rank_title: string
  coins: number
  // Membership
  membership: MembershipStatus
  program_type?: LessonProgram | 'THP' | string
  active_program?: LessonProgram
  can_access_ep?: boolean
  available_programs?: LessonProgram[]
  // Test attempts
  free_test_attempts_remaining: number
  free_test_attempts_limit: number
}

export interface TestLevel {
  grade: number
  title: string
  status: 'locked' | 'unlocked' | 'completed'
  lock_reason?: string
  questions_count: number
  estimated_minutes: number
}

export interface WeakSkill {
  skill_code: string
  skill_name: string
  reason: string
  recommended_lesson_id: string | null
  recommended_lesson_title: string | null
  recommended_practice_quiz_id: string | null
}

export interface Quest {
  quest_id: string
  id?: string
  title: string
  title_th?: string
  description: string | null
  description_th?: string
  quest_type: QuestType
  quest_period?: 'daily' | 'weekly' | 'monthly'
  xp_reward: number
  exp_reward?: number
  coin_reward: number
  status: 'available' | 'in_progress' | 'completed' | 'locked'
  progress_current: number
  progress_total: number
  progress_percent?: number
  can_claim_reward?: boolean
  claimed_at?: string | null
  started_at: string | null
  completed_at: string | null
  lesson_id: string | null
  quiz_id: string | null
}

export interface VisualBlock {
  block_type: string
  // Common fields (all blocks)
  title_th?: string
  label?: string
  // story_intro
  content?: string
  // emoji_counter
  items_before?: number
  items_added?: number
  items_removed?: number
  operation?: string
  emoji?: string
  result?: number
  // ten_frame
  values?: number[]
  total?: number
  // number_bond
  whole?: number
  parts?: number[]
  // bar_model
  bars?: Array<{ label?: string; value?: number; color?: string; length_pct?: number }>
  question?: string
  // count_back_strip
  start?: number
  end?: number
  step?: number
  labels?: string[]
  // step_cards / worked_example / common_mistakes / hint_box / mini_quiz
  steps?: Array<{ step?: number; number?: number; title_th?: string; description_th?: string; emoji?: string }>
  question_th?: string
  answer_th?: string
  mistakes?: Array<{ mistake_th?: string; correction_th?: string; emoji?: string }>
  hints?: string[]
  choices?: string[]
  correct_index?: number
  explanation_th?: string
  // real_life_example
  description_th?: string
  // number_sentence
  expression?: string
  // array_model / grouping_model
  rows?: number
  cols?: number
  symbols_per_cell?: number
  symbol?: string
  // fraction_visual
  numerator?: number
  denominator?: number
  // place_value_chart
  places?: Array<{ label?: string; value?: number; digits?: string }>
  // measurement_visual
  value?: number
  unit?: string
  // shape_visual
  shapes?: Array<{ name_th?: string; emoji?: string; sides?: number }>
  // table_visual
  headers?: string[]
  table_rows?: Array<{ cells?: string[] }>
  // graph_visual
  data?: Array<{ label?: string; value?: number }>
  // Generic fallback for any extra fields
  [key: string]: unknown
}

export type LessonProgram = 'TH' | 'EP'

export interface Lesson {
  // Identification
  lesson_id: string
  id?: string
  // Classification
  grade_level: number
  topic_code?: string
  skill_code?: string
  program_type?: 'TH' | 'THP' | 'EP'
  // Display
  title_th?: string
  title_en?: string
  title?: string
  // Variant / story theme
  selected_variant_id?: string
  variant_title_th?: string
  story_theme_th?: string
  // Visual blocks (new Singapore Math content)
  visual_blocks?: VisualBlock[]
  // Legacy content (fallback)
  objective_th?: string
  objective_en?: string
  thai_support?: string
  vocabulary?: Array<{ word?: string; meaning_th?: string; example_en?: string; example_th?: string }>
  explanation_en?: string
  explanation_th?: string
  story_intro_th?: string
  explanation_steps?: Array<{ step: number; text: string }>
  worked_examples?: Array<{ problem: string; solution: string }>
  common_mistakes?: Array<{ mistake: string; correction: string }>
  hints?: string[]
  // Metadata
  estimated_minutes?: number
  has_test?: boolean
  has_approved_test?: boolean
  test_available?: boolean
  test_unavailable_reason?: string | null
  language_available?: string
  ep_available?: boolean
  // Status
  status?: 'locked' | 'unlocked' | 'completed'
  is_locked?: boolean
  lock_reason?: string
  is_free_preview?: boolean
}

export interface DashboardData {
  child: DashboardChild
  active_program?: LessonProgram
  can_access_ep?: boolean
  available_programs?: LessonProgram[]
  program_type?: LessonProgram | 'THP' | string
  // Foundation test recommendation
  foundation_test: {
    recommended_grade: number
    recommended_grade_level: number  // backend field for grade-level-specific recommendation
    is_locked: boolean               // true = cannot start foundation test
    is_placement_done: boolean
    reason: string
  } | null
  // Test levels (Grade 1–6)
  test_levels: TestLevel[]
  // Recommendations
  weak_skills: WeakSkill[]
  // Quests
  daily_quests: Quest[]
  weekly_quests: Quest[]
  monthly_quests: Quest[]
  // Lessons
  lessons: Lesson[]
  current_grade_lessons?: Lesson[]
  review_lessons?: Lesson[]
  lesson_sections?: {
    current_grade_lessons?: Lesson[]
    review_lessons?: Lesson[]
    locked_lessons?: Lesson[]
    future_lessons?: Lesson[]
    all_lessons?: Lesson[]
  }
}

// ─── API ─────────────────────────────────────────────────────────────────────

export interface ShareResponse {
  mode: 'public_share'
  token: string
  share_url: string
  copy_url: string
  facebook_url: string
  x_url: string
  line_url: string
}

export interface ReferralSummary {
  referral_token: string
  referral_url: string
  click_count: number
  registered_count: number
  paid_count: number
  pending_coins: number
  active_coins: number
  history: Array<{
    id: string
    amount: number
    type: string
    status: 'pending' | 'active' | 'reversed'
    reference_id?: string | null
    created_at?: string | null
    activated_at?: string | null
    note?: string | null
  }>
}

export const meApi = {
  /** Primary dashboard endpoint */
  async getDashboard(programType: LessonProgram = 'TH'): Promise<DashboardData> {
    const res = await apiClient.get('/me/dashboard', { params: { program_type: programType } })
    return res.data as DashboardData
  },

  async createDashboardShare(): Promise<ShareResponse> {
    const res = await apiClient.post('/me/share/dashboard')
    return res.data as ShareResponse
  },

  async createTestResultShare(sessionId: string): Promise<ShareResponse> {
    const res = await apiClient.post('/me/share/test-result', { session_id: sessionId })
    return res.data as ShareResponse
  },

  async getReferralSummary(): Promise<ReferralSummary> {
    const res = await apiClient.get('/me/referral')
    return res.data as ReferralSummary
  },

  /** Test levels (grade 1–6) */
  async getTestLevels(): Promise<TestLevel[]> {
    const res = await apiClient.get('/me/test-levels')
    return res.data as TestLevel[]
  },

  /** Start a test session */
  async startTest(payload: { grade_level: number; session_type: 'placement' | 'quiz' }): Promise<{ session_id: string }> {
    const res = await apiClient.post('/me/tests/start', payload)
    return res.data as { session_id: string }
  },

  /** Submit test answers */
  async submitTestAnswer(sessionId: string, payload: {
    question_id: string
    selected_answer: string
    response_time_ms: number
    hint_used: boolean
  }): Promise<{ is_correct: boolean; correct_answer: string }> {
    const res = await apiClient.post(`/me/tests/${sessionId}/submit`, payload)
    return res.data as { is_correct: boolean; correct_answer: string }
  },

  /** Get questions for an active test session */
  async getTestQuestions(sessionId: string): Promise<{
    questions: Array<{
      id: string
      question_text: string
      choices: string[]
      hint?: string
    }>
  }> {
    const res = await apiClient.get(`/me/tests/${sessionId}/questions`)
    return res.data as { questions: Array<{ id: string; question_text: string; choices: string[]; hint?: string }> }
  },

  /** Finish a test session and get results */
  async finishTest(
    sessionId: string,
    payload: {
      answers: Array<{
        question_id: string
        selected_answer: string
        response_time_ms: number
      }>
      total_time_ms: number
    }
  ): Promise<{
    score_percent: number
    correct_count: number
    total_questions: number
    total_time_ms: number
    weak_skills: { skill_name: string; reason: string }[]
    recommendations: string[]
    xp_earned: number
    score_earned: number
  }> {
    const res = await apiClient.post(`/me/tests/${sessionId}/finish`, payload)
    return res.data as {
      score_percent: number
      correct_count: number
      total_questions: number
      total_time_ms: number
      weak_skills: { skill_name: string; reason: string }[]
      recommendations: string[]
      xp_earned: number
      score_earned: number
    }
  },

  /** Get daily quests */
  async getDailyQuests(): Promise<Quest[]> {
    const res = await apiClient.get('/me/quests/daily')
    return res.data as Quest[]
  },

  /** Get weekly quests */
  async getWeeklyQuests(): Promise<Quest[]> {
    const res = await apiClient.get('/me/quests/weekly')
    return res.data as Quest[]
  },

  /** Get monthly quests */
  async getMonthlyQuests(): Promise<Quest[]> {
    const res = await apiClient.get('/me/quests/monthly')
    return res.data as Quest[]
  },

  /** Get available lessons */
  async getLessons(grade?: number, programType?: LessonProgram): Promise<Lesson[]> {
    const params: Record<string, number | LessonProgram> = {}
    if (grade !== undefined) params.grade = grade
    if (programType) params.program_type = programType
    const res = await apiClient.get('/me/lessons', {
      params: Object.keys(params).length ? params : undefined,
    })
    const data = res.data as Lesson[] | {
      lessons?: Lesson[]
      current_grade_lessons?: Lesson[]
      review_lessons?: Lesson[]
      future_lessons?: Lesson[]
    }
    if (Array.isArray(data)) return data
    if (data.lessons?.length) return data.lessons
    return [
      ...(data.current_grade_lessons ?? []),
      ...(data.review_lessons ?? []),
      ...(data.future_lessons ?? []),
    ]
  },

  /** Start a lesson */
  async startLesson(lessonId: string, programType?: LessonProgram): Promise<{ lesson_id: string }> {
    const params = programType ? { program_type: programType } : undefined
    const res = await apiClient.post(`/me/lessons/${lessonId}/start`, undefined, { params })
    return res.data as { lesson_id: string }
  },

  /** Start a lesson test */
  async startLessonTest(lessonId: string, programType?: 'TH' | 'EP'): Promise<{ session_id: string }> {
    const params = programType ? { program_type: programType } : undefined
    const res = await apiClient.post(`/me/lessons/${lessonId}/test/start`, undefined, { params })
    return res.data as { session_id: string }
  },

  /** Get a single lesson by ID. programType defaults to TH. Use 'EP' for English Program. */
  async getLesson(lessonId: string, programType?: 'TH' | 'EP'): Promise<Lesson> {
    const params = programType ? new URLSearchParams({ program_type: programType }) : ''
    const url = params ? `/me/lessons/${lessonId}?${params}` : `/me/lessons/${lessonId}`
    const res = await apiClient.get(url)
    return res.data as Lesson
  },

  /** Claim quest reward */
  async claimQuest(questId: string): Promise<{ xp_earned: number; coin_earned: number }> {
    const res = await apiClient.post(`/me/quests/${questId}/claim`)
    return res.data as { xp_earned: number; coin_earned: number }
  },
}
