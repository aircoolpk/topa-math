'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/auth'
import { meApi, type ShareResponse } from '@/lib/api/me'
import { ShareModal } from '@/components/share/ShareModal'
import { MascotAvatar } from '@/components/topa/TopaUI'
import { defaultMascots } from '@/lib/topa-content'

// ─── Types ───────────────────────────────────────────────────────────────────

interface QuizVisualModel {
  type?: string
  values?: number[]
  total?: number
  question_th?: string
  expression?: string
  rows?: number
  cols?: number
  symbol?: string
  numerator?: number
  denominator?: number
  shapes?: Array<{ name_th?: string; emoji?: string; sides?: number }>
  [key: string]: unknown
}

interface Question {
  id: string
  lesson_id?: string
  question_text_th?: string
  question_text?: string
  choices: string[]
  hint?: string
  topic_code?: string
  skill_code?: string
  question_type?: string
  visual_model?: QuizVisualModel
  visual_blocks?: Array<Record<string, unknown>>
}

interface TestResult {
  score_percent: number
  correct_count: number
  total_questions: number
  total_time_ms: number
  weak_skills: { skill_name?: string; title_th?: string; reason?: string; reason_th?: string; mastery_score?: number }[]
  recommendations: (string | { title_th?: string; description_th?: string })[]
  xp_earned: number
  score_earned: number
  core_correct_count?: number
  core_total?: number
  challenge_correct_count?: number
  challenge_total?: number
  core_accuracy?: number
  challenge_accuracy?: number
}

type Phase = 'loading' | 'quiz' | 'feedback' | 'submitting' | 'result' | 'error'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(ms: number) {
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}

// ─── Visual Question Renderer ────────────────────────────────────────────────

function EmojiCounterVisual({ model }: { model: QuizVisualModel }) {
  const vals = model.values ?? [0, 0]
  const total = model.total ?? vals[0]
  const emoji = (model.symbol as string) || '🍎'
  const count = (n: number) => Array.from({ length: Math.min(n, 20) }, (_, i) => i)

  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <div className="text-4xl leading-none">
        {count(total).map((i) => <span key={i}>{emoji} </span>)}
        {total > 20 && <span className="text-sm text-gray-400">+{total - 20}</span>}
      </div>
      <p className="text-2xl font-extrabold text-primary-700">= {total}</p>
    </div>
  )
}

function TenFrameVisual({ model }: { model: QuizVisualModel }) {
  const vals = model.values ?? []
  const cells = Array.from({ length: 10 }, (_, i) => vals[i] ?? 0)
  const total = model.total ?? vals.reduce((a, b) => a + b, 0)

  return (
    <div className="py-4">
      <div className="grid grid-cols-5 gap-1.5 max-w-[200px] mx-auto">
        {cells.map((filled, i) => (
          <div
            key={i}
            className={`aspect-square rounded-lg flex items-center justify-center text-lg font-bold transition-all ${
              filled
                ? 'bg-primary-400 text-white shadow-sm'
                : 'bg-primary-100 text-primary-300'
            }`}
          >
            {filled ? '●' : ''}
          </div>
        ))}
      </div>
      <p className="text-center mt-2 text-xl font-extrabold text-primary-700">= {total}</p>
    </div>
  )
}

function ArrayGridVisual({ model }: { model: QuizVisualModel }) {
  const rows = model.rows ?? 3
  const cols = model.cols ?? 4
  const symbol = model.symbol || '■'

  return (
    <div className="py-4">
      <div className="flex flex-col items-center gap-1">
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="flex gap-1">
            {Array.from({ length: cols }, (_, c) => (
              <div
                key={c}
                className="w-8 h-8 bg-purple-400 rounded-lg flex items-center justify-center text-white text-base font-bold shadow-sm"
              >
                {symbol}
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="text-center text-sm font-bold text-purple-700 mt-2">
        {rows} แถว × {cols} = {rows * cols}
      </p>
    </div>
  )
}

function FractionStripVisual({ model }: { model: QuizVisualModel }) {
  const num = model.numerator ?? 1
  const den = model.denominator ?? 4

  return (
    <div className="py-4 flex flex-col items-center gap-2">
      <div className="flex">
        {Array.from({ length: den }, (_, i) => (
          <div
            key={i}
            className={`w-10 h-14 border-2 border-pink-400 flex items-center justify-center text-base font-bold ${
              i < num ? 'bg-pink-400 text-white' : 'bg-pink-50 text-pink-200'
            } ${i > 0 ? '-ml-px' : ''}`}
          >
            {i < num ? '■' : ''}
          </div>
        ))}
      </div>
      <p className="text-2xl font-extrabold text-pink-700">{num}/{den}</p>
    </div>
  )
}

function ShapeCardsVisual({ model }: { model: QuizVisualModel }) {
  const shapes = model.shapes ?? []

  return (
    <div className="py-4 grid grid-cols-3 gap-3 max-w-xs mx-auto">
      {shapes.map((s, i) => (
        <div key={i} className="bg-white rounded-xl p-3 text-center border-2 border-cyan-100 shadow-sm">
          <div className="text-3xl mb-1">{s.emoji || '🔷'}</div>
          <p className="text-xs font-bold text-cyan-700">{s.name_th || 'รูปร่าง'}</p>
          {s.sides && <p className="text-[10px] text-cyan-400">{s.sides} ด้าน</p>}
        </div>
      ))}
    </div>
  )
}

function NumberLineVisual({ model }: { model: QuizVisualModel }) {
  const vals = model.values ?? [20, 0]
  const start = vals[0]
  const end = vals[1] ?? 0
  const step = 1
  const nums: number[] = []
  for (let i = start; i >= end; i -= step) nums.push(i)

  return (
    <div className="py-4 overflow-x-auto">
      <div className="flex items-center gap-1 min-w-max px-2">
        {nums.slice(0, 21).map((num, i) => (
          <div key={i} className="flex flex-col items-center">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${
                num === start
                  ? 'bg-primary-500 text-white'
                  : num === end
                  ? 'bg-green-500 text-white'
                  : 'bg-white border-2 border-primary-200 text-primary-700'
              }`}
            >
              {num}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function BarModelVisual({ model }: { model: QuizVisualModel }) {
  const vals = model.values ?? []
  const labels = model.question_th ? [model.question_th] : []
  const colors = ['from-blue-400 to-blue-500', 'from-green-400 to-green-500', 'from-amber-400 to-amber-500']
  const maxVal = Math.max(...vals, 1)

  return (
    <div className="py-4 space-y-2 px-2">
      {vals.map((val, i) => {
        const pct = (val / maxVal) * 100
        return (
          <div key={i}>
            {labels[i] && (
              <div className="flex justify-between text-xs text-gray-500 mb-0.5">
                <span>{labels[i]}</span><span className="font-bold">{val}</span>
              </div>
            )}
            <div className="h-6 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${colors[i % colors.length]} rounded-full flex items-center justify-end pr-2`}
                style={{ width: `${Math.max(8, pct)}%` }}
              >
                {pct > 20 && <span className="text-white text-xs font-bold">{val}</span>}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function NumberBondVisual({ model }: { model: QuizVisualModel }) {
  const vals = model.values ?? [10, 6, 4]
  const whole = vals[0]
  const parts = vals.slice(1)

  return (
    <div className="py-4 flex flex-col items-center gap-3">
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center text-white text-2xl font-extrabold shadow-md">
        {whole}
      </div>
      <div className="flex items-center gap-3">
        {parts.map((part, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className="w-12 h-12 rounded-full bg-white border-2 border-amber-300 flex items-center justify-center text-amber-700 text-lg font-bold shadow-sm">
              {part}
            </div>
            <div className="w-0.5 h-3 bg-amber-300" />
          </div>
        ))}
      </div>
      <p className="text-sm text-amber-600 font-medium">
        {parts.join(' + ')} = {whole}
      </p>
    </div>
  )
}

function MeasurementVisual({ model }: { model: QuizVisualModel }) {
  const val = model.values?.[0] ?? model.total ?? 10
  const unit = (model.question_th as string) || (model.symbol as string) || 'cm'

  return (
    <div className="py-4">
      <div className="flex items-end gap-3 px-4">
        <div className="text-5xl font-extrabold text-orange-700">{val}</div>
        <div className="text-2xl text-orange-400 mb-1">{unit}</div>
      </div>
      <div className="flex items-end gap-0.5 mt-3 px-4">
        {Array.from({ length: Math.min(val, 30) }, (_, i) => (
          <div
            key={i}
            className={`w-2 ${i % 5 === 0 ? 'h-6 bg-orange-400' : 'h-3 bg-orange-200'} rounded-sm`}
          />
        ))}
      </div>
    </div>
  )
}

function NumberSentenceVisual({ model }: { model: QuizVisualModel }) {
  return (
    <div className="py-6 text-center">
      <p className="text-3xl font-extrabold text-slate-800 tracking-wide">
        {(model.expression || model.question_th || model.question_text || '') as string}
      </p>
    </div>
  )
}

/** Detect safe visual from topic/skill_code when no visual_model is provided */
function getSafeVisual(question: Question): QuizVisualModel | null {
  const topic = (question.topic_code || question.skill_code || '').toLowerCase()
  const type = question.question_type?.toLowerCase() || ''

  if (topic.includes('addition') || type === 'addition') {
    return { type: 'ten_frame', values: [5, 3], total: 8 }
  }
  if (topic.includes('subtraction') || type === 'subtraction') {
    return { type: 'number_line', values: [10, 3] }
  }
  if (topic.includes('multiplication') || type === 'multiplication') {
    return { type: 'array', rows: 3, cols: 4, symbol: '×' }
  }
  if (topic.includes('division') || type === 'division') {
    return { type: 'array', rows: 2, cols: 6, symbol: '÷' }
  }
  if (topic.includes('fraction') || type === 'fraction') {
    return { type: 'fraction', numerator: 3, denominator: 4 }
  }
  if (topic.includes('shape') || topic.includes('geometry')) {
    return {
      type: 'shapes',
      shapes: [
        { name_th: 'สามเหลี่ยม', emoji: '🔺', sides: 3 },
        { name_th: 'สี่เหลี่ยม', emoji: '🟦', sides: 4 },
        { name_th: 'วงกลม', emoji: '⭕', sides: 0 },
      ],
    }
  }
  return null
}

/** Render visual_model or fall back to safe visual */
function VisualQuestion({ question }: { question: Question }) {
  const model = question.visual_model
  const safeModel = !model ? getSafeVisual(question) : null
  const visual = model || safeModel
  if (!visual) return null

  const vType = (visual.type as string || '').toLowerCase()

  if (vType === 'emoji_counter' || vType === 'emojicounter') {
    return <EmojiCounterVisual model={visual} />
  }
  if (vType === 'ten_frame' || vType === 'tenframe') {
    return <TenFrameVisual model={visual} />
  }
  if (vType === 'array' || vType === 'array_model') {
    return <ArrayGridVisual model={visual} />
  }
  if (vType === 'fraction' || vType === 'fraction_visual') {
    return <FractionStripVisual model={visual} />
  }
  if (vType === 'shapes' || vType === 'shape_visual') {
    return <ShapeCardsVisual model={visual} />
  }
  if (vType === 'number_line' || vType === 'numberline') {
    return <NumberLineVisual model={visual} />
  }
  if (vType === 'bar_model' || vType === 'barmodel') {
    return <BarModelVisual model={visual} />
  }
  if (vType === 'number_bond' || vType === 'numberbond') {
    return <NumberBondVisual model={visual} />
  }
  if (vType === 'measurement' || vType === 'measurement_visual') {
    return <MeasurementVisual model={visual} />
  }
  if (vType === 'number_sentence') {
    return <NumberSentenceVisual model={visual} />
  }

  return null
}

// ─── Safe label helpers ───────────────────────────────────────────────────────

function renderWeakSkillLabel(ws: TestResult['weak_skills'][number]): string {
  if (!ws) return ''
  return ws.title_th || ws.skill_name || ''
}

function renderRecommendationLabel(rec: TestResult['recommendations'][number]): string {
  if (!rec) return ''
  if (typeof rec === 'string') return rec
  return rec.title_th || ''
}

// ─── 80/20 Diagnostic ─────────────────────────────────────────────────────────

interface DiagnosticBundle {
  core_correct?: number
  core_total?: number
  core_accuracy?: number
  challenge_correct?: number
  challenge_total?: number
  challenge_accuracy?: number
}

function getDiagnosticBundle(result: TestResult): DiagnosticBundle | null {
  const { core_total, challenge_total, core_accuracy, challenge_accuracy } = result
  if (core_total == null && challenge_total == null) return null
  return {
    core_correct: result.core_correct_count,
    core_total,
    core_accuracy,
    challenge_correct: result.challenge_correct_count,
    challenge_total,
    challenge_accuracy,
  }
}

function CoreMessage({ accuracy }: { accuracy: number | undefined }) {
  if (accuracy == null) return null
  if (accuracy >= 80) return <p className="text-sm text-green-700 font-semibold">🌟 พื้นฐานดีมาก เก่งมาก!</p>
  return <p className="text-sm text-amber-700">📖 ลองทบทวนพื้นฐานอีกนิด จะทำได้มั่นใจขึ้น</p>
}

function ChallengeMessage({ accuracy }: { accuracy: number | undefined }) {
  if (accuracy == null) return null
  if (accuracy >= 50) return <p className="text-sm text-blue-700 font-semibold">💪 เริ่มแก้โจทย์ประยุกต์ได้ดีแล้ว</p>
  return <p className="text-sm text-purple-700">🧩 โจทย์ประยุกต์ยังท้าทายอยู่ ลองฝึกคิดเป็นขั้นตอน</p>
}

// ─── Feedback helpers ─────────────────────────────────────────────────────────

const CORRECT_MESSAGES = ['เก่งมาก!', 'วิเศษมาก!', 'ถูกต้อง!', 'เยี่ยมเลย!', 'ดีมาก!']
const WRONG_MESSAGES = ['ลองดูวิธีคิดอีกนิดนะ', 'ใกล้เคียงแล้ว ลองคิดใหม่นะ', 'ไม่เป็นไร ลองคิดใหม่ได้เลย']
const QUESTION_COACH_LINES = [
  'ลองอ่านโจทย์ช้า ๆ ก่อนนะ',
  'มองหาตัวเลขสำคัญในโจทย์กัน!',
  'อย่าลืมตรวจคำตอบก่อนกดส่ง',
  'ข้อนี้ลองวาดภาพช่วยคิดดูสิ',
  'คิดทีละขั้นแล้วค่อยเลือกคำตอบนะ',
  'ถ้าไม่แน่ใจ ลองตัดตัวเลือกที่เป็นไปไม่ได้ก่อน',
]

function getCorrectMessage(): string {
  return CORRECT_MESSAGES[Math.floor(Math.random() * CORRECT_MESSAGES.length)]
}

function getWrongMessage(): string {
  return WRONG_MESSAGES[Math.floor(Math.random() * WRONG_MESSAGES.length)]
}

function stableCoach(questionId: string | undefined, index: number) {
  const seedText = questionId || String(index)
  const seed = seedText.split('').reduce((sum, char) => sum + char.charCodeAt(0), index)
  return {
    mascot: defaultMascots[seed % defaultMascots.length],
    line: QUESTION_COACH_LINES[seed % QUESTION_COACH_LINES.length],
    index: seed % defaultMascots.length,
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TestSessionPage() {
  const params = useParams()
  const sessionId = params.sessionId as string
  const router = useRouter()
  const { checkAuth } = useAuthStore()

  const [phase, setPhase] = useState<Phase>('loading')
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [responseTimes, setResponseTimes] = useState<Record<string, number>>({})
  const questionStartTime = useRef<number>(Date.now())
  const [answerResults, setAnswerResults] = useState<Record<string, { is_correct: boolean; correct_answer: string; explanation_th?: string }>>({})
  const [result, setResult] = useState<TestResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [hintUsed, setHintUsed] = useState<Record<string, boolean>>({})
  const [shareOpen, setShareOpen] = useState(false)
  const [shareData, setShareData] = useState<ShareResponse | null>(null)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)

  const startTime = useRef(Date.now())
  const timerInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  const [elapsed, setElapsed] = useState(0)

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    checkAuth().then(() => {
      if (!localStorage.getItem('access_token')) router.push('/login')
    })
  }, [])

  // ── Timer ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'quiz' || phase === 'feedback') {
      startTime.current = Date.now()
      timerInterval.current = setInterval(() => {
        setElapsed(Date.now() - startTime.current)
      }, 1000)
    }
    return () => {
      if (timerInterval.current) clearInterval(timerInterval.current)
    }
  }, [phase])

  // ── Fetch test questions ─────────────────────────────────────────────────────
  const loadQuestions = useCallback(async () => {
    try {
      const data = await meApi.getTestQuestions(sessionId)
      setQuestions(data.questions)
      setPhase('quiz')
    } catch {
      setErrorMsg('ไม่สามารถโหลดคำถามได้ กรุณาลองใหม่อีกครั้ง')
      setPhase('error')
    }
  }, [sessionId])

  useEffect(() => {
    if (sessionId) loadQuestions()
  }, [sessionId, loadQuestions])

  // ── Answer selection ──────────────────────────────────────────────────────────
  const handleSelect = (choice: string) => {
    if (phase !== 'quiz') return
    const qId = questions[currentIdx]?.id
    if (!qId) return
    setSelected(choice)
    setAnswers(prev => ({ ...prev, [qId]: choice }))
    setResponseTimes(prev => ({ ...prev, [qId]: Date.now() - questionStartTime.current }))
  }

  // ── Submit single answer ──────────────────────────────────────────────────────
  const handleSubmitAnswer = async () => {
    if (!selected || phase !== 'quiz') return
    const q = questions[currentIdx]
    const qId = q.id
    if (qId) {
      setResponseTimes(prev => ({ ...prev, [qId]: Date.now() - questionStartTime.current }))
    }
    try {
      const res = await meApi.submitTestAnswer(sessionId, {
        question_id: qId,
        selected_answer: selected,
        response_time_ms: Date.now() - questionStartTime.current,
        hint_used: hintUsed[qId] ?? false,
      })
      setAnswerResults(prev => ({ ...prev, [qId]: res }))
      setPhase('feedback')
    } catch {
      setErrorMsg('ไม่สามารถส่งคำตอบได้ กรุณาลองใหม่')
      setPhase('error')
    }
  }

  // ── Next question ─────────────────────────────────────────────────────────────
  const handleNext = () => {
    setSelected(null)
    questionStartTime.current = Date.now()
    if (currentIdx + 1 >= questions.length) {
      handleFinishTest()
    } else {
      setCurrentIdx(i => i + 1)
      setPhase('quiz')
    }
  }

  // ── Finish test ─────────────────────────────────────────────────────────────
  const handleFinishTest = async () => {
    if (timerInterval.current) clearInterval(timerInterval.current)
    setPhase('submitting')

    const answered = questions
      .map(question => ({
        question_id: question.id,
        selected_answer: answers[question.id] ?? '',
        response_time_ms: responseTimes[question.id] ?? 0,
      }))
      .filter(a => !!a.selected_answer)

    if (answered.length === 0) {
      setErrorMsg('กรุณาตอบคำถามอย่างน้อย 1 ข้อก่อนส่งผลสอบ')
      setPhase('error')
      return
    }

    try {
      const result = await meApi.finishTest(sessionId, { answers: answered, total_time_ms: elapsed })
      setResult(result)
      setPhase('result')
    } catch {
      setErrorMsg('ไม่สามารถส่งผลสอบได้ กรุณาลองใหม่')
      setPhase('error')
    }
  }

  const handleShareResult = async () => {
    setShareOpen(true)
    setShareLoading(true)
    setShareError(null)
    try {
      const response = await meApi.createTestResultShare(sessionId)
      setShareData(response)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ไม่สามารถสร้างลิงก์แชร์ผลสอบได้'
      setShareError(message)
    } finally {
      setShareLoading(false)
    }
  }

  const q = questions[currentIdx]
  const currentResult = q ? answerResults[q.id] : null
  const coach = stableCoach(q?.id, currentIdx)

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-5 animate-bounce">📝</div>
          <p className="text-gray-600 font-semibold text-lg">กำลังโหลดคำถาม...</p>
        </div>
      </div>
    )
  }

  // ── Submitting ──────────────────────────────────────────────────────────────
  if (phase === 'submitting') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-5 animate-pulse">⏳</div>
          <p className="text-gray-600 font-semibold text-lg">กำลังส่งคำตอบ...</p>
        </div>
      </div>
    )
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="card max-w-md text-center py-12">
          <div className="text-5xl mb-4">😢</div>
          <h2 className="text-xl font-extrabold text-gray-900 mb-2">เกิดข้อผิดพลาด</h2>
          <p className="text-gray-500 mb-6">{errorMsg}</p>
          <div className="flex gap-3">
            <Link href="/dashboard" className="btn-secondary flex-1 text-center py-3">กลับแดชบอร์ด</Link>
            <button onClick={() => window.location.reload()} className="btn-primary flex-1 py-3">ลองใหม่</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Result ──────────────────────────────────────────────────────────────────
  if (phase === 'result' && result) {
    const isPass = result.score_percent >= 70
    const diag = getDiagnosticBundle(result)

    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-50 to-background">
        <ShareModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          share={shareData}
          loading={shareLoading}
          error={shareError}
          title="TOPA Math"
          text="ลองฝึกเลขสนุก ๆ กับ TOPA Math แล้วมาเก็บคะแนนไปด้วยกัน"
        />
        <header className="bg-white border-b border-primary-100 shadow-sm">
          <div className="max-w-2xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <Link href="/dashboard" className="text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1">
                ← กลับแดชบอร์ด
              </Link>
              <span className="text-sm font-bold text-primary-600">ผลสอบ</span>
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-8">

          {/* Score hero card */}
          <div className="card shadow-xl text-center mb-6 overflow-hidden">
            <div className="bg-gradient-to-b from-white to-green-50 pt-8 pb-6">
              <div className="text-7xl mb-3">{isPass ? '🏆' : '📚'}</div>
              <h2 className="text-2xl font-extrabold text-gray-900 mb-1">
                {isPass ? 'ทำได้ดีมาก!' : 'อย่าท้อ! ฝึกต่อได้เลย'}
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                {result.total_questions} ข้อ · {formatTime(result.total_time_ms)}
              </p>

              {/* Score ring */}
              <div className="relative w-40 h-40 mx-auto mb-6">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r="45" fill="none"
                    stroke={isPass ? '#22c55e' : '#f59e0b'}
                    strokeWidth="8"
                    strokeDasharray={`${result.score_percent * 2.83} 283`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-extrabold text-gray-900">{result.score_percent}%</span>
                  <span className="text-xs text-gray-400">คะแนน</span>
                </div>
              </div>

              {/* Score stats */}
              <div className="grid grid-cols-3 gap-3 mb-5 max-w-xs mx-auto">
                <div className="bg-green-50 rounded-xl p-3">
                  <div className="text-2xl font-extrabold text-green-600">{result.correct_count}</div>
                  <div className="text-xs text-green-600">ถูก</div>
                </div>
                <div className="bg-red-50 rounded-xl p-3">
                  <div className="text-2xl font-extrabold text-red-600">{result.total_questions - result.correct_count}</div>
                  <div className="text-xs text-red-600">ผิด</div>
                </div>
                <div className="bg-amber-50 rounded-xl p-3">
                  <div className="text-2xl font-extrabold text-amber-600">{result.xp_earned}</div>
                  <div className="text-xs text-amber-600">XP ได้</div>
                </div>
              </div>

              {/* Score earned */}
              <div className="bg-primary-50 rounded-xl p-3 max-w-xs mx-auto">
                <p className="text-primary-700 font-bold">+{result.score_earned} คะแนน</p>
              </div>
            </div>

            {/* 80/20 Diagnostic */}
            {diag && (
              <div className="border-t border-gray-100 p-5">
                <h3 className="font-extrabold text-gray-800 text-base mb-4 text-center">
                  📋 สรุปการทำแบบฝึก
                </h3>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-green-50 rounded-xl p-3 text-center">
                    <div className="text-xs text-green-600 font-bold mb-1">🌱 โจทย์พื้นฐาน</div>
                    <div className="text-xl font-extrabold text-green-700">
                      {diag.core_correct ?? '?'}/{diag.core_total ?? '?'}
                    </div>
                    {diag.core_accuracy != null && (
                      <div className="text-xs text-green-500 mt-0.5">{diag.core_accuracy}% ถูกต้อง</div>
                    )}
                  </div>
                  <div className="bg-blue-50 rounded-xl p-3 text-center">
                    <div className="text-xs text-blue-600 font-bold mb-1">⭐ โจทย์ประยุกต์</div>
                    <div className="text-xl font-extrabold text-blue-700">
                      {diag.challenge_correct ?? '?'}/{diag.challenge_total ?? '?'}
                    </div>
                    {diag.challenge_accuracy != null && (
                      <div className="text-xs text-blue-500 mt-0.5">{diag.challenge_accuracy}% ถูกต้อง</div>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <CoreMessage accuracy={diag.core_accuracy} />
                  <ChallengeMessage accuracy={diag.challenge_accuracy} />
                </div>
              </div>
            )}

            {/* Weak skills */}
            {result.weak_skills && result.weak_skills.length > 0 && (
              <div className="border-t border-gray-100 px-5 py-4 text-left">
                <h3 className="font-bold text-gray-800 text-sm mb-3">⚠️ จุดที่ควรฝึกเพิ่ม</h3>
                <div className="space-y-2">
                  {result.weak_skills.map((ws, i) => {
                    const label = renderWeakSkillLabel(ws)
                    if (!label) return null
                    return (
                      <div key={i} className="bg-red-50 border border-red-100 rounded-xl p-3">
                        <p className="font-semibold text-sm text-red-700">🔴 {label}</p>
                        {ws.reason_th && <p className="text-xs text-red-400 mt-0.5">เหตุผล: {ws.reason_th}</p>}
                        {ws.mastery_score !== undefined && (
                          <p className="text-xs text-red-400 mt-0.5">ความชำนาญ: {ws.mastery_score}%</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {result.recommendations && result.recommendations.length > 0 && (
              <div className="border-t border-gray-100 px-5 py-4 text-left">
                <h3 className="font-bold text-gray-800 text-sm mb-3">💡 แนะนำ</h3>
                <ul className="space-y-2">
                  {result.recommendations.map((rec, i) => {
                    const label = renderRecommendationLabel(rec)
                    if (!label) return null
                    const recObj = typeof rec === 'object' ? rec : {}
                    return (
                      <li key={i} className="text-sm text-gray-600 flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl p-3">
                        <span>💡</span>
                        <div>
                          <span>{label}</span>
                          {(recObj as { description_th?: string }).description_th && (
                            <p className="text-xs text-blue-600 mt-0.5">{(recObj as { description_th: string }).description_th}</p>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            <div className="px-5 pb-5 pt-2 space-y-3">
              <button
                onClick={handleShareResult}
                className="w-full rounded-xl border border-primary-200 bg-white py-3.5 text-base font-extrabold text-primary-700 hover:bg-primary-50"
              >
                แชร์ผลสอบ
              </button>
              <button
                onClick={() => { router.refresh(); router.push('/dashboard') }}
                className="btn-primary w-full py-3.5 text-base"
              >
                กลับแดชบอร์ด
              </button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // ── Quiz / Feedback ─────────────────────────────────────────────────────────
  const isFeedback = phase === 'feedback'
  const progressPct = ((currentIdx + (isFeedback ? 1 : 0)) / questions.length) * 100

  return (
    <div className="min-h-screen bg-background">

      {/* Header */}
      <header className="bg-white border-b border-primary-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-xl leading-none font-light">×</Link>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              {currentIdx + 1} / {questions.length}
            </span>
            <span className="text-sm font-bold text-primary-600 bg-primary-50 px-3 py-1 rounded-full">
              ⏱️ {formatTime(elapsed)}
            </span>
          </div>
          <div className="w-5" />
        </div>
      </header>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-100">
        <div
          className="h-full bg-gradient-to-r from-primary-400 to-accent-400 transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <main className="max-w-3xl mx-auto px-4 py-6">

        {/* Question card */}
        <div className="card shadow-lg mb-4 overflow-hidden">

          {/* Question header */}
          <div className="bg-gradient-to-r from-primary-50 to-accent-50 px-6 py-4 flex items-center gap-3 border-b border-primary-100">
            <div className="w-10 h-10 rounded-full bg-primary-500 text-white flex items-center justify-center text-lg font-extrabold flex-shrink-0 shadow-sm">
              {currentIdx + 1}
            </div>
            <div className="flex-1">
              <p className="text-xs text-primary-500 font-semibold">ข้อที่ {currentIdx + 1} จาก {questions.length}</p>
              {q?.topic_code && (
                <p className="text-[11px] text-primary-400">{q.topic_code}</p>
              )}
            </div>
            <div className="text-3xl">
              {q?.question_type === 'core' ? '🌱' : q?.question_type === 'challenge' ? '⭐' : '📝'}
            </div>
          </div>

          {/* Visual */}
          {q && !isFeedback && <VisualQuestion question={q} />}

          {!isFeedback && (
            <div className="mx-6 mt-5 rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-50 to-amber-50 p-4">
              <div className="flex items-center gap-3">
                <MascotAvatar mascot={coach.mascot} index={coach.index} size="sm" />
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-sky-500">{coach.mascot.name} question coach</p>
                  <p className="text-sm font-bold text-slate-700">{coach.line}</p>
                </div>
              </div>
            </div>
          )}

          {/* Question text */}
          <div className="px-6 py-5">
            <p className="text-gray-900 font-bold text-lg leading-relaxed">
              {q?.question_text_th || q?.question_text || 'คำถาม'}
            </p>

            {/* Hint button */}
            {q?.hint && !isFeedback && (
              <button
                onClick={() => setHintUsed(prev => ({ ...prev, [q.id]: true }))}
                className="mt-3 flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
              >
                💡 {hintUsed[q.id] ? q.hint : 'แตะเพื่อดูคำใบ้'}
              </button>
            )}

            {/* Dev-only debug panel */}
            {process.env.NODE_ENV === 'development' && (
              <details className="mt-4 border border-dashed border-gray-300 rounded-lg p-2">
                <summary className="text-[10px] text-gray-400 cursor-pointer select-none font-mono">
                  🔧 dev debug
                </summary>
                <div className="mt-2 space-y-1">
                  <p className="text-[10px] text-gray-400 font-mono">
                    <span className="text-gray-500">id:</span> {q?.id}
                  </p>
                  {q?.lesson_id && (
                    <p className="text-[10px] text-gray-400 font-mono">
                      <span className="text-gray-500">lesson:</span> {q.lesson_id}
                    </p>
                  )}
                  {q?.topic_code && (
                    <p className="text-[10px] text-gray-400 font-mono">
                      <span className="text-gray-500">topic:</span> {q.topic_code}
                    </p>
                  )}
                  {q?.skill_code && (
                    <p className="text-[10px] text-gray-400 font-mono">
                      <span className="text-gray-500">skill:</span> {q.skill_code}
                    </p>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>

        {/* Choices */}
        <div className="space-y-2.5 mb-4">
          {q?.choices.map((choice, ci) => {
            const isSelected = selected === choice
            const isCorrect = currentResult?.correct_answer === choice
            const showResult = isFeedback

            let bgClass = 'bg-white hover:bg-primary-50 border-2 border-gray-200 hover:border-primary-200 text-gray-700'
            if (showResult) {
              if (isCorrect) bgClass = 'bg-green-50 border-2 border-green-400 text-green-800'
              else if (isSelected) bgClass = 'bg-red-50 border-2 border-red-400 text-red-800'
              else bgClass = 'bg-gray-50 border-2 border-gray-200 text-gray-400 opacity-70'
            } else if (isSelected) {
              bgClass = 'bg-primary-50 border-2 border-primary-400 text-primary-800'
            }

            return (
              <button
                key={ci}
                onClick={() => !showResult && handleSelect(choice)}
                disabled={showResult}
                className={`w-full text-left px-5 py-4 rounded-xl transition-all duration-200 text-base font-medium shadow-sm ${bgClass}`}
              >
                <span className="font-extrabold mr-3 text-lg">{String.fromCharCode(65 + ci)}.</span>
                {choice}
              </button>
            )
          })}
        </div>

        {/* Feedback message */}
        {isFeedback && currentResult && (
          <div className={`mb-4 p-4 rounded-2xl border-2 ${
            currentResult.is_correct
              ? 'bg-green-50 border-green-300'
              : 'bg-red-50 border-red-300'
          }`}>
            <div className="flex items-start gap-3">
              <MascotAvatar mascot={coach.mascot} index={coach.index} size="sm" />
              <div className="flex-1">
                <p className="font-extrabold text-lg">
                  {currentResult.is_correct ? getCorrectMessage() : getWrongMessage()}
                </p>
                {!currentResult.is_correct && (
                  <>
                    <p className="text-sm text-red-600 mt-1">
                      ❌ คำตอบที่เลือก: <span className="font-bold">{selected}</span>
                    </p>
                    <p className="text-sm text-green-700 mt-0.5">
                      ✅ คำตอบที่ถูกต้อง: <span className="font-bold">{currentResult.correct_answer}</span>
                    </p>
                  </>
                )}
                {currentResult.explanation_th && (
                  <p className="text-sm text-gray-600 mt-2 italic">
                    💡 {currentResult.explanation_th}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        {!isFeedback ? (
          <button
            onClick={handleSubmitAnswer}
            disabled={!selected}
            className="w-full bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold py-4 rounded-xl shadow-md hover:shadow-lg transition-all text-base"
          >
            {selected ? '✅ ส่งคำตอบ' : 'เลือกคำตอบก่อน'}
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="w-full bg-gradient-to-r from-accent-400 to-accent-500 hover:from-accent-500 hover:to-accent-600 text-white font-extrabold py-4 rounded-xl shadow-md hover:shadow-lg transition-all text-base"
          >
            {currentIdx + 1 >= questions.length ? '🏆 ดูผลสอบ' : 'ข้อถัดไป →'}
          </button>
        )}
      </main>
    </div>
  )
}
