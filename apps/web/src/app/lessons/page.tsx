'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/auth'
import { meApi } from '@/lib/api/me'
import { TopaBrandMark, TopaMascot } from '@/components/brand/TopaBrand'

const BETA_READY_LESSON_GRADES = new Set([1, 2, 3, 4, 5, 6])
const DISPLAY_GRADES = [1, 2, 3, 4, 5, 6]

const PREPARING_GRADE_COPY: Record<number, string> = {
  4: 'ป.4 กำลังเตรียมบทเรียน',
  5: 'ป.5 กำลังเตรียมบทเรียน',
  6: 'ป.6 กำลังเตรียมบทเรียน',
}

type LessonListItem = {
  lesson_id?: string
  title_th?: string
  title?: string
  grade_level?: number
  content_status?: string
  status?: string
}

function isReadyLesson(lesson: LessonListItem) {
  const grade = Number(lesson.grade_level)
  if (!BETA_READY_LESSON_GRADES.has(grade)) return false
  if (!lesson.lesson_id) return false
  if (lesson.content_status && lesson.content_status !== 'READY_FOR_BETA') return false
  return lesson.status !== 'coming_soon'
}

function PreparingGradeCard({ grade }: { grade: number }) {
  return (
    <div className="card border border-gray-100 bg-gray-50 opacity-90" aria-disabled="true">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <TopaMascot size="sm" className="opacity-85" />
          <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full">
            กำลังตรวจบทเรียน
          </span>
        </div>
        <div className="text-sm text-gray-400 font-semibold mb-1">ป.{grade}</div>
        <h3 className="font-bold text-gray-800">{PREPARING_GRADE_COPY[grade]}</h3>
        <p className="text-xs text-gray-500 mt-1">Coming Soon</p>
      </div>
    </div>
  )
}

function EmptyReadyGradeCard() {
  return (
    <div className="card border border-gray-100 bg-gray-50" aria-disabled="true">
      <div className="p-4">
        <span className="inline-flex text-xs font-bold bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full mb-3">
          กำลังตรวจบทเรียน
        </span>
        <h3 className="font-bold text-gray-700">บทเรียนกำลังตรวจ QA</h3>
        <p className="text-xs text-gray-500 mt-1">บทเรียนชั้นนี้จะเปิดเมื่อผ่าน QA สำหรับ Beta</p>
      </div>
    </div>
  )
}

export default function LessonsPage() {
  const token = useAuthStore(s => s.token)
  const isLoading = useAuthStore(s => s.isLoading)
  const checkAuth = useAuthStore(s => s.checkAuth)
  const router = useRouter()
  const [lessons, setLessons] = useState<LessonListItem[]>([])
  const [selectedGrade, setSelectedGrade] = useState<number>(1)
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
      .then((rows) => setLessons(rows as LessonListItem[]))
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
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-primary-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <TopaBrandMark />
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

        {!error && (() => {
          const visibleLessons = lessons
            .filter((lesson) => Number(lesson.grade_level) === selectedGrade)
            .filter(isReadyLesson)

          return (
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2" role="tablist" aria-label="เลือกชั้นเรียน">
                {DISPLAY_GRADES.map((grade) => (
                  <button
                    key={grade}
                    type="button"
                    role="tab"
                    aria-selected={selectedGrade === grade}
                    onClick={() => setSelectedGrade(grade)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                      selectedGrade === grade
                        ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300 hover:bg-primary-50'
                    }`}
                  >
                    ป.{grade}
                  </button>
                ))}
              </div>

              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-extrabold text-gray-900">ป.{selectedGrade}</h2>
                  {!BETA_READY_LESSON_GRADES.has(selectedGrade) && (
                    <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full">
                      Coming Soon
                    </span>
                  )}
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {BETA_READY_LESSON_GRADES.has(selectedGrade) && visibleLessons.map((lesson) => (
                    <Link
                      key={lesson.lesson_id}
                      href={`/dashboard/lessons/${lesson.lesson_id}`}
                      className="card border border-gray-100 hover:border-primary-200 hover:shadow-md transition-all"
                    >
                      <div className="p-4">
                        <div className="text-sm text-primary-500 font-semibold mb-1">ป.{lesson.grade_level}</div>
                        <h3 className="font-bold text-gray-900">{lesson.title_th || lesson.title || lesson.lesson_id}</h3>
                      </div>
                    </Link>
                  ))}

                  {BETA_READY_LESSON_GRADES.has(selectedGrade) && visibleLessons.length === 0 && <EmptyReadyGradeCard />}
                  {!BETA_READY_LESSON_GRADES.has(selectedGrade) && <PreparingGradeCard grade={selectedGrade} />}
                </div>
              </section>
            </div>
          )
        })()}
        {false && (
          <div className="space-y-8">
            {DISPLAY_GRADES.map((grade) => {
              const gradeLessons = lessons
                .filter((lesson) => Number(lesson.grade_level) === grade)
                .filter(isReadyLesson)

              return (
                <section key={grade}>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-extrabold text-gray-900">ป.{grade}</h2>
                    {!BETA_READY_LESSON_GRADES.has(grade) && (
                      <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full">
                        Coming Soon
                      </span>
                    )}
                  </div>

                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {BETA_READY_LESSON_GRADES.has(grade) && gradeLessons.map((lesson) => (
                      <Link
                        key={lesson.lesson_id}
                        href={`/dashboard/lessons/${lesson.lesson_id}`}
                        className="card border border-gray-100 hover:border-primary-200 hover:shadow-md transition-all"
                      >
                        <div className="p-4">
                          <div className="text-sm text-primary-500 font-semibold mb-1">ป.{lesson.grade_level}</div>
                          <h3 className="font-bold text-gray-900">{lesson.title_th || lesson.title || lesson.lesson_id}</h3>
                        </div>
                      </Link>
                    ))}

                    {BETA_READY_LESSON_GRADES.has(grade) && gradeLessons.length === 0 && <EmptyReadyGradeCard />}
                    {!BETA_READY_LESSON_GRADES.has(grade) && <PreparingGradeCard grade={grade} />}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
