'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/auth'
import { meApi, type Lesson, type VisualBlock } from '@/lib/api/me'
import { defaultMascots } from '@/lib/topa-content'
import { stableMascotIndex } from '@/lib/mascot-registry'

// ─── Types ───────────────────────────────────────────────────────────────────

type Phase = 'loading' | 'content' | 'error'
type ProgramType = 'TH' | 'EP'

const BETA_READY_LESSON_GRADES = new Set([1, 2, 3, 4, 5, 6])

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
      getText(o.block_title_th) ||
      getText(o.block_title) ||
      getText(o.text_th) ||
      getText(o.content_th) ||
      getText(o.description_th) ||
      getText(o.story_th) ||
      getText(o.question_th) ||
      getText(o.template_th) ||
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

function getRecord(val: unknown): Record<string, unknown> {
  return val && typeof val === 'object' && !Array.isArray(val)
    ? val as Record<string, unknown>
    : {}
}

function cleanText(val: unknown): string {
  const text = getText(val).trim()
  if (!text || text === 'undefined' || text === 'null' || text === '[object Object]') return ''
  if (/^\?{3,}$/.test(text)) return ''
  return text
}

function localizedDataValue(
  block: VisualBlock,
  programType: ProgramType,
  baseName: string,
  fallbackKeys: string[] = []
): unknown {
  const b = block as Record<string, unknown>
  const d = getRecord(b.data)
  const suffix = programType === 'EP' ? 'en' : 'th'
  const keys = [`${baseName}_${suffix}`, baseName, ...fallbackKeys]
  for (const key of keys) {
    const dataValue = d[key]
    if (dataValue !== undefined && dataValue !== null && dataValue !== '') return dataValue
    const blockValue = b[key]
    if (blockValue !== undefined && blockValue !== null && blockValue !== '') return blockValue
  }
  return ''
}

function localizedContentText(block: VisualBlock, programType: ProgramType, baseName: string): string {
  const suffix = programType === 'EP' ? 'en' : 'th'
  const b = block as Record<string, unknown>
  const d = getRecord(b.data)
  const value = d[`content_${suffix}`] ?? b[`content_${suffix}`] ?? d.content ?? b.content ?? d[`${baseName}_${suffix}`] ?? b[`${baseName}_${suffix}`] ?? ''
  return cleanText(value)
}

function getNumber(val: unknown): number | undefined {
  if (typeof val === 'number' && Number.isFinite(val)) return val
  if (typeof val === 'string') {
    const match = val.replace(/,/g, '').match(/\d+(?:\.\d+)?/)
    if (match) return Number(match[0])
  }
  return undefined
}

function firstNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    const number = getNumber(value)
    if (number !== undefined && number > 0) return number
  }
  return undefined
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

function getMiniQuizCorrectAnswer(block: VisualBlock, programType: ProgramType): string {
  const b = block as Record<string, unknown>
  const d = (b.data ?? {}) as Record<string, unknown>
  const nestedContent = getRecord(d.content)
  const nestedQuestion = getArray<Record<string, unknown>>(d.questions ?? nestedContent.questions)[0] ?? {}

  const localizedAnswer = localizedDataValue(block, programType, 'correct_answer')
  if (localizedAnswer !== undefined && localizedAnswer !== null && localizedAnswer !== '') {
    return String(localizedAnswer)
  }

  // Check data first (normalized block), then root level
  for (const key of CORRECT_ANSWER_KEYS) {
    const val = d[key] ?? nestedQuestion[key] ?? b[key]
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

function getMiniQuizChoices(block: VisualBlock, programType: ProgramType): string[] {
  const b = block as Record<string, unknown>
  const d = (b.data ?? {}) as Record<string, unknown>
  const nestedContent = getRecord(d.content)
  const nestedQuestion = getArray<Record<string, unknown>>(d.questions ?? nestedContent.questions)[0] ?? {}

  const localizedChoices = localizedDataValue(block, programType, 'choices')
  const raw = getArray<unknown>(
    (localizedChoices || undefined) ??
    d.options ??
    d.options_th ??
    nestedQuestion.choices ??
    nestedQuestion.options ??
    nestedQuestion.options_th ??
    b.choices ??
    []
  )
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
      const nestedContent = getRecord(innerData.content)
      const visualData = getRecord(innerData.visual_data ?? nestedContent.visual_data)
      const groups = getArray<Record<string, unknown>>(
        innerData.groups ?? innerData.items ?? innerData.bars ?? innerData.rows ?? []
      )
      const title_th = getText(innerData.title_th || innerData.title)
        || getText(innerRecord.title_th)
      const description_th = getText(innerData.description_th || innerData.description || nestedContent.description_th)
      const symbol = getText(innerData.symbol || innerData.emoji || innerData.unit || '🔢')
      // For Shape A blocks (no data wrapper): rows/cols may be at root level as width/height
      const rows = firstNumber(innerData.rows, innerData.row_count, innerData.height, innerData.length, visualData.rows, visualData.height, rawObj.height)
      const cols = firstNumber(innerData.cols, innerData.columns, innerData.column_count, innerData.width, visualData.cols, visualData.columns, visualData.width, rawObj.width)
      const total = innerData.total ?? innerData.area ?? innerData.value ?? innerData.numerator ?? visualData.total ?? (rows && cols ? rows * cols : undefined)
      const unit = getText(innerData.unit || nestedContent.unit || visualData.unit)
      return {
        block_type: 'model_diagram',
        type: 'model_diagram',
        title_th: title_th || `🟦 ${r.type!.replace(/_/g, ' ')}`,
        description_th,
        data: inner,
        groups,
        rows,
        cols,
        symbol,
        unit,
        total,
        model_type: r.type,
      } as unknown as VisualBlock
    }

    // Legacy "look first" blocks are intentionally hidden on the Grade 3 pilot.
    if (r.type === 'emoji_counter' || r.type === 'visual_thinking') {
      return null
    }

    // ── Default for other types ────────────────────────────────────────────
    // The API flattens `data` onto the block, so `...innerRecord` is the
    // primary source. The root-level fields are kept as fallbacks: a
    // model_diagram that carries its groups at the root would otherwise lose
    // them here and render as an empty section.
    const rootGroups = getArray<Record<string, unknown>>(rawObj.groups ?? rawObj.sharing_groups ?? [])
    return {
      block_type: r.type ?? 'unknown',
      title_th: getText(innerRecord.title_th) || getText(innerRecord.title) || getText(rawObj.title_th) || getText(rawObj.title),
      content: getText(innerRecord.content) || getText(innerRecord.text_th),
      description_th: getText(innerRecord.description_th) || getText(rawObj.description_th) || getText(rawObj.description),
      ...(rootGroups.length > 0 ? { groups: rootGroups } : {}),
      ...(getText(rawObj.model_type) ? { model_type: getText(rawObj.model_type) } : {}),
      ...(getText(rawObj.symbol) ? { symbol: getText(rawObj.symbol) } : {}),
      ...(getText(rawObj.emoji) ? { emoji: getText(rawObj.emoji) } : {}),
      ...(rawObj.rows !== undefined ? { rows: rawObj.rows } : {}),
      ...(rawObj.cols !== undefined ? { cols: rawObj.cols } : {}),
      ...(rawObj.total !== undefined ? { total: rawObj.total } : {}),
      ...(getText(rawObj.unit) ? { unit: getText(rawObj.unit) } : {}),
      ...innerRecord,
    } as VisualBlock
  }

  // Shape B/C: already has block_type set — pass through
  return raw as VisualBlock
}

// ─── Block 1: 🐣 Story Intro ───────────────────────────────────────────────────

function BlockStoryIntro({ block, programType }: { block: VisualBlock; programType: ProgramType }) {
  // Story section prefers visual_blocks[type=story_intro].data.content_en/content_th before short content.
  const story = localizedContentText(block, programType, 'story') || cleanText(block.description_th)
  return (
    <div className="card shadow-md bg-gradient-to-br from-yellow-50 via-white to-orange-50 border-l-4 border-yellow-400">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">🐣</span>
        <h3 className="font-bold text-yellow-800 text-base">
          {block.title_th || 'เรื่องราวชวนคิด'}
        </h3>
      </div>
      <p className="text-gray-700 text-base leading-relaxed italic">
        {story}
      </p>
    </div>
  )
}

// ─── Block 2: 👀 Visual Thinking ───────────────────────────────────────────────

function BlockThinkStory({ block, programType }: { block: VisualBlock; programType: ProgramType }) {
  // Think section prefers visual_blocks[type=think_story].data.content_en/content_th before short content.
  const content = localizedContentText(block, programType, 'think_story') || cleanText(block.description_th)
  return (
    <div className="card shadow-md bg-sky-50 border-l-4 border-sky-400">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">💡</span>
        <h3 className="font-bold text-sky-800 text-base">
          เรื่องราวชวนคิด
        </h3>
      </div>
      <p className="text-sky-900 text-sm leading-relaxed">
        {content}
      </p>
    </div>
  )
}

function BlockVisualThinking({ block }: { block: VisualBlock }) {
  const rawItems = getArray<Record<string, unknown>>(block.items)
  const hasNewFormat = rawItems.length > 0
  const data = getRecord((block as Record<string, unknown>).data)
  const paid = getNumber(data.paid ?? (block as Record<string, unknown>).paid)
  const price = getNumber(data.price ?? (block as Record<string, unknown>).price)
  const change = getNumber(data.change ?? (block as Record<string, unknown>).change)

  if (paid !== undefined && price !== undefined && change !== undefined) {
    return (
      <div className="card shadow-md bg-amber-50 border-l-4 border-amber-400">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">💰</span>
          <h3 className="font-bold text-amber-800 text-base">
            {block.title_th || 'เงินทอน'}
          </h3>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-white px-3 py-3 shadow-sm">
            <p className="text-xs font-bold text-amber-600">จ่าย</p>
            <p className="text-2xl font-extrabold text-amber-900">{paid}</p>
            <p className="text-xs text-amber-700">บาท</p>
          </div>
          <div className="rounded-xl bg-white px-3 py-3 shadow-sm">
            <p className="text-xs font-bold text-red-500">ราคา</p>
            <p className="text-2xl font-extrabold text-red-700">-{price}</p>
            <p className="text-xs text-red-600">บาท</p>
          </div>
          <div className="rounded-xl bg-white px-3 py-3 shadow-sm">
            <p className="text-xs font-bold text-green-600">เงินทอน</p>
            <p className="text-2xl font-extrabold text-green-700">{change}</p>
            <p className="text-xs text-green-600">บาท</p>
          </div>
        </div>
        <p className="mt-3 text-center text-sm font-bold text-amber-800">
          {paid} - {price} = {change}
        </p>
        {Boolean(block.description_th || data.description_th) && (
          <p className="mt-2 text-center text-xs text-amber-700">
            {getText(block.description_th || data.description_th)}
          </p>
        )}
      </div>
    )
  }

  if (hasNewFormat) {
    const emoji = getText(rawItems[0]?.emoji) || '🍎'
    const total = rawItems.reduce<number>((sum, item) => sum + (Number(item.count) || 0), 0)

    return (
      <div className="card shadow-md bg-blue-50 border-l-4 border-blue-400">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">👀</span>
          <h3 className="font-bold text-blue-800 text-base">
            {block.title_th || 'ใช้แผนภาพช่วยคิด'}
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

  if (block.description_th || block.content || data.description_th) {
    return (
      <div className="card shadow-md bg-blue-50 border-l-4 border-blue-400">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">👀</span>
          <h3 className="font-bold text-blue-800 text-base">
            {block.title_th || 'ใช้แผนภาพช่วยคิด'}
          </h3>
        </div>
        <p className="text-sm leading-relaxed text-blue-800">
          {getText(block.description_th || block.content || data.description_th)}
        </p>
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
          {block.title_th || 'ใช้แผนภาพช่วยคิด'}
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

// ─── Block 3b: 🥧 Fraction Pie Model ────────────────────────────────────────
//
// visual_blocks[type=model_diagram].data with model_type=fraction_pie_model.
// Draws a circle split into `num_parts` equal sectors, fills the first
// `shaded_parts` sectors with `shaded_color`, and shows numerator/denominator
// plus the unit name (e.g. "2/4" + "2 ส่วน จาก 4 ส่วนของเค้ก").

const PIE_VIEWBOX = 200
const PIE_CENTER = 100
const PIE_RADIUS = 88
// Upper bound for a drawable pie (one sector per degree). Anything beyond this
// is treated as corrupt data rather than attempting a huge SVG.
const PIE_MAX_PARTS = 360

type PieSector = { path: string; shaded: boolean; index: number }

/** Build the SVG sector paths for a circle split into `numParts` equal slices. */
function buildPieSectors(numParts: number, shadedParts: number): PieSector[] {
  const step = 360 / numParts
  const sectors: PieSector[] = []

  for (let i = 0; i < numParts; i++) {
    const startAngle = -90 + i * step
    const endAngle = startAngle + step
    const startRad = (startAngle * Math.PI) / 180
    const endRad = (endAngle * Math.PI) / 180
    const x1 = PIE_CENTER + PIE_RADIUS * Math.cos(startRad)
    const y1 = PIE_CENTER + PIE_RADIUS * Math.sin(startRad)
    const x2 = PIE_CENTER + PIE_RADIUS * Math.cos(endRad)
    const y2 = PIE_CENTER + PIE_RADIUS * Math.sin(endRad)
    // A slice wider than a half circle needs the large-arc flag.
    const largeArc = step > 180 ? 1 : 0

    sectors.push({
      path: `M ${PIE_CENTER} ${PIE_CENTER} L ${x1.toFixed(3)} ${y1.toFixed(3)} A ${PIE_RADIUS} ${PIE_RADIUS} 0 ${largeArc} 1 ${x2.toFixed(3)} ${y2.toFixed(3)} Z`,
      shaded: i < shadedParts,
      index: i,
    })
  }

  return sectors
}

/** Return the first value that cleans to a non-empty string. */
function firstText(...values: unknown[]): string {
  for (const value of values) {
    const text = cleanText(value)
    if (text) return text
  }
  return ''
}

function BlockFractionPieModel({ block, programType }: { block: VisualBlock; programType: ProgramType }) {
  const blockRec = block as Record<string, unknown>
  const data = getRecord(blockRec.data)

  // The API flattens `data` onto the block, so read from both places.
  const numParts = getNumber(data.num_parts ?? blockRec.num_parts)
  const shadedParts = getNumber(data.shaded_parts ?? blockRec.shaded_parts)
  const whole = getNumber(data.whole ?? blockRec.whole)

  const unitName = firstText(
    programType === 'EP' ? data.unit_name_en : data.unit_name_th,
    data.unit_name,
    blockRec.unit_name,
    blockRec.unit,
  )

  const rawColor = firstText(data.shaded_color, blockRec.shaded_color)
  const shadedColor = /^#[0-9a-fA-F]{3,8}$/.test(rawColor) ? rawColor : '#FF9999'
  const unshadedColor = '#F1F5F9'

  const description = programType === 'EP'
    ? firstText(data.description_en, data.description, blockRec.description_en, blockRec.description)
    : firstText(data.description_th, data.description, blockRec.description_th, blockRec.description)

  const title = firstText(
    programType === 'EP' ? data.title_en : data.title_th,
    data.title,
    blockRec.title_th,
    blockRec.title,
  ) || (programType === 'EP' ? 'Fraction Pie Model' : 'แบบจำลองเศษส่วน')

  const isValid =
    numParts !== undefined &&
    Number.isFinite(numParts) &&
    numParts >= 1 &&
    numParts <= PIE_MAX_PARTS &&
    shadedParts !== undefined &&
    Number.isFinite(shadedParts) &&
    shadedParts >= 0 &&
    shadedParts <= numParts

  // ── Safe fallback: incomplete data ──────────────────────────────────────
  if (!isValid) {
    return (
      <div className="card shadow-md bg-amber-50 border-l-4 border-amber-400">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">🥧</span>
          <h3 className="font-bold text-amber-800 text-base">{title}</h3>
        </div>
        <p className="text-sm leading-relaxed text-amber-800">
          {programType === 'EP'
            ? 'The fraction model data is incomplete, so the pie cannot be drawn yet.'
            : 'ข้อมูลแบบจำลองเศษส่วนยังไม่ครบ (ต้องมีจำนวนส่วนและจำนวนส่วนที่ลงสี) จึงยังวาดภาพวงกลมไม่ได้'}
        </p>
        {description && <p className="mt-2 text-xs text-slate-600">{description}</p>}
      </div>
    )
  }

  const parts = Math.floor(numParts as number)
  const shaded = Math.floor(shadedParts as number)
  const numerator = getNumber(data.numerator ?? blockRec.numerator) ?? shaded
  const denominator = getNumber(data.denominator ?? blockRec.denominator) ?? parts
  const sectors = parts === 1 ? [] : buildPieSectors(parts, shaded)

  const unitSuffix = unitName ? (programType === 'EP' ? ` the ${unitName}` : unitName) : ''
  const summaryText = unitName
    ? (programType === 'EP'
        ? `${shaded} of ${parts} parts of${unitSuffix}`
        : `${shaded} ส่วน จาก ${parts} ส่วนของ${unitSuffix}`)
    : (programType === 'EP'
        ? `${shaded} of ${parts} parts`
        : `${shaded} ส่วน จาก ${parts} ส่วน`)

  const shadedLabel = programType === 'EP' ? 'Shaded' : 'ลงสีแล้ว'
  const unshadedLabel = programType === 'EP' ? 'Not shaded' : 'ยังไม่ลงสี'

  return (
    <div className="card shadow-md bg-orange-50 border-l-4 border-orange-400">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🥧</span>
        <h3 className="font-bold text-orange-800 text-base">{title}</h3>
      </div>

      <div className="flex flex-col items-center gap-4">
        {/* Pie chart — scales with the container so it never overflows on mobile */}
        <div className="w-full max-w-[240px]">
          <svg
            viewBox={`0 0 ${PIE_VIEWBOX} ${PIE_VIEWBOX}`}
            className="w-full h-auto"
            role="img"
            aria-label={programType === 'EP' ? `${numerator}/${denominator} of ${unitName || 'the whole'}` : `เศษส่วน ${numerator}/${denominator} ของ${unitName || 'ทั้งหมด'}`}
          >
            {parts === 1 ? (
              <circle
                cx={PIE_CENTER}
                cy={PIE_CENTER}
                r={PIE_RADIUS}
                fill={shaded > 0 ? shadedColor : unshadedColor}
                stroke="#FFFFFF"
                strokeWidth={3}
              />
            ) : (
              sectors.map(sector => (
                <path
                  key={sector.index}
                  d={sector.path}
                  fill={sector.shaded ? shadedColor : unshadedColor}
                  stroke="#FFFFFF"
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                />
              ))
            )}
          </svg>
        </div>

        {/* Fraction + unit label */}
        <div className="text-center">
          <p className="text-3xl font-black leading-none text-orange-800">
            {numerator}/{denominator}
          </p>
          <p className="mt-2 text-sm font-bold text-slate-700">
            {summaryText}
          </p>
          {whole !== undefined && whole > 1 && unitName && (
            <p className="mt-1 text-xs text-slate-500">
              {programType === 'EP' ? `Total: ${whole} ${unitName}` : `ทั้งหมด ${whole} ${unitName}`}
            </p>
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-semibold text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: shadedColor }} />
            {shadedLabel} ({shaded})
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm border border-slate-300" style={{ backgroundColor: unshadedColor }} />
            {unshadedLabel} ({Math.max(parts - shaded, 0)})
          </span>
        </div>

        {description && (
          <p className="text-center text-sm leading-relaxed text-orange-900">
            {description}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Block 3: 🟦 Model Diagram ────────────────────────────────────────────────

function BlockModelDiagram({ block, programType }: { block: VisualBlock; programType: ProgramType }) {
  const rawGroups = getArray<Record<string, unknown>>(block.groups ?? block.sharing_groups ?? [])
  const symbol = getText(block.symbol) || getText(block.emoji) || '🚗'
  const data = getRecord((block as Record<string, unknown>).data)
  const modelType = cleanText(block.model_type) || cleanText(data.model_type)
  const bars = getArray<Record<string, unknown>>(data.bars ?? block.bars)

  // ── Fraction Pie Model ────────────────────────────────────────────────────
  // Circle split into num_parts equal slices, first shaded_parts filled.
  if (modelType === 'fraction_pie_model') {
    return <BlockFractionPieModel block={block} programType={programType} />
  }

  if (modelType === 'part_whole_bar' && bars.length > 0) {
    // Model diagram maps from visual_blocks[type=model_diagram].data.bars and totals.
    const unit = cleanText(data.unit)
    const partBars = bars.filter(bar => !bar.is_total && !bar.is_remainder).slice(0, 2)
    const totalBar = bars.find(bar => bar.is_total) ?? bars.find(bar => cleanText(bar.label) === 'รวม')
    const remainderBar = bars.find(bar => bar.is_remainder)
    const expenseBar = bars.find(bar => !bar.is_total && !bar.is_remainder && getNumber(bar.value) === getNumber(data.subtract_amount))

    return (
      <div className="card shadow-md bg-teal-50 border-l-4 border-teal-400">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">📊</span>
          <h3 className="font-bold text-teal-800 text-base">ใช้แผนภาพช่วยคิด</h3>
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm border border-teal-100">
            <p className="mb-3 text-sm font-extrabold text-teal-800">รวมเงินของทั้งสองคน</p>
            <div className="flex overflow-hidden rounded-xl border border-teal-100 bg-slate-50">
              {partBars.map((bar, index) => {
                const width = Math.max(20, Math.min(80, getNumber(bar.width_pct) ?? 50))
                return (
                  <div
                    key={index}
                    className="px-3 py-4 text-center text-sm font-bold text-slate-800"
                    style={{ width: `${width}%`, backgroundColor: cleanText(bar.color) || '#99f6e4' }}
                  >
                    <div>{cleanText(bar.label)}</div>
                    <div className="mt-1 text-base font-black">{cleanText(bar.display) || `${getNumber(bar.value) ?? ''} ${unit}`}</div>
                  </div>
                )
              })}
            </div>
            {totalBar && (
              <div className="mt-3 rounded-xl bg-emerald-100 px-4 py-3 text-center font-black text-emerald-900">
                รวมทั้งหมด = {cleanText(totalBar.display) || `${getNumber(totalBar.value) ?? ''} ${unit}`}
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-white px-4 py-4 text-center shadow-sm border border-teal-100">
              <p className="text-xs font-bold text-slate-500">เงินรวม</p>
              <p className="mt-1 text-xl font-black text-slate-900">{cleanText(totalBar?.display) || `${getNumber(data.whole) ?? ''} ${unit}`}</p>
            </div>
            <div className="rounded-2xl bg-white px-4 py-4 text-center shadow-sm border border-red-100">
              <p className="text-xs font-bold text-red-500">จ่ายค่าใช้จ่าย</p>
              <p className="mt-1 text-xl font-black text-red-700">-{cleanText(expenseBar?.display) || `${getNumber(data.subtract_amount) ?? ''} ${unit}`}</p>
            </div>
            <div className="rounded-2xl bg-white px-4 py-4 text-center shadow-sm border border-lime-100">
              <p className="text-xs font-bold text-lime-700">เงินที่เหลือ</p>
              <p className="mt-1 text-xl font-black text-lime-800">{cleanText(remainderBar?.display) || `${getNumber(data.final_remainder) ?? ''} ${unit}`}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Comparison Bar Model (Singapore Math ─ Comparison Model) ─────────────────
  // Usage: compare 2+ groups — "how many more / less", "times as many"
  // Renders parallel bars with proportional widths to show difference clearly.
  if (modelType === 'comparison_bar' && bars.length > 0) {
    const unit = cleanText(data.unit)
    const maxValue = Math.max(...bars.map(b => Math.abs(getNumber(b.value) ?? 0)))
    const comparisonLabel = cleanText(data.comparison_label) || 'เปรียบเทียบ'
    const comparisonType = cleanText(data.comparison_type) || 'difference' // 'difference' | 'times'
    const comparisonResultText = comparisonType === 'times'
      ? `${cleanText(data.bar_a_label || 'A')} = ${cleanText(data.comparison_result)} เท่าของ ${cleanText(data.bar_b_label || 'B')}`
      : `ส่วนต่าง = ${getNumber(data.comparison_result)?.toLocaleString() ?? ''} ${unit}`
    const relationshipText = cleanText(data.relationship)

    return (
      <div className="card shadow-md bg-blue-50 border-l-4 border-blue-400">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">📐</span>
          <h3 className="font-bold text-blue-800 text-base">แผนภาพเปรียบเทียบ (Comparison Bar Model)</h3>
        </div>

        <div className="space-y-4">
          {/* Bars section */}
          <div className="rounded-2xl bg-white p-4 shadow-sm border border-blue-100">
            <p className="mb-3 text-sm font-extrabold text-blue-800">{comparisonLabel}</p>
            <div className="flex flex-col gap-3">
              {bars.map((bar, index) => {
                const value = getNumber(bar.value) ?? 0
                const widthPct = maxValue > 0 ? Math.round((Math.abs(value) / maxValue) * 100) : 50
                const isNegative = value < 0
                return (
                  <div key={index} className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-600 w-28 shrink-0 text-right">{cleanText(bar.label)}</span>
                    <div
                      className="h-9 rounded-lg flex items-center justify-end px-3 shadow-sm text-white font-black text-sm"
                      style={{
                        width: `${widthPct}%`,
                        backgroundColor: isNegative ? '#ef4444' : (cleanText(bar.color) || '#3b82f6'),
                        minWidth: '2.5rem',
                      }}
                    >
                      {cleanText(bar.display) || `${value.toLocaleString()} ${unit}`}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Comparison result summary */}
          {data.comparison_result !== undefined && (
            <div className="rounded-2xl bg-blue-100 px-4 py-3 text-center font-black text-blue-900">
              {comparisonResultText}
            </div>
          )}

          {/* Relationship description */}
          {relationshipText && (
            <div className="rounded-2xl bg-white px-4 py-3 shadow-sm border border-blue-100 text-center text-sm text-slate-700">
              {relationshipText}
            </div>
          )}
        </div>
      </div>
    )
  }

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
  // block-level width/height from Shape A blocks (area_model with no data wrapper)
  const rows = firstNumber(block.rows, data.rows, data.height, (block as Record<string, unknown>).height)
  const cols = firstNumber(block.cols, data.cols, data.columns, data.width, (block as Record<string, unknown>).width)
  const total = getNumber(block.total ?? data.total) ?? (rows && cols ? rows * cols : undefined)
  const unit = getText(block.unit ?? data.unit)

  if (!rows || !cols) {
    const explanation = getText(block.description_th) || getText(data.description_th) || getText(data.description) || getText(data.content)
    return (
      <div className="card shadow-md bg-teal-50 border-l-4 border-teal-400">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">📊</span>
          <h3 className="font-bold text-teal-800 text-base">
            ใช้แผนภาพช่วยคิด
          </h3>
        </div>
        <p className="text-sm leading-relaxed text-teal-800">
          {explanation || 'ดูความสัมพันธ์ของจำนวนจากโจทย์ แล้วเขียนเป็นประโยควิธีทำในขั้นถัดไป'}
        </p>
      </div>
    )
  }
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
          {rows} แถว × {cols} คอลัมน์ = {total ?? rows * cols}{unit ? ` ${unit}` : ''}
        </p>
      </div>
    </div>
  )
}

// ─── Block 4: 🔢 Number Sentence ──────────────────────────────────────────────

function BlockNumberSentence({ block, programType }: { block: VisualBlock; programType: ProgramType }) {
  const data = { ...(block as Record<string, unknown>), ...getRecord((block as Record<string, unknown>).data) }
  // Number sentence maps from visual_blocks[type=number_sentence].data.operations.
  const operations = getArray<Record<string, unknown>>(data.operations)
  const expression = cleanText(data[programType === 'EP' ? 'content_en' : 'content_th']) || cleanText(data.expression) || cleanText(block.content) || cleanText(block.expression)
  const finalResult = operations.length > 0 ? operations[operations.length - 1]?.result : undefined

  return (
    <div className="card shadow-md bg-slate-50 border-l-4 border-slate-400 py-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">✍</span>
        <h3 className="font-bold text-slate-700 text-base">
          เขียนเป็นประโยควิธีทำ
        </h3>
      </div>
      {operations.length > 0 ? (
        <div className="space-y-3">
          {operations.map((operation, index) => (
            <div key={index} className="rounded-2xl bg-white px-4 py-3 shadow-sm">
              <p className="text-xs font-extrabold text-slate-500">Step {index + 1}</p>
              <p className="mt-1 text-xl font-black text-slate-900">
                {getNumber(operation.a)?.toLocaleString()} {cleanText(operation.op)} {getNumber(operation.b)?.toLocaleString()} = {getNumber(operation.result)?.toLocaleString()}
              </p>
            </div>
          ))}
          {finalResult !== undefined && (
            <div className="rounded-2xl bg-primary-50 px-4 py-3 text-center font-black text-primary-800">
              Final answer: {getNumber(finalResult)?.toLocaleString()} บาท
            </div>
          )}
        </div>
      ) : expression && (
        <p className="text-xl font-extrabold leading-relaxed text-slate-800">{expression}</p>
      )}
    </div>
  )
}

// ─── Block 5: 🎯 Mini Quiz ─────────────────────────────────────────────────────

function BlockMiniQuiz({ block, programType }: { block: VisualBlock; programType: ProgramType }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [answered, setAnswered] = useState(false)

  const blockData = getRecord((block as Record<string, unknown>).data)
  const blockContent = getRecord(blockData.content)
  const rawQuestions = getArray<Record<string, unknown>>(block.questions ?? blockData.questions ?? blockContent.questions)
  const choices = getMiniQuizChoices(block, programType)

  // Old placeholder quizzes are hidden; the pilot expects a real practice mini quiz with choices.
  if (rawQuestions.length > 0 && choices.length === 0) {
    return null
  }

  const firstQuestion = rawQuestions[0] ?? {}
  const questionText = cleanText(localizedDataValue(block, programType, 'question')) || getText(firstQuestion[programType === 'EP' ? 'question_en' : 'question_th']) || getText(firstQuestion.question) || ''
  const correctAnswerRaw = getMiniQuizCorrectAnswer(block, programType)

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
  // Practice mini quiz maps from visual_blocks[type=mini_quiz].data.
  const explanation = cleanText(localizedDataValue(block, programType, 'explanation'))

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
              {explanation ? (
                <p className="text-green-600 text-xs mt-1">
                  {explanation}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="bg-red-100 border border-red-300 rounded-xl p-3 text-center">
              <p className="text-red-800 text-sm font-bold">
                ❌ ยังไม่ถูกนะ — คำตอบที่ถูกคือ: {correctChoiceText}
              </p>
              {explanation ? (
                <p className="text-red-600 text-xs mt-1">
                  {explanation}
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

function VisualBlockRenderer({ block, programType }: { block: VisualBlock; programType: ProgramType }) {
  const rawType = block.block_type || (block as Record<string, unknown>).type as string || 'unknown'

  switch (rawType) {
    case 'story_intro':      return <BlockStoryIntro block={block} programType={programType} />
    case 'think_story':      return <BlockThinkStory block={block} programType={programType} />
    case 'visual_thinking':  return null
    case 'emoji_counter':    return null
    case 'model_diagram':     return <BlockModelDiagram block={block} programType={programType} />
    case 'grouping_model':    return <BlockModelDiagram block={block} programType={programType} />
    case 'bar_model':         return <BlockModelDiagram block={block} programType={programType} />
    case 'comparison_bar':    return <BlockModelDiagram block={block} programType={programType} />
    case 'shape_visual':     return <BlockModelDiagram block={block} programType={programType} />
    case 'ten_frame':         return <BlockModelDiagram block={block} programType={programType} />
    case 'area_model':       return <BlockModelDiagram block={block} programType={programType} />
    case 'fraction_visual':   return <BlockModelDiagram block={block} programType={programType} />
    case 'place_value_chart': return <BlockModelDiagram block={block} programType={programType} />
    case 'array_model':      return <BlockModelDiagram block={block} programType={programType} />
    case 'graph_visual':     return <BlockModelDiagram block={block} programType={programType} />
    case 'volume_visual':     return <BlockModelDiagram block={block} programType={programType} />
    case 'table_visual':      return <BlockModelDiagram block={block} programType={programType} />
    case 'count_back_strip':  return <BlockModelDiagram block={block} programType={programType} />
    case 'abstract_symbol':   return null
    case 'number_sentence':   return <BlockNumberSentence block={block} programType={programType} />
    case 'mini_quiz':        return <BlockMiniQuiz block={block} programType={programType} />
    default:
      return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          ยังไม่รองรับบล็อกชนิดนี้: {rawType}
        </div>
      )
  }
}

// ─── Block sequence labels (allowed types only) ────────────────────────────────

function isRenderableVisualBlock(block: VisualBlock, programType: ProgramType): boolean {
  const rawType = block.block_type || ((block as Record<string, unknown>).type as string) || 'unknown'
  if (rawType === 'abstract_symbol') return false
  if (rawType !== 'mini_quiz') return true
  const blockData = getRecord((block as Record<string, unknown>).data)
  const blockContent = getRecord(blockData.content)
  const rawQuestions = getArray<Record<string, unknown>>(block.questions ?? blockData.questions ?? blockContent.questions)
  const firstQuestion = rawQuestions[0] ?? {}
  const questionText = cleanText(localizedDataValue(block, programType, 'question')) || getText(firstQuestion[programType === 'EP' ? 'question_en' : 'question_th']) || getText(firstQuestion.question)
  return Boolean(questionText && getMiniQuizChoices(block, programType).length >= 2 && getMiniQuizCorrectAnswer(block, programType))
}

const BLOCK_LABELS: Record<string, string> = {
  story_intro:      'เรื่องราว',
  think_story:      'เรื่องราวชวนคิด',
  model_diagram:    'ใช้แผนภาพช่วยคิด',
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
  number_sentence:  'เขียนเป็นประโยควิธีทำ',
  mini_quiz:        'ลองทำดู',
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LessonPage() {
  const params = useParams()
  const lessonId = params.lessonId as string
  const router = useRouter()
  const searchParams = useSearchParams()
  const { checkAuth } = useAuthStore()
  const requestedProgram = searchParams.get('program_type') === 'EP' || lessonId.toLowerCase().endsWith('_ep') ? 'EP' : 'TH'

  const [phase, setPhase] = useState<Phase>('loading')
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [testLoading, setTestLoading] = useState(false)
  const [programType, setProgramType] = useState<'TH' | 'EP'>(requestedProgram)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    checkAuth().then((authenticatedUser) => {
      if (!authenticatedUser) router.push('/login')
    })
  }, [])

  const loadLesson = useCallback(async (pt?: 'TH' | 'EP') => {
    if (!lessonId) return
    setLoading(true)
    setPhase('loading')
    setErrorMsg('')
    try {
      const fetched = await meApi.getLesson(lessonId, pt)
      setLesson(fetched)
      if (pt) setProgramType(pt)
      setPhase('content')
    } catch (err: unknown) {
      const e = err as { response?: { status?: number }; message?: string }
      const status = e?.response?.status
      if (status === 404) setErrorMsg('ไม่พบบทเรียนนี้')
      else setErrorMsg('โหลดบทเรียนไม่สำเร็จ กรุณาลองใหม่')
      setPhase('error')
    } finally {
      setLoading(false)
    }
  }, [lessonId])

  useEffect(() => {
    loadLesson(requestedProgram)
  }, [loadLesson, requestedProgram])

  const handleTakeTest = async () => {
    if (!lesson) return
    setTestLoading(true)
    try {
      const { session_id } = await meApi.startLessonTest(lesson.lesson_id, programType)
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
  const testAvailable = lesson.test_available ?? lesson.has_approved_test ?? lesson.has_test !== false
  const gradeLbl = gradeLabel(lesson.grade_level)
  const cover = getTopicIllustration(lesson.topic_code, lesson.skill_code)
  const todaySeed = new Date().toISOString().slice(0, 10)
  const helperIndex = stableMascotIndex(`${lesson.lesson_id}:${todaySeed}`)
  const helperMascot = defaultMascots[helperIndex]
  const helperLine = cleanText(lesson.helper_tip) || (lesson.topic_code?.includes('word') || lesson.skill_code?.includes('word')
    ? 'ลองแบ่งโจทย์เป็นขั้นตอนเล็ก ๆ แล้ววงตัวเลขสำคัญก่อนนะ'
    : lesson.topic_code?.includes('geometry') || lesson.skill_code?.includes('shape')
      ? 'ข้อนี้ใช้การนึกภาพหรือวาดรูปช่วยให้เห็นความสัมพันธ์ได้ง่ายขึ้น'
      : 'อ่านตัวอย่างให้จบก่อน แล้วลองอธิบายวิธีคิดด้วยคำของตัวเอง')

  const displayBlocks = (lesson.visual_blocks ?? [])
    .map(raw => normalizeVisualBlock(raw))
    .filter((block): block is VisualBlock => block !== null)
    .filter(block => isRenderableVisualBlock(block, programType))

  if (!isLocked && (!BETA_READY_LESSON_GRADES.has(Number(lesson.grade_level)) || displayBlocks.length === 0)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="card max-w-md text-center py-12">
          <div className="text-4xl mb-4">...</div>
          <h2 className="text-xl font-extrabold text-gray-900 mb-2">Coming Soon</h2>
          <p className="text-gray-500 mb-6">This lesson is disabled during the closed beta.</p>
          <Link href="/dashboard" className="btn-primary px-8 py-3">Back to dashboard</Link>
        </div>
      </div>
    )
  }

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

        <div className="mb-5 overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm">
          <div className="grid items-center gap-4 p-5 sm:grid-cols-[240px_1fr] lg:grid-cols-[300px_1fr]">
            <div className="mx-auto flex h-44 w-44 items-center justify-center bg-transparent sm:h-56 sm:w-56 lg:h-[300px] lg:w-[300px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={helperMascot.image}
                alt={helperMascot.name}
                className="max-h-full max-w-full object-contain drop-shadow-lg"
              />
            </div>
            <div className="text-center sm:text-left">
              <p className="text-sm font-black text-sky-500">{helperMascot.name} แนะนำวันนี้</p>
              <p className="mt-2 text-lg font-extrabold leading-8 text-slate-800">{helperLine}</p>
            </div>
          </div>
        </div>

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
            {displayBlocks.length > 0 ? (
              <div className="space-y-4">
                {displayBlocks.map((block, i) => {
                  const type = block.block_type
                  return (
                    <div key={i}>
                      {/* Sequence number + label */}
                      <div className="text-xs font-bold text-gray-400 mb-1.5 flex items-center gap-1">
                        <span>{i + 1}.</span>
                        <span>{BLOCK_LABELS[type] ?? type}</span>
                      </div>
                      <VisualBlockRenderer block={block} programType={programType} />
                    </div>
                  )
                })}
              </div>
            ) : (
              /* ── No visual blocks — show brief fallback text ── */
              <div className="card shadow-md text-center py-10">
                <div className="inline-flex text-xs font-bold bg-amber-100 text-amber-700 px-3 py-1 rounded-full mb-3">
                  กำลังตรวจบทเรียน
                </div>
                <p className="text-gray-500">บทเรียนนี้จะเปิดเมื่อผ่าน QA สำหรับ Beta</p>
              </div>
            )}

            {/* ── Actions ── */}
            <div className="mt-8 flex gap-3">
              {!testAvailable ? (
                <div className="flex-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center">
                  <p className="text-sm font-bold text-amber-800">แบบทดสอบกำลังตรวจ QA</p>
                  <p className="text-xs text-amber-700 mt-1">{lesson.test_unavailable_reason || 'อ่านบทเรียนได้ตามปกติ แต่ยังไม่เปิดแบบทดสอบสำหรับบทนี้'}</p>
                </div>
              ) : (
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
