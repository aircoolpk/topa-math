'use client'

import { useEffect, useMemo, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { playSound } from '../audio'
import type { WorkspaceProps } from '../types'

/**
 * UPPER PRIMARY WORKSPACE: fraction circle + fraction bar.
 *
 * The prototype has no fraction workspace yet, so this one is new. It draws
 * the fraction from `problem.fractionConfig` as an SVG pie split into
 * `denominator` equal sectors, shades the first `shadedParts` sectors and
 * lets the learner change both the shaded parts and the denominator
 * (bounded 2..12). A matching fraction bar sits under the pie.
 */

const MIN_DENOMINATOR = 2
const MAX_DENOMINATOR = 12

const PIE_CENTER = 100
const PIE_RADIUS = 88

interface Point {
  x: number
  y: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function polarToCartesian(center: number, radius: number, angleDeg: number): Point {
  const rad = (angleDeg * Math.PI) / 180
  return {
    x: center + radius * Math.cos(rad),
    y: center + radius * Math.sin(rad),
  }
}

/** One pie slice, drawn clockwise from 12 o'clock. */
function sectorPath(index: number, denominator: number): string {
  const slice = 360 / denominator
  const startAngle = -90 + index * slice
  const endAngle = startAngle + slice
  const start = polarToCartesian(PIE_CENTER, PIE_RADIUS, startAngle)
  const end = polarToCartesian(PIE_CENTER, PIE_RADIUS, endAngle)
  const largeArc = slice > 180 ? 1 : 0
  return [
    `M ${PIE_CENTER} ${PIE_CENTER}`,
    `L ${start.x.toFixed(3)} ${start.y.toFixed(3)}`,
    `A ${PIE_RADIUS} ${PIE_RADIUS} 0 ${largeArc} 1 ${end.x.toFixed(3)} ${end.y.toFixed(3)}`,
    'Z',
  ].join(' ')
}

export function FractionWorkspace(props: WorkspaceProps) {
  const { problem, theme, problemId } = props
  const config = problem.fractionConfig

  const [denominator, setDenominator] = useState<number>(() =>
    clamp(config?.denominator ?? 4, MIN_DENOMINATOR, MAX_DENOMINATOR),
  )
  const [shadedParts, setShadedParts] = useState<number>(() =>
    clamp(config?.shadedParts ?? config?.numerator ?? 1, 0, config?.denominator ?? 4),
  )

  // Reset the fraction whenever the learner moves to another problem.
  useEffect(() => {
    const nextDenominator = clamp(config?.denominator ?? 4, MIN_DENOMINATOR, MAX_DENOMINATOR)
    setDenominator(nextDenominator)
    setShadedParts(clamp(config?.shadedParts ?? config?.numerator ?? 1, 0, nextDenominator))
    // `problemId` is the reset signal; the problem object itself is stable
    // for the lifetime of a problem in the shell.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemId])

  const sectors = useMemo(
    () => Array.from({ length: denominator }, (_, idx) => sectorPath(idx, denominator)),
    [denominator],
  )

  const fractionLabel = `${shadedParts}/${denominator}`
  const targetLabel =
    config?.targetNumerator !== undefined && config?.targetDenominator !== undefined
      ? `${config.targetNumerator}/${config.targetDenominator}`
      : null

  function stepShaded(delta: number) {
    playSound('pop')
    setShadedParts((prev) => clamp(prev + delta, 0, denominator))
  }

  function stepDenominator(delta: number) {
    playSound('pop')
    setDenominator((prev) => {
      const next = clamp(prev + delta, MIN_DENOMINATOR, MAX_DENOMINATOR)
      setShadedParts((current) => clamp(current, 0, next))
      return next
    })
  }

  if (!config) {
    return (
      <div
        className={`flex-1 min-h-[210px] border-2 border-dashed p-5 flex flex-col items-center justify-center gap-2 text-center ${theme.surface} ${theme.surfaceBorder} ${theme.radius}`}
      >
        <span className="text-3xl" aria-hidden="true">
          Fraction
        </span>
        <p className={`text-sm font-bold ${theme.text}`}>โจทย์นี้ยังไม่มีการตั้งค่าเศษ (fraction)</p>
        <p className={`text-xs ${theme.textMuted}`}>
          ลองตอบคำถามด้านล่างได้เลยนะ — เครื่องมือช่วยนับส่วนจะมาพร้อมกับโจทย์เศษค่ะ
        </p>
      </div>
    )
  }

  return (
    <div
      className={`flex-1 min-h-[210px] border-2 p-3 sm:p-5 flex flex-col justify-between gap-3 relative overflow-hidden ${theme.surface} ${theme.surfaceBorder} ${theme.radius}`}
    >
      {/* Header: current fraction + target */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs sm:text-sm font-extrabold px-3 py-1 rounded-xl border border-indigo-500/30 bg-indigo-950/90 text-cyan-300">
          🥧 เครื่องมือสร้างเศษ (Fraction Builder)
        </span>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-amber-100 border-2 border-amber-300 px-3.5 py-1 rounded-2xl">
            <span className="text-xs font-bold text-amber-900">เศษปัจจุบัน (Current Fraction):</span>
            <span className="text-xl font-extrabold text-orange-600">{fractionLabel}</span>
          </div>
          {targetLabel && (
            <div className="flex items-center gap-2 bg-emerald-100 border-2 border-emerald-300 px-3 py-1 rounded-2xl">
              <span className="text-xs font-bold text-emerald-900">เป้าหมาย (Target):</span>
              <span className="text-sm font-extrabold text-emerald-700">{targetLabel}</span>
            </div>
          )}
        </div>
      </div>

      {/* Pie + controls */}
      <div className="my-auto flex flex-col lg:flex-row items-center justify-center gap-4 py-2">
        <svg
          viewBox="0 0 200 200"
          role="img"
          aria-label={`เศษ ${shadedParts} ส่วน จากทั้งหมด ${denominator} ส่วน (${shadedParts}/${denominator})`}
          className={`w-40 h-40 sm:w-48 sm:h-48 shrink-0 ${theme.accentText}`}
        >
          <circle
            cx={PIE_CENTER}
            cy={PIE_CENTER}
            r={PIE_RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeOpacity={0.35}
          />
          {sectors.map((path, idx) => (
            <path
              key={idx}
              d={path}
              fill={idx < shadedParts ? 'currentColor' : 'none'}
              fillOpacity={idx < shadedParts ? 0.85 : 0}
              stroke="currentColor"
              strokeWidth={2}
              strokeOpacity={0.6}
              strokeLinejoin="round"
            />
          ))}
        </svg>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          {/* Shaded parts stepper */}
          <div className="flex items-center justify-between gap-2">
            <span className={`text-xs sm:text-sm font-extrabold ${theme.text}`}>
              ส่วนที่ระบาย (Shaded Parts)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => stepShaded(-1)}
                aria-label="ลดจำนวนส่วนที่ระบายลง 1 ส่วน"
                className={`w-8 h-8 rounded-xl border flex items-center justify-center font-bold active:scale-95 shadow-sm ${theme.buttonGhost}`}
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="text-sm font-mono w-8 text-center">{shadedParts}</span>
              <button
                type="button"
                onClick={() => stepShaded(1)}
                aria-label="เพิ่มจำนวนส่วนที่ระบายขึ้น 1 ส่วน"
                className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold active:scale-95 shadow-sm ${theme.buttonPrimary}`}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Denominator stepper */}
          <div className="flex items-center justify-between gap-2">
            <span className={`text-xs sm:text-sm font-extrabold ${theme.text}`}>
              จำนวนส่วนทั้งหมด (Denominator)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => stepDenominator(-1)}
                aria-label="ลดจำนวนส่วนทั้งหมดลง 1 ส่วน"
                className={`w-8 h-8 rounded-xl border flex items-center justify-center font-bold active:scale-95 shadow-sm ${theme.buttonGhost}`}
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="text-sm font-mono w-8 text-center">{denominator}</span>
              <button
                type="button"
                onClick={() => stepDenominator(1)}
                aria-label="เพิ่มจำนวนส่วนทั้งหมดขึ้น 1 ส่วน"
                className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold active:scale-95 shadow-sm ${theme.buttonPrimary}`}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <p className={`text-[11px] leading-relaxed ${theme.textMuted}`}>
            💡 ลองเปลี่ยนจำนวนส่วนทั้งหมดดูนะคะ ส่วนที่ระบายจะแบ่งออกเป็นส่วนที่เท่ากันเสมอ
          </p>
        </div>
      </div>

      {/* Fraction bar view */}
      <div className="flex flex-col gap-1.5">
        <span className={`text-[11px] font-bold ${theme.textMuted}`}>
          แถบเศษ (Fraction Bar) — {shadedParts} ส่วนจาก {denominator} ส่วน
        </span>
        <div
          role="img"
          aria-label={`แถบเศษ ${fractionLabel} ระบาย ${shadedParts} ส่วนจาก ${denominator} ส่วน`}
          className="flex w-full h-11 rounded-xl overflow-hidden border-2 border-indigo-500/40"
        >
          {Array.from({ length: denominator }, (_, idx) => (
            <div
              key={idx}
              className={`flex-1 flex items-center justify-center text-[10px] font-extrabold border-r border-indigo-500/30 last:border-r-0 ${
                idx < shadedParts ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800/60 text-slate-400'
              }`}
            >
              {idx < shadedParts ? '★' : ''}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
