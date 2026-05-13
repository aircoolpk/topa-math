'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/auth'
import { learningApi, type SessionCompleteResult } from '@/lib/api/learning'

export default function ResultPage() {
  const params = useParams()
  const childId = params.childId as string
  const sessionId = params.sessionId as string
  const router = useRouter()
  const { checkAuth } = useAuthStore()
  const [result, setResult] = useState<SessionCompleteResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth().then(() => {
      if (!localStorage.getItem('access_token')) router.push('/login')
    })
  }, [])

  useEffect(() => {
    if (!sessionId) return
    learningApi.completeSession(sessionId)
      .then(setResult)
      .catch(() => router.push(`/children/${childId}`))
      .finally(() => setLoading(false))
  }, [sessionId])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-bounce-sm">🏆</div>
          <p className="text-gray-500">กำลังโหลดผลลัพธ์...</p>
        </div>
      </div>
    )
  }

  if (!result) return null

  const xpEarned = result.correct_count * 5

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-background to-primary-50">
      <main className="max-w-2xl mx-auto px-4 py-12 text-center">
        {/* Trophy */}
        <div className="text-8xl mb-4 animate-bounce-sm">🏆</div>
        <h2 className="text-3xl font-extrabold text-gray-900 mb-2">ยินดีด้วย!</h2>
        <p className="text-gray-500 mb-8">ควิซเสร็จสิ้นแล้ว นี่คือผลลัพธ์ของบุตรหลานคุณ</p>

        {/* Score Card */}
        <div className="card shadow-xl mb-6">
          <div className="flex justify-center gap-8 mb-6">
            <div>
              <div className="text-5xl font-extrabold text-primary-600">{result.correct_count}</div>
              <p className="text-sm text-gray-500 mt-1">ข้อถูกต้อง</p>
            </div>
            <div className="w-px bg-gray-200" />
            <div>
              <div className="text-5xl font-extrabold text-gray-400">{result.correct_count > 0 ? (result.correct_count > 10 ? '??' : '?') : '?'}</div>
              <p className="text-sm text-gray-500 mt-1">ข้อทั้งหมด</p>
            </div>
          </div>

          <div className="bg-primary-50 rounded-xl p-4 mb-4">
            <p className="text-2xl font-bold text-primary-600">+{xpEarned} XP</p>
          </div>
        </div>

        {/* Skill Mastery Updates */}
        {result.mastery && result.mastery.length > 0 && (
          <div className="card mb-6 text-left">
            <h3 className="section-title mb-4">📈 ทักษะที่ได้รับการปรับปรุง</h3>
            <div className="space-y-3">
              {result.mastery.map((m) => (
                <div key={m.skill_id} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-800">ทักษะ #{m.skill_id.slice(-4)}</span>
                      <span className={`badge ${m.mastery_level === 'mastery' ? 'bg-purple-100 text-purple-700' : m.mastery_level === 'advanced' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                        {m.mastery_level}
                      </span>
                    </div>
                    <div className="xp-bar-bg">
                      <div className="xp-bar-fill" style={{ width: `${m.mastery_score}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-center">
          <Link href={`/children/${childId}/quiz/new`} className="btn-primary px-8">เล่นอีกครั้ง 🎮</Link>
          <Link href={`/children/${childId}`} className="btn-secondary px-8">กลับหน้าหลัก</Link>
        </div>
      </main>
    </div>
  )
}
