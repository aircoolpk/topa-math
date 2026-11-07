export type MascotKey = 'topa' | 'olli' | 'memo' | 'splash' | 'nova' | 'pip' | 'orbit' | 'timo' | 'riko'

export type MascotRegistryItem = {
  key: MascotKey
  aliases: string[]
  name: string
  role: string
  english_role: string
  description_th: string
  image: string
  color: string
  accent: string
  initial: string
}

export const mascotRegistry: MascotRegistryItem[] = [
  {
    key: 'topa',
    aliases: ['topa'],
    name: 'Topa',
    role: 'เพื่อนคู่คิด AI',
    english_role: 'AI Math Buddy',
    description_th: 'ชวนคิดทีละขั้น ทำให้โจทย์ยากดูเป็นมิตรขึ้น',
    image: '/brand/topa/mascot-topa-feature.png',
    color: '#2f80ed',
    accent: '#f2c94c',
    initial: 'T',
  },
  {
    key: 'olli',
    aliases: ['olli', 'oll'],
    name: 'Olli',
    role: 'ครูผู้รอบรู้',
    english_role: 'Wise Teacher',
    description_th: 'อธิบายหลักการให้เข้าใจง่ายและจับประเด็นสำคัญ',
    image: '/brand/topa/mascot-olli-feature.png',
    color: '#f2c94c',
    accent: '#2f80ed',
    initial: 'O',
  },
  {
    key: 'memo',
    aliases: ['memo'],
    name: 'Memo',
    role: 'ผู้ช่วยจำ',
    english_role: 'Memory Helper',
    description_th: 'ช่วยทบทวนสูตรและวิธีคิดให้จำได้แม่นขึ้น',
    image: '/brand/topa/mascot-memo-transparent.png',
    color: '#f2994a',
    accent: '#27ae60',
    initial: 'M',
  },
  {
    key: 'splash',
    aliases: ['splash'],
    name: 'Splash',
    role: 'นักคิดไว',
    english_role: 'Fast Thinker',
    description_th: 'ชวนฝึกความเร็วโดยไม่รีบจนพลาดขั้นตอน',
    image: '/brand/topa/mascot-splash-transparent.png',
    color: '#56ccf2',
    accent: '#2f80ed',
    initial: 'S',
  },
  {
    key: 'nova',
    aliases: ['nova'],
    name: 'Nova',
    role: 'ผู้เชี่ยวชาญตรรกะ',
    english_role: 'Logic Expert',
    description_th: 'ช่วยมองรูปแบบ เหตุผล และความสัมพันธ์ของคำตอบ',
    image: '/brand/topa/mascot-nova-transparent.png',
    color: '#9b51e0',
    accent: '#f2c94c',
    initial: 'N',
  },
  {
    key: 'pip',
    aliases: ['pip'],
    name: 'Pip',
    role: 'เพื่อนเติมกำลังใจ',
    english_role: 'Motivation Buddy',
    description_th: 'ให้กำลังใจเมื่อติดโจทย์และชวนลองใหม่อย่างมั่นใจ',
    image: '/brand/topa/mascot-pip-feature.png',
    color: '#eb5757',
    accent: '#f2c94c',
    initial: 'P',
  },
  {
    key: 'orbit',
    aliases: ['orbit'],
    name: 'Orbit',
    role: 'ผู้ช่วยวางแผน',
    english_role: 'Strategy Helper',
    description_th: 'ช่วยเลือกวิธีแก้โจทย์ที่เหมาะกับสถานการณ์',
    image: '/brand/topa/mascot-orbit-transparent.png',
    color: '#27ae60',
    accent: '#56ccf2',
    initial: 'O',
  },
  {
    key: 'timo',
    aliases: ['timo'],
    name: 'Timo',
    role: 'โค้ชฝึกฝน',
    english_role: 'Practice Coach',
    description_th: 'จัดจังหวะฝึกซ้ำให้เห็นพัฒนาการชัดเจน',
    image: '/brand/topa/mascot-timo-transparent.png',
    color: '#6fcf97',
    accent: '#f2994a',
    initial: 'T',
  },
  {
    key: 'riko',
    aliases: ['riko'],
    name: 'Riko',
    role: 'นักสืบโจทย์',
    english_role: 'Challenge Detective',
    description_th: 'ช่วยหาเบาะแสสำคัญในโจทย์ปัญหา',
    image: '/brand/topa/mascot-riko-feature.png',
    color: '#bb6bd9',
    accent: '#eb5757',
    initial: 'R',
  },
]

export function resolveMascotKey(key?: string | null): MascotKey {
  const normalized = String(key || '').toLowerCase().trim()
  return mascotRegistry.find((item) => item.aliases.includes(normalized))?.key || 'topa'
}

export function getMascot(key?: string | null): MascotRegistryItem {
  const resolved = resolveMascotKey(key)
  return mascotRegistry.find((item) => item.key === resolved) || mascotRegistry[0]
}

export function stableMascotIndex(seed: string | number | undefined | null): number {
  const text = String(seed ?? 'topa')
  let hash = 0
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0
  }
  return hash % mascotRegistry.length
}

/**
 * Resolve any mascot identifier (registry key or alias, e.g. 'topa', 'oll')
 * into a real, on-disk image path under /brand/topa/.
 *
 * Ranking rows store a bare mascot key (TopaRankingRow.mascot). Passing that
 * key straight to <img src> produced a relative URL like "topa" → 404. Use
 * this helper instead of hard-coding paths at call sites.
 */
export function resolveMascotImage(key?: string | null): string {
  const normalized = String(key || '').toLowerCase().trim()
  if (!normalized) return mascotRegistry[0].image
  // Already a usable absolute asset path.
  if (normalized.startsWith('/') || normalized.startsWith('http')) return normalized
  const match = mascotRegistry.find((item) => item.aliases.includes(normalized) || item.key === normalized)
  return match ? match.image : mascotRegistry[0].image
}
