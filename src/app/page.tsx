'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Facebook,
  Instagram,
  Lock,
  Mail,
  MapPin,
  Menu,
  Music2,
  PlayCircle,
  ShieldCheck,
  Star,
  Target,
  Trophy,
  Users,
  X,
  Youtube,
  Zap,
} from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { fallbackHomepageConfig, type HomepageConfig } from '@/lib/topa-content'
import { resolveMascotImage } from '@/lib/mascot-registry'
import { TopaLogo } from '@/components/brand/TopaBrand'

const navItems = [
  { label: 'หลักสูตร', href: '#curriculum' },
  { label: 'อันดับ', href: '#ranking' },
  { label: 'รีวิว', href: '#reviews' },
  { label: 'สำหรับผู้ปกครอง', href: '#parents' },
  { label: 'ราคา', href: '/pricing' },
]

const featureCards = fallbackHomepageConfig.features.cards

// Feature cards are rendered as pre-composed PNGs (the artwork *contains* the
// Thai title + description), so each card needs its own matching asset.
//
// NOTE: the previous fallback '/brand/topa/feature-reference/feature-card-default.png'
// did not exist on disk → every feature card without a CMS image rendered a
// broken image. These are the four real, shipped card assets, keyed by the
// title that the artwork itself displays.
const FEATURE_CARD_IMAGES: Record<string, string> = {
  'AI วิเคราะห์จุดอ่อน': '/brand/topa/feature-reference/feature-card-ai-clean-v3.png',
  'แบบฝึกหลากหลาย': '/brand/topa/feature-reference/feature-card-practice-clean-v3.png',
  'ฝึกจริง เห็นผลจริง': '/brand/topa/feature-reference/feature-card-xp-clean-v3.png',
  'Ranking ทั่วประเทศ': '/brand/topa/feature-reference/feature-card-ranking-clean-v3.png',
}
const DEFAULT_FEATURE_CARD_IMAGE = '/brand/topa/feature-reference/feature-card-ai-clean-v3.png'

function featureCardImage(title: string, explicit?: string) {
  if (explicit) return explicit
  return FEATURE_CARD_IMAGES[title] ?? DEFAULT_FEATURE_CARD_IMAGE
}

const provinceRows = fallbackHomepageConfig.ranking.rows
const districtRows = fallbackHomepageConfig.ranking.rows

const friends = fallbackHomepageConfig.mascots.cards.map((mascot, index) => ({
  name: mascot.name,
  role: mascot.role,
  image: mascot.image,
  containerClassName: '',
  imageClassName: 'max-h-[122px]',
  _idx: index,
}))

const grades = fallbackHomepageConfig.curriculum.cards.map((card, index) => ({
  grade: card.title,
  text: card.text,
  active: card.enabled !== false,
  _idx: index,
}))

const trustCards = fallbackHomepageConfig.parent_trust.cards.map((card) => ({
  title: card.title,
  text: card.text,
  icon: ShieldCheck,
  color: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
}))

function isCleanText(value?: string) {
  if (!value || typeof value !== 'string') return false
  const text = value.trim()
  if (!text) return false
  return !/[à�]{2,}|\?{3,}/.test(text)
}

function cleanText(value: string | undefined, fallback: string) {
  return isCleanText(value) ? value!.trim() : fallback
}

function assetOrFallback(value: string | undefined, fallback: string) {
  if (!value || typeof value !== 'string') return fallback
  if (value.includes('..') || value.includes('\\')) return fallback
  return value
}

function TopaImage({
  src,
  fallback,
  alt,
  className,
}: {
  src: string
  fallback: string
  alt: string
  className: string
}) {
  const [broken, setBroken] = useState(false)
  // If src and fallback are identical, swapping them changes nothing — avoid
  // an onError loop (feature cards pass the same path for both).
  const effectiveSrc = broken && fallback !== src ? fallback : src
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={effectiveSrc} alt={alt} className={className} onError={() => setBroken(true)} />
  )
}

function Medal({ rank }: { rank: number }) {
  const colors = rank === 1 ? 'bg-amber-400 text-white' : rank === 2 ? 'bg-slate-300 text-white' : rank === 3 ? 'bg-orange-400 text-white' : 'bg-white text-slate-700'
  return <span className={`grid h-8 w-8 place-items-center rounded-full text-sm font-black shadow-sm ${colors}`}>{rank}</span>
}

function RankingTable({
  title,
  rows,
  link,
}: {
  title: string
  rows: Array<{
    rank: number
    name?: string
    child_name?: string
    attempts?: string | number
    tests_completed?: number
    score?: string | number
    total_score?: number
    avg_speed?: string
    mascot?: string
    image?: string
  }>
  link: string
}) {
  return (
    <div className="overflow-hidden rounded-[24px] border border-blue-100 bg-white shadow-[0_14px_30px_rgba(24,97,199,0.09)]">
      <div className="bg-gradient-to-r from-[#0B63D8] to-[#7657E8] px-5 py-4 text-center text-xl font-black text-white">
        {title}
      </div>
      <div className="grid grid-cols-[64px_1fr_104px_104px] gap-2 border-b border-slate-100 bg-slate-50/70 px-5 py-3.5 text-xs font-bold text-slate-500 max-sm:grid-cols-[48px_1fr_70px_76px]">
        <span>อันดับ</span>
        <span>จังหวัด/เขต</span>
        <span className="text-right">จำนวนข้อสอบ</span>
        <span className="text-right">คะแนนรวม</span>
      </div>
      {rows.map((row) => (
        <div
          key={`${title}-${row.rank}`}
          className="grid grid-cols-[64px_1fr_104px_104px] items-center gap-2 border-b border-slate-100 px-5 py-4 text-base last:border-b-0 max-sm:grid-cols-[48px_1fr_70px_76px]"
        >
          <Medal rank={row.rank} />
          <div className="flex items-center gap-2 font-bold text-slate-800">
            <TopaImage
              src={row.image ? assetOrFallback(row.image, resolveMascotImage(row.mascot)) : resolveMascotImage(row.mascot)}
              fallback={resolveMascotImage(row.mascot)}
              alt=""
              className="h-9 w-9 object-contain"
            />
            <span className="truncate">{row.child_name ?? row.name ?? ''}</span>
          </div>
          <span className="text-right font-semibold text-slate-600">
            {(row.tests_completed ?? Number(row.attempts ?? 0)).toLocaleString('th-TH')}
          </span>
          <span className="text-right font-extrabold text-slate-800">
            {(row.total_score ?? Number(row.score ?? 0)).toLocaleString('th-TH')}
          </span>
        </div>
      ))}
      <Link href={link} className="flex items-center justify-center gap-2 bg-blue-50/40 px-4 py-3.5 text-sm font-black text-blue-600 hover:text-blue-700">
        ดูอันดับทั้งหมด <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}

export default function HomePage() {
  const [cms, setCms] = useState<HomepageConfig | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    let mounted = true
    apiClient
      .get<HomepageConfig>('/site/homepage')
      .then((response) => {
        if (mounted) setCms(response.data)
      })
      .catch(() => {
        if (mounted) setCms(null)
      })
    return () => {
      mounted = false
    }
  }, [])

  // Build live data from CMS or fall back to safe defaults
  const hero = {
    headline: cleanText(cms?.hero?.headline, fallbackHomepageConfig.hero.headline),
    subheadline: cleanText(cms?.hero?.subheadline, fallbackHomepageConfig.hero.subheadline),
    primary_cta_text: cleanText(cms?.hero?.primary_cta_text, fallbackHomepageConfig.hero.primary_cta_text),
    primary_cta_link: cleanText(cms?.hero?.primary_cta_link, fallbackHomepageConfig.hero.primary_cta_link),
    secondary_cta_text: cleanText(cms?.hero?.secondary_cta_text, fallbackHomepageConfig.hero.secondary_cta_text),
    secondary_cta_link: cleanText(cms?.hero?.secondary_cta_link, fallbackHomepageConfig.hero.secondary_cta_link),
    mascot_group_image: assetOrFallback(cms?.hero?.mascot_group_image, fallbackHomepageConfig.hero.mascot_group_image),
  }
  const rankingIntro = {
    title: cleanText(cms?.ranking?.title, fallbackHomepageConfig.ranking.title),
    subtitle: cleanText(cms?.ranking?.subtitle, fallbackHomepageConfig.ranking.subtitle || 'จัดอันดับเก่งเลขทั่วไทย'),
    description: cleanText(cms?.ranking?.description, fallbackHomepageConfig.ranking.description),
    promo_text: cleanText(cms?.ranking?.promo_text, fallbackHomepageConfig.ranking.promo_text || 'แข่งขันสนุก\nกระตุ้นให้เด็ก\nอยากฝึกทุกวัน'),
    promo_image: assetOrFallback(cms?.ranking?.promo_image, fallbackHomepageConfig.ranking.promo_image || '/brand/topa/ranking-promo-action.png'),
  }
  // Live feature cards (CMS → fallback)
  const liveFeatureCards = (cms?.features?.cards && cms.features.cards.length > 0
    ? cms.features.cards
    : fallbackHomepageConfig.features.cards
  )
    .filter((c) => c.enabled !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((c) => ({
      title: c.title,
      image: featureCardImage(c.title, c.image),
    }))

  // Live ranking rows (CMS → fallback). Both sources use TopaRankingRow schema;
  // CMS may include an extra `image` field, which we forward as-is.
  const liveProvinceRows = (cms?.ranking?.rows && cms.ranking.rows.length > 0
    ? cms.ranking.rows
    : fallbackHomepageConfig.ranking.rows
  )
  const liveDistrictRows = liveProvinceRows

  // Live mascot friends (CMS → fallback)
  const liveFriends = (cms?.mascots?.cards && cms.mascots.cards.length > 0
    ? cms.mascots.cards
    : fallbackHomepageConfig.mascots.cards
  )
    .filter((m) => m.enabled !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((m, index) => ({
      name: m.name,
      role: m.role,
      image: m.image,
      containerClassName: '',
      imageClassName: index === 3 ? 'max-h-[126px]' : index === 4 ? 'max-h-[124px]' : 'max-h-[122px]',
    }))

  // Live curriculum grades (CMS → fallback)
  // Live curriculum grades — CMS uses {grade, title, description, status, button_text, order, enabled}
  // which extends the TopaSimpleCard schema with optional fields.
  const liveGrades = (cms?.curriculum?.cards && cms.curriculum.cards.length > 0
    ? cms.curriculum.cards
    : fallbackHomepageConfig.curriculum.cards
  )
    .filter((g) => g.enabled !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((g) => ({
      grade: g.grade ?? g.title,
      text: g.description ?? g.text,
      active: g.status !== 'inactive',
    }))

  // Live trust cards (CMS → fallback) — same schema as curriculum.
  const liveTrustCards = (cms?.parent_trust?.cards && cms.parent_trust.cards.length > 0
    ? cms.parent_trust.cards
    : fallbackHomepageConfig.parent_trust.cards
  )
    .filter((t) => t.enabled !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((t) => ({
      title: t.title,
      text: t.description ?? t.text,
      icon: ShieldCheck,
      color: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    }))

  const reviewCards = (cms?.reviews?.cards || [])
    .filter((review) => review.enabled !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((review, index) => {
      const fallback = fallbackHomepageConfig.reviews.cards[index % fallbackHomepageConfig.reviews.cards.length] || fallbackHomepageConfig.reviews.cards[0]
      return {
        name: cleanText(review.name, fallback.name),
        grade_label: cleanText(review.grade_label || review.grade, fallback.grade_label || ''),
        province: cleanText(review.province, fallback.province || ''),
        quote: cleanText(review.quote, fallback.quote),
        rating: Math.max(1, Math.min(5, Number(review.rating) || 5)),
        image_path: assetOrFallback(review.image_path || review.image, fallback.image_path),
      }
    })
  const visibleReviews = reviewCards.length ? reviewCards : fallbackHomepageConfig.reviews.cards.map((r) => ({
    name: r.name,
    grade_label: r.grade_label,
    province: r.province,
    quote: r.quote,
    rating: r.rating,
    image_path: r.image_path,
  }))

  return (
    <main className="min-h-screen bg-[#f7fbff] text-slate-900">
      <nav className="sticky top-0 z-50 border-b border-blue-100/70 bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-[70px] max-w-[1480px] items-center justify-between px-6 py-3 lg:px-8">
          <Link href="/" aria-label="TOPA Math homepage">
            <TopaLogo size="sm" />
          </Link>
          <div className="hidden items-center gap-12 text-[15px] font-bold text-slate-800 lg:flex">
            {navItems.map((item) => (
              <Link key={item.label} href={item.href} className="transition hover:text-blue-600">
                {item.label}
              </Link>
            ))}
          </div>
          <div className="hidden items-center gap-3 lg:flex">
            <Link href="/login" className="rounded-xl border border-blue-500 px-6 py-2.5 text-sm font-black text-blue-700 shadow-sm transition hover:bg-blue-50">
              เข้าสู่ระบบ
            </Link>
            <Link href="/register" className="rounded-xl bg-[#FFC107] px-6 py-2.5 text-sm font-black text-slate-950 shadow-[0_8px_18px_rgba(245,158,11,0.28)] transition hover:bg-[#FFD43B]">
              ทดลองใช้ฟรี
            </Link>
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            className="grid h-10 w-10 place-items-center rounded-xl border border-blue-100 bg-white text-blue-700 lg:hidden"
            aria-label="Open navigation"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {menuOpen && (
          <div className="border-t border-blue-100 bg-white px-4 py-4 lg:hidden">
            <div className="mx-auto grid max-w-[1480px] gap-3">
              {navItems.map((item) => (
                <Link key={item.label} href={item.href} className="rounded-xl px-3 py-2 font-bold text-slate-800 hover:bg-blue-50" onClick={() => setMenuOpen(false)}>
                  {item.label}
                </Link>
              ))}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <Link href="/login" className="rounded-xl border border-blue-500 px-4 py-2.5 text-center font-black text-blue-700">
                  เข้าสู่ระบบ
                </Link>
                <Link href="/register" className="rounded-xl bg-amber-400 px-4 py-2.5 text-center font-black text-slate-950">
                  ทดลองใช้ฟรี
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      <section className="relative overflow-hidden bg-white">
        <div className="absolute left-[47%] top-16 hidden text-6xl font-black text-sky-400 lg:block">+</div>
        <div className="absolute right-[5%] top-24 hidden text-4xl font-black text-amber-400 lg:block">÷</div>
        <div className="absolute left-[52%] top-24 hidden -rotate-12 text-6xl font-black text-amber-400 lg:block">7</div>
        <div className="absolute right-[2%] top-48 hidden rotate-12 text-4xl font-black text-sky-300 lg:block">?</div>
        <div className="mx-auto grid max-w-[1480px] items-center gap-2 px-6 pb-4 pt-10 lg:grid-cols-[0.82fr_1.18fr] lg:px-8 lg:pt-12">
          <div>
            <h1 className="whitespace-pre-line text-[44px] font-black leading-[1.04] tracking-normal text-[#0B63D8] sm:text-6xl lg:text-[64px]">
              {hero.headline}
            </h1>
            <p className="mt-5 max-w-[560px] whitespace-pre-line text-[18px] font-semibold leading-8 text-slate-600">
              {hero.subheadline}
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href={hero.primary_cta_link} className="inline-flex min-w-[245px] items-center justify-center gap-2 rounded-xl bg-[#0B63D8] px-8 py-4 text-lg font-black text-white shadow-[0_14px_28px_rgba(37,99,235,0.28)] transition hover:bg-[#0754b8]">
                {hero.primary_cta_text}
                <PlayCircle className="h-5 w-5" />
              </Link>
              <Link href={hero.secondary_cta_link} className="inline-flex min-w-[220px] items-center justify-center gap-2 rounded-xl border border-blue-300 bg-white px-7 py-4 text-lg font-black text-[#0B63D8] shadow-sm transition hover:bg-blue-50">
                <Trophy className="h-5 w-5 text-amber-500" />
                {hero.secondary_cta_text}
              </Link>
            </div>
            <div className="mt-7 grid max-w-[650px] grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-blue-100 bg-white px-5 py-3.5 shadow-[0_10px_22px_rgba(24,97,199,0.08)]">
                <Users className="mb-1 h-6 w-6 text-amber-500" />
                <p className="text-xs font-bold text-slate-500">นักเรียน</p>
                <p className="text-lg font-black text-blue-700">1,200+ คน</p>
              </div>
              <div className="rounded-xl border border-blue-100 bg-white px-5 py-3.5 shadow-[0_10px_22px_rgba(24,97,199,0.08)]">
                <Star className="mb-1 h-6 w-6 fill-amber-400 text-amber-400" />
                <p className="text-xs font-bold text-slate-500">คะแนนเฉลี่ย</p>
                <p className="text-lg font-black text-blue-700">4.8/5</p>
              </div>
              <div className="rounded-xl border border-blue-100 bg-white px-5 py-3.5 shadow-[0_10px_22px_rgba(24,97,199,0.08)]">
                <Target className="mb-1 h-6 w-6 text-blue-600" />
                <p className="text-xs font-bold text-slate-500">ระดับความสำเร็จ</p>
                <p className="text-lg font-black text-blue-700">ยอดเยี่ยม</p>
              </div>
            </div>
          </div>
          <div className="relative flex min-h-[340px] items-center justify-center lg:min-h-[430px]">
            <TopaImage
              src={hero.mascot_group_image}
              fallback="/brand/topa/homepage-hero-cover-transparent.png"
              alt="กลุ่มมาสคอต TOPA Math"
              className="h-auto max-h-[430px] w-full max-w-[751px] object-contain drop-shadow-[0_18px_28px_rgba(37,99,235,0.12)]"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1480px] grid-cols-1 gap-5 px-6 py-5 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
        {liveFeatureCards.map((card) => (
          <article key={card.title} className="overflow-hidden rounded-[24px] bg-transparent">
            <TopaImage
              src={card.image}
              fallback={featureCardImage(card.title)}
              alt={card.title}
              className="h-auto w-full rounded-[24px] object-contain"
            />
          </article>
        ))}
      </section>

      <section id="ranking" className="mx-auto max-w-[1480px] px-6 py-5 lg:px-8">
        <div className="rounded-[32px] border border-blue-100 bg-[#F8FBFF] p-5 shadow-[0_16px_38px_rgba(24,97,199,0.08)] sm:p-7">
          <div className="grid gap-7 lg:grid-cols-[0.82fr_1fr_1fr] lg:items-stretch">
            <div className="flex min-w-0 flex-col">
              <div className="relative pr-10">
                <p className="text-[clamp(2.35rem,3vw,3rem)] font-black leading-[1.04] tracking-[-0.04em] text-[#0B63D8]">{rankingIntro.title}</p>
                <Trophy className="absolute right-0 top-1 h-8 w-8 rotate-12 fill-amber-300 text-amber-500 sm:h-10 sm:w-10" />
                <h2 className="mt-2 text-[clamp(1.75rem,2.2vw,2.2rem)] font-black leading-[1.12] tracking-[-0.035em] text-slate-950">{rankingIntro.subtitle}</h2>
              </div>

              <div className="mt-7 flex items-start gap-3 rounded-[20px] border border-amber-100 bg-[#FFF9F2] px-5 py-4 text-base font-semibold leading-7 text-slate-600 shadow-[0_8px_18px_rgba(245,158,11,0.05)]">
                <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-amber-400 text-white">
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                </span>
                <p className="whitespace-pre-line">{rankingIntro.description}</p>
              </div>

              <div className="relative mt-5 min-h-[190px] flex-1 overflow-hidden rounded-[24px] border border-amber-100 bg-gradient-to-br from-[#FFFDF7] via-[#FFF8E8] to-[#FFF5D6] px-5 py-5 shadow-[0_10px_24px_rgba(245,158,11,0.06)] sm:min-h-[210px]">
                <div className="relative z-10 max-w-[48%]">
                  <p className="whitespace-pre-line text-[clamp(1.35rem,1.7vw,1.6rem)] font-black leading-[1.55] tracking-[-0.02em] text-[#0B63D8]">{rankingIntro.promo_text}</p>
                </div>
                <div className="absolute bottom-0 right-0 flex h-full w-[62%] items-end justify-end bg-transparent">
                  <TopaImage
                    src={rankingIntro.promo_image}
                    fallback="/brand/topa/ranking-promo-action.png"
                    alt="TOPA ranking action mascot holding a trophy"
                    className="max-h-full max-w-full object-contain object-bottom object-right"
                  />
                </div>
              </div>
            </div>
            <RankingTable title="อันดับรายจังหวัด" rows={liveProvinceRows} link="/ranking?scope=province" />
            <RankingTable title="อันดับรายเขต" rows={liveDistrictRows} link="/ranking?scope=district" />
          </div>
        </div>
      </section>

      <section id="reviews" className="mx-auto max-w-[1480px] px-6 py-5 lg:px-8">
        <div className="mb-6 text-left">
          <h2 className="text-5xl font-black text-[#0B63D8]">รีวิวจากเด็กที่ใช้งานจริง</h2>
          <p className="mt-2 text-lg font-semibold text-slate-600">มั่นใจขึ้น สนุกกับการเรียน และเก่งเลขได้จริง!</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {visibleReviews.map((review) => (
            <article key={review.name} className="min-h-[250px] rounded-2xl border border-blue-100 bg-white p-6 shadow-[0_12px_28px_rgba(24,97,199,0.08)]">
              <div className="flex items-start gap-4">
                <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full border-4 border-white bg-blue-50 shadow-md ring-1 ring-blue-100">
                  <TopaImage
                    src={review.image_path}
                    fallback="/brand/topa/reviews/review-child-1.png"
                    alt={`รูปรีวิวของ ${review.name}`}
                    className="h-full w-full object-cover object-center"
                  />
                </div>
                <div className="min-w-0 pt-1">
                  <div className="flex gap-0.5 text-amber-400">
                    {Array.from({ length: review.rating }).map((_, index) => (
                      <Star key={index} className="h-4 w-4 fill-current" />
                    ))}
                  </div>
                  <p className="mt-1 text-lg font-black text-slate-900">{review.name}</p>
                  <p className="text-sm font-semibold text-slate-500">{review.grade_label} {review.province}</p>
                </div>
              </div>
              <p className="mt-4 text-[15px] font-semibold leading-7 text-slate-600">“{review.quote}”</p>
              <p className="mt-2 text-right text-5xl font-black leading-none text-blue-100">”</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1480px] px-6 py-5 lg:px-8">
        <div className="relative overflow-hidden rounded-[24px] border border-[#B7DDFB] bg-[linear-gradient(90deg,#EAF7FF_0%,#F8FCFF_48%,#EAF7FF_100%)] px-5 pb-4 pt-1 shadow-[0_10px_30px_rgba(37,99,235,0.10)] sm:px-8">
          <div className="pointer-events-none absolute inset-0 opacity-70">
            <div className="absolute left-9 top-[58px] text-4xl font-black text-sky-300/75">+</div>
            <div className="absolute left-[17%] top-[42px] text-3xl font-black text-amber-300/85">÷</div>
            <div className="absolute left-[31%] bottom-[42px] text-3xl font-black text-sky-400/65">+</div>
            <div className="absolute left-[49%] top-[58px] text-3xl font-black text-sky-300/75">C</div>
            <div className="absolute right-[23%] bottom-[45px] text-4xl font-black text-violet-300/75">3</div>
            <div className="absolute right-11 top-[44px] text-4xl font-black text-amber-300/85">×</div>
          </div>
          <h2 className="relative mb-0 text-left text-2xl font-black leading-tight text-[#0B63D8] sm:text-[28px]">เพื่อนช่วยเรียนของ TOPA</h2>
          <div className="relative mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:gap-0">
            {liveFriends.map((friend) => (
              <article
                key={friend.name}
                className={`relative flex min-h-[150px] flex-col items-center justify-end px-2 pb-0 pt-0 text-center lg:[&:not(:last-child)]:border-r lg:[&:not(:last-child)]:border-blue-200/65 ${friend.containerClassName}`}
              >
                <div className="flex h-[102px] w-full items-end justify-center">
                  <TopaImage
                    src={friend.image}
                    fallback="/brand/topa/mascot-topa-feature.png"
                    alt={friend.name}
                    className={`w-full max-w-[156px] object-contain ${friend.imageClassName}`}
                  />
                </div>
                <div className="relative flex min-h-[44px] w-full max-w-[188px] items-center justify-center rounded-[18px] border border-white/85 bg-white/80 px-3 py-1.5 shadow-[0_5px_16px_rgba(37,99,235,0.09)] backdrop-blur">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black leading-none text-blue-200/70">✣</span>
                  <div className="min-w-0 pl-4">
                    <p className="text-[13px] font-black leading-none text-[#0B63D8]">{friend.name}</p>
                    <p className="mt-1 text-[10px] font-bold leading-[14px] text-slate-600">{friend.role}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="curriculum" className="mx-auto max-w-[1480px] px-6 py-5 lg:px-8">
        <div className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-4xl font-black text-[#0B63D8]">จัดเต็มหลักสูตร ป.1-ป.6</h2>
          <div className="grid gap-5 md:grid-cols-3 lg:grid-cols-6">
            {liveGrades.map((item, index) => (
              <article
                key={item.grade}
                className={`min-h-[170px] rounded-2xl border p-5 ${item.active ? 'border-blue-200 bg-white shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-400'}`}
              >
                <div className="flex items-center gap-2">
                  {item.active ? (
                    index === 2 ? <Zap className="h-6 w-6 text-emerald-500" /> : <BookOpen className="h-6 w-6 text-sky-500" />
                  ) : (
                    <Lock className="h-6 w-6 text-slate-400" />
                  )}
                  <p className={`text-4xl font-black ${item.active ? (index === 2 ? 'text-emerald-600' : 'text-blue-700') : 'text-slate-500'}`}>{item.grade}</p>
                </div>
                <p className="mt-3 min-h-[54px] text-sm font-semibold leading-6">{item.text}</p>
                <Link
                  href={item.active ? `/lessons?grade=${index + 1}` : '#pricing'}
                  className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-black ${
                    item.active ? 'bg-blue-50 text-blue-700 hover:bg-blue-100' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {item.active ? 'เริ่มเรียนเลย' : 'เร็ว ๆ นี้'}
                  {item.active && <ArrowRight className="h-4 w-4" />}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="parents" className="mx-auto max-w-[1480px] px-6 py-5 lg:px-8">
        <h2 className="mb-5 text-4xl font-black text-[#0B63D8]">ผู้ปกครองวางใจได้</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {liveTrustCards.map((card) => {
            const Icon = card.icon
            return (
              <article key={card.title} className={`min-h-[125px] rounded-2xl p-6 shadow-sm ring-1 ${card.color}`}>
                <div className="flex items-center gap-4">
                  <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/80 shadow-sm">
                    <Icon className="h-9 w-9" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black">{card.title}</h3>
                    <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{card.text}</p>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className="mx-auto max-w-[1480px] px-6 py-5 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0B63D8] via-[#1E73E8] to-[#0A86E8] px-8 py-8 text-white shadow-[0_18px_40px_rgba(37,99,235,0.30)] md:px-14">
          <div className="absolute left-7 top-6 text-4xl font-black text-sky-300/70">×</div>
          <div className="absolute right-60 top-6 text-4xl font-black text-sky-300/70">+</div>
          <div className="max-w-3xl pl-20 max-md:pl-0">
            <h2 className="text-4xl font-black md:text-5xl">เริ่มให้ลูกเก่งเลขอย่างมั่นใจวันนี้</h2>
            <p className="mt-2 text-lg font-bold text-blue-50">ทดลองฟรี 3 เควส ไม่ต้องใช้บัตรเครดิต</p>
          </div>
          <Link href="/register" className="mt-6 inline-flex w-full max-w-full items-center justify-center gap-3 rounded-xl bg-[#FFC107] px-6 py-4 text-xl font-black text-slate-950 shadow-lg transition hover:bg-[#FFD43B] sm:min-w-[310px] md:absolute md:left-[56%] md:top-1/2 md:mt-0 md:w-auto md:-translate-y-1/2 md:px-12">
            ทดลองใช้ฟรี <ArrowRight className="h-5 w-5" />
          </Link>
          <TopaImage
            src="/brand/topa/mascot-topa-transparent.png"
            fallback="/brand/topa/mascot-topa-feature.png"
            alt="TOPA mascot"
            className="absolute right-10 top-1/2 hidden h-[136px] w-[136px] -translate-y-1/2 object-contain md:block"
          />
        </div>
      </section>

      <footer className="mt-6 bg-slate-950 text-white">
        <div className="mx-auto grid max-w-[1480px] gap-10 px-6 py-9 md:grid-cols-[1.2fr_1fr_1fr_1fr_1fr] lg:px-8">
          <div>
            <TopaLogo />
            <p className="mt-3 max-w-xs text-sm font-semibold leading-6 text-slate-300">เรียนเลขให้สนุก เก่งขึ้นทุกวันกับ TOPA Math</p>
          </div>
          <div>
            <h3 className="font-black">เมนูหลัก</h3>
            <div className="mt-3 grid gap-2 text-sm text-slate-300">
              <Link href="#curriculum">หลักสูตร</Link>
              <Link href="#ranking">อันดับ</Link>
              <Link href="#reviews">รีวิว</Link>
              <Link href="#parents">สำหรับผู้ปกครอง</Link>
              <Link href="/pricing">ราคา</Link>
            </div>
          </div>
          <div>
            <h3 className="font-black">เกี่ยวกับเรา</h3>
            <div className="mt-3 grid gap-2 text-sm text-slate-300">
              <Link href="/about">เกี่ยวกับ TOPA Math</Link>
              <Link href="/privacy">นโยบาย</Link>
              <Link href="/terms">เงื่อนไข</Link>
              <Link href="/help">คำถามที่พบบ่อย</Link>
            </div>
          </div>
          <div>
            <h3 className="font-black">ติดต่อ</h3>
            <div className="mt-3 grid gap-2 text-sm text-slate-300">
              <span className="inline-flex items-center gap-2"><Mail className="h-4 w-4" /> support [at] topamath.co.th</span>
              <span>โทร. 02-123-4567</span>
              <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4" /> จันทร์-ศุกร์ 09:00-18:00</span>
            </div>
          </div>
          <div>
            <h3 className="font-black">ติดตามเรา</h3>
            <div className="mt-4 flex gap-3">
              {[Facebook, Instagram, Youtube, Music2].map((Icon, index) => (
                <span key={index} className="grid h-10 w-10 place-items-center rounded-full bg-blue-600 text-white">
                  <Icon className="h-5 w-5" />
                </span>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}
