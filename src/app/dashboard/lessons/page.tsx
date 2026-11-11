'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, BookOpen, GraduationCap, Lock, Sparkles } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { meApi, type Lesson, type LessonProgram, type LessonsResponse } from '@/lib/api/me'
import { TopaButton, TopaCard } from '@/components/topa/TopaUI'

/**
 * Lesson picker.
 *
 * Every grade ป.1-ป.6 gets its own section, filled from the real API
 * (`GET /me/lessons?grade=N`). The student picks the lesson they want to
 * practise and the card takes them straight into the interactive lesson
 * view (`/dashboard/lessons/{id}/master`).
 */

const GRADES = [1, 2, 3, 4, 5, 6] as const

const GRADE_TH: Record<number, string> = {
  1: 'ป.1',
  2: 'ป.2',
  3: 'ป.3',
  4: 'ป.4',
  5: 'ป.5',
  6: 'ป.6',
}

type GradeSection = {
  grade: number
  lessons: Lesson[]
  loading: boolean
  /** Why a grade has no lessons yet (backend QA gating). */
  note: string
}

function noteForGrade(payload: LessonsResponse | undefined, grade: number): string {
  const diagnostics = payload?.content_diagnostics
  if (!diagnostics) return 'ยังไม่มีบทเรียนที่เปิดให้เรียนในชั้นนี้'
  if (diagnostics.hidden_reason === 'found_files_but_needs_review') {
    return 'บทเรียนชั้นนี้อยู่ระหว่างการตรวจคุณภาพ (QA) โดยทีมงาน — เลือกชั้นอื่นได้ระหว่างรอ'
  }
  return 'ยังไม่มีบทเรียนที่เปิดให้เรียนในชั้นนี้'
}

function LessonPicker() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { checkAuth } = useAuthStore()

  const programType: LessonProgram = searchParams.get('program_type') === 'EP' ? 'EP' : 'TH'

  const [sections, setSections] = useState<GradeSection[]>(
    GRADES.map((grade) => ({ grade, lessons: [], loading: true, note: '' })),
  )

  useEffect(() => {
    checkAuth().then((authenticatedUser) => {
      if (!authenticatedUser) router.push('/login')
    })
  }, [checkAuth, router])

  const loadGrade = useCallback(async (grade: number) => {
    setSections((prev) =>
      prev.map((section) => (section.grade === grade ? { ...section, loading: true } : section)),
    )
    try {
      const payload = await meApi.getLessonsPayload(grade, programType)
      const lessons =
        payload.lessons && payload.lessons.length > 0
          ? payload.lessons
          : [
              ...(payload.current_grade_lessons ?? []),
              ...(payload.review_lessons ?? []),
              ...(payload.future_lessons ?? []),
            ]
      setSections((prev) =>
        prev.map((section) =>
          section.grade === grade
            ? {
                ...section,
                loading: false,
                lessons,
                note: lessons.length > 0 ? '' : noteForGrade(payload, grade),
              }
            : section,
        ),
      )
    } catch {
      setSections((prev) =>
        prev.map((section) =>
          section.grade === grade
            ? { ...section, loading: false, note: 'โหลดบทเรียนไม่สำเร็จ กรุณาลองใหม่' }
            : section,
        ),
      )
    }
  }, [programType])

  useEffect(() => {
    GRADES.forEach((grade) => {
      void loadGrade(grade)
    })
  }, [loadGrade])

  const totalLessons = useMemo(
    () => sections.reduce((sum, section) => sum + section.lessons.length, 0),
    [sections],
  )

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-primary-100 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-800"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>กลับแดชบอร์ด</span>
          </button>
          <div className="flex items-center gap-2 text-sm font-black text-gray-800">
            <GraduationCap className="h-5 w-5 text-amber-500" />
            <span>เลือกบทเรียนที่ต้องการเรียน</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <TopaCard className="mb-6 p-5">
          <h1 className="text-xl font-black text-slate-950">เลือกบทเรียน ป.1–ป.6</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            เลือกชั้นปีและบทเรียนที่ต้องการ แล้วกดเข้าไปเรียนแบบโต้ตอบได้ทันที
            {totalLessons > 0 ? ` (เปิดให้เรียนแล้ว ${totalLessons} บท)` : ''}
          </p>
        </TopaCard>

        <div className="space-y-8">
          {sections.map((section) => (
            <section key={section.grade}>
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-full bg-amber-400 px-3 py-1 text-sm font-black text-slate-950">
                  {GRADE_TH[section.grade]}
                </span>
                <span className="text-sm font-bold text-slate-500">
                  {section.loading
                    ? 'กำลังโหลด...'
                    : section.lessons.length > 0
                      ? `${section.lessons.length} บทเรียน`
                      : 'ยังไม่มีบทเรียน'}
                </span>
              </div>

              {section.lessons.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {section.lessons.map((lesson) => {
                    const locked = lesson.status === 'locked' || lesson.is_locked
                    const lessonId = lesson.lesson_group_id || lesson.lesson_id
                    return (
                      <TopaCard
                        key={lesson.lesson_id}
                        className={`flex flex-col justify-between p-5 ${locked ? 'opacity-70' : ''}`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="font-black text-slate-950">
                              {lesson.title_th || lesson.title || lesson.lesson_id}
                            </h3>
                            <BookOpen className="h-5 w-5 shrink-0 text-amber-500" />
                          </div>
                          <p className="mt-1 text-sm font-medium text-slate-500">
                            {lesson.topic_code || lesson.skill_code || 'TOPA Math'} ·{' '}
                            {lesson.duration || lesson.estimated_minutes || 10} นาที
                          </p>
                        </div>

                        {locked ? (
                          <Link
                            href="/pricing"
                            className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm font-black text-amber-700"
                          >
                            <Lock className="h-4 w-4" />
                            อัปเกรดเพื่อเรียน
                          </Link>
                        ) : (
                          <Link
                            href={`/dashboard/lessons/${lessonId}/master?program_type=${programType}`}
                            className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-sky-600 px-3 py-2.5 text-sm font-black text-white shadow-sm transition hover:from-sky-600 hover:to-sky-700"
                          >
                            <Sparkles className="h-4 w-4" />
                            เรียนแบบโต้ตอบ
                          </Link>
                        )}
                      </TopaCard>
                    )
                  })}
                </div>
              ) : (
                <TopaCard className="p-5 text-sm font-medium text-slate-500">
                  {section.loading ? 'กำลังโหลดบทเรียนของชั้นนี้...' : section.note}
                </TopaCard>
              )}
            </section>
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          <TopaButton href="/dashboard" variant="secondary">
            กลับแดชบอร์ด
          </TopaButton>
        </div>
      </main>
    </div>
  )}

/**
 * The page reads the program type from the query string, so the part
 * that uses `useSearchParams` sits behind a Suspense boundary to keep
 * the page prerenderable.
 */
export default function LessonPickerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <p className="text-base font-semibold text-slate-500">กำลังโหลดบทเรียน...</p>
        </div>
      }
    >
      <LessonPicker />
    </Suspense>
  )
}
