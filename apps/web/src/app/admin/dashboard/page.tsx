'use client'

import Link from 'next/link'
import { RevenueDashboard } from '@/components/admin/RevenueDashboard'

export default function AdminDashboardPage() {
  return (
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-3xl font-extrabold text-gray-950">Owner Dashboard</h1>
        <p className="text-sm text-gray-500">วิเคราะห์ยอดรายรับ สมาชิก และการตลาด</p>
      </div>

      <RevenueDashboard />

      <section className="grid gap-4 lg:grid-cols-3">
        <Panel title="Shortcuts">
          <div className="grid gap-2">
            {[
              ['/admin/users', 'Manage users'],
              ['/admin/subscriptions', 'Manage subscriptions'],
              ['/admin/revenue', 'Revenue dashboard'],
              ['/admin/lessons', 'Lesson admin'],
              ['/admin/content-quality', 'Content quality'],
              ['/admin/content', 'Content Manager ✏️'],
            ].map(([href, label]) => (
              <Link key={href} href={href} className="rounded-lg border border-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-primary-50 hover:border-primary-200">
                {label}
              </Link>
            ))}
          </div>
        </Panel>
        <Panel title="Quick Stats">
          <div className="space-y-3">
            <Metric label="Total users"    value="—" compact />
            <Metric label="Active subscriptions" value="—" compact />
            <Metric label="This month"     value="—" compact />
          </div>
        </Panel>
        <Panel title="Revenue">
          <div className="space-y-3">
            <Metric label="MRR"            value="฿—" compact />
            <Metric label="Total estimate" value="฿—" compact />
            <Metric label="ARPU"           value="฿—" compact />
          </div>
        </Panel>
      </section>
    </main>
  )
}

function Metric({ label, value, compact = false }: { label: string; value: string | number; compact?: boolean }) {
  return (
    <div>
      <p className="text-sm font-semibold text-gray-500">{label}</p>
      <p className={`${compact ? 'text-2xl' : 'text-3xl'} mt-1 font-extrabold text-gray-950`}>{value}</p>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-bold text-gray-950">{title}</h2>
      {children}
    </section>
  )
}