'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/auth'
import { childrenApi, type ChildOut } from '@/lib/api/children'
import { meApi, type DashboardData, type Quest, type Lesson, type TestLevel } from '@/lib/api/me'
import { billingApi, type BillingStatus } from '@/lib/api/billing'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const GRADE_LABEL: Record<number, string> = {
  1: 'ป.1', 2: 'ป.2', 3: 'ป.3', 4: 'ป.4', 5: 'ป.5', 6: 'ป.6',
}

const RANK_TITLES: Record<number, string> = {
  1: 'มือใหม่', 2: 'นักเรียน', 3: 'นักเรียนชั้นสูง', 4: 'ผู้ฝึกฝน',
  5: 'ผู้เชี่ยวชาญ', 6: 'เซียน', 7: 'อัจฉริยะ', 8: 'ตำนาน',
}

function gradeLabel(g: number | undefined | null) {
  if (g == null) return '—'
  if (!GRADE_LABEL[g]) return `ชั้นที่ ${g}`
  return GRADE_LABEL[g]
}

/** Resolves recommended grade using the fallback chain from the spec. */
function resolveRecommendedGrade(foundationTest: DashboardData['foundation_test'], childGrade: number): number {
  if (foundationTest?.recommended_grade != null && foundationTest.recommended_grade > 0) {
    return foundationTest.recommended_grade
  }
  if (childGrade > 1) return childGrade - 1
  return 1
}

function getRankTitle(level: number) { return RANK_TITLES[level] ?? 'นักเรียน' }

function XPBar({ current, max = 1000 }: { current: number; max?: number }) {
  const pct = Math.min((current % max) / max * 100, 100)
  return (
    <div className="xp-bar-bg">
      <div className="xp-bar-fill" style={{ width: `${pct}%` }} />
    </div>
  )
}

// ─── Avatar Preview (simplified inline) ──────────────────────────────────────

function AvatarPreview({ child, size = 'md' }: { child: ChildOut; size?: 'sm' | 'md' | 'lg' }) {
  const isGirl = child.avatar_gender === 'girl'
  const sz = size === 'lg' ? 'w-24 h-24 text-4xl' : size === 'sm' ? 'w-10 h-10 text-base' : 'w-16 h-16 text-2xl'
  const initials = child.nickname?.charAt(0) ?? '?'
  const colors = isGirl
    ? 'from-pink-300 to-rose-400'
    : 'from-blue-300 to-cyan-400'
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br ${colors} flex items-center justify-center text-white font-extrabold shadow-lg border-2 border-white`}>
      {initials}
    </div>
  )
}

// ─── Membership Badge ──────────────────────────────────────────────────────────

function getMembershipLabel(planCode: string | null): string {
  if (!planCode) return '🌱 สมาชิกฟรี'
  if (planCode.includes('founder')) return '👑 Founder'
  if (planCode.includes('ep_')) return '🌏 EP Plus'
  if (planCode.includes('th_')) return '📖 TH Plus'
  if (planCode.includes('plus')) return '⚡ Plus'
  return '🌱 สมาชิกฟรี'
}

function getMembershipColors(planCode: string | null): { color: string; bg: string } {
  if (!planCode) return { color: 'text-gray-600', bg: 'bg-gray-100' }
  if (planCode.includes('founder')) return { color: 'text-amber-700', bg: 'bg-amber-50' }
  if (planCode.includes('ep_')) return { color: 'text-blue-700', bg: 'bg-blue-50' }
  if (planCode.includes('th_')) return { color: 'text-accent-700', bg: 'bg-accent-50' }
  if (planCode.includes('plus')) return { color: 'text-accent-700', bg: 'bg-accent-50' }
  return { color: 'text-gray-600', bg: 'bg-gray-100' }
}

function MembershipBadge({ planCode }: { planCode: string | null }) {
  const label = getMembershipLabel(planCode)
  const { color, bg } = getMembershipColors(planCode)
  return (
    <span className={`text-xs font-bold px-3 py-1 rounded-full ${bg} ${color}`}>
      {label}
    </span>
  )
}

// ─── Section Wrapper ──────────────────────────────────────────────────────────

function SectionWrapper({ id, title, subtitle, action, children }: {
  id?: string; title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <section id={id} className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="section-title mb-0">{title}</h2>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
      {children}
    </section>
  )
}

// ─── Quest Card ───────────────────────────────────────────────────────────────

// ─── Quest Card (passive, claim-based) ─────────────────────────────────────────

type QuestPeriod = 'daily' | 'weekly' | 'monthly'

const EXP_PERIOD: Record<QuestPeriod, number> = {
  daily: 1,
  weekly: 3,
  monthly: 7,
}

function QuestCard({ quest, period, onClaim }: {
  quest: Quest
  period: QuestPeriod
  onClaim: (q: Quest) => void
}) {
  // Prefer quest_id, fall back to id
  const questId = quest.quest_id || quest.id || ''
  const pct = quest.progress_total > 0 ? (quest.progress_current / quest.progress_total) * 100 : (quest.progress_percent ?? 0)
  const xp = quest.exp_reward ?? quest.xp_reward ?? EXP_PERIOD[period]
  const isClaimed = quest.status === 'completed' || quest.claimed_at != null
  const canClaim = quest.can_claim_reward === true || (quest.status === 'completed' && !isClaimed)
  const isLocked = quest.status === 'locked'

  return (
    <div className={`card border-0 shadow-md ${isLocked ? 'opacity-60' : ''}`}>
      {/* Title + status badge */}
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-bold text-gray-900 text-sm flex-1 pr-2">
          {quest.title_th ?? quest.title}
        </h3>
        {/* Status badge */}
        {isLocked ? (
          <span className="text-xs flex-shrink-0 ml-2 font-bold bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">🔒 ยังไม่ปลดล็อก</span>
        ) : isClaimed ? (
          <span className="text-xs flex-shrink-0 ml-2 font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✓ รับแล้ว</span>
        ) : canClaim ? (
          <span className="text-xs flex-shrink-0 ml-2 font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">✨ เคลมได้</span>
        ) : (
          <span className="text-xs flex-shrink-0 ml-2 font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">🔄 กำลังทำ</span>
        )}
      </div>

      {/* Description */}
      {(quest.description_th ?? quest.description) && (
        <p className="text-xs text-gray-500 mb-3">
          {quest.description_th ?? quest.description}
        </p>
      )}

      {/* Progress bar */}
      <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
        <div
          className={`h-2 rounded-full transition-all ${isClaimed ? 'bg-green-400' : 'bg-gradient-to-r from-amber-400 to-orange-500'}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>

      {/* Progress text + reward */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {quest.progress_current}/{quest.progress_total}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-amber-500">⚡ +{xp} EXP</span>

          {/* Action */}
          {isLocked ? null : isClaimed ? null : canClaim ? (
            <button
              onClick={() => onClaim(quest)}
              className="text-xs font-bold bg-amber-400 hover:bg-amber-500 text-white px-3 py-1 rounded-lg transition-colors"
            >
              เคลม EXP
            </button>
          ) : (
            <span className="text-xs text-gray-400">ยังไม่สำเร็จ</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Lesson Card ──────────────────────────────────────────────────────────────

function LessonCard({ lesson, child, onLearn, onTest, testLoading }: {
  lesson: Lesson; child: ChildOut; onLearn: (l: Lesson) => void; onTest: (l: Lesson) => void; testLoading?: boolean
}) {
  const isLocked = lesson.status === 'locked'
  const isCompleted = lesson.status === 'completed'
  return (
    <div className={`card border-0 shadow-md ${isLocked ? 'opacity-80' : ''}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">
            {gradeLabel(lesson.grade_level)}
          </span>
          {lesson.is_free_preview && !isLocked && (
            <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">ฟรี</span>
          )}
        </div>
        {isCompleted && <span className="text-green-500 text-xs">✓ เสร็จแล้ว</span>}
        {isLocked && (
          <span className="text-gray-400 text-xs flex items-center gap-0.5">
            <span>🔒</span> {lesson.lock_reason ?? 'ล็อก'}
          </span>
        )}
      </div>
      <h3 className="font-bold text-gray-900 text-sm mb-0.5">{lesson.title_th ?? lesson.title}</h3>
      <p className="text-xs text-gray-500 mb-1">{lesson.topic_code ?? ''} · ⏱️ {lesson.estimated_minutes ?? 0} นาที</p>
      {!isLocked ? (
        <div className="flex gap-2 mt-2">
          <button onClick={() => onLearn(lesson)} className="flex-1 text-xs font-bold bg-primary-50 hover:bg-primary-100 text-primary-700 py-1.5 rounded-lg transition-colors">
            📖 เรียน
          </button>
          <button
            onClick={() => onTest(lesson)}
            disabled={testLoading}
            className="flex-1 text-xs font-bold bg-accent-50 hover:bg-accent-100 disabled:opacity-50 text-accent-700 py-1.5 rounded-lg transition-colors"
          >
            {testLoading ? '...' : '📝 ทำเทส'}
          </button>
        </div>
      ) : (
        <div className="mt-2">
          <Link
            href="/pricing"
            className="block text-center text-xs font-bold bg-accent-50 hover:bg-accent-100 text-accent-700 py-1.5 rounded-lg transition-colors"
          >
            🔒 อัปเกรด Plus
          </Link>
        </div>
      )}
    </div>
  )
}

// ─── Test Level Card ───────────────────────────────────────────────────────────

function TestLevelCard({ level, onStart }: {
  level: TestLevel; onStart: (l: TestLevel) => void
}) {
  const isLocked = level.status === 'locked'
  const isCompleted = level.status === 'completed'
  const accentColors = [
    'from-green-400 to-emerald-500', 'from-blue-400 to-primary-500',
    'from-primary-400 to-primary-600', 'from-amber-400 to-orange-500',
    'from-orange-400 to-red-400',     'from-purple-400 to-pink-500',
  ]
  const color = accentColors[(level.grade - 1) % accentColors.length]
  return (
    <div className={`card border-0 shadow-md ${isLocked ? 'opacity-60' : isCompleted ? 'opacity-80' : ''}`}>
      <div className={`h-1.5 bg-gradient-to-r ${color} rounded-t-xl mb-3`} />
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-white font-extrabold shadow-sm`}>
          ป.{level.grade}
        </div>
        <div>
          <h3 className="font-bold text-gray-900 text-sm">{level.title}</h3>
          <p className="text-xs text-gray-400">{level.questions_count} ข้อ · {level.estimated_minutes} นาที</p>
        </div>
      </div>
      <div className="mb-2">
        {isCompleted && <span className="text-green-600 text-xs font-bold">✓ ทำเสร็จแล้ว</span>}
        {isLocked && <span className="text-gray-400 text-xs">{level.lock_reason ?? '🔒 ต้องสมัคร Plus'}</span>}
        {!isLocked && !isCompleted && <span className="text-primary-600 text-xs font-bold">🟢 พร้อมสอบ</span>}
      </div>
      {!isLocked && !isCompleted && (
        <button
          onClick={() => onStart(level)}
          className={`w-full text-xs font-bold py-2 rounded-xl transition-all ${isCompleted ? 'bg-gray-100 text-gray-400' : 'bg-gradient-to-r ' + color + ' text-white shadow-md hover:shadow-lg hover:-translate-y-0.5'}`}
        >
          เริ่มเทส
        </button>
      )}
      {isLocked && (
        <Link
          href="/pricing"
          className="w-full text-xs font-bold py-2 rounded-xl bg-accent-50 hover:bg-accent-100 text-accent-700 text-center block transition-colors"
        >
          🔒 อัปเกรด Plus
        </Link>
      )}
    </div>
  )
}

// ─── Test Taking Modal ─────────────────────────────────────────────────────────

interface TestQuestion {
  id: string
  question_text: string
  choices: string[]
  hint?: string
}

interface TestState {
  sessionId: string
  questions: TestQuestion[]
  currentIdx: number
  answers: Record<string, string>
  results: Record<string, { is_correct: boolean; correct_answer: string }>
  submitted: boolean
  startTime: number
  loading: boolean
  error: string | null
}

function TestModal({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const [state, setState] = useState<TestState>({
    sessionId,
    questions: [],
    currentIdx: 0,
    answers: {},
    results: {},
    submitted: false,
    startTime: Date.now(),
    loading: true,
    error: null,
  })

  // Fetch questions on mount — mock for now since we don't have session-specific API
  useEffect(() => {
    // TODO (Codex): Backend needs GET /me/tests/{sessionId}/questions
    // For now, show a placeholder UI that lets user type an answer
    setState(s => ({ ...s, loading: false }))
  }, [sessionId])

  const handleAnswer = (questionId: string, answer: string) => {
    setState(s => ({ ...s, answers: { ...s.answers, [questionId]: answer } }))
  }

  const handleSubmit = async () => {
    if (!state.questions.length) {
      // No questions from API — just close with mock feedback
      onClose()
      return
    }
    setState(s => ({ ...s, submitted: true }))
  }

  if (state.loading) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 text-center shadow-2xl">
          <div className="text-4xl mb-3 animate-bounce">📝</div>
          <p className="text-gray-700 font-bold">กำลังโหลดคำถาม...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white rounded-t-2xl border-b border-gray-100 p-4 flex items-center justify-between">
          <div>
            <h2 className="font-extrabold text-gray-900">📝 ทดสอบวัดผล</h2>
            <p className="text-xs text-gray-400 mt-0.5">Session: {sessionId.slice(0, 8)}...</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none px-2">×</button>
        </div>

        <div className="p-5">
          {!state.questions.length ? (
            <div className="text-center py-8">
              <div className="text-5xl mb-4">⚠️</div>
              <h3 className="font-bold text-gray-900 mb-2">Backend endpoint missing</h3>
              <p className="text-sm text-gray-500 mb-4">
                Backend ยังไม่มี GET /me/tests/{sessionId}/questions
              </p>
              <p className="text-xs text-gray-400 mb-6">
                สำหรับ MVP ตอนนี้ กรุณาให้ Codex เพิ่ม endpoint นี้ก่อน<br/>
                หรือใช้ <code>/children/{'{childId}'}/placement/start</code> แทน
              </p>
              <button onClick={onClose} className="btn-primary">
                ปิด
              </button>
            </div>
          ) : (
            <>
              {/* Question */}
              {state.questions.map((q, qi) => (
                <div key={q.id} className={`mb-6 ${qi !== state.currentIdx ? 'hidden' : ''}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-bold bg-primary-100 text-primary-700 px-2 py-1 rounded-full">
                      ข้อ {qi + 1}/{state.questions.length}
                    </span>
                  </div>
                  <p className="text-gray-900 font-semibold mb-4">{q.question_text}</p>
                  <div className="space-y-2">
                    {q.choices.map((choice, ci) => {
                      const isSelected = state.answers[q.id] === choice
                      const result = state.results[q.id]
                      const isCorrect = result?.correct_answer === choice
                      return (
                        <button
                          key={ci}
                          onClick={() => !state.submitted && handleAnswer(q.id, choice)}
                          disabled={state.submitted}
                          className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                            state.submitted
                              ? isCorrect ? 'border-green-400 bg-green-50 text-green-700'
                              : isSelected ? 'border-red-400 bg-red-50 text-red-700'
                              : 'border-gray-200 text-gray-400'
                              : isSelected
                              ? 'border-primary-400 bg-primary-50 text-primary-700'
                              : 'border-gray-200 text-gray-700 hover:border-primary-200 hover:bg-primary-50'
                          }`}
                        >
                          {choice}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}

              {/* Navigation */}
              <div className="flex gap-3 mt-4">
                {state.currentIdx > 0 && (
                  <button onClick={() => setState(s => ({ ...s, currentIdx: s.currentIdx - 1 }))}
                    className="btn-secondary flex-1">← ก่อนหน้า</button>
                )}
                {state.currentIdx < state.questions.length - 1 ? (
                  <button onClick={() => setState(s => ({ ...s, currentIdx: s.currentIdx + 1 }))}
                    className="btn-primary flex-1">ถัดไป →</button>
                ) : (
                  <button onClick={handleSubmit}
                    className="btn-primary flex-1 bg-green-500 hover:bg-green-600">
                    ✓ ส่งคำตอบ
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Dashboard Page ──────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter()
  const { user, logout, checkAuth } = useAuthStore()

  const [child, setChild] = useState<ChildOut | null>(null)
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [testSessionId, setTestSessionId] = useState<string | null>(null)
  const [testLoading, setTestLoading] = useState(false)
  const [testError, setTestError] = useState<string | null>(null)
  const [questTab, setQuestTab] = useState<'daily' | 'weekly' | 'monthly'>('daily')
  const [claimFeedback, setClaimFeedback] = useState<string | null>(null)
  const [selectedLessonGrade, setSelectedLessonGrade] = useState<number>(1)
  const [lessonTestLoading, setLessonTestLoading] = useState<string | null>(null)
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null)

  // Auth guard
  useEffect(() => {
    checkAuth().then(() => {
      if (!localStorage.getItem('access_token')) router.push('/login')
    })
  }, [])

  // Load child + dashboard data
  const loadData = useCallback(async () => {
    try {
      const children = await childrenApi.list()
      if (children.length === 0) {
        router.push('/register')
        return
      }
      const firstChild = children[0]
      setChild(firstChild)
      // Set default lesson grade tab to child's current grade
      const childGrade = firstChild?.grade_level
      if (childGrade != null && childGrade >= 1 && childGrade <= 6) {
        setSelectedLessonGrade(childGrade)
      }

      // Try loading /me/dashboard
      try {
        const dash = await meApi.getDashboard()
        setDashboard(dash)
      } catch {
        // API not available — build dashboard from child data + mocks
        const mockDashboard = buildMockDashboard(firstChild)
        setDashboard(mockDashboard)
      }

      // Also try to fetch lessons separately in case dashboard doesn't include them
      try {
        const lessons = await meApi.getLessons()
        if (lessons.length > 0) {
          setDashboard(prev => {
            if (!prev) return prev
            return { ...prev, lessons }
          })
        }
      } catch {
        // lessons fetch failed — rely on dashboard data or mock
      }

      // Fetch billing status
      try {
        const status = await billingApi.getStatus()
        setBillingStatus(status)
      } catch {
        // billing status unavailable — not critical
      }
    } catch (err) {
      console.error('[dashboard] load error:', err)
      setError('ไม่สามารถเชื่อมต่อระบบได้ กรุณาตรวจสอบว่า backend เปิดอยู่ที่ 8001')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    if (user) loadData()
  }, [user, loadData])

  // ── Test start handler ──────────────────────────────────────────────────────
  // Calls POST /me/tests/start with grade_level and session_type ('placement'|'quiz').
  // Backend returns { session_id }. Frontend then navigates to /dashboard/tests/{session_id}.
  const handleStartTest = async (level: TestLevel, mode: 'quiz' | 'foundation' = 'quiz') => {
    if (!child) return
    setTestLoading(true)
    setTestError(null)
    try {
      const { session_id } = await meApi.startTest({
        grade_level: level.grade,
        session_type: 'quiz',
      })
      setTestLoading(false)
      router.push(`/dashboard/tests/${session_id}`)
    } catch (err: unknown) {
      const isDev = process.env.NODE_ENV !== 'production'
      if (isDev) {
        const e = err as { response?: { status?: number; data?: unknown }; message?: string }
        console.error('[dashboard] เริ่มเทสวัดผลล้มเหลว', {
          endpoint: '/me/tests/start',
          payload: { grade_level: level.grade, session_type: 'quiz', mode },
          status: e?.response?.status,
          body: e?.response?.data,
          message: e?.message,
        })
      }
      setTestLoading(false)
      setTestError('เริ่มแบบทดสอบไม่ได้ กรุณาลองใหม่อีกครั้ง')
    }
  }

  // ── Lesson navigation ─────────────────────────────────────────────────────────
  const handleLearnLesson = (lesson: Lesson) => {
    router.push(`/dashboard/lessons/${lesson.lesson_id}`)
  }

  // ── Claim quest reward ────────────────────────────────────────────────────────
  const handleClaimQuest = async (quest: Quest) => {
    const questId = quest.quest_id || quest.id
    if (!questId) return
    try {
      const { xp_earned } = await meApi.claimQuest(questId)
      setClaimFeedback(`ได้รับ ${xp_earned} EXP แล้ว!`)
      // Refresh dashboard to update total XP
      router.refresh()
      // Clear feedback after 3s
      setTimeout(() => setClaimFeedback(null), 3000)
    } catch (err: unknown) {
      if (process.env.NODE_ENV !== 'production') {
        const e = err as { response?: { status?: number; data?: unknown }; message?: string }
        console.error('[dashboard] เคลม EXP ล้มเหลว', {
          endpoint: `/me/quests/${questId}/claim`,
          status: e?.response?.status,
          body: e?.response?.data,
          message: e?.message,
        })
      }
      setClaimFeedback('เคลม EXP ไม่สำเร็จ กรุณาลองใหม่')
      setTimeout(() => setClaimFeedback(null), 3000)
    }
  }

  const handleTestLesson = async (lesson: Lesson) => {
    if (!child) return
    const lessonId = lesson.lesson_id || (lesson as unknown as Record<string, unknown>).id as string
    if (!lessonId) return
    setLessonTestLoading(lessonId)
    try {
      const { session_id } = await meApi.startLessonTest(lessonId)
      router.push(`/dashboard/tests/${session_id}`)
    } catch (err: unknown) {
      const isDev = process.env.NODE_ENV !== 'production'
      if (isDev) {
        const e = err as { response?: { status?: number; data?: unknown }; message?: string }
        console.error('[dashboard] เริ่มเทสบทเรียนล้มเหลว', {
          endpoint: `/me/lessons/${lessonId}/test/start`,
          status: e?.response?.status,
          body: e?.response?.data,
          message: e?.message,
        })
      }
      setLessonTestLoading(null)
      alert('ไม่สามารถเริ่มเทสได้ กรุณาลองใหม่')
    }
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-bounce">🎮</div>
          <p className="text-gray-600 font-semibold">กำลังโหลด...</p>
        </div>
      </div>
    )
  }

  if (error || !child) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="card text-center py-12 max-w-md">
          <div className="text-5xl mb-4">😢</div>
          <h2 className="section-title mb-2">เกิดข้อผิดพลาด</h2>
          <p className="text-gray-500 mb-6">{error ?? 'ไม่พบโปรไฟล์เด็ก'}</p>
          <div className="flex gap-3">
            <button onClick={() => router.push('/login')} className="btn-secondary flex-1">เข้าสู่ระบบใหม่</button>
            <button onClick={() => { setError(null); setLoading(true); loadData(); }} className="btn-primary flex-1">ลองใหม่</button>
          </div>
        </div>
      </div>
    )
  }

  const isPaid = billingStatus?.is_paid ?? child.membership !== 'free'
  const canManageSystem = user?.role === 'owner' || user?.role === 'admin'
  const { foundation_test, test_levels, weak_skills, daily_quests, weekly_quests, monthly_quests, lessons } =
    dashboard ?? buildMockDashboard(child)

  return (
    <div className="min-h-screen bg-background">

      {/* ── HEADER ── */}
      <header className="bg-white border-b border-primary-100 shadow-sm sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-9 h-9 bg-gradient-to-br from-primary-400 to-primary-600 rounded-xl flex items-center justify-center shadow">
                <span className="text-white text-lg font-black">4</span>
              </div>
              <span className="font-bold text-gray-900 text-lg hidden sm:block">4-Craft</span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 hidden sm:block">{user?.email}</span>
            <Link
              href="/billing"
              className="text-xs font-bold bg-accent-100 text-accent-700 px-3 py-1.5 rounded-full hover:bg-accent-200 transition-colors"
            >
              💳 จัดการบิลลิ่ง
            </Link>
            {canManageSystem && (
              <Link
                href="/admin"
                className="text-xs font-bold bg-gray-900 text-white px-3 py-1.5 rounded-full hover:bg-gray-700 transition-colors"
              >
                จัดการระบบ
              </Link>
            )}
            <button onClick={logout} className="btn-ghost text-sm text-red-500 hover:bg-red-50">
              ออก
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">

        {/* ── A. HERO: Student + Avatar ── */}
        <div className="bg-gradient-to-br from-primary-50 via-white to-accent-50 rounded-2xl border border-primary-100 shadow-lg p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">

            {/* Avatar */}
            <div className="flex flex-col items-center gap-3 flex-shrink-0">
              <div className="relative">
                <AvatarPreview child={child} size="lg" />
                {/* Level badge */}
                <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-amber-400 rounded-full border-2 border-white flex items-center justify-center text-xs font-black text-amber-900 shadow">
                  {child.current_level}
                </div>
              </div>
              <div className="flex gap-2">
                <Link href="/dashboard/avatar" className="text-xs font-bold bg-white border border-primary-200 text-primary-700 px-3 py-1.5 rounded-xl hover:bg-primary-50 transition-colors">
                  👗 แต่งตัวละคร
                </Link>
                <button className="text-xs font-bold bg-white border border-primary-200 text-primary-700 px-3 py-1.5 rounded-xl hover:bg-primary-50 transition-colors">
                  📤 แชร์
                </button>
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 text-center md:text-left w-full">
              <div className="flex flex-col sm:flex-row items-center gap-3 mb-3">
                <div>
                  <h1 className="text-2xl font-extrabold text-gray-900">{child.nickname}</h1>
                  <p className="text-sm text-gray-500">
                    {child.first_name} {child.last_name}
                    {child.school_name ? ` · ${child.school_name}` : ''}
                  </p>
                </div>
                <MembershipBadge planCode={billingStatus?.plan_code ?? child.membership} />
              </div>

              {/* THP/EP toggle */}
              <div className="flex gap-2 mb-4 justify-center md:justify-start">
                {['THP', 'EP'].map(p => (
                  <button key={p}
                    className={`text-xs font-bold px-4 py-1.5 rounded-full border-2 transition-all ${
                      p === 'THP'
                        ? 'border-primary-400 bg-primary-50 text-primary-700'
                        : 'border-gray-200 bg-white text-gray-400 cursor-not-allowed'
                    }`}
                    disabled={p === 'EP'}
                  >
                    {p === 'EP' ? '🔒 EP' : '✓ THP'}
                  </button>
                ))}
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-4">
                {[
                  { label: 'เลเวล', value: child.current_level, emoji: '⭐' },
                  { label: 'XP', value: child.total_xp.toLocaleString(), emoji: '💡' },
                  { label: 'คะแนน', value: child.total_score.toLocaleString(), emoji: '🎯' },
                  { label: 'เหรียญ', value: child.coins, emoji: '🪙' },
                  { label: 'วันเข้า', value: child.days_active, emoji: '📅' },
                  { label: 'ตำแหน่ง', value: child.rank_title || getRankTitle(child.current_level), emoji: '🏆' },
                ].map(stat => (
                  <div key={stat.label} className="bg-white rounded-xl p-2 shadow-sm text-center border border-gray-100">
                    <div className="text-lg">{stat.emoji}</div>
                    <div className="font-extrabold text-gray-900 text-sm">{stat.value}</div>
                    <div className="text-xs text-gray-400">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* XP Bar */}
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>XP ไปสู่เลเวลถัดไป</span>
                  <span>{child.total_xp % 1000} / 1000</span>
                </div>
                <XPBar current={child.total_xp} />
              </div>

              {/* Upgrade CTA — shown only to free users */}
              {!isPaid && (
                <div className="mt-4 flex flex-col sm:flex-row items-center gap-3 bg-gradient-to-r from-accent-50 to-accent-100 border border-accent-200 rounded-xl p-3">
                  <div className="flex-1">
                    <p className="text-sm font-bold text-accent-700">
                      ⭐ อัปเกรด Plus เพื่อปลดล็อกทุกบทเรียน
                    </p>
                    <p className="text-xs text-accent-600 mt-0.5">
                      ป.1–ป.6 ครบ · เทสได้ทุกระดับ · AI วิเคราะห์จุดอ่อน
                    </p>
                  </div>
                  <Link
                    href="/pricing"
                    className="flex-shrink-0 text-sm font-bold bg-gradient-to-r from-accent-500 to-accent-600 hover:from-accent-600 hover:to-accent-700 text-white px-5 py-2 rounded-xl shadow-md hover:shadow-lg transition-all"
                  >
                    ⚡ อัปเกรด Plus
                  </Link>
                </div>
              )}

              {/* Plus user indicator */}
              {isPaid && (
                <div className="mt-4 flex items-center gap-2 bg-gradient-to-r from-accent-50 to-accent-100 border border-accent-200 rounded-xl px-4 py-2">
                  <span className="text-accent-500 font-bold">⚡</span>
                  <span className="text-sm font-bold text-accent-700">สมาชิก Plus</span>
                  <span className="text-xs text-accent-500">· เข้าถึงบทเรียน ป.1–ป.6 แล้ว</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── B. FOUNDATION TEST CARD ── */}
        {foundation_test && !foundation_test.is_placement_done && (() => {
          // Lock determination (mutually exclusive):
          // 1. Backend explicitly locked → is_locked = true
          // 2. Free quota exhausted → cannot start
          const freeQuotaExhausted =
            !isPaid && dashboard != null && dashboard.child.free_test_attempts_remaining <= 0
          const isLocked =
            foundation_test.is_locked === true || freeQuotaExhausted

          // Derive display grade — prefer recommended_grade_level, fall back to recommended_grade
          const displayGrade = foundation_test.recommended_grade_level > 0
            ? foundation_test.recommended_grade_level
            : foundation_test.recommended_grade > 0
              ? foundation_test.recommended_grade
              : 1

          return (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-5 mb-8 shadow-md">
              <div className="flex items-start gap-4">
                <div className="text-4xl">🧭</div>
                <div className="flex-1">
                  <h2 className="font-extrabold text-gray-900 text-lg mb-1">
                    เริ่มจากเทสพื้นฐานก่อนเรียน
                  </h2>
                  <p className="text-sm text-gray-600 mb-3">
                    แนะนำให้ทำเทสพื้นฐาน{' '}
                    <strong>{gradeLabel(displayGrade)}</strong>
                    {' — '}{foundation_test.reason}
                  </p>

                  {/* Error message */}
                  {testError && (
                    <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                      ⚠️ {testError}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3 items-center">

                    {/* ── Free user: available ── */}
                    {!isPaid && !isLocked && dashboard && (
                      <span className="text-xs font-bold bg-green-100 text-green-700 px-3 py-1 rounded-full">
                        🌱 สมาชิกฟรีสามารถทำเทสที่ระบบแนะนำได้
                        {' · '}
                        เหลือสิทธิ์เทสฟรีอีก {dashboard.child.free_test_attempts_remaining} ครั้ง
                      </span>
                    )}

                    {/* ── Free user: quota exhausted ── */}
                    {!isPaid && isLocked && (
                      <span className="text-xs font-bold bg-red-100 text-red-700 px-3 py-1.5 rounded-full">
                        🔒 ใช้สิทธิ์เทสฟรีครบแล้ว กรุณาอัปเกรดเพื่อทำเทสเพิ่มเติม
                      </span>
                    )}

                    {/* ── Paid user ── */}
                    {isPaid && (
                      <span className="text-xs font-bold bg-green-100 text-green-700 px-3 py-1 rounded-full">
                        ⚡ เลือกทำเทสได้ทุกระดับชั้น
                      </span>
                    )}

                    {/* ── Informational note: start tests from test-level cards below ── */}
                    {!isLocked && (
                      <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                        💡 เลือกระดับชั้นด้านล่างเพื่อเริ่มเทส
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

        {/* ── C. TEST LEVEL SELECTION ── */}
        {test_levels && test_levels.length > 0 && (
          <SectionWrapper
            id="tests"
            title="📋 เทสวัดผลระดับชั้น"
            subtitle={isPaid ? '⚡ สมาชิก Plus: เลือกได้ทุกระดับ' : '🌱 สมาชิกฟรี: ทำได้เฉพาะเทสที่แนะนำ'}
          >
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {test_levels.map(level => (
                <TestLevelCard key={level.grade} level={level} onStart={handleStartTest} />
              ))}
            </div>
          </SectionWrapper>
        )}

        {/* ── D. PERSONALIZED RECOMMENDATIONS ── */}
        {weak_skills && weak_skills.length > 0 && (
          <SectionWrapper
            id="recommendations"
            title="🧠 ระบบแนะนำสำหรับวันนี้"
            subtitle="จุดที่ควรฝึกเพิ่มเติม"
          >
            <div className="grid sm:grid-cols-2 gap-4">
              {weak_skills.map((ws, i) => (
                <div key={i} className="card border-0 shadow-md bg-gradient-to-br from-red-50 to-orange-50">
                  <div className="flex items-start gap-3">
                    <div className="text-3xl">⚠️</div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 text-sm">{ws.skill_name}</h3>
                      <p className="text-xs text-gray-600 mt-0.5 mb-2">{ws.reason}</p>
                      {ws.recommended_lesson_title && (
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                            📖 {ws.recommended_lesson_title}
                          </span>
                        </div>
                      )}
                      <button
                        onClick={() => {
                          if (ws.recommended_lesson_id) router.push(`/dashboard/lessons/${ws.recommended_lesson_id}`)
                        }}
                        className="text-xs font-bold text-primary-600 hover:text-primary-700 px-3 py-1.5 rounded-lg hover:bg-primary-50 transition-colors"
                      >
                        เริ่มฝึก →
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionWrapper>
        )}

        {/* ── E. QUESTS (tabbed) ── */}
        {(daily_quests?.length || weekly_quests?.length || monthly_quests?.length) && (
          <SectionWrapper title="📋 เควส">
            {/* Feedback banner */}
            {claimFeedback && (
              <div className="mb-4 text-sm text-center font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 animate-pulse">
                ⚡ {claimFeedback}
              </div>
            )}

            {/* Tab bar */}
            <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1">
              {(['daily', 'weekly', 'monthly'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => { setQuestTab(tab); setClaimFeedback(null) }}
                  className={`flex-1 text-sm font-bold py-2 rounded-lg transition-all ${
                    questTab === tab
                      ? 'bg-white shadow text-primary-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'daily' ? '🌞 รายวัน' : tab === 'weekly' ? '📆 รายสัปดาห์' : '🗓️ รายเดือน'}
                </button>
              ))}
            </div>

            {/* Daily tab */}
            {questTab === 'daily' && daily_quests && daily_quests.length > 0 && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {daily_quests.map(q => (
                  <QuestCard key={q.quest_id} quest={q} period="daily" onClaim={handleClaimQuest} />
                ))}
              </div>
            )}
            {questTab === 'daily' && (!daily_quests || daily_quests.length === 0) && (
              <p className="text-sm text-gray-400 text-center py-6">ไม่มีเควสรายวันวันนี้</p>
            )}

            {/* Weekly tab */}
            {questTab === 'weekly' && weekly_quests && weekly_quests.length > 0 && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {weekly_quests.map(q => (
                  <QuestCard key={q.quest_id} quest={q} period="weekly" onClaim={handleClaimQuest} />
                ))}
              </div>
            )}
            {questTab === 'weekly' && (!weekly_quests || weekly_quests.length === 0) && (
              <p className="text-sm text-gray-400 text-center py-6">ไม่มีเควสรายสัปดาห์</p>
            )}

            {/* Monthly tab */}
            {questTab === 'monthly' && monthly_quests && monthly_quests.length > 0 && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {monthly_quests.map(q => (
                  <QuestCard key={q.quest_id} quest={q} period="monthly" onClaim={handleClaimQuest} />
                ))}
              </div>
            )}
            {questTab === 'monthly' && (!monthly_quests || monthly_quests.length === 0) && (
              <p className="text-sm text-gray-400 text-center py-6">ไม่มีเควสรายเดือน</p>
            )}
          </SectionWrapper>
        )}

        {/* ── F. LESSONS with grade tabs ── */}
        {lessons && lessons.length > 0 && (
          <SectionWrapper
            title="📚 บทเรียน"
            subtitle={isPaid ? '⚡ เข้าถึงบทเรียนทั้งหมดได้' : '🌱 สมาชิกฟรี: เปิดบทแรกได้เท่านั้น'}
          >
            {/* Grade Tabs */}
            <div className="flex gap-1 mb-5 overflow-x-auto pb-1">
              {[1, 2, 3, 4, 5, 6].map(g => (
                <button
                  key={g}
                  onClick={() => setSelectedLessonGrade(g)}
                  className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                    selectedLessonGrade === g
                      ? 'bg-primary-500 text-white shadow-md'
                      : 'bg-gray-100 text-gray-600 hover:bg-primary-50'
                  }`}
                >
                  ป.{g}
                </button>
              ))}
            </div>

            {/* Lessons for selected grade */}
            {(() => {
              const filtered = lessons.filter(l => l.grade_level === selectedLessonGrade)
              if (filtered.length === 0) {
                return (
                  <div className="text-center py-10 text-gray-400">
                    <div className="text-3xl mb-2">📚</div>
                    <p className="text-sm">ยังไม่มีบทเรียนสำหรับชั้นนี้</p>
                  </div>
                )
              }
              return (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filtered.map(l => (
                    <LessonCard
                      key={l.lesson_id}
                      lesson={l}
                      child={child}
                      onLearn={handleLearnLesson}
                      onTest={handleTestLesson}
                      testLoading={lessonTestLoading === (l.lesson_id || (l as unknown as Record<string, unknown>).id as string)}
                    />
                  ))}
                </div>
              )
            })()}
          </SectionWrapper>
        )}

        {/* Empty state if no dashboard data */}
        {!dashboard && (
          <div className="text-center py-16 text-gray-500">
            <div className="text-5xl mb-4">📊</div>
            <p>ไม่พบข้อมูล dashboard — กรุณาตรวจสอบว่า backend ทำงานอยู่</p>
          </div>
        )}

      </main>

      {/* ── TEST MODAL ── */}
      {testSessionId && (
        <TestModal
          sessionId={testSessionId}
          onClose={() => setTestSessionId(null)}
        />
      )}
    </div>
  )
}

// ─── Mock Dashboard Builder (used when /me/dashboard is unavailable) ──────────

function buildMockDashboard(child: ChildOut): DashboardData {
  const grade = child.grade_level ?? 3 // fallback to Grade 3 if undefined
  const isPaid = child.membership !== 'free'

  // Foundation test: recommend previous grade for free users
  const foundationGrade = Math.max(1, grade - 1)

  const test_levels: TestLevel[] = [1, 2, 3, 4, 5, 6].map(g => {
    let status: 'locked' | 'unlocked' | 'completed' = 'locked'
    let lock_reason: string | undefined
    if (isPaid) {
      status = 'unlocked'
    } else if (g === foundationGrade) {
      status = 'unlocked'
    } else {
      status = 'locked'
      lock_reason = 'ต้องสมัคร Plus เพื่อทำเทสระดับอื่น'
    }
    return {
      grade: g,
      title: `คณิตศาสตร์ ${GRADE_LABEL[g]}`,
      status,
      lock_reason,
      questions_count: 10,
      estimated_minutes: 5,
    }
  })

  // Mock lessons for current grade + review lessons from previous grade
  const mockLessons: Lesson[] = buildMockLessons(child, grade, isPaid)

  return {
    child: {
      id: child.id,
      first_name: child.first_name,
      last_name: child.last_name,
      nickname: child.nickname,
      grade_level: grade,
      school_name: child.school_name,
      province: child.province,
      avatar_gender: child.avatar_gender,
      avatar_config: child.avatar_config,
      total_xp: child.total_xp,
      current_level: child.current_level,
      streak_count: child.streak_count,
      total_score: child.total_score,
      days_active: child.days_active,
      rank_title: child.rank_title,
      coins: child.coins,
      membership: child.membership,
      free_test_attempts_remaining: isPaid ? 999 : 5,
      free_test_attempts_limit: 5,
    },
    foundation_test: {
      recommended_grade: foundationGrade,
      recommended_grade_level: foundationGrade,
      is_locked: false,
      reason: `ทบทวนพื้นฐาน${GRADE_LABEL[foundationGrade]}ก่อนเริ่ม${GRADE_LABEL[grade]}`,
      is_placement_done: false,
    },
    test_levels,
    weak_skills: [],
    daily_quests: [],
    weekly_quests: [],
    monthly_quests: [],
    lessons: mockLessons,
  }
}

function buildMockLessons(child: ChildOut, grade: number, isPaid: boolean): Lesson[] {
  const lessonsForGrade: Record<number, Lesson[]> = {
    1: [
      { lesson_id: 'L1-1', title_th: 'การนับเลข 1-100', grade_level: 1, topic_code: 'การนับ', estimated_minutes: 10, status: 'completed', lock_reason: undefined, is_free_preview: false },
      { lesson_id: 'L1-2', title_th: 'การบวกเลข 1-10', grade_level: 1, topic_code: 'การบวก', estimated_minutes: 15, status: 'unlocked', lock_reason: undefined, is_free_preview: true },
      { lesson_id: 'L1-3', title_th: 'การลบเลข 1-10', grade_level: 1, topic_code: 'การลบ', estimated_minutes: 15, status: 'locked', lock_reason: 'สมาชิกฟรีเรียนได้ 1 บทแรก อัปเกรดเพื่อเรียนต่อ', is_free_preview: false },
    ],
    2: [
      { lesson_id: 'L2-1', title_th: 'การบวกเลขหลักสิบ', grade_level: 2, topic_code: 'การบวก', estimated_minutes: 15, status: 'completed', lock_reason: undefined, is_free_preview: false },
      { lesson_id: 'L2-2', title_th: 'การลบเลขหลักสิบ', grade_level: 2, topic_code: 'การลบ', estimated_minutes: 15, status: 'unlocked', lock_reason: undefined, is_free_preview: true },
      { lesson_id: 'L2-3', title_th: 'การคูณเบื้องต้น', grade_level: 2, topic_code: 'การคูณ', estimated_minutes: 20, status: 'locked', lock_reason: 'สมาชิกฟรีเรียนได้ 1 บทแรก อัปเกรดเพื่อเรียนต่อ', is_free_preview: false },
    ],
    3: [
      { lesson_id: 'L3-1', title_th: 'การบวกเลขหลายหลัก', grade_level: 3, topic_code: 'การบวก', estimated_minutes: 15, status: 'unlocked', lock_reason: undefined, is_free_preview: false },
      { lesson_id: 'L3-2', title_th: 'การลบเลขหลายหลัก', grade_level: 3, topic_code: 'การลบ', estimated_minutes: 15, status: 'unlocked', lock_reason: undefined, is_free_preview: false },
      { lesson_id: 'L3-3', title_th: 'การคูณเลข 2 หลัก', grade_level: 3, topic_code: 'การคูณ', estimated_minutes: 20, status: 'locked', lock_reason: 'สมาชิกฟรีเรียนได้ 1 บทแรก อัปเกรดเพื่อเรียนต่อ', is_free_preview: false },
    ],
    4: [
      { lesson_id: 'L4-1', title_th: 'การหารเบื้องต้น', grade_level: 4, topic_code: 'การหาร', estimated_minutes: 20, status: 'unlocked', lock_reason: undefined, is_free_preview: false },
      { lesson_id: 'L4-2', title_th: 'เศษส่วนเบื้องต้น', grade_level: 4, topic_code: 'เศษส่วน', estimated_minutes: 20, status: 'locked', lock_reason: 'สมาชิกฟรีเรียนได้ 1 บทแรก อัปเกรดเพื่อเรียนต่อ', is_free_preview: false },
    ],
    5: [
      { lesson_id: 'L5-1', title_th: 'การคูณเลขหลายหลัก', grade_level: 5, topic_code: 'การคูณ', estimated_minutes: 20, status: 'unlocked', lock_reason: undefined, is_free_preview: false },
      { lesson_id: 'L5-2', title_th: 'ทศนิยมเบื้องต้น', grade_level: 5, topic_code: 'ทศนิยม', estimated_minutes: 20, status: 'locked', lock_reason: 'สมาชิกฟรีเรียนได้ 1 บทแรก อัปเกรดเพื่อเรียนต่อ', is_free_preview: false },
    ],
    6: [
      { lesson_id: 'L6-1', title_th: 'สมการเบื้องต้น', grade_level: 6, topic_code: 'สมการ', estimated_minutes: 20, status: 'unlocked', lock_reason: undefined, is_free_preview: false },
      { lesson_id: 'L6-2', title_th: 'อัตราส่วน', grade_level: 6, topic_code: 'อัตราส่วน', estimated_minutes: 20, status: 'locked', lock_reason: 'สมาชิกฟรีเรียนได้ 1 บทแรก อัปเกรดเพื่อเรียนต่อ', is_free_preview: false },
    ],
  }

  const gradeLessons = lessonsForGrade[grade] ?? lessonsForGrade[3]
  const reviewGrade = Math.max(1, grade - 1)
  const reviewLessons: Lesson[] = (lessonsForGrade[reviewGrade] ?? []).map(l => ({
    ...l,
    lesson_id: `review-${l.lesson_id}`,
    title_th: `📚 ทบทวน: ${l.title_th}`,
    status: 'locked',
    lock_reason: isPaid ? undefined : 'ต้องสมัครเพื่อทบทวน',
  })) as Lesson[]

  // Apply free user rules: only first lesson unlocked
  const applyFreeRules = (lessons: Lesson[]): Lesson[] => {
    if (isPaid) return lessons
    return lessons.map((l, i) => {
      if (i === 0) return l // first lesson always unlocked
      return { ...l, status: 'locked', lock_reason: l.lock_reason ?? 'สมาชิกฟรีเรียนได้ 1 บทแรก อัปเกรดเพื่อเรียนต่อ' }
    })
  }

  return [
    ...applyFreeRules(gradeLessons),
    ...reviewLessons,
  ]
}
