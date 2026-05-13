'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/auth'
import { learningApi, type Question } from '@/lib/api/learning'

export default function QuizPage() {
  const params = useParams()
  const childId = params.childId as string
  const router = useRouter()
  const { checkAuth } = useAuthStore()
  const [phase, setPhase] = useState<'intro' | 'quiz' | 'done' | 'result'>('intro')
  const [questions, setQuestions] = useState<Question[]>([])
  const [sessionId, setSessionId] = useState('')
  const [current, setCurrent] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [answerResult, setAnswerResult] = useState<{ is_correct: boolean; correct_answer: string } | null>(null)
  const [correctCount, setCorrectCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const startTime = useRef(Date.now())

  useEffect(() => {
    checkAuth().then(() => {
      if (!localStorage.getItem('access_token')) router.push('/login')
    })
  }, [])

  const startQuiz = async () => {
    setLoading(true)
    try {
      const data = await learningApi.startPlacement(childId)
      setQuestions(data.questions)
      setSessionId(data.session_id)
      setPhase('quiz')
      startTime.current = Date.now()
    } catch {
      alert('เริ่มควิซไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  const handleAnswer = async () => {
    if (!selected) return
    const elapsed = Date.now() - startTime.current
    try {
      const result = await learningApi.answerQuestion(sessionId, {
        question_id: questions[current].id,
        selected_answer: selected,
        response_time_ms: elapsed,
        hint_used: false,
      })
      setAnswerResult(result)
      if (result.is_correct) setCorrectCount((c) => c + 1)
    } catch {
      alert('ตอบไม่สำเร็จ')
    }
  }

  const handleNext = () => {
    setAnswerResult(null)
    setSelected(null)
    if (current + 1 >= questions.length) {
      finishQuiz()
    } else {
      setCurrent((c) => c + 1)
      startTime.current = Date.now()
    }
  }

  const finishQuiz = async () => {
    try {
      await learningApi.completeSession(sessionId)
    } catch { /* ignore */ }
    setPhase('result')
  }

  const q = questions[current]

  if (phase === 'intro') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-secondary-50 to-background flex items-center justify-center px-4">
        <div className="card max-w-lg text-center shadow-xl">
          <div className="text-6xl mb-4">🎮</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">เล่นควิซ</h2>
          <p className="text-gray-500 mb-6">มาลองทำควิซคณิตศาสตร์กันเถอะ! ทำให้ดีที่สุดนะ 💪</p>
          <div className="flex gap-3">
            <Link href={`/children/${childId}`} className="btn-secondary flex-1">กลับ</Link>
            <button onClick={startQuiz} disabled={loading} className="btn-primary flex-1">
              {loading ? 'กำลังเริ่ม...' : 'เริ่มเล่น!'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'result') {
    const xpEarned = correctCount * 5
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-background flex items-center justify-center px-4">
        <div className="card max-w-lg text-center shadow-xl">
          <div className="text-6xl mb-4">🏆</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">ควิซเสร็จสิ้น!</h2>
          <div className="my-6">
            <div className="text-5xl font-extrabold text-primary-600 mb-1">{correctCount}/{questions.length}</div>
            <p className="text-gray-500">ข้อที่ถูกต้อง</p>
          </div>
          <div className="bg-primary-50 rounded-xl p-4 mb-6">
            <p className="text-primary-700 font-semibold">+{xpEarned} XP</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => { setPhase('intro'); setCorrectCount(0); setCurrent(0) }} className="btn-secondary flex-1">เล่นอีกครั้ง</button>
            <Link href={`/children/${childId}`} className="btn-primary flex-1">กลับหน้าหลัก</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-white border-b border-primary-100 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href={`/children/${childId}`} className="text-2xl hover:opacity-70">←</Link>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">ข้อ {current + 1} / {questions.length}</span>
            <span className="badge badge-xp">+{correctCount * 5} XP</span>
          </div>
          <div className="w-8" />
        </div>
      </header>

      <div className="h-1.5 bg-gray-200">
        <div className="h-full bg-secondary-500 transition-all duration-300" style={{ width: `${((current + 1) / questions.length) * 100}%` }} />
      </div>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="card shadow-lg">
          <p className="text-gray-800 font-medium text-lg mb-6 leading-relaxed">{q?.question_text}</p>

          {q?.choices && q.choices.length > 0 ? (
            <div className="space-y-3">
              {q.choices.map((choice, i) => (
                <button
                  key={i}
                  onClick={() => !answerResult && setSelected(choice)}
                  disabled={!!answerResult}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                    answerResult
                      ? choice === q.correct_answer
                        ? 'border-green-400 bg-green-50 text-green-800'
                        : choice === selected
                        ? 'border-red-400 bg-red-50 text-red-800'
                        : 'border-gray-200 bg-gray-50 text-gray-400'
                      : selected === choice
                      ? 'border-secondary-400 bg-secondary-50 text-secondary-800'
                      : 'border-gray-200 hover:border-secondary-300 hover:bg-secondary-50 text-gray-700'
                  }`}
                >
                  <span className="font-medium">{String.fromCharCode(65 + i)}. </span>{choice}
                </button>
              ))}
            </div>
          ) : (
            <input
              type="text"
              className="input-field"
              placeholder="พิมพ์คำตอบ..."
              value={selected || ''}
              onChange={(e) => setSelected(e.target.value)}
              disabled={!!answerResult}
            />
          )}

          {answerResult && (
            <div className={`mt-4 p-4 rounded-xl border-2 ${
              answerResult.is_correct
                ? 'border-green-300 bg-green-50 text-green-800'
                : 'border-red-300 bg-red-50 text-red-800'
            }`}>
              <p className="font-bold mb-1">{answerResult.is_correct ? '✅ ถูกต้อง!' : `❌ คำตอบที่ถูกต้อง: ${answerResult.correct_answer}`}</p>
              <p className="text-sm opacity-80">{q.explanation}</p>
            </div>
          )}

          <div className="mt-6 flex justify-end gap-3">
            {!answerResult ? (
              <button onClick={handleAnswer} disabled={!selected} className="btn-primary">ส่งคำตอบ</button>
            ) : (
              <button onClick={handleNext} className="btn-primary">
                {current + 1 >= questions.length ? 'ดูผลลัพธ์ →' : 'ข้อถัดไป →'}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
