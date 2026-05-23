'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BookOpen, ClipboardCheck, Clock, Languages, PlayCircle } from 'lucide-react'
import { TopaBrandMark } from '@/components/brand/TopaBrand'
import { meApi, type Lesson, type LessonProgram } from '@/lib/api/me'
import { useAuthStore } from '@/store/auth'

const DISPLAY_GRADES = [1, 2, 3, 4, 5, 6]

function baseLessonId(lessonId: string): string {
  return lessonId.replace(/_(ep|thp|th)$/i, '')
}

function lessonProgram(lesson: Lesson): LessonProgram {
  if ((lesson.program_type || '').toUpperCase() === 'EP') return 'EP'
  if (lesson.lesson_id.toLowerCase().endsWith('_ep')) return 'EP'
  return 'TH'
}

function lessonTitle(lesson: Lesson, programType: LessonProgram): string {
  if (programType === 'EP') return lesson.title_en || lesson.title || lesson.title_th || lesson.lesson_id
  return lesson.title_th || lesson.title || lesson.title_en || lesson.lesson_id
}

function isVisibleLesson(lesson: Lesson, programType: LessonProgram): boolean {
  if (!lesson.lesson_id) return false
  if (String(lesson.status ?? '') === 'coming_soon') return false
  if (programType === 'TH' && lesson.lesson_id.toLowerCase().endsWith('_ep')) return false
  return lessonProgram(lesson) === programType
}

export default function LessonsPage() {
  const router = useRouter()
  const { checkAuth } = useAuthStore()
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [selectedGrade, setSelectedGrade] = useState(3)
  const [programType, setProgramType] = useState<LessonProgram>('TH')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [startingLessonId, setStartingLessonId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadLessons() {
      setLoading(true)
      setError('')
      try {
        await checkAuth()
        if (!localStorage.getItem('access_token')) {
          router.replace('/login')
          return
        }
        const rows = await meApi.getLessons(undefined, programType)
        if (cancelled) return
        setLessons(rows)
        console.info('[lessons] canonical lessons loaded', {
          program_type: programType,
          count: rows.length,
          grades: DISPLAY_GRADES.map((grade) => ({
            grade,
            count: rows.filter((lesson) => Number(lesson.grade_level) === grade).length,
          })),
        })
      } catch (err) {
        console.error('[lessons] failed to load canonical lessons', err)
        if (!cancelled) setError('ไม่สามารถโหลดบทเรียนได้')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadLessons()
    return () => {
      cancelled = true
    }
  }, [checkAuth, programType, router])

  const visibleLessons = useMemo(
    () =>
      lessons
        .filter((lesson) => Number(lesson.grade_level) === selectedGrade)
        .filter((lesson) => isVisibleLesson(lesson, programType))
        .sort((a, b) => baseLessonId(a.lesson_id).localeCompare(baseLessonId(b.lesson_id))),
    [lessons, programType, selectedGrade],
  )

  const lessonCounts = useMemo(
    () =>
      DISPLAY_GRADES.reduce<Record<number, number>>((acc, grade) => {
        acc[grade] = lessons
          .filter((lesson) => Number(lesson.grade_level) === grade)
          .filter((lesson) => isVisibleLesson(lesson, programType)).length
        return acc
      }, {}),
    [lessons, programType],
  )

  const startTest = async (lesson: Lesson) => {
    setStartingLessonId(lesson.lesson_id)
    try {
      const { session_id } = await meApi.startLessonTest(lesson.lesson_id, programType)
      router.push(`/dashboard/tests/${session_id}`)
    } catch (err) {
      console.error('[lessons] failed to start lesson test', {
        lesson_id: lesson.lesson_id,
        program_type: programType,
        error: err,
      })
      setStartingLessonId(null)
      alert('ไม่สามารถเริ่มเทสได้ กรุณาลองใหม่')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-gray-500 font-semibold">กำลังโหลดบทเรียน...</p>
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

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">บทเรียนทั้งหมด</h1>
            <p className="text-sm text-gray-500 mt-1">เลือกชั้นเรียนและโปรแกรมเพื่อดูบทเรียนที่อนุมัติแล้ว</p>
          </div>
          <div className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white p-1 shadow-sm w-fit">
            <Languages className="h-4 w-4 text-gray-400 ml-2" aria-hidden="true" />
            {(['TH', 'EP'] as LessonProgram[]).map((program) => (
              <button
                key={program}
                type="button"
                onClick={() => setProgramType(program)}
                className={`min-w-14 rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                  programType === program
                    ? program === 'TH'
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {program}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6" role="tablist" aria-label="เลือกชั้นเรียน">
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
              <span className="ml-2 text-xs opacity-80">{lessonCounts[grade] ?? 0}</span>
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-red-700 font-semibold">
            {error}
          </div>
        )}

        {!error && visibleLessons.length === 0 && (
          <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-6 text-center">
            <p className="font-bold text-amber-800">
              {programType === 'EP' ? 'EP กำลังตรวจสอบ' : 'ยังไม่มีบทเรียนที่เปิดใช้งานสำหรับชั้นนี้'}
            </p>
            <p className="text-sm text-amber-700 mt-1">ระบบจะแสดงเฉพาะบทเรียนที่อนุมัติแล้วจากแหล่ง canonical เดียวกับหน้าแอดมิน</p>
          </div>
        )}

        {!error && visibleLessons.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleLessons.map((lesson) => {
              const canonicalId = baseLessonId(lesson.lesson_id)
              const testAvailable = lesson.test_available ?? lesson.has_approved_test ?? lesson.has_test ?? false
              const duration = lesson.estimated_minutes ?? 8
              return (
                <article key={lesson.lesson_id} className="card border border-gray-100 hover:border-primary-200 hover:shadow-md transition-all">
                  <div className="p-4 flex h-full flex-col gap-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs font-bold text-primary-600 mb-2">
                          <BookOpen className="h-4 w-4" aria-hidden="true" />
                          <span>ป.{lesson.grade_level}</span>
                          <span>{programType}</span>
                        </div>
                        <h2 className="font-extrabold text-gray-900 leading-snug">{lessonTitle(lesson, programType)}</h2>
                        <p className="text-xs text-gray-500 mt-2 break-all">{canonicalId}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 font-semibold">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        {duration} นาที
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold ${
                        testAvailable ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" />
                        {testAvailable ? 'มีเทส' : 'ยังไม่มีเทส'}
                      </span>
                    </div>

                    <div className="mt-auto flex gap-2">
                      <button
                        type="button"
                        onClick={() => router.push(`/dashboard/lessons/${canonicalId}?program_type=${programType}`)}
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-3 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-primary-700"
                      >
                        <PlayCircle className="h-4 w-4" aria-hidden="true" />
                        เรียนต่อ
                      </button>
                      {testAvailable && (
                        <button
                          type="button"
                          onClick={() => startTest(lesson)}
                          disabled={startingLessonId === lesson.lesson_id}
                          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-accent-300 bg-accent-50 px-3 py-2.5 text-sm font-bold text-accent-700 hover:bg-accent-100 disabled:opacity-60"
                        >
                          <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                          {startingLessonId === lesson.lesson_id ? 'กำลังเริ่ม...' : 'ทำเทสจากบทนี้'}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
