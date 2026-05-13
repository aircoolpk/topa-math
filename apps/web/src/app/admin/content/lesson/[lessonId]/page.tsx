'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { mockContentApi, validateQuizQuestion } from '@/lib/mock-content'
import type {
  AdminContentLesson,
  AdminContentQuestion,
  ContentValidationResult,
} from '@/lib/api/admin'

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',    label: 'Overview' },
  { id: 'thp',         label: 'THP Content' },
  { id: 'ep',          label: 'EP Content' },
  { id: 'diagram',      label: 'Singapore Math' },
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

const DIFFICULTY_OPTIONS = ['easy', 'medium', 'hard'] as const

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
}: { lesson: AdminContentLesson; onChange: (l: AdminContentLesson) => void }) {
  const set = (f: Partial<AdminContentLesson>) => onChange({ ...lesson, ...f })
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
          <input type="number" className={FI} value={lesson.grade ?? ''} min={1} max={6}
            onChange={(e) => set({ grade: Number(e.target.value) })} />
        </Field>
        <Field label="วิชา (Subject)">
          <input className={FI} value={lesson.subject ?? ''} onChange={(e) => set({ subject: e.target.value })} />
        </Field>
        <Field label="Topic">
          <input className={FI} value={lesson.topic ?? ''} onChange={(e) => set({ topic: e.target.value })} />
        </Field>
        <Field label="Program Type">
          <select className={FI} value={lesson.program_type ?? 'THP'}
            onChange={(e) => set({ program_type: e.target.value })}>
            <option value="THP">THP (Thai Program)</option>
            <option value="EP">EP (English Program)</option>
          </select>
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
}: { lesson: AdminContentLesson; onChange: (l: AdminContentLesson) => void }) {
  const thp = lesson.content_thp ?? {}
  const set = (f: Record<string, unknown>) =>
    onChange({ ...lesson, content_thp: { ...thp, ...f } as AdminContentLesson['content_thp'] })

  const updateStep = (i: number, field: string, value: string) => {
    const steps = [...(thp.step_by_step_th ?? [])]
    steps[i] = { ...steps[i], [field]: value }
    set({ step_by_step_th: steps })
  }

  const updateExample = (i: number, field: string, value: unknown) => {
    const exs = [...(thp.worked_examples_th ?? [])]
    exs[i] = { ...exs[i], [field]: value }
    set({ worked_examples_th: exs })
  }

  const updateMistake = (i: number, field: string, value: string) => {
    const ms = [...(thp.common_mistakes_th ?? [])]
    ms[i] = { ...ms[i], [field]: value }
    set({ common_mistakes_th: ms })
  }

  return (
    <div className="space-y-8">
      <Field label="ชื่อบทเรียน (TH)">
        <input className={FI} value={thp.title_th ?? ''} onChange={(e) => set({ title_th: e.target.value })} />
      </Field>
      <Field label="เป้าหมายการเรียนรู้">
        <textarea className={`${FI} resize-vertical`} rows={2}
          value={thp.learning_objective_th ?? ''} onChange={(e) => set({ learning_objective_th: e.target.value })} />
      </Field>
      <Field label="บทนำ">
        <textarea className={`${FI} resize-vertical`} rows={3}
          value={thp.lesson_intro_th ?? ''} onChange={(e) => set({ lesson_intro_th: e.target.value })} />
      </Field>
      <Field label="คำอธิบายแนวคิด">
        <textarea className={`${FI} resize-vertical`} rows={4}
          value={thp.concept_explanation_th ?? ''} onChange={(e) => set({ concept_explanation_th: e.target.value })} />
      </Field>

      {/* Steps */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">ขั้นตอนการเรียนรู้</span>
          <button className="text-xs rounded-full bg-primary-100 px-3 py-1 font-semibold text-primary-700 hover:bg-primary-200"
            onClick={() => set({ step_by_step_th: [...(thp.step_by_step_th ?? []), { step: (thp.step_by_step_th?.length ?? 0) + 1, title_th: '', description_th: '' }] })}>
            + เพิ่มขั้นตอน
          </button>
        </div>
        <div className="space-y-3">
          {(thp.step_by_step_th ?? []).map((s, i) => (
            <div key={i} className="flex gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4">
              <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-200 text-xs font-bold text-primary-700">{i + 1}</span>
              <div className="flex-1 space-y-2">
                <input className={FI} placeholder="ชื่อขั้นตอน" value={s.title_th ?? ''}
                  onChange={(e) => updateStep(i, 'title_th', e.target.value)} />
                <textarea className={`${FI} resize-vertical`} rows={2} placeholder="คำอธิบาย" value={s.description_th ?? ''}
                  onChange={(e) => updateStep(i, 'description_th', e.target.value)} />
              </div>
              <button className="mt-1 text-xs text-red-400 hover:text-red-600 shrink-0"
                onClick={() => set({ step_by_step_th: (thp.step_by_step_th ?? []).filter((_, j) => j !== i) })}>ลบ</button>
            </div>
          ))}
        </div>
      </div>

      {/* Worked examples */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">ตัวอย่างพร้อมวิธีทำ</span>
          <button className="text-xs rounded-full bg-primary-100 px-3 py-1 font-semibold text-primary-700 hover:bg-primary-200"
            onClick={() => set({ worked_examples_th: [...(thp.worked_examples_th ?? []), { problem: '', solution_steps: [''], answer: '', explanation: '' }] })}>
            + เพิ่มตัวอย่าง
          </button>
        </div>
        <div className="space-y-4">
          {(thp.worked_examples_th ?? []).map((ex, i) => (
            <div key={i} className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <Field label="โจทย์"><input className={FI} placeholder="เช่น 23 × 4 = ?" value={ex.problem ?? ''}
                  onChange={(e) => updateExample(i, 'problem', e.target.value)} /></Field>
                <Field label="คำตอบ"><input className={FI} placeholder="เช่น 92" value={ex.answer ?? ''}
                  onChange={(e) => updateExample(i, 'answer', e.target.value)} /></Field>
              </div>
              <Field label="ขั้นตอนวิธีทำ (แต่ละบรรทัดคั่นด้วยเว้นวรรค)">
                <textarea className={`${FI} resize-vertical`} rows={3} value={(ex.solution_steps ?? []).join('\n')}
                  onChange={(e) => updateExample(i, 'solution_steps', e.target.value.split('\n'))} />
              </Field>
              <Field label="คำอธิบาย"><textarea className={`${FI} resize-vertical`} rows={2} value={ex.explanation ?? ''}
                onChange={(e) => updateExample(i, 'explanation', e.target.value)} /></Field>
              <button className="text-xs text-red-400 hover:text-red-600"
                onClick={() => set({ worked_examples_th: (thp.worked_examples_th ?? []).filter((_, j) => j !== i) })}>ลบตัวอย่างนี้</button>
            </div>
          ))}
        </div>
      </div>

      {/* Common mistakes */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">จุดที่เด็กมักพลาด</span>
          <button className="text-xs rounded-full bg-primary-100 px-3 py-1 font-semibold text-primary-700 hover:bg-primary-200"
            onClick={() => set({ common_mistakes_th: [...(thp.common_mistakes_th ?? []), { mistake: '', why_it_happens: '', correct_way: '' }] })}>
            + เพิ่มจุดพลาด
          </button>
        </div>
        <div className="space-y-3">
          {(thp.common_mistakes_th ?? []).map((m, i) => (
            <div key={i} className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-2">
              <Field label="ข้อผิดพลาด"><input className={FI} placeholder="เช่น นำผลคูณมาลบ" value={m.mistake ?? ''}
                onChange={(e) => updateMistake(i, 'mistake', e.target.value)} /></Field>
              <Field label="สาเหตุ"><input className={FI} placeholder="เช่น จำสลับกับวิธีลบ" value={m.why_it_happens ?? ''}
                onChange={(e) => updateMistake(i, 'why_it_happens', e.target.value)} /></Field>
              <Field label="วิธีที่ถูกต้อง"><input className={FI} placeholder="เช่น ต้องนำมาบวกกัน" value={m.correct_way ?? ''}
                onChange={(e) => updateMistake(i, 'correct_way', e.target.value)} /></Field>
              <button className="text-xs text-red-400 hover:text-red-600"
                onClick={() => set({ common_mistakes_th: (thp.common_mistakes_th ?? []).filter((_, j) => j !== i) })}>ลบ</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── EP Content Tab ────────────────────────────────────────────────────────────

function TabEP({
  lesson, onChange,
}: { lesson: AdminContentLesson; onChange: (l: AdminContentLesson) => void }) {
  const ep = lesson.content_ep ?? {}
  const set = (f: Record<string, unknown>) =>
    onChange({ ...lesson, content_ep: { ...ep, ...f } as AdminContentLesson['content_ep'] })

  const updateVocab = (i: number, field: string, value: string) => {
    const vocab = [...(ep.vocabulary ?? [])]
    vocab[i] = { ...vocab[i], [field]: value }
    set({ vocabulary: vocab })
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Title (EN)"><input className={FI} value={ep.title_en ?? ''} onChange={(e) => set({ title_en: e.target.value })} /></Field>
        <Field label="Title (TH)"><input className={FI} value={ep.title_th ?? ''} onChange={(e) => set({ title_th: e.target.value })} /></Field>
        <Field label="Learning Objective (EN)"><textarea className={`${FI} resize-vertical`} rows={2} value={ep.learning_objective_en ?? ''} onChange={(e) => set({ learning_objective_en: e.target.value })} /></Field>
        <Field label="Learning Objective (TH)"><textarea className={`${FI} resize-vertical`} rows={2} value={ep.learning_objective_th ?? ''} onChange={(e) => set({ learning_objective_th: e.target.value })} /></Field>
      </div>
      <Field label="Concept Explanation (EN)"><textarea className={`${FI} resize-vertical`} rows={3} value={ep.concept_explanation_en ?? ''} onChange={(e) => set({ concept_explanation_en: e.target.value })} /></Field>
      <Field label="Concept Explanation (TH)"><textarea className={`${FI} resize-vertical`} rows={3} value={ep.concept_explanation_th ?? ''} onChange={(e) => set({ concept_explanation_th: e.target.value })} /></Field>

      {/* Vocabulary */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">คำศัพท์ (Vocabulary)</span>
          <button className="text-xs rounded-full bg-primary-100 px-3 py-1 font-semibold text-primary-700 hover:bg-primary-200"
            onClick={() => set({ vocabulary: [...(ep.vocabulary ?? []), { word_en: '', meaning_th: '', example_en: '', example_th: '' }] })}>
            + เพิ่มคำศัพท์
          </button>
        </div>
        <div className="space-y-3">
          {(ep.vocabulary ?? []).map((v, i) => (
            <div key={i} className="grid grid-cols-2 gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4">
              <Field label="คำศัพท์ (EN)"><input className={FI} value={v.word_en ?? ''} onChange={(e) => updateVocab(i, 'word_en', e.target.value)} /></Field>
              <Field label="ความหมาย (TH)"><input className={FI} value={v.meaning_th ?? ''} onChange={(e) => updateVocab(i, 'meaning_th', e.target.value)} /></Field>
              <Field label="ตัวอย่างประโยค (EN)"><input className={FI} value={v.example_en ?? ''} onChange={(e) => updateVocab(i, 'example_en', e.target.value)} /></Field>
              <Field label="ตัวอย่างประโยค (TH)"><input className={FI} value={v.example_th ?? ''} onChange={(e) => updateVocab(i, 'example_th', e.target.value)} /></Field>
              <button className="col-span-2 text-left text-xs text-red-400 hover:text-red-600"
                onClick={() => set({ vocabulary: (ep.vocabulary ?? []).filter((_, j) => j !== i) })}>ลบคำศัพท์นี้</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Singapore Math Tab ────────────────────────────────────────────────────────

function TabDiagram({
  lesson, onChange,
}: { lesson: AdminContentLesson; onChange: (l: AdminContentLesson) => void }) {
  const raw = lesson.content_thp as Record<string, unknown> | undefined
  const diagram = raw?.singapore_math_model as Record<string, unknown> | undefined
  const set = (f: Record<string, unknown>) =>
    onChange({
      ...lesson,
      content_thp: { ...(lesson.content_thp ?? {}), singapore_math_model: { ...(diagram ?? {}), ...f } } as AdminContentLesson['content_thp'],
    })

  const modelType = (diagram?.model_type as string) ?? 'area_model'
  const equation = (diagram?.equation as string) ?? `${lesson.title_en ?? '23 × 4'} = ?`

  return (
    <div className="space-y-6">
      <Field label="Model Type">
        <select className={FI} value={modelType} onChange={(e) => set({ model_type: e.target.value })}>
          <option value="area_model">Area Model (แบบจำลองพื้นที่)</option>
          <option value="bar_model">Bar Model (แบบแท่ง)</option>
          <option value="number_bond">Number Bond (แผนภาพส่วนประกอบ)</option>
          <option value="ten_frame">Ten Frame (กรอบสิบช่อง)</option>
        </select>
      </Field>
      <Field label="Equation (สมการ)">
        <input className={FI} placeholder="เช่น 23 × 4 = 92" value={equation} onChange={(e) => set({ equation: e.target.value })} />
      </Field>
      <Field label="Description (EN)">
        <textarea className={`${FI} resize-vertical`} rows={2} value={(diagram?.description_en as string) ?? ''} onChange={(e) => set({ description_en: e.target.value })} />
      </Field>
      <Field label="Description (TH)">
        <textarea className={`${FI} resize-vertical`} rows={2} value={(diagram?.description_th as string) ?? ''} onChange={(e) => set({ description_th: e.target.value })} />
      </Field>
      <Field label="Visual Prompt (สำหรับ AI image)">
        <textarea className={`${FI} resize-vertical`} rows={3} placeholder="Prompt สำหรับสร้างภาพประกอบ..." value={(diagram?.visual_model_prompt_th as string) ?? ''} onChange={(e) => set({ visual_model_prompt_th: e.target.value })} />
      </Field>

      {modelType === 'area_model' && equation && (
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-6">
          <p className="mb-4 text-center text-xs font-semibold uppercase tracking-wide text-gray-400">Area Model Preview</p>
          <AreaModelPreview equation={equation} />
        </div>
      )}
    </div>
  )
}

function AreaModelPreview({ equation }: { equation: string }) {
  const match = equation.match(/(\d+)\s*[×x]\s*(\d+)\s*=\s*(\d+)/)
  if (!match) return <p className="text-center text-gray-400 text-sm">ใส่สมการในรูปแบบ "A × B = C"</p>

  const [, aStr, bStr] = match
  const a = parseInt(aStr)
  const b = parseInt(bStr)
  const tens = Math.floor(a / 10) * 10
  const ones = a % 10
  const cellW = 80
  const cellH = 60
  const gap = 4

  const totalW = tens > 0 ? cellW * 2 + gap : cellW
  const svgH = cellH + 70

  return (
    <svg viewBox={`0 0 ${totalW} ${svgH}`} className="mx-auto w-full max-w-sm" xmlns="http://www.w3.org/2000/svg">
      {tens > 0 && (
        <>
          <rect x={0} y={0} width={cellW} height={cellH} fill="#fed7aa" rx="6" />
          <text x={cellW / 2} y={cellH / 2 - 8} textAnchor="middle" dominantBaseline="middle" fontSize="13" fontWeight="bold" fill="#7c2d12">{tens} × {b}</text>
          <text x={cellW / 2} y={cellH / 2 + 12} textAnchor="middle" dominantBaseline="middle" fontSize="18" fontWeight="bold" fill="#9a3412">{tens * b}</text>
        </>
      )}
      <>
        <rect x={tens > 0 ? cellW + gap : 0} y={0} width={cellW} height={cellH} fill="#fef3c7" rx="6" />
        <text x={(tens > 0 ? cellW + gap : 0) + cellW / 2} y={cellH / 2 - 8} textAnchor="middle" dominantBaseline="middle" fontSize="13" fontWeight="bold" fill="#92400e">{ones} × {b}</text>
        <text x={(tens > 0 ? cellW + gap : 0) + cellW / 2} y={cellH / 2 + 12} textAnchor="middle" dominantBaseline="middle" fontSize="18" fontWeight="bold" fill="#a16207">{ones * b}</text>
      </>
      <text x={totalW / 2} y={svgH - 14} textAnchor="middle" fontSize="13" fontWeight="bold" fill="#374151">
        {equation.split('=')[0].trim()} = {a * b}
      </text>
    </svg>
  )
}

// ─── Quiz Tab ─────────────────────────────────────────────────────────────────

function TabQuiz({
  lesson, onChange, onSaveQuestion, onDeleteQuestion,
}: {
  lesson: AdminContentLesson
  onChange: (l: AdminContentLesson) => void
  onSaveQuestion: (q: Partial<AdminContentQuestion>) => Promise<void>
  onDeleteQuestion: (id: string) => Promise<void>
}) {
  const quiz = lesson.quiz ?? []
  const [expanded, setExpanded] = useState<number | null>(null)
  const [saving, setSaving] = useState<number | null>(null)
  const [editQuiz, setEditQuiz] = useState<AdminContentQuestion[]>(() => deepClone(quiz) as AdminContentQuestion[])
  const [changed, setChanged] = useState<Record<number, boolean>>({})

  const updateQ = (i: number, field: string, value: unknown) => {
    const updated = [...editQuiz]
    updated[i] = { ...updated[i], [field]: value }
    setEditQuiz(updated)
    setChanged((p) => ({ ...p, [i]: true }))
  }

  const addQuestion = () => {
    const newQ: AdminContentQuestion = {
      question_id: `q-new-${Date.now()}`,
      lesson_id: lesson.lesson_id,
      question: '',
      question_th: '',
      choices: { A: '', B: '', C: '', D: '' },
      correct_answer: 'A',
      explanation: '',
      explanation_th: '',
      difficulty: 'medium',
      skill_tag: '',
    }
    setEditQuiz([...editQuiz, newQ])
    setExpanded(editQuiz.length)
  }

  const duplicateQ = (i: number) => {
    const copy = { ...editQuiz[i], question_id: `q-new-${Date.now()}` }
    const updated = [...editQuiz]
    updated.splice(i + 1, 0, copy)
    setEditQuiz(updated)
    setExpanded(i + 1)
  }

  const removeQ = async (i: number) => {
    const q = editQuiz[i]
    if (q.question_id && !q.question_id.startsWith('q-new-')) {
      await onDeleteQuestion(q.question_id)
    }
    setEditQuiz(editQuiz.filter((_, j) => j !== i))
  }

  const saveQ = async (i: number) => {
    setSaving(i)
    try {
      await onSaveQuestion(editQuiz[i])
      setChanged((p) => ({ ...p, [i]: false }))
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {editQuiz.length} ข้อ &nbsp;
          <span className="text-green-600">{editQuiz.filter((q) => q.difficulty === 'easy').length} ง่าย</span> &nbsp;
          <span className="text-amber-600">{editQuiz.filter((q) => q.difficulty === 'medium').length} กลาง</span> &nbsp;
          <span className="text-red-500">{editQuiz.filter((q) => q.difficulty === 'hard').length} ยาก</span>
        </p>
        <button className="rounded-full bg-primary-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700"
          onClick={addQuestion}>+ เพิ่มข้อ</button>
      </div>

      <div className="space-y-2">
        {editQuiz.map((q, i) => {
          const isOpen = expanded === i
          const validation = validateQuizQuestion(q)
          return (
            <div key={q.question_id} className="rounded-xl border border-gray-100 bg-white shadow-sm">
              <button className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                onClick={() => setExpanded(isOpen ? null : i)}>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-gray-400">#{i + 1}</span>
                  <span className="max-w-xs truncate text-sm font-medium text-gray-800">
                    {q.question_th || q.question || <span className="text-gray-300 italic">ยังไม่มีคำถาม</span>}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${q.difficulty === 'easy' ? 'bg-green-100 text-green-700' : q.difficulty === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                    {q.difficulty}
                  </span>
                  {changed[i] && <span className="text-xs text-amber-500">● แก้ไข</span>}
                  {!validation.valid && <span className="text-xs text-red-400">✗ ไม่สมบูรณ์</span>}
                </div>
                <span className="text-xs text-gray-400">{q.correct_answer ? `เฉลย: ${q.correct_answer}` : 'ยังไม่มีเฉลย'}</span>
              </button>

              {isOpen && (
                <div className="border-t border-gray-50 px-4 py-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="คำถาม (TH)"><textarea className={`${FI} resize-vertical`} rows={2} value={q.question_th ?? ''} onChange={(e) => updateQ(i, 'question_th', e.target.value)} /></Field>
                    <Field label="คำถาม (EN)"><textarea className={`${FI} resize-vertical`} rows={2} value={q.question ?? ''} onChange={(e) => updateQ(i, 'question', e.target.value)} /></Field>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    {(['A', 'B', 'C', 'D'] as const).map((opt) => (
                      <Field key={opt} label={`ตัวเลือก ${opt}`}>
                        <input className={FI} value={q.choices?.[opt] ?? ''}
                          onChange={(e) => updateQ(i, 'choices', { ...(q.choices ?? {}), [opt]: e.target.value })} />
                      </Field>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <Field label="คำตอบที่ถูกต้อง">
                      <select className={FI} value={q.correct_answer ?? 'A'} onChange={(e) => updateQ(i, 'correct_answer', e.target.value)}>
                        {(['A', 'B', 'C', 'D'] as const).map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </Field>
                    <Field label="ระดับความยาก">
                      <select className={FI} value={q.difficulty ?? 'medium'} onChange={(e) => updateQ(i, 'difficulty', e.target.value)}>
                        {DIFFICULTY_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </Field>
                    <Field label="Skill Tag">
                      <input className={FI} value={q.skill_tag ?? ''} placeholder="เช่น addition_20" onChange={(e) => updateQ(i, 'skill_tag', e.target.value)} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="คำอธิบาย (TH)"><textarea className={`${FI} resize-vertical`} rows={2} value={q.explanation_th ?? ''} onChange={(e) => updateQ(i, 'explanation_th', e.target.value)} /></Field>
                    <Field label="คำอธิบาย (EN)"><textarea className={`${FI} resize-vertical`} rows={2} value={q.explanation ?? ''} onChange={(e) => updateQ(i, 'explanation', e.target.value)} /></Field>
                  </div>

                  {!validation.valid && (
                    <div className="rounded-lg bg-red-50 p-3 text-xs text-red-600">
                      <p className="font-semibold">ข้อผิดพลาด:</p>
                      <ul className="ml-4 list-disc">{validation.errors.map((e, j) => <li key={j}>{e}</li>)}</ul>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button className="rounded-lg bg-primary-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50"
                      onClick={() => saveQ(i)} disabled={saving === i || !changed[i]}>
                      {saving === i ? 'กำลังบันทึก...' : '💾 บันทึก'}
                    </button>
                    <button className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                      onClick={() => duplicateQ(i)}>📋 คัดลอก</button>
                    <button className="rounded-lg border border-red-100 px-4 py-1.5 text-sm font-semibold text-red-500 hover:bg-red-50"
                      onClick={() => removeQ(i)}>🗑 ลบ</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {editQuiz.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center">
          <p className="text-gray-400">ยังไม่มีข้อสอบ กด + เพิ่มข้อเพื่อเริ่มต้น</p>
        </div>
      )}
    </div>
  )
}

// ─── Validation Tab ────────────────────────────────────────────────────────────

function TabValidation({ lesson }: { lesson: AdminContentLesson }) {
  const [result, setResult] = useState<ContentValidationResult | null>(null)
  const [running, setRunning] = useState(false)

  const run = () => {
    setRunning(true)
    setTimeout(() => {
      const r = mockContentApi.validateLesson(lesson)
      setResult(r)
      setRunning(false)
    }, 200)
  }

  return (
    <div className="space-y-6">
      <button className="rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50"
        onClick={run} disabled={running}>
        {running ? 'กำลังตรวจสอบ...' : '🔍 ตรวจสอบบทเรียน'}
      </button>

      {result && (
        <div className="space-y-4">
          {result.valid ? (
            <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
              <p className="text-3xl">✅</p>
              <p className="mt-2 font-bold text-green-700">ผ่านการตรวจสอบทั้งหมด</p>
              <p className="text-sm text-green-600">พร้อมเผยแพร่ได้เลย</p>
            </div>
          ) : (
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
        </div>
      )}
    </div>
  )
}

// ─── Preview Tab ──────────────────────────────────────────────────────────────

function TabPreview({ lesson }: { lesson: AdminContentLesson }) {
  const thp = lesson.content_thp ?? {}

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-primary-100 bg-primary-50/50 p-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="rounded-full bg-primary-200 px-3 py-1 text-xs font-bold text-primary-800">THP Preview</span>
          <span className="text-xs text-gray-400">// ตัวอย่างการแสดงผลในมุมมองเด็ก</span>
        </div>
        <h2 className="text-2xl font-extrabold text-primary-900">{thp.title_th || lesson.title || 'บทเรียน'}</h2>
        <p className="mt-3 text-sm text-gray-600">{thp.learning_objective_th}</p>

        {thp.lesson_intro_th && (
          <div className="mt-4 rounded-lg bg-white/80 p-4 text-sm text-gray-700">
            <p className="font-semibold text-gray-800">📖 บทนำ</p>
            <p className="mt-1">{thp.lesson_intro_th}</p>
          </div>
        )}
        {thp.concept_explanation_th && (
          <div className="mt-4 rounded-lg bg-white/80 p-4 text-sm text-gray-700">
            <p className="font-semibold text-gray-800">💡 แนวคิด</p>
            <p className="mt-1">{thp.concept_explanation_th}</p>
          </div>
        )}
        {thp.step_by_step_th && thp.step_by_step_th.length > 0 && (
          <div className="mt-4 rounded-lg bg-white/80 p-4 text-sm text-gray-700">
            <p className="mb-3 font-semibold text-gray-800">📝 ขั้นตอนการเรียนรู้</p>
            <ol className="space-y-2">
              {thp.step_by_step_th.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-200 text-xs font-bold text-primary-700">{i + 1}</span>
                  <div><p className="font-semibold">{s.title_th}</p><p className="text-gray-600">{s.description_th}</p></div>
                </li>
              ))}
            </ol>
          </div>
        )}
        {thp.worked_examples_th && thp.worked_examples_th.length > 0 && (
          <div className="mt-4 rounded-lg bg-white/80 p-4 text-sm text-gray-700">
            <p className="mb-3 font-semibold text-gray-800">🔎 ตัวอย่างพร้อมวิธีทำ</p>
            {thp.worked_examples_th.map((ex, i) => (
              <div key={i} className="mb-3 rounded-lg bg-primary-100/50 p-3">
                <p className="font-bold">โจทย์: {ex.problem}</p>
                <p className="font-bold text-primary-700">คำตอบ: {ex.answer}</p>
                <ol className="ml-4 mt-1 list-decimal space-y-1 text-xs text-gray-600">
                  {ex.solution_steps.map((step, j) => <li key={j}>{step}</li>)}
                </ol>
              </div>
            ))}
          </div>
        )}
      </div>

      {lesson.quiz && lesson.quiz.length > 0 && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-6">
          <div className="mb-4 flex items-center gap-2">
            <span className="rounded-full bg-blue-200 px-3 py-1 text-xs font-bold text-blue-800">Quiz Preview</span>
          </div>
          <div className="space-y-3">
            {lesson.quiz.slice(0, 3).map((q, i) => (
              <div key={q.question_id} className="rounded-lg bg-white p-4 shadow-sm">
                <p className="font-semibold text-gray-800">ข้อ {i + 1}: {q.question_th || q.question}</p>
                <div className="mt-2 space-y-1">
                  {(['A', 'B', 'C', 'D'] as const).map((opt) =>
                    q.choices?.[opt] && <p key={opt} className="text-sm text-gray-600"><span className="font-bold">{opt}.</span> {q.choices[opt]}</p>
                  )}
                </div>
              </div>
            ))}
            {lesson.quiz.length > 3 && <p className="text-center text-xs text-gray-400">...และอีก {lesson.quiz.length - 3} ข้อ</p>}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LessonEditorPage() {
  const params = useParams()
  const lessonId = params.lessonId as string

  const [lesson, setLesson] = useState<AdminContentLesson | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'published'>('idle')
  const [hasUnsaved, setHasUnsaved] = useState(false)

  useEffect(() => {
    mockContentApi.getLesson(lessonId).then((data) => {
      setLesson(data)
      setLoading(false)
    })
  }, [lessonId])

  const handleChange = useCallback((updated: AdminContentLesson) => {
    setLesson(updated)
    setHasUnsaved(true)
    setSaveStatus('idle')
  }, [])

  const handleSave = async (newStatus?: string) => {
    if (!lesson) return
    setSaveStatus('saving')
    const toSave = newStatus ? { ...lesson, status: newStatus } : lesson
    await mockContentApi.saveLesson(lessonId, toSave)
    setLesson(toSave)
    setSaveStatus('saved')
    setHasUnsaved(false)
    setTimeout(() => setSaveStatus('idle'), 2000)
  }

  const handlePublish = async () => {
    if (!lesson) return
    await mockContentApi.publishLesson(lessonId)
    const updated = { ...lesson, status: 'published' }
    setLesson(updated)
    setSaveStatus('published')
    setTimeout(() => setSaveStatus('idle'), 3000)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="text-gray-400">กำลังโหลดบทเรียน...</span>
      </div>
    )
  }

  if (!lesson) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-gray-400">ไม่พบบทเรียนนี้</p>
        <Link href="/admin/content" className="text-primary-600 hover:underline">กลับไปหน้าจัดการเนื้อหา</Link>
      </div>
    )
  }

  const validationResult = mockContentApi.validateLesson(lesson)
  const canPublish = validationResult.valid

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 border-b border-gray-100 bg-white px-6 py-3 shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href={`/admin/content/grade/${lesson.grade ?? 1}`}
              className="text-xs text-gray-400 hover:text-primary-600 transition-colors">← กลับ</Link>
            <div>
              <h1 className="text-lg font-extrabold text-gray-950">{lesson.title || lesson.title_en || 'แก้ไขบทเรียน'}</h1>
              <p className="text-xs text-gray-400">{lesson.program_type ?? 'THP'} · ป.{lesson.grade ?? '?'} · {lesson.topic}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {saveStatus === 'saving' && <span className="text-xs text-gray-400">กำลังบันทึก...</span>}
            {saveStatus === 'saved' && <span className="text-xs text-green-600">✓ บันทึกแล้ว</span>}
            {saveStatus === 'published' && <span className="text-xs text-green-600">✓ เผยแพร่แล้ว</span>}
            {hasUnsaved && <span className="text-xs text-amber-500">● มีการแก้ไข</span>}

            <button className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              onClick={() => handleSave()}>💾 บันทึกฉบับร่าง</button>
            <button className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-600 hover:bg-amber-50"
              onClick={() => handleSave('needs_review')}>👁 Mark ต้องตรวจสอบ</button>
            <button className="rounded-lg bg-primary-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-primary-700 disabled:opacity-40"
              onClick={handlePublish} disabled={!canPublish}
              title={!canPublish ? 'ต้องผ่าน Validation ก่อนจึงเผยแพร่ได้' : ''}>🚀 Publish</button>
          </div>
        </div>
      </div>

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
          {activeTab === 'overview'   && <TabOverview lesson={lesson} onChange={handleChange} />}
          {activeTab === 'thp'        && <TabTHP lesson={lesson} onChange={handleChange} />}
          {activeTab === 'ep'         && <TabEP lesson={lesson} onChange={handleChange} />}
          {activeTab === 'diagram'    && <TabDiagram lesson={lesson} onChange={handleChange} />}
          {activeTab === 'quiz'       && <TabQuiz lesson={lesson} onChange={handleChange}
            onSaveQuestion={async (q) => { await mockContentApi.saveQuestion(lessonId, q) }}
            onDeleteQuestion={async (id) => { await mockContentApi.deleteQuestion(id) }} />}
          {activeTab === 'validation' && <TabValidation lesson={lesson} />}
          {activeTab === 'preview'    && <TabPreview lesson={lesson} />}
        </div>
      </div>
    </div>
  )
}
