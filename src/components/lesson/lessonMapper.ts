import { GLOSSARY_DB } from './glossary'
import type {
  BarModelConfig,
  Base10Config,
  ClockConfig,
  FractionConfig,
  LessonProblem,
  LessonStep,
  MicroStep,
  PlaceValueConfig,
  QuestionSegment,
  WorkspaceType,
} from './types'

/**
 * Turns the real lesson view model that the FastAPI backend returns into the
 * `LessonProblem[]` contract the interactive lesson shell consumes.
 *
 * The backend serves every lesson as content blocks:
 *   - `visual_blocks`  -> the manipulative model (bar model, fraction pie, ...)
 *   - `questions`      -> the practice questions of the selected variant
 *   - `hints`          -> progressive hints
 *   - `explanation_steps` -> the worked solution
 *   - `key_vocabulary` -> the maths words of the lesson
 *   - `worked_examples` / `common_mistakes` -> extra teaching material
 *
 * Everything in this module is pure so the page can memoise it and the
 * mapping stays unit-testable without a browser.
 */

/* ------------------------------------------------------------------ */
/* Loose accessors - the API payload is intentionally loosely typed.    */
/* ------------------------------------------------------------------ */

type RawRecord = Record<string, unknown>

export function asRecord(value: unknown): RawRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as RawRecord)
    : {}
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

export function asText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

export function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const match = value.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)
    if (match) {
      const parsed = Number(match[0])
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return undefined
}

/** `type` or `block_type` - the API uses both depending on the endpoint. */
export function blockType(block: unknown): string {
  const record = asRecord(block)
  return asText(record.type) || asText(record.block_type)
}

/**
 * The payload of one visual block.
 *
 * The backend flattens the inner `data` object onto the block for some
 * endpoints and keeps it nested for others, so both places are merged.
 */
export function blockData(block: unknown): RawRecord {
  const record = asRecord(block)
  const nested = asRecord(record.data)
  const root: RawRecord = {}
  for (const [key, value] of Object.entries(record)) {
    if (key === 'type' || key === 'block_type' || key === 'data') continue
    root[key] = value
  }
  return { ...root, ...nested }
}

/* ------------------------------------------------------------------ */
/* Public shapes of the lesson payload                                 */
/* ------------------------------------------------------------------ */

export interface RawQuestion {
  question_id?: string
  question_th?: string
  question_en?: string
  choices?: string[]
  correct_index?: number
  correct_answer?: string
  explanation_th?: string
  explanation_en?: string
}

export interface RawKeyVocabulary {
  th?: string
  en?: string
  definition_th?: string
  definition_en?: string
}

export interface RawWorkedExample {
  title_th?: string
  title_en?: string
  question_th?: string
  question_en?: string
  solution_th?: string
  solution_en?: string
}

export interface LessonContentBundle {
  lessonId: string
  gradeLevel: number
  titleTH: string
  titleEN: string
  variantTitleTH?: string
  variantTitleEN?: string
  storyTH?: string
  storyEN?: string
  thinkStoryTH?: string
  thinkStoryEN?: string
  helperTipTH?: string
  hints?: string[]
  explanationSteps?: string[]
  commonMistakes?: string[]
  workedExamples?: RawWorkedExample[]
  keyVocabulary?: RawKeyVocabulary[]
  questions?: RawQuestion[]
  visualBlocks?: unknown[]
  /** Fallback question when the lesson has neither questions nor a mini quiz. */
  practiceQuestion?: string
  practiceChoices?: string[]
  practiceAnswer?: string
  programType?: 'TH' | 'EP'
}

/* ------------------------------------------------------------------ */
/* Question tokenising - mirrors the Primary Math prototype            */
/* ------------------------------------------------------------------ */

const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙'

/** Converts Thai digits into Arabic ones so the tokeniser can read them. */
export function normaliseThaiDigits(text: string): string {
  let out = ''
  for (const char of text) {
    const index = THAI_DIGITS.indexOf(char)
    out += index === -1 ? char : String(index)
  }
  return out
}

/** The first number mentioned in a text (e.g. "24 ผล" -> 24). */
export function firstNumber(text: string): number | undefined {
  const match = normaliseThaiDigits(text).replace(/,/g, '').match(/\d+(?:\.\d+)?/)
  if (!match) return undefined
  const value = Number(match[0])
  return Number.isFinite(value) ? value : undefined
}

/** The first "a/b" fraction mentioned in a text. */
export function firstFraction(text: string): { numerator: number; denominator: number } | null {
  const match = normaliseThaiDigits(text).match(/(\d+)\s*\/\s*(\d+)/)
  if (!match) return null
  return { numerator: Number(match[1]), denominator: Number(match[2]) }
}

/** The first clock time mentioned in a text ("08:50 น." -> 08:50). */
export function firstClockTime(text: string): { hour: number; minute: number } | null {
  const match = normaliseThaiDigits(text).match(/(\d{1,2}):(\d{2})/)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  return { hour, minute }
}

/**
 * Glossary terms per language.
 *
 * The keys must match `GLOSSARY_DB` so the clickable term in the question
 * opens the right visual glossary card.
 */
const GLOSSARY_TERMS: Array<{ key: string; th: string[]; en: string[] }> = [
  { key: 'altogether', th: ['รวมกันทั้งหมด', 'รวมทั้งหมด'], en: ['altogether'] },
  { key: 'tens', th: ['หลักสิบ'], en: ['tens'] },
  { key: 'difference', th: ['ผลต่าง'], en: ['difference'] },
  { key: 'ratio', th: ['อัตราส่วน'], en: ['ratio'] },
  { key: 'perimeter', th: ['ความยาวรอบรูป'], en: ['perimeter'] },
  { key: 'equal_parts', th: ['ส่วนที่เท่ากัน', 'ส่วนเท่ากัน'], en: ['equal parts'] },
]

interface TokenHit {
  start: number
  end: number
  text: string
  kind: 'number' | 'term'
  termKey?: string
}

function findHits(text: string, language: 'TH' | 'EN'): TokenHit[] {
  const hits: TokenHit[] = []

  const numberPattern = /\d[\d,]*(?:\.\d+)?/g
  let match: RegExpExecArray | null
  while ((match = numberPattern.exec(text)) !== null) {
    hits.push({ start: match.index, end: match.index + match[0].length, text: match[0], kind: 'number' })
  }

  for (const entry of GLOSSARY_TERMS) {
    const words = language === 'TH' ? entry.th : entry.en
    for (const word of words) {
      if (!word) continue
      const haystack = language === 'TH' ? text : text.toLowerCase()
      const needle = language === 'TH' ? word : word.toLowerCase()
      let index = haystack.indexOf(needle)
      while (index !== -1) {
        // Skip hits that are already covered by a number token.
        const overlaps = hits.some(
          (hit) => index < hit.end && index + needle.length > hit.start,
        )
        if (!overlaps) {
          hits.push({
            start: index,
            end: index + needle.length,
            text: text.slice(index, index + needle.length),
            kind: 'term',
            termKey: entry.key,
          })
        }
        index = haystack.indexOf(needle, index + needle.length)
      }
    }
  }

  return hits.sort((a, b) => a.start - b.start)
}

/**
 * Splits a question into the token stream the problem zone renders:
 * plain text, highlighted numbers and clickable glossary terms.
 */
export function tokenizeQuestion(text: string, language: 'TH' | 'EN'): QuestionSegment[] {
  const clean = text.trim()
  if (!clean) return []

  const hits = findHits(clean, language)
  const segments: QuestionSegment[] = []
  let cursor = 0

  for (const hit of hits) {
    if (hit.start > cursor) {
      segments.push({ text: clean.slice(cursor, hit.start) })
    }
    if (hit.kind === 'number') {
      segments.push({ text: hit.text, highlight: true })
    } else if (hit.termKey && GLOSSARY_DB[hit.termKey]) {
      segments.push({
        term: hit.termKey,
        display: language === 'TH' ? GLOSSARY_DB[hit.termKey].th : GLOSSARY_DB[hit.termKey].en,
      })
    } else {
      segments.push({ text: hit.text })
    }
    cursor = hit.end
  }

  if (cursor < clean.length) {
    segments.push({ text: clean.slice(cursor) })
  }

  return segments
}

/* ------------------------------------------------------------------ */
/* Answer resolution                                                   */
/* ------------------------------------------------------------------ */

/**
 * Finds the correct answer inside the choice list.
 *
 * The content files use `correct_answer`, `correctAnswer`, `answer` or a
 * `correct_index`, and the value is sometimes a letter (A-D) and sometimes
 * the choice text itself.
 */
export function resolveCorrectAnswer(
  choices: string[],
  raw: { correct_answer?: unknown; correctAnswer?: unknown; answer?: unknown; correct_index?: unknown },
): string {
  for (const candidate of [raw.correct_answer, raw.correctAnswer, raw.answer]) {
    const value = asText(candidate)
    if (!value) continue
    if (choices.includes(value)) return value

    const upper = value.toUpperCase()
    if (/^[A-D]$/.test(upper)) {
      const index = upper.charCodeAt(0) - 65
      if (choices[index]) return choices[index]
    }

    const numeric = asNumber(value)
    if (numeric !== undefined) {
      const byNumber = choices.find((choice) => asNumber(choice) === numeric)
      if (byNumber) return byNumber
    }

    const byWord = choices.find((choice) => choice.trim() === value.trim())
    if (byWord) return byWord
  }

  const index = asNumber(raw.correct_index)
  if (index !== undefined && choices[index]) return choices[index]

  return ''
}

/* ------------------------------------------------------------------ */
/* Workspace derivation                                                */
/* ------------------------------------------------------------------ */

export interface WorkspaceSelection {
  workspaceType: WorkspaceType
  base10Config?: Base10Config
  barModelConfig?: BarModelConfig
  fractionConfig?: FractionConfig
  clockConfig?: ClockConfig
  placeValueConfig?: PlaceValueConfig
}

const DEFAULT_UNIT_EMOJI = '🔢'
const FLOWER_EMOJI = '🌼'

/**
 * The base-10 board draws tens rods and ones cubes, so it carries at most
 * 99 units. Bigger amounts belong on the bar model.
 */
const MAX_BASE10_VALUE = 99

function modelDataOf(blocks: unknown[]): RawRecord {
  const block = blocks.find((candidate) => blockType(candidate) === 'model_diagram')
  return block ? blockData(block) : {}
}

function fractionFromText(value: string): { numerator: number; denominator: number } | null {
  const match = value.match(/(\d+)\s*\/\s*(\d+)/)
  if (!match) return null
  return { numerator: Number(match[1]), denominator: Number(match[2]) }
}

function parseClock(value: string): { hour: number; minute: number } | null {
  const match = value.match(/(\d{1,2}):(\d{2})/)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  return { hour, minute }
}

/** Greatest common divisor - used to find a clean unit for a bar model. */
function greatestCommonDivisor(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y) {
    const next = x % y
    x = y
    y = next
  }
  return x || 1
}


/** Builds a base-10 board config, or null when the numbers do not fit. */
function makeBase10(initial: number, target: number, emoji?: string): Base10Config | null {
  if (!Number.isFinite(initial) || !Number.isFinite(target)) return null
  if (initial < 0 || target < 0) return null
  if (initial > MAX_BASE10_VALUE || target > MAX_BASE10_VALUE) return null
  return {
    initialTens: Math.floor(initial / 10),
    initialOnes: initial % 10,
    targetTens: Math.floor(target / 10),
    targetOnes: target % 10,
    unitEmoji: emoji ?? DEFAULT_UNIT_EMOJI,
  }
}

/** The largest amount of bars one bar model can hold. */
const MAX_BAR_PARTS = 6

/**
 * The place-value chart carries numbers that the base-10 board cannot show.
 *
 * The base-10 board stops at 99 and the bar model needs two amounts that
 * split into the same small unit, so a five digit amount (52,400) or a
 * three digit amount (200) has no manipulative at all. The place-value
 * chart is the board that carries those numbers.
 */
const MIN_PLACE_VALUE_NUMBER = 100

/** Thai names of the places, from the ones upwards. */
const PLACE_NAMES_TH = ['หน่วย', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน']

/** Splits a number into its digits and the worth of every digit. */
function placeValueParts(number: number): {
  digits: number[]
  places: string[]
  values: number[]
} {
  const safe = Math.max(0, Math.round(Math.abs(number)))
  const digits = String(safe).split('').map((char) => Number(char))
  const places = digits.map((_, index) => {
    const exponent = digits.length - 1 - index
    return PLACE_NAMES_TH[exponent] ?? `หลัก ${10 ** exponent}`
  })
  const values = digits.map((digit, index) => digit * 10 ** (digits.length - 1 - index))
  return { digits, places, values }
}

/** Builds the place-value chart of one number. */
function makePlaceValue(
  number: number,
  extra: { operation?: PlaceValueConfig['operation']; subtrahend?: number; unit?: string } = {},
): PlaceValueConfig {
  const { digits, places, values } = placeValueParts(number)
  return {
    digits,
    places,
    values,
    number: Math.max(0, Math.round(Math.abs(number))),
    ...extra,
  }
}

/**
 * Reads the place-value table a lesson carries as its own model.
 *
 * The content files hold the digits of the number, the name of every place
 * and the worth of every digit, so the board shows exactly the table the
 * lesson taught (45,830 -> หมื่น 4 / พัน 5 / ร้อย 8 / สิบ 3 / หน่วย 0).
 *
 * When the question asks about another number of the same size (the quiz
 * asks about 62,407 while the story counts 45,830 flags), the board shows
 * the number of the question: the learner then reads the place and its
 * worth straight off the chart.
 */
function placeValueFromModel(data: RawRecord, questionText: string): PlaceValueConfig | null {
  const number = asNumber(data.number) ?? asNumber(data.total)
  if (number === undefined) return null

  const places = asArray(data.places ?? data.places_th ?? data.places_en)
    .map((value) => asText(value))
    .filter(Boolean)

  const modelDigits = asArray(data.digits)
    .map((value) => asNumber(value))
    .filter((value): value is number => value !== undefined)
  const modelValues = asArray(data.values)
    .map((value) => asNumber(value))
    .filter((value): value is number => value !== undefined)

  // The number of the question, when it has as many digits as the model's.
  const columnCount = modelDigits.length || String(Math.round(Math.abs(number))).length
  const questionNumber = numbersIn(questionText)
    .filter((value) => Number.isInteger(value) && value > 0)
    .filter((value) => String(Math.abs(value)).length === columnCount)
    .sort((a, b) => b - a)[0]

  const shown = questionNumber ?? number
  const fallback = placeValueParts(shown)
  const unit = asText(data.unit)

  return {
    digits: fallback.digits,
    places: places.length === columnCount ? places : fallback.places,
    values: fallback.values,
    number: Math.max(0, Math.round(Math.abs(shown))),
    ...(unit ? { unit } : {}),
    ...(modelValues.length === columnCount && shown === number
      ? { values: modelValues }
      : {}),
  }
}

/**
 * The unit that follows the number in an answer, e.g. "125 ซม." -> "ซม.".
 *
 * The board shows the numbers of the question, so it also shows their unit.
 */
function unitFromAnswer(answerText: string): string | undefined {
  const match = normaliseThaiDigits(answerText).match(/^\s*[\d,.]+\s*([^\d\s][^\d]{0,9})/)
  if (!match) return undefined
  const unit = match[1].trim()
  return unit || undefined
}

/**
 * The subtraction a lesson asks for, read from the question's own numbers.
 *
 * The two amounts of the question are tried against the expected answer, so
 * only a real subtraction of the lesson is picked up: 52,400 - 28,600 with
 * the answer 23,800 gives the minuend and the subtrahend.
 */
function subtractionInQuestion(
  questionText: string,
  answerNumber: number | undefined,
): { minuend: number; subtrahend: number } | null {
  if (answerNumber === undefined) return null
  const numbers = numbersIn(questionText).filter((value) => Number.isInteger(value))
  for (const minuend of numbers) {
    for (const subtrahend of numbers) {
      if (minuend === subtrahend) continue
      if (minuend - subtrahend !== answerNumber) continue
      return { minuend, subtrahend }
    }
  }
  return null
}

/** The two amounts a lesson compares: "45,830 มากกว่า 12,300". */
function comparisonInQuestion(
  questionText: string,
): { bigger: number; smaller: number } | null {
  const normalised = normaliseThaiDigits(questionText)
  if (!/มากกว่า|น้อยกว่า|มากกว่ากัน|มากที่สุด|น้อยที่สุด/.test(normalised)) return null
  const numbers = numbersIn(normalised)
    .filter((value) => Number.isInteger(value) && value >= MIN_PLACE_VALUE_NUMBER)
    .sort((a, b) => b - a)
  if (numbers.length < 2) return null
  return { bigger: numbers[0], smaller: numbers[1] }
}

/**
 * Whether the lesson's own model is about taking something away.
 *
 * The model's operation is the lesson's own statement of what the learner
 * does with the numbers, so it decides which manipulative fits: a lesson
 * that subtracts gets the place-value chart, a lesson that compares two
 * amounts keeps its bar model.
 */
function modelSubtracts(data: RawRecord): boolean {
  const operation = asText(data.operation)
  const modelType = asText(data.model_type)
  return operation.includes('subtract') || modelType.includes('subtract')
}

interface QuantityCandidate {
  labelTH: string
  labelEN: string
  value: number
}

/** The comparable quantities of a bar-style model. */
function barCandidates(data: RawRecord): QuantityCandidate[] {
  const candidates: QuantityCandidate[] = []
  const push = (labelTH: unknown, labelEN: unknown, value: unknown) => {
    const numeric = asNumber(value)
    if (numeric === undefined || numeric <= 0) return
    candidates.push({
      labelTH: asText(labelTH) || asText(labelEN) || 'กลุ่ม',
      labelEN: asText(labelEN) || asText(labelTH) || 'Group',
      value: numeric,
    })
  }

  const bars = asArray(data.bars).map((entry) => asRecord(entry))
  for (const bar of bars) {
    if (bar.is_total === true || bar.is_remainder === true) continue
    push(bar.label, bar.label, bar.value)
  }

  const parts = asArray(data.parts)
    .map((value) => asNumber(value))
    .filter((value): value is number => value !== undefined)
  if (parts.length >= 2) {
    push('ส่วนที่ 1', 'Part 1', parts[0])
    push('ส่วนที่ 2', 'Part 2', parts[1])
  }

  const items = asArray(data.items).map((entry) => asRecord(entry))
  if (items.length >= 2) {
    push(items[0].name, items[0].name, items[0].amount)
    push(items[1].name, items[1].name, items[1].amount)
  }

  return candidates
}

/**
 * Builds a bar model when both quantities split into the same equal unit.
 *
 * The unit is chosen so the board shows the lesson's own numbers, e.g.
 * 1,250 baht and 875 baht become 5 and 3.5 parts of 250 baht - the amounts
 * stay readable instead of being rounded away.
 */
function barModelFrom(
  labelA: QuantityCandidate,
  labelB: QuantityCandidate,
  totalValue: number | undefined,
): WorkspaceSelection | null {
  const unit = findExactBarFit(labelA.value, labelB.value) ?? findBarUnit(labelA.value, labelB.value)
  if (!unit) return null
  return {
    workspaceType: 'barModel',
    barModelConfig: {
      labelA_TH: labelA.labelTH,
      labelA_EN: labelA.labelEN,
      labelB_TH: labelB.labelTH,
      labelB_EN: labelB.labelEN,
      defaultPartsA: unit.partsA,
      defaultPartsB: unit.partsB,
      unitValue: unit.unit,
      ...(totalValue !== undefined ? { totalValue } : {}),
    },
  }
}

/** Reads one row of a shape attribute table (array row or object row). */
function shapeRow(row: unknown): { label: string; sides?: number } {
  if (Array.isArray(row)) {
    return { label: asText(row[0]), sides: asNumber(row[1]) }
  }
  const record = asRecord(row)
  return {
    label:
      asText(record.label_th) ||
      asText(record.label) ||
      asText(record['รูปร่าง']) ||
      asText(record.shape),
    sides:
      asNumber(record.sides) ??
      asNumber(record['จำนวนด้าน']) ??
      asNumber(record.side_count),
  }
}

/**
 * Every number of a text, Thai digits included.
 *
 * Thousands separators are grouped as `52,400`, but a Thai sentence uses
 * the comma as a list separator (`3, 4`), so only a group of exactly
 * three digits counts as a thousands separator.
 */
export function numbersIn(text: string): number[] {
  const normalised = normaliseThaiDigits(text)
  const matches = normalised.match(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g)
  if (!matches) return []
  return matches
    .map((match) => Number(match.replace(/,/g, '')))
    .filter((value) => Number.isFinite(value))
}

/** The two bar labels a model contributes, with readable fallbacks. */
function barLabels(data: RawRecord): {
  labelA_TH: string
  labelA_EN: string
  labelB_TH: string
  labelB_EN: string
} {
  const bars = asArray(data.bars).map((entry) => asRecord(entry))
  const named = bars.filter((bar) => bar.is_total !== true && bar.is_remainder !== true)
  const first = named[0] ?? bars[0] ?? {}
  const second = named[1] ?? bars[1] ?? {}

  const items = asArray(data.items).map((entry) => asRecord(entry))
  const firstItem = items[0] ?? {}
  const secondItem = items[1] ?? {}

  const labelA_TH = asText(first.label) || asText(firstItem.name) || 'ส่วนที่ 1'
  const labelA_EN = asText(first.label) || asText(firstItem.name) || 'Part 1'
  const labelB_TH = asText(second.label) || asText(secondItem.name) || 'ส่วนที่ 2'
  const labelB_EN = asText(second.label) || asText(secondItem.name) || 'Part 2'

  return { labelA_TH, labelA_EN, labelB_TH, labelB_EN }
}

/**
 * Finds a unit that splits both quantities into whole bars of at most
 * `maxParts` units.
 *
 * The values are scaled to integers first, so decimal amounts (money in
 * kilograms, decimals in baht) divide exactly as well.
 */
export function findExactBarFit(
  valueA: number,
  valueB: number,
  maxParts = MAX_BAR_PARTS,
): { unit: number; partsA: number; partsB: number } | null {
  if (!Number.isFinite(valueA) || !Number.isFinite(valueB)) return null
  if (valueA <= 0 || valueB <= 0) return null

  const decimals = Math.max(
    (String(valueA).split('.')[1] ?? '').length,
    (String(valueB).split('.')[1] ?? '').length,
  )
  const scale = 10 ** Math.min(decimals, 4)
  const scaledA = Math.round(valueA * scale)
  const scaledB = Math.round(valueB * scale)
  if (scaledA <= 0 || scaledB <= 0) return null

  // Prefer the split with the most bars, because that is what a learner can
  // actually see and manipulate on the board.
  for (let parts = maxParts; parts >= 1; parts -= 1) {
    if (scaledA % parts !== 0) continue
    const unit = scaledA / parts
    if (scaledB % unit !== 0) continue
    const otherParts = scaledB / unit
    if (otherParts < 1 || otherParts > maxParts) continue
    return { unit: unit / scale, partsA: parts, partsB: otherParts }
  }

  return null
}

/**
 * Finds a unit that splits both quantities into whole bars.
 *
 * Kept for lessons whose two amounts do not share a small divisor: the
 * quantities are then scaled by a round factor (hundreds, thousands) so the
 * board still shows the lesson's own numbers.
 */
export function findBarUnit(
  valueA: number,
  valueB: number,
  maxParts = MAX_BAR_PARTS,
): { unit: number; partsA: number; partsB: number } | null {
  if (!Number.isFinite(valueA) || !Number.isFinite(valueB)) return null
  if (valueA <= 0 || valueB <= 0) return null

  const decimals = Math.max(
    (String(valueA).split('.')[1] ?? '').length,
    (String(valueB).split('.')[1] ?? '').length,
  )
  const scale = 10 ** Math.min(decimals, 4)
  const scaledA = Math.round(valueA * scale)
  const scaledB = Math.round(valueB * scale)

  const divisors = new Set<number>()
  for (let d = 1; d * d <= scaledA; d += 1) {
    if (scaledA % d !== 0) continue
    divisors.add(d)
    divisors.add(scaledA / d)
  }

  let best: { unit: number; partsA: number; partsB: number } | null = null
  for (const divisor of divisors) {
    if (scaledB % divisor !== 0) continue
    const partsA = scaledA / divisor
    const partsB = scaledB / divisor
    if (partsA < 1 || partsA > maxParts || partsB < 1 || partsB > maxParts) continue
    if (!best || partsA + partsB > best.partsA + best.partsB) {
      best = { unit: divisor / scale, partsA, partsB }
    }
  }
  return best
}

/**
 * Chooses the manipulative that matches the lesson's own model diagram and
 * fills it with the numbers of that very lesson.
 *
 * Every number that reaches the board comes from the lesson content, so the
 * board never shows a value the lesson did not ask for. When a lesson uses
 * numbers no manipulative can carry (a five digit amount, an amount that does
 * not split into equal bars) the workspace stays empty on purpose and the
 * learner works the problem by reading, thinking and choosing.
 */
export function deriveWorkspace(
  blocks: unknown[],
  questionText: string,
  answerText: string,
): WorkspaceSelection {
  const data = modelDataOf(blocks)
  const modelType = asText(data.model_type)
  const answerNumber = firstNumber(answerText)

  /* --- Fractions ------------------------------------------------- */
  if (modelType.includes('fraction')) {
    const bars = asArray(data.bars).map((entry) => asRecord(entry))
    const firstBar = asRecord(bars[0])
    const barFraction = firstFraction(`${asText(firstBar.display)} ${asText(firstBar.label)}`)
    const denominator =
      asNumber(data.denominator) ?? asNumber(data.num_parts) ?? barFraction?.denominator ?? undefined
    const numerator =
      asNumber(data.numerator) ?? asNumber(data.shaded_parts) ?? barFraction?.numerator ?? undefined
    const shaded = asNumber(data.shaded_parts) ?? numerator ?? 1
    const finalNumerator = numerator ?? shaded
    const finalDenominator = denominator ?? 4
    // The answer is the fraction the learner has to build, e.g. "2/6".
    const target = firstFraction(answerText)
    return {
      workspaceType: 'fraction',
      fractionConfig: {
        numerator: finalNumerator,
        denominator: finalDenominator,
        shadedParts: Math.min(shaded, finalDenominator),
        targetNumerator: target?.numerator ?? finalNumerator,
        targetDenominator: target?.denominator ?? finalDenominator,
      },
    }
  }

  /* --- Time ------------------------------------------------------ */
  if (modelType.includes('timeline') || modelType.includes('clock')) {
    const events = asArray(data.events).map((entry) => asRecord(entry))
    const startFromModel = firstClockTime(asText(asRecord(events[0]).time))
    const startFromQuestion = firstClockTime(questionText)
    const target = firstClockTime(answerText)
    const start = startFromQuestion ?? startFromModel ?? { hour: 12, minute: 0 }
    return {
      workspaceType: 'clock',
      clockConfig: {
        hour: start.hour,
        minute: start.minute,
        ...(target ? { targetHour: target.hour, targetMinute: target.minute } : {}),
      },
    }
  }

  /* --- Multiplication arrays: flowers on the board ---------------- */
  if (modelType.includes('array')) {
    const rows = asNumber(data.rows)
    const cols = asNumber(data.cols)
    const total = rows !== undefined && cols !== undefined ? rows * cols : asNumber(data.total)
    // "แจกันละ 7 ดอก" - the amount that goes into one container.
    const perContainer = firstNumber(/ละ\s*(\d+(?:\.\d+)?)/.exec(questionText)?.[1] ?? '')
    const initial = perContainer ?? total
    const target = answerNumber ?? total
    const config = makeBase10(initial ?? 0, target ?? initial ?? 0, FLOWER_EMOJI)
    if (config) return { workspaceType: 'base10', base10Config: config }
    return { workspaceType: 'none' }
  }

  /* --- Equal sharing: the items that get shared out -------------- */
  if (modelType.includes('equal_sharing')) {
    const total = firstNumber(questionText) ?? asNumber(data.total_items)
    const target = answerNumber ?? asNumber(data.items_per_group)
    const config = makeBase10(total ?? 0, target ?? total ?? 0)
    if (config) return { workspaceType: 'base10', base10Config: config }
    return { workspaceType: 'none' }
  }

  /* --- Pictograph: compare the two favourite categories ----------- */
  if (modelType.includes('pictograph') || modelType.includes('bar_chart')) {
    const categories = asArray(data.categories)
      .map((entry) => asRecord(entry))
      .filter((entry) => asNumber(entry.value) !== undefined)
      .sort((a, b) => (asNumber(b.value) ?? 0) - (asNumber(a.value) ?? 0))
    if (categories.length >= 2) {
      const first: QuantityCandidate = {
        labelTH: asText(categories[0].label) || 'กลุ่มที่ 1',
        labelEN: asText(categories[0].label) || 'Group 1',
        value: asNumber(categories[0].value) ?? 0,
      }
      const second: QuantityCandidate = {
        labelTH: asText(categories[1].label) || 'กลุ่มที่ 2',
        labelEN: asText(categories[1].label) || 'Group 2',
        value: asNumber(categories[1].value) ?? 0,
      }
      const selection = barModelFrom(first, second, asNumber(data.total_value))
      if (selection) return selection
    }
    return { workspaceType: 'none' }
  }

  /* --- Shape attribute table: compare the number of sides -------- */
  if (modelType.includes('shape')) {
    const rows = asArray(data.rows)
    const first = shapeRow(rows[0])
    const second = shapeRow(rows[1])
    if (first.sides !== undefined && second.sides !== undefined) {
      return {
        workspaceType: 'barModel',
        barModelConfig: {
          labelA_TH: first.label || 'รูปที่ 1',
          labelA_EN: first.label || 'Shape 1',
          labelB_TH: second.label || 'รูปที่ 2',
          labelB_EN: second.label || 'Shape 2',
          defaultPartsA: first.sides,
          defaultPartsB: second.sides,
          unitValue: 1,
          totalValue: first.sides + second.sides,
        },
      }
    }
    return { workspaceType: 'none' }
  }

  /* --- Place value table: the columns of one number -------------- */
  if (modelType.includes('place_value')) {
    const config = placeValueFromModel(data, questionText)
    if (config) return { workspaceType: 'placeValue', placeValueConfig: config }
  }

  /* --- Everything else with bars: part-whole, comparison, money, -- */
  /* --- weight, length, decimals ----------------------------------- */
  /*
   * These lessons ask about one amount against another (e.g. 1,200 g in
   * total, 450 g of it is one kind of fruit). The two numbers that matter
   * are the ones in the question itself, so they are read from the question
   * text and the model is used for the labels and the unit.
   */
  const questionNumbers = numbersIn(questionText)
  const answerNumbers = numbersIn(answerText)
  const modelTotal =
    asNumber(data.whole) ??
    asNumber(data.total) ??
    asNumber(data.total_value) ??
    asNumber(data.goal) ??
    undefined

  /*
   * A column subtraction of a number of a hundred and above.
   *
   * Neither the base-10 board (it stops at 99) nor the bar model (it needs
   * two amounts that split into the same small unit) can carry
   * 52,400 - 28,600, so the place-value chart is the board for it: the
   * learner sees every place of the minuend, takes the subtrahend off
   * column by column and borrows from the column on the left when a
   * column runs out.
   *
   * The lesson's own model decides that this is a subtraction, so a lesson
   * that compares two amounts (the money lesson) keeps its bar model.
   */
  const subtraction = subtractionInQuestion(questionText, answerNumber)
  if (
    subtraction &&
    subtraction.minuend >= MIN_PLACE_VALUE_NUMBER &&
    modelSubtracts(data)
  ) {
    const unit = unitFromAnswer(answerText)
    return {
      workspaceType: 'placeValue',
      placeValueConfig: makePlaceValue(subtraction.minuend, {
        operation: 'subtract',
        subtrahend: subtraction.subtrahend,
        ...(unit ? { unit } : {}),
      }),
    }
  }
  const pool: QuantityCandidate[] = []
  const labels = barLabels(data)

  // The two amounts of the question: the biggest one and the one the
  // question is about (usually the last number before the answer).
  if (questionNumbers.length >= 2) {
    const sorted = [...questionNumbers].sort((a, b) => b - a)
    const biggest = sorted[0]
    const second = sorted[1]
    if (biggest !== second) {
      pool.push({
        labelTH: labels.labelA_TH,
        labelEN: labels.labelA_EN,
        value: biggest,
      })
      pool.push({ labelTH: labels.labelB_TH, labelEN: labels.labelB_EN, value: second })
    }
  }

  // The model's own comparable quantities stay available as a fallback.
  for (const candidate of barCandidates(data)) pool.push(candidate)

  if (pool.length >= 2) {
    for (let i = 0; i < pool.length; i += 1) {
      for (let j = i + 1; j < pool.length; j += 1) {
        const first = pool[i]
        const second = pool[j]
        if (first.value === second.value) continue
        const total =
          modelTotal ?? first.value + second.value
        const selection = barModelFrom(first, second, total)
        if (selection) return selection
      }
    }
  }

  /* --- Fallback: a small total still fits the base-10 board ------- */
  const smallTotal = asNumber(data.total) ?? asNumber(data.total_items) ?? asNumber(data.total_value)
  if (smallTotal !== undefined && smallTotal > 0 && smallTotal <= MAX_BASE10_VALUE) {
    const config = makeBase10(smallTotal, answerNumber ?? smallTotal)
    if (config) return { workspaceType: 'base10', base10Config: config }
  }

  /* --- Last resort: the answer itself fits the base-10 board ------ */
  if (answerNumbers.length > 0) {
    const answer = answerNumbers[0]
    const initial = questionNumbers[0] ?? answer
    const config = makeBase10(initial, answer)
    if (config) return { workspaceType: 'base10', base10Config: config }
  }

  /* --- Last resort: a comparison of two big amounts ---------------- */
  /*
   * "จำนวน 45,830 มากกว่า 12,300 หรือไม่" is a question about the places
   * of two numbers, so the chart of the bigger number is the board: the
   * learner reads the worth of every place and compares.
   */
  const comparison = comparisonInQuestion(questionText)
  if (comparison) {
    return {
      workspaceType: 'placeValue',
      placeValueConfig: makePlaceValue(comparison.bigger, {
        operation: 'compare',
        subtrahend: comparison.smaller,
      }),
    }
  }

  return { workspaceType: 'none' }
}

/* ------------------------------------------------------------------ */
/* Teaching material                                                   */
/* ------------------------------------------------------------------ */

/** Removes the leading emoji so the hint reads like a sentence. */
function stripLeadingEmoji(text: string): string {
  return text.replace(/^[^\p{L}\p{N}]+/u, '').trim()
}

export function buildSteps(steps: string[]): LessonStep[] {
  return steps.map((raw, index) => {
    const text = asText(raw)
    const separator = text.indexOf(':')
    const head = separator > 0 && separator < 40 ? text.slice(0, separator).trim() : ''
    const body = separator > 0 && separator < 40 ? text.slice(separator + 1).trim() : text
    return {
      titleTH: head ? `${head}` : `ขั้นที่ ${index + 1}`,
      titleEN: head ? `${head}` : `Step ${index + 1}`,
      descTH: body,
      descEN: body,
    }
  })
}

export function buildMicroSteps(content: LessonContentBundle): MicroStep[] {
  const vocabulary = content.keyVocabulary ?? []
  const microSteps: MicroStep[] = []

  const story = asText(content.storyTH) || asText(content.thinkStoryTH)
  if (story) {
    microSteps.push({
      titleTH: 'เรื่องราวของบทเรียนนี้',
      titleEN: 'The story behind this lesson',
      bodyTH: story,
      bodyEN: asText(content.storyEN) || asText(content.thinkStoryEN) || story,
      actionLabelTH: 'กดเพื่อดูคิดอย่างไร',
      actionLabelEN: 'Tap to see how to think',
      emoji: '📖',
    })
  }

  const firstWord = vocabulary[0]
  if (firstWord) {
    const title = asText(firstWord.th) || asText(firstWord.en)
    const definition = asText(firstWord.definition_th) || asText(firstWord.definition_en)
    microSteps.push({
      titleTH: `คำศัพท์สำคัญ: ${title}`,
      titleEN: `Key word: ${asText(firstWord.en) || title}`,
      bodyTH: definition,
      bodyEN: asText(firstWord.definition_en) || definition,
      actionLabelTH: 'กดเพื่อทบทวนคำศัพท์',
      actionLabelEN: 'Tap to review the word',
      emoji: '🔤',
    })
  }

  const secondWord = vocabulary[1]
  const thinkStory = asText(content.thinkStoryTH)
  if (secondWord || thinkStory) {
    const title = secondWord
      ? asText(secondWord.th) || asText(secondWord.en)
      : 'คิดทบทวน'
    const body = secondWord
      ? asText(secondWord.definition_th) || asText(secondWord.definition_en)
      : thinkStory
    microSteps.push({
      titleTH: `คิดทบทวน: ${title}`,
      titleEN: `Think it through: ${asText(secondWord?.en) || title}`,
      bodyTH: body,
      bodyEN: secondWord ? asText(secondWord.definition_en) || body : body,
      actionLabelTH: 'กดเพื่อลองใช้คำศัพท์',
      actionLabelEN: 'Tap to use the word',
      emoji: '💡',
    })
  }

  const helperTip = asText(content.helperTipTH)
  if (microSteps.length < 3) {
    microSteps.push({
      titleTH: 'พร้อมลุยโจทย์แล้ว!',
      titleEN: 'Ready to practise!',
      bodyTH: helperTip || 'ใช้เครื่องมือบนกระดานเพื่อแสดงวิธีคิดของตัวเอง',
      bodyEN: asText(content.helperTipTH) || 'Use the board to show how you worked it out.',
      actionLabelTH: 'เริ่มทำโจทย์เลย 🚀',
      actionLabelEN: 'Start the problem 🚀',
      emoji: '🚀',
    })
  }

  return microSteps.slice(0, 3)
}

/* ------------------------------------------------------------------ */
/* The mapper                                                          */
/* ------------------------------------------------------------------ */

function miniQuizFromBlocks(blocks: unknown[]): RawRecord | null {
  const block = blocks.find((candidate) => blockType(candidate) === 'mini_quiz')
  return block ? blockData(block) : null
}

/**
 * Builds the practice questions of one lesson.
 *
 * The variant `questions` array is preferred; when the selected variant has
 * none (most grade 3 topics) the `mini_quiz` block of the lesson is used.
 */
export function buildQuestions(content: LessonContentBundle): RawQuestion[] {
  const fromVariant = (content.questions ?? []).filter(
    (question) => asText(question.question_th) || asText(question.question_en),
  )
  if (fromVariant.length > 0) return fromVariant

  const miniQuiz = miniQuizFromBlocks(content.visualBlocks ?? [])
  if (miniQuiz) {
    const questionTH = asText(miniQuiz.question_th) || asText(miniQuiz.question)
    const questionEN = asText(miniQuiz.question_en)
    if (questionTH || questionEN) {
      const choicesTH = asArray(miniQuiz.choices_th ?? miniQuiz.choices).map((choice) => asText(choice))
      const choicesEN = asArray(miniQuiz.choices_en ?? miniQuiz.choices).map((choice) => asText(choice))
      return [
        {
          question_id: 'mini_quiz',
          question_th: questionTH,
          question_en: questionEN,
          choices: content.programType === 'EP' ? choicesEN : choicesTH,
          correct_answer:
            asText(miniQuiz.correct_answer) || asText(miniQuiz.correctAnswer) || asText(miniQuiz.answer),
          correct_index: asNumber(miniQuiz.correct_index),
          explanation_th: asText(miniQuiz.explanation_th) || asText(miniQuiz.explanation),
          explanation_en: asText(miniQuiz.explanation_en),
        },
      ]
    }
  }

  const practice = asText(content.practiceQuestion)
  if (practice) {
    return [
      {
        question_id: 'practice',
        question_th: practice,
        choices: (content.practiceChoices ?? []).map((choice) => asText(choice)),
        correct_answer: asText(content.practiceAnswer),
      },
    ]
  }

  return []
}

/**
 * Converts a lesson bundle into the problems the interactive shell renders.
 */
export function mapLessonToProblems(content: LessonContentBundle): LessonProblem[] {
  const questions = buildQuestions(content)
  if (questions.length === 0) return []

  const tier = content.gradeLevel >= 1 && content.gradeLevel <= 3 ? 'lower' : 'upper'
  const gradeLabelTH = `ป.${content.gradeLevel}`
  const gradeLabelEN = `Grade ${content.gradeLevel}`
  const topicTH = content.variantTitleTH || content.titleTH || 'บทเรียน'
  const topicEN = content.variantTitleEN || content.titleEN || content.titleTH || 'Lesson'

  const hints = (content.hints ?? []).map((hint) => stripLeadingEmoji(asText(hint))).filter(Boolean)
  const steps = buildSteps(content.explanationSteps ?? [])
  const microSteps = buildMicroSteps(content)
  const commonMistakes = (content.commonMistakes ?? []).map((mistake) => stripLeadingEmoji(asText(mistake))).filter(Boolean)

  return questions.map((question, index) => {
    const questionTH = normaliseThaiDigits(asText(question.question_th))
    const questionEN = asText(question.question_en)
    const choices = (question.choices ?? []).map((choice) => asText(choice)).filter(Boolean)
    const correctAnswer = resolveCorrectAnswer(choices, question)

    const workspace = deriveWorkspace(
      content.visualBlocks ?? [],
      `${questionTH} ${questionEN}`,
      `${correctAnswer} ${asText(question.explanation_th)}`,
    )

    const hint1 = hints[0] ?? 'ลองอ่านโจทย์อีกครั้ง แล้วหาตัวเลขที่โจทย์ให้มา'
    const hint2 = hints[1] ?? 'ลองใช้เครื่องมือบนกระดานช่วยแสดงขั้นตอนทีละส่วน'
    const nudge = commonMistakes[0] ?? hints[2] ?? 'ยังไม่ใช่ค่ะ ลองตรวจสอบตัวเลขที่โจทย์ให้มาอีกครั้ง'

    return {
      id: asText(question.question_id) || `${content.lessonId}-q${index + 1}`,
      tier,
      workspaceType: workspace.workspaceType,
      gradeLabelTH,
      gradeLabelEN,
      topicTH,
      topicEN,
      questionEN: tokenizeQuestion(questionEN, 'EN'),
      questionTH: tokenizeQuestion(questionTH, 'TH'),
      rawTTS_EN: questionEN,
      rawTTS_TH: questionTH,
      choices,
      correctAnswer,
      hint1TH: hint1,
      hint1EN: hint1,
      hint2TH: hint2,
      hint2EN: hint2,
      nudgeTH: nudge,
      nudgeEN: nudge,
      steps,
      conceptMicroSteps: microSteps,
      base10Config: workspace.base10Config,
      barModelConfig: workspace.barModelConfig,
      fractionConfig: workspace.fractionConfig,
      clockConfig: workspace.clockConfig,
      placeValueConfig: workspace.placeValueConfig,
    }
  })
}

/* ------------------------------------------------------------------ */
/* Adapters - raw API payloads into a LessonContentBundle                */
/* ------------------------------------------------------------------ */

/**
 * Reads a list of strings or of `{ text }` / `{ mistake }` style objects.
 *
 * The content files store hints and steps as plain strings while the lesson
 * view model stores them as objects, so both shapes are accepted.
 */
function textList(value: unknown, keys: string[] = ['text', 'description', 'step']): string[] {
  return asArray(value)
    .map((entry) => {
      if (typeof entry === 'string') return entry.trim()
      const record = asRecord(entry)
      for (const key of keys) {
        const text = asText(record[key])
        if (text) return text
      }
      return ''
    })
    .filter(Boolean)
}

/** Reads the `POST /me/lessons/{id}/start` response (variant payload). */
export function bundleFromStartResponse(payload: unknown): LessonContentBundle {
  const root = asRecord(payload)
  const content = asRecord(root.content)
  const lesson = asRecord(root.lesson)
  const source = Object.keys(content).length > 0 ? content : root

  const gradeLevel = asNumber(source.grade_level) ?? asNumber(lesson.grade_level) ?? 3

  return {
    lessonId: asText(source.lesson_id) || asText(source.lesson_group_id) || asText(lesson.lesson_id),
    gradeLevel,
    titleTH: asText(source.title_th) || asText(lesson.title_th),
    titleEN: asText(source.title_en) || asText(lesson.title_en),
    variantTitleTH: asText(source.variant_title_th),
    variantTitleEN: asText(source.variant_title_en),
    storyTH: asText(source.story_theme_th) || asText(source.story) || asText(lesson.story),
    storyEN: asText(source.story_theme_en) || asText(source.story_en),
    thinkStoryTH: asText(source.think_story_th) || asText(source.think_story),
    thinkStoryEN: asText(source.think_story_en),
    helperTipTH: asText(source.helper_tip),
    hints: textList(source.hints),
    explanationSteps: textList(source.explanation_steps),
    commonMistakes: textList(source.common_mistakes, ['mistake', 'text', 'description']),
    workedExamples: asArray(source.worked_examples).map((example) => asRecord(example)),
    keyVocabulary: asArray(source.key_vocabulary).map((entry) => asRecord(entry)),
    questions: asArray(source.questions).map((question) => asRecord(question)),
    visualBlocks: asArray(source.visual_blocks),
  }
}

/** Reads the `GET /me/lessons/{id}` response (lesson view model). */
export function bundleFromLessonDetail(payload: unknown): LessonContentBundle {
  const lesson = asRecord(payload)
  const viewModel = asRecord(lesson.lesson_view_model)
  const practice = asRecord(viewModel.practice)
  const gradeLevel = asNumber(lesson.grade_level) ?? 3

  const vocabulary = asArray(lesson.vocabulary).map((entry) => asRecord(entry))
  const keyVocabulary: RawKeyVocabulary[] = vocabulary.map((entry) => ({
    th: asText(entry.word) || asText(entry.meaning_th),
    en: asText(entry.word),
    definition_th: asText(entry.meaning_th),
    definition_en: asText(entry.example_en),
  }))

  return {
    lessonId: asText(lesson.lesson_id) || asText(lesson.id),
    gradeLevel,
    titleTH: asText(lesson.title_th) || asText(lesson.title),
    titleEN: asText(lesson.title_en),
    variantTitleTH: asText(lesson.variant_title_th),
    storyTH: asText(viewModel.story) || asText(lesson.story_theme_th),
    thinkStoryTH: asText(viewModel.think_story) || asText(lesson.think_story),
    helperTipTH: asText(lesson.helper_tip),
    hints: textList(lesson.hints),
    explanationSteps: textList(lesson.explanation_steps),
    commonMistakes: textList(lesson.common_mistakes, ['mistake', 'text', 'description']),
    workedExamples: asArray(lesson.worked_examples).map((example) => asRecord(example)),
    keyVocabulary,
    questions: [],
    visualBlocks: asArray(lesson.visual_blocks),
    practiceQuestion: asText(practice.question),
    practiceChoices: asArray(practice.choices).map((choice) => asText(choice)),
    practiceAnswer: asText(practice.correct_answer),
  }
}
