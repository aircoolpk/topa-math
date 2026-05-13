'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/auth'
import { learningApi } from '@/lib/api/learning'

export default function QuizIntroPage() {
  const params = useParams()
  const childId = params.childId as string
  const router = useRouter()
  const { checkAuth } = useAuthStore()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    checkAuth().then(() => {
      if (!localStorage.getItem('access_token')) router.push('/login')
    })
  }, [])

  const startQuiz = async () => {
    setLoading(true)
    try {
      const data = await learningApi.startPlacement(childId)
      router.push(`/children/${childId}/quiz/${data.session_id}`)
    } catch {
      alert('เริ่มควิซไม่สำเร็จ กรุณาลองใหม่')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary-50 to-background flex items-center justify-center px-4">
      <div className="card max-w-lg text-center shadow-xl">
        <div className="text-6xl mb-4">🎮</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">เล่นควิซ</h2>
        <p className="text-gray-500 mb-6">มาลองทำควิซคณิตศาสตร์กันเถอะ! ทำให้ดีที่สุดนะ 💪</p>
        <div className="bg-secondary-50 rounded-xl p-4 mb-6 text-left">
          <p className="text-sm font-medium text-secondary-800 mb-2">📌 เคล็ดลับ:</p>
          <ul className="text-sm text-secondary-700 space-y-1">
            <li>• ทำทุกข้อให้ดีที่สุด</li>
            <li>• ได้ XP ทุกครั้งที่ตอบถูก</li>
            <li>• ฝึกฝนทักษะที่ยังไม่แน่น</li>
          </ul>
        </div>
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
