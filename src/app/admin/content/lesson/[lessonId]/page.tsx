'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  getAdminLesson,
  updateAdminLesson,
  approveLesson,
  rejectLesson,
  validateLesson,
  type AdminLessonDetail,
  type ValidationResult,
} from '@/lib/api/admin-content'

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',    label: 'Overview' },
  { id: 'thp',         label: 'THP Content' },
  { id: 'ep',          label: 'EP Content' },
  { id: 'diagram',     label: 'Singapore Math' },
  { id: 'quiz',        label: 'Exercises / Quiz' },
  { id: 'validation',  label: 'Validation' },
  { id: 'preview',     label: 'Preview' },
] as const
type TabId = typeof TABS[number]['id']

// ─── Status options ────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: 'draft',        label: 'ฉบับร่าง (Draft)' },
  { value: 'needs_review', label: 'ต้องตรวจสอบ (Needs Review)' },
  { value: 'approved',     label: 'อนุมัติแล้ว (Approved)' },
  { value: 'published',    label: 'เผยแพร่แล้ว (Published)' },
]

const STATUS_META: Record<string, { label: string; cls: string }> = {
  approved:    { label: 'เผยแพร่แล้ว', cls: 'bg-green-100 text-green-700' },
  needs_review: { label: 'ต้องตรวจสอบ', cls: 'bg-amber-100 text-amber-700' },
  draft:       { label: 'ฉบับร่าง', cls: 'bg-gray-100 text-gray-600' },
  rejected:    { label: 'ไม่ผ่าน', cls: 'bg-red-100 text-red-600' },
  archived:    { label: 'เก็บแล้ว', cls: 'bg-gray-100 text-gray-400' },
  published:   { label: 'เผยแพร่แล้ว', cls: 'bg-green-100 text-green-700' },
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

// ─── Shared UI primitives ─────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</label>
      {children}
    </div>
  )
}

const FI = `w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800
  placeholder-gray-300 shadow-sm focus:border-primary-400 focus:outline-none
  focus:ring-2 focus:ring-primary-100 transition-colors`

// ─── Overview Tab ──────────────────────────────────────────────────────────────

function TabOverview({
  lesson, onChange,
}: { lesson: AdminLessonDetail; onChange: (l: AdminLessonDetail) => void }) {
  const set = (f: Partial<AdminLessonDetail>) => onChange({ ...lesson, ...f })
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <Field label="ชื่อบทเรียน (TH)">
          <input className={FI} value={lesson.title ?? ''} onChange={(e) => set({ title: e.target.value })} />
        </Field>
        <Field label="ชื่อบทเรียน (EN)">
          <input className={FI} value={lesson.title_en ?? ''} onChange={(e) => set({ title_en: e.target.value })} />
        </Field>
        <Field label="ชั้น (Grade)">
          <input type="number" className={FI} value={lesson.grade_level ?? ''} min={1} max={6}
            onChange={(e) => set({ grade_level: Number(e.target.value) })} />
        </Field>
        <Field label="Topic">
          <input className={FI} value={lesson.topic ?? ''} onChange={(e) => set({ topic: e.target.value })} />
        </Field>
      </div>
      <Field label="Status">
        <select className={FI} value={lesson.status ?? 'draft'}
          onChange={(e) => set({ status: e.target.value })}>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </Field>
    </div>
  )
}

// ─── THP Content Tab ──────────────────────────────────────────────────────────

function TabTHP({
  lesson, onChange,
}: { lesson: AdminLessonDetail; onChange: (l: AdminLessonDetail) => void }) {
  const content = (lesson.content ?? {}) as Record<string, unknown>
  const thp = (content['thp'] ?? content) as Record<string, unknown>
  const set = (f: Record<string, unknown>) =>
    onChange({ ...lesson, content: { ...(lesson.content ?? {}), ...f } } as AdminLessonDetail)

  return (
    <div className="space-y-6">
      <Field label="ชื่อบทเรียน (TH)">
        <input className={FI} value={(thp['title_th'] as string) ?? ''} onChange={(e) => set({ title_th: e.target.value })} />
      </Field>
      <Field label="เป้าหมายการเรียนรู้">
        <textarea className={`${FI} resize-vertical`} rows={2}
          value={(thp['learning_objective_th'] as string) ?? ''} onChange={(e) => set({ learning_objective_th: e.target.value })} />
      </Field>
      <Field label="บทนำ">
        <textarea className={`${FI} resize-vertical`} rows={3}
          value={(thp['lesson_intro_th'] as string) ?? ''} onChange={(e) => set({ lesson_intro_th: e.target.value })} />
      </Field>
      <Field label="คำอธิบายแนวคิด">
        <textarea className={`${FI} resize-vertical`} rows={4}
          value={(thp['concept_explanation_th'] as string) ?? ''} onChange={(e) => set({ concept_explanation_th: e.target.value })} />
      </Field>
    </div>
  )
}

// ─── EP Content Tab ────────────────────────────────────────────────────────────

function TabEP({
  lesson, onChange,
}: { lesson: AdminLessonDetail; onChange: (l: AdminLessonDetail) => void }) {
  const content = (lesson.content ?? {}) as Record<string, unknown>
  const ep = (content['ep'] ?? content) as Record<string, unknown>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Title (EN)"><input className={FI} value={(ep['title_en'] as string) ?? ''} onChange={(e) => onChange({ ...lesson })} /></Field>
        <Field label="Title (TH)"><input className={FI} value={(ep['title_th'] as string) ?? ''} onChange={(e) => onChange({ ...lesson })} /></Field>
        <Field label="Learning Objective (EN)"><textarea className={`${FI} resize-vertical`} rows={2} value={(ep['learning_objective_en'] as string) ?? ''} onChange={(e) => onChange({ ...lesson })} /></Field>
        <Field label="Learning Objective (TH)"><textarea className={`${FI} resize-vertical`} rows={2} value={(ep['learning_objective_th'] as string) ?? ''} onChange={(e) => onChange({ ...lesson })} /></Field>
      </div>
      <Field label="Concept Explanation (EN)"><textarea className={`${FI} resize-vertical`} rows={3} value={(ep['concept_explanation_en'] as string) ?? ''} onChange={(e) => onChange({ ...lesson })} /></Field>
      <Field label="Concept Explanation (TH)"><textarea className={`${FI} resize-vertical`} rows={3} value={(ep['concept_explanation_th'] as string) ?? ''} onChange={(e) => onChange({ ...lesson })} /></Field>
    </div>
  )
}

// ─── Singapore Math Tab ────────────────────────────────────────────────────────

function TabDiagram({ lesson }: { lesson: AdminLessonDetail }) {
  const content = (lesson.content ?? {}) as Record<string, unknown>
  const diagram = content['singapore_math_model'] as Record<string, unknown> | undefined

  return (
    <div className="space-y-6">
      <Field label="Model Type">
        <select className={FI} value={(diagram?.['model_type'] as string) ?? 'area_model'} onChange={() => {}}>
          <option value="area_model">Area Model (แบบจำลองพื้นที่)</option>
          <option value="bar_model">Bar Model (แบบแท่ง)</option>
          <option value="number_bond">Number Bond (แผนภาพส่วนประกอบ)</option>
          <option value="ten_frame">Ten Frame (กรอบสิบช่อง)</option>
        </select>
      </Field>
      <Field label="Equation (สมการ)">
        <input className={FI} value={(diagram?.['equation'] as string) ?? ''} onChange={() => {}} />
      </Field>
      <Field label="Visual Prompt (สำหรับ AI image)">
        <textarea className={`${FI} resize-vertical`} rows={3}
          placeholder="Prompt สำหรับสร้างภาพประกอบ..."
          value={(diagram?.['visual_model_prompt_th'] as string) ?? ''} onChange={() => {}} />
      </Field>
    </div>
  )
}

// ─── Validation Tab ────────────────────────────────────────────────────────────

function TabValidation({
  lessonId,
  lessonStatus,
}: {
  lessonId: string
  lessonStatus: string
}) {
  const [result, setResult] = useState<ValidationResult | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Show server-side validation if available
  const serverValidation = (lessonStatus === 'needs_review' || lessonStatus === 'approved')
    ? null // already validated by server
    : null

  const run = async () => {
    setRunning(true)
    setError(null)
    try {
      const r = await validateLesson(lessonId)
      setResult(r)
    } catch (e) {
      setError('ไม่สามารถตรวจสอบบทเรียนได้')
      console.error(e)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-6">
      <button className="rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50"
        onClick={run} disabled={running}>
        {running ? 'กำลังตรวจสอบ...' : '🔍 ตรวจสอบบทเรียน'}
      </button>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {result.errors.length === 0 && result.warnings.length === 0 ? (
            <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
              <p className="text-3xl">✅</p>
              <p className="mt-2 font-bold text-green-700">ผ่านการตรวจสอบทั้งหมด</p>
              <p className="text-sm text-green-600">พร้อมเผยแพร่ได้เลย</p>
            </div>
          ) : (
            <>
              {result.errors.length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-6">
                  <p className="font-bold text-red-700">❌ ไม่ผ่านการตรวจสอบ ({result.errors.length} ข้อผิดพลาด)</p>
                  <ul className="mt-3 space-y-2">
                    {result.errors.map((e, i) => (
                      <li key={i} className="flex gap-2 rounded-lg bg-white p-3 text-sm text-red-700 shadow-sm">
                        <span className="font-bold">✗</span><span>{e}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.warnings.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
                  <p className="font-bold text-amber-700">⚠️ คำเตือน ({result.warnings.length} ข้อ)</p>
                  <ul className="mt-3 space-y-2">
                    {result.warnings.map((w, i) => (
                      <li key={i} className="flex gap-2 rounded-lg bg-white p-3 text-sm text-amber-700 shadow-sm">
                        <span className="font-bold">!</span><span>{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Preview Tab ──────────────────────────────────────────────────────────────

function TabPreview({ lesson }: { lesson: AdminLessonDetail }) {
  const content = (lesson.content ?? {}) as Record<string, unknown>
  const thp = content['thp'] ?? content

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-primary-100 bg-primary-50/50 p-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="rounded-full bg-primary-200 px-3 py-1 text-xs font-bold text-primary-800">THP Preview</span>
          <span className="text-xs text-gray-400">// ตัวอย่างการแสดงผลในมุมมองเด็ก</span>
        </div>
        <h2 className="text-2xl font-extrabold text-primary-900">{(thp as Record<string, unknown>)['title_th'] as string ?? lesson.title ?? 'บทเรียน'}</h2>
        <p className="mt-3 text-sm text-gray-600">{(thp as Record<string, unknown>)['learning_objective_th'] as string}</p>

        {((thp as Record<string, unknown>)['lesson_intro_th'] as string) && (
          <div className="mt-4 rounded-lg bg-white/80 p-4 text-sm text-gray-700">
            <p className="font-semibold text-gray-800">📖 บทนำ</p>
            <p className="mt-1">{(thp as Record<string, unknown>)['lesson_intro_th'] as string}</p>
          </div>
        )}
        {((thp as Record<string, unknown>)['concept_explanation_th'] as string) && (
          <div className="mt-4 rounded-lg bg-white/80 p-4 text-sm text-gray-700">
            <p className="font-semibold text-gray-800">💡 แนวคิด</p>
            <p className="mt-1">{(thp as Record<string, unknown>)['concept_explanation_th'] as string}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LessonEditorPage() {
  const params = useParams()
  const lessonId = params.lessonId as string

  const [lesson, setLesson] = useState<AdminLessonDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'approved' | 'rejected'>('idle')
  const [hasUnsaved, setHasUnsaved] = useState(false)
  const [reviewerNote, setReviewerNote] = useState('')
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectNote, setRejectNote] = useState('')

  useEffect(() => {
    getAdminLesson(lessonId)
      .then((data) => {
        setLesson(data)
        setReviewerNote(data.reviewer_note ?? '')
        setLoading(false)
      })
      .catch((e) => {
        console.error('Failed to load lesson:', e)
        setError('ไม่สามารถโหลดบทเรียนได้')
        setLoading(false)
      })
  }, [lessonId])

  const handleChange = useCallback((updated: AdminLessonDetail) => {
    setLesson(updated)
    setHasUnsaved(true)
    setSaveStatus('idle')
  }, [])

  const handleSave = async () => {
    if (!lesson) return
    setSaveStatus('saving')
    try {
      await updateAdminLesson(lessonId, {
        title: lesson.title,
        status: lesson.status,
        grade_level: lesson.grade_level,
        topic: lesson.topic,
        content: lesson.content as Record<string, unknown>,
      })
      setSaveStatus('saved')
      setHasUnsaved(false)
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (e) {
      console.error('Save failed:', e)
      setSaveStatus('idle')
    }
  }

  const handleApprove = async () => {
    if (!lesson) return
    setSaveStatus('saving')
    try {
      await approveLesson(lessonId, reviewerNote)
      setLesson({ ...lesson, status: 'approved', reviewer_note: reviewerNote })
      setSaveStatus('approved')
      setHasUnsaved(false)
      setTimeout(() => setSaveStatus('idle'), 3000)
    } catch (e) {
      console.error('Approve failed:', e)
      setSaveStatus('idle')
    }
  }

  const handleReject = async () => {
    if (!rejectNote.trim()) return
    setSaveStatus('saving')
    try {
      await rejectLesson(lessonId, rejectNote)
      setLesson({ ...lesson, status: 'rejected', reviewer_note: rejectNote } as AdminLessonDetail)
      setSaveStatus('rejected')
      setShowRejectModal(false)
      setHasUnsaved(false)
      setTimeout(() => setSaveStatus('idle'), 3000)
    } catch (e) {
      console.error('Reject failed:', e)
      setSaveStatus('idle')
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="text-gray-400">กำลังโหลดบทเรียน...</span>
      </div>
    )
  }

  if (error || !lesson) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-gray-400">{error ?? 'ไม่พบบทเรียนนี้'}</p>
        <Link href="/admin/content" className="text-primary-600 hover:underline">กลับไปหน้าจัดการเนื้อหา</Link>
      </div>
    )
  }

  const statusMeta = STATUS_META[lesson.status ?? ''] ?? { label: lesson.status ?? '-', cls: 'bg-gray-100 text-gray-600' }
  const canApprove = lesson.status === 'needs_review'

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 border-b border-gray-100 bg-white px-6 py-3 shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/admin/content"
              className="text-xs text-gray-400 hover:text-primary-600 transition-colors">← กลับ</Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-extrabold text-gray-950">{lesson.title || lesson.title_en || 'แก้ไขบทเรียน'}</h1>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusMeta.cls}`}>
                  {statusMeta.label}
                </span>
              </div>
              <p className="text-xs text-gray-400">ป.{lesson.grade_level ?? '?'} · {lesson.topic}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {saveStatus === 'saving' && <span className="text-xs text-gray-400">กำลังบันทึก...</span>}
            {saveStatus === 'saved' && <span className="text-xs text-green-600">✓ บันทึกแล้ว</span>}
            {saveStatus === 'approved' && <span className="text-xs text-green-600">✓ อนุมัติแล้ว</span>}
            {saveStatus === 'rejected' && <span className="text-xs text-red-600">✗ ไม่ผ่านการตรวจสอบ</span>}
            {hasUnsaved && <span className="text-xs text-amber-500">● มีการแก้ไข</span>}

            <button className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              onClick={handleSave}>💾 บันทึก</button>

            {canApprove && (
              <>
                <button className="rounded-lg border border-green-200 px-3 py-1.5 text-xs font-semibold text-green-600 hover:bg-green-50"
                  onClick={handleApprove}>✓ อนุมัติ</button>
                <button className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                  onClick={() => setShowRejectModal(true)}>✗ ไม่ผ่าน</button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Reviewer note */}
      {(lesson.status === 'needs_review' || lesson.status === 'approved' || lesson.status === 'rejected') && (
        <div className="mx-auto max-w-6xl px-6 pt-4">
          <div className="rounded-xl border border-amber-100 bg-amber-50/50 px-4 py-3">
            <label className="mb-1 block text-xs font-semibold text-amber-700">หมายเหตุผู้ตรวจสอบ</label>
            <textarea
              className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-gray-800"
              rows={2}
              value={reviewerNote}
              onChange={(e) => setReviewerNote(e.target.value)}
              placeholder="ระบุหมายเหตุสำหรับการอนุมัติ/ไม่อนุมัติ..."
            />
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="border-b border-gray-100 bg-white">
        <div className="mx-auto flex max-w-6xl px-6">
          {TABS.map((tab) => (
            <button key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-semibold transition-colors ${activeTab === tab.id ? 'border-b-2 border-primary-500 text-primary-600' : 'text-gray-400 hover:text-gray-600'}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          {activeTab === 'overview'   && lesson && <TabOverview lesson={lesson} onChange={handleChange} />}
          {activeTab === 'thp'        && lesson && <TabTHP lesson={lesson} onChange={handleChange} />}
          {activeTab === 'ep'         && lesson && <TabEP lesson={lesson} onChange={handleChange} />}
          {activeTab === 'diagram'    && lesson && <TabDiagram lesson={lesson} />}
          {activeTab === 'quiz'        && lesson && (
            <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center text-gray-400">
              ดูข้อสอบในหน้า <Link href="/admin/content/questions" className="text-primary-600 hover:underline">Question Bank</Link>
            </div>
          )}
          {activeTab === 'validation' && lesson && <TabValidation lessonId={lessonId} lessonStatus={lesson.status} />}
          {activeTab === 'preview'    && lesson && <TabPreview lesson={lesson} />}
        </div>

        {/* Raw JSON editor */}
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Raw JSON Content</h2>
          </div>
          <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-xs text-green-400 max-h-96 overflow-y-auto">
            {JSON.stringify(lesson.content, null, 2)}
          </pre>
        </div>
      </div>

      {/* Reject modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-950">ไม่ผ่านการตรวจสอบ</h2>
            <p className="mt-1 text-sm text-gray-500">ระบุเหตุผลที่ไม่ผ่านการตรวจสอบ</p>
            <textarea
              className="mt-4 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              rows={4}
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="เช่น เนื้อหาไม่สมบูรณ์, ข้อสอบผิดพลาด..."
            />
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                onClick={() => setShowRejectModal(false)}>ยกเลิก</button>
              <button className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                onClick={handleReject} disabled={!rejectNote.trim() || saveStatus === 'saving'}>
                {saveStatus === 'saving' ? 'กำลังบันทึก...' : 'ยืนยันไม่ผ่าน'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}