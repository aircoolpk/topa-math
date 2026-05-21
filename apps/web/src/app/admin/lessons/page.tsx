'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { approveLesson, getAdminLessons, rejectLesson, validateLesson, type AdminLessonRow } from '@/lib/api/admin-content'

const statuses = ['all', 'approved', 'needs_review', 'draft', 'rejected', 'archived']

export default function AdminLessonsPage() {
  const [lessons, setLessons] = useState<AdminLessonRow[]>([])
  const [grade, setGrade] = useState('')
  const [language, setLanguage] = useState('all')
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function load() {
    const data = await getAdminLessons({})
    setLessons(data || [])
  }

  useEffect(() => {
    load().catch(() => setError('โหลดบทเรียนไม่สำเร็จ'))
  }, [])

  const filtered = useMemo(() => lessons.filter((lesson) => {
    if (grade && lesson.grade_level !== Number(grade)) return false
    if (language !== 'all' && String(lesson.language || '').toUpperCase() !== language) return false
    if (status !== 'all' && lesson.status !== status) return false
    if (search) {
      const text = [lesson.lesson_id, lesson.title, lesson.title_th, lesson.title_en, lesson.topic].join(' ').toLowerCase()
      if (!text.includes(search.toLowerCase())) return false
    }
    return true
  }), [lessons, grade, language, status, search])

  const grouped = useMemo(() => {
    const result: Record<number, Record<string, AdminLessonRow[]>> = {}
    for (const lesson of filtered) {
      const g = lesson.grade_level || 0
      const lang = String(lesson.language || 'TH').toUpperCase()
      result[g] ||= {}
      result[g][lang] ||= []
      result[g][lang].push(lesson)
    }
    return result
  }, [filtered])

  async function runValidate(id: string) {
    const result = await validateLesson(id)
    setMessage(result.errors?.length ? `Validate: ${result.errors.length} errors` : 'Validate ผ่าน')
  }

  async function runApprove(id: string) {
    if (!window.confirm(`Approve ${id}?`)) return
    await approveLesson(id)
    setMessage(`Approved ${id}`)
    await load()
  }

  async function runReject(id: string) {
    const note = window.prompt('เหตุผลที่ไม่ผ่าน')
    if (!note) return
    await rejectLesson(id, note)
    setMessage(`Rejected ${id}`)
    await load()
  }

  return (
    <main className="mx-auto max-w-7xl space-y-5 px-6 py-8">
      <div>
        <h1 className="text-3xl font-extrabold text-gray-950">บทเรียน</h1>
        <p className="text-sm text-gray-500">บทเรียนจริงจาก content system จัดกลุ่มตามชั้นและภาษา</p>
      </div>
      {message && <Banner tone="success">{message}</Banner>}
      {error && <Banner tone="error">{error}</Banner>}
      <section className="grid gap-3 rounded-lg bg-white p-4 shadow-sm md:grid-cols-4">
        <select value={grade} onChange={(e) => setGrade(e.target.value)} className={inputClass}>
          <option value="">ทุกชั้น</option>
          {[1, 2, 3, 4, 5, 6].map((item) => <option key={item} value={item}>ป.{item}</option>)}
        </select>
        <select value={language} onChange={(e) => setLanguage(e.target.value)} className={inputClass}>
          <option value="all">ทุกภาษา</option>
          <option value="TH">TH</option>
          <option value="EP">EP</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
          {statuses.map((item) => <option key={item} value={item}>{item === 'all' ? 'ทุกสถานะ' : item}</option>)}
        </select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหา lesson/topic" className={inputClass} />
      </section>

      {[1, 2, 3, 4, 5, 6].map((g) => (
        <section key={g} className="space-y-3">
          <h2 className="text-xl font-extrabold text-gray-950">Grade {g}</h2>
          {['TH', 'EP'].map((lang) => (
            <div key={lang} className="rounded-lg bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-bold text-gray-500">{lang}</h3>
              <div className="space-y-2">
                {(grouped[g]?.[lang] || []).map((lesson) => (
                  <div key={lesson.lesson_id} className="grid gap-3 rounded-md border border-gray-100 p-3 text-sm md:grid-cols-[1fr_auto]">
                    <div>
                      <p className="font-bold text-gray-900">{lesson.title || lesson.title_th || lesson.lesson_id}</p>
                      <p className="font-mono text-xs text-gray-400">{lesson.lesson_id}</p>
                      <p className="text-xs text-gray-500">{lesson.topic || '-'} | {lesson.status} | issues: {lesson.issue_count ?? 0} | approved tests: {lesson.approved_test_count ?? 0}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link className={buttonClass} href={`/dashboard/lessons/${lesson.lesson_id}`}>preview</Link>
                      <Link className={buttonClass} href={`/admin/lessons/${lesson.lesson_id}?lang=${lang.toLowerCase()}`}>แก้ไข</Link>
                      <button className={buttonClass} onClick={() => runValidate(lesson.lesson_id)}>ตรวจสอบ</button>
                      <button className={buttonClass} onClick={() => runApprove(lesson.lesson_id)}>อนุมัติ</button>
                      <button className={buttonClass} onClick={() => runReject(lesson.lesson_id)}>ไม่ผ่าน</button>
                    </div>
                  </div>
                ))}
                {(grouped[g]?.[lang] || []).length === 0 && <p className="text-sm text-gray-400">ไม่มีบทเรียน</p>}
              </div>
            </div>
          ))}
        </section>
      ))}
    </main>
  )
}

const inputClass = 'rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400'
const buttonClass = 'rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50'

function Banner({ tone, children }: { tone: 'success' | 'error'; children: React.ReactNode }) {
  return <div className={`rounded-lg px-4 py-3 text-sm font-semibold ${tone === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{children}</div>
}
