'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

// ─── Mock Data ───────────────────────────────────────────────────────────────

const TOP_STUDENTS = [
  { nickname: 'น้องดาว', level: 12, province: 'กรุงเทพฯ', badge: '🌟', improvement: '+28%' },
  { nickname: 'มินิคุง', level: 10, province: 'เชียงใหม่', badge: '⚡', improvement: '+35%' },
  { nickname: 'บอยโจ๊ก', level: 9, province: 'ขอนแก่น', badge: '💪', improvement: '+42%' },
  { nickname: 'น้องอิ่ม', level: 8, province: 'สงขลา', badge: '🏆', improvement: '+19%' },
]

const FEATURES = [
  { emoji: '⭐', title: 'XP กับ Level', desc: 'สะสมคะแนน XP เพื่อขึ้นเลเวล เหมือนเล่นเกมที่ได้เก่งขึ้นจริงๆ' },
  { emoji: '👤', title: 'ตัวละคร Avatar', desc: 'สร้างตัวละครของตัวเอง เลือกผม ตา เสื้อผ้า ได้ตามใจ' },
  { emoji: '📋', title: 'เควสรายวัน', desc: 'ภารกิจประจำวันที่ช่วยให้ฝึกฝนสม่ำเสมอ มีรางวัลให้ตื่นเต้น' },
  { emoji: '🧠', title: 'วิเคราะห์จุดอ่อน', desc: 'AI วิเคราะห์ว่าตัวเองติดขัดตรงไหน และสร้างแบบฝึกให้ตรงจุด' },
  { emoji: '🎯', title: 'แบบฝึกเฉพาะตัว', desc: 'เรียนรู้จากสิ่งที่ตัวเองยังไม่แม่น ไม่ต้องเรียนสิ่งที่รู้แล้ว' },
  { emoji: '🏆', title: 'Ranking ทั่วประเทศ', desc: 'เช็คอันดับระดับจังหวัดและประเทศ สร้างแรงบันดาลใจ' },
]

// ─── Full 6-Grade Curriculum (Static — replace with API when backend supports) ─
// REPORT: Backend needs a public curriculum API — see /children/{id}/course-map
// for per-child view. For the public landing page, this static data is used.
// Backend API needed: GET /public/curriculum or similar returning grade + topics.

type GradeStatus = 'ready' | 'preparing' | 'review_only'

const CURRICULUM = [
  {
    grade: 1,
    title: 'คณิตศาสตร์ ป.1',
    status: 'ready' as GradeStatus,
    statusLabel: 'พร้อมเรียน',
    statusColor: 'bg-green-100 text-green-700',
    statusIcon: '✅',
    description: 'เริ่มต้นเรียนรู้ตัวเลขและการคำนวณพื้นฐาน สร้างความเข้าใจที่ดีตั้งแต่ต้น',
    topics: ['นับเลขและจำนวน', 'เปรียบเทียบจำนวน', 'บวกเลขไม่เกิน 20', 'ลบเลขไม่เกิน 20', 'รูปร่างพื้นฐาน', 'เวลาเบื้องต้น', 'เงินเบื้องต้น'],
    topicCount: 7,
    accentClass: 'from-green-400 to-emerald-500',
  },
  {
    grade: 2,
    title: 'คณิตศาสตร์ ป.2',
    status: 'ready' as GradeStatus,
    statusLabel: 'พร้อมเรียน',
    statusColor: 'bg-green-100 text-green-700',
    statusIcon: '✅',
    description: 'ต่อยอดการบวกลบ ฝึกตารางคูณ และเริ่มเรียนรู้เรื่องเงินและเวลา',
    topics: ['บวกเลขสองหลัก', 'ลบเลขสองหลัก', 'คูณเบื้องต้น', 'ตารางคูณ 2, 5, 10', 'เงินและการทอนเงิน', 'เวลาและปฏิทิน', 'รูปทรงสองมิติ'],
    topicCount: 7,
    accentClass: 'from-blue-400 to-primary-500',
  },
  {
    grade: 3,
    title: 'คณิตศาสตร์ ป.3',
    status: 'ready' as GradeStatus,
    statusLabel: 'พร้อมเรียน',
    statusColor: 'bg-green-100 text-green-700',
    statusIcon: '✅',
    description: 'เข้าสู่โลกของการคูณหาร ทบทวนเศษส่วน และแก้โจทย์ปัญหาหลายขั้นตอน',
    topics: ['คูณหลายหลัก', 'หารเบื้องต้น', 'เศษส่วนเบื้องต้น', 'โจทย์ปัญหาหลายขั้นตอน', 'การวัด', 'พื้นที่เบื้องต้น', 'ทบทวนรวม'],
    topicCount: 7,
    accentClass: 'from-primary-400 to-primary-600',
  },
  {
    grade: 4,
    title: 'คณิตศาสตร์ ป.4',
    status: 'preparing' as GradeStatus,
    statusLabel: 'กำลังเตรียม EP',
    statusColor: 'bg-amber-100 text-amber-700',
    statusIcon: '🛠️',
    description: 'มาเตรียมพื้นฐาน ป.4 ล่วงหน้า รองรับหลักสูตรใหม่ (NETPA) ก่อนเปิดเทอม',
    topics: ['จำนวนนับที่มากขึ้น', 'การคูณและหารหลายหลัก', 'เศษส่วน', 'ทศนิยมเบื้องต้น', 'มุมและรูปเรขาคณิต', 'พื้นที่และเส้นรอบรูป', 'โจทย์ปัญหา'],
    topicCount: 7,
    accentClass: 'from-amber-400 to-orange-500',
  },
  {
    grade: 5,
    title: 'คณิตศาสตร์ ป.5',
    status: 'preparing' as GradeStatus,
    statusLabel: 'กำลังเตรียม EP',
    statusColor: 'bg-amber-100 text-amber-700',
    statusIcon: '🛠️',
    description: 'เตรียมพื้นฐาน ป.5 ล่วงหน้า พร้อมรับมือเนื้อหาที่หนักขึ้นก่อนเปิดเทอม',
    topics: ['เศษส่วนและการคำนวณ', 'ทศนิยม', 'ร้อยละเบื้องต้น', 'บัญญัติไตรยางศ์เบื้องต้น', 'พื้นที่และปริมาตร', 'กราฟและข้อมูล', 'โจทย์ปัญหาหลายขั้นตอน'],
    topicCount: 7,
    accentClass: 'from-orange-400 to-red-400',
  },
  {
    grade: 6,
    title: 'คณิตศาสตร์ ป.6',
    status: 'review_only' as GradeStatus,
    statusLabel: 'ฟรี: บททบทวน',
    statusColor: 'bg-purple-100 text-purple-700',
    statusIcon: '📖',
    description: 'สมาชิกฟรีเรียนบททบทวน ป.6 ได้ พร้อมตัวอย่างโจทย์เตรียมสอบเข้า ม.1',
    topics: ['ห.ร.ม. และ ค.ร.น.', 'เศษส่วน ทศนิยม และร้อยละ', 'อัตราส่วน', 'สมการเบื้องต้น', 'รูปเรขาคณิต', 'ปริมาตร', 'เตรียมพื้นฐานก่อนมัธยม'],
    topicCount: 7,
    accentClass: 'from-purple-400 to-pink-500',
  },
]

// ─── Pricing Fallback Config ───────────────────────────────────────────────────
const FALLBACK_PRICES = {
  free: { price_thb: 0, name_th: 'ทดลองใช้ฟรี' },
  th_founder_monthly: { price_thb: 199, name_th: 'Plus TH', badge: 'Founder' },
  th_plus_monthly: { price_thb: 299, name_th: 'Plus TH' },
  th_plus_yearly_promo: { price_thb: 2990, name_th: 'Plus TH' },
  ep_founder_monthly: { price_thb: 399, name_th: 'Plus EP', badge: 'Founder' },
  ep_plus_monthly: { price_thb: 599, name_th: 'Plus EP' },
  ep_plus_yearly_promo: { price_thb: 5990, name_th: 'Plus EP' },
}

type FallbackKey = keyof typeof FALLBACK_PRICES

function formatPrice(amount: number): string {
  return new Intl.NumberFormat('th-TH').format(amount)
}

// ─── Pricing Plans ─────────────────────────────────────────────────────────────

interface HomePricingPlan {
  name: string
  emoji: string
  priceDisplay: string
  originalPriceDisplay?: string
  yearlyDisplay?: string
  color: string
  features: string[]
  cta: string
  ctaHref: string
  highlight: boolean
  badge?: string
}

async function fetchHomePricingPlans(): Promise<HomePricingPlan[]> {
  // Free plan — always static
  const freePlan: HomePricingPlan = {
    name: 'ทดลองใช้ฟรี',
    emoji: '🌱',
    priceDisplay: 'ฟรี',
    color: 'from-gray-400 to-gray-500',
    features: [
      'ทดลองเรียนฟรี',
      'เรียนได้ 3 เควส',
      'ทำเทสวัดระดับได้จำกัด',
      'Avatar พื้นฐาน',
      'เหมาะสำหรับลองใช้งาน',
    ],
    cta: 'ทดลองใช้ฟรี',
    ctaHref: '/register',
    highlight: false,
  }

  // Try to fetch live prices from billing API
  let pricesData: Record<string, { price_thb: number; name_th: string }> = {}
  try {
    const res = await fetch('http://127.0.0.1:8001/billing/prices', {
      headers: { 'Content-Type': 'application/json' },
    })
    if (res.ok) {
      const data = await res.json()
      for (const plan of data.plans as Array<{ plan_code: string; price_thb: number; name_th: string }>) {
        pricesData[plan.plan_code] = { price_thb: plan.price_thb, name_th: plan.name_th }
      }
    }
  } catch {
    // Use fallback
    pricesData = FALLBACK_PRICES as unknown as Record<string, { price_thb: number; name_th: string }>
  }

  const thFounder = pricesData['th_founder_monthly'] ?? FALLBACK_PRICES['th_founder_monthly']
  const thNormal = pricesData['th_plus_monthly'] ?? FALLBACK_PRICES['th_plus_monthly']
  const thYearly = pricesData['th_plus_yearly_promo'] ?? FALLBACK_PRICES['th_plus_yearly_promo']
  const epFounder = pricesData['ep_founder_monthly'] ?? FALLBACK_PRICES['ep_founder_monthly']
  const epNormal = pricesData['ep_plus_monthly'] ?? FALLBACK_PRICES['ep_plus_monthly']
  const epYearly = pricesData['ep_plus_yearly_promo'] ?? FALLBACK_PRICES['ep_plus_yearly_promo']

  const plusTHPlan: HomePricingPlan = {
    name: 'Plus TH',
    emoji: '⚡',
    priceDisplay: `${formatPrice(thFounder.price_thb)} บาท/เดือน`,
    originalPriceDisplay: `${formatPrice(thNormal.price_thb)} บาท/เดือน`,
    yearlyDisplay: `รายปี ${formatPrice(thYearly.price_thb)} บาท`,
    color: 'from-primary-400 to-primary-600',
    features: [
      'คณิตศาสตร์ภาษาไทย ป.1–ป.6',
      'บทเรียนทั้งหมด',
      'แบบทดสอบทุกระดับชั้น',
      'ระบบวิเคราะห์จุดอ่อน',
      'แบบฝึกเฉพาะบุคคล',
      'Quest รายวัน / รายสัปดาห์ / รายเดือน',
      'XP / Level / Rank',
      'Avatar และของตกแต่งพื้นฐาน',
    ],
    cta: 'สมัคร Plus TH',
    ctaHref: '/pricing?plan=th',
    highlight: true,
    badge: 'แนะนำ',
  }

  const plusEPPlan: HomePricingPlan = {
    name: 'Plus EP',
    emoji: '🌏',
    priceDisplay: `${formatPrice(epFounder.price_thb)} บาท/เดือน`,
    originalPriceDisplay: `${formatPrice(epNormal.price_thb)} บาท/เดือน`,
    yearlyDisplay: `รายปี ${formatPrice(epYearly.price_thb)} บาท`,
    color: 'from-accent-400 to-accent-600',
    features: [
      'ทุกอย่างใน Plus TH',
      'โหมด English Program',
      'โจทย์และบทเรียนคณิตเป็นภาษาอังกฤษ',
      'คำศัพท์คณิตศาสตร์อังกฤษ',
      'เหมาะกับเด็ก EP / Inter / สองภาษา',
      'ปลดล็อก TH + EP',
    ],
    cta: 'สมัคร Plus EP',
    ctaHref: '/pricing?plan=ep',
    highlight: false,
  }

  return [freePlan, plusTHPlan, plusEPPlan]
}

const TRUST_ITEMS = [
  { emoji: '🔒', title: 'ปลอดภัยสำหรับเด็ก', desc: 'ไม่มีโฆษณา ไม่มีเนื้อหาไม่เหมาะสม ออกแบบมาสำหรับเด็กโดยเฉพาะ' },
  { emoji: '📊', title: 'ผู้ปกครองติดตามได้', desc: 'ดูพัฒนาการลูกได้ตลอดเวลา รู้ว่าลูกเก่งเรื่องอะไร ต้องฝึกเพิ่มตรงไหน' },
  { emoji: '🚫', title: 'ไม่มีโฆษณาในบทเรียน', desc: 'เนื้อหาเรียนรู้สะอาดตา เด็กโฟกัสกับการเรียนได้เต็มที่' },
]

// ─── Components ─────────────────────────────────────────────────────────────

function StarRating({ stars }: { stars: number }) {
  return (
    <span className="text-amber-400">
      {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
    </span>
  )
}

function SectionWrapper({ children, className = '', id }: { children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`py-16 md:py-20 ${className}`}>
      <div className="max-w-6xl mx-auto px-4">{children}</div>
    </section>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-2xl">✨</span>
      <span className="text-sm font-bold text-primary-600 uppercase tracking-wider">{children}</span>
    </div>
  )
}

// ─── Home Pricing Section ──────────────────────────────────────────────────────

function HomePricingCard({ plan }: { plan: HomePricingPlan }) {
  return (
    <div
      className={`relative card flex flex-col ${
        plan.highlight ? 'ring-2 ring-accent-400 shadow-xl' : ''
      }`}
    >
      {/* Badge */}
      {plan.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-accent-400 to-accent-600 text-white text-xs font-bold px-4 py-1 rounded-full shadow">
          {plan.badge === 'Founder' ? '👑' : '✨'} {plan.badge}
        </div>
      )}

      {/* Icon */}
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${plan.color} flex items-center justify-center text-white text-lg font-extrabold mb-4 shadow-md`}>
        {plan.emoji}
      </div>

      {/* Name */}
      <h3 className="text-lg font-bold text-gray-900 mb-1">{plan.name}</h3>

      {/* Price */}
      <div className="mb-1">
        <span className="text-3xl font-extrabold text-gray-900">{plan.priceDisplay}</span>
      </div>
      {plan.originalPriceDisplay && (
        <div className="mb-1">
          <span className="text-sm text-gray-400 line-through">{plan.originalPriceDisplay}</span>
        </div>
      )}
      {plan.yearlyDisplay && (
        <div className="mb-4">
          <span className="text-sm text-accent-600 font-medium">{plan.yearlyDisplay}</span>
        </div>
      )}

      {/* Features */}
      <ul className="space-y-2 mb-6 flex-1">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
            <span className="text-primary-500 flex-shrink-0 mt-0.5">✓</span> {f}
          </li>
        ))}
      </ul>

      {/* CTA */}
      <Link
        href={plan.ctaHref}
        className={`block text-center font-bold py-3 rounded-xl transition-all mt-auto ${
          plan.highlight
            ? 'bg-accent-500 hover:bg-accent-600 text-white shadow-md hover:shadow-lg'
            : plan.name === 'ทดลองใช้ฟรี'
            ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            : 'bg-primary-50 hover:bg-primary-100 text-primary-700'
        }`}
      >
        {plan.cta}
      </Link>
    </div>
  )
}

function HomePricingSection() {
  const [plans, setPlans] = useState<HomePricingPlan[] | null>(null)

  useEffect(() => {
    fetchHomePricingPlans().then(setPlans)
  }, [])

  if (!plans) {
    // Skeleton
    return (
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card h-80 bg-gray-100 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {plans.map((plan) => (
        <HomePricingCard key={plan.name} plan={plan} />
      ))}
    </div>
  )
}

// ─── Grade Card ─────────────────────────────────────────────────────────────

function GradeCard({ grade }: { grade: typeof CURRICULUM[0] }) {
  return (
    <div className="card border-0 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200">
      {/* Header with gradient accent bar */}
      <div className={`h-1.5 bg-gradient-to-r ${grade.accentClass} rounded-t-xl`} />

      <div className="p-5">
        {/* Grade badge + status */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${grade.accentClass} flex items-center justify-center text-white text-lg font-extrabold shadow-md flex-shrink-0`}>
              ป.{grade.grade}
            </div>
            <div>
              <h3 className="font-bold text-gray-900 leading-tight">{grade.title}</h3>
              <p className="text-xs text-gray-400 mt-0.5">{grade.topicCount} หัวข้อหลัก</p>
            </div>
          </div>
          {/* Status badge */}
          <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${grade.statusColor}`}>
            <span>{grade.statusIcon}</span>
            {grade.statusLabel}
          </span>
        </div>

        {/* Description */}
        <p className="text-xs text-gray-500 leading-relaxed mb-4">{grade.description}</p>

        {/* Topic pills */}
        <div className="flex flex-wrap gap-1.5">
          {grade.topics.map((topic) => (
            <span key={topic} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">
              {topic}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background font-sans">

      {/* ── NAV ── */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-primary-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-gradient-to-br from-primary-400 to-primary-600 rounded-xl flex items-center justify-center shadow-md">
              <span className="text-white text-lg font-black">4</span>
            </div>
            <span className="text-xl font-extrabold text-gray-900">4-Craft</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-semibold text-gray-600 hover:text-primary-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-primary-50">
              เข้าสู่ระบบ
            </Link>
            <Link href="/register" className="text-sm font-bold text-white bg-primary-500 hover:bg-primary-600 px-5 py-2 rounded-xl shadow-md hover:shadow-lg transition-all">
              ทดลองฟรี
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-50 via-background to-accent-50 pt-12 pb-20">
        {/* Decorative blobs */}
        <div className="absolute top-10 left-10 w-64 h-64 bg-primary-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse-slow" />
        <div className="absolute bottom-10 right-10 w-72 h-72 bg-accent-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse-slow" />

        <div className="relative max-w-4xl mx-auto px-4 text-center">
          {/* Badge — updated to ป.1–ป.6 */}
          <div className="inline-flex items-center gap-2 bg-white border border-primary-200 rounded-full px-4 py-1.5 mb-8 shadow-sm">
            <span className="text-sm font-semibold text-primary-700">🎓 สำหรับเด็ก ป.1–ป.6</span>
            <span className="w-1.5 h-1.5 bg-primary-400 rounded-full" />
            <span className="text-sm font-medium text-gray-500">วิชาคณิตศาสตร์</span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
            เรียนเก่งขึ้นทุกวัน
            <br />
            <span className="bg-gradient-to-r from-primary-500 via-accent-500 to-secondary-500 bg-clip-text text-transparent">
              แบบสนุกเหมือนเล่นเกม
            </span>
          </h1>

          <p className="text-lg md:text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            ฝึกคณิตด้วยเควสสุดสนุก มีตัวละคร มีเลเวล และ AI ช่วยวิเคราะห์จุดอ่อน
          </p>

          {/* CTA buttons — updated per spec */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register" className="inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-bold text-lg px-8 py-4 rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all">
              <span>🚀</span> ทดลองใช้ฟรี 3 เควส
            </Link>
            <a href="#curriculum" className="inline-flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-700 font-bold text-lg px-8 py-4 rounded-2xl border-2 border-primary-200 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
              <span>📚</span> ดูหลักสูตร ป.1–ป.6
            </a>
            <Link href="/login" className="inline-flex items-center justify-center gap-2 bg-accent-500 hover:bg-accent-600 text-white font-bold text-lg px-8 py-4 rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all">
              <span>🔑</span> เข้าสู่ระบบ
            </Link>
          </div>

          {/* Social proof */}
          <p className="mt-8 text-sm text-gray-400">
            มีเด็กๆ กว่า 1,200 คนที่เควสไปแล้ว · คะแนนเฉลี่ย 4.8 ★
          </p>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <SectionWrapper className="bg-white">
        <div className="text-center mb-12">
          <SectionLabel>ระบบเลเวลแบบเกม</SectionLabel>
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900">
            เหมือนเล่นเกม แต่ได้ความรู้จริงๆ
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div key={f.title} className="card-hover text-left">
              <div className="text-4xl mb-3">{f.emoji}</div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </SectionWrapper>

      {/* ── CURRICULUM (6 GRADES) ── */}
      <SectionWrapper id="curriculum" className="bg-gradient-to-b from-primary-50 to-background">
        <div className="text-center mb-12">
          <SectionLabel>หลักสูตร</SectionLabel>
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900">
            ครบทุกระดับชั้น ป.1–ป.6
          </h2>
          <p className="text-gray-500 mt-3">เนื้อหาแน่น เข้าใจง่าย สอดคล้องกับหลักสูตรแกนกลาง (NETPA)</p>
        </div>

        {/* 6-card responsive grid: 3 cols desktop, 2 cols tablet, 1 col mobile */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {CURRICULUM.map((grade) => (
            <GradeCard key={grade.grade} grade={grade} />
          ))}
        </div>

        {/* Call to action below curriculum */}
        <div className="text-center mt-10">
          <p className="text-gray-500 text-sm mb-4">✨ ป.1–ป.3 เรียนได้ทันที · ป.4–ป.6 ฟรีสำหรับบททบทวน</p>
          <Link href="/register" className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-bold px-8 py-3 rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all">
            <span>🚀</span> เริ่มทดลองฟรี 3 เควส
          </Link>
        </div>
      </SectionWrapper>

      {/* ── HOW IT WORKS ── */}
      <SectionWrapper className="bg-white">
        <div className="text-center mb-12">
          <SectionLabel>วิธีใช้งาน</SectionLabel>
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900">
            เริ่มใช้งานง่ายๆ 3 ขั้นตอน
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { step: '1', emoji: '📝', title: 'ทดสอบวัดระดับ', desc: 'ทำแบบทดสอบสั้นๆ 5 นาที ระบบจะรู้ว่าตัวเองเก่งเรื่องอะไร ต้องฝึกเพิ่มตรงไหน' },
            { step: '2', emoji: '🎯', title: 'รับเควสเฉพาะตัว', desc: 'AI สร้างแบบฝึกที่เหมาะกับแต่ละคน เน้นจุดที่ต้องปรับปรุง' },
            { step: '3', emoji: '🏆', title: 'สะสม XP ขึ้นเลเวล', desc: 'ทำเควสรายวัน ต่อเนื่อง สะสมคะแนน เห็นพัฒนาการชัดเจน' },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="relative inline-block mb-4">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center text-3xl mx-auto shadow-md">
                  {item.emoji}
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary-500 text-white text-sm font-bold flex items-center justify-center shadow">
                  {item.step}
                </div>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </SectionWrapper>

      {/* ── PRICING ── */}
      <SectionWrapper className="bg-gradient-to-b from-background to-primary-50">
        <div className="text-center mb-12">
          <SectionLabel>ราคา</SectionLabel>
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900">
            เลือกแพ็กเกจการเรียนที่เหมาะกับลูกของคุณ
          </h2>
          <p className="text-gray-500 mt-2">เริ่มทดลองฟรี แล้วอัปเกรดเมื่อพร้อม ไม่มีสัญญาระยะยาว</p>
        </div>
        <HomePricingSection />
      </SectionWrapper>

      {/* ── TOP STUDENTS ── */}
      <SectionWrapper className="bg-white">
        <div className="text-center mb-12">
          <SectionLabel>นักเรียนยอดเยี่ยม</SectionLabel>
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900">
            เด็กๆ ที่เก่งขึ้นทุกวัน
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {TOP_STUDENTS.map((student, i) => (
            <div key={i} className="card text-center">
              <div className="relative inline-block mb-3">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-300 to-primary-500 flex items-center justify-center text-white text-2xl font-extrabold shadow-md mx-auto">
                  {student.nickname.charAt(0)}
                </div>
                <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-amber-400 rounded-full flex items-center justify-center text-sm shadow">
                  {student.badge}
                </div>
              </div>
              <h3 className="font-bold text-gray-900 mb-0.5">{student.nickname}</h3>
              <p className="text-xs text-gray-400 mb-3">{student.province}</p>
              <div className="flex items-center justify-center gap-4 mb-3">
                <div className="text-center">
                  <div className="text-lg font-extrabold text-primary-600">เลเวล {student.level}</div>
                  <div className="text-xs text-gray-400">ปัจจุบัน</div>
                </div>
                <div className="w-px h-8 bg-gray-200" />
                <div className="text-center">
                  <div className="text-lg font-extrabold text-green-600">{student.improvement}</div>
                  <div className="text-xs text-gray-400">พัฒนา</div>
                </div>
              </div>
              <div className="flex justify-center">
                <StarRating stars={Math.min(student.level - 5, 5)} />
              </div>
            </div>
          ))}
        </div>
      </SectionWrapper>

      {/* ── PARENT TRUST ── */}
      <SectionWrapper className="bg-gradient-to-b from-accent-50 to-background">
        <div className="text-center mb-12">
          <SectionLabel>สำหรับผู้ปกครอง</SectionLabel>
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900">
            ผู้ปกครองวางใจได้
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {TRUST_ITEMS.map((item) => (
            <div key={item.title} className="card text-center">
              <div className="text-5xl mb-4">{item.emoji}</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </SectionWrapper>

      {/* ── CTA BANNER ── */}
      <section className="bg-gradient-to-r from-primary-500 to-primary-600 py-16">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">
            พร้อมเริ่มต้นแล้วหรือยัง?
          </h2>
          <p className="text-primary-100 text-lg mb-8">
            ทดลองใช้ฟรี 3 เควส ไม่ต้องใช้บัตรเครดิต
          </p>
          <Link href="/register" className="inline-flex items-center gap-2 bg-white text-primary-600 font-extrabold text-lg px-10 py-4 rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all">
            🚀 เริ่มเลย
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
                  <span className="text-white text-sm font-black">4</span>
                </div>
                <span className="text-white font-bold text-lg">4-Craft</span>
              </div>
              {/* Updated footer description */}
              <p className="text-sm leading-relaxed">ระบบเรียนรู้คณิตศาสตร์แบบปรับตัวสำหรับเด็กไทย ป.1–ป.6 ด้วย AI</p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3">ผลิตภัณฑ์</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/#curriculum" className="hover:text-white transition-colors">หลักสูตร</Link></li>
                <li><Link href="/register" className="hover:text-white transition-colors">ทดลองใช้ฟรี</Link></li>
                <li><Link href="/register" className="hover:text-white transition-colors">ราคา</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3">บัญชี</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/login" className="hover:text-white transition-colors">เข้าสู่ระบบ</Link></li>
                <li><Link href="/register" className="hover:text-white transition-colors">สมัครสมาชิก</Link></li>
                <li><Link href="/dashboard" className="hover:text-white transition-colors">แดชบอร์ด</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3">ติดต่อ</h4>
              <ul className="space-y-2 text-sm">
                <li>📧 support@4-craft.com</li>
                <li>📱 02-xxx-xxxx</li>
                <li className="text-gray-600 text-xs mt-4">© 2025 4-Craft. สงวนลิขสิทธิ์.</li>
              </ul>
            </div>
          </div>
        </div>
      </footer>

    </div>
  )
}
