'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { meApi, type LessonProgram } from '@/lib/api/me'
import { LessonMasterView } from '@/components/lesson/LessonMasterView'
import {
  bundleFromLessonDetail,
  bundleFromStartResponse,
  mapLessonToProblems,
  type LessonContentBundle,
} from '@/components/lesson/lessonMapper'
import { getThemeForGrade } from '@/components/lesson/theme'
import type { LessonProblem } from '@/components/lesson/types'

type Phase = 'loading' | 'ready' | 'error'

/**
 * Lesson & Practice view built on the master architecture.
 *
 * The shell, the four zones, the workspace registry and the two-stage
 * feedback loop are all live. The practice problems come from the real
 * lesson content: the lesson view model is converted into `LessonProblem[]`
 * by the mapper, so the question, the hints, the worked solution, the maths
 * vocabulary and the manipulative on the board all belong to the lesson the
 * student picked.
 */
export default function LessonMasterPage() {
  const params = useParams<{ lessonId: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { checkAuth } = useAuthStore()

  const lessonId = params.lessonId
  const programType: LessonProgram = searchParams.get('program_type') === 'EP' ? 'EP' : 'TH'

  const [phase, setPhase] = useState<Phase>('loading')
  const [bundle, setBundle] = useState<LessonContentBundle | null>(null)
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
      // The start endpoint returns the selected variant with its questions,
      // hints, explanation steps, key vocabulary and visual blocks.
      const started = await meApi.startLessonWithContent(lessonId, programType)
      setBundle(bundleFromStartResponse(started))
      setPhase('ready')
    } catch {
      // Fall back to the lesson view model when the start endpoint is closed
      // (locked lesson, program not available, ...).
      try {
        const detail = await meApi.getLesson(lessonId, programType)
        setBundle(bundleFromLessonDetail(detail))
        setPhase('ready')
      } catch (err: unknown) {
        const e = err as { response?: { status?: number } }
        setErrorMsg(
          e?.response?.status === 404 ? 'ไม่พบบทเรียนนี้' : 'โหลดบทเรียนไม่สำเร็จ กรุณาลองใหม่',
        )
        setPhase('error')
      }
    }
  }, [lessonId, programType])

  useEffect(() => {
    loadLesson()
  }, [loadLesson])

  const grade = useMemo(() => {
    const raw = Number(bundle?.gradeLevel)
    return Number.isFinite(raw) && raw >= 1 && raw <= 6 ? raw : 3
  }, [bundle?.gradeLevel])

  const problems: LessonProblem[] = useMemo(
    () => (bundle ? mapLessonToProblems(bundle) : []),
    [bundle],
  )

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

  if (phase === 'loading' || !bundle) {
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
