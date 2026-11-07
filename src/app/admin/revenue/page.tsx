'use client'

import { useEffect, useState } from 'react'
import { adminApi, type AdminRevenue } from '@/lib/api/admin'

const emptyRevenue: AdminRevenue = {
  revenue_today: 0,
  revenue_this_month: 0,
  total_revenue: 0,
  monthly_revenue: 0,
  mrr: 0,
  arpu: 0,
  revenue_by_plan: {},
  paid_users_by_plan: {},
  conversion_rate: 0,
}

export default function AdminRevenuePage() {
  const [revenue, setRevenue] = useState<AdminRevenue>(emptyRevenue)
  const [mock, setMock] = useState(false)

  useEffect(() => {
    adminApi.revenue().then(setRevenue).catch(() => { setMock(true); setRevenue({ ...emptyRevenue, is_mock: true }) })
  }, [])

  const maxRevenue = Math.max(...Object.values(revenue.revenue_by_plan || {}), 1)

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-3xl font-extrabold text-gray-950">Revenue</h1>
        <p className="text-sm text-gray-500">Revenue estimates, MRR, plan mix, and free-to-paid conversion.</p>
        {(mock || revenue.is_mock) && <p className="mt-2 text-sm font-semibold text-amber-700">Mock or estimated data is being shown.</p>}
      </div>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card label="Today" value={`฿${revenue.revenue_today.toLocaleString()}`} />
        <Card label="This month" value={`฿${revenue.revenue_this_month.toLocaleString()}`} />
        <Card label="Total" value={`฿${revenue.total_revenue.toLocaleString()}`} />
        <Card label="MRR" value={`฿${revenue.mrr.toLocaleString()}`} />
        <Card label="Conversion" value={`${revenue.conversion_rate}%`} />
      </section>
      {revenue.note && <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">{revenue.note}</div>}
      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Revenue by plan">
          {Object.entries(revenue.revenue_by_plan || {}).map(([plan, amount]) => <Bar key={plan} label={plan} value={amount} max={maxRevenue} prefix="฿" />)}
        </Panel>
        <Panel title="Paid users by plan">
          {Object.entries(revenue.paid_users_by_plan || {}).map(([plan, count]) => <Bar key={plan} label={plan} value={count} max={Math.max(...Object.values(revenue.paid_users_by_plan), 1)} />)}
        </Panel>
      </section>
    </main>
  )
}

function Card({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-gray-500">{label}</p><p className="mt-1 text-2xl font-extrabold text-gray-950">{value}</p></div>
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-lg bg-white p-5 shadow-sm"><h2 className="mb-4 text-lg font-bold text-gray-950">{title}</h2><div className="space-y-3">{children}</div></section>
}

function Bar({ label, value, max, prefix = '' }: { label: string; value: number; max: number; prefix?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return <div><div className="mb-1 flex justify-between text-sm"><span className="font-semibold text-gray-700">{label}</span><span>{prefix}{Math.round(value).toLocaleString()}</span></div><div className="h-2 rounded-full bg-gray-100"><div className="h-2 rounded-full bg-green-500" style={{ width: `${pct}%` }} /></div></div>
}
