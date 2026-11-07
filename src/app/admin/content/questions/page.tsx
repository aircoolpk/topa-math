'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { getAdminTests, approveTest, rejectTest, updateAdminTest, type AdminTestRow } from '@/lib/api/admin-content'
import { adminApi } from '@/lib/api/admin'

// ─── Validation helpers ─────────────────────────────────────────────────────

interface QValidation {
  hasWarning: boolean
  hasError: boolean
  errors: string[]
}

function validateQuestion(q: AdminTestRow): QValidation {
  const errors: string[] = []
  const choiceStr = q.question ?? ''
  if (!q.question_th && !q.question) errors.push('คำถามว่างเปล่า')

  const warnings: string[] = []
  return {
    hasWarning: warnings.length > 0,
    hasError: errors.length > 0,
    errors: [...errors, ...warnings],
  }
}

function getQuestionText(q: AdminTestRow): string {
  return q.question_th || q.question || '(ไม่มีคำถาม)'
}

// ─── Danger badge ─────────────────────────────────────────────────────────────

function DangerBadge({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">
      ⚠️ {text}
    </span>
  )
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; cls: string }> = {
  approved:    { label: 'เผยแพร่แล้ว', cls: 'bg-green-100 text-green-700' },
  needs_review: { label: 'ต้องตรวจสอบ', cls: 'bg-amber-100 text-amber-700' },
  draft:       { label: 'ฉบับร่าง', cls: 'bg-gray-100 text-gray-600' },
  rejected:    { label: 'ไม่ผ่าน', cls: 'bg-red-100 text-red-600' },
  archived:    { label: 'เก็บแล้ว', cls: 'bg-gray-100 text-gray-400' },
}

// ─── Test Row ─────────────────────────────────────────────────────────────────

function TestRow({
  q,
}: {
  q: AdminTestRow
}) {
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [edit, setEdit] = useState<AdminTestRow>(q)
  const [showApprove, setShowApprove] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [rejectNote, setRejectNote] = useState('')

  const validation = validateQuestion(q)
  const validationEdit = validateQuestion(edit)

  const statusMeta = STATUS_META[q.status ?? ''] ?? { label: q.status ?? '-', cls: 'bg-gray-100 text-gray-600' }
  const canApprove = q.status === 'needs_review' || q.status === 'draft'

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateAdminTest(q.question_id, {
        question: edit.question,
        question_th: edit.question_th,
        difficulty: edit.difficulty,
        skill_tag: edit.skill_tag,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      console.error('Save failed:', e)
    } finally {
      setSaving(false)
    }
  }

  const handleApprove = async () => {
    setSaving(true)
    try {
      await approveTest(q.question_id)
      setEdit({ ...edit, status: 'approved' })
      setShowApprove(false)
    } catch (e) {
      console.error('Approve failed:', e)
    } finally {
      setSaving(false)
    }
  }

  const handleReject = async () => {
    if (!rejectNote.trim()) return
    setSaving(true)
    try {
      await rejectTest(q.question_id, rejectNote)
      setEdit({ ...edit, status: 'rejected' })
      setShowReject(false)
    } catch (e) {
      console.error('Reject failed:', e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className={`rounded-xl border transition-colors ${
        validation.hasError
          ? 'border-red-200 bg-red-50/30'
          : validation.hasWarning
          ? 'border-amber-200 bg-amber-50/30'
          : 'border-gray-100 bg-white'
      }`}
    >
      {/* Row header */}
      <button
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-mono text-gray-500">
            {q.lesson_id}
          </span>
          {q.grade_level && (
            <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-600">
              ป.{q.grade_level}
            </span>
          )}
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusMeta.cls}`}>
            {statusMeta.label}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            q.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
            q.difficulty === 'hard' ? 'bg-red-100 text-red-700' :
            'bg-amber-100 text-amber-700'
          }`}>
            {q.difficulty ?? 'medium'}
          </span>
          <span className="truncate text-sm font-medium text-gray-800">
            {getQuestionText(q)}
          </span>
          {q.skill_tag && (
            <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
              {q.skill_tag}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {validation.hasError && <DangerBadge text="ข้อผิดพลาด" />}
          {validation.hasWarning && !validation.hasError && (
            <span className="text-xs text-amber-600">⚠️ คำเตือน</span>
          )}
          {!validation.hasError && !validation.hasWarning && (
            <span className="text-xs text-green-600">✅ ปกติ</span>
          )}
          <span className="text-xs text-gray-400">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* Expanded editor */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                คำถาม (TH)
              </label>
              <textarea
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                rows={2}
                value={edit.question_th ?? ''}
                onChange={(e) => setEdit({ ...edit, question_th: e.target.value })}
                placeholder="คำถามภาษาไทย..."
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                คำถาม (EN)
              </label>
              <textarea
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                rows={2}
                value={edit.question ?? ''}
                onChange={(e) => setEdit({ ...edit, question: e.target.value })}
                placeholder="Question in English..."
              />
            </div>
          </div>

          {/* Difficulty + Skill tag */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                ระดับความยาก
              </label>
              <select
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                value={edit.difficulty ?? 'medium'}
                onChange={(e) => setEdit({ ...edit, difficulty: e.target.value })}
              >
                <option value="easy">ง่าย</option>
                <option value="medium">กลาง</option>
                <option value="hard">ยาก</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Skill Tag
              </label>
              <input
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                value={edit.skill_tag ?? ''}
                onChange={(e) => setEdit({ ...edit, skill_tag: e.target.value })}
                placeholder="เช่น addition_20"
              />
            </div>
          </div>

          {/* Live validation warnings */}
          {validationEdit.errors.length > 0 && (
            <div className="rounded-lg bg-red-50 p-3 text-xs text-red-600">
              <p className="font-semibold mb-1">ปัญหาที่พบ:</p>
              <ul className="ml-4 list-disc space-y-0.5">
                {validationEdit.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1">
            <button
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold shadow-sm transition-colors ${
                saved
                  ? 'bg-green-500 text-white'
                  : 'bg-primary-600 text-white hover:bg-primary-700'
              } disabled:opacity-50`}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? '⏳ กำลังบันทึก...' : saved ? '✅ บันทึกแล้ว' : '💾 บันทึก'}
            </button>
            <button
              className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              onClick={() => setEdit(q)}
            >
              ยกเลิก
            </button>

            {canApprove && (
              <>
                <button
                  className="rounded-lg border border-green-200 px-3 py-1.5 text-xs font-semibold text-green-600 hover:bg-green-50 transition-colors"
                  onClick={() => setShowApprove(true)}
                >
                  ✓ อนุมัติ
                </button>
                <button
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                  onClick={() => setShowReject(true)}
                >
                  ✗ ไม่ผ่าน
                </button>
              </>
            )}

            <Link
              href={`/admin/content/lesson/${q.lesson_id}`}
              className="ml-auto rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
            >
              ไปที่บทเรียน →
            </Link>
          </div>
        </div>
      )}

      {/* Approve confirmation */}
      {showApprove && (
        <div className="border-t border-gray-100 px-4 py-4 bg-green-50/50">
          <p className="text-sm font-semibold text-green-700 mb-2">ยืนยันการอนุมัติข้อสอบนี้?</p>
          <div className="flex gap-2">
            <button
              className="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              onClick={handleApprove}
              disabled={saving}
            >
              {saving ? 'กำลังบันทึก...' : '✓ อนุมัติ'}
            </button>
            <button
              className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
              onClick={() => setShowApprove(false)}
            >
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      {/* Reject confirmation */}
      {showReject && (
        <div className="border-t border-gray-100 px-4 py-4 bg-red-50/50 space-y-3">
          <p className="text-sm font-semibold text-red-700">ระบุเหตุผลที่ไม่ผ่านการตรวจสอบ</p>
          <textarea
            className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm"
            rows={2}
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="เช่น คำถามไม่ชัดเจน, คำตอบผิด..."
          />
          <div className="flex gap-2">
            <button
              className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              onClick={handleReject}
              disabled={saving || !rejectNote.trim()}
            >
              {saving ? 'กำลังบันทึก...' : '✗ ยืนยันไม่ผ่าน'}
            </button>
            <button
              className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
              onClick={() => setShowReject(false)}
            >
              ยกเลิก
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function QuestionBankPage() {
  const [tests, setTests] = useState<AdminTestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [filterGrade, setFilterGrade] = useState<number | null>(null)
  const [filterStatus, setFilterStatus] = useState<'all' | 'approved' | 'needs_review' | 'draft' | 'rejected'>('all')
  const [filterDifficulty, setFilterDifficulty] = useState<'all' | 'easy' | 'medium' | 'hard'>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const params = {
      grade: filterGrade ?? undefined,
      status: filterStatus === 'all' ? undefined : filterStatus,
      difficulty: filterDifficulty === 'all' ? undefined : filterDifficulty,
    }
    setLoading(true)
    setError(null)
    getAdminTests(params)
      .then((data) => {
        setTests(data)
        setLoading(false)
      })
      .catch((e) => {
        console.error('Failed to load tests:', { endpoint: '/admin/questions', params, error: e })
        setError(adminApi.errorMessage(e, 'โหลดคลังคำถามไม่สำเร็จ'))
        setLoading(false)
      })
  }, [filterGrade, filterStatus, filterDifficulty])

  const filtered = useMemo(() => {
    return tests.filter((q) => {
      if (filterGrade != null && Number(q.grade_level) !== filterGrade) return false
      if (filterStatus !== 'all' && q.status !== filterStatus) return false
      if (filterDifficulty !== 'all' && q.difficulty !== filterDifficulty) return false
      if (search) {
        const s = search.toLowerCase()
        if (
          !(q.question_th ?? '').toLowerCase().includes(s) &&
          !(q.question ?? '').toLowerCase().includes(s) &&
          !(q.lesson_id ?? '').toLowerCase().includes(s)
        )
          return false
      }
      return true
    })
  }, [tests, filterGrade, filterStatus, filterDifficulty, search])

  const stats = useMemo(() => {
    const total = tests.length
    const hasError = tests.filter((q) => validateQuestion(q).hasError).length
    const needsReview = tests.filter((q) => q.status === 'needs_review' || q.status === 'draft').length
    return { total, hasError, needsReview }
  }, [tests])

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/content"
              className="text-sm text-gray-400 hover:text-primary-600 transition-colors"
            >
              ← Content
            </Link>
            <span className="text-gray-300">|</span>
            <h1 className="text-2xl font-extrabold text-gray-950">Question Bank</h1>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            ตรวจสอบและแก้ไขข้อสอบทั้งหมด — ดูจากทุกบทเรียน
          </p>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-100 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">ข้อสอบทั้งหมด</p>
          <p className="mt-1 text-2xl font-extrabold text-gray-950">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-400">ต้องตรวจสอบ</p>
          <p className="mt-1 text-2xl font-extrabold text-amber-700">{stats.needsReview}</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-400">มีข้อผิดพลาด</p>
          <p className="mt-1 text-2xl font-extrabold text-red-700">{stats.hasError}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-400">ชั้น:</span>
          <button
            onClick={() => setFilterGrade(null)}
            className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
              filterGrade === null ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            ทั้งหมด
          </button>
          {[1, 2, 3, 4, 5, 6].map((g) => (
            <button
              key={g}
              onClick={() => setFilterGrade(filterGrade === g ? null : g)}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                filterGrade === g ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              ป.{g}
            </button>
          ))}
        </div>

        <div className="h-5 border-l border-gray-200" />

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-400">สถานะ:</span>
          {(['all', 'approved', 'needs_review', 'draft', 'rejected'] as const).map(
            (val) => (
              <button
                key={val}
                onClick={() => setFilterStatus(val as typeof filterStatus)}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                  filterStatus === val
                    ? val === 'approved'
                      ? 'bg-green-600 text-white'
                      : val === 'needs_review'
                      ? 'bg-amber-600 text-white'
                      : val === 'rejected'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {val === 'all' ? 'ทั้งหมด' : STATUS_META[val]?.label ?? val}
              </button>
            ),
          )}
        </div>

        <div className="h-5 border-l border-gray-200" />

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-400">ความยาก:</span>
          {(['all', 'easy', 'medium', 'hard'] as const).map((d) => (
            <button
              key={d}
              onClick={() => setFilterDifficulty(d as typeof filterDifficulty)}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                filterDifficulty === d
                  ? d === 'easy'
                    ? 'bg-green-600 text-white'
                    : d === 'hard'
                    ? 'bg-red-600 text-white'
                    : 'bg-amber-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {d === 'all' ? 'ทั้งหมด' : d === 'medium' ? 'กลาง' : d === 'easy' ? 'ง่าย' : 'ยาก'}
            </button>
          ))}
        </div>

        <div className="ml-auto">
          <input
            type="search"
            placeholder="🔍 ค้นหาคำถาม..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-52 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </div>
      </div>

      {/* Question list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <span className="text-gray-400">กำลังโหลดข้อสอบ...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center">
          <p className="text-gray-400">
            {tests.length === 0 ? 'ยังไม่มีข้อสอบ' : 'ไม่พบข้อสอบตามตัวกรอง'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-gray-500">
            แสดง <span className="font-semibold text-gray-700">{filtered.length}</span> ข้อจาก{' '}
            <span className="font-semibold text-gray-700">{tests.length}</span> ข้อ
          </p>
          {filtered.map((q) => (
            <TestRow key={q.question_id} q={q} />
          ))}
        </div>
      )}
    </main>
  )
}
