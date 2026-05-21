'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { getAdminLessons, type AdminLessonRow } from '@/lib/api/admin-content'
import { adminApi } from '@/lib/api/admin'

export default function GradeContentPage() {
  const params = useParams()
  const grade = Number(params.grade)
  const [lessons, setLessons] = useState<AdminLessonRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getAdminLessons({ grade_level: grade })
      .then(setLessons)
      .catch((err) => setError(adminApi.errorMessage(err, 'โหลดบทเรียนไม่สำเร็จ')))
      .finally(() => setLoading(false))
  }, [grade])

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <div className="flex items-center gap-3">
        <Link href="/admin/lessons" className="text-sm text-gray-500 hover:text-primary-600">กลับ</Link>
        <span className="text-gray-300">|</span>
        <h1 className="text-2xl font-extrabold text-gray-950">บทเรียน ป.{grade}</h1>
        <span className="ml-auto rounded-full bg-gray-100 px-3 py-0.5 text-xs font-medium text-gray-600">{lessons.length} บทเรียน</span>
      </div>
      {error && <pre className="whitespace-pre-wrap rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</pre>}
      {loading ? <p className="text-sm text-gray-500">กำลังโหลด...</p> : lessons.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center text-gray-400">ยังไม่มีข้อมูล</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50">
              <tr>{['ชื่อบทเรียน', 'Topic', 'ภาษา', 'สถานะ', 'ข้อสอบ', 'อัปเดต', ''].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {lessons.map((lesson) => (
                <tr key={lesson.lesson_id} className="hover:bg-primary-50/30">
                  <td className="px-4 py-3"><div className="font-semibold text-gray-900">{lesson.title || lesson.title_en || lesson.lesson_id}</div><div className="font-mono text-xs text-gray-400">{lesson.lesson_id}</div></td>
                  <td className="px-4 py-3 text-xs font-mono text-gray-500">{lesson.topic ?? '-'}</td>
                  <td className="px-4 py-3">{lesson.language ?? 'TH'}</td>
                  <td className="px-4 py-3"><Badge>{lesson.status ?? '-'}</Badge></td>
                  <td className="px-4 py-3">{lesson.approved_test_count ?? 0}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{lesson.updated_at ? new Date(lesson.updated_at).toLocaleDateString('th-TH') : '-'}</td>
                  <td className="px-4 py-3"><Link href={`/admin/content/lesson/${lesson.lesson_id}`} className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white">แก้ไข</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">{children}</span>
}
