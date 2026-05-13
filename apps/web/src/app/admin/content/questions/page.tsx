'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import type { AdminContentQuestion } from '@/lib/api/admin'
import { mockContentApi } from '@/lib/mock-content'

// ─── Validation helpers ───────────────────────────────────────────────────────

interface QValidation {
  hasWarning: boolean
  hasError: boolean
  errors: string[]
}

function validateQuestion(q: AdminContentQuestion): QValidation {
  const errors: string[] = []
  const choices = q.choices ?? { A: '', B: '', C: '', D: '' }
  const choiceVals = Object.values(choices).map((v) => String(v).trim())
  const filledChoices = choiceVals.filter((v) => v.length > 0)

  if (!q.question_th && !q.question) errors.push('คำถามว่างเปล่า')
  if (filledChoices.length < 2) errors.push('ตัวเลือกไม่ครบ 4 ข้อ')
  if (filledChoices.length > 0) {
    const uniqueChoices = new Set(filledChoices)
    if (uniqueChoices.size < filledChoices.length) errors.push('มีตัวเลือกซ้ำกัน')
  }
  if (q.correct_answer && !choices[q.correct_answer as keyof typeof choices]?.trim()) {
    errors.push('คำตอบที่ถูกต้องไม่อยู่ในตัวเลือก')
  }

  const warnings: string[] = []
  if (!q.explanation_th) warnings.push('ไม่มีคำอธิบาย (TH)')
  if (!q.explanation) warnings.push('ไม่มีคำอธิบาย (EN)')

  return {
    hasWarning: warnings.length > 0,
    hasError: errors.length > 0,
    errors: [...errors, ...warnings],
  }
}

function getQuestionText(q: AdminContentQuestion): string {
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

// ─── Question Row ─────────────────────────────────────────────────────────────

function QuestionRow({
  q,
  onSave,
}: {
  q: AdminContentQuestion
  onSave: (updated: AdminContentQuestion) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [edit, setEdit] = useState<AdminContentQuestion>(q)

  const validation = validateQuestion(q)
  const validationEdit = validateQuestion(edit)

  const choices = edit.choices ?? { A: '', B: '', C: '', D: '' }

  const handleSave = async () => {
    setSaving(true)
    try {
      await mockContentApi.saveQuestion(q.lesson_id, edit)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const setChoice = (key: string, val: string) => {
    setEdit({ ...edit, choices: { ...choices, [key]: val } })
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

          {/* Choices */}
          <div>
            <label className="mb-2 block text-xs font-semibold text-gray-500 uppercase tracking-wide">
              ตัวเลือก
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                const val = choices[opt] ?? ''
                const isCorrect = edit.correct_answer === opt
                return (
                  <div key={opt} className="flex items-center gap-2">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                        isCorrect
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {opt}
                    </span>
                    <input
                      className={`flex-1 rounded-lg border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-100 ${
                        isCorrect ? 'border-green-300 bg-green-50' : 'border-gray-200'
                      }`}
                      value={val}
                      onChange={(e) => setChoice(opt, e.target.value)}
                      placeholder={`ตัวเลือก ${opt}`}
                    />
                  </div>
                )
              })}
            </div>
          </div>

          {/* Correct answer + difficulty */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                คำตอบที่ถูกต้อง
              </label>
              <select
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                value={edit.correct_answer ?? 'A'}
                onChange={(e) => setEdit({ ...edit, correct_answer: e.target.value })}
              >
                {(['A', 'B', 'C', 'D'] as const).map((o) => (
                  <option key={o} value={o}>
                    {o} — {choices[o] || '(ว่าง)'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                ระดับความยาก
              </label>
              <select
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                value={edit.difficulty ?? 'medium'}
                onChange={(e) =>
                  setEdit({ ...edit, difficulty: e.target.value as 'easy' | 'medium' | 'hard' })
                }
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

          {/* Explanations */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                คำอธิบาย (TH)
              </label>
              <textarea
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                rows={2}
                value={edit.explanation_th ?? ''}
                onChange={(e) => setEdit({ ...edit, explanation_th: e.target.value })}
                placeholder="คำอธิบายเฉลยภาษาไทย..."
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                คำอธิบาย (EN)
              </label>
              <textarea
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                rows={2}
                value={edit.explanation ?? ''}
                onChange={(e) => setEdit({ ...edit, explanation: e.target.value })}
                placeholder="Explanation in English..."
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
            <Link
              href={`/admin/content/lesson/${q.lesson_id}`}
              className="ml-auto rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
            >
              ไปที่บทเรียน →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function QuestionBankPage() {
  const [questions, setQuestions] = useState<AdminContentQuestion[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [filterGrade, setFilterGrade] = useState<number | null>(null)
  const [filterIssue, setFilterIssue] = useState<'all' | 'error' | 'warning' | 'ok'>('all')
  const [filterDifficulty, setFilterDifficulty] = useState<'all' | 'easy' | 'medium' | 'hard'>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    mockContentApi.getQuestions().then((data) => {
      setQuestions(data)
      setLoading(false)
    })
  }, [])

  const filtered = useMemo(() => {
    return questions.filter((q) => {
      if (filterGrade != null) {
        const lessonNum = q.lesson_id.match(/\d+/)?.[0]
        if (!lessonNum || parseInt(lessonNum) !== filterGrade) return false
      }
      const v = validateQuestion(q)
      if (filterIssue === 'error' && !v.hasError) return false
      if (filterIssue === 'warning' && !v.hasWarning && !v.hasError) return false
      if (filterIssue === 'ok' && (v.hasError || v.hasWarning)) return false
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
  }, [questions, filterGrade, filterIssue, filterDifficulty, search])

  const stats = useMemo(() => {
    const total = questions.length
    const hasError = questions.filter((q) => validateQuestion(q).hasError).length
    const hasWarning = questions.filter((q) => {
      const v = validateQuestion(q)
      return q.difficulty === 'hard' || (!v.hasError && v.hasWarning)
    }).length
    return { total, hasError, hasWarning }
  }, [questions])

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

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-100 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">ข้อสอบทั้งหมด</p>
          <p className="mt-1 text-2xl font-extrabold text-gray-950">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-400">มีข้อผิดพลาด</p>
          <p className="mt-1 text-2xl font-extrabold text-red-700">{stats.hasError}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-400">มีคำเตือน</p>
          <p className="mt-1 text-2xl font-extrabold text-amber-700">{stats.hasWarning}</p>
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
          {([['all', 'ทั้งหมด'], ['error', 'มีข้อผิดพลาด'], ['warning', 'คำเตือน'], ['ok', 'ปกติ']] as const).map(
            ([val, label]) => (
              <button
                key={val}
                onClick={() => setFilterIssue(val as typeof filterIssue)}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                  filterIssue === val
                    ? val === 'error'
                      ? 'bg-red-600 text-white'
                      : val === 'warning'
                      ? 'bg-amber-600 text-white'
                      : val === 'ok'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {label}
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
            {questions.length === 0 ? 'ยังไม่มีข้อสอบ' : 'ไม่พบข้อสอบตามตัวกรอง'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-gray-500">
            แสดง <span className="font-semibold text-gray-700">{filtered.length}</span> ข้อจาก{' '}
            <span className="font-semibold text-gray-700">{questions.length}</span> ข้อ
          </p>
          {filtered.map((q) => (
            <QuestionRow key={q.question_id} q={q} onSave={() => {}} />
          ))}
        </div>
      )}
    </main>
  )
}