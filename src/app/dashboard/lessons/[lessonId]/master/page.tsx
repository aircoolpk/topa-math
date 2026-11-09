'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { meApi, type Lesson } from '@/lib/api/me'
import { DEMO_PROBLEMS } from '@/components/lesson/demoProblems'
import { LessonMasterView } from '@/components/lesson/LessonMasterView'
import { getThemeForGrade } from '@/components/lesson/theme'
import type { LessonProblem } from '@/components/lesson/types'

type Phase = 'loading' | 'ready' | 'error'

/**
 * Lesson & Practice view built on the master architecture.
 *
 * The shell, the four zones, the workspace registry and the two-stage
 * feedback loop are all live. The practice problems are still the demo set
 * from the prototype: the real lesson content is converted in the next step
 * (see the API_TS_MIGRATION_MAP / content pipeline notes).
 */
export default function LessonMasterPage() {
  const params = useParams<{ lessonId: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { checkAuth } = useAuthStore()

  const lessonId = params.lessonId
  const programType = searchParams.get('program_type') === 'EP' ? 'EP' : 'TH'

  const [phase, setPhase] = useState<Phase>('loading')
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    checkAuth().then((authenticatedUser) => {
      if (!authenticatedUser) router.push('/login')
    })
  }, [checkAuth, router])

  const loadLesson = useCallback(async () => {
    if (!lessonId) return
    setPhase('loading')
    setErrorMsg('')
    try {
      const fetched = await meApi.getLesson(lessonId, programType)
      setLesson(fetched)
      setPhase('ready')
    } catch (err: unknown) {
      const e = err as { response?: { status?: number } }
      setErrorMsg(
        e?.response?.status === 404 ? 'ไม่พบบทเรียนนี้' : 'โหลดบทเรียนไม่สำเร็จ กรุณาลองใหม่',
      )
      setPhase('error')
    }
  }, [lessonId, programType])

  useEffect(() => {
    loadLesson()
  }, [loadLesson])

  const grade = useMemo(() => {
    const raw = Number(lesson?.grade_level)
    return Number.isFinite(raw) && raw >= 1 && raw <= 6 ? raw : 3
  }, [lesson?.grade_level])

  const problems: LessonProblem[] = useMemo(() => DEMO_PROBLEMS, [])

  if (phase === 'error') {
    const theme = getThemeForGrade(grade)
    return (
      <div
        className={`flex h-screen w-screen flex-col items-center justify-center gap-4 ${theme.shell}`}
        style={{ fontFamily: theme.fontFamily }}
      >
        <p className={`text-lg font-bold ${theme.text}`}>{errorMsg}</p>
        <button
          onClick={() => router.push('/dashboard')}
          className={`rounded-2xl px-5 py-2.5 font-bold ${theme.buttonPrimary}`}
        >
          กลับแดชบอร์ด
        </button>
      </div>
    )
  }

  if (phase === 'loading' || !lesson) {
    const theme = getThemeForGrade(grade)
    return (
      <div
        className={`flex h-screen w-screen items-center justify-center ${theme.shell}`}
        style={{ fontFamily: theme.fontFamily }}
      >
        <p className={`text-base font-semibold ${theme.textMuted}`}>กำลังโหลดบทเรียน...</p>
      </div>
    )
  }

  return (
    <LessonMasterView
      problems={problems}
      grade={grade}
      onExit={() => router.push('/dashboard')}
    />
  )
}
