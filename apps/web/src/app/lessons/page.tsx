'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/auth'
import { meApi } from '@/lib/api/me'

export default function LessonsPage() {
  const token = useAuthStore(s => s.token)
  const isLoading = useAuthStore(s => s.isLoading)
  const checkAuth = useAuthStore(s => s.checkAuth)
  const router = useRouter()
  const [lessons, setLessons] = useState<unknown[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isLoading) return
    const storedToken = localStorage.getItem('access_token')
    if (!token && !storedToken) {
      router.push('/login')
      return
    }

    if (!token && storedToken) checkAuth()

    meApi.getLessons()
      .then(setLessons)
      .catch(() => setError('ไม่สามารถโหลดบทเรียนได้'))
      .finally(() => setLoading(false))
  }, [checkAuth, isLoading, token, router])

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">กำลังโหลดบทเรียน...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Simple nav */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-primary-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-9 h-9 bg-gradient-to-br from-primary-400 to-primary-600 rounded-xl flex items-center justify-center">
              <span className="text-white text-lg font-black">4</span>
            </div>
            <span className="text-xl font-extrabold text-gray-900">4-Craft</span>
          </Link>
          <Link href="/dashboard" className="text-sm font-semibold text-gray-600 hover:text-primary-600 px-3 py-1.5 rounded-lg hover:bg-primary-50">
            กลับแดชบอร์ด
          </Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-6">📚 บทเรียนทั้งหมด</h1>

        {error && (
          <div className="text-center py-8 text-gray-500">{error}</div>
        )}

        {!error && lessons.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">ยังไม่มีบทเรียนที่พร้อมให้เรียน</p>
            <Link href="/dashboard" className="text-primary-600 hover:text-primary-700 font-semibold">
              กลับไปที่แดชบอร์ด
            </Link>
          </div>
        )}

        {lessons.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {lessons.map((lesson: unknown) => {
              const l = lesson as { lesson_id?: string; title_th?: string; grade_level?: number }
              return (
                <Link
                  key={l.lesson_id}
                  href={`/dashboard/lessons/${l.lesson_id}`}
                  className="card border border-gray-100 hover:border-primary-200 hover:shadow-md transition-all"
                >
                  <div className="p-4">
                    <div className="text-sm text-primary-500 font-semibold mb-1">
                      ป.{(l as {grade_level?:number}).grade_level}
                    </div>
                    <h3 className="font-bold text-gray-900">
                      {(l as {title_th?:string}).title_th || l.lesson_id}
                    </h3>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
