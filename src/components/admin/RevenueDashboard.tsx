'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { dashboardApi } from '@/lib/api/admin'
import type {
  DashboardMetrics,
  TimeRange,
  ProgramFilter,
  PlanFilter,
  RevenueTrendPoint,
  RevenueByPlan,
  ConversionFunnelStep,
  MemberSegmentation,
} from '@/lib/api/admin'

// ─── Filter bar ───────────────────────────────────────────────────────────────

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: 'today',  label: 'วันนี้' },
  { value: 'week',   label: 'สัปดาห์นี้' },
  { value: 'month',  label: 'เดือนนี้' },
  { value: 'year',   label: 'ปีนี้' },
  { value: 'custom', label: 'กำหนดเอง' },
]

const PROGRAM_OPTIONS: { value: ProgramFilter; label: string }[] = [
  { value: 'ALL', label: 'ทุกโปรแกรม' },
  { value: 'TH',  label: 'TH เท่านั้น' },
  { value: 'EP',  label: 'EP เท่านั้น' },
]

const PLAN_OPTIONS: { value: PlanFilter; label: string }[] = [
  { value: 'ALL',   label: 'ทุกแพลน' },
  { value: 'FREE',  label: 'Free' },
  { value: 'TRIAL', label: 'Trial' },
  { value: 'PAID',  label: 'Paid' },
]

// ─── Bar chart (pure SVG, no deps) ────────────────────────────────────────────

function BarChart({ data, height = 200 }: { data: RevenueTrendPoint[]; height?: number }) {
  if (!data.length) return <p className="text-sm text-gray-400">ไม่มีข้อมูล</p>
  const maxVal = Math.max(...data.map((d) => d.revenue), 1)
  const padding = { top: 8, right: 8, bottom: 30, left: 8 }
  const chartW = 600
  const chartH = height
  const innerW = chartW - padding.left - padding.right
  const innerH = chartH - padding.top - padding.bottom
  const barW = Math.max(4, Math.min(40, (innerW / data.length) * 0.6))
  const gap  = (innerW - barW * data.length) / (data.length + 1)

  const points = data.map((d, i) => {
    const x = padding.left + gap + i * (barW + gap)
    const barH = Math.max(2, (d.revenue / maxVal) * innerH)
    const y = padding.top + innerH - barH
    return { x, y, barH, barW, value: d.revenue, label: d.label }
  })

  const dashCount = Math.min(6, points.length)
  const dashStep = Math.floor(points.length / dashCount)

  return (
    <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {/* Grid lines */}
      {[0.25, 0.5, 0.75, 1].map((frac) => {
        const y = padding.top + innerH - frac * innerH
        return (
          <line key={frac} x1={padding.left} y1={y} x2={chartW - padding.right} y2={y}
            stroke="#f1f5f9" strokeWidth="1" />
        )
      })}
      {/* Bars */}
      {points.map((p, i) => (
        <g key={i}>
          <rect x={p.x} y={p.y} width={p.barW} height={p.barH} fill="#8b5cf6" rx="3" opacity="0.85" />
          {(dashCount >= points.length || i % dashStep === 0) && (
            <text x={p.x + p.barW / 2} y={chartH - 8} textAnchor="middle"
              fontSize="9" fill="#94a3b8" fontFamily="sans-serif">
              {p.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}

// ─── Line chart (revenue + signups dual axis) ──────────────────────────────────

function LineChart({ data, height = 180 }: { data: RevenueTrendPoint[]; height?: number }) {
  if (!data.length) return <p className="text-sm text-gray-400">ไม่มีข้อมูล</p>

  const maxRev  = Math.max(...data.map((d) => d.revenue), 1)
  const maxSign = Math.max(...data.map((d) => d.signups), 1)

  const padding = { top: 10, right: 50, bottom: 30, left: 50 }
  const chartW  = 600
  const chartH  = height
  const innerW  = chartW - padding.left - padding.right
  const innerH  = chartH - padding.top - padding.bottom

  const ptX = (i: number) => padding.left + (i / (data.length - 1 || 1)) * innerW
  const ptY = (v: number, max: number) => padding.top + innerH - (v / max) * innerH

  const revPts  = data.map((d, i) => `${ptX(i)},${ptY(d.revenue, maxRev)}`).join(' ')
  const signPts = data.map((d, i) => `${ptX(i)},${ptY(d.signups * (maxRev / maxSign), maxRev)}`).join(' ')

  const dashCount = Math.min(6, data.length)
  const dashStep  = Math.floor(data.length / dashCount)

  return (
    <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {/* Grid */}
      {[0.25, 0.5, 0.75, 1].map((frac) => {
        const y = padding.top + innerH - frac * innerH
        return (
          <line key={frac} x1={padding.left} y1={y} x2={chartW - padding.right} y2={y}
            stroke="#f1f5f9" strokeWidth="1" />
        )
      })}
      {/* Revenue line */}
      <polyline points={revPts} fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinejoin="round" />
      {data.map((d, i) => (
        <circle key={i} cx={ptX(i)} cy={ptY(d.revenue, maxRev)} r="3" fill="#8b5cf6" />
      ))}
      {/* Signups line */}
      <polyline points={signPts} fill="none" stroke="#10b981" strokeWidth="2" strokeLinejoin="round" strokeDasharray="4 2" />
      {/* Labels */}
      <text x={chartW - padding.right + 4} y={ptY(maxRev, maxRev) + 4} fontSize="9" fill="#8b5cf6" fontFamily="sans-serif">รายได้</text>
      <text x={chartW - padding.right + 4} y={ptY(1, maxRev) + 4} fontSize="9" fill="#10b981" fontFamily="sans-serif">สมัครใหม่</text>
      {data.map((d, i) => {
        if (dashCount >= data.length || i % dashStep === 0)
          return (
            <text key={i} x={ptX(i)} y={chartH - 6} textAnchor="middle"
              fontSize="9" fill="#94a3b8" fontFamily="sans-serif">{d.label}</text>
          )
        return null
      })}
    </svg>
  )
}

// ─── Dual line chart (TH vs EP or Free vs Paid) ───────────────────────────────

function DualLineChart({
  series1, series2, label1, label2, color1 = '#8b5cf6', color2 = '#10b981', height = 160,
}: {
  series1: RevenueTrendPoint[]
  series2: RevenueTrendPoint[]
  label1: string
  label2: string
  color1?: string
  color2?: string
  height?: number
}) {
  if (!series1.length && !series2.length) return <p className="text-sm text-gray-400">ไม่มีข้อมูล</p>

  const max1 = Math.max(...series1.map((d) => d.revenue), 1)
  const max2 = Math.max(...series2.map((d) => d.revenue), 1)
  const max  = Math.max(max1, max2)

  const padding = { top: 10, right: 60, bottom: 30, left: 50 }
  const chartW  = 600
  const chartH  = height
  const innerW  = chartW - padding.left - padding.right
  const innerH  = chartH - padding.top - padding.bottom

  const n = Math.max(series1.length, series2.length, 1)
  const ptX = (i: number) => padding.left + (i / (n - 1 || 1)) * innerW
  const ptY = (v: number) => padding.top + innerH - (v / max) * innerH

  const makePts = (s: RevenueTrendPoint[]) =>
    s.map((d, i) => `${ptX(i)},${ptY(d.revenue)}`).join(' ')

  const dashCount = Math.min(6, n)
  const dashStep  = Math.floor(n / dashCount)

  return (
    <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {[0.25, 0.5, 0.75, 1].map((frac) => {
        const y = padding.top + innerH - frac * innerH
        return <line key={frac} x1={padding.left} y1={y} x2={chartW - padding.right} y2={y} stroke="#f1f5f9" strokeWidth="1" />
      })}
      {series1.length > 1 && <polyline points={makePts(series1)} fill="none" stroke={color1} strokeWidth="2.5" strokeLinejoin="round" />}
      {series2.length > 1 && <polyline points={makePts(series2)} fill="none" stroke={color2} strokeWidth="2" strokeDasharray="4 2" strokeLinejoin="round" />}
      <text x={chartW - padding.right + 4} y={ptY(max1) + 4} fontSize="9" fill={color1} fontFamily="sans-serif">{label1}</text>
      <text x={chartW - padding.right + 4} y={ptY(Math.max(max2, 1)) + 4} fontSize="9" fill={color2} fontFamily="sans-serif">{label2}</text>
      {Array.from({ length: n }, (_, i) => {
        if (dashCount >= n || i % dashStep === 0) {
          const lbl = series1[i]?.label ?? series2[i]?.label ?? ''
          return <text key={i} x={ptX(i)} y={chartH - 6} textAnchor="middle" fontSize="9" fill="#94a3b8" fontFamily="sans-serif">{lbl}</text>
        }
        return null
      })}
    </svg>
  )
}

// ─── Horizontal bar chart ─────────────────────────────────────────────────────

function HBarChart({ data }: { data: RevenueByPlan[] }) {
  const maxVal = Math.max(...data.map((d) => d.revenue), 1)

  return (
    <div className="space-y-3">
      {data.map((item, i) => {
        const pct = Math.round((item.revenue / maxVal) * 100)
        return (
          <div key={i}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="font-semibold text-gray-700">{item.plan}</span>
              <span className="text-gray-500">{item.users} คน · ฿{item.revenue.toLocaleString()}</span>
            </div>
            <div className="h-3 w-full rounded-full bg-gray-100">
              <div className="h-3 rounded-full bg-violet-400 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Funnel chart ─────────────────────────────────────────────────────────────

function FunnelChart({ data }: { data: ConversionFunnelStep[] }) {
  return (
    <div className="space-y-2">
      {data.map((step, i) => {
        const isLast = i === data.length - 1
        return (
          <div key={i} className="relative">
            <div className="flex items-center gap-3">
              <div className="w-28 text-right">
                <span className="text-xs font-semibold text-gray-600">{step.stage}</span>
              </div>
              <div className="relative h-8 flex-1 overflow-hidden rounded-lg bg-gray-100">
                <div
                  className={`h-full rounded-lg transition-all ${isLast ? 'bg-violet-500' : 'bg-violet-300'}`}
                  style={{ width: `${Math.max(4, step.pct)}%` }}
                />
                <span className="absolute inset-y-0 left-3 flex items-center text-xs font-bold text-gray-700">
                  {step.count.toLocaleString()} ({step.pct}%)
                </span>
              </div>
            </div>
            {i < data.length - 1 && (
              <div className="ml-28 mt-1 border-l-2 border-violet-200 h-3" />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Stat cards row ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, highlight = false }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-4 shadow-sm ${highlight ? 'bg-violet-50 border border-violet-100' : 'bg-white'}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold ${highlight ? 'text-violet-700' : 'text-gray-950'}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

// ─── Segments grid ─────────────────────────────────────────────────────────────

function SegmentsGrid({ seg }: { seg: MemberSegmentation }) {
  const items = [
    { label: 'สมาชิกทั้งหมด',   value: seg.total,   color: 'bg-gray-500' },
    { label: 'TH Members',      value: seg.th,       color: 'bg-blue-400' },
    { label: 'EP Members',      value: seg.ep,       color: 'bg-green-400' },
    { label: 'Free Members',    value: seg.free,     color: 'bg-gray-300' },
    { label: 'Paid Members',    value: seg.paid,     color: 'bg-violet-500' },
    { label: 'Trial Members',    value: seg.trial,    color: 'bg-amber-400' },
    { label: 'Canceled',        value: seg.canceled,  color: 'bg-red-300' },
    { label: 'Expired',         value: seg.expired,   color: 'bg-orange-300' },
  ]
  const maxVal = Math.max(...items.map((i) => i.value), 1)

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item) => {
        const pct = Math.round((item.value / maxVal) * 100)
        return (
          <div key={item.label} className="rounded-xl bg-gray-50 p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-gray-600">{item.label}</span>
              <span className="text-sm font-extrabold text-gray-950">{item.value.toLocaleString()}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-gray-200">
              <div className={`h-1.5 rounded-full ${item.color} transition-all`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main RevenueDashboard component ─────────────────────────────────────────

export function RevenueDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(false)
  const [timeRange, setTimeRange] = useState<TimeRange>('month')
  const [program, setProgram]     = useState<ProgramFilter>('ALL')
  const [plan, setPlan]           = useState<PlanFilter>('ALL')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd]     = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await dashboardApi.getMetrics({
        range: timeRange,
        program,
        plan,
        custom_start: timeRange === 'custom' ? customStart : undefined,
        custom_end:   timeRange === 'custom' ? customEnd   : undefined,
      })
      setMetrics(data)
    } finally {
      setLoading(false)
    }
  }, [timeRange, program, plan, customStart, customEnd])

  useEffect(() => { load() }, [load])

  const s = metrics?.summary

  return (
    <div className="space-y-6">
      {/* Mock warning */}
      {metrics?.is_mock && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
          ⚠️ {metrics.note}
        </div>
      )}

      {/* Filter bar */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm font-semibold text-gray-500">ช่วงเวลา:</span>
          {TIME_RANGES.map((r) => (
            <button key={r.value}
              onClick={() => setTimeRange(r.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                timeRange === r.value
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {r.label}
            </button>
          ))}
          {timeRange === 'custom' && (
            <div className="flex gap-2 items-center">
              <input type="date" className="rounded-lg border border-gray-200 px-2 py-1 text-xs"
                value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
              <span className="text-xs text-gray-400">–</span>
              <input type="date" className="rounded-lg border border-gray-200 px-2 py-1 text-xs"
                value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-4 items-center text-sm">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-500">โปรแกรม:</span>
            {PROGRAM_OPTIONS.map((o) => (
              <button key={o.value}
                onClick={() => setProgram(o.value)}
                className={`rounded-lg px-2 py-1 text-xs font-semibold transition-colors ${
                  program === o.value ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {o.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-500">แพลน:</span>
            {PLAN_OPTIONS.map((o) => (
              <button key={o.value}
                onClick={() => setPlan(o.value)}
                className={`rounded-lg px-2 py-1 text-xs font-semibold transition-colors ${
                  plan === o.value ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {o.label}
              </button>
            ))}
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="ml-auto rounded-lg bg-violet-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-50">
            {loading ? 'กำลังโหลด...' : '🔄 รีเฟรช'}
          </button>
        </div>
      </div>

      {!metrics || loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <span className="text-gray-400">กำลังโหลดข้อมูล...</span>
        </div>
      ) : (
        <>
          {/* Summary KPIs */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="รายได้รวม"     value={`฿${(s?.total_revenue ?? 0).toLocaleString()}`}      sub={`ช่วงที่เลือก`} />
            <StatCard label="สมัครใหม่"     value={(s?.total_signups ?? 0).toLocaleString()}           sub="คนในช่วงที่เลือก" />
            <StatCard label="MRR"           value={`฿${(s?.mrr ?? 0).toLocaleString()}`}                sub="รายเดือนต่อเดือน" highlight />
            <StatCard label="ARPU"          value={`฿${(s?.arpu ?? 0).toLocaleString()}`}                sub="ต่อ paid user" />
            <StatCard label="Conversion"    value={`${((s?.conversion_rate ?? 0) * 100).toFixed(1)}%`}  sub="trial→paid" />
          </div>

          {/* Revenue trend */}
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-950">📈 รายได้ & สมัครใหม่</h3>
              <div className="flex gap-4 text-xs">
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-violet-500" />รายได้</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-green-500" />สมัครใหม่</span>
              </div>
            </div>
            <LineChart data={metrics.revenue_trend} height={200} />
          </div>

          {/* TH vs EP + Free vs Paid */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-base font-bold text-gray-950">🌏 TH vs EP</h3>
              <DualLineChart
                series1={metrics.program_trend}
                series2={metrics.revenue_trend.map((d, i) => ({
                  label: d.label,
                  revenue: Math.max(0, d.revenue - (metrics.program_trend[i]?.revenue ?? 0)),
                  signups: d.signups,
                }))}
                label1="TH" label2="EP" color1="#3b82f6" color2="#10b981"
              />
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-base font-bold text-gray-950">💳 Free vs Paid</h3>
              <DualLineChart
                series1={metrics.plan_trend}
                series2={metrics.revenue_trend.map((d, i) => ({
                  label: d.label,
                  revenue: Math.max(0, d.revenue - (metrics.plan_trend[i]?.revenue ?? 0)),
                  signups: d.signups,
                }))}
                label1="Free" label2="Paid" color1="#94a3b8" color2="#f59e0b"
              />
            </div>
          </div>

          {/* Members segmentation */}
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-base font-bold text-gray-950">👥 สมาชิกแยกตามประเภท</h3>
            <SegmentsGrid seg={metrics.segmentation} />
          </div>

          {/* Revenue by plan */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-base font-bold text-gray-950">💰 รายได้ตามแพลน</h3>
              <HBarChart data={metrics.revenue_by_plan} />
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-base font-bold text-gray-950">🎯 Conversion Funnel</h3>
              <FunnelChart data={metrics.conversion_funnel} />
            </div>
          </div>

          {/* Revenue bar chart */}
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-base font-bold text-gray-950">📊 กราฟรายได้</h3>
            <BarChart data={metrics.revenue_trend} height={160} />
          </div>
        </>
      )}
    </div>
  )
}