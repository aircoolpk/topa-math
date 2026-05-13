'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { mockContentApi } from '@/lib/mock-content'
import type { AdminContentLesson } from '@/lib/api/admin'

// ─── Types ───────────────────────────────────────────────────────────────────

type FilterGrade = number | null
type FilterProgram = 'all' | 'TH' | 'EP'
type FilterStatus = 'all' | 'published' | 'needs_review' | 'draft'
type FilterIssue = 'all' | 'has_error' | 'ok'

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string | number
  sub?: string
  accent?: boolean
}) {
  return (
    <div
      className={`rounded-xl border px-5 py-4 shadow-sm ${
        accent ? 'border-amber-200 bg-amber-50' : 'border-gray-100 bg-white'
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold ${accent ? 'text-amber-700' : 'text-gray-950'}`}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; cls: string }> = {
  published: { label: 'เผยแพร่แล้ว', cls: 'bg-green-100 text-green-700' },
  needs_review: { label: 'ต้องตรวจสอบ', cls: 'bg-amber-100 text-amber-700' },
  draft: { label: 'ฉบับร่าง', cls: 'bg-gray-100 text-gray-600' },
}

// ─── Grade label ─────────────────────────────────────────────────────────────

const GRADE_LABEL: Record<number, string> = { 1: 'ป.1', 2: 'ป.2', 3: 'ป.3', 4: 'ป.4', 5: 'ป.5', 6: 'ป.6' }

// ─── Lesson Row ───────────────────────────────────────────────────────────────

function LessonRow({ lesson }: { lesson: AdminContentLesson }) {
  const status = STATUS_META[lesson.status ?? ''] ?? {
    label: lesson.status ?? '-',
    cls: 'bg-gray-100 text-gray-600',
  }

  return (
    <tr className="group border-b border-gray-50 hover:bg-primary-50/20 transition-colors">
      <td className="px-3 py-3">
        <span className="font-mono text-xs text-gray-400">{lesson.lesson_id}</span>
      </td>
      <td className="px-3 py-3">
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-600">
          {GRADE_LABEL[lesson.grade ?? 0] ?? lesson.grade}
        </span>
      </td>
      <td className="px-3 py-3 max-w-[200px]">
        <div className="font-semibold text-gray-900 truncate">{lesson.title || lesson.title_en || '—'}</div>
        {lesson.title_en && lesson.title && (
          <div className="text-xs text-gray-400 truncate">{lesson.title_en}</div>
        )}
      </td>
      <td className="px-3 py-3 text-center">
        <span className="text-sm text-gray-600">{lesson.topic ?? '-'}</span>
      </td>
      <td className="px-3 py-3 text-center">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status.cls}`}
        >
          {status.label}
        </span>
        {lesson.error_count ? (
          <span className="ml-1 inline-flex items-center rounded-full bg-red-50 px-1.5 py-0.5 text-xs font-semibold text-red-600">
            ✗ {lesson.error_count}
          </span>
        ) : null}
      </td>
      <td className="px-3 py-3 text-center text-sm">
        <div className="flex items-center justify-center gap-1">
          <span className={lesson.quiz_count ? 'text-gray-700 font-semibold' : 'text-gray-300'}>
            {lesson.quiz_count ?? 0}
          </span>
        </div>
      </td>
      <td className="px-3 py-3 text-xs text-gray-400 whitespace-nowrap">
        {lesson.updated_at
          ? new Date(lesson.updated_at).toLocaleDateString('th-TH', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })
          : '—'}
      </td>
      <td className="px-3 py-3">
        <Link
          href={`/admin/content/lesson/${lesson.lesson_id}`}
          className="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors"
        >
          แก้ไข
        </Link>
      </td>
    </tr>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ContentManagerPage() {
  const [allLessons, setAllLessons] = useState<AdminContentLesson[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [filterGrade, setFilterGrade] = useState<FilterGrade>(null)
  const [filterProgram, setFilterProgram] = useState<FilterProgram>('all')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [filterIssue, setFilterIssue] = useState<FilterIssue>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    // Load all grades in parallel
    Promise.all([1, 2, 3, 4, 5, 6].map((g) => mockContentApi.getLessonsByGrade(g)))
      .then((results) => {
        setAllLessons(results.flat())
        setLoading(false)
      })
  }, [])

  const filtered = useMemo(() => {
    return allLessons.filter((l) => {
      if (filterGrade != null && l.grade !== filterGrade) return false
      if (filterProgram !== 'all' && l.program_type !== filterProgram) return false
      if (filterStatus !== 'all' && l.status !== filterStatus) return false
      if (filterIssue === 'has_error' && (l.error_count ?? 0) === 0) return false
      if (filterIssue === 'ok' && (l.error_count ?? 0) > 0) return false
      if (search) {
        const s = search.toLowerCase()
        if (
          !(l.title ?? '').toLowerCase().includes(s) &&
          !(l.title_en ?? '').toLowerCase().includes(s) &&
          !(l.lesson_id ?? '').toLowerCase().includes(s)
        )
          return false
      }
      return true
    })
  }, [allLessons, filterGrade, filterProgram, filterStatus, filterIssue, search])

  const stats = useMemo(() => {
    const total = allLessons.length
    const invalid = allLessons.filter((l) => (l.error_count ?? 0) > 0).length
    const totalQuestions = allLessons.reduce((acc, l) => acc + (l.quiz_count ?? 0), 0)
    const thCount = allLessons.filter((l) => l.program_type === 'THP' || l.program_type === 'TH').length
    const epCount = allLessons.filter((l) => l.program_type === 'EP').length
    return { total, invalid, totalQuestions, thCount, epCount }
  }, [allLessons])

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-gray-950">Content Manager</h1>
        <p className="mt-1 text-sm text-gray-500">
          ตรวจสอบและแก้ไขบทเรียนทั้งหมด — กดไปที่ชั้นหรือใช้ตัวกรองด้านล่าง
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="บทเรียนทั้งหมด" value={stats.total} sub="ป.1–ป.6" />
        <StatCard
          label="มีปัญหา"
          value={stats.invalid}
          sub="ต้องแก้ไข"
          accent={stats.invalid > 0}
        />
        <StatCard
          label="ข้อสอบทั้งหมด"
          value={stats.totalQuestions.toLocaleString()}
          sub="ในทุกบทเรียน"
        />
        <StatCard label="TH Lessons" value={stats.thCount} sub="Thai Program" />
        <StatCard label="EP Lessons" value={stats.epCount} sub="English Program" />
      </div>

      {/* Grade quick-nav */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterGrade(null)}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
            filterGrade === null
              ? 'bg-primary-600 text-white shadow-sm'
              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          ทุกชั้น
        </button>
        {[1, 2, 3, 4, 5, 6].map((g) => (
          <button
            key={g}
            onClick={() => setFilterGrade(filterGrade === g ? null : g)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              filterGrade === g
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            ป.{g}
          </button>
        ))}
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-400">โปรแกรม:</span>
          {(['all', 'TH', 'EP'] as FilterProgram[]).map((p) => (
            <button
              key={p}
              onClick={() => setFilterProgram(p)}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                filterProgram === p
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {p === 'all' ? 'ทั้งหมด' : p}
            </button>
          ))}
        </div>
        <div className="h-5 border-l border-gray-200" />
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-400">สถานะ:</span>
          {(['all', 'published', 'needs_review', 'draft'] as FilterStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                filterStatus === s
                  ? s === 'published'
                    ? 'bg-green-600 text-white'
                    : s === 'needs_review'
                    ? 'bg-amber-600 text-white'
                    : 'bg-gray-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s === 'all' ? 'ทั้งหมด' : STATUS_META[s]?.label ?? s}
            </button>
          ))}
        </div>
        <div className="h-5 border-l border-gray-200" />
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-400">ปัญหา:</span>
          {([['all', 'ทั้งหมด'], ['has_error', 'มีปัญหา'], ['ok', 'ปกติ']] as const).map(
            ([val, label]) => (
              <button
                key={val}
                onClick={() => setFilterIssue(val as FilterIssue)}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                  filterIssue === val
                    ? val === 'has_error'
                      ? 'bg-red-600 text-white'
                      : 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ),
          )}
        </div>
        <div className="ml-auto">
          <input
            type="search"
            placeholder="🔍 ค้นหาชื่อบทเรียน..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-52 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <span className="text-gray-400">กำลังโหลด...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center">
          <p className="text-gray-400">
            {allLessons.length === 0
              ? 'ยังไม่มีบทเรียน'
              : 'ไม่พบบทเรียนตามตัวกรองที่เลือก'}
          </p>
          {allLessons.length > 0 && (
            <button
              onClick={() => {
                setFilterGrade(null)
                setFilterProgram('all')
                setFilterStatus('all')
                setFilterIssue('all')
                setSearch('')
              }}
              className="mt-3 text-sm text-primary-600 hover:underline"
            >
              ล้างตัวกรอง
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <p className="text-sm text-gray-500">
              แสดง <span className="font-semibold text-gray-700">{filtered.length}</span> จาก{' '}
              <span className="font-semibold text-gray-700">{allLessons.length}</span> บทเรียน
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-50 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['ID', 'ชั้น', 'ชื่อบทเรียน', 'Topic', 'สถานะ', 'ข้อสอบ', 'อัปเดต'].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
                      >
                        {h}
                      </th>
                    ),
                  )}
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((lesson) => (
                  <LessonRow key={lesson.lesson_id} lesson={lesson} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick grade links */}
      {!loading && allLessons.length > 0 && (
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
            ไปยังชั้นเรียนโดยตรง
          </p>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6].map((g) => {
              const count = allLessons.filter((l) => l.grade === g).length
              return (
                <Link
                  key={g}
                  href={`/admin/content/grade/${g}`}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-primary-50 hover:border-primary-300 transition-colors"
                >
                  <span className="text-lg font-extrabold text-primary-600">ป.{g}</span>
                  <span className="text-xs text-gray-400">{count} บท</span>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </main>
  )
}