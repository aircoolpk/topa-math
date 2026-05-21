'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Facebook, Instagram, Menu, Music2, Play, Star, X } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { fallbackHomepageConfig, type HomepageConfig, type TopaRankingRow } from '@/lib/topa-content'
import { MascotAvatar, MascotCard, SectionHeader, StatCard, TopaButton, TopaCard, TopaIcon } from '@/components/topa/TopaUI'
import { getMascot, mascotRegistry, resolveMascotKey } from '@/lib/mascot-registry'

const gradeTabs = ['ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6']
const rankingModes = ['country', 'province'] as const
type RankingMode = typeof rankingModes[number]
const featureMascotKeys = ['topa', 'pip', 'timo', 'riko']

function enabled<T extends { enabled?: boolean; order?: number }>(items: T[] = []) {
  return items.filter((item) => item.enabled !== false).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

function fallbackChildPhoto(seed: string, index = 0) {
  const colors = ['#fef3c7', '#dbeafe', '#fee2e2', '#dcfce7', '#f3e8ff']
  const accents = ['#f59e0b', '#0ea5e9', '#ef4444', '#22c55e', '#a855f7']
  const initial = encodeURIComponent((seed || 'T').slice(0, 1))
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" rx="42" fill="${colors[index % colors.length]}"/><circle cx="80" cy="66" r="34" fill="${accents[index % accents.length]}"/><path d="M30 148c9-36 30-54 50-54s41 18 50 54" fill="#fff"/><circle cx="68" cy="62" r="5" fill="#111827"/><circle cx="92" cy="62" r="5" fill="#111827"/><path d="M66 78c10 8 18 8 28 0" stroke="#111827" stroke-width="5" stroke-linecap="round" fill="none"/><text x="80" y="140" text-anchor="middle" font-family="Arial,sans-serif" font-size="28" font-weight="900" fill="${accents[index % accents.length]}">${initial}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

function SafeCmsImage({ src, alt, className, fallbackSeed, index = 0 }: { src?: string; alt: string; className: string; fallbackSeed: string; index?: number }) {
  const [broken, setBroken] = useState(false)
  const resolved = !broken && src ? src : fallbackChildPhoto(fallbackSeed, index)
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={resolved} alt={alt} className={className} onError={() => setBroken(true)} />
  )
}

function TopaLogo({ className = '' }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/topa/topa-math-logo.png"
      alt="TOPA Math"
      className={`h-9 w-auto object-contain ${className}`}
    />
  )
}

function normalizeHomepageConfig(config: HomepageConfig): HomepageConfig {
  const incomingMascots = config.mascots?.cards || []
  const mascotCards = mascotRegistry.map((registry, index) => {
    const existing = incomingMascots.find((item) => resolveMascotKey(item.key || item.name) === registry.key)
    return {
      key: registry.key,
      name: existing?.name || registry.name,
      role: existing?.role || registry.role,
      english_role: existing?.english_role || registry.english_role,
      description_th: existing?.description_th || registry.description_th,
      image: existing?.image || registry.image,
      order: existing?.order || index + 1,
      enabled: existing?.enabled !== false,
    }
  })
  return {
    ...fallbackHomepageConfig,
    ...config,
    hero: { ...fallbackHomepageConfig.hero, ...config.hero },
    ranking: { ...fallbackHomepageConfig.ranking, ...config.ranking },
    reviews: { ...fallbackHomepageConfig.reviews, ...config.reviews },
    mascots: { ...fallbackHomepageConfig.mascots, ...config.mascots, cards: mascotCards },
  }
}

const polishedRankingRows: Array<TopaRankingRow & { grade: string; mode: RankingMode; image?: string }> = [
  { grade: 'ป.1', mode: 'country', rank: 1, child_name: 'น้องมีนา', province: 'กรุงเทพมหานคร', tests_completed: 42, total_score: 3180, avg_speed: '31 วิ/ข้อ', mascot: 'topa' },
  { grade: 'ป.1', mode: 'country', rank: 2, child_name: 'น้องอุ่นใจ', province: 'เชียงใหม่', tests_completed: 39, total_score: 3040, avg_speed: '34 วิ/ข้อ', mascot: 'pip' },
  { grade: 'ป.1', mode: 'country', rank: 3, child_name: 'น้องภูริ', province: 'สงขลา', tests_completed: 36, total_score: 2910, avg_speed: '36 วิ/ข้อ', mascot: 'memo' },
  { grade: 'ป.2', mode: 'country', rank: 1, child_name: 'น้องต้นน้ำ', province: 'ขอนแก่น', tests_completed: 48, total_score: 3760, avg_speed: '29 วิ/ข้อ', mascot: 'olli' },
  { grade: 'ป.2', mode: 'country', rank: 2, child_name: 'น้องแพรว', province: 'ชลบุรี', tests_completed: 45, total_score: 3610, avg_speed: '32 วิ/ข้อ', mascot: 'splash' },
  { grade: 'ป.2', mode: 'country', rank: 3, child_name: 'น้องภาม', province: 'กรุงเทพมหานคร', tests_completed: 43, total_score: 3490, avg_speed: '33 วิ/ข้อ', mascot: 'orbit' },
  { grade: 'ป.3', mode: 'country', rank: 1, child_name: 'น้องไออุ่น', province: 'เชียงใหม่', tests_completed: 52, total_score: 4210, avg_speed: '28 วิ/ข้อ', mascot: 'nova' },
  { grade: 'ป.3', mode: 'country', rank: 2, child_name: 'น้องเจ้านาย', province: 'สงขลา', tests_completed: 49, total_score: 4075, avg_speed: '30 วิ/ข้อ', mascot: 'riko' },
  { grade: 'ป.3', mode: 'country', rank: 3, child_name: 'น้องพริม', province: 'กรุงเทพมหานคร', tests_completed: 47, total_score: 3960, avg_speed: '32 วิ/ข้อ', mascot: 'timo' },
  { grade: 'ป.4', mode: 'country', rank: 1, child_name: 'น้องกันต์', province: 'ชลบุรี', tests_completed: 57, total_score: 4860, avg_speed: '27 วิ/ข้อ', mascot: 'orbit' },
  { grade: 'ป.4', mode: 'country', rank: 2, child_name: 'น้องฟ้าใส', province: 'ขอนแก่น', tests_completed: 54, total_score: 4690, avg_speed: '29 วิ/ข้อ', mascot: 'topa' },
  { grade: 'ป.4', mode: 'country', rank: 3, child_name: 'น้องกวิน', province: 'เชียงใหม่', tests_completed: 51, total_score: 4520, avg_speed: '31 วิ/ข้อ', mascot: 'memo' },
  { grade: 'ป.5', mode: 'country', rank: 1, child_name: 'น้องลิน', province: 'กรุงเทพมหานคร', tests_completed: 62, total_score: 5480, avg_speed: '25 วิ/ข้อ', mascot: 'splash' },
  { grade: 'ป.5', mode: 'country', rank: 2, child_name: 'น้องปุณณ์', province: 'สงขลา', tests_completed: 59, total_score: 5310, avg_speed: '27 วิ/ข้อ', mascot: 'nova' },
  { grade: 'ป.5', mode: 'country', rank: 3, child_name: 'น้องมะลิ', province: 'ชลบุรี', tests_completed: 56, total_score: 5165, avg_speed: '29 วิ/ข้อ', mascot: 'pip' },
  { grade: 'ป.6', mode: 'country', rank: 1, child_name: 'น้องวิน', province: 'เชียงใหม่', tests_completed: 68, total_score: 6240, avg_speed: '24 วิ/ข้อ', mascot: 'riko' },
  { grade: 'ป.6', mode: 'country', rank: 2, child_name: 'น้องเอม', province: 'กรุงเทพมหานคร', tests_completed: 65, total_score: 6080, avg_speed: '26 วิ/ข้อ', mascot: 'olli' },
  { grade: 'ป.6', mode: 'country', rank: 3, child_name: 'น้องธาม', province: 'ขอนแก่น', tests_completed: 61, total_score: 5890, avg_speed: '28 วิ/ข้อ', mascot: 'timo' },
]

const polishedReviewCards = [
  { name: 'คุณแม่น้องพริม', school_claim: 'สอบติดห้อง Gifted Math ม.1', quote: 'TOPA ช่วยให้ลูกเห็นจุดอ่อนและฝึกต่อได้เองทุกวัน จากที่กลัวโจทย์ยาว ตอนนี้กล้าอ่านและวางแผนมากขึ้น', image: '', rating: 5, enabled: true },
  { name: 'น้องต้นกล้า', school_claim: 'เตรียมสอบเข้า ม.1 Gifted', quote: 'แบบฝึกเหมือนเกม แต่ช่วยให้ผมคิดเป็นขั้นตอนและทำโจทย์ได้เร็วขึ้น', image: '', rating: 5, enabled: true },
  { name: 'คุณพ่อน้องมีนา', school_claim: 'คะแนนคณิตดีขึ้นต่อเนื่อง', quote: 'แดชบอร์ดทำให้รู้ทันทีว่าควรเสริมเรื่องไหน ไม่ต้องเดาเองเหมือนเมื่อก่อน', image: '', rating: 5, enabled: true },
  { name: 'น้องไออุ่น', school_claim: 'จากไม่มั่นใจสู่กล้าทำโจทย์ท้าทาย', quote: 'ชอบที่มีเพื่อน TOPA คอยให้กำลังใจ ทำผิดก็อยากลองใหม่', image: '', rating: 5, enabled: true },
  { name: 'คุณแม่น้องวิน', school_claim: 'ฝึกพื้นฐานก่อนขึ้น ม.1', quote: 'บทเรียนสั้น เข้าใจง่าย และเห็นผลจากการฝึกจริงในแต่ละสัปดาห์', image: '', rating: 5, enabled: true },
]

function rankingRowsFor(grade: string, mode: RankingMode, province: string, cmsRows: TopaRankingRow[]) {
  const enrichedCms = cmsRows.map((row, index) => ({
    ...row,
    grade: (row as TopaRankingRow & { grade?: string }).grade || grade,
    mode: ((row as TopaRankingRow & { mode?: RankingMode }).mode || 'country') as RankingMode,
    rank: row.rank || index + 1,
  }))
  const realOrCms = enrichedCms.filter((row) => row.grade === grade && row.mode === mode && (mode === 'country' || province === 'ทุกจังหวัด' || row.province === province))
  const mock = polishedRankingRows
    .filter((row) => row.grade === grade && row.mode === 'country')
    .map((row, index) => mode === 'province' && province !== 'ทุกจังหวัด' ? { ...row, province, child_name: `${row.child_name}${index === 0 ? '' : ''}`, total_score: row.total_score - 80 - index * 30, tests_completed: Math.max(20, row.tests_completed - 5 - index) } : row)
  return [...realOrCms, ...mock].slice(0, 3).map((row, index) => ({ ...row, rank: index + 1 }))
}

function MascotGroup({ config }: { config: HomepageConfig }) {
  const mascots = enabled(config.mascots.cards)
  const heroKeys = ['pip', 'olli', 'topa', 'memo']
  const heroMascots = heroKeys.map((key) => mascots.find((item) => resolveMascotKey(item.key) === resolveMascotKey(key)) || getMascot(key))
  return (
    <div className="relative mx-auto min-h-[440px] max-w-xl">
      <div className="absolute inset-4 rounded-[2rem] bg-gradient-to-br from-sky-100 via-white to-amber-100 shadow-[0_30px_80px_rgba(45,118,255,0.18)]" />
      <div className="absolute left-1/2 top-8 z-10 h-64 w-[480px] max-w-[92vw] -translate-x-1/2">
        <div className="absolute bottom-0 left-0 z-20">
          <SafeCmsImage src={heroMascots[0].image} alt="Pip mascot" className="h-32 w-32 object-contain drop-shadow-xl" fallbackSeed="Pip" />
        </div>
        <div className="absolute bottom-0 left-[22%] z-20">
          <SafeCmsImage src={heroMascots[1].image} alt="Olli mascot" className="h-44 w-40 object-contain drop-shadow-xl" fallbackSeed="Olli" />
        </div>
        <div className="absolute bottom-0 left-[43%] z-30">
          <SafeCmsImage src={heroMascots[2].image} alt="Topa mascot" className="h-60 w-48 object-contain drop-shadow-2xl" fallbackSeed="Topa" />
        </div>
        <div className="absolute bottom-0 right-0 z-20">
          <SafeCmsImage src={heroMascots[3].image} alt="Memo mascot" className="h-48 w-44 object-contain drop-shadow-xl" fallbackSeed="Memo" />
        </div>
      </div>
      {mascots.slice(1, 9).map((mascot, index) => (
        <div
          key={mascot.key}
          className="absolute z-20"
          style={{
            left: ['4%', '74%', '8%', '76%', '20%', '62%', '38%', '50%'][index],
            top: ['24%', '22%', '58%', '58%', '76%', '76%', '8%', '80%'][index],
          }}
        >
          <MascotAvatar mascot={mascot} index={index + 1} size="md" />
        </div>
      ))}
      <div className="absolute bottom-8 left-8 z-20 rounded-3xl border border-white/80 bg-white/90 p-4 shadow-xl backdrop-blur">
        <p className="text-xs font-bold text-slate-400">Level / XP</p>
        <p className="text-xl font-black text-sky-600">Lv. 12</p>
        <div className="mt-2 h-2 w-32 rounded-full bg-sky-100">
          <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-sky-400 to-amber-400" />
        </div>
      </div>
      <div className="absolute right-4 top-4 z-20 rounded-3xl border border-white/80 bg-white/90 p-4 shadow-xl backdrop-blur">
        <p className="text-xs font-bold text-slate-400">Score graph</p>
        <div className="mt-3 flex h-16 items-end gap-2">
          {[34, 48, 42, 60, 78].map((height, index) => (
            <span key={index} className="w-4 rounded-t-lg bg-gradient-to-t from-amber-400 to-sky-400" style={{ height }} />
          ))}
        </div>
      </div>
    </div>
  )
}

function RankingSection({ config }: { config: HomepageConfig }) {
  const [grade, setGrade] = useState('ป.1')
  const [mode, setMode] = useState<RankingMode>('country')
  const [province, setProvince] = useState(config.ranking.provinces[0] || 'ทุกจังหวัด')
  const mascots = config.mascots.cards
  const displayRows = rankingRowsFor(grade, mode, province, config.ranking.rows)

  return (
    <section id="ranking" className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-4">
        <SectionHeader eyebrow="Ranking" title={config.ranking.title} subtitle={config.ranking.description} />
        <TopaCard className="overflow-hidden">
          <div className="border-b border-sky-100 bg-gradient-to-r from-sky-50 to-amber-50 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex gap-2 overflow-x-auto">
                {gradeTabs.map((item) => (
                  <button key={item} onClick={() => setGrade(item)} className={`rounded-2xl px-4 py-2 text-sm font-black ${grade === item ? 'bg-sky-500 text-white shadow-lg' : 'bg-white text-slate-600'}`}>
                    {item}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setMode('country')} className={`rounded-2xl px-4 py-2 text-sm font-black ${mode === 'country' ? 'bg-amber-400 text-slate-950' : 'bg-white text-slate-600'}`}>อันดับประเทศ</button>
                <button onClick={() => setMode('province')} className={`rounded-2xl px-4 py-2 text-sm font-black ${mode === 'province' ? 'bg-amber-400 text-slate-950' : 'bg-white text-slate-600'}`}>อันดับจังหวัด</button>
                <select value={province} onChange={(event) => setProvince(event.target.value)} className="rounded-2xl border border-sky-100 bg-white px-4 py-2 text-sm font-bold text-slate-700">
                  {config.ranking.provinces.map((item) => <option key={item}>{item}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black text-slate-500">
                <tr>
                  {['อันดับ', 'ชื่อเด็ก', 'จังหวัด', 'จำนวนข้อสอบที่ทำ', 'คะแนนรวม', 'ความเร็วเฉลี่ย'].map((head) => <th key={head} className="px-5 py-4">{head}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-50">
                {displayRows.map((row: TopaRankingRow & { image?: string }, index) => {
                  const mascot = mascots.find((item) => resolveMascotKey(item.key) === resolveMascotKey(row.mascot)) || getMascot(row.mascot)
                  return (
                    <tr key={`${row.rank}-${row.child_name}`} className="bg-white hover:bg-sky-50/60">
                      <td className="px-5 py-4 text-lg font-black text-amber-500">#{index + 1}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <SafeCmsImage
                            src={row.image}
                            alt={row.child_name}
                            className="h-10 w-10 rounded-full border-2 border-white object-cover shadow"
                            fallbackSeed={row.child_name}
                            index={index}
                          />
                          <span className="font-black text-slate-900">{row.child_name}</span>
                          <MascotAvatar mascot={mascot} index={index} size="sm" />
                        </div>
                      </td>
                      <td className="px-5 py-4 font-bold text-slate-600">{row.province}</td>
                      <td className="px-5 py-4 font-bold text-slate-600">{row.tests_completed}</td>
                      <td className="px-5 py-4 font-black text-sky-600">{row.total_score.toLocaleString('th-TH')}</td>
                      <td className="px-5 py-4 font-bold text-slate-600">{row.avg_speed}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </TopaCard>
      </div>
    </section>
  )
}

export default function HomePage() {
  const [config, setConfig] = useState<HomepageConfig>(fallbackHomepageConfig)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    apiClient.get('/site/homepage', {
      params: { t: Date.now() },
      headers: { 'Cache-Control': 'no-store' },
    }).then((res) => setConfig(normalizeHomepageConfig(res.data as HomepageConfig))).catch(() => setConfig(normalizeHomepageConfig(fallbackHomepageConfig)))
  }, [])

  const featureCards = useMemo(() => enabled(config.features.cards), [config])
  const mascots = useMemo(() => enabled(config.mascots.cards), [config])
  const reviews = useMemo(() => {
    const cmsReviews = enabled(config.reviews.cards)
    const seen = new Set(cmsReviews.map((review) => review.name))
    return [...cmsReviews, ...polishedReviewCards.filter((review) => !seen.has(review.name))].slice(0, 5)
  }, [config])
  const reviewTitle = config.reviews.title?.trim() || 'รีวิวจากรุ่นพี่'
  const curriculum = useMemo(() => enabled(config.curriculum.cards), [config])
  const trust = useMemo(() => enabled(config.parent_trust.cards), [config])
  const nav = [
    ['#curriculum', 'หลักสูตร'],
    ['#ranking', 'อันดับ'],
    ['#reviews', 'รีวิว'],
    ['#parents', 'สำหรับผู้ปกครอง'],
    ['/pricing', 'ราคา'],
  ]

  return (
    <div className="min-h-screen bg-[#f7fbff] text-slate-900">
      <header className="sticky top-0 z-50 border-b border-sky-100 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-3">
            <TopaLogo />
          </Link>
          <nav className="hidden items-center gap-6 lg:flex">
            {nav.map(([href, label]) => <Link key={label} href={href} className="text-sm font-bold text-slate-600 hover:text-sky-600">{label}</Link>)}
          </nav>
          <div className="hidden items-center gap-3 sm:flex">
            <TopaButton href="/login" variant="ghost">เข้าสู่ระบบ</TopaButton>
            <TopaButton href="/register">ทดลองใช้ฟรี!</TopaButton>
          </div>
          <button className="rounded-xl p-2 text-slate-700 lg:hidden" onClick={() => setMobileOpen((value) => !value)} aria-label="Toggle menu">
            {mobileOpen ? <X /> : <Menu />}
          </button>
        </div>
        {mobileOpen && (
          <div className="border-t border-sky-100 bg-white px-4 py-4 lg:hidden">
            <div className="grid gap-2">
              {nav.map(([href, label]) => <Link key={label} href={href} className="rounded-xl px-3 py-2 font-bold text-slate-700 hover:bg-sky-50">{label}</Link>)}
              <TopaButton href="/login" variant="secondary">เข้าสู่ระบบ</TopaButton>
              <TopaButton href="/register">ทดลองใช้ฟรี!</TopaButton>
            </div>
          </div>
        )}
      </header>

      <main>
        <section className="relative overflow-hidden bg-gradient-to-br from-sky-50 via-white to-amber-50 py-16 md:py-24">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 lg:grid-cols-[1.02fr_0.98fr]">
            <div>
              <p className="mb-4 inline-flex rounded-full bg-white px-4 py-2 text-sm font-black text-sky-600 shadow-sm">TH / EP Math for ป.1-6</p>
              <h1 className="whitespace-pre-line text-5xl font-black leading-tight tracking-normal text-slate-950 md:text-6xl">{config.hero.headline}</h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">{config.hero.subheadline}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <TopaButton href={config.hero.primary_cta_link}>{config.hero.primary_cta_text}</TopaButton>
                <TopaButton href={config.hero.secondary_cta_link} variant="secondary">{config.hero.secondary_cta_text}</TopaButton>
              </div>
              <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {config.hero.stats.slice(0, 3).map((stat) => <StatCard key={stat.label} {...stat} />)}
              </div>
            </div>
            <MascotGroup config={config} />
          </div>
        </section>

        <section className="py-20">
          <div className="mx-auto max-w-7xl px-4">
            <SectionHeader eyebrow="TOPA Experience" title={config.features.title} subtitle={config.features.subtitle} />
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {featureCards.map((card, index) => {
                const featureMascot = mascots.find((item) => resolveMascotKey(item.key) === resolveMascotKey(featureMascotKeys[index])) || mascots[index % mascots.length]
                return (
                <TopaCard key={card.title} className="p-6">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div className="inline-flex rounded-2xl bg-sky-50 p-3 text-sky-600"><TopaIcon name={card.icon} /></div>
                    <MascotAvatar mascot={featureMascot} index={index} size="lg" />
                  </div>
                  <h3 className="text-lg font-black text-slate-950">{card.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{card.description}</p>
                </TopaCard>
                )
              })}
            </div>
          </div>
        </section>

        <RankingSection config={config} />

        <section id="reviews" className="bg-amber-50 py-20">
          <div className="mx-auto max-w-7xl px-4">
            <SectionHeader eyebrow="Reviews" title={reviewTitle} />
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {reviews.map((review, index) => (
                <TopaCard key={review.name} className={`p-6 ${index < 2 ? 'md:col-span-1 lg:col-span-1 ring-4 ring-white' : ''}`}>
                  <div className="flex items-start gap-4">
                    <SafeCmsImage
                      src={review.image}
                      alt={review.name}
                      className="h-24 w-24 rounded-3xl border-4 border-white object-cover shadow-lg"
                      fallbackSeed={review.name}
                      index={index}
                    />
                    <MascotAvatar mascot={mascots[index % mascots.length]} index={index} size="sm" />
                  </div>
                  <div className="mt-5 flex text-amber-400">{Array.from({ length: Math.max(1, Math.min(5, review.rating)) }, (_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}</div>
                  <p className="mt-3 text-lg font-black text-slate-950">{review.school_claim}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">“{review.quote}”</p>
                  <p className="mt-4 text-sm font-black text-sky-600">{review.name}</p>
                </TopaCard>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="mx-auto max-w-7xl px-4">
            <SectionHeader eyebrow="Mascot Friends" title={config.mascots.title} />
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {mascots.map((mascot, index) => <MascotCard key={mascot.key} mascot={mascot} index={index} />)}
            </div>
          </div>
        </section>

        <section id="curriculum" className="bg-white py-20">
          <div className="mx-auto max-w-7xl px-4">
            <SectionHeader eyebrow="Curriculum" title={config.curriculum.title} />
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {curriculum.map((card) => (
                <TopaCard key={card.title} className="p-6">
                  <div className="mb-4 inline-flex rounded-2xl bg-amber-50 p-3 text-amber-500"><TopaIcon name={card.icon} /></div>
                  <h3 className="text-lg font-black text-slate-950">{card.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{card.text}</p>
                </TopaCard>
              ))}
            </div>
          </div>
        </section>

        <section id="parents" className="py-20">
          <div className="mx-auto max-w-7xl px-4">
            <SectionHeader eyebrow="Parent Trust" title={config.parent_trust.title} />
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-5">
              {trust.map((card) => (
                <TopaCard key={card.title} className="p-5">
                  <div className="mb-4 text-sky-600"><TopaIcon name={card.icon} /></div>
                  <h3 className="font-black text-slate-950">{card.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{card.text}</p>
                </TopaCard>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-20">
          <div className="mx-auto grid max-w-6xl items-center gap-6 rounded-[2rem] bg-gradient-to-r from-sky-500 to-amber-400 p-8 text-white shadow-2xl md:grid-cols-[1fr_auto] md:p-10">
            <div>
              <h2 className="text-3xl font-black md:text-4xl">{config.cta_banner.title}</h2>
              <p className="mt-3 max-w-2xl text-white/90">{config.cta_banner.subtitle}</p>
            </div>
            <TopaButton href={config.cta_banner.button_link} variant="secondary" className="bg-white">{config.cta_banner.button_text}</TopaButton>
          </div>
        </section>
      </main>

      <footer className="bg-slate-950 py-12 text-slate-300">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 md:grid-cols-4">
          <div>
            <div className="inline-flex rounded-2xl bg-white px-3 py-2"><TopaLogo /></div>
            <p className="mt-4 text-sm leading-6">{config.footer.footer_text}</p>
          </div>
          <div>
            <h3 className="font-black text-white">เมนูหลัก</h3>
            <div className="mt-3 grid gap-2 text-sm">{nav.slice(0, 4).map(([href, label]) => <Link key={label} href={href}>{label}</Link>)}</div>
          </div>
          <div>
            <h3 className="font-black text-white">เกี่ยวกับเรา</h3>
            <div className="mt-3 grid gap-2 text-sm"><Link href="/pricing">ราคา</Link><Link href="/login">เข้าสู่ระบบ</Link><Link href="/register">ทดลองใช้ฟรี</Link></div>
          </div>
          <div>
            <h3 className="font-black text-white">ติดต่อ</h3>
            <p className="mt-3 text-sm">{config.footer.contact_email}</p>
            <div className="mt-4 flex gap-3">
              <Link href={config.footer.facebook_url} aria-label="Facebook"><Facebook className="h-5 w-5" /></Link>
              <Link href={config.footer.youtube_url} aria-label="YouTube"><Play className="h-5 w-5" /></Link>
              <Link href={config.footer.tiktok_url} aria-label="TikTok"><Music2 className="h-5 w-5" /></Link>
              <Link href={config.footer.line_url} aria-label="Line"><Instagram className="h-5 w-5" /></Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
