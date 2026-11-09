'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { playSound } from '../audio'
import type { WorkspaceProps } from '../types'

/**
 * UPPER PRIMARY WORKSPACE: analogue clock.
 *
 * The prototype has no clock workspace yet, so this one is new. It draws the
 * clock face from `problem.clockConfig` (hour + minute), shows the digital
 * time and lets the learner drag the minute hand or step it with the
 * +/- buttons. When a target time is configured a subtle ghost hand shows
 * where the learner is aiming.
 */

const CLOCK_CENTER = 100
const CLOCK_RADIUS = 88
const MINUTE_HAND_LENGTH = 66
const HOUR_HAND_LENGTH = 44
const MAX_MINUTE = 59

interface Point {
  x: number
  y: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Point on the clock face for an angle measured clockwise from 12 o'clock.
 * 0 degrees points straight up, 90 degrees points at 3 o'clock.
 */
function polarToCartesian(center: number, radius: number, angleDeg: number): Point {
  const rad = (angleDeg * Math.PI) / 180
  return {
    x: center + radius * Math.sin(rad),
    y: center - radius * Math.cos(rad),
  }
}

function formatDigital(hour: number, minute: number): string {
  const h = ((hour - 1) % 12) + 1
  return `${h}:${String(minute).padStart(2, '0')}`
}

export function ClockWorkspace(props: WorkspaceProps) {
  const { problem, theme, problemId } = props
  const config = problem.clockConfig

  const [hour, setHour] = useState<number>(() => config?.hour ?? 12)
  const [minute, setMinute] = useState<number>(() => clamp(config?.minute ?? 0, 0, MAX_MINUTE))

  const svgRef = useRef<SVGSVGElement | null>(null)
  const draggingRef = useRef(false)

  // Reset the clock whenever the learner moves to another problem.
  useEffect(() => {
    setHour(config?.hour ?? 12)
    setMinute(clamp(config?.minute ?? 0, 0, MAX_MINUTE))
    // `problemId` is the reset signal; the problem object itself is stable
    // for the lifetime of a problem in the shell.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemId])

  const minuteAngle = minute * 6
  const hourAngle = ((hour % 12) * 30 + minute * 0.5) % 360

  const minuteTip = polarToCartesian(CLOCK_CENTER, MINUTE_HAND_LENGTH, minuteAngle)
  const hourTip = polarToCartesian(CLOCK_CENTER, HOUR_HAND_LENGTH, hourAngle)
  const center: Point = { x: CLOCK_CENTER, y: CLOCK_CENTER }

  const targetMinuteAngle = config?.targetMinute !== undefined ? config.targetMinute * 6 : null
  const targetHourAngle =
    config?.targetHour !== undefined
      ? ((config.targetHour % 12) * 30 + (config.targetMinute ?? 0) * 0.5) % 360
      : null
  const targetMinuteTip =
    targetMinuteAngle !== null ? polarToCartesian(CLOCK_CENTER, MINUTE_HAND_LENGTH, targetMinuteAngle) : null
  const targetHourTip =
    targetHourAngle !== null ? polarToCartesian(CLOCK_CENTER, HOUR_HAND_LENGTH, targetHourAngle) : null

  /** Convert a pointer position into the nearest minute mark. */
  const minuteFromPointer = useCallback((clientX: number, clientY: number): number | null => {
    const svg = svgRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return null
    // Map the client point into the SVG viewBox coordinate system.
    const viewX = ((clientX - rect.left) / rect.width) * 200
    const viewY = ((clientY - rect.top) / rect.height) * 200
    const dx = viewX - CLOCK_CENTER
    const dy = viewY - CLOCK_CENTER
    if (Math.sqrt(dx * dx + dy * dy) > CLOCK_RADIUS * 1.35) return null
    // 0 degrees points up, angles grow clockwise.
    const deg = (Math.atan2(dx, -dy) * 180) / Math.PI
    const normalised = (deg + 360) % 360
    return Math.round(normalised / 6) % 60
  }, [])

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    const next = minuteFromPointer(event.clientX, event.clientY)
    if (next === null) return
    draggingRef.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    playSound('pop')
    setMinute(next)
  }

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!draggingRef.current) return
    const next = minuteFromPointer(event.clientX, event.clientY)
    if (next === null) return
    setMinute(next)
  }

  const endDrag = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  function stepMinute(delta: number) {
    playSound('pop')
    setMinute((prev) => clamp(prev + delta, 0, MAX_MINUTE))
  }

  function stepHour(delta: number) {
    playSound('pop')
    setHour((prev) => clamp(prev + delta, 1, 12))
  }

  if (!config) {
    return (
      <div
        className={`flex-1 min-h-[210px] border-2 border-dashed p-5 flex flex-col items-center justify-center gap-2 text-center ${theme.surface} ${theme.surfaceBorder} ${theme.radius}`}
      >
        <span className="text-3xl" aria-hidden="true">
          🕒
        </span>
        <p className={`text-sm font-bold ${theme.text}`}>โจทย์นี้ยังไม่มีการตั้งค่านาฬิกา (clock)</p>
        <p className={`text-xs ${theme.textMuted}`}>
          ลองตอบคำถามด้านล่างได้เลยนะ — เครื่องมืออ่านเวลาจะมาพร้อมกับโจทย์นาฬิกาค่ะ
        </p>
      </div>
    )
  }

  return (
    <div
      className={`flex-1 min-h-[210px] border-2 p-3 sm:p-5 flex flex-col justify-between gap-3 relative overflow-hidden ${theme.surface} ${theme.surfaceBorder} ${theme.radius}`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs sm:text-sm font-extrabold px-3 py-1 rounded-xl border border-indigo-500/30 bg-indigo-950/90 text-cyan-300">
          🕒 เครื่องมืออ่านเวลา (Analogue Clock)
        </span>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-amber-100 border-2 border-amber-300 px-3.5 py-1 rounded-2xl">
            <span className="text-xs font-bold text-amber-900">เวลา (Time):</span>
            <span className="text-xl font-extrabold text-orange-600">{formatDigital(hour, minute)}</span>
          </div>
          {config.targetHour !== undefined && config.targetMinute !== undefined && (
            <div className="flex items-center gap-2 bg-emerald-100 border-2 border-emerald-300 px-3 py-1 rounded-2xl">
              <span className="text-xs font-bold text-emerald-900">เป้าหมาย (Target):</span>
              <span className="text-sm font-extrabold text-emerald-700">
                {formatDigital(config.targetHour, config.targetMinute)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Clock face + controls */}
      <div className="my-auto flex flex-col sm:flex-row items-center justify-center gap-4 py-2">
        <svg
          ref={svgRef}
          viewBox="0 0 200 200"
          role="img"
          aria-label={`นาฬิกาแสดงเวลา ${formatDigital(hour, minute)}`}
          className={`w-40 h-40 sm:w-48 sm:h-48 shrink-0 touch-none select-none cursor-grab active:cursor-grabbing ${theme.text}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <circle
            cx={CLOCK_CENTER}
            cy={CLOCK_CENTER}
            r={CLOCK_RADIUS}
            fill="currentColor"
            fillOpacity={0.06}
            stroke="currentColor"
            strokeWidth={3}
          />

          {/* Hour ticks + numbers */}
          {Array.from({ length: 12 }, (_, idx) => {
            const angle = idx * 30
            const outer = polarToCartesian(CLOCK_CENTER, CLOCK_RADIUS - 6, angle)
            const inner = polarToCartesian(CLOCK_CENTER, CLOCK_RADIUS - (idx % 3 === 0 ? 16 : 11), angle)
            const label = polarToCartesian(CLOCK_CENTER, CLOCK_RADIUS - 28, angle)
            return (
              <g key={idx}>
                <line
                  x1={inner.x}
                  y1={inner.y}
                  x2={outer.x}
                  y2={outer.y}
                  stroke="currentColor"
                  strokeWidth={idx % 3 === 0 ? 3 : 1.5}
                  strokeOpacity={0.75}
                  strokeLinecap="round"
                />
                <text
                  x={label.x}
                  y={label.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="13"
                  fontWeight="extrabold"
                  fill="currentColor"
                >
                  {idx === 0 ? 12 : idx}
                </text>
              </g>
            )
          })}

          {/* Target ghost hands */}
          {targetHourTip && (
            <line
              x1={center.x}
              y1={center.y}
              x2={targetHourTip.x}
              y2={targetHourTip.y}
              stroke="currentColor"
              strokeWidth={4}
              strokeOpacity={0.18}
              strokeLinecap="round"
            />
          )}
          {targetMinuteTip && (
            <line
              x1={center.x}
              y1={center.y}
              x2={targetMinuteTip.x}
              y2={targetMinuteTip.y}
              stroke="currentColor"
              strokeWidth={2}
              strokeOpacity={0.25}
              strokeLinecap="round"
              strokeDasharray="4 4"
            />
          )}

          {/* Hour hand */}
          <line
            x1={center.x}
            y1={center.y}
            x2={hourTip.x}
            y2={hourTip.y}
            stroke="currentColor"
            strokeWidth={6}
            strokeLinecap="round"
          />
          {/* Minute hand */}
          <line
            x1={center.x}
            y1={center.y}
            x2={minuteTip.x}
            y2={minuteTip.y}
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
          />
          {/* Centre pin */}
          <circle cx={center.x} cy={center.y} r={5} fill="currentColor" />
        </svg>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          {/* Minute stepper */}
          <div className="flex items-center justify-between gap-2">
            <span className={`text-xs sm:text-sm font-extrabold ${theme.text}`}>เข็มนาที (Minute)</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => stepMinute(-1)}
                aria-label="ลดเวลา 1 นาที"
                className={`w-8 h-8 rounded-xl border flex items-center justify-center font-bold active:scale-95 shadow-sm ${theme.buttonGhost}`}
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="text-sm font-mono w-12 text-center">{String(minute).padStart(2, '0')}</span>
              <button
                type="button"
                onClick={() => stepMinute(1)}
                aria-label="เพิ่มเวลา 1 นาที"
                className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold active:scale-95 shadow-sm ${theme.buttonPrimary}`}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Hour stepper */}
          <div className="flex items-center justify-between gap-2">
            <span className={`text-xs sm:text-sm font-extrabold ${theme.text}`}>เข็มชั่วโมง (Hour)</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => stepHour(-1)}
                aria-label="ลดเวลา 1 ชั่วโมง"
                className={`w-8 h-8 rounded-xl border flex items-center justify-center font-bold active:scale-95 shadow-sm ${theme.buttonGhost}`}
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="text-sm font-mono w-12 text-center">{hour}</span>
              <button
                type="button"
                onClick={() => stepHour(1)}
                aria-label="เพิ่มเวลา 1 ชั่วโมง"
                className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold active:scale-95 shadow-sm ${theme.buttonPrimary}`}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <p className={`text-[11px] leading-relaxed ${theme.textMuted}`}>
            💡 ลองลากเข็มนาทีไปตามเวลาเป้าหมาย หรือกดปุ่ม + / - เพื่อขยับทีละนาที
          </p>
        </div>
      </div>
    </div>
  )
}
