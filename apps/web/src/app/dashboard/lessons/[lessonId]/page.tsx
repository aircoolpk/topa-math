'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/auth'
import { meApi, type Lesson, type VisualBlock } from '@/lib/api/me'

// ─── Types ───────────────────────────────────────────────────────────────────

type Phase = 'loading' | 'content' | 'error'

const ALLOWED_BLOCK_TYPES = new Set([
  'story_intro',
  'visual_thinking',
  'emoji_counter',
  'model_diagram',
  'grouping_model',
  'bar_model',
  'shape_visual',
  'ten_frame',
  'area_model',
  'fraction_visual',
  'place_value_chart',
  'array_model',
  'graph_visual',
  'volume_visual',
  'table_visual',
  'count_back_strip',
  'number_sentence',
  'mini_quiz',
])

// ─── Helpers ─────────────────────────────────────────────────────────────────

const GRADE_LABEL: Record<number, string> = {
  1: 'ป.1', 2: 'ป.2', 3: 'ป.3', 4: 'ป.4', 5: 'ป.5', 6: 'ป.6',
}

function gradeLabel(g: number | undefined | null): string {
  if (g == null || g <= 0) return 'ไม่ระบุชั้น'
  return GRADE_LABEL[g] ?? `ชั้นที่ ${g}`
}

function getText(val: unknown): string {
  if (val == null) return ''
  if (typeof val === 'string') return val
  if (typeof val === 'number') return String(val)
  if (typeof val === 'object') {
    const o = val as Record<string, unknown>
    return (
      getText(o.title_th) ||
      getText(o.text_th) ||
      getText(o.description_th) ||
      getText(o.content) ||
      getText(o.text) ||
      ''
    )
  }
  return String(val)
}

function getArray<T>(val: unknown): T[] {
  if (!val) return []
  if (Array.isArray(val)) return val as T[]
  return []
}

// ─── Topic Illustration Map ────────────────────────────────────────────────────

function getTopicIllustration(topicCode?: string, skillCode?: string) {
  const t = (topicCode || skillCode || '').toLowerCase()
  if (t.includes('addition') || t.includes('บวก')) return { emoji: '🍎', bg: 'from-green-100 to-emerald-50', accent: 'text-green-600', tagline: 'บวกเลขไม่ยากเลย!' }
  if (t.includes('subtraction') || t.includes('ลบ')) return { emoji: '🎈', bg: 'from-blue-100 to-sky-50', accent: 'text-blue-600', tagline: 'ลบออก คิดเลขสนุก!' }
  if (t.includes('multiplication') || t.includes('คูณ')) return { emoji: '⭐', bg: 'from-amber-100 to-yellow-50', accent: 'text-amber-600', tagline: 'คูณเลข ได้เร็วขึ้น!' }
  if (t.includes('division') || t.includes('หาร')) return { emoji: '🍕', bg: 'from-orange-100 to-orange-50', accent: 'text-orange-600', tagline: 'หารแบ่ง เข้าใจง่าย!' }
  if (t.includes('fraction') || t.includes('เศษส่วน')) return { emoji: '🍰', bg: 'from-pink-100 to-pink-50', accent: 'text-pink-600', tagline: 'เศษส่วน ง่ายนิดเดียว!' }
  if (t.includes('decimal') || t.includes('ทศนิยม')) return { emoji: '🧩', bg: 'from-indigo-100 to-indigo-50', accent: 'text-indigo-600', tagline: 'ทศนิยม ไม่ยากเลย!' }
  if (t.includes('percentage') || t.includes('ร้อยละ')) return { emoji: '🎯', bg: 'from-purple-100 to-purple-50', accent: 'text-purple-600', tagline: 'เปอร์เซ็นต์ คิดง่ายๆ!' }
  return { emoji: '📖', bg: 'from-primary-100 to-primary-50', accent: 'text-primary-600', tagline: 'มาเรียนรู้กันเถอะ!' }
}

// ─── Raw block type ────────────────────────────────────────────────────────────

type RawVisualBlock =
  | VisualBlock
  | string
  | { type?: string; data?: unknown }

// ─── Thai digit normalizer ───────────────────────────────────────────────────

const THAI_DIGITS: Record<string, string> = {
  '๐': '0', '๑': '1', '๒': '2', '๓': '3', '๔': '4',
  '๕': '5', '๖': '6', '๗': '7', '๘': '8', '๙': '9',
}

function normalizeAnswerText(val: unknown): string {
  if (val == null) return ''
  let s = String(val).trim()
  // Number → string
  s = String(val)
  // Trim
  s = s.trim()
  // Thai digits → Arabic
  for (const [th, ar] of Object.entries(THAI_DIGITS)) {
    s = s.split(th).join(ar)
  }
  // Remove leading choice-label prefixes (A. B. C. D. or ก. ข. ค. ง.)
  s = s.replace(/^[A-D][\.\)]\s*/i, '')
  s = s.replace(/^[ก-ง][\.\)]\s*/i, '')
  // Collapse multiple spaces → single space
  s = s.replace(/\s+/g, ' ')
  return s
}

function resolveChoiceAnswer(answer: string, choices: string[]): string {
  const normalized = normalizeAnswerText(answer)
  // If it looks like a bare letter A/B/C/D, resolve to the corresponding choice content
  if (/^[A-D]$/i.test(normalized)) {
    const idx = normalized.toUpperCase().charCodeAt(0) - 65
    return choices[idx] ?? answer
  }
  // If it's a digit 0-3, treat as 0-based index
  if (/^[0-3]$/.test(normalized)) {
    const idx = parseInt(normalized, 10)
    return choices[idx] ?? answer
  }
  // If it's 1-4 and does NOT match any choice value, treat as 1-based index
  if (/^[1-4]$/.test(normalized)) {
    const idx = parseInt(normalized, 10) - 1
    const candidate = choices[idx] ?? ''
    // Only use index-resolved value if it clearly differs from raw answer
    // (to avoid replacing a real choice value like "4 ดวง" with "4 ดวง" from index 4→out of range)
    if (normalizeAnswerText(candidate) !== normalized) {
      return candidate
    }
  }
  return answer
}

function answersMatch(selected: string, correct: string, choices: string[]): boolean {
  const resolvedSelected = resolveChoiceAnswer(selected, choices)
  const resolvedCorrect = resolveChoiceAnswer(correct, choices)
  return normalizeAnswerText(resolvedSelected) === normalizeAnswerText(resolvedCorrect)
}

// ─── Mini quiz answer extractor ───────────────────────────────────────────────

const CORRECT_ANSWER_KEYS = [
  'correct_answer', 'answer', 'correctChoice', 'correct_choice',
  'correctIndex', 'correct_index', 'correctAnswer',
]

function getMiniQuizCorrectAnswer(block: VisualBlock): string {
  const b = block as Record<string, unknown>
  const d = (b.data ?? {}) as Record<string, unknown>

  // Check data first (normalized block), then root level
  for (const key of CORRECT_ANSWER_KEYS) {
    const val = d[key] ?? b[key]
    if (val !== undefined && val !== null && val !== '') {
      // If it's a numeric index (0-3), convert to letter A-D
      if (typeof val === 'number' && Number.isInteger(val) && val >= 0 && val <= 3) {
        return String.fromCharCode(65 + val) // 0→A, 1→B, 2→C, 3→D
      }
      return String(val)
    }
  }

  // Fallback to 'A' (should warn in dev)
  if (process.env.NODE_ENV === 'development') {
    console.warn('[MiniQuiz] No correct answer found for block:', JSON.stringify({ block_type: b.block_type, question_th: b.question_th }))
  }
  return 'A'
}

// ─── Mini quiz choices extractor ──────────────────────────────────────────────

function getMiniQuizChoices(block: VisualBlock): string[] {
  const b = block as Record<string, unknown>
  const d = (b.data ?? {}) as Record<string, unknown>

  const raw = getArray<unknown>(d.choices ?? d.options ?? b.choices ?? [])
  const choices = raw.map(c => {
    const s = getText(c)
    // Strip leading letter if present (e.g. "A. 3 ดวง" → "3 ดวง")
    return s.replace(/^[A-D][\.)\s]+/, '').trim()
  })
  return choices
}

// ─── Normalizer ───────────────────────────────────────────────────────────────

function normalizeVisualBlock(raw: RawVisualBlock): VisualBlock | null {
  if (!raw) return null

  if (typeof raw === 'string') {
    try {
      return normalizeVisualBlock(JSON.parse(raw))
    } catch {
      return null
    }
  }

  const rawObj = raw as Record<string, unknown>

  // Shape A: { type, data } — the common nested form
  if (typeof raw === 'object' && !rawObj.block_type && rawObj.type) {
    const r = raw as { type?: string; data?: Record<string, unknown>; block_type?: never }
    const inner = r.data ?? {}
    const innerRecord = inner as Record<string, unknown>

    // ── Handle grouping_model → model_diagram ──────────────────────────────
    if (r.type === 'grouping_model') {
      const dataRecord = innerRecord.data as Record<string, unknown> | undefined
      const groups = getArray<Record<string, unknown>>(innerRecord.groups ?? dataRecord?.groups ?? [])
      return {
        block_type: 'model_diagram',
        type: 'model_diagram',
        title_th: getText(innerRecord.title_th) || '🟦 ใช้แผนภาพช่วยคิด',
        description_th: getText(innerRecord.description_th),
        data: inner,
        groups,
      } as unknown as VisualBlock
    }

    // ── Handle bar_model / shape_visual / ten_frame / area_model / ────────
    // ── fraction_visual / place_value_chart / array_model / graph_visual / ─
    // ── volume_visual / table_visual / count_back_strip → model_diagram ────
    const modelTypes = new Set([
      'bar_model', 'shape_visual', 'ten_frame', 'area_model',
      'fraction_visual', 'place_value_chart', 'array_model',
      'graph_visual', 'volume_visual', 'table_visual', 'count_back_strip',
    ])
    if (r.type && modelTypes.has(r.type)) {
      // Extract groups / items from the inner record
      const dataRecord = innerRecord.data as Record<string, unknown> | undefined
      const innerData = dataRecord ?? innerRecord
      const groups = getArray<Record<string, unknown>>(
        innerData.groups ?? innerData.items ?? innerData.bars ?? innerData.rows ?? []
      )
      const title_th = getText(innerData.title_th || innerData.title)
        || getText(innerRecord.title_th)
      const description_th = getText(innerData.description_th)
      const symbol = getText(innerData.symbol || innerData.emoji || innerData.unit || '🔢')
      const total = innerData.total ?? innerData.value ?? innerData.numerator
      return {
        block_type: 'model_diagram',
        type: 'model_diagram',
        title_th: title_th || `🟦 ${r.type!.replace(/_/g, ' ')}`,
        description_th,
        data: inner,
        groups,
        symbol,
        total,
      } as unknown as VisualBlock
    }

    // ── Handle emoji_counter / visual_thinking ─────────────────────────────
    if (r.type === 'emoji_counter' || r.type === 'visual_thinking') {
      const dataRecord = innerRecord.data as Record<string, unknown> | undefined
      const innerData = dataRecord ?? innerRecord
      const rawItems = getArray<Record<string, unknown>>(innerData.items ?? innerData.counts ?? [])
      return {
        block_type: 'visual_thinking',
        type: 'visual_thinking',
        title_th: getText(innerData.title_th || innerData.title) || '👀 มองภาพก่อน',
        content: getText(innerData.content),
        items: rawItems,
        items_before: innerData.items_before,
        items_added: innerData.items_added,
        emoji: getText(innerData.emoji || innerData.symbol),
      } as unknown as VisualBlock
    }

    // ── Default for other types ────────────────────────────────────────────
    return {
      block_type: r.type ?? 'unknown',
      title_th: getText(innerRecord.title_th) || getText(innerRecord.title),
      content: getText(innerRecord.content) || getText(innerRecord.text_th),
      description_th: getText(innerRecord.description_th),
      ...innerRecord,
    } as VisualBlock
  }

  // Shape B/C: already has block_type set — pass through
  return raw as VisualBlock
}

// ─── Block 1: 🐣 Story Intro ───────────────────────────────────────────────────

function BlockStoryIntro({ block }: { block: VisualBlock }) {
  return (
    <div className="card shadow-md bg-gradient-to-br from-yellow-50 via-white to-orange-50 border-l-4 border-yellow-400">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">🐣</span>
        <h3 className="font-bold text-yellow-800 text-base">
          {block.title_th || 'เรื่องราวชวนคิด'}
        </h3>
      </div>
      <p className="text-gray-700 text-base leading-relaxed italic">
        {block.content || block.description_th || block.label || ''}
      </p>
    </div>
  )
}

// ─── Block 2: 👀 Visual Thinking ───────────────────────────────────────────────

function BlockVisualThinking({ block }: { block: VisualBlock }) {
  const rawItems = getArray<Record<string, unknown>>(block.items)
  const hasNewFormat = rawItems.length > 0

  if (hasNewFormat) {
    const emoji = getText(rawItems[0]?.emoji) || '🍎'
    const total = rawItems.reduce<number>((sum, item) => sum + (Number(item.count) || 0), 0)

    return (
      <div className="card shadow-md bg-blue-50 border-l-4 border-blue-400">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">👀</span>
          <h3 className="font-bold text-blue-800 text-base">
            {block.title_th || 'มองภาพก่อน'}
          </h3>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 text-3xl leading-none">
          {rawItems.map((item, i) => {
            const count = Number(item.count) || 0
            const e = getText(item.emoji) || emoji
            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className="flex flex-wrap justify-center gap-1">
                  {count <= 15
                    ? Array.from({ length: count }, (_, idx) => <span key={idx}>{e}</span>)
                    : <span className="text-2xl font-extrabold">{e} × {count}</span>
                  }
                </div>
                {count > 15 && <span className="text-sm font-extrabold text-blue-700">{count}</span>}
              </div>
            )
          })}
        </div>

        {total > 0 && (
          <div className="text-center mt-3">
            <span className="text-2xl font-extrabold text-blue-700">= {total}</span>
          </div>
        )}
      </div>
    )
  }

  // Legacy: items_before / items_added
  const { items_before = 0, items_added = 0, emoji = '🍎' } = block
  const count = (n: number) => Array.from({ length: Math.min(n, 20) }, (_, i) => i)

  return (
    <div className="card shadow-md bg-blue-50 border-l-4 border-blue-400">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">👀</span>
        <h3 className="font-bold text-blue-800 text-base">
          {block.title_th || 'มองภาพก่อน'}
        </h3>
      </div>
      <div className="flex flex-col items-center gap-4">
        <div className="text-center">
          <p className="text-xs font-bold text-blue-600 mb-1">ก่อน</p>
          <div className="text-3xl leading-none">
            {count(items_before).map((_, i) => <span key={i}>{emoji} </span>)}
            {items_before > 20 && <span className="text-sm text-blue-400">+{items_before - 20}</span>}
          </div>
          <p className="text-sm font-bold text-blue-700 mt-1">{items_before}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-blue-200" />
          <div className="text-center">
            <div className="text-xl">+{items_added} {emoji}</div>
            <p className="text-xs text-blue-500">เพิ่มเข้ามา</p>
          </div>
          <div className="h-px flex-1 bg-blue-200" />
        </div>
        <div className="text-center">
          <p className="text-xs font-bold text-blue-600 mb-1">หลังจาก</p>
          <div className="text-3xl leading-none">
            {count(items_before + items_added).map((_, i) => <span key={i}>{emoji} </span>)}
            {items_before + items_added > 20 && <span className="text-sm text-blue-400">+{items_before + items_added - 20}</span>}
          </div>
          <p className="text-2xl font-extrabold text-blue-700 mt-1">= {items_before + items_added}</p>
        </div>
      </div>
    </div>
  )
}

// ─── Block 3: 🟦 Model Diagram ────────────────────────────────────────────────

function BlockModelDiagram({ block }: { block: VisualBlock }) {
  const rawGroups = getArray<Record<string, unknown>>(block.groups ?? block.sharing_groups ?? [])
  const symbol = getText(block.symbol) || getText(block.emoji) || '🚗'

  if (rawGroups.length > 0) {
    return (
      <div className="card shadow-md bg-teal-50 border-l-4 border-teal-400">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">🟦</span>
          <h3 className="font-bold text-teal-800 text-base">
            {block.title_th || 'ใช้แผนภาพช่วยคิด'}
          </h3>
        </div>
        <div className="space-y-2">
          {rawGroups.map((group, i) => {
            // Support label_th / label fields; fallback to กลุ่มที่ N
            const label = getText(group.label_th || group.label) || `กลุ่มที่ ${i + 1}`
            const itemsRaw = group.items ?? group.count ?? group.value ?? null

            // Render either emoji string (e.g. "🚗🚗") or count-based grid
            if (typeof itemsRaw === 'string' && itemsRaw.length > 0) {
              // Items is a string of emoji characters — render each separately
              const chars = [...itemsRaw] // spread string into array of chars
              return (
                <div key={i} className="flex items-center gap-3 bg-white rounded-xl px-4 py-2.5 border border-teal-100 shadow-sm">
                  <span className="text-sm font-semibold text-teal-700 w-36 shrink-0">{label}</span>
                  <div className="flex flex-wrap gap-1">
                    {chars.map((char, j) => (
                      <span key={j} className="text-xl">{char}</span>
                    ))}
                  </div>
                </div>
              )
            }

            if (typeof itemsRaw === 'object' && itemsRaw !== null) {
              // Items is an array — join them
              const items = getArray<unknown>(itemsRaw as unknown)
              const itemText = items.map(it => getText(it)).join('')
              return (
                <div key={i} className="flex items-center gap-3 bg-white rounded-xl px-4 py-2.5 border border-teal-100 shadow-sm">
                  <span className="text-sm font-semibold text-teal-700 w-36 shrink-0">{label}</span>
                  <div className="flex flex-wrap gap-1">
                    {[...itemText].map((char, j) => (
                      <span key={j} className="text-xl">{char}</span>
                    ))}
                  </div>
                </div>
              )
            }

            const count = Number(itemsRaw) || Number(group.count) || Number(group.value) || 0
            const items = Array.from({ length: Math.min(count, 20) }, (_, idx) => idx)
            return (
              <div key={i} className="flex items-center gap-3 bg-white rounded-xl px-4 py-2.5 border border-teal-100 shadow-sm">
                <span className="text-sm font-semibold text-teal-700 w-36 shrink-0">{label}</span>
                <div className="flex flex-wrap gap-1">
                  {items.map((_, j) => (
                    <span key={j} className="text-xl">{symbol}</span>
                  ))}
                  {count > 20 && (
                    <span className="text-sm font-bold text-teal-600 self-center">×{count}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        {block.total != null && (
          <div className="mt-3 text-center">
            <span className="text-xl font-extrabold text-teal-700">= {block.total}</span>
          </div>
        )}
      </div>
    )
  }

  // Fallback: rows × cols grid
  const rows = Number(block.rows) || 3
  const cols = Number(block.cols) || 4
  return (
    <div className="card shadow-md bg-teal-50 border-l-4 border-teal-400">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🟦</span>
        <h3 className="font-bold text-teal-800 text-base">
          {block.title_th || 'ใช้แผนภาพช่วยคิด'}
        </h3>
      </div>
      <div className="flex flex-col items-center gap-1">
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="flex gap-1">
            {Array.from({ length: cols }, (_, c) => (
              <div key={c} className="w-9 h-9 bg-teal-400 rounded-lg flex items-center justify-center text-white text-lg font-bold shadow-sm">
                {symbol}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="text-center mt-3">
        <p className="text-sm font-bold text-teal-700">
          {rows} แถว × {cols} คอลัมน์ = {rows * cols}
        </p>
      </div>
    </div>
  )
}

// ─── Block 4: 🔢 Number Sentence ──────────────────────────────────────────────

function BlockNumberSentence({ block }: { block: VisualBlock }) {
  const expression: string =
    getText(block.expression) ||
    getText(block.question_th) ||
    getText(block.text) ||
    getText(block.equation) ||
    ''

  return (
    <div className="card shadow-md bg-slate-50 border-l-4 border-slate-400 text-center py-6">
      <div className="flex items-center gap-2 mb-3 justify-center">
        <span className="text-2xl">✍️</span>
        <h3 className="font-bold text-slate-700 text-base">
          {block.title_th || 'เขียนเป็นประโยคคณิต'}
        </h3>
      </div>
      {expression && (
        <p className="text-3xl font-extrabold text-slate-800 tracking-wide">{expression}</p>
      )}
    </div>
  )
}

// ─── Block 5: 🎯 Mini Quiz ─────────────────────────────────────────────────────

function BlockMiniQuiz({ block }: { block: VisualBlock }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [answered, setAnswered] = useState(false)

  const rawQuestions = getArray<Record<string, unknown>>(block.questions ?? [])
  const choices = getMiniQuizChoices(block)

  // Format A: placeholder quiz
  if (rawQuestions.length > 0 && choices.length === 0) {
    const questionText = getText(rawQuestions[0])
    return (
      <div className="card shadow-md bg-amber-50 border-l-4 border-amber-400">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">🎯</span>
          <h3 className="font-bold text-amber-800 text-base">
            {block.title_th || 'ลองทำดู'}
          </h3>
        </div>
        <p className="text-gray-800 text-sm font-medium mb-4">{questionText}</p>
        <div className="text-center py-4 text-amber-600 text-sm">
          💡 คำถามจะปรากฏในแบบทดสอบหลังจากเรียนจบ
        </div>
      </div>
    )
  }

  const questionText = getText(block.question_th) || getText(block.question) || ''
  const correctAnswerRaw = getMiniQuizCorrectAnswer(block)

  // Resolve the actual correct choice index/text
  // If correctAnswer is a letter (A-D), map to the choice content
  // If it's a direct value (e.g. "4"), find which choice matches it
  const letterPattern = /^[A-D]$/i
  let correctChoiceText = correctAnswerRaw

  if (letterPattern.test(correctAnswerRaw)) {
    const idx = correctAnswerRaw.toUpperCase().charCodeAt(0) - 65
    correctChoiceText = choices[idx] ?? correctAnswerRaw
  } else {
    // Direct value — find matching choice by content
    const normalizedCorrect = normalizeAnswerText(correctAnswerRaw)
    const matchedIdx = choices.findIndex(c => normalizeAnswerText(c) === normalizedCorrect)
    if (matchedIdx >= 0) {
      correctChoiceText = choices[matchedIdx]
    }
  }

  const correctAnswerLetter = correctAnswerRaw

  const handleSelect = (choiceKey: string) => {
    if (answered) return
    setSelected(choiceKey)
    setAnswered(true)
  }

  return (
    <div className="card shadow-md bg-amber-50 border-l-4 border-amber-400">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🎯</span>
        <h3 className="font-bold text-amber-800 text-base">
          {block.title_th || 'ลองทำดู'}
        </h3>
      </div>

      {questionText && (
        <p className="text-gray-800 text-sm font-medium mb-4">{questionText}</p>
      )}

      <div className="space-y-2">
        {choices.map((choice, i) => {
          const choiceKey = String.fromCharCode(65 + i) // 'A', 'B', 'C', 'D'
          const isSelected = selected === choiceKey
          const isCorrectOption = answersMatch(choiceKey, correctAnswerLetter, choices)
          const showResult = answered

          let bgClass = 'bg-white hover:bg-amber-50 border-2 border-transparent'
          if (showResult) {
            if (isCorrectOption) bgClass = 'bg-green-100 border-2 border-green-400'
            else if (isSelected) bgClass = 'bg-red-100 border-2 border-red-400'
            else bgClass = 'bg-gray-50 opacity-60 border-2 border-transparent'
          } else if (isSelected) {
            bgClass = 'bg-amber-100 border-2 border-amber-400'
          }

          return (
            <button
              key={i}
              onClick={() => handleSelect(choiceKey)}
              disabled={answered}
              className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all ${bgClass}`}
            >
              <span className="font-bold mr-2">{choiceKey}.</span>
              {choice}
            </button>
          )
        })}
      </div>

      {answered && (
        <div className="mt-4">
          {answersMatch(selected ?? '', correctAnswerLetter, choices) ? (
            <div className="bg-green-100 border border-green-300 rounded-xl p-3 text-center">
              <p className="text-green-800 text-sm font-bold">
                ✅ ถูกต้อง เก่งมาก!
              </p>
              {(block as Record<string, unknown>).explanation_th ? (
                <p className="text-green-600 text-xs mt-1">
                  {String(getText((block as Record<string, unknown>).explanation_th))}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="bg-red-100 border border-red-300 rounded-xl p-3 text-center">
              <p className="text-red-800 text-sm font-bold">
                ❌ ยังไม่ถูกนะ — คำตอบที่ถูกคือ: {correctChoiceText}
              </p>
              {(block as Record<string, unknown>).explanation_th ? (
                <p className="text-red-600 text-xs mt-1">
                  {String(getText((block as Record<string, unknown>).explanation_th))}
                </p>
              ) : null}
            </div>
          )}
          <button
            onClick={() => { setSelected(null); setAnswered(false) }}
            className="mt-2 w-full text-xs text-amber-600 hover:text-amber-800 font-medium py-1"
          >
            🔄 ลองใหม่
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Block Router ─────────────────────────────────────────────────────────────

function VisualBlockRenderer({ block }: { block: VisualBlock }) {
  const rawType = block.block_type || (block as Record<string, unknown>).type as string || 'unknown'

  switch (rawType) {
    case 'story_intro':      return <BlockStoryIntro block={block} />
    case 'visual_thinking':   return <BlockVisualThinking block={block} />
    case 'emoji_counter':    return <BlockVisualThinking block={block} />
    case 'model_diagram':     return <BlockModelDiagram block={block} />
    case 'grouping_model':    return <BlockModelDiagram block={block} />
    case 'bar_model':         return <BlockModelDiagram block={block} />
    case 'shape_visual':     return <BlockModelDiagram block={block} />
    case 'ten_frame':         return <BlockModelDiagram block={block} />
    case 'area_model':       return <BlockModelDiagram block={block} />
    case 'fraction_visual':   return <BlockModelDiagram block={block} />
    case 'place_value_chart': return <BlockModelDiagram block={block} />
    case 'array_model':      return <BlockModelDiagram block={block} />
    case 'graph_visual':     return <BlockModelDiagram block={block} />
    case 'volume_visual':     return <BlockModelDiagram block={block} />
    case 'table_visual':      return <BlockModelDiagram block={block} />
    case 'count_back_strip':  return <BlockModelDiagram block={block} />
    case 'number_sentence':   return <BlockNumberSentence block={block} />
    case 'mini_quiz':        return <BlockMiniQuiz block={block} />
    default: return null // Hide deprecated/unknown block types
  }
}

// ─── Block sequence labels (allowed types only) ────────────────────────────────

const BLOCK_LABELS: Record<string, string> = {
  story_intro:      '🐣 เรื่องราวชวนคิด',
  visual_thinking:  '👀 มองภาพก่อน',
  emoji_counter:    '👀 มองภาพก่อน',
  model_diagram:    '🟦 ใช้แผนภาพช่วยคิด',
  grouping_model:   '🟦 ใช้แผนภาพช่วยคิด',
  bar_model:        '🟦 ใช้แผนภาพช่วยคิด',
  shape_visual:     '🟦 ใช้แผนภาพช่วยคิด',
  ten_frame:        '🟦 ใช้แผนภาพช่วยคิด',
  area_model:       '🟦 ใช้แผนภาพช่วยคิด',
  fraction_visual:  '🟦 ใช้แผนภาพช่วยคิด',
  place_value_chart:'🟦 ใช้แผนภาพช่วยคิด',
  array_model:      '🟦 ใช้แผนภาพช่วยคิด',
  graph_visual:     '🟦 ใช้แผนภาพช่วยคิด',
  volume_visual:    '🟦 ใช้แผนภาพช่วยคิด',
  table_visual:     '🟦 ใช้แผนภาพช่วยคิด',
  count_back_strip: '🟦 ใช้แผนภาพช่วยคิด',
  number_sentence:  '✍️ เขียนเป็นประโยคคณิต',
  mini_quiz:        '🎯 ลองทำดู',
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LessonPage() {
  const params = useParams()
  const lessonId = params.lessonId as string
  const router = useRouter()
  const { checkAuth } = useAuthStore()

  const [phase, setPhase] = useState<Phase>('loading')
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [testLoading, setTestLoading] = useState(false)
  const [programType, setProgramType] = useState<'TH' | 'EP'>('TH')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    checkAuth().then(() => {
      if (!localStorage.getItem('access_token')) router.push('/login')
    })
  }, [])

  const loadLesson = useCallback(async (pt?: 'TH' | 'EP') => {
    if (!lessonId) return
    setLoading(true)
    setPhase('loading')
    setErrorMsg('')
    try {
      const fetched = await meApi.getLesson(lessonId)
      setLesson(fetched)
      if (pt) setProgramType(pt)
      setPhase('content')
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { ep_fallback?: boolean } }; message?: string }
      if (e?.response?.data?.ep_fallback) {
        // EP not available — show TH with fallback banner
        const fallbackLesson = await meApi.getLesson(lessonId)
        setLesson(fallbackLesson)
        setProgramType('TH')
        setPhase('content')
      } else {
        const status = e?.response?.status
        if (status === 404) setErrorMsg('ไม่พบบทเรียนนี้')
        else setErrorMsg('โหลดบทเรียนไม่สำเร็จ กรุณาลองใหม่')
        setPhase('error')
      }
    } finally {
      setLoading(false)
    }
  }, [lessonId])

  useEffect(() => {
    loadLesson()
  }, [loadLesson])

  const handleTakeTest = async () => {
    if (!lesson) return
    setTestLoading(true)
    try {
      const { session_id } = await meApi.startLessonTest(lesson.lesson_id)
      router.push(`/dashboard/tests/${session_id}`)
    } catch {
      setTestLoading(false)
      alert('ไม่สามารถเริ่มเทสได้ กรุณาลองใหม่')
    }
  }

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (phase === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-bounce">📖</div>
          <p className="text-gray-600 font-semibold">กำลังโหลดบทเรียน...</p>
        </div>
      </div>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────────

  if (phase === 'error' || !lesson) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="card max-w-md text-center py-12">
          <div className="text-5xl mb-4">😢</div>
          <h2 className="text-xl font-extrabold text-gray-900 mb-2">เกิดข้อผิดพลาด</h2>
          <p className="text-gray-500 mb-6">{errorMsg || 'ไม่พบบทเรียนนี้'}</p>
          <div className="flex gap-3">
            <Link href="/dashboard" className="flex-1 btn-secondary text-center py-3">กลับแดชบอร์ด</Link>
            <button onClick={() => window.location.reload()} className="flex-1 btn-primary py-3">ลองใหม่</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Content ─────────────────────────────────────────────────────────────────

  const isLocked = lesson.status === 'locked' || lesson.is_locked === true
  const gradeLbl = gradeLabel(lesson.grade_level)
  const cover = getTopicIllustration(lesson.topic_code, lesson.skill_code)

  // Filter visual_blocks to only allowed types
  const allowedBlocks = (lesson.visual_blocks ?? [])
    .map(raw => normalizeVisualBlock(raw))
    .filter((block): block is VisualBlock =>
      block !== null && ALLOWED_BLOCK_TYPES.has(block.block_type)
    )

  return (
    <div className="min-h-screen bg-background">

      {/* Header */}
      <header className="bg-white border-b border-primary-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm">
            <span>←</span>
            <span>กลับแดชบอร์ด</span>
          </Link>

          {/* Program switch */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold bg-primary-100 text-primary-700 px-3 py-1 rounded-full">
              {gradeLbl}
            </span>
            <div className="flex items-center bg-gray-100 rounded-full p-0.5 gap-0.5">
              <button
                onClick={() => loadLesson('TH')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  programType === 'TH'
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-white'
                }`}
              >
                TH
              </button>
              <button
                onClick={() => loadLesson('EP')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  programType === 'EP'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-white'
                }`}
              >
                EP
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">

        {/* Lesson Cover Card */}
        <div className={`mb-6 rounded-2xl bg-gradient-to-br ${cover.bg} border border-white/60 shadow-lg overflow-hidden`}>
          <div className="flex items-center gap-4 p-5">
            <div className="flex-shrink-0 w-20 h-20 rounded-2xl bg-white/80 flex items-center justify-center text-4xl shadow-sm">
              {cover.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-xs font-bold bg-white/70 text-gray-600 px-2 py-0.5 rounded-full">
                  {gradeLbl}
                </span>
                {lesson.topic_code && (
                  <span className="text-xs font-bold bg-white/70 text-gray-500 px-2 py-0.5 rounded-full">
                    {lesson.topic_code}
                  </span>
                )}
              </div>
              <h1 className="text-xl font-extrabold text-gray-900 leading-tight mb-1">
                {programType === 'EP' && lesson.title_en ? lesson.title_en : (lesson.title_th || 'บทเรียน')}
              </h1>
              <p className={`text-sm font-medium ${cover.accent}`}>{cover.tagline}</p>
            </div>
          </div>
        </div>

        {/* EP Fallback Banner */}
        {programType === 'EP' && lesson.program_type !== 'EP' && (
          <div className="mb-5 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700 flex items-center gap-2">
            <span className="text-lg">ℹ️</span>
            <p>บทเรียน EP ยังไม่พร้อม แสดงบทเรียนภาษาไทยชั่วคราว</p>
          </div>
        )}

        {/* Variant Banner */}
        {(lesson.variant_title_th || lesson.story_theme_th) && (
          <div className="mb-5 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl px-4 py-2.5 flex items-center gap-3">
            <span className="text-xl">🎭</span>
            <div className="flex-1">
              <p className="text-xs text-yellow-600 font-medium">เรื่องราว</p>
              <p className="text-sm font-bold text-yellow-800">
                {lesson.variant_title_th || lesson.story_theme_th}
              </p>
            </div>
          </div>
        )}

        {/* ── Locked state ── */}
        {isLocked ? (
          <div className="card shadow-md text-center py-12">
            <div className="text-5xl mb-4">🔒</div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-2">บทเรียนนี้ถูกล็อก</h2>
            <p className="text-gray-500 mb-6">
              {lesson.lock_reason || 'สมาชิกฟรีเรียนได้ 1 บทแรก อัปเกรดเพื่อเรียนต่อ'}
            </p>
            <Link href="/pricing" className="btn-primary px-8 py-3">อัปเกรด Plus</Link>
          </div>
        ) : (
          <>
            {/* ── Visual Blocks (simplified) ── */}
            {allowedBlocks.length > 0 ? (
              <div className="space-y-4">
                {allowedBlocks.map((block, i) => {
                  const type = block.block_type
                  return (
                    <div key={i}>
                      {/* Sequence number + label */}
                      <div className="text-xs font-bold text-gray-400 mb-1.5 flex items-center gap-1">
                        <span>{i + 1}.</span>
                        <span>{BLOCK_LABELS[type] ?? type}</span>
                      </div>
                      <VisualBlockRenderer block={block} />
                    </div>
                  )
                })}
              </div>
            ) : (
              /* ── No visual blocks — show brief fallback text ── */
              <div className="card shadow-md text-center py-10">
                <p className="text-gray-500">บทเรียนนี้ยังไม่มีเนื้อหาแสดง</p>
              </div>
            )}

            {/* ── Actions ── */}
            <div className="mt-8 flex gap-3">
              {lesson.has_test !== false && (
                <button
                  onClick={handleTakeTest}
                  disabled={testLoading}
                  className="flex-1 bg-gradient-to-r from-accent-400 to-accent-500 hover:from-accent-500 hover:to-accent-600 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all text-base"
                >
                  {testLoading ? '⏳ กำลังเตรียมเทส...' : '📝 ทำเทสจากบทนี้'}
                </button>
              )}
              <Link href="/dashboard" className="flex-1 btn-secondary text-center py-3.5 text-base">
                กลับแดชบอร์ด
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  )
}