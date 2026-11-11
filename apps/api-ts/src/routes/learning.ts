/**
 * The learning endpoints — the curriculum catalogue, the lesson document and
 * the quiz-session flow.
 *
 * Mirrors the routes of `apps/api/app/routers/learning.py`:
 *
 *   GET  /subjects
 *   GET  /skills
 *   GET  /lessons/{lesson_id}
 *   POST /quiz-sessions/{session_id}/answer
 *   POST /quiz-sessions/{session_id}/complete
 *
 * ── Why the lesson content comes from the snapshot ──────────────────────────
 * The legacy service keeps the lesson content in the filesystem and mirrors it
 * into the `lessons` table. That mirror is stale — it carries only a part of
 * the approved catalogue — so the Worker serves the lesson *body* from
 * `src/content/lessons.snapshot.json` (the snapshot the FastAPI service
 * produced) instead of reading it back from the database.
 *
 * The database still provides the *identity* of a lesson: the uuid of its row,
 * the skill it belongs to, its title and its timestamps. That keeps the
 * response field-for-field identical to the legacy one, while the content
 * itself is always the approved version of the snapshot.
 *
 * ── Why the quiz endpoints are byte-compatible ─────────────────────────────
 * The answer endpoint validates its body with pydantic semantics — including
 * the coercion rules and the error list — and the response is rendered the
 * way Starlette renders it (floats keep their `.0`, non-ASCII stays
 * readable). The complete endpoint recomputes the mastery score exactly like
 * `app/services/mastery.py` does, including Python's round-half-to-even.
 */
import { Hono } from 'hono'
import type { Context } from 'hono'

import lessonsSnapshot from '../content/lessons.snapshot.json'
import {
  jsonInvalidError,
  missingBodyError,
  modelAttributesError,
  parsePythonJson,
  validationError,
} from '../lib/billing/validation'
import { notFound, unauthorized } from '../lib/errors'
import { pyFloat, toFastApiJson } from '../lib/fastapiJson'
import { verifyAccessToken } from '../lib/auth'
import { levelFromTotalXp } from '../lib/progression'
import { roundLikePython } from '../lib/quests'
import { readToken, requireActiveUser, type AppEnv } from '../lib/http'

export const learningRoutes = new Hono<AppEnv>()

/**
 * Serialise a payload the way Starlette's `JSONResponse` does.
 *
 * @param c the request context.
 * @param payload the payload to serialise.
 */
function jsonBody(c: Context<AppEnv>, payload: unknown): Response {
  return c.text(toFastApiJson(payload), 200, { 'content-type': 'application/json' })
}

/**
 * Render a timestamp the way Python's `datetime.isoformat()` renders it.
 *
 * Python omits the fraction when it is zero, and always writes the offset of
 * the timestamp — the database stores UTC.
 *
 * @param raw the timestamp as read from the database.
 */
function isoTimestamp(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) {
    return null
  }
  const text = String(raw).trim()
  if (!text) {
    return null
  }
  const [base, fraction] = text.split('.')
  if (!fraction || /^0+$/.test(fraction)) {
    return `${base}+00:00`
  }
  return `${base}.${fraction}+00:00`
}

/* ────────────────────────────── snapshot ─────────────────────────────── */

/** A JSON object of unknown shape. */
type Json = Record<string, unknown>

/** One catalogue row of a grade. */
interface SnapshotCatalogRow {
  lesson_id: string
  lesson_group_id: string
  topic_folder: string | null
  grade_level: number
  topic_code: string
  skill_code: string
  title_th: string
  title_en: string
}

/** One lesson variant file of a topic folder. */
interface SnapshotLessonVariant {
  variant_id: string
  status: string
  payload: Json
}

/** The lesson and quiz variants of one topic folder. */
interface SnapshotTopic {
  topic_folder: string
  lesson_group_id: string
  lesson_variants: SnapshotLessonVariant[]
}

/** One grade of one programme. */
interface SnapshotGrade {
  catalog: SnapshotCatalogRow[]
  topics: Record<string, SnapshotTopic>
}

/** The shape of `src/content/lessons.snapshot.json`. */
interface LessonSnapshot {
  programs: Record<string, { grades: Record<string, SnapshotGrade> }>
}

const snapshot = lessonsSnapshot as unknown as LessonSnapshot

/** A lesson of the snapshot together with the programme it belongs to. */
interface SnapshotLesson {
  program: string
  grade: number
  row: SnapshotCatalogRow
  topic: SnapshotTopic
  variant: SnapshotLessonVariant
}

/**
 * Find the approved lesson of the snapshot that carries the given content id.
 *
 * The catalogue keys a lesson by `lesson_id`; the topic, the skill and the
 * lesson group carry the same identifier, so every one of them resolves.
 *
 * @param contentId the content id of the lesson.
 */
function findSnapshotLesson(contentId: string): SnapshotLesson | null {
  for (const [program, programBody] of Object.entries(snapshot.programs ?? {})) {
    for (const [gradeKey, grade] of Object.entries(programBody.grades ?? {})) {
      for (const row of grade.catalog ?? []) {
        const matches =
          row.lesson_id === contentId ||
          row.lesson_group_id === contentId ||
          row.topic_code === contentId ||
          row.skill_code === contentId
        if (!matches) {
          continue
        }
        const topic = (grade.topics ?? {})[row.topic_folder ?? '']
        if (!topic) {
          continue
        }
        const approved = (topic.lesson_variants ?? []).filter(
          (variant) => variant.status === 'approved',
        )
        if (approved.length === 0) {
          continue
        }
        const variant =
          approved.find((entry) => entry.payload.id === contentId) ??
          approved.find((entry) => entry.payload.lesson_id === contentId) ??
          approved[0]
        if (!variant) return null
        return { program, grade: Number(gradeKey), row, topic, variant }
      }
    }
  }
  return null
}

/* ───────────────────── visual-block normalisation ──────────────────────── */

/** The block types the legacy normaliser keeps as they are. */
const ALLOWED_BLOCK_TYPES = new Set([
  'story_intro',
  'think_story',
  'model_diagram',
  'number_sentence',
  'mini_quiz',
  'helper_tip',
])

/** The block types that become a `model_diagram`. */
const MODEL_BLOCK_TYPES = new Set([
  'area_model',
  'array_model',
  'bar_model',
  'number_bond',
  'part_whole_model',
  'place_value_chart',
  'ten_frame',
])

/** The block types the legacy normaliser drops. */
const DEPRECATED_BLOCK_TYPES = new Set(['step_cards', 'worked_example', 'common_mistakes'])

/**
 * Parse a value that may carry a JSON document as a string.
 *
 * Mirrors `_parse_json_like` of `app/services/lesson_content.py`.
 *
 * @param value the raw value.
 */
function parseJsonLike(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value
  }
  const stripped = value.trim()
  if (!stripped) {
    return null
  }
  if (stripped.startsWith('[') || stripped.startsWith('{')) {
    try {
      return JSON.parse(stripped)
    } catch {
      return value
    }
  }
  return value
}

/**
 * Recursively normalise a nested structure.
 *
 * Mirrors `_normalize_nested` of `app/services/lesson_content.py`.
 *
 * @param value the raw value.
 */
function normalizeNested(value: unknown): unknown {
  const parsed = parseJsonLike(value)
  if (Array.isArray(parsed)) {
    return parsed.map((item) => normalizeNested(item))
  }
  if (parsed && typeof parsed === 'object') {
    const out: Json = {}
    for (const [key, nested] of Object.entries(parsed as Json)) {
      out[String(key)] = normalizeNested(nested)
    }
    return out
  }
  return parsed
}

/**
 * The data of one visual block.
 *
 * Mirrors `_block_data`: every root-level key of the block that is not a
 * title or the type itself is copied into `data`, so the root-level `groups`
 * and `sharing_groups` of a bar model survive the normalisation.
 *
 * @param block the raw block.
 */
function blockData(block: Json): Json {
  const rawData = parseJsonLike(block.data)
  const data: Json =
    rawData && typeof rawData === 'object' && !Array.isArray(rawData)
      ? { ...(rawData as Json) }
      : {}

  for (const [key, value] of Object.entries(block)) {
    if (['type', 'block_type', 'data', 'title', 'title_th', 'title_en'].includes(key)) {
      continue
    }
    if (!(String(key) in data)) {
      data[String(key)] = value
    }
  }

  if ('content' in block && !('text_th' in data) && !('text' in data)) {
    data.text_th = block.content
  }

  return normalizeNested(data) as Json
}

/**
 * The number inside a value, as `_number_value` of the legacy service finds
 * it.
 *
 * @param value the raw value.
 */
function numberValue(value: unknown): number | null {
  const text = String(value ?? '').trim()
  const match = /-?\d+(?:\.\d+)?/.exec(text)
  if (!match) {
    return null
  }
  const parsed = Number(match[0])
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * The index of a choice letter, as `_letter_choice_index` computes it.
 *
 * @param value the raw value.
 */
function letterChoiceIndex(value: unknown): number | null {
  const text = String(value ?? '')
    .trim()
    .toUpperCase()
  const index = { A: 0, B: 1, C: 2, D: 3 }[text]
  return index === undefined ? null : index
}

/**
 * The canonical text of a number, as `_number_text` computes it.
 *
 * @param value the raw value.
 */
function numberText(value: unknown): string | null {
  const number = numberValue(value)
  if (number === null) {
    return null
  }
  if (Number.isInteger(number)) {
    return String(number)
  }
  return String(Number(number.toPrecision(6)))
}

/**
 * Normalise the data of a mini-quiz block.
 *
 * Mirrors `_normalize_mini_quiz_data` of `app/services/lesson_content.py`.
 *
 * @param data the raw data.
 */
function normalizeMiniQuizData(data: Json): Json {
  let merged = data
  const questions = data.questions
  if (
    Array.isArray(questions) &&
    questions.length > 0 &&
    questions[0] &&
    typeof questions[0] === 'object'
  ) {
    merged = { ...data, ...(questions[0] as Json) }
  }

  let question = merged.question_th ?? merged.question_en ?? merged.question ?? ''
  if (!question) {
    question = merged.text_th ?? merged.question_text ?? merged.question_text_th ?? ''
  }

  let rawChoices = merged.choices
  if (!Array.isArray(rawChoices)) {
    rawChoices = Array.isArray(merged.choices_th)
      ? merged.choices_th
      : Array.isArray(merged.choices_en)
        ? merged.choices_en
        : []
  }
  const choices = (rawChoices as unknown[]).map((choice) => String(choice).trim())

  let rawAnswer = merged.correct_answer
  if (rawAnswer === undefined || rawAnswer === null || String(rawAnswer).trim() === '') {
    rawAnswer = merged.correct_answer_th ?? merged.correct_answer_en ?? merged.answer
  }

  const letterIndex = letterChoiceIndex(rawAnswer)
  if (letterIndex !== null && letterIndex < choices.length) {
    rawAnswer = choices[letterIndex]
  }

  const explanation = merged.explanation_th ?? merged.explanation_en ?? merged.explanation ?? ''

  let answer = String(rawAnswer ?? '').trim()
  if (!choices.includes(answer)) {
    const answerNumber = numberText(answer)
    if (answerNumber !== null) {
      for (const choice of choices) {
        if (numberText(choice) === answerNumber) {
          answer = choice
          break
        }
      }
    }
  }

  return {
    ...merged,
    question_th: String(question),
    choices,
    correct_answer: answer,
    answer,
    explanation_th: String(explanation),
  }
}

/**
 * Normalise the data of a grouping model.
 *
 * Mirrors `_normalize_grouping_model_data` of the legacy service.
 *
 * @param data the raw data.
 */
function normalizeGroupingModelData(data: Json): Json {
  const groupCount = Math.trunc(numberValue(data.groups) ?? 0)
  const itemsPerGroup = Math.trunc(numberValue(data.items_per_group) ?? 0)
  let groups = Array.isArray(data.groups) ? (data.groups as unknown[]) : []
  if (groups.length === 0 && groupCount > 0) {
    groups = Array.from({ length: groupCount }, (_item, index) => ({
      group_index: index + 1,
      item_count: itemsPerGroup,
    }))
  }
  return { ...data, model_type: 'sharing_groups', groups }
}

/**
 * Normalise one visual block.
 *
 * Mirrors `_normalize_block` of `app/services/lesson_content.py`.
 *
 * @param block the raw block.
 */
function normalizeBlock(block: unknown): Json | null {
  const parsed = parseJsonLike(block)
  if (Array.isArray(parsed)) {
    const nested = normalizeVisualBlocks(parsed)
    return nested[0] ?? null
  }
  if (!parsed || typeof parsed !== 'object') {
    return null
  }

  const raw = parsed as Json
  const rawType = String(raw.type || raw.block_type || '').trim()
  if (DEPRECATED_BLOCK_TYPES.has(rawType)) {
    return null
  }

  let blockType = rawType
  let data = blockData(raw)

  if (blockType === 'grouping_model') {
    data = normalizeGroupingModelData(data)
    blockType = 'model_diagram'
  } else if (MODEL_BLOCK_TYPES.has(blockType)) {
    if (!('model_type' in data)) {
      data.model_type = blockType
    }
    blockType = 'model_diagram'
  } else if (['emoji_counter', 'thinking_prompt', 'visual_prompt'].includes(blockType)) {
    blockType = 'visual_thinking'
  } else if (['equation', 'expression', 'number_sentence'].includes(blockType)) {
    blockType = 'number_sentence'
  } else if (!ALLOWED_BLOCK_TYPES.has(blockType)) {
    if (data.question || data.choices) {
      blockType = 'mini_quiz'
    } else if (data.equation || data.expression) {
      blockType = 'number_sentence'
    } else {
      blockType = 'visual_thinking'
    }
  }

  if (blockType === 'mini_quiz') {
    data = normalizeMiniQuizData(data)
  }

  const title = raw.title_th || raw.title || raw.title_en || ''
  return { type: blockType, title_th: String(title), data }
}

/**
 * Normalise the visual blocks of a lesson.
 *
 * Mirrors `normalize_lesson_visual_blocks` of the legacy service.
 *
 * @param value the raw blocks.
 */
function normalizeVisualBlocks(value: unknown): Json[] {
  const parsed = parseJsonLike(value)
  if (parsed === null || parsed === undefined) {
    return []
  }
  if (Array.isArray(parsed)) {
    const out: Json[] = []
    for (const item of parsed) {
      const itemParsed = parseJsonLike(item)
      if (Array.isArray(itemParsed)) {
        out.push(...normalizeVisualBlocks(itemParsed))
        continue
      }
      const block = normalizeBlock(itemParsed)
      if (block) {
        out.push(block)
      }
    }
    return out
  }
  const block = normalizeBlock(parsed)
  return block ? [block] : []
}

/* ───────────────────────────── authentication ─────────────────────────── */

/**
 * Require a valid, active user.
 *
 * Mirrors `current_user` of `app/routers/deps.py`: a missing token answers
 * `Not authenticated`, a broken one `Invalid token`, an unknown user
 * `User not found` and a disabled account `Account is disabled`.
 *
 * @param c the request context.
 */
async function authenticate(c: Context<AppEnv>): Promise<{ id: string; role: string }> {
  const token = readToken(c)
  if (!token) {
    throw unauthorized('Not authenticated')
  }
  const payload = await verifyAccessToken(token, c.get('env').JWT_SECRET)
  if (!payload) {
    throw unauthorized('Invalid token')
  }
  c.set('userId', payload.sub)
  c.set('userRole', payload.role)
  return requireActiveUser(c)
}

/* ────────────────────── pydantic-compatible validation ────────────────── */

/** A pydantic error entry. */
type ValidationEntry = Record<string, unknown>

/**
 * Coerce a value into an integer the way pydantic v2 does.
 *
 * @param value the raw value.
 */
function coerceInt(
  value: unknown,
): { ok: true; value: number } | { ok: false; type: 'int_type' | 'int_parsing' | 'int_from_float' } {
  if (typeof value === 'boolean') {
    return { ok: true, value: value ? 1 : 0 }
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return { ok: false, type: 'int_type' }
    }
    if (!Number.isInteger(value)) {
      return { ok: false, type: 'int_from_float' }
    }
    return { ok: true, value }
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (/^[+-]?\d+$/.test(trimmed)) {
      return { ok: true, value: Number(trimmed) }
    }
    return { ok: false, type: 'int_parsing' }
  }
  return { ok: false, type: 'int_type' }
}

/**
 * Coerce a value into a boolean the way pydantic v2 does.
 *
 * @param value the raw value.
 */
function coerceBool(
  value: unknown,
): { ok: true; value: boolean } | { ok: false; type: 'bool_type' | 'bool_parsing' } {
  if (typeof value === 'boolean') {
    return { ok: true, value }
  }
  if (typeof value === 'number') {
    if (value === 0) {
      return { ok: true, value: false }
    }
    if (value === 1) {
      return { ok: true, value: true }
    }
    return { ok: false, type: 'bool_parsing' }
  }
  if (typeof value === 'string') {
    const text = value.trim().toLowerCase()
    if (['1', 'on', 't', 'true', 'y', 'yes'].includes(text)) {
      return { ok: true, value: true }
    }
    if (['0', 'off', 'f', 'false', 'n', 'no'].includes(text)) {
      return { ok: true, value: false }
    }
    return { ok: false, type: 'bool_parsing' }
  }
  return { ok: false, type: 'bool_type' }
}

/**
 * The error entry of a field that is not a string.
 *
 * @param field the name of the field.
 * @param input the offending value.
 */
function stringTypeError(field: string, input: unknown): ValidationEntry {
  return { type: 'string_type', loc: ['body', field], msg: 'Input should be a valid string', input }
}

/**
 * The error entry of a field that is not an integer.
 *
 * @param field the name of the field.
 * @param type the pydantic error type.
 * @param input the offending value.
 */
function intTypeError(field: string, type: string, input: unknown): ValidationEntry {
  const messages: Record<string, string> = {
    int_type: 'Input should be a valid integer',
    int_parsing: 'Input should be a valid integer, unable to parse string as an integer',
    int_from_float: 'Input should be a valid integer, got a number with a fractional part',
  }
  return { type, loc: ['body', field], msg: messages[type] ?? messages.int_type, input }
}

/**
 * The error entry of a field that is not a boolean.
 *
 * @param field the name of the field.
 * @param type the pydantic error type.
 * @param input the offending value.
 */
function boolTypeError(field: string, type: string, input: unknown): ValidationEntry {
  const messages: Record<string, string> = {
    bool_type: 'Input should be a valid boolean',
    bool_parsing: 'Input should be a valid boolean, unable to interpret input',
  }
  return { type, loc: ['body', field], msg: messages[type] ?? messages.bool_type, input }
}

/**
 * The error entry of a field that is below its minimum.
 *
 * pydantic reports the value the caller sent, not the coerced one.
 *
 * @param field the name of the field.
 * @param input the offending value.
 * @param minimum the minimum value.
 */
function greaterThanEqualError(field: string, input: unknown, minimum: number): ValidationEntry {
  return {
    type: 'greater_than_equal',
    loc: ['body', field],
    msg: `Input should be greater than or equal to ${minimum}`,
    input,
    ctx: { ge: minimum },
  }
}

/**
 * The error entry of a field the body does not carry.
 *
 * pydantic reports the whole body as the input of a missing field.
 *
 * @param field the name of the field.
 * @param input the body.
 */
function missingFieldError(field: string, input: unknown): ValidationEntry {
  return { type: 'missing', loc: ['body', field], msg: 'Field required', input }
}

/** The validated body of the answer endpoint. */
interface QuizAnswerIn {
  question_id: string
  selected_answer: string
  response_time_ms: number
  hint_used: boolean
  attempt_count: number
}

/**
 * Validate the body of the answer endpoint against `QuizAnswerIn`.
 *
 * @param body the parsed body.
 */
function validateQuizAnswer(body: Json): QuizAnswerIn {
  const errors: ValidationEntry[] = []

  const questionId = body.question_id
  if (!('question_id' in body)) {
    errors.push(missingFieldError('question_id', body))
  } else if (typeof questionId !== 'string') {
    errors.push(stringTypeError('question_id', questionId))
  }

  const selectedAnswer = body.selected_answer
  if (!('selected_answer' in body)) {
    errors.push(missingFieldError('selected_answer', body))
  } else if (typeof selectedAnswer !== 'string') {
    errors.push(stringTypeError('selected_answer', selectedAnswer))
  }

  let responseTimeMs = 0
  if (!('response_time_ms' in body)) {
    errors.push(missingFieldError('response_time_ms', body))
  } else {
    const coerced = coerceInt(body.response_time_ms)
    if (coerced.ok) {
      if (coerced.value < 0) {
        errors.push(greaterThanEqualError('response_time_ms', body.response_time_ms, 0))
      } else {
        responseTimeMs = coerced.value
      }
    } else {
      errors.push(intTypeError('response_time_ms', coerced.type, body.response_time_ms))
    }
  }

  let hintUsed = false
  if ('hint_used' in body) {
    const coerced = coerceBool(body.hint_used)
    if (coerced.ok) {
      hintUsed = coerced.value
    } else {
      errors.push(boolTypeError('hint_used', coerced.type, body.hint_used))
    }
  }

  let attemptCount = 1
  if ('attempt_count' in body) {
    const coerced = coerceInt(body.attempt_count)
    if (coerced.ok) {
      if (coerced.value < 1) {
        errors.push(greaterThanEqualError('attempt_count', body.attempt_count, 1))
      } else {
        attemptCount = coerced.value
      }
    } else {
      errors.push(intTypeError('attempt_count', coerced.type, body.attempt_count))
    }
  }

  if (errors.length > 0) {
    throw validationError(errors)
  }

  return {
    question_id: questionId as string,
    selected_answer: selectedAnswer as string,
    response_time_ms: responseTimeMs,
    hint_used: hintUsed,
    attempt_count: attemptCount,
  }
}

/* ───────────────────────── answer matching (answers.py) ────────────────── */

/** The Thai digits and their ASCII counterparts. */
const THAI_DIGITS: Record<string, string> = {
  '๐': '0',
  '๑': '1',
  '๒': '2',
  '๓': '3',
  '๔': '4',
  '๕': '5',
  '๖': '6',
  '๗': '7',
  '๘': '8',
  '๙': '9',
}

/** The punctuation the legacy service folds into its ASCII counterpart. */
const COMMON_PUNCTUATION: Record<string, string> = {
  '：': ':',
  '％': '%',
  '／': '/',
  '–': '-',
  '—': '-',
  '−': '-',
  '，': ',',
  '、': ',',
  '“': '"',
  '”': '"',
  '‘': "'",
  '’': "'",
}

/**
 * The `str()` of a value, the way Python renders it.
 *
 * @param value the raw value.
 */
function pythonString(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'boolean') {
    return value ? 'True' : 'False'
  }
  if (typeof value === 'number') {
    return String(value)
  }
  if (value === null || value === undefined) {
    return ''
  }
  return JSON.stringify(value) ?? ''
}

/**
 * Normalise an answer, as `normalize_answer` of `app/services/answers.py`
 * does: NFKC, Thai digits, folded punctuation and collapsed whitespace.
 *
 * @param value the raw answer.
 */
function normalizeAnswer(value: unknown): string {
  let text = value === null || value === undefined ? '' : pythonString(value)
  text = text.normalize('NFKC')
  text = text.replace(/[๐-๙]/g, (char) => THAI_DIGITS[char] as string)
  text = text.replace(
    /[：％／–—−，、“”‘’]/g,
    (char) => COMMON_PUNCTUATION[char] ?? char,
  )
  text = text.trim().replace(/\s+/g, ' ')
  text = text.replace(/\s*\/\s*/g, '/')
  // Python: `re.sub(r"\s*%\b", "%", text)` — the `%` only collapses when a
  // word character follows it.
  text = text.replace(/\s*%(?=[\p{L}\p{N}_])/gu, '%')
  text = text.replace(/(\d)\s+%/g, '$1%')
  return text
}

/** The question row the answer endpoint reads. */
interface QuestionRow {
  id: string
  skill_id: string
  correct_answer: string
  choices: string[] | null
  metadata: Json | null
}

/**
 * The answer values a question accepts.
 *
 * Mirrors `_answer_values` of `app/services/answers.py`.
 *
 * @param question the question row.
 */
function answerValues(question: QuestionRow): string[] {
  const metadata = question.metadata ?? {}
  const values: unknown[] = [question.correct_answer, metadata.answer]
  const accepted = metadata.accepted_answers ?? []
  if (typeof accepted === 'string' || typeof accepted === 'number' || typeof accepted === 'boolean') {
    values.push(accepted)
  } else if (Array.isArray(accepted)) {
    values.push(...accepted)
  }
  return values
    .filter((value) => value !== null && value !== undefined && pythonString(value) !== '')
    .map((value) => pythonString(value))
}

/**
 * The text of a choice, without its label.
 *
 * Mirrors `_choice_text` of `app/services/answers.py`.
 *
 * @param choice the raw choice.
 */
function choiceText(choice: unknown): string {
  return pythonString(choice)
    .replace(/^\s*[A-Da-d1-9]\s*[:.)-]\s*/, '')
    .trim()
}

/**
 * The answers a choice label may stand for.
 *
 * Mirrors `_choice_candidates` of `app/services/answers.py`.
 *
 * @param question the question row.
 * @param selectedAnswer the answer of the child.
 */
function choiceCandidates(question: QuestionRow, selectedAnswer: unknown): string[] {
  const raw = pythonString(selectedAnswer).trim()
  const choices = question.choices ?? []
  if (choices.length === 0) {
    return []
  }

  const candidates: string[] = []
  if (/^\d+$/.test(raw)) {
    const index = Number.parseInt(raw, 10)
    for (const offset of [1, 0]) {
      const choiceIndex = index - offset
      if (choiceIndex >= 0 && choiceIndex < choices.length) {
        const choice = choices[choiceIndex]
        candidates.push(pythonString(choice), choiceText(choice))
        break
      }
    }
  }
  if (raw.length === 1 && /[A-Za-z]/.test(raw)) {
    const choiceIndex = raw.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0)
    if (choiceIndex >= 0 && choiceIndex < choices.length) {
      const choice = choices[choiceIndex]
      candidates.push(pythonString(choice), choiceText(choice))
    }
  }
  return candidates.filter((candidate) => candidate !== '')
}

/**
 * The details of an answer, as `answer_match_details` of
 * `app/services/answers.py` computes them.
 *
 * @param question the question row.
 * @param selectedAnswer the answer of the child.
 */
function answerMatchDetails(
  question: QuestionRow,
  selectedAnswer: unknown,
): {
  selected_answer_raw: string
  selected_answer_normalized: string
  correct_answer_normalized: string
  is_correct: boolean
} {
  const selectedRaw = selectedAnswer === null || selectedAnswer === undefined ? '' : pythonString(selectedAnswer)
  const correctValues = answerValues(question)
  const selectedNormalized = normalizeAnswer(selectedRaw)
  const correctNormalized = normalizeAnswer(
    correctValues.length > 0 ? correctValues[0] : question.correct_answer,
  )

  let isCorrect = false
  if (correctValues.includes(selectedRaw)) {
    isCorrect = true
  } else {
    const normalizedCorrectValues = new Set(correctValues.map((value) => normalizeAnswer(value)))
    const candidates = [selectedRaw, selectedNormalized, ...choiceCandidates(question, selectedRaw)]
    isCorrect = candidates.some(
      (candidate) =>
        correctValues.includes(candidate) || normalizedCorrectValues.has(normalizeAnswer(candidate)),
    )
  }

  return {
    selected_answer_raw: selectedRaw,
    selected_answer_normalized: selectedNormalized,
    correct_answer_normalized: correctNormalized,
    is_correct: isCorrect,
  }
}

/* ───────────────────────── mastery maths (mastery.py) ───────────────────── */

/** One answer of a skill. */
interface AnswerResult {
  is_correct: boolean
  response_time_ms: number
}

/**
 * Clamp a score into 0…100 and round it the way Python does.
 *
 * Python rounds half to even, which `roundLikePython` reproduces.
 *
 * @param value the raw score.
 */
function clampScore(value: number): number {
  return roundLikePython(Math.max(0, Math.min(100, value)), 2)
}

/**
 * The speed score of a set of response times.
 *
 * Mirrors `speed_score` of `app/services/mastery.py`.
 *
 * @param responseTimes the response times in milliseconds.
 */
function speedScore(responseTimes: number[], targetMs = 10_000): number {
  const valid = responseTimes.filter((time) => time && time > 0)
  if (valid.length === 0) {
    return 50
  }
  const average = valid.reduce((sum, time) => sum + time, 0) / valid.length
  return clampScore(100 - ((average - targetMs) / targetMs) * 50)
}

/**
 * The consistency score of a set of answers.
 *
 * Mirrors `consistency_score` of `app/services/mastery.py`.
 *
 * @param results the answers.
 */
function consistencyScore(results: AnswerResult[]): number {
  if (results.length < 2) {
    return results.length > 0 && results[0]?.is_correct ? 80 : 40
  }
  const values: number[] = results.map((result) => (result.is_correct ? 100 : 0))
  const average = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance =
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length
  return clampScore(100 - Math.sqrt(variance))
}

/**
 * The mastery score of a set of answers.
 *
 * Mirrors `calculate_mastery_score` of `app/services/mastery.py`.
 *
 * @param results the answers.
 */
function calculateMasteryScore(results: AnswerResult[]): number {
  if (results.length === 0) {
    return 0
  }
  const accuracy = (results.filter((result) => result.is_correct).length / results.length) * 100
  const recent = results.slice(-5)
  const recentPerformance = (recent.filter((result) => result.is_correct).length / recent.length) * 100
  const speed = speedScore(results.map((result) => result.response_time_ms))
  const consistency = consistencyScore(results)
  return clampScore(accuracy * 0.6 + recentPerformance * 0.2 + speed * 0.1 + consistency * 0.1)
}

/**
 * The mastery level of a score.
 *
 * Mirrors `mastery_level` of `app/services/mastery.py`.
 *
 * @param score the mastery score.
 */
function masteryLevel(score: number): string {
  if (score >= 80) {
    return 'mastered'
  }
  if (score >= 60) {
    return 'good'
  }
  if (score >= 40) {
    return 'learning'
  }
  return 'needs_help'
}

/**
 * The mistake type of an answer.
 *
 * Mirrors `infer_mistake_type` of `app/services/mastery.py`.
 *
 * @param isCorrect whether the answer was right.
 * @param responseTimeMs how long the child needed.
 * @param previousIncorrect how many wrong answers the skill already had.
 */
function inferMistakeType(
  isCorrect: boolean,
  responseTimeMs: number,
  previousIncorrect = 0,
  slowThresholdMs = 15_000,
): string | null {
  if (isCorrect && responseTimeMs >= slowThresholdMs) {
    return 'speed_issue'
  }
  if (isCorrect) {
    return null
  }
  if (responseTimeMs && responseTimeMs < 1500) {
    return 'careless_mistake'
  }
  if (previousIncorrect >= 2) {
    return 'concept_misunderstanding'
  }
  return 'calculation_error'
}

/* ─────────────────────────────── routes ────────────────────────────────── */

/**
 * `GET /subjects` — the subject catalogue.
 */
learningRoutes.get('/subjects', async (c) => {
  const sql = c.get('sql')
  const rows = (await sql.query('SELECT id, code, name FROM subjects ORDER BY name ASC')) as Array<{
    id: string
    code: string
    name: string
  }>
  return c.json(rows)
})

/**
 * `GET /skills` — the skills of a subject and grade.
 */
learningRoutes.get('/skills', async (c) => {
  const sql = c.get('sql')
  const subject = c.req.query('subject') ?? 'math'
  const gradeLevel = Number(c.req.query('grade_level') ?? 1)

  const rows = (await sql.query(
    // The legacy service returns the skills in the order the database holds
    // them, and stamps the creation time as an ISO-8601 offset.
    `SELECT s.id, s.subject_id, s.grade_level, s.code, s.name, s.description,
            s.prerequisite_skill_ids, s.difficulty_order,
            to_char(s.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US')
              || '+00:00' AS created_at
     FROM skills s
     JOIN subjects sub ON sub.id = s.subject_id
     WHERE sub.code = $1 AND s.grade_level = $2`,
    [subject, Number.isFinite(gradeLevel) ? gradeLevel : 1],
  )) as Array<Record<string, unknown>>

  if (rows.length === 0) {
    return c.json([])
  }
  return c.json(rows)
})

/**
 * `GET /lessons/{lesson_id}` — one lesson.
 *
 * The body of the lesson comes from the approved snapshot, the identity from
 * the `lessons` row — exactly the split the legacy service ended up with.
 */
learningRoutes.get('/lessons/:lessonId', async (c) => {
  await authenticate(c)
  const lessonId = c.req.param('lessonId')
  const sql = c.get('sql')

  // The row of the lesson: either the id of the row itself or the content id
  // the row mirrors.
  const rows = (await sql.query(
    `SELECT id, skill_id, title, source, status, content,
            to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US') AS updated_at,
            to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US') AS created_at
       FROM lessons
      WHERE id = $1
         OR content->>'content_id' = $1
         OR content->>'id' = $1
      LIMIT 1`,
    [lessonId],
  )) as Array<{
    id: string
    skill_id: string
    title: string
    source: string
    status: string
    content: Json | null
    updated_at: string | null
    created_at: string | null
  }>

  const row = rows[0]
  const rowContent = row?.content ?? null
  const contentId =
    (rowContent && (rowContent.content_id as string | undefined)) ??
    (rowContent && (rowContent.id as string | undefined)) ??
    lessonId

  const found = findSnapshotLesson(contentId)
  if (!row && !found) {
    throw notFound('Lesson not found')
  }
  if (!found && row) {
    // The lesson is only known to the (stale) mirror; serve it as it is.
    return jsonBody(c, {
      id: String(row.id),
      skill_id: String(row.skill_id),
      content: rowContent ?? {},
      status: String(row.status),
      updated_at: isoTimestamp(row.updated_at),
      title: String(row.title),
      source: String(row.source),
      created_at: isoTimestamp(row.created_at),
    })
  }

  const payload: Json = { ...(found as SnapshotLesson).variant.payload }
  if (Array.isArray(payload.visual_blocks)) {
    payload.visual_blocks = normalizeVisualBlocks(payload.visual_blocks)
  }

  // The mirror carries a few bookkeeping keys the snapshot does not know
  // about; they belong to the lesson identity, so they survive.
  if (rowContent) {
    for (const [key, value] of Object.entries(rowContent)) {
      if (!(key in payload)) {
        payload[key] = value
      }
    }
  }

  const title = row ? String(row.title) : String(payload.title_th ?? '')
  return jsonBody(c, {
    id: row ? String(row.id) : contentId,
    skill_id: row ? String(row.skill_id) : null,
    content: payload,
    status: row ? String(row.status) : String(payload.status ?? 'approved'),
    updated_at: row ? isoTimestamp(row.updated_at) : null,
    title,
    source: row ? String(row.source) : 'snapshot',
    created_at: row ? isoTimestamp(row.created_at) : null,
  })
})

/**
 * `POST /quiz-sessions/{session_id}/answer` — one answer of a quiz session.
 */
learningRoutes.post('/quiz-sessions/:sessionId/answer', async (c) => {
  // The legacy service reads the body before it solves the dependencies, so
  // a malformed body answers 422 even for an anonymous caller.
  const raw = await c.req.text()
  let parsedBody: unknown = undefined
  if (raw.length > 0) {
    const parsed = parsePythonJson(raw)
    if (!parsed.ok) {
      throw jsonInvalidError(parsed.pos, parsed.msg)
    }
    parsedBody = parsed.value
  }

  await authenticate(c)

  if (parsedBody === undefined || parsedBody === null) {
    throw missingBodyError()
  }
  if (typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
    throw modelAttributesError(parsedBody)
  }

  const payload = validateQuizAnswer(parsedBody as Json)
  const sessionId = c.req.param('sessionId')
  const sql = c.get('sql')

  const sessions = (await sql.query(
    `SELECT id, child_profile_id FROM quiz_sessions WHERE id = $1 LIMIT 1`,
    [sessionId],
  )) as Array<{ id: string; child_profile_id: string }>
  const session = sessions[0]

  const questions = (await sql.query(
    `SELECT id, skill_id, correct_answer, choices, metadata FROM questions WHERE id = $1 LIMIT 1`,
    [payload.question_id],
  )) as QuestionRow[]
  const question = questions[0]

  if (!session || !question) {
    throw notFound('Session or question not found')
  }

  // The legacy service looks for *any* earlier wrong answer of the same
  // skill — not for a count — and passes `2` when it finds one.
  const previousIncorrect = (await sql.query(
    `SELECT 1 FROM quiz_answers
      WHERE child_profile_id = $1 AND skill_id = $2 AND is_correct = FALSE
      LIMIT 1`,
    [session.child_profile_id, question.skill_id],
  )) as Array<Record<string, unknown>>

  const match = answerMatchDetails(question, payload.selected_answer)
  const mistakeType = inferMistakeType(
    match.is_correct,
    payload.response_time_ms,
    previousIncorrect.length > 0 ? 2 : 0,
  )

  await sql.query(
    `INSERT INTO quiz_answers (
       id, quiz_session_id, child_profile_id, question_id, skill_id,
       selected_answer, selected_answer_raw, selected_answer_normalized,
       correct_answer_normalized, is_correct, response_time_ms, hint_used,
       attempt_count, mistake_type, created_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now())`,
    [
      crypto.randomUUID(),
      session.id,
      session.child_profile_id,
      question.id,
      question.skill_id,
      payload.selected_answer,
      match.selected_answer_raw,
      match.selected_answer_normalized,
      match.correct_answer_normalized,
      match.is_correct,
      payload.response_time_ms,
      payload.hint_used,
      payload.attempt_count,
      mistakeType,
    ],
  )

  if (match.is_correct) {
    const children = (await sql.query(
      `SELECT total_xp FROM child_profiles WHERE id = $1 LIMIT 1`,
      [session.child_profile_id],
    )) as Array<{ total_xp: number | null }>
    const totalXp = Number(children[0]?.total_xp ?? 0) + 5
    await sql.query(
      `UPDATE child_profiles
          SET total_xp = $2, current_level = $3, updated_at = now()
        WHERE id = $1`,
      [session.child_profile_id, totalXp, levelFromTotalXp(totalXp)],
    )
    await sql.query(
      `INSERT INTO xp_events (
         id, child_profile_id, source_type, source_id, xp_amount, description, created_at
       ) VALUES ($1, $2, 'correct_answer', $3, 5, NULL, now())`,
      [crypto.randomUUID(), session.child_profile_id, question.id],
    )
  }

  return jsonBody(c, {
    is_correct: match.is_correct,
    correct_answer: String(question.correct_answer),
    mistake_type: mistakeType,
  })
})

/**
 * `POST /quiz-sessions/{session_id}/complete` — the summary of a quiz session.
 */
learningRoutes.post('/quiz-sessions/:sessionId/complete', async (c) => {
  await authenticate(c)
  const sessionId = c.req.param('sessionId')
  const sql = c.get('sql')

  const sessions = (await sql.query(
    `SELECT id, child_profile_id FROM quiz_sessions WHERE id = $1 LIMIT 1`,
    [sessionId],
  )) as Array<{ id: string; child_profile_id: string }>
  const session = sessions[0]
  if (!session) {
    throw notFound('Session not found')
  }

  // The legacy service reads the answers of the session without an order, so
  // the response keeps the order of the database.
  const answers = (await sql.query(
    `SELECT skill_id, is_correct, response_time_ms
       FROM quiz_answers
      WHERE quiz_session_id = $1`,
    [session.id],
  )) as Array<{ skill_id: string; is_correct: boolean; response_time_ms: number | null }>

  const correctCount = answers.filter((answer) => answer.is_correct).length

  await sql.query(
    `UPDATE quiz_sessions
        SET completed_at = now(), total_questions = $2, correct_count = $3
      WHERE id = $1`,
    [session.id, answers.length, correctCount],
  )

  const bySkill = new Map<string, AnswerResult[]>()
  for (const answer of answers) {
    const list = bySkill.get(answer.skill_id) ?? []
    list.push({ is_correct: answer.is_correct, response_time_ms: answer.response_time_ms ?? 0 })
    bySkill.set(answer.skill_id, list)
  }

  const mastery: Array<Record<string, unknown>> = []
  for (const [skillId, results] of bySkill) {
    const score = calculateMasteryScore(results)
    const correct = results.filter((result) => result.is_correct).length
    const incorrect = results.length - correct
    const averageResponseTime = Math.trunc(
      results.reduce((sum, result) => sum + result.response_time_ms, 0) / results.length,
    )

    const existing = (await sql.query(
      `SELECT id, correct_count, incorrect_count
         FROM skill_mastery
        WHERE child_profile_id = $1 AND skill_id = $2
        LIMIT 1`,
      [session.child_profile_id, skillId],
    )) as Array<{ id: string; correct_count: number | null; incorrect_count: number | null }>

    if (existing[0]) {
      await sql.query(
        `UPDATE skill_mastery
            SET mastery_score = $2, mastery_level = $3,
                correct_count = $4, incorrect_count = $5,
                avg_response_time_ms = $6, last_practiced_at = now(), updated_at = now()
          WHERE id = $1`,
        [
          existing[0].id,
          score,
          masteryLevel(score),
          Number(existing[0].correct_count ?? 0) + correct,
          Number(existing[0].incorrect_count ?? 0) + incorrect,
          averageResponseTime,
        ],
      )
    } else {
      await sql.query(
        `INSERT INTO skill_mastery (
           id, child_profile_id, skill_id, mastery_score, mastery_level,
           correct_count, incorrect_count, avg_response_time_ms,
           last_practiced_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())`,
        [
          crypto.randomUUID(),
          session.child_profile_id,
          skillId,
          score,
          masteryLevel(score),
          correct,
          incorrect,
          averageResponseTime,
        ],
      )
    }

    mastery.push({
      skill_id: skillId,
      mastery_score: pyFloat(score),
      mastery_level: masteryLevel(score),
    })
  }

  return jsonBody(c, {
    session_id: session.id,
    correct_count: correctCount,
    mastery,
  })
})
