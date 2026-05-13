'use client'

import { useEffect, useMemo, useState } from 'react'
import { adminApi, type AdminLessonRow } from '@/lib/api/admin'

export default function AdminLessonsPage() {
  const [lessons, setLessons] = useState<AdminLessonRow[]>([])
  const [mock, setMock] = useState(false)
  const problemLessons = useMemo(() => lessons.filter((lesson) => (lesson.validation_errors?.length || 0) > 0 || lesson.published_status !== 'approved'), [lessons])

  useEffect(() => {
    adminApi.lessons().then((data) => setLessons(data.lessons || [])).catch(() => { setMock(true); setLessons([]) })
  }, [])

  return (
    <main className="mx-auto max-w-7xl space-y-5 px-6 py-8">
      <div>
        <h1 className="text-3xl font-extrabold text-gray-950">Lessons</h1>
        <p className="text-sm text-gray-500">Publishing status, quiz count, completeness, and validation errors.</p>
        {mock && <p className="mt-2 text-sm font-semibold text-amber-700">Mock fallback active</p>}
      </div>
      <section className="grid gap-4 sm:grid-cols-3">
        <Metric label="Lessons" value={lessons.length} />
        <Metric label="Needs review" value={problemLessons.length} />
        <Metric label="Average completeness" value={`${Math.round((lessons.reduce((sum, l) => sum + (l.completeness_score || 0), 0) / Math.max(lessons.length, 1)))}%`} />
      </section>
      <div className="overflow-hidden rounded-lg bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-bold uppercase text-gray-500"><tr>{['Lesson', 'Grade', 'Subject', 'Topic', 'Program', 'Status', 'Score', 'Questions', 'Errors', 'Updated'].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {lessons.map((lesson) => (
                <tr key={lesson.lesson_id}>
                  <td className="px-4 py-3"><p className="font-semibold text-gray-900">{lesson.title_th || lesson.title || lesson.lesson_id}</p><p className="font-mono text-xs text-gray-400">{lesson.lesson_id}</p></td>
                  <td className="px-4 py-3">{lesson.grade ?? '-'}</td>
                  <td className="px-4 py-3">{lesson.subject || 'math'}</td>
                  <td className="px-4 py-3">{lesson.topic || '-'}</td>
                  <td className="px-4 py-3">{lesson.program_type || 'THP'}</td>
                  <td className="px-4 py-3">{lesson.published_status || lesson.status || 'draft'}</td>
                  <td className="px-4 py-3">{lesson.completeness_score ?? 0}%</td>
                  <td className="px-4 py-3">{lesson.quiz_questions_count ?? '-'}</td>
                  <td className="px-4 py-3">{lesson.validation_errors?.length || 0}</td>
                  <td className="px-4 py-3">{fmt(lesson.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-gray-500">{label}</p><p className="mt-1 text-3xl font-extrabold text-gray-950">{value}</p></div>
}

function fmt(value?: string | null) {
  return value ? new Date(value).toLocaleDateString() : '-'
}
