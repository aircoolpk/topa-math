import { apiClient } from '@/lib/api-client'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Question {
  id: string
  skill_id: string
  grade_level: number
  question_type: string
  difficulty: string
  question_text: string
  choices: string[]
  correct_answer: string
  explanation: string
  hint: string
}

export interface PlacementStartResponse {
  session_id: string
  questions: Question[]
}

export interface QuizAnswerIn {
  question_id: string
  selected_answer: string
  response_time_ms: number
  hint_used: boolean
  attempt_count?: number
}

export interface AnswerResult {
  is_correct: boolean
  correct_answer: string
  mistake_type: string
}

export interface SessionCompleteResult {
  session_id: string
  correct_count: number
  mastery: {
    skill_id: string
    mastery_score: number
    mastery_level: string
  }[]
}

export interface Subject {
  id: string
  code: string
  name: string
}

export interface Skill {
  id: string
  code: string
  name: string
  subject_id: string
  grade_level: number
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const learningApi = {
  async getSubjects() {
    const res = await apiClient.get('/subjects')
    return res.data as Subject[]
  },

  async getSkills(subject: string = 'math', gradeLevel: number = 1) {
    const res = await apiClient.get('/skills', { params: { subject, grade_level: gradeLevel } })
    return res.data as Skill[]
  },

  async startPlacement(childId: string) {
    const res = await apiClient.post(`/children/${childId}/placement/start`)
    return res.data as PlacementStartResponse
  },

  async answerQuestion(sessionId: string, payload: QuizAnswerIn) {
    const res = await apiClient.post(`/quiz-sessions/${sessionId}/answer`, payload)
    return res.data as AnswerResult
  },

  async completeSession(sessionId: string) {
    const res = await apiClient.post(`/quiz-sessions/${sessionId}/complete`)
    return res.data as SessionCompleteResult
  },

  async getSkillMastery(childId: string) {
    const res = await apiClient.get(`/children/${childId}/skill-mastery`)
    return res.data
  },

  async getProgress(childId: string) {
    const res = await apiClient.get(`/children/${childId}/progress`)
    return res.data
  },

  /**
   * Course map — groups lessons/topics by grade and topic.
   * Backend: GET /children/{childId}/course-map (NOT YET IMPLEMENTED → falls back to mock)
   */
  async getCourseMap(childId: string) {
    const res = await apiClient.get(`/children/${childId}/course-map`)
    return res.data as CourseMapResponse
  },
}

// ─── Course Map Types ─────────────────────────────────────────────────────────

export interface CourseMapItem {
  grade: number
  title: string
  skill_code: string
  status: 'locked' | 'available' | 'completed'
  xp_reward: number
  lesson_id: string | null
  quiz_id: string | null
}

export interface CourseMapResponse {
  items: CourseMapItem[]
  current_grade: number
}
