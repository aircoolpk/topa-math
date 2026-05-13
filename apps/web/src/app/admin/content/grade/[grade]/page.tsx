'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { mockContentApi } from '@/lib/mock-content'
import type { AdminContentLesson } from '@/lib/api/admin'

const GRADE_LABELS: Record<number, string> = {
  1: 'ชั้นประถมศึกษาปีที่ 1',
  2: 'ชั้นประถมศึกษาปีที่ 2',
  3: 'ชั้นประถมศึกษาปีที่ 3',
  4: 'ชั้นประถมศึกษาปีที่ 4',
  5: 'ชั้นประถมศึกษาปีที่ 5',
  6: 'ชั้นประถมศึกษาปีที่ 6',
}

const STATUS_COLORS: Record<string, string> = {
  published: 'bg-green-100 text-green-700',
  needs_review: 'bg-amber-100 text-amber-700',
  draft: 'bg-gray-100 text-gray-600',
}

const STATUS_LABELS: Record<string, string> = {
  published: 'เผยแพร่แล้ว',
  needs_review: 'ต้องตรวจสอบ',
  draft: 'ฉบับร่าง',
}

function CompletenessBar({ score }: { score: number | null | undefined }) {
  if (score == null) return <span className="text-xs text-gray-400">-</span>
  const color = score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-gray-200 overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-medium text-gray-700">{score}%</span>
    </div>
  )
}

function ErrorBadge({ count }: { count: number | null | undefined }) {
  if (!count) return null
  return (
    <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">
      {count} error{count > 1 ? 's' : ''}
    </span>
  )
}

export default function GradeContentPage() {
  const params = useParams()
  const grade = Number(params.grade)
  const [lessons, setLessons] = useState<AdminContentLesson[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    mockContentApi.getLessonsByGrade(grade).then((data) => {
      setLessons(data)
      setLoading(false)
    })
  }, [grade])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-gray-400">กำลังโหลด...</span>
      </div>
    )
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/content"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 transition-colors"
        >
          <span>←</span>
          <span>กลับ</span>
        </Link>
        <span className="text-gray-300">|</span>
        <h1 className="text-2xl font-extrabold text-gray-950">{GRADE_LABELS[grade] ?? `ชั้นที่ ${grade}`}</h1>
        <span className="ml-auto rounded-full bg-gray-100 px-3 py-0.5 text-xs font-medium text-gray-600">
          {lessons.length} บทเรียน
        </span>
      </div>

      {lessons.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center">
          <p className="text-gray-400">ยังไม่มีบทเรียนสำหรับชั้นนี้</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['ชื่อบทเรียน', 'วิชา', 'Topic', 'Type', 'สถานะ', 'ความสมบูรณ์', 'ข้อสอบ', 'อัปเดต'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
                  >
                    {h}
                  </th>
                ))}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {lessons.map((lesson) => (
                <tr key={lesson.lesson_id} className="hover:bg-primary-50/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-900">{lesson.title || lesson.title_en || 'ไม่มีชื่อ'}</div>
                    {lesson.title_en && lesson.title && (
                      <div className="text-xs text-gray-400">{lesson.title_en}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 capitalize text-gray-600">{lesson.subject ?? '-'}</td>
                  <td className="px-4 py-3 text-xs font-mono text-gray-500">{lesson.topic ?? '-'}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-600">
                      {lesson.program_type ?? 'THP'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[lesson.status ?? ''] ?? 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABELS[lesson.status ?? ''] ?? lesson.status ?? '-'}
                    </span>
                    {lesson.error_count ? <ErrorBadge count={lesson.error_count} /> : null}
                  </td>
                  <td className="px-4 py-3">
                    <CompletenessBar score={lesson.completeness_score} />
                  </td>
                  <td className="px-4 py-3 text-center text-gray-700">
                    <span className="font-semibold">{lesson.quiz_count ?? 0}</span>
                    <span className="text-gray-400"> ข้อ</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                    {lesson.updated_at
                      ? new Date(lesson.updated_at).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' })
                      : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/content/lesson/${lesson.lesson_id}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors"
                    >
                      แก้ไขบทเรียน
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
