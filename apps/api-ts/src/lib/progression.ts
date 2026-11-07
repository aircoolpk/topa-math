/**
 * Rank titles and XP/level maths.
 *
 * These mirror `app/services/rank_titles.py` and `app/services/xp.py` in the
 * legacy FastAPI service exactly, so the leaderboard and the dashboard show
 * the same titles and levels as before the migration.
 */

/** Rank title thresholds, ordered by minimum score. */
export const RANK_RULES: ReadonlyArray<readonly [string, number]> = [
  ['เด็กหลังห้อง', 0],
  ['เด็กนักเรียน', 100],
  ['เด็กเก่ง', 300],
  ['เด็กหัวแถว', 700],
  ['หัวหน้าห้อง', 1200],
  ['ประธานรุ่น', 2000],
  ['เด็กอัจฉริยะ', 3500],
]

/** The rank title awarded for a given score. */
export function rankTitleForScore(score: number): string {
  let current = RANK_RULES[0]?.[0] ?? ''
  for (const [title, minScore] of RANK_RULES) {
    if (score >= minScore) {
      current = title
    }
  }
  return current
}

/** The rank title one step above `score`, or `null` at the top rank. */
export function nextRankTitleForScore(score: number): string | null {
  let index = 0
  for (let i = 0; i < RANK_RULES.length; i++) {
    const rule = RANK_RULES[i]
    if (rule && score >= rule[1]) {
      index = i
    }
  }
  return RANK_RULES[index + 1]?.[0] ?? null
}

/** XP required to advance from `level` to the next one. */
export function requiredXpForNextLevel(level: number): number {
  return Math.ceil(100 * Math.pow(Math.max(1, level), 1.35))
}

/**
 * Split a total XP amount into level, XP inside the level, and the XP needed
 * to leave the level.
 */
export function levelProgress(totalXp: number): {
  level: number
  xpIntoLevel: number
  xpNeededForNextLevel: number
} {
  let level = 1
  let remaining = Math.max(0, Math.floor(totalXp || 0))
  while (remaining >= requiredXpForNextLevel(level)) {
    remaining -= requiredXpForNextLevel(level)
    level += 1
  }
  return { level, xpIntoLevel: remaining, xpNeededForNextLevel: requiredXpForNextLevel(level) }
}

/** The level implied by a total XP amount. */
export function levelFromTotalXp(totalXp: number): number {
  return levelProgress(totalXp).level
}

/**
 * Normalise an average response time (ms) into a 0-100 speed score.
 *
 * Mirrors `_normalize_speed` in the FastAPI rankings router so leaderboard
 * ordering stays stable across the migration.
 */
export function normalizeSpeed(averageSpeedMs: number | null | undefined): number {
  if (averageSpeedMs === null || averageSpeedMs === undefined || averageSpeedMs < 500) {
    return 0
  }
  const benchmarkMs = 10_000
  const raw = 100 - ((averageSpeedMs - benchmarkMs) / benchmarkMs) * 50
  return Math.round(Math.max(0, Math.min(100, raw)) * 100) / 100
}

/**
 * The composite leaderboard score.
 *
 * mastery (50%) + speed (20%) + improvement (30%), matching the FastAPI
 * implementation.
 */
export function rankScore(totalScore: number, averageSpeedMs: number | null, totalXp: number): number {
  const mastery = totalScore || 0
  const speed = normalizeSpeed(averageSpeedMs)
  const improvement = Math.round(Math.min(100, (totalXp || 0) / 100) * 100) / 100
  return Math.round((mastery * 0.5 + speed * 0.2 + improvement * 0.3) * 100) / 100
}
