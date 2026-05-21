'use client'

import { useEffect, useMemo, useState } from 'react'
import { adminApi, type AdminTestRow } from '@/lib/api/admin'

export default function AdminTestsPage() {
  const [tests, setTests] = useState<AdminTestRow[]>([])
  const [grade, setGrade] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    adminApi.tests({ limit: 200 })
      .then((data) => {
        setTests(data.tests || [])
        setError('')
      })
      .catch((err) => setError(adminApi.errorMessage(err, 'โหลดข้อมูลแบบทดสอบไม่สำเร็จ')))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => tests.filter((test) => {
    if (grade && Number(test.grade) !== Number(grade)) return false
    if (search) {
      const q = search.toLowerCase()
      const text = [test.session_id, test.lesson_id, test.user?.email, test.child?.nickname, test.status].join(' ').toLowerCase()
      if (!text.includes(q)) return false
    }
    return true
  }), [tests, grade, search])

  return (
    <main className="mx-auto max-w-7xl space-y-5 px-6 py-8">
      <div>
        <h1 className="text-3xl font-extrabold text-gray-950">แบบทดสอบ</h1>
        <p className="text-sm text-gray-500">เซสชัน แบบทดสอบ และผลการทำข้อสอบจริง แยกจากคลังคำถาม</p>
      </div>
      {error && <pre className="whitespace-pre-wrap rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</pre>}
      <section className="grid gap-3 rounded-lg bg-white p-4 shadow-sm md:grid-cols-2">
        <select value={grade} onChange={(e) => setGrade(e.target.value)} className={inputClass}>
          <option value="">ทุกชั้น</option>
          {[1, 2, 3, 4, 5, 6].map((item) => <option key={item} value={item}>ป.{item}</option>)}
        </select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหา session / lesson / email" className={inputClass} />
      </section>

      {loading ? <p className="text-sm text-gray-500">กำลังโหลด...</p> : (
        <div className="overflow-hidden rounded-lg bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-bold uppercase text-gray-500">
                <tr>{['Session', 'นักเรียน', 'ผู้ใช้', 'บทเรียน', 'ชั้น', 'คะแนน', 'สถานะ', 'เริ่มเมื่อ'].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((test) => (
                  <tr key={test.session_id}>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{test.session_id}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{test.child?.nickname || '-'}</td>
                    <td className="px-4 py-3">{test.user?.email || '-'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{test.lesson_id || '-'}</td>
                    <td className="px-4 py-3">{test.grade ? `ป.${test.grade}` : '-'}</td>
                    <td className="px-4 py-3">{test.score ? `${test.score.correct_count}/${test.score.total_questions} (${Math.round(test.score.accuracy)}%)` : '-'}</td>
                    <td className="px-4 py-3"><Badge>{test.status || '-'}</Badge></td>
                    <td className="px-4 py-3">{fmt(test.started_at)}</td>
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

function fmt(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('th-TH', { dateStyle: 'medium' }) : '-'
}
