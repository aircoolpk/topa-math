'use client'

import Link from 'next/link'
import { useMemo, useState, type ReactNode } from 'react'
import {
  Activity,
  BadgeCheck,
  BookOpen,
  Brain,
  GraduationCap,
  HeartHandshake,
  Lightbulb,
  LineChart,
  Map,
  Puzzle,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Workflow,
} from 'lucide-react'
import { mascotPalette, type TopaMascotItem } from '@/lib/topa-content'
import { getMascot } from '@/lib/mascot-registry'

const iconMap = {
  Activity,
  BadgeCheck,
  BookOpen,
  Brain,
  GraduationCap,
  HeartHandshake,
  Lightbulb,
  LineChart,
  Map,
  Puzzle,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Workflow,
}

export function TopaIcon({ name, className = 'h-5 w-5' }: { name?: string; className?: string }) {
  const Icon = iconMap[(name || 'Sparkles') as keyof typeof iconMap] || Sparkles
  return <Icon className={className} aria-hidden="true" />
}

export function TopaButton({ href, children, variant = 'primary', className = '' }: { href?: string; children: ReactNode; variant?: 'primary' | 'secondary' | 'ghost'; className?: string }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-extrabold transition-all focus:outline-none focus:ring-4 focus:ring-sky-100'
  const styles = {
    primary: 'bg-sky-500 text-white shadow-lg shadow-sky-200 hover:bg-sky-600 hover:-translate-y-0.5',
    secondary: 'border-2 border-amber-200 bg-white text-slate-800 shadow-sm hover:border-amber-300 hover:bg-amber-50',
    ghost: 'text-slate-700 hover:bg-sky-50',
  }
  const cls = `${base} ${styles[variant]} ${className}`
  if (href) return <Link href={href} className={cls}>{children}</Link>
  return <button className={cls}>{children}</button>
}

export function TopaCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl border border-sky-100 bg-white shadow-[0_18px_45px_rgba(45,118,255,0.10)] ${className}`}>{children}</div>
}

export function SectionHeader({ eyebrow, title, subtitle, align = 'center' }: { eyebrow?: string; title: string; subtitle?: string; align?: 'center' | 'left' }) {
  return (
    <div className={align === 'center' ? 'mx-auto mb-10 max-w-3xl text-center' : 'mb-8 max-w-3xl'}>
      {eyebrow && <p className="mb-2 text-sm font-extrabold text-amber-500">{eyebrow}</p>}
      <h2 className="text-3xl font-black leading-tight text-slate-950 md:text-4xl">{title}</h2>
      {subtitle && <p className="mt-3 text-base leading-7 text-slate-600">{subtitle}</p>}
    </div>
  )
}

function mascotFallbackSvg({ color, accent, initial }: { color: string; accent: string; initial: string }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" rx="42" fill="${color}"/><circle cx="50" cy="44" r="22" fill="${accent}" opacity=".9"/><circle cx="110" cy="44" r="22" fill="${accent}" opacity=".9"/><circle cx="80" cy="84" r="48" fill="#fff"/><circle cx="62" cy="74" r="7" fill="#1f2937"/><circle cx="98" cy="74" r="7" fill="#1f2937"/><path d="M62 100c12 10 24 10 36 0" stroke="#1f2937" stroke-width="8" stroke-linecap="round" fill="none"/><circle cx="80" cy="88" r="8" fill="${accent}"/><text x="80" y="145" text-anchor="middle" font-family="Arial,sans-serif" font-size="34" font-weight="900" fill="#fff">${initial}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export function MascotAvatar({ mascot, index = 0, size = 'md' }: { mascot?: Pick<TopaMascotItem, 'name' | 'image' | 'key'>; index?: number; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const dim = size === 'xl' ? 'h-36 w-36' : size === 'lg' ? 'h-24 w-24' : size === 'sm' ? 'h-10 w-10' : 'h-16 w-16'
  const registryMascot = useMemo(() => getMascot(mascot?.key || mascot?.name), [mascot?.key, mascot?.name])
  const [broken, setBroken] = useState(false)
  const color = registryMascot.color || mascotPalette[index % mascotPalette.length]
  const fallbackSrc = mascotFallbackSvg({ color, accent: registryMascot.accent, initial: registryMascot.initial })
  const src = !broken && (mascot?.image || registryMascot.image) ? (mascot?.image || registryMascot.image) : fallbackSrc
  return (
    <div className={`${dim} overflow-hidden rounded-full border-4 border-white bg-white shadow-lg`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={mascot?.name || registryMascot.name || 'TOPA mascot'}
        className="h-full w-full object-contain"
        onError={() => setBroken(true)}
      />
    </div>
  )
}

export function MascotCard({ mascot, index }: { mascot: TopaMascotItem; index: number }) {
  return (
    <TopaCard className="p-5">
      <div className="flex items-start gap-4">
        <MascotAvatar mascot={mascot} index={index} />
        <div>
          <h3 className="text-lg font-black text-slate-950">{mascot.name}</h3>
          <p className="text-sm font-bold text-sky-600">{mascot.english_role}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{mascot.description_th}</p>
        </div>
      </div>
    </TopaCard>
  )
}

export function StatCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <TopaCard className="p-4">
      <p className="text-xs font-extrabold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
      {detail && <p className="mt-1 text-xs font-semibold text-slate-500">{detail}</p>}
    </TopaCard>
  )
}
