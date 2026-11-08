/**
 * XP / level helpers.
 *
 * These MUST stay in sync with the backend service
 * `apps/api/app/services/xp.py`:
 *
 *   required_xp_for_next_level(level) = ceil(100 * level ** 1.35)
 *   level_from_total_xp(total_xp)      = greedy consume of the thresholds above
 *
 * The old frontend assumed a flat "1000 XP per level" model, which produced
 * wrong progress percentages (e.g. 455 XP => 45.5% instead of 22.7%).
 */

/** XP required to advance from `level` to `level + 1`. */
export function requiredXpForNextLevel(level: number): number {
  return Math.ceil(100 * Math.pow(Math.max(1, level), 1.35))
}

export interface XpLevelProgress {
  /** Level derived from total XP (mirrors `level_from_total_xp`). */
  level: number
  /** XP accumulated inside the current level. */
  xpIntoLevel: number
  /** XP required to leave the current level. */
  xpNeededForNextLevel: number
  /** XP still missing to reach the next level. */
  xpToNextLevel: number
  /** Progress inside the current level (0–100). */
  percent: number
}

/** Port of `level_from_total_xp` + the XP-into-level remainder. */
export function xpLevelProgress(totalXp: number | null | undefined): XpLevelProgress {
  let level = 1
  let remaining = Math.max(0, Math.floor(totalXp ?? 0))
  while (remaining >= requiredXpForNextLevel(level)) {
    remaining -= requiredXpForNextLevel(level)
    level += 1
  }
  const xpNeededForNextLevel = requiredXpForNextLevel(level)
  const percent = xpNeededForNextLevel > 0
    ? Math.min(100, Math.max(0, (remaining / xpNeededForNextLevel) * 100))
    : 0
  return {
    level,
    xpIntoLevel: remaining,
    xpNeededForNextLevel,
    xpToNextLevel: Math.max(0, xpNeededForNextLevel - remaining),
    percent,
  }
}

/**
 * Membership statuses that unlock paid content.
 * Backend `PAID_MEMBERSHIP_STATUSES` = { paid, plus, trial }.
 */
export function isPaidMembership(status?: string | null): boolean {
  if (!status) return false
  return ['paid', 'plus', 'trial', 'family', 'basic'].includes(status.toLowerCase())
}

export function gradeLabel(g: number): string {
  if (g >= 1 && g <= 6) return `ป.${g}`
  if (g >= 7 && g <= 9) return `ม.${g - 6}`
  if (g >= 10 && g <= 12) return `ม.${g - 9}`
  return `ชั้นที่ ${g}`
}

export function masteryColor(level: string): string {
  const map: Record<string, string> = {
    beginner: 'bg-gray-100 text-gray-600',
    intermediate: 'bg-yellow-100 text-yellow-700',
    proficient: 'bg-blue-100 text-blue-700',
    advanced: 'bg-green-100 text-green-700',
    mastery: 'bg-purple-100 text-purple-700',
  }
  return map[level] || 'bg-gray-100 text-gray-600'
}

export function masteryLabel(level: string): string {
  const map: Record<string, string> = {
    beginner: 'เริ่มต้น',
    intermediate: 'กลางๆ',
    proficient: 'ดีพอสมควร',
    advanced: 'เก่งมาก',
    mastery: 'เชี่ยวชาญ',
  }
  return map[level] || level
}

/**
 * Resolve an asset path that the API serves.
 *
 * Student photos live under /storage/avatars and are served by the API,
 * not by the app's public/ folder, so a relative path has to be pointed
 * at the API origin. Absolute URLs and data URLs are used as they are.
 */
export function resolveApiAssetUrl(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') return null
  if (value.includes('..') || value.includes('\\')) return null
  if (/^https?:\/\//i.test(value) || value.startsWith('data:image/')) return value
  const baseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '')
  const path = value.startsWith('/') ? value : `/${value}`
  return `${baseUrl}${path}`
}
