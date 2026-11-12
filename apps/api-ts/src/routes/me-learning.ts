/**
 * The `/me` learning endpoints — the lesson catalogue, the lesson detail and
 * the test-run flow.
 *
 * Mirrors the learning half of `apps/api/app/routers/me.py`.
 *
 * The legacy service reads the reviewed lesson content from the filesystem;
 * the Worker has no filesystem, so the approved content comes from the
 * snapshot in `src/content/lessons.snapshot.json` instead. The snapshot
 * mirrors the content tree of `apps/api/app/content/math`:
 *
 *   programs.<PROGRAM>.grades.<GRADE>.catalog[]      the lesson catalogue
 *   programs.<PROGRAM>.grades.<GRADE>.diagnostics[]  the per-topic counters
 *   programs.<PROGRAM>.grades.<GRADE>.topics.<FOLDER> the lesson + quiz variants
 *
 * Everything that belongs to the child — progress, sessions, mastery — still
 * lives in the database.
 *
 * Two behaviours are deliberately deterministic, where the legacy service is
 * random: the lesson-variant rotation and the question rotation both pick the
 * first candidate instead of drawing at random, so a request always renders
 * the same lesson.
 */
import { Hono } from 'hono'
import type { Context } from 'hono'

import lessonsSnapshot from '../content/lessons.snapshot.json'
import type { Sql } from '../lib/db'
import { badRequest, forbidden, notFound } from '../lib/errors'
import { pyFloat, toFastApiJson } from '../lib/fastapiJson'
import { requireActiveUser, requireAuth, type AppEnv } from '../lib/http'
import { levelFromTotalXp, rankTitleForScore } from '../lib/progression'
import { roundLikePython } from '../lib/quests'

/* ────────────────────────────── snapshot ─────────────────────────────── */

/** A JSON object of unknown shape. */
type Json = Record<string, unknown>

/** One catalogue row of a grade. */
interface SnapshotLessonRow {
  lesson_id: string
  lesson_group_id: string
  topic_folder: string | null
  grade_level: number
  title: string
  title_th: string
  title_en: string
  description: string
  description_th: string
  topic_code: string
  skill_code: string
  estimated_minutes: number
  has_approved_test: boolean
  test_available: boolean
  test_unavailable_reason: string | null
}

/** One lesson variant file of a topic folder. */
interface SnapshotLessonVariant {
  variant_id: string
  status: string
  source_filename: string
  source_path_hash: string
  payload: Json
}

/** One quiz variant file of a topic folder. */
interface SnapshotQuizVariant {
  quiz_variant_id: string
  status: string
  source_filename: string
  source_path_hash: string
  questions: Json[]
}

/** The lesson and quiz variants of one topic folder. */
interface SnapshotTopic {
  topic_folder: string
  lesson_group_id: string
  lesson_variants: SnapshotLessonVariant[]
  quiz_variants: SnapshotQuizVariant[]
}

/** The per-topic counters of one grade. */
interface SnapshotDiagnostic {
  topic_folder: string
  lesson_group_id: string
  variant_count: number
  approved_variant_count: number
  needs_review_variant_count: number
  rejected_variant_count: number
  beta_visible_count: number
  quiz_variant_count: number
  approved_quiz_count: number
  student_visible: boolean
  test_available: boolean
  hidden_reason: string | null
}

/** One grade of one programme. */
interface SnapshotGrade {
  catalog: SnapshotLessonRow[]
  diagnostics: SnapshotDiagnostic[]
  topics: Record<string, SnapshotTopic>
}

/** The shape of `src/content/lessons.snapshot.json`. */
interface LessonSnapshot {
  programs: Record<string, { grades: Record<string, SnapshotGrade> }>
}

const snapshot = lessonsSnapshot as unknown as LessonSnapshot

/* ────────────────────────────── constants ─────────────────────────────── */

/** The grades the pilot exposes. */
const BETA_READY_GRADES = new Set([1, 2, 3, 4, 5, 6])

/** Membership states that unlock the paid features. */
const PAID_MEMBERSHIP_STATUSES = new Set(['paid', 'plus', 'trial'])

/** The question mix of a test session. */
const RATIO_POLICY = '80_core_20_challenge'

/** The block types the student page renders. */
const ALLOWED_BLOCK_TYPES = new Set([
  'story_intro',
  'think_story',
  'model_diagram',
  'number_sentence',
  'mini_quiz',
  'helper_tip',
])

/** The block types that are folded into the model diagram. */
const MODEL_BLOCK_TYPES = new Set([
  'area_model',
  'array_model',
  'bar_model',
  'number_bond',
  'part_whole_model',
  'place_value_chart',
  'ten_frame',
])

/** The block types that are no longer rendered. */
const DEPRECATED_BLOCK_TYPES = new Set(['step_cards', 'worked_example', 'common_mistakes'])

/** The reason a lesson has no approved test. */
const NO_TEST_REASON_TH = 'ยังไม่มีแบบทดสอบที่อนุมัติสำหรับบทนี้'

/** The lock reason of a lesson a free child may not open. */
const LESSON_LOCK_REASON = 'สมาชิกฟรีเรียนได้เฉพาะบทเรียนแรก'

/* ────────────────────────────── rendering ─────────────────────────────── */

/**
 * Serialise a payload the way Starlette's `JSONResponse` does.
 *
 * @param c the request context.
 * @param payload the payload to serialise.
 * @param status the HTTP status code.
 */
function jsonBody(
  c: Context<AppEnv>,
  payload: unknown,
  status: 200 | 201 | 400 | 404 | 409 | 422 = 200,
) {
  return c.text(toFastApiJson(payload), status, { 'content-type': 'application/json' })
}

/* ────────────────────────────── child model ───────────────────────────── */

/** The child columns the learning endpoints read. */
const LEARNING_CHILD_COLUMNS = `
  id, grade_level, program_type, membership_status, membership_provider,
  mpp_access_ends_at, plan_code, plan_type, billing_program_type,
  active_price_code, price_type, manual_grant_reason,
  total_score, total_xp, coins, current_level, current_rank_title,
  test_attempts_used, free_test_limit, total_tests_completed,
  average_test_accuracy, average_test_speed, streak_count
`

/** A child profile as the learning endpoints need it. */
interface LearningChild {
  id: string
  grade_level: number
  program_type: string
  membership_status: string
  membership_provider: string | null
  mpp_access_ends_at: string | null
  plan_code: string | null
  plan_type: string | null
  billing_program_type: string | null
  active_price_code: string | null
  price_type: string | null
  manual_grant_reason: string | null
  total_score: number
  total_xp: number
  coins: number
  current_level: number
  current_rank_title: string
  test_attempts_used: number
  free_test_limit: number
  total_tests_completed: number
  average_test_accuracy: number
  average_test_speed: number
  streak_count: number
}

/**
 * Load the child profile of the authenticated user.
 *
 * @param sql the database handle.
 * @param userId the id of the parent user.
 */
async function loadLearningChild(sql: Sql, userId: string): Promise<LearningChild> {
  const rows = (await sql.query(
    `SELECT ${LEARNING_CHILD_COLUMNS} FROM child_profiles WHERE parent_user_id = $1 LIMIT 1`,
    [userId],
  )) as LearningChild[]
  const child = rows[0]
  if (!child) {
    throw notFound('ไม่พบโปรไฟล์นักเรียน')
  }
  return {
    ...child,
    grade_level: Number(child.grade_level ?? 1),
    total_score: Number(child.total_score ?? 0),
    total_xp: Number(child.total_xp ?? 0),
    coins: Number(child.coins ?? 0),
    current_level: Number(child.current_level ?? 1),
    test_attempts_used: Number(child.test_attempts_used ?? 0),
    free_test_limit: Number(child.free_test_limit ?? 5),
    total_tests_completed: Number(child.total_tests_completed ?? 0),
    average_test_accuracy: Number(child.average_test_accuracy ?? 0),
    average_test_speed: Number(child.average_test_speed ?? 0),
    streak_count: Number(child.streak_count ?? 0),
  }
}

/**
 * The membership and plan fields the programme-access checks read.
 *
 * The dashboard and the learning endpoints both need them, so the checks
 * take this narrow shape rather than a whole child profile.
 */
export interface PlanAccessChild {
  program_type: string
  membership_status: string
  membership_provider: string | null
  mpp_access_ends_at: string | null
  plan_code: string | null
  plan_type: string | null
  billing_program_type: string | null
  active_price_code: string | null
  price_type: string | null
  manual_grant_reason: string | null
}

/** Whether the child has a paid membership. */
function isPaid(child: PlanAccessChild, now: Date): boolean {
  const status = (child.membership_status ?? 'free').toLowerCase()
  if (!PAID_MEMBERSHIP_STATUSES.has(status)) {
    return false
  }
  if ((child.membership_provider ?? '') === 'mpp') {
    if (!child.mpp_access_ends_at) {
      return false
    }
    return new Date(child.mpp_access_ends_at).getTime() > now.getTime()
  }
  return true
}

/** Whether the child may use the EP programme. */
function isEpPlus(child: PlanAccessChild, now: Date): boolean {
  if (!isPaid(child, now)) {
    return false
  }
  if ((child.membership_provider ?? '') === 'mpp') {
    return (child.plan_code ?? '') === 'ep_plus'
  }
  const programs = new Set(
    [(child.billing_program_type ?? '').toUpperCase(), (child.program_type ?? '').toUpperCase()],
  )
  const planFields = [
    child.plan_code,
    child.plan_type,
    child.active_price_code,
    child.price_type,
    child.manual_grant_reason,
  ]
    .map((value) => String(value ?? '').toLowerCase())
    .join(' ')
  return (
    programs.has('EP') || programs.has('BOTH') || planFields.includes('ep_') || planFields.includes('ep-plus')
  )
}

/** The remaining free test attempts of the child. */
function remainingFreeTests(child: LearningChild): number {
  const limit = child.free_test_limit || 5
  const used = child.test_attempts_used || 0
  return Math.max(0, limit - used)
}

/** The grade the system recommends a foundation test for. */
function recommendedFoundationGrade(gradeLevel: number): number {
  if (gradeLevel <= 1) {
    return 1
  }
  return Math.max(1, Math.min(6, gradeLevel - 1))
}

/* ───────────────────────────── programme ──────────────────────────────── */

/** Normalise a programme name the way `program_alias` does. */
function programAlias(value: unknown): 'TH' | 'EP' {
  const raw = String(value ?? 'TH').trim().toUpperCase()
  if (raw === 'EP' || raw === 'EN' || raw === 'ENGLISH') {
    return 'EP'
  }
  return 'TH'
}

/** Normalise the programme of a lesson payload. */
function lessonProgramAlias(payload: Json): 'TH' | 'EP' {
  const raw = String(
    payload.program_type ?? payload.content_program_type ?? payload.track ?? '',
  )
    .trim()
    .toUpperCase()
  if (raw === 'EP' || raw === 'EN' || raw === 'ENGLISH') {
    return 'EP'
  }
  return 'TH'
}

/** The grades of a programme that the snapshot carries. */
function snapshotGrades(program: string): Record<string, SnapshotGrade> {
  return snapshot.programs[program]?.grades ?? {}
}

/** The catalogue rows of one grade. */
function snapshotCatalog(program: string, grade: number): SnapshotLessonRow[] {
  return snapshotGrades(program)[String(grade)]?.catalog ?? []
}

/** The per-topic counters of one grade. */
function snapshotDiagnostics(program: string, grade: number): SnapshotDiagnostic[] {
  return snapshotGrades(program)[String(grade)]?.diagnostics ?? []
}

/** The topic folders of one grade. */
function snapshotTopics(program: string, grade: number): Record<string, SnapshotTopic> {
  return snapshotGrades(program)[String(grade)]?.topics ?? {}
}

/** The grades the snapshot carries for a programme. */
function snapshotGradeNumbers(program: string): number[] {
  return Object.keys(snapshotGrades(program))
    .map(Number)
    .filter((grade) => Number.isFinite(grade))
    .sort((a, b) => a - b)
}

/* ──────────────────────── lesson item rendering ──────────────────────── */

/**
 * The synthetic payload the legacy service builds for a catalogue row.
 *
 * @param row the catalogue row.
 * @param program the programme the catalogue belongs to.
 */
function catalogPayload(row: SnapshotLessonRow, program: 'TH' | 'EP'): Json {
  const lessonId = row.lesson_id
  return {
    lesson_id: lessonId,
    id: lessonId,
    lesson_group_id: row.lesson_group_id || lessonId,
    topic_folder: row.topic_folder ?? null,
    grade_level: Number(row.grade_level ?? 1),
    topic_code: row.topic_code || lessonId,
    skill_code: row.skill_code || row.topic_code || lessonId,
    title_th: row.title_th || row.title || lessonId,
    title_en: row.title_en ?? null,
    program_type: program,
    estimated_minutes: row.estimated_minutes || 8,
    has_approved_test: Boolean(row.has_approved_test),
    test_available: Boolean(row.has_approved_test),
    test_unavailable_reason: row.test_unavailable_reason ?? null,
    ep_available: program === 'EP',
    is_topic_folder_group: true,
  }
}

/**
 * Render one lesson, the way `_json_lesson_item` does.
 *
 * The key order matches the legacy payload, because the responses are
 * compared field by field.
 *
 * @param payload the lesson payload.
 * @param childGradeLevel the grade level of the child profile.
 * @param currentIndex the position of the lesson inside the current grade.
 */
function renderLessonItem(payload: Json, childGradeLevel: number, currentIndex: number | null): Json {
  const gradeLevel = Number(payload.grade_level ?? 1)
  const isReview = gradeLevel < childGradeLevel
  const isBetaVisible = BETA_READY_GRADES.has(gradeLevel)
  const isFree = isBetaVisible || isReview || currentIndex === 0
  const isLocked = !isBetaVisible && !isFree
  const lessonId = String(payload.lesson_id ?? payload.id ?? '')
  const description =
    (payload.description_th as string | undefined) ||
    (payload.objective_th as string | undefined) ||
    (payload.story_intro_th as string | undefined) ||
    ''
  const hasApprovedTest = Boolean(payload.has_approved_test)
  const hasTest = Boolean(payload.has_test ?? true) || hasApprovedTest
  const program = lessonProgramAlias(payload)
  const unavailableReason =
    hasTest && hasApprovedTest
      ? null
      : ((payload.test_unavailable_reason as string | undefined) || NO_TEST_REASON_TH)
  return {
    lesson_id: lessonId,
    id: lessonId,
    lesson_group_id: payload.lesson_group_id ?? lessonId,
    topic_folder: payload.topic_folder ?? null,
    title_th: payload.title_th ?? lessonId,
    title_en: payload.title_en ?? null,
    program_type: program,
    description_th: description,
    description,
    title: payload.title_th ?? lessonId,
    grade_level: gradeLevel,
    topic_code: payload.topic_code ?? lessonId,
    skill_code: payload.skill_code ?? payload.topic_code ?? lessonId,
    estimated_minutes: Number(payload.estimated_minutes || 5),
    duration: Number(payload.estimated_minutes || 5),
    is_free: isFree,
    is_locked: isLocked,
    lock_reason: isLocked ? LESSON_LOCK_REASON : null,
    has_test: hasTest,
    has_approved_test: hasApprovedTest,
    test_available: hasTest && hasApprovedTest,
    test_unavailable_reason: unavailableReason,
    test_disabled_reason: unavailableReason,
    language_available: program,
    ep_available: Boolean(payload.ep_available),
    is_review: isReview,
    access_type: isReview ? 'review' : 'current',
    status: isLocked ? 'locked' : 'available',
    content_preview: description,
    linked_quiz_id: payload.quiz_id ?? null,
  }
}

/** The lesson sections of a child, split by grade. */
export interface LessonSections {
  all_lessons: Json[]
  free_lessons: Json[]
  locked_lessons: Json[]
  current_grade_lessons: Json[]
  review_lessons: Json[]
  future_lessons: Json[]
}

/**
 * Build the lesson sections of a child from the snapshot catalogue.
 *
 * The catalogue is the source of truth: the lesson ids it produces are the
 * ones `/me/lessons/:lessonId` resolves, so a dashboard that links to a
 * lesson must use the same ids.
 *
 * @param program the programme of the catalogue.
 * @param childGradeLevel the grade level of the child profile.
 * @param sectionGrades the grades the sections cover.
 */
export function buildLessonSections(
  program: 'TH' | 'EP',
  childGradeLevel: number,
  sectionGrades: Set<number>,
): LessonSections {
  const rows: SnapshotLessonRow[] = []
  for (const grade of [...sectionGrades].sort((a, b) => a - b)) {
    for (const row of snapshotCatalog(program, grade)) {
      if (sectionGrades.has(Number(row.grade_level))) {
        rows.push(row)
      }
    }
  }
  rows.sort(
    (a, b) =>
      Number(a.grade_level) - Number(b.grade_level) ||
      (a.lesson_id < b.lesson_id ? -1 : a.lesson_id > b.lesson_id ? 1 : 0),
  )

  const items: Json[] = []
  let currentCount = 0
  for (const row of rows) {
    const currentIndex = Number(row.grade_level) === childGradeLevel ? currentCount : null
    if (currentIndex !== null) {
      currentCount += 1
    }
    items.push(renderLessonItem(catalogPayload(row, program), childGradeLevel, currentIndex))
  }

  return {
    all_lessons: items,
    free_lessons: items.filter((item) => item.is_free === true),
    locked_lessons: items.filter((item) => item.is_locked === true),
    current_grade_lessons: items.filter((item) => item.grade_level === childGradeLevel),
    review_lessons: items.filter((item) => Number(item.grade_level) < childGradeLevel),
    future_lessons: items.filter((item) => Number(item.grade_level) > childGradeLevel),
  }
}

/**
 * Keep only the lessons of one grade.
 *
 * @param sections the sections to filter.
 * @param grade the grade to keep, or `null` to keep everything.
 */
function filterSectionsByGrade(sections: LessonSections, grade: number | null): LessonSections {
  if (grade === null) {
    return sections
  }
  const keep = (list: Json[]) => list.filter((item) => Number(item.grade_level) === grade)
  return {
    all_lessons: keep(sections.all_lessons),
    free_lessons: keep(sections.free_lessons),
    locked_lessons: keep(sections.locked_lessons),
    current_grade_lessons: keep(sections.current_grade_lessons),
    review_lessons: keep(sections.review_lessons),
    future_lessons: keep(sections.future_lessons),
  }
}

/**
 * The content diagnostics of one grade, as `topic_folder_diagnostics` returns them.
 *
 * @param program the programme.
 * @param grade the grade.
 */
export function buildContentDiagnostics(program: 'TH' | 'EP', grade: number): Json {
  const topics = snapshotDiagnostics(program, grade)
  const sum = (pick: (row: SnapshotDiagnostic) => number) =>
    topics.reduce((total, row) => total + pick(row), 0)
  const totalVariants = sum((row) => row.variant_count)
  const approvedVariants = sum((row) => row.approved_variant_count)
  const betaVisible = sum((row) => row.beta_visible_count)
  return {
    grade_level: grade,
    program_type: program,
    topic_folders_found: topics.length,
    lesson_variants_found: totalVariants,
    approved_variants: approvedVariants,
    needs_review_variants: sum((row) => row.needs_review_variant_count),
    beta_visible_count: betaVisible,
    rejected_variants: sum((row) => row.rejected_variant_count),
    student_visible_count: topics.filter((row) => row.student_visible).length,
    quiz_variants_found: sum((row) => row.quiz_variant_count),
    approved_quiz_variants: sum((row) => row.approved_quiz_count),
    hidden_reason:
      topics.length && totalVariants && approvedVariants === 0 && betaVisible === 0
        ? 'found_files_but_needs_review'
        : null,
    topics: topics.map((row) => ({ ...row })),
  }
}

/* ───────────────────── visual block normalisation ───────────────────── */

/** Parse a JSON-encoded string, like `_parse_json_like` does. */
function parseJsonLike(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value
  }
  const text = value.trim()
  if (!text) {
    return value
  }
  if (
    !(
      (text.startsWith('{') && text.endsWith('}')) ||
      (text.startsWith('[') && text.endsWith(']'))
    )
  ) {
    return value
  }
  try {
    return JSON.parse(text)
  } catch {
    return value
  }
}

/** Normalise nested values, like `_normalize_nested_visual_value` does. */
function normalizeNested(value: unknown): unknown {
  const parsed = parseJsonLike(value)
  if (Array.isArray(parsed)) {
    return parsed.map((entry) => normalizeNested(entry))
  }
  if (parsed && typeof parsed === 'object') {
    const result: Json = {}
    for (const [key, entry] of Object.entries(parsed as Json)) {
      result[key] = normalizeNested(entry)
    }
    return result
  }
  return parsed
}

/**
 * Normalise one visual block, like `normalize_visual_blocks` does.
 *
 * This is the first of the two normalisation passes: it keeps the block
 * shape (`type` + `data`) and folds the remaining block keys into `data`.
 *
 * @param block the block to normalise.
 */
function normalizeVisualBlock(block: unknown): Json | null {
  const parsed = parseJsonLike(block)
  if (Array.isArray(parsed)) {
    const nested = normalizeVisualBlocks(parsed)
    return nested[0] ?? null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null
  }
  const source = parsed as Json
  const blockType = String(source.type ?? source.block_type ?? 'content')
  const rawData = source.data
  let data: Json
  if (rawData === undefined || rawData === null) {
    data = {}
    for (const [key, value] of Object.entries(source)) {
      if (key === 'type' || key === 'block_type' || key === 'data') {
        continue
      }
      data[key] = value
    }
  } else {
    const parsedData = parseJsonLike(rawData)
    data =
      parsedData && typeof parsedData === 'object' && !Array.isArray(parsedData)
        ? { ...(parsedData as Json) }
        : { value: parsedData }
    for (const [key, value] of Object.entries(source)) {
      if (
        key === 'type' ||
        key === 'block_type' ||
        key === 'data' ||
        key === 'title' ||
        key === 'title_th' ||
        key === 'title_en'
      ) {
        continue
      }
      if (!(key in data)) {
        data[key] = value
      }
    }
  }
  // A block that carries its text in `content` also exposes it as
  // `text_th`, so the renderer reads one field for every block type.
  if ('content' in source && !('text_th' in data) && !('text' in data)) {
    data.text_th = source.content
  }
  const title = source.title_th ?? source.title ?? source.title_en ?? ''
  return { type: blockType, title_th: String(title), data: normalizeNested(data) as Json }
}

/**
 * Normalise a list of visual blocks, like `normalize_visual_blocks` does.
 *
 * @param value the blocks to normalise.
 */
function normalizeVisualBlocks(value: unknown): Json[] {
  const parsed = parseJsonLike(value)
  if (parsed === undefined || parsed === null) {
    return []
  }
  if (!Array.isArray(parsed)) {
    const block = normalizeVisualBlock(parsed)
    return block ? [block] : []
  }
  const blocks: Json[] = []
  for (const item of parsed) {
    const entry = parseJsonLike(item)
    if (Array.isArray(entry)) {
      blocks.push(...normalizeVisualBlocks(entry))
      continue
    }
    const block = normalizeVisualBlock(entry)
    if (block) {
      blocks.push(block)
    }
  }
  return blocks
}

/** The number of a value, like `_number_value` does. */
function numberValue(value: unknown): number | null {
  const match = /-?\d+(?:\.\d+)?/.exec(String(value ?? '').trim())
  if (!match) {
    return null
  }
  const parsed = Number(match[0])
  return Number.isFinite(parsed) ? parsed : null
}

/** The index of an A–D answer letter. */
function letterChoiceIndex(value: unknown): number | null {
  const text = String(value ?? '').trim().toUpperCase()
  const index = ['A', 'B', 'C', 'D'].indexOf(text)
  return index === -1 ? null : index
}

/** The numeric text of a value, like `_number_text` does. */
function numberText(value: unknown): string | null {
  const parsed = numberValue(value)
  if (parsed === null) {
    return null
  }
  return String(parsed)
}

/**
 * Normalise the data of a mini quiz block.
 *
 * @param data the block data.
 */
function normalizeMiniQuizData(data: Json): Json {
  let source = data
  const questions = source.questions
  if (Array.isArray(questions) && questions.length && typeof questions[0] === 'object') {
    source = { ...source, ...(questions[0] as Json) }
  }
  let question = String(source.question_th ?? source.question_en ?? source.question ?? '')
  if (!question) {
    question = String(
      source.text_th ?? source.question_text ?? source.question_text_th ?? '',
    )
  }
  let rawChoices = source.choices
  if (!Array.isArray(rawChoices)) {
    rawChoices = Array.isArray(source.choices_th)
      ? source.choices_th
      : Array.isArray(source.choices_en)
        ? source.choices_en
        : []
  }
  const choices = (rawChoices as unknown[]).map((choice) => String(choice).trim())
  let rawAnswer = source.correct_answer
  if (
    rawAnswer === undefined ||
    rawAnswer === null ||
    String(rawAnswer).trim() === ''
  ) {
    rawAnswer = source.correct_answer_th ?? source.correct_answer_en ?? source.answer
  }
  const letterIndex = letterChoiceIndex(rawAnswer)
  if (letterIndex !== null && letterIndex < choices.length) {
    rawAnswer = choices[letterIndex]
  }
  const explanation = String(
    source.explanation_th ?? source.explanation_en ?? source.explanation ?? '',
  )
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
    ...source,
    question_th: String(question),
    choices,
    correct_answer: answer,
    answer,
    explanation_th: String(explanation),
  }
}

/**
 * Normalise one visual block the way the lesson content service does.
 *
 * This is the second normalisation pass: it maps the block types onto the
 * ones the student page renders and normalises the mini-quiz data.
 *
 * @param block the block to normalise.
 */
function normalizeLessonBlock(block: unknown): Json | null {
  const parsed = parseJsonLike(block)
  if (Array.isArray(parsed)) {
    const nested = normalizeLessonBlocks(parsed)
    return nested[0] ?? null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null
  }
  const source = parsed as Json
  const rawType = String(source.type ?? source.block_type ?? '').trim()
  if (DEPRECATED_BLOCK_TYPES.has(rawType)) {
    return null
  }
  let blockType = rawType
  const rawData = parseJsonLike(source.data)
  let data: Json =
    rawData && typeof rawData === 'object' && !Array.isArray(rawData)
      ? { ...(rawData as Json) }
      : {}
  // The remaining block keys are folded into the data, except the ones that
  // only describe the block itself.
  for (const [key, value] of Object.entries(source)) {
    if (
      key === 'type' ||
      key === 'block_type' ||
      key === 'data' ||
      key === 'title' ||
      key === 'title_th' ||
      key === 'title_en'
    ) {
      continue
    }
    if (!(key in data)) {
      data[key] = value
    }
  }
  // A block that carries its text in `content` also exposes it as
  // `text_th`, so the renderer can read one field for every block type.
  if ('content' in source && !('text_th' in data) && !('text' in data)) {
    data.text_th = source.content
  }
  data = normalizeNested(data) as Json

  if (blockType === 'grouping_model') {
    const groupCount = Math.trunc(numberValue(data.groups) ?? 0)
    const itemsPerGroup = Math.trunc(numberValue(data.items_per_group) ?? 0)
    let groups = Array.isArray(data.groups) ? data.groups : []
    if (!groups.length && groupCount > 0) {
      groups = Array.from({ length: groupCount }, (_value, index) => ({
        group_index: index + 1,
        item_count: itemsPerGroup,
      }))
    }
    data = { ...data, model_type: 'sharing_groups', groups }
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

  const title = source.title_th ?? source.title ?? source.title_en ?? ''
  return { type: blockType, title_th: String(title), data }
}

/**
 * Normalise a list of visual blocks the way the lesson content service does.
 *
 * @param value the blocks to normalise.
 */
function normalizeLessonBlocks(value: unknown): Json[] {
  const parsed = parseJsonLike(value)
  if (parsed === undefined || parsed === null) {
    return []
  }
  if (!Array.isArray(parsed)) {
    const block = normalizeLessonBlock(parsed)
    return block ? [block] : []
  }
  const blocks: Json[] = []
  for (const item of parsed) {
    const entry = parseJsonLike(item)
    if (Array.isArray(entry)) {
      blocks.push(...normalizeLessonBlocks(entry))
      continue
    }
    const block = normalizeLessonBlock(entry)
    if (block) {
      blocks.push(block)
    }
  }
  return blocks
}

/* ──────────────────── lesson sections and view model ─────────────────── */

/** The type of a visual block. */
function visualBlockType(block: Json): string {
  return String(block.block_type ?? block.type ?? '').trim()
}

/**
 * The localised text of a visual block.
 *
 * @param block the block to read.
 * @param program the programme of the child.
 * @param baseName the name of the text field.
 * @param fallbackKeys the keys to try after the localised ones.
 */
function localizedVisualBlockText(
  block: Json | null | undefined,
  program: 'TH' | 'EP',
  baseName: string,
  fallbackKeys: string[] = [],
): string {
  const data = (block?.data && typeof block.data === 'object' ? block.data : {}) as Json
  const suffix = program === 'EP' ? 'en' : 'th'
  const localizedKeys = [
    `content_${suffix}`,
    `${baseName}_${suffix}`,
    `text_${suffix}`,
    'content',
    baseName,
  ]
  for (const key of [...localizedKeys, ...fallbackKeys]) {
    const nested = data[key]
    if (typeof nested === 'string' && nested.trim()) {
      return nested.trim()
    }
    const value = block?.[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
    const content = data.content
    if (content && typeof content === 'object' && !Array.isArray(content)) {
      const nestedContent = (content as Json)[key]
      if (typeof nestedContent === 'string' && nestedContent.trim()) {
        return nestedContent.trim()
      }
    }
  }
  return ''
}

/** The localised value of a visual block field. */
function localizedValue(
  block: Json | null | undefined,
  data: Json,
  program: 'TH' | 'EP',
  baseName: string,
): unknown {
  const suffix = program === 'EP' ? 'en' : 'th'
  for (const key of [`${baseName}_${suffix}`, baseName]) {
    const value = data[key]
    if (value !== undefined && value !== null && value !== '') {
      return value
    }
    const fallback = block?.[key]
    if (fallback !== undefined && fallback !== null && fallback !== '') {
      return fallback
    }
  }
  return ''
}

/** The number sentence of a lesson section. */
function normalizedNumberSentence(block: Json | null | undefined, program: 'TH' | 'EP'): Json {
  const data = (block?.data && typeof block.data === 'object' ? block.data : {}) as Json
  if (!('unit' in data)) {
    data.unit = program === 'EP' ? 'baht' : 'บาท'
  }
  const operations = Array.isArray(data.operations) ? data.operations : []
  const steps: Json[] = []
  operations.forEach((operation, index) => {
    if (!operation || typeof operation !== 'object' || Array.isArray(operation)) {
      return
    }
    const source = operation as Json
    const a = source.a
    const b = source.b
    const result = source.result
    const numeric = [a, b, result].every(
      (value) => typeof value === 'number' || typeof value === 'bigint',
    )
    steps.push({
      step: index + 1,
      operation: source.op ?? null,
      a: a ?? null,
      b: b ?? null,
      result: result ?? null,
      expression: numeric
        ? `${Number(a).toLocaleString('en-US')} ${String(source.op ?? '')} ${Number(
            b,
          ).toLocaleString('en-US')} = ${Number(result).toLocaleString('en-US')}`
        : '',
    })
  })
  const finalAnswer = steps.length ? (steps[steps.length - 1]?.result ?? null) : null
  return {
    steps,
    final_answer: finalAnswer,
    unit: data.unit ?? 'บาท',
    expression:
      data[program === 'EP' ? 'content_en' : 'content_th'] ??
      data.expression ??
      localizedVisualBlockText(block ?? null, program, 'expression', ['content']),
  }
}

/** The practice block of a lesson section. */
function normalizedPractice(block: Json | null | undefined, program: 'TH' | 'EP'): Json {
  const data = (block?.data && typeof block.data === 'object' ? block.data : {}) as Json
  return {
    question: localizedValue(block, data, program, 'question'),
    choices: localizedValue(block, data, program, 'choices') || [],
    correct_answer: localizedValue(block, data, program, 'correct_answer'),
    explanation: localizedValue(block, data, program, 'explanation'),
  }
}

/**
 * The student-page sections of a lesson.
 *
 * @param payload the lesson payload.
 * @param blocks the normalised visual blocks.
 * @param program the programme of the child.
 */
function extractLessonSections(payload: Json, blocks: Json[], program: 'TH' | 'EP'): Json {
  const byType = new Map<string, Json>()
  for (const block of blocks) {
    const type = visualBlockType(block)
    if (!byType.has(type)) {
      byType.set(type, block)
    }
  }
  const storyBlock = byType.get('story_intro') ?? {}
  const thinkBlock = byType.get('think_story') ?? {}
  const modelBlock = byType.get('model_diagram') ?? {}
  const sentenceBlock = byType.get('number_sentence') ?? {}
  const practiceBlock = byType.get('mini_quiz') ?? {}
  return {
    lesson_group_id: payload.lesson_group_id ?? payload.lesson_id ?? payload.id ?? null,
    topic_folder: payload.topic_folder ?? null,
    selected_variant_id: payload.selected_variant_id ?? payload.variant_id ?? null,
    title: (program === 'EP' ? payload.title_en : payload.title_th) ?? payload.title ?? '',
    subtitle:
      (program === 'EP' ? payload.variant_title_en : payload.variant_title_th) ??
      payload.title_en ??
      '',
    icon: payload.icon ?? '+-',
    helper_tip: (program === 'EP' ? payload.helper_tip_en : payload.helper_tip) ?? '',
    story: localizedVisualBlockText(storyBlock, program, 'story') || payload.story_theme_th || '',
    think_story:
      localizedVisualBlockText(thinkBlock, program, 'think_story') || payload.think_story_th || '',
    model_diagram: Object.keys(modelBlock).length ? modelBlock : null,
    number_sentence: Object.keys(sentenceBlock).length ? sentenceBlock : null,
    practice: Object.keys(practiceBlock).length ? practiceBlock : null,
  }
}

/**
 * The stable view model of the student page.
 *
 * @param payload the lesson payload.
 * @param sections the student-page sections.
 * @param hasApprovedTest whether the lesson has an approved test.
 */
function buildLessonViewModel(payload: Json, sections: Json, hasApprovedTest: boolean): Json {
  const program = lessonProgramAlias(payload)
  const lessonGroupId = sections.lesson_group_id ?? null
  return {
    lesson_group_id: lessonGroupId,
    selected_variant_id: sections.selected_variant_id ?? null,
    grade_level: Number(payload.grade_level ?? 0),
    program_type: program,
    topic_folder: sections.topic_folder ?? null,
    title: sections.title ?? '',
    subtitle: sections.subtitle ?? '',
    icon: sections.icon ?? '+-',
    mascot_helper: {
      mascot_id: null,
      mascot_name: null,
      image_src: null,
      title: null,
      tip: sections.helper_tip ?? '',
    },
    story_label: sections.subtitle || sections.title || lessonGroupId,
    story: sections.story ?? '',
    think_story: sections.think_story ?? '',
    model_diagram: sections.model_diagram ?? null,
    number_sentence: normalizedNumberSentence(
      (sections.number_sentence ?? null) as Json | null,
      program,
    ),
    practice: normalizedPractice((sections.practice ?? null) as Json | null, program),
    test_available: hasApprovedTest,
    test_unavailable_reason: hasApprovedTest
      ? null
      : (payload.test_unavailable_reason ?? null),
  }
}

/**
 * The content payload of a lesson, like `_json_lesson_content_payload` builds it.
 *
 * @param payload the lesson payload.
 * @param item the catalogue item of the lesson.
 * @param variant the selected variant payload, when there is one.
 */
function buildLessonContentPayload(payload: Json, item: Json, variant: Json | null): Json {
  const lessonId = String(payload.lesson_id ?? payload.id)
  const hasApprovedTest = Boolean(payload.has_approved_test)
  const normalizedBlocks = normalizeVisualBlocks(
    (variant ?? {}).visual_blocks ?? payload.visual_blocks,
  )
  const program = lessonProgramAlias(payload)
  const base: Json = {
    lesson_id: lessonId,
    id: lessonId,
    grade_level: Number(payload.grade_level ?? item.grade_level ?? 0),
    program_type: program,
    title_th: payload.title_th ?? item.title_th ?? '',
    title_en: payload.title_en ?? '',
    objective_th: payload.objective_th ?? '',
    objective_en: payload.objective_en ?? '',
    thai_support: payload.thai_support ?? '',
    vocabulary: payload.vocabulary ?? [],
    explanation_en: payload.explanation_en ?? '',
    explanation_th: payload.explanation_th ?? '',
    story_intro_th: payload.story_intro_th ?? '',
    explanation_steps: payload.explanation_steps ?? [],
    worked_examples: payload.worked_examples ?? [],
    common_mistakes: payload.common_mistakes ?? [],
    hints: payload.hints ?? [],
    estimated_minutes: Number(payload.estimated_minutes ?? item.estimated_minutes ?? 5),
    has_test: Boolean(payload.has_test ?? item.has_test) || hasApprovedTest,
    has_approved_test: hasApprovedTest,
    test_available: hasApprovedTest,
    test_unavailable_reason: hasApprovedTest
      ? null
      : (payload.test_unavailable_reason ?? NO_TEST_REASON_TH),
    language_available: program,
    ep_available: Boolean(payload.ep_available),
    topic_code: payload.topic_code ?? item.topic_code,
    skill_code: payload.skill_code ?? item.skill_code,
    is_locked: item.is_locked ?? false,
    lock_reason: item.lock_reason ?? null,
  }
  const sections = extractLessonSections(payload, normalizedBlocks, program)
  const merged: Json = { ...base, ...sections }
  merged.lesson_view_model = buildLessonViewModel(payload, sections, hasApprovedTest)
  // `_with_variant_payload` fills the variant fields, keeping the positions of
  // the keys that are already present.
  const variantPayload = variant ?? {}
  if (!('selected_variant_id' in merged)) {
    merged.selected_variant_id =
      variantPayload.selected_variant_id ?? variantPayload.variant_id ?? sections.selected_variant_id ?? null
  }
  if (!('variant_title_th' in merged)) {
    merged.variant_title_th = variantPayload.variant_title_th ?? ''
  }
  if (!('story_theme_th' in merged)) {
    merged.story_theme_th = variantPayload.story_theme_th ?? ''
  }
  if (!('helper_tip' in merged)) {
    merged.helper_tip = variantPayload.helper_tip ?? sections.helper_tip ?? ''
  }
  // The sections are built from the blocks as they were normalised the
  // first time, and the response carries the blocks normalised a second
  // time, the same way the legacy service does it.
  merged.visual_blocks = normalizeLessonBlocks(normalizedBlocks)
  return merged
}

/* ─────────────────────── variant rotation (DB state) ─────────────────── */

/** The rotation state of the lesson variants a child has seen. */
interface VariantView {
  variant_id: string
  cycle_number: number
}

/**
 * Pick the lesson variant the child should see next.
 *
 * The legacy service draws the variant at random; the Worker keeps the first
 * candidate, so the same request always renders the same lesson.
 *
 * @param variantIds the ids of the approved variants.
 * @param views the views the child already has.
 */
function selectVariant(
  variantIds: string[],
  views: VariantView[],
): { variantId: string; cycleNumber: number } {
  if (!variantIds.length) {
    return { variantId: '', cycleNumber: 1 }
  }
  let cycleNumber = 1
  for (const view of views) {
    cycleNumber = Math.max(cycleNumber, Number(view.cycle_number) || 1)
  }
  const seen = new Set(
    views
      .filter((view) => (Number(view.cycle_number) || 1) === cycleNumber)
      .map((view) => view.variant_id),
  )
  if (seen.size >= variantIds.length) {
    cycleNumber += 1
    seen.clear()
  }
  const lastVariantId = views.length ? views[views.length - 1]?.variant_id : undefined
  let candidates = variantIds.filter((variantId) => !seen.has(variantId))
  if (candidates.length > 1 && lastVariantId && candidates.includes(lastVariantId)) {
    candidates = candidates.filter((variantId) => variantId !== lastVariantId)
  }
  return { variantId: candidates[0] ?? variantIds[0]!, cycleNumber }
}

/* ────────────────────────── questions and tests ─────────────────────── */

/** A question row of the database. */
interface QuestionRow {
  id: string
  skill_id: string
  grade_level: number
  question_type: string
  difficulty: string
  question_text: string
  choices: string[] | null
  correct_answer: string
  explanation: string | null
  hint: string | null
  metadata: Json
}

/**
 * The payload of a question, like `_question_payload` builds it.
 *
 * @param question the question row.
 */
function questionPayload(question: QuestionRow): Json {
  const metadata = question.metadata ?? {}
  return {
    id: question.id,
    question_id: question.id,
    skill_id: question.skill_id,
    grade_level: question.grade_level,
    difficulty: question.difficulty,
    question_text: question.question_text,
    question_text_th: question.question_text,
    choices: question.choices ?? [],
    hint: question.hint,
    skill_code: metadata.skill_code ?? '',
    topic_code: metadata.topic_code ?? '',
  }
}

/** Whether a question is a challenge question. */
function questionChallengeRole(question: QuestionRow): 'core' | 'challenge' {
  const metadata = question.metadata ?? {}
  const questionType = String(metadata.question_type ?? '').toLowerCase()
  const routineLevel = String(metadata.routine_level ?? '').toLowerCase()
  const confidenceRole = String(metadata.confidence_role ?? '').toLowerCase()
  if (
    questionType === 'challenge' ||
    routineLevel === 'non_routine' ||
    confidenceRole === 'stretch_thinking'
  ) {
    return 'challenge'
  }
  return 'core'
}

/** The core/challenge split of a question count. */
function ratioCounts(limit: number): { core: number; challenge: number } {
  if (limit < 5) {
    return { core: limit, challenge: 0 }
  }
  const challenge = Math.trunc(limit * 0.2 + 0.5)
  return { core: limit - challenge, challenge }
}

/**
 * Normalise an answer the way `normalize_answer` does.
 *
 * @param value the submitted answer.
 */
function normalizeAnswer(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value)
  text = text.normalize('NFKC')
  text = text.replace(/[๐-๙]/g, (digit) => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(digit)))
  text = text.replace(/[：％／–—−，、”“‘’ ]/g, (character) => {
    switch (character) {
      case '：':
        return ':'
      case '％':
        return '%'
      case '／':
        return '/'
      case '–':
      case '—':
      case '−':
        return '-'
      case '，':
      case '、':
        return ','
      case '“':
      case '”':
        return '"'
      case '‘':
      case '’':
        return "'"
      default:
        return ' '
    }
  })
  text = text.replace(/\s+/g, ' ').trim()
  text = text.replace(/\s*\/\s*/g, '/')
  text = text.replace(/\s*%\b/g, '%')
  text = text.replace(/(\d)\s+%/g, '$1%')
  return text
}

/**
 * The choice texts a raw answer may refer to.
 *
 * @param question the question row.
 * @param selectedAnswer the submitted answer.
 */
function choiceCandidates(question: QuestionRow, selectedAnswer: unknown): string[] {
  const raw = String(selectedAnswer ?? '').trim()
  const choices = question.choices ?? []
  if (!choices.length) {
    return []
  }
  const candidates: string[] = []
  if (/^\d+$/.test(raw)) {
    const index = Number(raw)
    for (const offset of [1, 0]) {
      const choiceIndex = index - offset
      if (choiceIndex >= 0 && choiceIndex < choices.length) {
        const choice = choices[choiceIndex]!
        candidates.push(String(choice))
        candidates.push(
          String(choice)
            .replace(/^\s*[A-Da-d1-9]\s*[:.)-]\s*/, '')
            .trim(),
        )
        break
      }
    }
  }
  if (raw.length === 1 && /[A-Z]/i.test(raw)) {
    const choiceIndex = raw.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0)
    if (choiceIndex >= 0 && choiceIndex < choices.length) {
      candidates.push(String(choices[choiceIndex]))
    }
  }
  return candidates.filter(Boolean)
}

/**
 * Compare a submitted answer with the correct one.
 *
 * @param question the question row.
 * @param selectedAnswer the submitted answer.
 */
function answerMatchDetails(
  question: QuestionRow,
  selectedAnswer: unknown,
): {
  is_correct: boolean
  selected_answer_raw: string
  selected_answer_normalized: string
  correct_answer_normalized: string
} {
  const selectedRaw =
    selectedAnswer === null || selectedAnswer === undefined ? '' : String(selectedAnswer)
  const metadata = question.metadata ?? {}
  const values: string[] = []
  const push = (value: unknown) => {
    if (value !== null && value !== undefined && String(value) !== '') {
      values.push(String(value))
    }
  }
  push(question.correct_answer)
  push(metadata.answer)
  const accepted = metadata.accepted_answers
  if (Array.isArray(accepted)) {
    accepted.forEach(push)
  } else if (typeof accepted === 'string' || typeof accepted === 'number') {
    push(accepted)
  }
  const selectedNormalized = normalizeAnswer(selectedRaw)
  const correctNormalized = normalizeAnswer(values[0] ?? question.correct_answer)
  let isCorrect = values.includes(selectedRaw)
  if (!isCorrect) {
    const normalizedValues = new Set(values.map((value) => normalizeAnswer(value)))
    const candidates = [
      selectedRaw,
      selectedNormalized,
      ...choiceCandidates(question, selectedRaw),
    ]
    isCorrect = candidates.some(
      (candidate) =>
        values.includes(candidate) || normalizedValues.has(normalizeAnswer(candidate)),
    )
  }
  return {
    is_correct: isCorrect,
    selected_answer_raw: selectedRaw,
    selected_answer_normalized: selectedNormalized,
    correct_answer_normalized: correctNormalized,
  }
}

/** Sum a list of numbers. */
function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

/**
 * The mastery score of a set of answers.
 *
 * @param results the answers of the child.
 */
function calculateMasteryScore(
  results: Array<{ isCorrect: boolean; responseTimeMs: number }>,
): number {
  if (!results.length) {
    return 0
  }
  const accuracy = (results.filter((result) => result.isCorrect).length / results.length) * 100
  const recent = results.slice(-5)
  const recentPerformance = (recent.filter((result) => result.isCorrect).length / recent.length) * 100
  const times = results.map((result) => result.responseTimeMs).filter((time) => time && time > 0)
  const speed = times.length
    ? Math.max(0, Math.min(100, 100 - ((sum(times) / times.length - 10000) / 10000) * 50))
    : 50
  const values: number[] = results.map((result) => (result.isCorrect ? 100 : 0))
  let consistency: number
  if (values.length < 2) {
    consistency = results.some((result) => result.isCorrect) ? 80 : 40
  } else {
    const mean = values.reduce((total, value) => total + value, 0) / values.length
    const variance =
      values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length
    consistency = Math.max(0, Math.min(100, 100 - Math.sqrt(variance)))
  }
  return roundLikePython(
    Math.max(
      0,
      Math.min(100, accuracy * 0.6 + recentPerformance * 0.2 + speed * 0.1 + consistency * 0.1),
    ),
    2,
  )
}

/** The mastery level of a score. */
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
 * The mistake type of a wrong answer.
 *
 * @param isCorrect whether the answer was right.
 * @param responseTimeMs how long the child took.
 */
function inferMistakeType(isCorrect: boolean, responseTimeMs: number): string | null {
  if (isCorrect && responseTimeMs >= 15000) {
    return 'speed_issue'
  }
  if (isCorrect) {
    return null
  }
  if (responseTimeMs && responseTimeMs < 1500) {
    return 'careless_mistake'
  }
  return 'calculation_error'
}

/* ─────────────────────────── database helpers ─────────────────────── */

/** Load the questions of a grade. */
async function loadGradeQuestions(sql: Sql, grade: number): Promise<QuestionRow[]> {
  const rows = (await sql.query(
    `SELECT id, skill_id, grade_level, question_type, difficulty, question_text,
            choices, correct_answer, explanation, hint, metadata
       FROM questions
      WHERE grade_level = $1 AND status = 'approved'
      ORDER BY id`,
    [grade],
  )) as QuestionRow[]
  return rows.map((row) => ({ ...row, metadata: (row.metadata as Json | null) ?? {} }))
}

/** Load the questions of a session, in the order the session stored them. */
async function loadSessionQuestions(sql: Sql, questionIds: string[]): Promise<QuestionRow[]> {
  if (!questionIds.length) {
    return []
  }
  const rows = (await sql.query(
    `SELECT id, skill_id, grade_level, question_type, difficulty, question_text,
            choices, correct_answer, explanation, hint, metadata
       FROM questions WHERE id = ANY($1::text[])`,
    [questionIds],
  )) as QuestionRow[]
  const byId = new Map(
    rows.map((row) => [row.id, { ...row, metadata: (row.metadata as Json | null) ?? {} }]),
  )
  return questionIds
    .map((id) => byId.get(id))
    .filter((row): row is QuestionRow => Boolean(row))
}

/** The rotation history of a question pool. */
async function loadRotationHistory(
  sql: Sql,
  childId: string,
  rotationKey: string,
  role: string,
): Promise<Array<{ question_id: string; cycle_number: number }>> {
  const rows = (await sql.query(
    `SELECT question_id, cycle_number FROM question_attempt_history
      WHERE child_id = $1 AND rotation_key = $2 AND question_type = $3
      ORDER BY first_seen_at, id`,
    [childId, rotationKey, role],
  )) as Array<{ question_id: string; cycle_number: number }>
  return rows
}

/**
 * Pick the questions of a session.
 *
 * The legacy service shuffles the pool and draws at random; the Worker keeps
 * the pool order, so the same request always returns the same questions.
 *
 * @param sql the database handle.
 * @param childId the id of the child.
 * @param pool the candidate questions.
 * @param limit how many questions the session holds.
 * @param rotationKey the rotation key of the pool.
 */
async function selectSessionQuestions(
  sql: Sql,
  childId: string,
  pool: QuestionRow[],
  limit: number,
  rotationKey: string,
): Promise<{ questions: QuestionRow[]; metadata: Json }> {
  const { core: coreTarget, challenge: challengeTarget } = ratioCounts(limit)
  const challengePool = pool.filter((question) => questionChallengeRole(question) === 'challenge')
  const corePool = pool.filter((question) => questionChallengeRole(question) === 'core')

  const takeFromPool = async (
    candidates: QuestionRow[],
    role: string,
    count: number,
  ): Promise<QuestionRow[]> => {
    if (count <= 0 || !candidates.length) {
      return []
    }
    const history = await loadRotationHistory(sql, childId, rotationKey, role)
    let cycleNumber = 1
    for (const entry of history) {
      cycleNumber = Math.max(cycleNumber, Number(entry.cycle_number) || 1)
    }
    const seen = new Set(
      history
        .filter((entry) => (Number(entry.cycle_number) || 1) === cycleNumber)
        .map((entry) => entry.question_id),
    )
    const unseen = candidates.filter((question) => !seen.has(question.id))
    const seenAgain = candidates.filter((question) => seen.has(question.id))
    return [...unseen, ...seenAgain].slice(0, count)
  }

  const challengeSelected = await takeFromPool(challengePool, 'challenge', challengeTarget)
  const coreNeeded = coreTarget + Math.max(0, challengeTarget - challengeSelected.length)
  const coreSelected = await takeFromPool(corePool, 'core', coreNeeded)

  const selected = [...challengeSelected, ...coreSelected]
  if (selected.length < limit) {
    const chosen = new Set(selected.map((question) => question.id))
    for (const question of [...challengePool, ...corePool]) {
      if (selected.length >= limit) {
        break
      }
      if (!chosen.has(question.id)) {
        selected.push(question)
        chosen.add(question.id)
      }
    }
  }

  const coreCount = selected.filter((question) => questionChallengeRole(question) === 'core').length
  const challengeCount = selected.length - coreCount
  return {
    questions: selected.slice(0, limit),
    metadata: {
      core_question_count: coreCount,
      challenge_question_count: challengeCount,
      ratio_policy: RATIO_POLICY,
      rotation_scope: rotationKey.startsWith('lesson:')
        ? 'lesson'
        : rotationKey.startsWith('foundation:')
          ? 'foundation'
          : 'review',
      rotation_key: rotationKey,
      rotation_cycle: 1,
    },
  }
}

/* ─────────────────────────── the test session ───────────────────────── */

/** A test session row. */
interface TestSessionRow {
  id: string
  child_profile_id: string
  lesson_id: string | null
  quiz_id: string | null
  question_ids: string[]
  timer_seconds: number
  status: string
  metadata: Json
}

/** Load a test session of the child. */
async function loadTestSession(
  sql: Sql,
  sessionId: string,
  childId: string,
): Promise<TestSessionRow | null> {
  const rows = (await sql.query(
    `SELECT id, child_profile_id, lesson_id, quiz_id, question_ids, timer_seconds, status, metadata
       FROM test_sessions WHERE id = $1 LIMIT 1`,
    [sessionId],
  )) as TestSessionRow[]
  const row = rows[0]
  if (!row || row.child_profile_id !== childId) {
    return null
  }
  return {
    ...row,
    lesson_id: row.lesson_id ?? null,
    quiz_id: row.quiz_id ?? null,
    question_ids: (row.question_ids as string[] | null) ?? [],
    timer_seconds: Number(row.timer_seconds ?? 300),
    status: String(row.status ?? 'in_progress'),
    metadata: (row.metadata as Json | null) ?? {},
  }
}

/* ─────────────────────────── progress helpers ────────────────────────── */

/** The period key of a quest recurrence, as `period_key` computes it. */
function questPeriodKey(recurrenceType: string, now: Date): string {
  const bangkok = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  const year = bangkok.getUTCFullYear()
  const month = String(bangkok.getUTCMonth() + 1).padStart(2, '0')
  const day = String(bangkok.getUTCDate()).padStart(2, '0')
  if (recurrenceType === 'weekly') {
    const target = new Date(
      Date.UTC(year, bangkok.getUTCMonth(), bangkok.getUTCDate()),
    )
    const isoWeekday = target.getUTCDay() === 0 ? 7 : target.getUTCDay()
    target.setUTCDate(target.getUTCDate() + 4 - isoWeekday)
    const week = Math.ceil(
      ((target.getTime() - Date.UTC(target.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7,
    )
    return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
  }
  if (recurrenceType === 'monthly') {
    return `${year}-${month}`
  }
  return `${year}-${month}-${day}`
}

/**
 * Apply the progress of a quest action to the child.
 *
 * @param sql the database handle.
 * @param child the child profile.
 * @param actionType the action the quest counts.
 */
async function applyQuestProgress(
  sql: Sql,
  child: LearningChild,
  actionType: string,
): Promise<void> {
  const quests = (await sql.query(
    `SELECT id, quest_id, recurrence_type, xp_reward, coin_reward, title, metadata
       FROM learning_quests
      WHERE grade_level = $1 AND status = 'active'`,
    [child.grade_level],
  )) as Array<{
    id: string
    quest_id: string
    recurrence_type: string
    xp_reward: number
    coin_reward: number
    title: string
    metadata: Json | null
  }>
  for (const quest of quests) {
    const metadata = quest.metadata ?? {}
    if (metadata.fixed) {
      continue
    }
    const action = String(metadata.action_type ?? quest.quest_id)
    if (action !== actionType) {
      continue
    }
    const target = Number(metadata.target_count ?? 1)
    const recurrenceType = String(quest.recurrence_type ?? 'none')
    const periodKey = recurrenceType === 'none' ? null : questPeriodKey(recurrenceType, new Date())
    const existing = (await sql.query(
      `SELECT id, progress_current FROM child_quests
        WHERE child_profile_id = $1 AND quest_id = $2
          AND ($3::text IS NULL OR period_key = $3)
        LIMIT 1`,
      [child.id, quest.id, periodKey],
    )) as Array<{ id: string; progress_current: number }>
    const questId = String(quest.id)
    let childQuestId = existing[0]?.id ? String(existing[0].id) : ''
    const progress = Number(existing[0]?.progress_current ?? 0)
    if (!childQuestId) {
      childQuestId = crypto.randomUUID()
      await sql.query(
        `INSERT INTO child_quests (id, child_profile_id, quest_id, recurrence_type, period_key,
             status, progress_current, progress_target, started_at, completed_at,
             xp_awarded, coin_awarded, score_awarded, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'in_progress', 0, $6, now(), NULL, 0, 0, 0, now(), now())`,
        [childQuestId, child.id, questId, recurrenceType, periodKey, target],
      )
    }
    const nextProgress = Math.min(target, progress + 1)
    if (nextProgress >= target) {
      const xpReward = Number(quest.xp_reward ?? 0)
      const coinReward = Number(quest.coin_reward ?? 0)
      const scoreReward = Number(metadata.score_reward ?? xpReward)
      await sql.query(
        `UPDATE child_quests
            SET status = 'completed', completed_at = now(), progress_current = $2,
                xp_awarded = $3, coin_awarded = $4, score_awarded = $5, updated_at = now()
          WHERE id = $1`,
        [childQuestId, nextProgress, xpReward, coinReward, scoreReward],
      )
      await sql.query(
        `UPDATE student_stats SET quests_completed = quests_completed + 1, updated_at = now()
          WHERE child_profile_id = $1`,
        [child.id],
      )
      await awardProgress(
        sql,
        child,
        'quest_complete',
        String(quest.quest_id),
        xpReward,
        scoreReward,
        coinReward,
        String(quest.title ?? ''),
      )
    } else {
      await sql.query(
        `UPDATE child_quests SET progress_current = $2, updated_at = now() WHERE id = $1`,
        [childQuestId, nextProgress],
      )
    }
  }
}

/**
 * Award XP, score and coins to the child.
 *
 * @param sql the database handle.
 * @param child the child profile.
 * @param sourceType the kind of the award.
 * @param sourceId the id of the source.
 * @param xp the awarded XP.
 * @param score the awarded score.
 * @param coins the awarded coins.
 * @param description the description of the award.
 */
async function awardProgress(
  sql: Sql,
  child: LearningChild,
  sourceType: string,
  sourceId: string | null,
  xp: number,
  score: number,
  coins: number,
  description: string,
): Promise<void> {
  const totalXp = (child.total_xp ?? 0) + xp
  const totalScore = (child.total_score ?? 0) + score
  const totalCoins = (child.coins ?? 0) + coins
  const level = levelFromTotalXp(totalXp)
  const rankTitle = rankTitleForScore(totalScore)
  await sql.query(
    `INSERT INTO xp_events (id, child_profile_id, source_type, source_id, xp_amount, description, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())`,
    [crypto.randomUUID(), child.id, sourceType, sourceId, xp, description],
  )
  await sql.query(
    `UPDATE child_profiles
        SET total_xp = $2, total_score = $3, coins = $4, current_level = $5,
            current_rank_title = $6, updated_at = now()
      WHERE id = $1`,
    [child.id, totalXp, totalScore, totalCoins, level, rankTitle],
  )
  child.total_xp = totalXp
  child.total_score = totalScore
  child.coins = totalCoins
  child.current_level = level
  child.current_rank_title = rankTitle
}

/* ──────────────────────────── programme access ───────────────────────── */

/** The programme payload of a request. */
/**
 * The programme metadata of a request.
 *
 * Exported for the dashboard, which reports the same fields.
 */
export function programPayload(
  role: string,
  child: PlanAccessChild,
  program: 'TH' | 'EP',
  now: Date,
): Json {
  const canAccessEp = role.toLowerCase() === 'admin' || isEpPlus(child, now)
  return {
    active_program: program,
    can_access_ep: canAccessEp,
    available_programs: canAccessEp ? ['TH', 'EP'] : ['TH'],
  }
}

/** Reject a request for the EP programme the child may not use. */
export function requireProgramAccess(
  role: string,
  child: PlanAccessChild,
  program: 'TH' | 'EP',
  now: Date,
): void {
  if (program === 'EP' && !(role.toLowerCase() === 'admin' || isEpPlus(child, now))) {
    throw forbidden({
      code: 'EP_PACKAGE_LOCKED',
      message: 'แพ็กเกจ EP ยังไม่ได้เปิดใช้งาน',
      ...programPayload(role, child, 'TH', now),
    })
  }
}

/** Resolve the programme a request asks for. */
function requestedProgram(raw: string | undefined): 'TH' | 'EP' {
  if (raw === undefined || raw.trim() === '') {
    return 'TH'
  }
  const upper = raw.trim().toUpperCase()
  if (upper !== 'TH' && upper !== 'THP' && upper !== 'EP') {
    throw badRequest('program_type must be TH or EP')
  }
  return programAlias(upper)
}

/* ─────────────────────────── lesson lookup ──────────────────────────── */

/** A lesson of the snapshot, together with its grade and topic. */
interface FoundLesson {
  grade: number
  row: SnapshotLessonRow
  topic: SnapshotTopic
}

/**
 * Find a lesson of the snapshot.
 *
 * @param program the programme to search in.
 * @param lessonId the public id of the lesson.
 */
function findLesson(program: 'TH' | 'EP', lessonId: string): FoundLesson | null {
  for (const grade of snapshotGradeNumbers(program)) {
    const rows = snapshotCatalog(program, grade)
    const row = rows.find(
      (entry) => entry.lesson_id === lessonId || entry.lesson_group_id === lessonId,
    )
    if (!row) {
      continue
    }
    const topic = snapshotTopics(program, grade)[row.topic_folder ?? '']
    if (topic) {
      return { grade, row, topic }
    }
  }
  return null
}

/** The approved lesson variants of a topic. */
function approvedLessonVariants(topic: SnapshotTopic): SnapshotLessonVariant[] {
  return topic.lesson_variants.filter((variant) => variant.status === 'approved')
}

/* ────────────────────────── question banks ──────────────────────────── */

/**
 * The quiz bank of one quiz variant, as the legacy service materialises it.
 *
 * The legacy service rotates through the approved quiz variants and uses the
 * questions of a single variant per test; the Worker keeps the first variant
 * of the rotation, so a test always draws the same questions.
 *
 * @param quizVariant the selected quiz variant.
 * @param program the programme of the child.
 */
function quizBankOf(quizVariant: SnapshotQuizVariant, program: 'TH' | 'EP'): Json[] {
  const rows: Json[] = []
  for (const question of quizVariant.questions) {
    const questionId = String(question.question_id ?? question.id ?? '')
    if (!questionId) {
      continue
    }
    const choices = Array.isArray(question.choices)
      ? question.choices.map((choice) => String(choice))
      : []
    const questionText = String(
      program === 'EP'
        ? question.question_text_en ??
          question.question_en ??
          question.question ??
          question.question_text
        : question.question_text_th ??
          question.question_th ??
          question.question ??
          question.question_text,
    ).trim()
    const correctAnswer = String(question.correct_answer ?? question.answer ?? '').trim()
    if (!questionText || choices.length < 2 || !correctAnswer) {
      continue
    }
    rows.push({
      question_id: questionId,
      question_text: questionText,
      choices,
      correct_answer: correctAnswer,
      explanation: question.explanation ?? question.explanation_th ?? null,
      hint: question.hint ?? question.hint_th ?? null,
      difficulty: String(question.difficulty ?? 'medium'),
      metadata: {
        question_id: questionId,
        quiz_variant_id: quizVariant.quiz_variant_id,
        source_path_hash: quizVariant.source_path_hash,
        source_filename: quizVariant.source_filename,
        question_type: question.question_type ?? 'core',
        routine_level: question.routine_level ?? 'routine',
        confidence_role: question.confidence_role ?? 'build_confidence',
      },
    })
  }
  return rows
}

/**
 * Make sure the skill of a lesson exists, and return its id.
 *
 * @param sql the database handle.
 * @param row the catalogue row of the lesson.
 * @param grade the grade of the lesson.
 */
async function ensureSkill(sql: Sql, row: SnapshotLessonRow, grade: number): Promise<string> {
  const existing = (await sql.query(
    `SELECT id FROM skills WHERE code = $1 AND grade_level = $2 LIMIT 1`,
    [row.skill_code, grade],
  )) as Array<{ id: string }>
  if (existing[0]?.id) {
    return String(existing[0].id)
  }
  const subject = (await sql.query(
    `SELECT id FROM subjects WHERE code = 'math' LIMIT 1`,
  )) as Array<{ id: string }>
  let subjectId = String(subject[0]?.id ?? '')
  if (!subjectId) {
    subjectId = crypto.randomUUID()
    await sql.query(`INSERT INTO subjects (id, code, name) VALUES ($1, 'math', 'คณิตศาสตร์')`, [
      subjectId,
    ])
  }
  const skillId = crypto.randomUUID()
  await sql.query(
    `INSERT INTO skills (id, subject_id, grade_level, code, name, prerequisite_skill_ids, difficulty_order, created_at)
     VALUES ($1, $2, $3, $4, $5, '[]'::jsonb, $6, now())`,
    [skillId, subjectId, grade, row.skill_code, row.title_th, grade * 100],
  )
  return skillId
}

/**
 * Store the questions of a lesson bank in the questions table.
 *
 * @param sql the database handle.
 * @param rows the questions of the bank.
 * @param skillId the id of the skill the questions belong to.
 * @param grade the grade of the questions.
 * @param topicCode the topic code of the lesson.
 */
async function storeQuizBank(
  sql: Sql,
  rows: Json[],
  skillId: string,
  grade: number,
  topicCode: string,
): Promise<void> {
  for (const row of rows) {
    const metadata = (row.metadata as Json) ?? {}
    await sql.query(
      `INSERT INTO questions (id, skill_id, grade_level, question_type, difficulty, question_text,
           choices, correct_answer, explanation, hint, source, status, metadata, created_at)
       VALUES ($1, $2, $3, 'multiple_choice', $4, $5, $6::jsonb, $7, $8, $9, 'content', 'approved', $10::jsonb, now())
       ON CONFLICT (id) DO UPDATE
          SET skill_id = $2, grade_level = $3, difficulty = $4, question_text = $5,
              choices = $6::jsonb, correct_answer = $7, explanation = $8, hint = $9,
              status = 'approved', source = 'content', metadata = $10::jsonb`,
      [
        row.question_id,
        skillId,
        grade,
        row.difficulty,
        row.question_text,
        JSON.stringify(row.choices),
        row.correct_answer,
        row.explanation,
        row.hint,
        JSON.stringify({ ...metadata, topic_code: topicCode }),
      ],
    )
  }
}

/* ─────────────────────────── the endpoints ──────────────────────────── */

/** The `/me` learning routes. */
export const meLearningRoutes = new Hono<AppEnv>()

/** `GET /me/lessons` — the lesson catalogue of the child. */
meLearningRoutes.get('/lessons', requireAuth(), async (c) => {
  const user = await requireActiveUser(c)
  const sql = c.get('sql')
  const now = new Date()
  const child = await loadLearningChild(sql, user.id)
  const program = requestedProgram(c.req.query('program_type'))
  requireProgramAccess(user.role, child, program, now)

  const gradeParam =
    c.req.query('grade_level') ??
    c.req.query('grade') ??
    c.req.query('level') ??
    c.req.query('class_level')
  let requestedGrade: number | null = null
  if (gradeParam !== undefined && gradeParam !== '') {
    const grade = Number(gradeParam)
    if (!Number.isInteger(grade) || grade < 1 || grade > 6) {
      throw badRequest('grade must be between 1 and 6')
    }
    requestedGrade = grade
  }

  const includeGrades = new Set<number>()
  if (requestedGrade !== null) {
    includeGrades.add(requestedGrade)
  } else {
    for (const grade of snapshotGradeNumbers(program)) {
      includeGrades.add(grade)
    }
  }
  const sectionGrades = new Set<number>(includeGrades)
  sectionGrades.add(child.grade_level)
  sectionGrades.add(Math.max(1, child.grade_level - 1))

  const sections = filterSectionsByGrade(
    buildLessonSections(program, child.grade_level, sectionGrades),
    requestedGrade,
  )
  const previousGrade = Math.max(1, child.grade_level - 1)
  const reviewRows =
    requestedGrade === null
      ? sections.review_lessons.filter((item) => Number(item.grade_level) === previousGrade)
      : sections.review_lessons
  const primaryRows = sections.current_grade_lessons
  const remaining = isPaid(child, now) ? 999999 : remainingFreeTests(child)

  return jsonBody(c, {
    ...programPayload(user.role, child, program, now),
    current_grade: child.grade_level,
    requested_grade: requestedGrade,
    program_type: program,
    membership_status: child.membership_status || 'free',
    remaining_free_tests: remaining,
    current_grade_lessons: primaryRows,
    review_lessons: reviewRows,
    locked_lessons: sections.locked_lessons,
    future_lessons: sections.future_lessons,
    lessons: sections.all_lessons.length ? sections.all_lessons : [...reviewRows, ...primaryRows],
    content_diagnostics:
      requestedGrade === null ? null : buildContentDiagnostics(program, requestedGrade),
  })
})

/** `GET /me/lessons/:lessonId` — the content of one lesson. */
meLearningRoutes.get('/lessons/:lessonId', requireAuth(), async (c) => {
  const user = await requireActiveUser(c)
  const sql = c.get('sql')
  const now = new Date()
  const child = await loadLearningChild(sql, user.id)
  const program = requestedProgram(c.req.query('program_type'))
  requireProgramAccess(user.role, child, program, now)

  const lessonId = c.req.param('lessonId')
  const found = findLesson(program, lessonId)
  if (!found) {
    throw notFound('Lesson not found')
  }
  const variants = approvedLessonVariants(found.topic)
  if (!variants.length) {
    throw notFound('Lesson not found')
  }
  const variantIds = variants.map(
    (variant) => String(variant.payload.selected_variant_id ?? variant.variant_id),
  )
  const scopedLessonId = `${program}:${found.topic.lesson_group_id}`
  const viewRows = (await sql.query(
    `SELECT variant_id, cycle_number FROM lesson_variant_views
      WHERE child_id = $1 AND lesson_id = $2 ORDER BY viewed_at, id`,
    [child.id, scopedLessonId],
  )) as VariantView[]
  const selected = selectVariant(
    variantIds,
    viewRows.map((row) => ({
      variant_id: String(row.variant_id),
      cycle_number: Number(row.cycle_number),
    })),
  )
  const variant = variants.find(
    (entry) =>
      String(entry.payload.selected_variant_id ?? entry.variant_id) === selected.variantId,
  )
  if (!variant) {
    throw notFound('Lesson not found')
  }
  const payload: Json = { ...variant.payload, selected_variant_id: selected.variantId }

  const item = renderLessonItem(payload, child.grade_level, found.grade === child.grade_level ? 0 : null)
  const detailItem: Json = { ...item, is_locked: false, lock_reason: null, status: 'available' }
  const response = buildLessonContentPayload(payload, detailItem, null)
  response.program_type = program

  await sql.query(
    `INSERT INTO lesson_variant_views (id, child_id, lesson_id, variant_id, cycle_number, viewed_at)
     VALUES ($1, $2, $3, $4, $5, now())`,
    [crypto.randomUUID(), child.id, scopedLessonId, selected.variantId, selected.cycleNumber],
  )

  return jsonBody(c, response)
})

/** The lessons of the database, shaped like `LessonOut`. */
async function loadDatabaseLessons(
  sql: Sql,
  child: LearningChild,
  now: Date,
): Promise<Json[]> {
  const paid = isPaid(child, now)
  const track = (child.program_type ?? 'THP').toUpperCase() === 'EP' ? 'EP' : 'TH'
  const rows = (await sql.query(
    `SELECT l.id, l.title, l.content, s.grade_level, s.code AS skill_code
       FROM lessons l JOIN skills s ON s.id = l.skill_id
      WHERE l.status = 'approved'`,
  )) as Array<{
    id: string
    title: string
    content: Json | null
    grade_level: number
    skill_code: string
  }>
  const lessons: Json[] = []
  for (const row of rows) {
    const content = row.content ?? {}
    const gradeLevel = Number(row.grade_level ?? 0)
    if (!BETA_READY_GRADES.has(gradeLevel)) {
      continue
    }
    if (lessonProgramAlias(content) !== track) {
      continue
    }
    if (!hasDisplayableContent(content)) {
      continue
    }
    const isReview = gradeLevel < child.grade_level
    const isCurrent = gradeLevel === child.grade_level
    if (!isReview && !isCurrent) {
      continue
    }
    const isLocked = !paid && !isReview
    lessons.push({
      id: String(row.id),
      title: String(row.title ?? ''),
      grade_level: gradeLevel,
      skill_code: String(row.skill_code ?? ''),
      is_review: isReview,
      is_locked: isLocked,
      access_type: isReview ? 'review' : 'current',
      content_preview: content.summary ?? content.intro ?? null,
      linked_quiz_id: content.quiz_id ?? null,
    })
  }
  return lessons
}

/** Whether a lesson payload carries displayable content. */
function hasDisplayableContent(content: Json): boolean {
  const gradeLevel = Number(content.grade_level ?? 0)
  if (!BETA_READY_GRADES.has(gradeLevel)) {
    return false
  }
  const variants: Json[] = []
  const storyVariants = content.story_variants
  if (Array.isArray(storyVariants)) {
    variants.push(...(storyVariants as Json[]))
  }
  const lessonVariants = content.lesson_variants
  if (Array.isArray(lessonVariants)) {
    variants.push(...(lessonVariants as Json[]))
  }
  if (!variants.length) {
    variants.push(content)
  }
  return variants.some((variant) => {
    const blocks = variant.visual_blocks
    return Array.isArray(blocks) && blocks.length > 0
  })
}

/** `GET /me/review-lessons` — the lessons of the grades below the child. */
meLearningRoutes.get('/review-lessons', requireAuth(), async (c) => {
  const user = await requireActiveUser(c)
  const sql = c.get('sql')
  const now = new Date()
  const child = await loadLearningChild(sql, user.id)
  const lessons = await loadDatabaseLessons(sql, child, now)
  return jsonBody(c, lessons.filter((lesson) => lesson.is_review === true))
})

/** `GET /me/recommended-lessons` — the unlocked lessons to work on next. */
meLearningRoutes.get('/recommended-lessons', requireAuth(), async (c) => {
  const user = await requireActiveUser(c)
  const sql = c.get('sql')
  const now = new Date()
  const child = await loadLearningChild(sql, user.id)
  const lessons = await loadDatabaseLessons(sql, child, now)
  return jsonBody(c, lessons.filter((lesson) => lesson.is_locked !== true).slice(0, 3))
})

/** `GET /me/test-levels` — the test ladder of the child. */
meLearningRoutes.get('/test-levels', requireAuth(), async (c) => {
  const user = await requireActiveUser(c)
  const now = new Date()
  const child = await loadLearningChild(c.get('sql'), user.id)
  const recommended = recommendedFoundationGrade(child.grade_level)
  const paid = isPaid(child, now)
  const noFreeTests = !paid && remainingFreeTests(child) <= 0
  const levels: Json[] = []
  for (let grade = 1; grade <= 6; grade += 1) {
    const locked = !paid && (grade !== recommended || noFreeTests)
    levels.push({
      grade,
      grade_level: grade,
      title_th: `แบบทดสอบ ป.${grade}`,
      title: `คณิตศาสตร์ ป.${grade}`,
      status: locked ? 'locked' : 'unlocked',
      is_locked: locked,
      lock_reason: locked
        ? noFreeTests
          ? 'ใช้สิทธิ์เทสฟรีครบแล้ว กรุณาอัปเกรดเพื่อทำเทสเพิ่มเติม'
          : 'สมาชิกฟรีทำได้เฉพาะเทสที่ระบบแนะนำ'
        : null,
      questions_count: 10,
      estimated_minutes: 15,
    })
  }
  return jsonBody(c, levels)
})

/** `POST /me/lessons/:lessonId/start` — the student starts a lesson. */
meLearningRoutes.post('/lessons/:lessonId/start', requireAuth(), async (c) => {
  const user = await requireActiveUser(c)
  const sql = c.get('sql')
  const now = new Date()
  const child = await loadLearningChild(sql, user.id)
  const program = requestedProgram(c.req.query('program_type'))
  requireProgramAccess(user.role, child, program, now)

  const lessonId = c.req.param('lessonId')
  const found = findLesson(program, lessonId)
  if (!found) {
    throw notFound('Lesson not found')
  }
  const variants = approvedLessonVariants(found.topic)
  if (!variants.length) {
    throw notFound('Lesson not found')
  }
  const variantIds = variants.map(
    (variant) => String(variant.payload.selected_variant_id ?? variant.variant_id),
  )
  const scopedLessonId = `${program}:${found.topic.lesson_group_id}`
  const viewRows = (await sql.query(
    `SELECT variant_id, cycle_number FROM lesson_variant_views
      WHERE child_id = $1 AND lesson_id = $2 ORDER BY viewed_at, id`,
    [child.id, scopedLessonId],
  )) as VariantView[]
  const selected = selectVariant(
    variantIds,
    viewRows.map((row) => ({
      variant_id: String(row.variant_id),
      cycle_number: Number(row.cycle_number),
    })),
  )
  const variant = variants.find(
    (entry) =>
      String(entry.payload.selected_variant_id ?? entry.variant_id) === selected.variantId,
  )
  if (!variant) {
    throw notFound('Lesson not found')
  }
  const payload: Json = { ...variant.payload, selected_variant_id: selected.variantId }

  const item = renderLessonItem(payload, child.grade_level, found.grade === child.grade_level ? 0 : null)
  if (item.is_locked) {
    throw forbidden('Lesson is locked')
  }

  const periodDay = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  const activity = (await sql.query(
    `SELECT id FROM lesson_activity
      WHERE child_profile_id = $1 AND lesson_id = $2 AND period_day = $3 LIMIT 1`,
    [child.id, found.row.lesson_id, periodDay],
  )) as Array<{ id: string }>
  if (!activity.length) {
    await sql.query(
      `INSERT INTO lesson_activity (id, child_profile_id, lesson_id, activity_type, period_day, created_at)
       VALUES ($1, $2, $3, 'started', $4, now())`,
      [crypto.randomUUID(), child.id, found.row.lesson_id, periodDay],
    )
  }
  await applyQuestProgress(sql, child, 'lesson_start')
  await sql.query(
    `INSERT INTO lesson_variant_views (id, child_id, lesson_id, variant_id, cycle_number, viewed_at)
     VALUES ($1, $2, $3, $4, $5, now())`,
    [crypto.randomUUID(), child.id, scopedLessonId, selected.variantId, selected.cycleNumber],
  )

  const content: Json = {
    ...payload,
    content_id: found.row.lesson_id,
    lesson_id: found.row.lesson_id,
    grade_level: found.grade,
    skill_code: found.row.skill_code,
    topic_code: found.row.topic_code,
    variant_cycle_number: selected.cycleNumber,
  }
  return jsonBody(c, { lesson: item, content })
})

/** `POST /me/lessons/:lessonId/test/start` — the student starts a lesson test. */
meLearningRoutes.post('/lessons/:lessonId/test/start', requireAuth(), async (c) => {
  const user = await requireActiveUser(c)
  const sql = c.get('sql')
  const now = new Date()
  const child = await loadLearningChild(sql, user.id)
  const program = requestedProgram(c.req.query('program_type'))
  requireProgramAccess(user.role, child, program, now)

  const paid = isPaid(child, now)
  if (!paid && remainingFreeTests(child) <= 0) {
    throw forbidden({
      code: 'PLAN_REQUIRED',
      message: 'บทเรียน/แบบทดสอบนี้ต้องอัปเกรด Plus',
      remaining_free_tests: 0,
    })
  }

  const lessonId = c.req.param('lessonId')
  const found = findLesson(program, lessonId)
  if (!found) {
    throw forbidden({
      code: 'INVALID_LESSON_ID',
      message: 'Lesson not found',
      lesson_id: lessonId,
    })
  }
  if (!found.row.has_approved_test) {
    throw forbidden({
      code: 'NO_QUESTIONS_FOR_LESSON',
      message: 'ยังไม่มีแบบทดสอบสำหรับบทเรียนนี้',
      lesson_id: lessonId,
    })
  }
  // The legacy service rotates through the approved quiz variants; it keeps
  // the first one that was not seen in the current cycle.
  const quizVariants = found.topic.quiz_variants.filter(
    (variant) => variant.status === 'approved',
  )
  if (!quizVariants.length) {
    throw forbidden({
      code: 'NO_QUESTIONS_FOR_LESSON',
      message: 'ยังไม่มีแบบทดสอบสำหรับบทเรียนนี้',
      lesson_id: lessonId,
    })
  }
  const quizVariant = quizVariants[0]!
  const bank = quizBankOf(quizVariant, program)
  if (bank.length < 5) {
    throw forbidden({
      code: 'NO_QUESTIONS_FOR_LESSON',
      message: 'Approved test bank has too few questions',
      lesson_id: found.row.lesson_id,
    })
  }

  const skillId = await ensureSkill(sql, found.row, found.grade)
  await storeQuizBank(sql, bank, skillId, found.grade, found.row.topic_code)

  const pool = await loadGradeQuestions(sql, found.grade)
  const scoped = pool.filter((question) => bank.some((row) => row.question_id === question.id))
  const rotationKey = `lesson:${found.row.lesson_id}`
  const selection = await selectSessionQuestions(
    sql,
    child.id,
    scoped.length ? scoped : pool,
    10,
    rotationKey,
  )

  const sessionId = crypto.randomUUID()
  const metadata: Json = {
    ...selection.metadata,
    program_type: program,
    lesson_public_id: found.row.lesson_id,
    grade_level: found.grade,
    lesson_group_id: found.row.lesson_id,
    topic_folder: found.topic.topic_folder,
    quiz_variant_id: quizVariant.quiz_variant_id,
    quiz_variant_cycle: 1,
    source_path_hash: quizVariant.source_path_hash,
    source_filename: quizVariant.source_filename,
  }
  await sql.query(
    `INSERT INTO test_sessions (id, child_profile_id, lesson_id, quiz_id, question_ids, started_at,
         completed_at, timer_seconds, status, metadata, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, now(), NULL, 900, 'in_progress', $6::jsonb, now(), now())`,
    [
      sessionId,
      child.id,
      found.row.lesson_id,
      found.row.lesson_id,
      JSON.stringify(selection.questions.map((question) => question.id)),
      JSON.stringify(metadata),
    ],
  )

  return jsonBody(c, {
    session_id: sessionId,
    test_session_id: sessionId,
    grade_level: found.grade,
    mode: 'lesson',
    session_type: 'quiz',
    title_th: `แบบทดสอบ: ${found.row.title_th}`,
    time_limit_seconds: 900,
    timer_seconds: 900,
    core_question_count: Number(metadata.core_question_count ?? 0),
    challenge_question_count: Number(metadata.challenge_question_count ?? 0),
    ratio_policy: String(metadata.ratio_policy ?? RATIO_POLICY),
    rotation_cycle: Number(metadata.rotation_cycle ?? 1),
    questions: selection.questions.map((question) => questionPayload(question)),
  })
})

/** `POST /me/tests/start` — the child starts a foundation test. */
meLearningRoutes.post('/tests/start', requireAuth(), async (c) => {
  const user = await requireActiveUser(c)
  const sql = c.get('sql')
  const now = new Date()
  const child = await loadLearningChild(sql, user.id)

  const body = (await c.req.json().catch(() => ({}))) as Json
  const gradeLevel = Number(body.grade_level)
  if (!Number.isInteger(gradeLevel) || gradeLevel < 1 || gradeLevel > 6) {
    throw badRequest('grade_level must be between 1 and 6')
  }
  const mode = typeof body.mode === 'string' ? body.mode : 'foundation'
  const sessionType = typeof body.session_type === 'string' ? body.session_type : mode

  const paid = isPaid(child, now)
  if (!paid) {
    if (gradeLevel !== recommendedFoundationGrade(child.grade_level)) {
      throw forbidden('สมาชิกฟรีทำได้เฉพาะเทสที่ระบบแนะนำ')
    }
    if (remainingFreeTests(child) <= 0) {
      throw forbidden('ใช้สิทธิ์เทสฟรีครบแล้ว กรุณาอัปเกรดเพื่อทำเทสเพิ่มเติม')
    }
  }

  const pool = await loadGradeQuestions(sql, gradeLevel)
  const rotationKey = `foundation:g${gradeLevel}`
  const selection = await selectSessionQuestions(sql, child.id, pool, 10, rotationKey)
  if (!selection.questions.length) {
    throw notFound('No questions available')
  }

  const sessionId = crypto.randomUUID()
  await sql.query(
    `INSERT INTO test_sessions (id, child_profile_id, lesson_id, quiz_id, question_ids, started_at,
         completed_at, timer_seconds, status, metadata, created_at, updated_at)
     VALUES ($1, $2, NULL, $3, $4::jsonb, now(), NULL, 900, 'in_progress', $5::jsonb, now(), now())`,
    [
      sessionId,
      child.id,
      `${mode}-g${gradeLevel}`,
      JSON.stringify(selection.questions.map((question) => question.id)),
      JSON.stringify(selection.metadata),
    ],
  )

  return jsonBody(c, {
    session_id: sessionId,
    test_session_id: sessionId,
    grade_level: gradeLevel,
    mode,
    session_type: sessionType,
    title_th: `เทสพื้นฐาน ป.${gradeLevel}`,
    time_limit_seconds: 900,
    timer_seconds: 900,
    core_question_count: Number(selection.metadata.core_question_count ?? 0),
    challenge_question_count: Number(selection.metadata.challenge_question_count ?? 0),
    ratio_policy: String(selection.metadata.ratio_policy ?? RATIO_POLICY),
    rotation_cycle: Number(selection.metadata.rotation_cycle ?? 1),
    questions: selection.questions.map((question) => questionPayload(question)),
  })
})

/** `POST /me/tests/:testId/start` — the legacy review test entry point. */
meLearningRoutes.post('/tests/:testId/start', requireAuth(), async (c) => {
  const user = await requireActiveUser(c)
  const sql = c.get('sql')
  const child = await loadLearningChild(sql, user.id)

  const testId = c.req.param('testId')
  const program = (child.program_type ?? 'THP').toUpperCase() === 'EP' ? 'EP' : 'TH'
  const found = findLesson(program, testId)
  const gradeLevel = found ? found.grade : child.grade_level
  const pool = await loadGradeQuestions(sql, gradeLevel)
  const selection = await selectSessionQuestions(sql, child.id, pool, 5, `review:${testId}`)
  if (!selection.questions.length) {
    throw notFound('No questions available')
  }

  const sessionId = crypto.randomUUID()
  const lessonId = found?.row.lesson_id ?? null
  await sql.query(
    `INSERT INTO test_sessions (id, child_profile_id, lesson_id, quiz_id, question_ids, started_at,
         completed_at, timer_seconds, status, metadata, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, now(), NULL, 300, 'in_progress', $6::jsonb, now(), now())`,
    [
      sessionId,
      child.id,
      lessonId,
      found?.row.lesson_id ?? testId,
      JSON.stringify(selection.questions.map((question) => question.id)),
      JSON.stringify(selection.metadata),
    ],
  )

  return jsonBody(c, {
    test_session_id: sessionId,
    lesson_id: lessonId,
    quiz_id: found?.row.lesson_id ?? testId,
    timer_seconds: 300,
    core_question_count: Number(selection.metadata.core_question_count ?? 0),
    challenge_question_count: Number(selection.metadata.challenge_question_count ?? 0),
    ratio_policy: String(selection.metadata.ratio_policy ?? RATIO_POLICY),
    rotation_cycle: Number(selection.metadata.rotation_cycle ?? 1),
    questions: selection.questions.map((question) => ({
      id: question.id,
      question_text: question.question_text,
      choices: question.choices ?? [],
    })),
  })
})

/** `GET /me/tests/:testId/questions` — the questions of a running test. */
meLearningRoutes.get('/tests/:testId/questions', requireAuth(), async (c) => {
  const user = await requireActiveUser(c)
  const sql = c.get('sql')
  const child = await loadLearningChild(sql, user.id)

  const session = await loadTestSession(sql, c.req.param('testId'), child.id)
  if (!session) {
    throw notFound('Test session not found')
  }
  const questions = await loadSessionQuestions(sql, session.question_ids)
  const gradeLevel = questions.length ? questions[0]!.grade_level : child.grade_level
  return jsonBody(c, {
    session_id: session.id,
    grade_level: gradeLevel,
    title_th: `เทสพื้นฐาน ป.${gradeLevel}`,
    program_type: String(session.metadata.program_type ?? 'TH'),
    time_limit_seconds: session.timer_seconds,
    core_question_count: Number(session.metadata.core_question_count ?? 0),
    challenge_question_count: Number(session.metadata.challenge_question_count ?? 0),
    ratio_policy: String(session.metadata.ratio_policy ?? RATIO_POLICY),
    rotation_cycle: Number(session.metadata.rotation_cycle ?? 1),
    questions: questions.map((question) => questionPayload(question)),
  })
})

/** The skills the child should practise next. */
export async function loadRecommendations(sql: Sql, childId: string): Promise<Json[]> {
  const rows = (await sql.query(
    `SELECT m.skill_id, s.code, s.name, m.mastery_score
       FROM skill_mastery m JOIN skills s ON s.id = m.skill_id
      WHERE m.child_profile_id = $1 AND m.mastery_score < 60
      ORDER BY m.mastery_score
      LIMIT 5`,
    [childId],
  )) as Array<{ skill_id: string; code: string; name: string; mastery_score: number }>
  return rows.map((row) => ({
    skill_id: String(row.skill_id),
    skill_code: row.code ?? null,
    title_th: `ทบทวน ${row.name ?? ''}`,
    reason_th: 'พบจุดที่ควรฝึกเพิ่มจากผลทดสอบ',
    mastery_score: pyFloat(Number(row.mastery_score ?? 0)),
  }))
}

/**
 * Grade a finished test.
 *
 * @param c the request context.
 */
async function submitTest(c: Context<AppEnv>): Promise<Response> {
  const user = await requireActiveUser(c)
  const sql = c.get('sql')
  const now = new Date()
  const child = await loadLearningChild(sql, user.id)
  const paid = isPaid(child, now)

  const session = await loadTestSession(sql, c.req.param('testId') ?? '', child.id)
  if (!session) {
    throw notFound('Test session not found')
  }
  const questions = await loadSessionQuestions(sql, session.question_ids)
  if (!questions.length) {
    throw badRequest('Test session has no questions')
  }

  const body = (await c.req.json().catch(() => ({}))) as Json

  // The single-question mode answers one question at a time.
  if (typeof body.question_id === 'string') {
    const question = questions.find((entry) => entry.id === body.question_id)
    if (!question) {
      throw notFound('Question not found in test session')
    }
    const match = answerMatchDetails(question, body.selected_answer)
    return jsonBody(c, {
      question_id: question.id,
      is_correct: match.is_correct,
      correct_answer: question.correct_answer,
      explanation_th: question.explanation ?? '',
      selected_answer_raw: match.selected_answer_raw,
      selected_answer_normalized: match.selected_answer_normalized,
      correct_answer_normalized: match.correct_answer_normalized,
    })
  }

  const answers = body.answers
  const answerMap = new Map<string, string>()
  const responseTimes = new Map<string, number>()
  let totalTimeMs = 0
  if (Array.isArray(answers)) {
    for (const answer of answers as Json[]) {
      const questionId = String(answer.question_id ?? '')
      answerMap.set(questionId, String(answer.selected_answer ?? ''))
      responseTimes.set(questionId, Number(answer.response_time_ms ?? 0) || 0)
    }
    totalTimeMs = Number(body.total_time_ms ?? 0) || 0
  } else if (answers && typeof answers === 'object') {
    for (const [questionId, answer] of Object.entries(answers as Json)) {
      answerMap.set(questionId, String(answer ?? ''))
    }
    const times = (body.response_times_ms ?? {}) as Json
    for (const [questionId, time] of Object.entries(times)) {
      responseTimes.set(questionId, Number(time ?? 0) || 0)
    }
    totalTimeMs = sum([...responseTimes.values()])
  }

  const matches = questions.map((question) => ({
    question,
    match: answerMatchDetails(question, answerMap.get(question.id) ?? ''),
    responseTime: responseTimes.get(question.id) ?? 0,
  }))
  const correct = matches.filter((entry) => entry.match.is_correct).length
  const total = questions.length
  const accuracy = total ? roundLikePython((correct / total) * 100, 2) : 0
  const coreMatches = matches.filter(
    (entry) => questionChallengeRole(entry.question) === 'core',
  )
  const challengeMatches = matches.filter(
    (entry) => questionChallengeRole(entry.question) === 'challenge',
  )
  const coreTotal = coreMatches.length
  const challengeTotal = challengeMatches.length
  const coreCorrect = coreMatches.filter((entry) => entry.match.is_correct).length
  const challengeCorrect = challengeMatches.filter((entry) => entry.match.is_correct).length
  const coreAccuracy = coreTotal ? roundLikePython((coreCorrect / coreTotal) * 100, 2) : 0
  const challengeAccuracy = challengeTotal
    ? roundLikePython((challengeCorrect / challengeTotal) * 100, 2)
    : 0
  const speeds = matches.map((entry) => entry.responseTime).filter((time) => time && time > 0)
  const avgSpeed = speeds.length ? roundLikePython(sum(speeds) / speeds.length, 2) : 0
  const scoreAwarded = Math.trunc(accuracy)
  const xpAwarded = accuracy >= 50 ? 20 : 5

  await sql.query(
    `UPDATE test_sessions SET status = 'completed', completed_at = now(), updated_at = now()
      WHERE id = $1`,
    [session.id],
  )
  await sql.query(
    `INSERT INTO test_results (id, test_session_id, child_profile_id, lesson_id, quiz_id,
         total_questions, correct_count, accuracy, average_response_time_ms, total_time_ms,
         score_awarded, xp_awarded, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())`,
    [
      crypto.randomUUID(),
      session.id,
      child.id,
      session.lesson_id,
      session.quiz_id,
      total,
      correct,
      accuracy,
      avgSpeed,
      totalTimeMs,
      scoreAwarded,
      xpAwarded,
    ],
  )

  // The quiz session and its answers record how the child performed.
  const firstSkill = (await sql.query(
    `SELECT subject_id FROM skills WHERE id = $1 LIMIT 1`,
    [questions[0]!.skill_id],
  )) as Array<{ subject_id: string }>
  const quizSessionId = crypto.randomUUID()
  await sql.query(
    `INSERT INTO quiz_sessions (id, child_profile_id, subject_id, mode, started_at, completed_at,
         total_questions, correct_count, total_xp_earned, metadata, created_at, updated_at)
     VALUES ($1, $2, $3, 'dashboard_test', now(), now(), $4, $5, 0, $6::jsonb, now(), now())`,
    [
      quizSessionId,
      child.id,
      String(firstSkill[0]?.subject_id ?? ''),
      total,
      correct,
      JSON.stringify({ test_session_id: session.id, total_time_ms: totalTimeMs }),
    ],
  )

  const bySkill = new Map<string, typeof matches>()
  for (const entry of matches) {
    const list = bySkill.get(entry.question.skill_id) ?? []
    list.push(entry)
    bySkill.set(entry.question.skill_id, list)
  }

  const weakSkills: Json[] = []
  for (const [skillId, entries] of bySkill) {
    const score = calculateMasteryScore(
      entries.map((entry) => ({
        isCorrect: entry.match.is_correct,
        responseTimeMs: entry.responseTime,
      })),
    )
    const level = masteryLevel(score)
    const correctCount = entries.filter((entry) => entry.match.is_correct).length
    const incorrectCount = entries.length - correctCount
    const avgResponse = Math.trunc(
      sum(entries.map((entry) => entry.responseTime)) / Math.max(1, entries.length),
    )
    await sql.query(
      `INSERT INTO skill_mastery (id, child_profile_id, skill_id, mastery_score, mastery_level,
           last_practiced_at, correct_count, incorrect_count, avg_response_time_ms, updated_at)
       VALUES ($1, $2, $3, $4, $5, now(), $6, $7, $8, now())
       ON CONFLICT (child_profile_id, skill_id) DO UPDATE
          SET mastery_score = $4, mastery_level = $5, last_practiced_at = now(),
              correct_count = skill_mastery.correct_count + $6,
              incorrect_count = skill_mastery.incorrect_count + $7,
              avg_response_time_ms = $8, updated_at = now()`,
      [
        crypto.randomUUID(),
        child.id,
        skillId,
        score,
        level,
        correctCount,
        incorrectCount,
        avgResponse,
      ],
    )
    for (const entry of entries) {
      await sql.query(
        `INSERT INTO quiz_answers (id, quiz_session_id, child_profile_id, question_id, skill_id,
             selected_answer, selected_answer_raw, selected_answer_normalized,
             correct_answer_normalized, is_correct, response_time_ms, hint_used, attempt_count,
             mistake_type, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, false, 1, $12, now())`,
        [
          crypto.randomUUID(),
          quizSessionId,
          child.id,
          entry.question.id,
          entry.question.skill_id,
          answerMap.get(entry.question.id) ?? '',
          entry.match.selected_answer_raw,
          entry.match.selected_answer_normalized,
          entry.match.correct_answer_normalized,
          entry.match.is_correct,
          entry.responseTime,
          inferMistakeType(entry.match.is_correct, entry.responseTime),
        ],
      )
    }
    if (score < 60) {
      const skill = (await sql.query(`SELECT code FROM skills WHERE id = $1 LIMIT 1`, [
        skillId,
      ])) as Array<{ code: string }>
      weakSkills.push({
        skill_id: skillId,
        skill_code: skill[0]?.code ?? null,
        mastery_score: pyFloat(score),
      })
    }
  }

  // Record which questions the child has seen, so the next test rotates.
  const rotationKey = String(session.metadata.rotation_key ?? session.quiz_id ?? session.id)
  const rotationScope = String(session.metadata.rotation_scope ?? 'review')
  for (const entry of matches) {
    const role = questionChallengeRole(entry.question)
    const history = (await sql.query(
      `SELECT id FROM question_attempt_history
        WHERE child_id = $1 AND question_id = $2 AND rotation_key = $3 AND question_type = $4
        LIMIT 1`,
      [child.id, entry.question.id, rotationKey, role],
    )) as Array<{ id: string }>
    if (history.length) {
      await sql.query(
        `UPDATE question_attempt_history
            SET last_attempted_at = now(), attempt_count = attempt_count + 1,
                last_is_correct = $2
          WHERE id = $1`,
        [history[0]!.id, entry.match.is_correct],
      )
    } else {
      await sql.query(
        `INSERT INTO question_attempt_history (id, child_id, question_id, lesson_id, grade_level,
             topic_code, skill_code, question_type, rotation_scope, rotation_key, cycle_number,
             first_seen_at, last_attempted_at, attempt_count, last_is_correct)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1, now(), now(), 1, $11)`,
        [
          crypto.randomUUID(),
          child.id,
          entry.question.id,
          session.lesson_id,
          entry.question.grade_level,
          (entry.question.metadata ?? {}).topic_code ?? null,
          (entry.question.metadata ?? {}).skill_code ?? null,
          role,
          rotationScope,
          rotationKey,
          entry.match.is_correct,
        ],
      )
    }
  }

  const stats = (await sql.query(
    `SELECT id FROM student_stats WHERE child_profile_id = $1 LIMIT 1`,
    [child.id],
  )) as Array<{ id: string }>
  if (stats.length) {
    await sql.query(
      `UPDATE student_stats
          SET tests_completed = tests_completed + 1,
              perfect_tests = perfect_tests + $2,
              lessons_completed = lessons_completed + $3,
              updated_at = now()
        WHERE id = $1`,
      [stats[0]!.id, accuracy === 100 ? 1 : 0, session.lesson_id ? 1 : 0],
    )
  } else {
    await sql.query(
      `INSERT INTO student_stats (id, child_profile_id, lessons_completed, tests_completed,
           quests_completed, checkins, perfect_tests, created_at, updated_at)
       VALUES ($1, $2, $3, 1, 0, 0, $4, now(), now())`,
      [
        crypto.randomUUID(),
        child.id,
        session.lesson_id ? 1 : 0,
        accuracy === 100 ? 1 : 0,
      ],
    )
  }

  const totalTestsCompleted = (child.total_tests_completed ?? 0) + 1
  const averageAccuracy = roundLikePython(
    ((Number(child.average_test_accuracy ?? 0) * (totalTestsCompleted - 1)) + accuracy) /
      totalTestsCompleted,
    2,
  )
  const averageSpeed = roundLikePython(
    ((Number(child.average_test_speed ?? 0) * (totalTestsCompleted - 1)) + avgSpeed) /
      totalTestsCompleted,
    2,
  )
  await sql.query(
    `UPDATE child_profiles
        SET total_tests_completed = $2, average_test_accuracy = $3, average_test_speed = $4,
            test_attempts_used = CASE WHEN $5 THEN test_attempts_used + 1 ELSE test_attempts_used END,
            updated_at = now()
      WHERE id = $1`,
    [child.id, totalTestsCompleted, averageAccuracy, averageSpeed, !paid],
  )
  child.total_tests_completed = totalTestsCompleted
  child.average_test_accuracy = averageAccuracy
  child.average_test_speed = averageSpeed
  if (!paid) {
    child.test_attempts_used = (child.test_attempts_used ?? 0) + 1
  }

  await awardProgress(
    sql,
    child,
    'test_complete',
    session.id,
    xpAwarded,
    scoreAwarded,
    0,
    'Test completed',
  )

  if (session.lesson_id) {
    await applyQuestProgress(sql, child, 'lesson_complete')
  }
  await applyQuestProgress(sql, child, accuracy >= 50 ? 'test_50' : 'test_complete')
  if (accuracy === 100) {
    await applyQuestProgress(sql, child, 'test_100')
  }

  // The recommendations list the skills the child should practise next.
  const recommendations = await loadRecommendations(sql, child.id)
  const adaptive: Json[] = []
  if (coreTotal && coreAccuracy < 60) {
    adaptive.push({
      type: 'core_review',
      reason: 'core_accuracy_low',
      title_th: 'ทบทวนบทเรียนหลักก่อน',
    })
  }
  if (challengeTotal && challengeAccuracy < 60 && coreAccuracy >= 70) {
    adaptive.push({
      type: 'challenge_practice',
      reason: 'challenge_accuracy_low',
      title_th: 'ฝึกโจทย์ประยุกต์และโจทย์ไม่ตรงแบบ',
    })
  }
  if (coreTotal && challengeTotal && coreAccuracy < 60 && challengeAccuracy < 60) {
    adaptive.push({
      type: 'core_first',
      reason: 'core_and_challenge_accuracy_low',
      title_th: 'เริ่มจากทบทวนพื้นฐาน แล้วค่อยฝึกโจทย์ท้าทาย',
    })
  }

  const remaining = paid ? 999999 : remainingFreeTests(child)
  return jsonBody(c, {
    test_session_id: session.id,
    session_id: session.id,
    total_questions: total,
    correct_count: correct,
    core_correct_count: coreCorrect,
    core_total: coreTotal,
    challenge_correct_count: challengeCorrect,
    challenge_total: challengeTotal,
    core_accuracy: pyFloat(coreAccuracy),
    challenge_accuracy: pyFloat(challengeAccuracy),
    accuracy: pyFloat(accuracy),
    score_percent: pyFloat(accuracy),
    average_response_time_ms: pyFloat(avgSpeed),
    total_time_ms: totalTimeMs,
    score_awarded: scoreAwarded,
    score_earned: scoreAwarded,
    xp_awarded: xpAwarded,
    xp_earned: xpAwarded,
    total_score: child.total_score ?? 0,
    total_xp: child.total_xp ?? 0,
    rank_title: child.current_rank_title ?? '',
    updated_status: {
      level: child.current_level ?? 1,
      total_xp: child.total_xp ?? 0,
      total_score: child.total_score ?? 0,
      coins: child.coins ?? 0,
      rank_title: child.current_rank_title ?? '',
      test_attempts_used: child.test_attempts_used ?? 0,
      remaining_free_tests: remaining,
    },
    weak_skills: weakSkills,
    recommendations: [...recommendations, ...adaptive],
  })
}

/** `POST /me/tests/:testId/submit` — grade a finished test. */
meLearningRoutes.post('/tests/:testId/submit', requireAuth(), (c) => submitTest(c))

/** `POST /me/tests/:testId/finish` — the legacy alias of `submit`. */
meLearningRoutes.post('/tests/:testId/finish', requireAuth(), (c) => submitTest(c))
