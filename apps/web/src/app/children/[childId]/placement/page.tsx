'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/auth'
import { learningApi, type Question } from '@/lib/api/learning'

export default function PlacementPage() {
  const params = useParams()
  const childId = params.childId as string
  const router = useRouter()
  const { checkAuth } = useAuthStore()
  const [phase, setPhase] = useState<'intro' | 'quiz' | 'done'>('intro')
  const [questions, setQuestions] = useState<Question[]>([])
  const [sessionId, setSessionId] = useState('')
  const [current, setCurrent] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [answerResult, setAnswerResult] = useState<{ is_correct: boolean; correct_answer: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const startTime = useRef(Date.now())

  useEffect(() => {
    checkAuth().then((authenticatedUser) => {
      if (!authenticatedUser) router.push('/login')
    })
  }, [])

  const startTest = async () => {
    setLoading(true)
    try {
      const data = await learningApi.startPlacement(childId)
      setQuestions(data.questions)
      setSessionId(data.session_id)
      setPhase('quiz')
      startTime.current = Date.now()
    } catch {
      alert('เริ่มการทดสอบไม่สำเร็จ')
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
    } catch {
      alert('ตอบไม่สำเร็จ')
    }
  }

  const handleNext = () => {
    setAnswerResult(null)
    setSelected(null)
    if (current + 1 >= questions.length) {
      finishTest()
    } else {
      setCurrent((c) => c + 1)
      startTime.current = Date.now()
    }
  }

  const finishTest = async () => {
    try {
      await learningApi.completeSession(sessionId)
    } catch { /* ignore */ }
    setPhase('done')
  }

  const q = questions[current]

  if (phase === 'intro') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-50 to-background flex items-center justify-center px-4">
        <div className="card max-w-lg text-center shadow-xl">
          <div className="text-6xl mb-4">📝</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">ทดสอบวัดระดับ</h2>
          <p className="text-gray-500 mb-6">การทดสอบนี้จะช่วยให้ระบบรู้ว่าบุตรหลานของคุณเก่งเรื่องอะไร และควรเริ่มเรียนจากจุดไหน</p>
          <div className="bg-primary-50 rounded-xl p-4 mb-6 text-left">
            <p className="text-sm font-medium text-primary-800 mb-2">📌 ข้อปฏิบัติ:</p>
            <ul className="text-sm text-primary-700 space-y-1">
              <li>• ทำทุกข้อให้ดีที่สุด</li>
              <li>• ไม่ต้องรีบ มีเวลเพียงพอ</li>
              <li>• ถ้าทำผิด ไม่เป็นไร พยายามข้อต่อไป</li>
            </ul>
          </div>
          <div className="flex gap-3">
            <Link href={`/children/${childId}`} className="btn-secondary flex-1">กลับ</Link>
            <button onClick={startTest} disabled={loading} className="btn-primary flex-1">
              {loading ? 'กำลังเริ่ม...' : 'เริ่มทำ'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'done') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-background flex items-center justify-center px-4">
        <div className="card max-w-lg text-center shadow-xl">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">ทำเสร็จแล้ว!</h2>
          <p className="text-gray-500 mb-6">การทดสอบวัดระดับเสร็จสิ้นแล้ว ตอนนี้ระบบกำลังปรับคอร์สให้เหมาะกับบุตรหลานของคุณ</p>
          <Link href={`/children/${childId}`} className="btn-primary inline-block">กลับหน้าหลัก</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white border-b border-primary-100 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href={`/children/${childId}`} className="text-2xl hover:opacity-70">←</Link>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">ข้อ {current + 1} / {questions.length}</span>
          </div>
          <div className="w-8" />
        </div>
      </header>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-200">
        <div
          className="h-full bg-primary-500 transition-all duration-300"
          style={{ width: `${((current + 1) / questions.length) * 100}%` }}
        />
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
                      ? 'border-primary-400 bg-primary-50 text-primary-800'
                      : 'border-gray-200 hover:border-primary-300 hover:bg-primary-50 text-gray-700'
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

          {/* Feedback */}
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

          {/* Actions */}
          <div className="mt-6 flex justify-end gap-3">
            {!answerResult ? (
              <button onClick={handleAnswer} disabled={!selected} className="btn-primary">
                ส่งคำตอบ
              </button>
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
