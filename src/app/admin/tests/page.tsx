'use client'

import { useEffect, useMemo, useState } from 'react'
import { adminApi, type AdminTestRow } from '@/lib/api/admin'

export default function AdminTestsPage() {
  const [tests, setTests] = useState<AdminTestRow[]>([])
  const [grade, setGrade] = useState('')
  const [language, setLanguage] = useState<'TH' | 'EP'>('TH')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    adminApi.tests({ limit: 500, language })
      .then((data) => {
        setTests(data.tests || [])
        setError('')
      })
      .catch((err) => setError(adminApi.errorMessage(err, 'โหลดข้อมูลแบบทดสอบไม่สำเร็จ')))
      .finally(() => setLoading(false))
  }, [language])

  const filtered = useMemo(() => tests.filter((test) => {
    const testGrade = test.grade_level ?? test.grade
    if (grade && Number(testGrade) !== Number(grade)) return false
    if (search) {
      const q = search.toLowerCase()
      const text = [test.question_id, test.test_id, test.lesson_id, test.question, test.status].join(' ').toLowerCase()
      if (!text.includes(q)) return false
    }
    return true
  }), [tests, grade, search])

  return (
    <main className="mx-auto max-w-7xl space-y-5 px-6 py-8">
      <div>
        <h1 className="text-3xl font-extrabold text-gray-950">แบบทดสอบ</h1>
        <p className="text-sm text-gray-500">คลังแบบทดสอบ canonical ที่นักเรียนใช้จริง แยกตาม TH / EP</p>
      </div>

      {error && <pre className="whitespace-pre-wrap rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</pre>}

      <section className="grid gap-3 rounded-lg bg-white p-4 shadow-sm md:grid-cols-3">
        <select value={language} onChange={(e) => setLanguage(e.target.value as 'TH' | 'EP')} className={inputClass}>
          <option value="TH">TH</option>
          <option value="EP">EP</option>
        </select>
        <select value={grade} onChange={(e) => setGrade(e.target.value)} className={inputClass}>
          <option value="">ทุกชั้น</option>
          {[1, 2, 3, 4, 5, 6].map((item) => <option key={item} value={item}>ป.{item}</option>)}
        </select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหา question / lesson" className={inputClass} />
      </section>

      {loading ? <p className="text-sm text-gray-500">กำลังโหลด...</p> : (
        <div className="overflow-hidden rounded-lg bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-bold uppercase text-gray-500">
                <tr>{['Question', 'Program', 'Lesson', 'Base', 'ชั้น', 'โจทย์', 'คำตอบ', 'สถานะ'].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((test) => (
                  <tr key={test.question_id || test.test_id || test.id}>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{test.question_id || test.test_id || '-'}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{test.program || test.language || language}</td>
                    <td className="px-4 py-3 font-mono text-xs">{test.lesson_id || '-'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{test.base_lesson_id || '-'}</td>
                    <td className="px-4 py-3">{test.grade_level || test.grade ? `ป.${test.grade_level ?? test.grade}` : '-'}</td>
                    <td className="max-w-md truncate px-4 py-3">{test.question || '-'}</td>
                    <td className="px-4 py-3 font-semibold">{test.correct_answer || '-'}</td>
                    <td className="px-4 py-3"><Badge>{test.status || '-'}</Badge></td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">ยังไม่มีข้อมูล</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  )
}

const inputClass = 'rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-primary-400'

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">{children}</span>
}
