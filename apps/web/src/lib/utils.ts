export function xpToNextLevel(xp: number): { current: number; needed: number; percent: number } {
  const level = Math.floor(xp / 1000)
  const current = xp % 1000
  const needed = 1000
  const percent = Math.round((current / needed) * 100)
  return { current, needed, percent }
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
