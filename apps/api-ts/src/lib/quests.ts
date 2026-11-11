/**
 * Shared quest helpers.
 *
 * The catalogue, the period windows and the payload shapes mirror the legacy
 * FastAPI service:
 *
 *  - `apps/api/app/routers/quests.py` — the child-scoped `/children/{id}/quests…`
 *    payloads (`QuestOut`).
 *  - `apps/api/app/routers/me.py` — the `/me/quests…` payloads and the fixed
 *    daily/weekly/monthly quest catalogue.
 *  - `apps/api/app/services/student_progress.py` — the child-quest rows and
 *    the period keys.
 *
 * Keeping the maths here means both route files answer with byte-identical
 * JSON, which is what the frontend compares against during the cutover.
 */

/** A quest row as stored in `learning_quests`. */
export interface LearningQuestRow {
  id: string
  quest_id: string
  grade_level: number
  skill_code: string | null
  title: string
  description: string | null
  quest_type: string | null
  recurrence_type: string | null
  xp_reward: number | null
  coin_reward: number | null
  estimated_minutes: number | null
  status: string | null
  lesson_id: string | null
  quiz_id: string | null
  metadata: Record<string, unknown> | null
}

/** A per-child quest row as stored in `child_quests`. */
export interface ChildQuestRow {
  id: string
  quest_id: string
  recurrence_type: string | null
  period_key: string | null
  status: string | null
  progress_current: number | null
  progress_target: number | null
  started_at: Date | string | null
  completed_at: Date | string | null
  xp_awarded: number | null
  coin_awarded: number | null
  score_awarded: number | null
}

/** The recurrence buckets the API exposes. */
export type RecurrenceType = 'daily' | 'weekly' | 'monthly'

/**
 * The fixed quest catalogue.
 *
 * Every entry is `(slug, title, description, metric, target, reward)` and the
 * quest id is derived as `{period}-{slug}` — exactly like `FIXED_QUESTS` in
 * `me.py`.
 */
export const FIXED_QUESTS: Record<RecurrenceType, ReadonlyArray<readonly [string, string, string, string, number, number]>> = {
  daily: [
    ['check-in', 'เช็กชื่อในระบบ', 'เข้าใช้งานระบบวันนี้', 'check_in', 1, 1],
    ['lesson', 'เข้าเรียนเนื้อหา', 'เข้าเรียนเนื้อหา 1 เรื่อง', 'lesson', 1, 1],
    ['test-50', 'ทำเทส ตอบถูกเกิน 50%', 'ทำเทสและตอบถูกอย่างน้อย 50%', 'test_50', 1, 1],
  ],
  weekly: [
    ['check-in-2', 'เช็กชื่อ', 'เช็กชื่อให้ครบ 2 ครั้ง', 'check_in', 2, 3],
    ['check-in-4', 'เช็กชื่อ', 'เช็กชื่อให้ครบ 4 ครั้ง', 'check_in', 4, 3],
    ['check-in-6', 'เช็กชื่อ', 'เช็กชื่อให้ครบ 6 ครั้ง', 'check_in', 6, 3],
    ['lesson-3', 'เรียนบทเรียน', 'เรียนบทเรียนให้ครบ 3 เรื่อง', 'lesson', 3, 3],
    ['lesson-4', 'เรียนบทเรียน', 'เรียนบทเรียนให้ครบ 4 เรื่อง', 'lesson', 4, 3],
    ['lesson-5', 'เรียนบทเรียน', 'เรียนบทเรียนให้ครบ 5 เรื่อง', 'lesson', 5, 3],
    ['friend-3', 'เพิ่มเพื่อน', 'เพิ่มเพื่อนเพื่อทำภารกิจนี้', 'friend', 3, 3],
    ['test-50-5', 'ทำเทส ตอบถูกเกิน 50%', 'ทำเทสตอบถูกเกิน 50% ให้ครบ 5 เทส', 'test_50', 5, 3],
    ['test-50-10', 'ทำเทส ตอบถูกเกิน 50%', 'ทำเทสตอบถูกเกิน 50% ให้ครบ 10 เทส', 'test_50', 10, 3],
    ['test-100-1', 'ทำเทส ตอบถูก 100%', 'ทำเทสตอบถูก 100% ให้ครบ 1 เทส', 'test_100', 1, 3],
    ['test-100-3', 'ทำเทส ตอบถูก 100%', 'ทำเทสตอบถูก 100% ให้ครบ 3 เทส', 'test_100', 3, 3],
  ],
  monthly: [
    ['check-in-10', 'เช็กชื่อ', 'เช็กชื่อให้ครบ 10 ครั้ง', 'check_in', 10, 7],
    ['check-in-20', 'เช็กชื่อ', 'เช็กชื่อให้ครบ 20 ครั้ง', 'check_in', 20, 7],
    ['check-in-28', 'เช็กชื่อ', 'เช็กชื่อให้ครบ 28 ครั้ง', 'check_in', 28, 7],
    ['lesson-10', 'เรียนบทเรียน', 'เรียนบทเรียนให้ครบ 10 เรื่อง', 'lesson', 10, 7],
    ['friend-10', 'เพิ่มเพื่อน', 'เพิ่มเพื่อนเพื่อทำภารกิจนี้', 'friend', 10, 7],
    ['test-50-10', 'ทำเทส ตอบถูกเกิน 50%', 'ทำเทสตอบถูกเกิน 50% ให้ครบ 10 เทส', 'test_50', 10, 7],
    ['test-50-20', 'ทำเทส ตอบถูกเกิน 50%', 'ทำเทสตอบถูกเกิน 50% ให้ครบ 20 เทส', 'test_50', 20, 7],
    ['test-100-5', 'ทำเทส ตอบถูก 100%', 'ทำเทสตอบถูก 100% ให้ครบ 5 เทส', 'test_100', 5, 7],
    ['test-100-10', 'ทำเทส ตอบถูก 100%', 'ทำเทสตอบถูก 100% ให้ครบ 10 เทส', 'test_100', 10, 7],
  ],
}

/**
 * Thailand is UTC+7 all year round, so the offset can be applied without a
 * timezone database — which the Workers runtime does not ship.
 */
const THAI_OFFSET_MS = 7 * 60 * 60 * 1000

/** The columns fetched for a quest row. */
export const QUEST_COLUMNS = `
  id, quest_id, grade_level, skill_code, title, description, quest_type,
  recurrence_type, xp_reward, coin_reward, estimated_minutes, status,
  lesson_id, quiz_id, metadata
`

/** The columns fetched for a child-quest row. */
export const CHILD_QUEST_COLUMNS = `
  id, quest_id, recurrence_type, period_key, status, progress_current,
  progress_target, started_at, completed_at, xp_awarded, coin_awarded, score_awarded
`

/** Two-digit zero padding. */
function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

/** Four-digit zero padding (ISO years are always four digits). */
function pad4(value: number): string {
  return String(value).padStart(4, '0')
}

/**
 * Format a UTC timestamp as an ISO-8601 string in Bangkok time.
 *
 * The legacy service renders `datetime.isoformat()` on a timezone-aware
 * value, so the offset is always `+07:00` and the seconds are present.
 *
 * @param ms the timestamp in milliseconds since the epoch.
 */
export function isoInBangkok(ms: number): string {
  const shifted = new Date(ms + THAI_OFFSET_MS)
  return (
    `${pad4(shifted.getUTCFullYear())}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}` +
    `T${pad2(shifted.getUTCHours())}:${pad2(shifted.getUTCMinutes())}:${pad2(shifted.getUTCSeconds())}+07:00`
  )
}

/**
 * Format a database timestamp the way Python's `datetime.isoformat()` does.
 *
 * FastAPI serialises `datetime` values with microseconds and an explicit
 * offset; the Worker receives `Date` objects, so the same shape is rebuilt
 * here.
 *
 * @param value the timestamp read from the database.
 */
export function isoLikePython(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null
  }
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  const microseconds = date.getUTCMilliseconds() * 1000
  const base =
    `${pad4(date.getUTCFullYear())}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}` +
    `T${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}:${pad2(date.getUTCSeconds())}`
  return microseconds > 0 ? `${base}.${String(microseconds).padStart(6, '0')}+00:00` : `${base}+00:00`
}

/**
 * Round like Python's `round(value, digits)`.
 *
 * Python rounds the *exact* binary value half-to-even, while
 * `Number.prototype.toFixed` rounds half away from zero. The legacy payloads
 * contain percentages, so the difference is observable.
 *
 * @param value the number to round.
 * @param digits the number of decimal places.
 */
export function roundLikePython(value: number, digits = 2): number {
  if (!Number.isFinite(value)) {
    return value
  }
  const text = value.toFixed(20)
  const negative = text.startsWith('-')
  const unsigned = negative ? text.slice(1) : text
  const [integerPart = '0', fractionPart = ''] = unsigned.split('.')
  const kept = fractionPart.slice(0, digits)
  const rest = fractionPart.slice(digits)
  const firstDigit = rest.charAt(0)
  const isRoundUp = rest === '' ? false : firstDigit > '5' ? true : firstDigit < '5' ? false : rest.slice(1).replace(/0/g, '') !== '' ? true : Number(integerPart.slice(-1)) % 2 !== 0
  const scaled = BigInt(integerPart) * 10n ** BigInt(digits) + BigInt(kept.padEnd(digits, '0') || '0') + (isRoundUp ? 1n : 0n)
  const divisor = 10n ** BigInt(digits)
  const whole = scaled / divisor
  const fraction = scaled % divisor
  const result = Number(`${whole}.${String(fraction).padStart(digits, '0')}`)
  return negative ? -result : result
}

/**
 * The ISO year and week number of a date.
 *
 * @param year the calendar year.
 * @param month the zero-based month.
 * @param day the day of the month.
 */
export function isoWeek(year: number, month: number, day: number): { year: number; week: number } {
  const date = new Date(Date.UTC(year, month, day))
  const weekday = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - weekday + 3)
  const isoYear = date.getUTCFullYear()
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4))
  const firstWeekday = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstWeekday + 3)
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000))
  return { year: isoYear, week }
}

/** The window a recurrence bucket covers. */
export interface PeriodWindow {
  /** The key that identifies the current period in `child_quests.period_key`. */
  key: string
  /** The inclusive start of the period (UTC). */
  start: Date
  /** The exclusive end of the period (UTC). */
  end: Date
  /** When the bucket resets, rendered the way the legacy service renders it. */
  resetAt: string
}

/**
 * The window of a recurrence bucket, anchored on the current Bangkok date.
 *
 * @param period the recurrence bucket.
 * @param nowMs the current time in milliseconds since the epoch.
 */
export function periodWindow(period: RecurrenceType, nowMs: number = Date.now()): PeriodWindow {
  const shifted = new Date(nowMs + THAI_OFFSET_MS)
  const year = shifted.getUTCFullYear()
  const month = shifted.getUTCMonth()
  const day = shifted.getUTCDate()

  let startYear = year
  let startMonth = month
  let startDay = day
  let endYear = year
  let endMonth = month
  let endDay = day
  let key: string

  if (period === 'daily') {
    const next = new Date(Date.UTC(year, month, day + 1))
    endYear = next.getUTCFullYear()
    endMonth = next.getUTCMonth()
    endDay = next.getUTCDate()
    key = `${pad4(year)}-${pad2(month + 1)}-${pad2(day)}`
  } else if (period === 'weekly') {
    const mondayOffset = (shifted.getUTCDay() + 6) % 7
    const monday = new Date(Date.UTC(year, month, day - mondayOffset))
    startYear = monday.getUTCFullYear()
    startMonth = monday.getUTCMonth()
    startDay = monday.getUTCDate()
    const nextMonday = new Date(Date.UTC(startYear, startMonth, startDay + 7))
    endYear = nextMonday.getUTCFullYear()
    endMonth = nextMonday.getUTCMonth()
    endDay = nextMonday.getUTCDate()
    const week = isoWeek(year, month, day)
    key = `${pad4(week.year)}-W${pad2(week.week)}`
  } else {
    startDay = 1
    const nextMonth = new Date(Date.UTC(year, month + 1, 1))
    endYear = nextMonth.getUTCFullYear()
    endMonth = nextMonth.getUTCMonth()
    endDay = 1
    key = `${pad4(year)}-${pad2(month + 1)}`
  }

  const start = new Date(Date.UTC(startYear, startMonth, startDay) - THAI_OFFSET_MS)
  const end = new Date(Date.UTC(endYear, endMonth, endDay) - THAI_OFFSET_MS)
  // The weekly bucket resets one minute before the next Monday.
  const resetMs = period === 'weekly' ? end.getTime() - 60_000 : end.getTime()

  return { key, start, end, resetAt: isoInBangkok(resetMs) }
}

/**
 * The period key of a recurrence bucket, used to scope `child_quests` rows.
 *
 * @param recurrenceType the recurrence bucket of the quest.
 * @param nowMs the current time in milliseconds since the epoch.
 */
export function periodKey(recurrenceType: string, nowMs: number = Date.now()): string | null {
  if (recurrenceType === 'none') {
    return null
  }
  const period: RecurrenceType =
    recurrenceType === 'daily' || recurrenceType === 'weekly' || recurrenceType === 'monthly' ? recurrenceType : 'daily'
  return periodWindow(period, nowMs).key
}

/** The number of items a quest asks for. */
export function questTarget(quest: LearningQuestRow): number {
  const raw = (quest.metadata ?? {})['target_count']
  const value = Number(raw ?? 1)
  return Number.isFinite(value) ? Math.trunc(value) : 1
}

/** The score a quest awards. */
export function questScoreReward(quest: LearningQuestRow): number {
  const raw = (quest.metadata ?? {})['score_reward']
  if (raw === undefined || raw === null) {
    return quest.xp_reward ?? 0
  }
  const value = Number(raw)
  return Number.isFinite(value) ? Math.trunc(value) : quest.xp_reward ?? 0
}

/** The `QuestOut` payload of the child-scoped quest endpoints. */
export interface QuestOut {
  id: string
  quest_id: string
  grade_level: number
  skill_code: string | null
  title: string
  title_th: string | null
  description: string | null
  description_th: string | null
  quest_type: string
  recurrence_type: string
  xp_reward: number
  coin_reward: number
  estimated_minutes: number | null
  status: string
  lesson_id: string | null
  quiz_id: string | null
  child_status: string
  progress_current: number
  progress_target: number
  progress_total: number
  progress_percent: number
  score_reward: number
  can_claim_reward: boolean
}

/**
 * Build the `QuestOut` payload of the child-scoped quest endpoints.
 *
 * Mirrors `_quest_to_out` in `apps/api/app/routers/quests.py`: the title and
 * description aliases stay empty and the quest keeps its own status.
 *
 * @param quest the quest row.
 * @param childQuest the child's quest row, when one exists.
 */
export function questToOut(quest: LearningQuestRow, childQuest?: ChildQuestRow | null): QuestOut {
  const progressCurrent = childQuest ? childQuest.progress_current ?? 0 : 0
  const progressTotal = childQuest ? childQuest.progress_target ?? 0 : questTarget(quest)
  const progressPercent = progressTotal ? roundLikePython((progressCurrent / progressTotal) * 100, 2) : 0
  const childStatus = childQuest ? childQuest.status ?? 'not_started' : 'not_started'

  return {
    id: quest.id,
    quest_id: quest.quest_id,
    grade_level: quest.grade_level,
    skill_code: quest.skill_code,
    title: quest.title,
    title_th: null,
    description: quest.description,
    description_th: null,
    quest_type: quest.quest_type ?? 'lesson',
    recurrence_type: quest.recurrence_type ?? 'none',
    xp_reward: quest.xp_reward ?? 0,
    coin_reward: quest.coin_reward ?? 0,
    estimated_minutes: quest.estimated_minutes,
    status: quest.status ?? 'active',
    lesson_id: quest.lesson_id,
    quiz_id: quest.quiz_id,
    child_status: childStatus,
    progress_current: progressCurrent,
    progress_target: progressTotal,
    progress_total: progressTotal,
    progress_percent: progressPercent,
    score_reward: questScoreReward(quest),
    can_claim_reward: progressCurrent >= progressTotal && childStatus !== 'completed',
  }
}

/**
 * Build the `QuestOut` payload of the `/me/quests…` endpoints.
 *
 * Mirrors `_quest_out` in `apps/api/app/routers/me.py`: the title and
 * description aliases are filled in and the status reflects the child's
 * progress.
 *
 * @param quest the quest row.
 * @param childQuest the child's quest row, when one exists.
 */
export function meQuestToOut(quest: LearningQuestRow, childQuest?: ChildQuestRow | null): QuestOut {
  const progressCurrent = childQuest ? childQuest.progress_current ?? 0 : 0
  const progressTotal = childQuest ? childQuest.progress_target ?? 0 : questTarget(quest)
  const progressPercent = progressTotal ? roundLikePython((progressCurrent / progressTotal) * 100, 2) : 0
  const childStatus = childQuest ? childQuest.status ?? 'not_started' : 'not_started'

  return {
    id: quest.id,
    quest_id: quest.quest_id,
    grade_level: quest.grade_level,
    skill_code: quest.skill_code,
    title: quest.title,
    title_th: quest.title,
    description: quest.description,
    description_th: quest.description,
    quest_type: quest.quest_type ?? 'lesson',
    recurrence_type: quest.recurrence_type ?? 'none',
    xp_reward: quest.xp_reward ?? 0,
    coin_reward: quest.coin_reward ?? 0,
    estimated_minutes: quest.estimated_minutes,
    status: childStatus === 'completed' ? 'completed' : 'available',
    lesson_id: quest.lesson_id,
    quiz_id: quest.quiz_id,
    child_status: childStatus,
    progress_current: progressCurrent,
    progress_target: progressTotal,
    progress_total: progressTotal,
    progress_percent: progressPercent,
    score_reward: questScoreReward(quest),
    can_claim_reward: progressCurrent >= progressTotal && childStatus !== 'completed',
  }
}
