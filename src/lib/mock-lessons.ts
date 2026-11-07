/**
 * MOCK LESSON DATA — Temporary placeholder
 * Backend endpoints needed:
 *   GET /children/{childId}/lessons/current-grade
 *   GET /children/{childId}/lessons/review
 *   (These do not exist yet — using mock data as fallback)
 */

export interface LessonItem {
  id: string
  title: string
  topic: string
  grade: number
  estimated_minutes: number
  is_review: boolean        // true = review (free), false = current grade (paid)
  is_locked: boolean        // locked regardless of membership
  access_state: 'free' | 'paid' | 'locked'
  xp_reward: number
  lesson_id: string | null
  quiz_id: string | null
  // Progress fields (from quiz sessions)
  completed_at: string | null  // ISO date if done
  best_score: number | null    // 0-100
  attempt_count: number
}

// ─── Grade 2 (Review) Lessons — Free for all members ──────────────────────────

export const REVIEW_LESSONS: LessonItem[] = [
  {
    id: 'rev-g2-1',
    title: 'บวกเลขสองหลัก',
    topic: 'การบวก',
    grade: 2,
    estimated_minutes: 20,
    is_review: true,
    is_locked: false,
    access_state: 'free',
    xp_reward: 50,
    lesson_id: 'l-g2-1',
    quiz_id: 'q-g2-1',
    completed_at: null,
    best_score: null,
    attempt_count: 0,
  },
  {
    id: 'rev-g2-2',
    title: 'ลบเลขสองหลัก',
    topic: 'การลบ',
    grade: 2,
    estimated_minutes: 20,
    is_review: true,
    is_locked: false,
    access_state: 'free',
    xp_reward: 50,
    lesson_id: 'l-g2-2',
    quiz_id: 'q-g2-2',
    completed_at: null,
    best_score: null,
    attempt_count: 0,
  },
  {
    id: 'rev-g2-3',
    title: 'ตารางคูณ 2, 5, 10',
    topic: 'การคูณ',
    grade: 2,
    estimated_minutes: 15,
    is_review: true,
    is_locked: false,
    access_state: 'free',
    xp_reward: 60,
    lesson_id: 'l-g2-3',
    quiz_id: 'q-g2-3',
    completed_at: '2026-04-28T10:00:00Z',
    best_score: 85,
    attempt_count: 2,
  },
  {
    id: 'rev-g2-4',
    title: 'การนับเวลา',
    topic: 'เวลา',
    grade: 2,
    estimated_minutes: 15,
    is_review: true,
    is_locked: false,
    access_state: 'free',
    xp_reward: 40,
    lesson_id: 'l-g2-4',
    quiz_id: 'q-g2-4',
    completed_at: null,
    best_score: null,
    attempt_count: 0,
  },
  {
    id: 'rev-g2-5',
    title: 'เงินและการทอนเงิน',
    topic: 'การเงิน',
    grade: 2,
    estimated_minutes: 20,
    is_review: true,
    is_locked: false,
    access_state: 'free',
    xp_reward: 40,
    lesson_id: 'l-g2-5',
    quiz_id: 'q-g2-5',
    completed_at: null,
    best_score: null,
    attempt_count: 0,
  },
  {
    id: 'rev-g2-6',
    title: 'รูปทรงสองมิติ',
    topic: 'เรขาคณิต',
    grade: 2,
    estimated_minutes: 15,
    is_review: true,
    is_locked: false,
    access_state: 'free',
    xp_reward: 40,
    lesson_id: 'l-g2-6',
    quiz_id: 'q-g2-6',
    completed_at: null,
    best_score: null,
    attempt_count: 0,
  },
]

// ─── Grade 3 (Current Grade) Lessons — Paid members only ──────────────────────

export const CURRENT_GRADE_LESSONS: LessonItem[] = [
  {
    id: 'cur-g3-1',
    title: 'การคูณเลขหลายหลัก',
    topic: 'การคูณ',
    grade: 3,
    estimated_minutes: 25,
    is_review: false,
    is_locked: false,
    access_state: 'paid',
    xp_reward: 70,
    lesson_id: 'l-g3-1',
    quiz_id: 'q-g3-1',
    completed_at: null,
    best_score: null,
    attempt_count: 0,
  },
  {
    id: 'cur-g3-2',
    title: 'การหารเบื้องต้น',
    topic: 'การหาร',
    grade: 3,
    estimated_minutes: 25,
    is_review: false,
    is_locked: false,
    access_state: 'paid',
    xp_reward: 70,
    lesson_id: 'l-g3-2',
    quiz_id: 'q-g3-2',
    completed_at: null,
    best_score: null,
    attempt_count: 0,
  },
  {
    id: 'cur-g3-3',
    title: 'เศษส่วนเบื้องต้น',
    topic: 'เศษส่วน',
    grade: 3,
    estimated_minutes: 30,
    is_review: false,
    is_locked: false,
    access_state: 'paid',
    xp_reward: 60,
    lesson_id: 'l-g3-3',
    quiz_id: 'q-g3-3',
    completed_at: null,
    best_score: null,
    attempt_count: 0,
  },
  {
    id: 'cur-g3-4',
    title: 'โจทย์ปัญหาหลายขั้นตอน',
    topic: 'โจทย์ระคน',
    grade: 3,
    estimated_minutes: 30,
    is_review: false,
    is_locked: true,
    access_state: 'locked',
    xp_reward: 80,
    lesson_id: null,
    quiz_id: null,
    completed_at: null,
    best_score: null,
    attempt_count: 0,
  },
  {
    id: 'cur-g3-5',
    title: 'การวัดความยาว',
    topic: 'การวัด',
    grade: 3,
    estimated_minutes: 20,
    is_review: false,
    is_locked: true,
    access_state: 'locked',
    xp_reward: 50,
    lesson_id: null,
    quiz_id: null,
    completed_at: null,
    best_score: null,
    attempt_count: 0,
  },
  {
    id: 'cur-g3-6',
    title: 'พื้นที่ผิวเบื้องต้น',
    topic: 'เรขาคณิต',
    grade: 3,
    estimated_minutes: 25,
    is_review: false,
    is_locked: true,
    access_state: 'locked',
    xp_reward: 60,
    lesson_id: null,
    quiz_id: null,
    completed_at: null,
    best_score: null,
    attempt_count: 0,
  },
]
