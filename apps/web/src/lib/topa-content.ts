import { mascotRegistry } from './mascot-registry'

export type TopaStatCard = {
  label: string
  value: string
  detail?: string
}

export type TopaFeatureCard = {
  title: string
  subtitle?: string
  icon: string
  description: string
  order: number
  enabled: boolean
}

export type TopaRankingRow = {
  rank: number
  child_name: string
  province: string
  tests_completed: number
  total_score: number
  avg_speed: string
  mascot?: string
}

export type TopaReviewCard = {
  name: string
  school_claim: string
  quote: string
  image: string
  rating: number
  enabled: boolean
}

export type TopaMascotItem = {
  key: string
  name: string
  role: string
  english_role: string
  description_th: string
  image: string
  order: number
  enabled: boolean
}

export type TopaSimpleCard = {
  title: string
  icon: string
  text: string
  enabled: boolean
}

export type HomepageConfig = {
  hero: {
    headline: string
    subheadline: string
    primary_cta_text: string
    primary_cta_link: string
    secondary_cta_text: string
    secondary_cta_link: string
    mascot_group_image: string
    stats: TopaStatCard[]
  }
  features: {
    title: string
    subtitle: string
    cards: TopaFeatureCard[]
  }
  ranking: {
    title: string
    description: string
    use_demo: boolean
    provinces: string[]
    rows: TopaRankingRow[]
  }
  reviews: {
    title: string
    cards: TopaReviewCard[]
  }
  mascots: {
    title: string
    cards: TopaMascotItem[]
  }
  curriculum: {
    title: string
    cards: TopaSimpleCard[]
  }
  parent_trust: {
    title: string
    cards: TopaSimpleCard[]
  }
  cta_banner: {
    title: string
    subtitle: string
    button_text: string
    button_link: string
    mascot_image: string
  }
  footer: {
    contact_email: string
    line_url: string
    facebook_url: string
    youtube_url: string
    tiktok_url: string
    footer_text: string
  }
}

export const mascotPalette = [
  '#2f80ed',
  '#f2c94c',
  '#f2994a',
  '#27ae60',
  '#9b51e0',
  '#eb5757',
  '#56ccf2',
  '#6fcf97',
  '#bb6bd9',
]

export const defaultMascots: TopaMascotItem[] = [
  ...mascotRegistry.map((mascot, index) => ({
    key: mascot.key,
    name: mascot.name,
    role: mascot.role,
    english_role: mascot.english_role,
    description_th: mascot.description_th,
    image: mascot.image,
    order: index + 1,
    enabled: true,
  })),
]

export const fallbackHomepageConfig: HomepageConfig = {
  hero: {
    headline: 'เรียนเลขให้สนุก\nเก่งขึ้นทุกวันกับ TOPA Math',
    subheadline: 'สำหรับน้อง ๆ ป.1-6 ด้วย AI และหลักสูตรอัจฉริยะ เกมสนุก บทเรียนเข้าใจง่าย พร้อมเพื่อนตัวน้อยตลอดเส้นทาง',
    primary_cta_text: 'ทดลองใช้ฟรี 3 วัน!',
    primary_cta_link: '/register',
    secondary_cta_text: 'ดูอันดับท็อปไทย',
    secondary_cta_link: '#ranking',
    mascot_group_image: '/brand/topa/mascot-hero-group.png',
    stats: [
      { label: 'นักเรียน', value: '1,200+ คน', detail: 'กำลังฝึกเลขกับ TOPA' },
      { label: 'คะแนนเฉลี่ย', value: '4.8/5', detail: 'จากผู้ปกครองและเด็ก ๆ' },
      { label: 'ระดับความสำเร็จ', value: 'ยอดเยี่ยม', detail: 'ฝึกต่อเนื่องเห็นผล' },
      { label: 'Level / XP', value: 'Lv. 12', detail: '8,450 XP' },
      { label: 'Score graph', value: '+28%', detail: 'คะแนนดีขึ้นเดือนนี้' },
    ],
  },
  features: {
    title: 'เรียนแบบสนุก แต่พัฒนาได้จริง',
    subtitle: 'TOPA ผสม AI, แบบฝึก, Ranking และแรงจูงใจให้เด็กประถมฝึกเลขได้ต่อเนื่อง',
    cards: [
      { title: 'AI วิเคราะห์จุดอ่อน', icon: 'Brain', description: 'ระบบช่วยมองจุดที่ควรฝึกเพิ่มและแนะนำบทเรียนที่เหมาะกับเด็กแต่ละคน', order: 1, enabled: true },
      { title: 'แบบฝึกหลากหลาย', icon: 'Sparkles', description: 'โจทย์หลายรูปแบบ ครอบคลุมพื้นฐาน ไทย และ EP สำหรับ ป.1-6', order: 2, enabled: true },
      { title: 'ฝึกจริง เห็นผลจริง', icon: 'LineChart', description: 'เด็กเห็น Level, XP, คะแนน และพัฒนาการของตัวเองทุกวัน', order: 3, enabled: true },
      { title: 'Ranking ทั่วประเทศ', icon: 'Trophy', description: 'สร้างแรงบันดาลใจด้วยอันดับระดับประเทศและจังหวัด', order: 4, enabled: true },
    ],
  },
  ranking: {
    title: 'TOPA Ranking',
    description: 'ดูอันดับนักเรียนตัวอย่างจากทั่วไทย เลือกระดับชั้นและจังหวัดได้',
    use_demo: true,
    provinces: ['ทุกจังหวัด', 'กรุงเทพมหานคร', 'เชียงใหม่', 'ขอนแก่น', 'สงขลา', 'ชลบุรี'],
    rows: [
      { rank: 1, child_name: 'น้องดาว', province: 'กรุงเทพมหานคร', tests_completed: 126, total_score: 9850, avg_speed: '18 วิ/ข้อ', mascot: 'topa' },
      { rank: 2, child_name: 'มินิคุง', province: 'เชียงใหม่', tests_completed: 118, total_score: 9420, avg_speed: '21 วิ/ข้อ', mascot: 'oll' },
      { rank: 3, child_name: 'น้องอิ่ม', province: 'สงขลา', tests_completed: 107, total_score: 9180, avg_speed: '22 วิ/ข้อ', mascot: 'memo' },
      { rank: 4, child_name: 'ภูมิ', province: 'ขอนแก่น', tests_completed: 99, total_score: 8890, avg_speed: '24 วิ/ข้อ', mascot: 'pip' },
    ],
  },
  reviews: {
    title: 'รีวิวจากรุ่นพี่',
    cards: [
      { name: 'คุณแม่น้องพริม', school_claim: 'สอบติดห้อง Gifted โรงเรียนชั้นนำ', quote: 'TOPA ช่วยให้ลูกฝึกโจทย์อย่างมีเป้าหมาย เห็นจุดอ่อนชัด และกล้าทำข้อสอบมากขึ้น', image: '', rating: 5, enabled: true },
      { name: 'น้องต้นกล้า', school_claim: 'เตรียมสอบเข้า ม.1 Gifted Math', quote: 'แบบฝึกสนุกเหมือนเล่นเกม แต่ช่วยให้ผมคิดเป็นขั้นตอนและทำโจทย์ได้เร็วขึ้น', image: '', rating: 5, enabled: true },
    ],
  },
  mascots: { title: 'เพื่อนช่วยเรียนของ TOPA', cards: defaultMascots },
  curriculum: {
    title: 'จัดเต็มหลักสูตร ป.1-ป.6 ทั้งหลักสูตร ไทย และ EP',
    cards: [
      { title: 'ปูพื้นฐานเข้าใจง่าย', icon: 'BookOpen', text: 'เริ่มจากภาพและสถานการณ์ใกล้ตัว', enabled: true },
      { title: 'เสริมทักษะคิดเป็นระบบ', icon: 'Workflow', text: 'ฝึกแยกขั้นตอนและเลือกวิธีทำ', enabled: true },
      { title: 'ต่อยอดความคิด', icon: 'Lightbulb', text: 'เชื่อมโยงความรู้เดิมไปโจทย์ที่ซับซ้อนขึ้น', enabled: true },
      { title: 'เชื่อมโยงชีวิตจริง', icon: 'Map', text: 'ใช้เงิน เวลา การวัด และข้อมูลในโจทย์จริง', enabled: true },
      { title: 'โจทย์ท้าทาย', icon: 'Puzzle', text: 'เพิ่มความมั่นใจด้วยโจทย์ประยุกต์', enabled: true },
      { title: 'เตรียมพร้อมสอบ', icon: 'GraduationCap', text: 'พร้อมทั้งทบทวนและวัดผลก่อนสอบ', enabled: true },
    ],
  },
  parent_trust: {
    title: 'ผู้ปกครองวางใจได้',
    cards: [
      { title: 'ปลอดภัยสำหรับเด็ก', icon: 'ShieldCheck', text: 'ออกแบบพื้นที่เรียนรู้ที่เป็นมิตรและเหมาะกับวัย', enabled: true },
      { title: 'ติดตามพัฒนาการได้', icon: 'Activity', text: 'เห็น XP คะแนน บทเรียน และผลสอบล่าสุด', enabled: true },
      { title: 'วางแผนจุดอ่อนชัดเจน', icon: 'Target', text: 'รู้ว่าควรฝึกเรื่องใดต่อเพื่อให้เห็นผล', enabled: true },
      { title: 'ใช้งานง่ายสำหรับผู้ปกครอง', icon: 'HeartHandshake', text: 'เมนูชัด เข้าใจสถานะลูกได้เร็ว', enabled: true },
      { title: 'ไม่มีโฆษณารบกวน', icon: 'BadgeCheck', text: 'โฟกัสกับการเรียน ไม่ถูกดึงออกนอกบทเรียน', enabled: true },
    ],
  },
  cta_banner: {
    title: 'เริ่มให้ลูกเก่งเลขอย่างมั่นใจวันนี้',
    subtitle: 'ทดลองเรียนฟรี 3 วัน แล้วดูว่าการฝึกเลขทุกวันเปลี่ยนความมั่นใจได้แค่ไหน',
    button_text: 'ทดลองใช้ฟรี 3 วัน!',
    button_link: '/register',
    mascot_image: '/brand/topa/mascot-topa.png',
  },
  footer: {
    contact_email: 'support@topamath.com',
    line_url: '#',
    facebook_url: '#',
    youtube_url: '#',
    tiktok_url: '#',
    footer_text: 'TOPA Math แพลตฟอร์มเรียนคณิตศาสตร์สำหรับเด็กประถม ป.1-6 ทั้งหลักสูตรไทยและ EP',
  },
}
