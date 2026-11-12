'use client'

import { useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

/**
 * The lesson route now only forwards to the interactive master.
 *
 * The master teaches the topic and then lets the student practise it, so
 * it replaces the old read-only lesson page. The redirect keeps every
 * bookmark and every link that still points at `/dashboard/lessons/<id>`
 * working without a second, parallel lesson experience.
 */
export default function LessonRedirectPage() {
  const router = useRouter()
  const params = useParams<{ lessonId: string }>()
  const searchParams = useSearchParams()

  const lessonId = params.lessonId
  const programType = searchParams.get('program_type') === 'EP' ? 'EP' : 'TH'

  useEffect(() => {
    if (!lessonId) return
    router.replace(`/dashboard/lessons/${lessonId}/master?program_type=${programType}`)
  }, [lessonId, programType, router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-base font-semibold text-gray-600">กำลังเปิดบทเรียน...</p>
    </div>
  )
}
