'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { adminApi, type AdminOverview } from '@/lib/api/admin'

export default function AdminOverviewPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    adminApi.overview()
      .then((data) => {
        setOverview(data)
        setError('')
      })
      .catch((err) => setError(adminApi.errorMessage(err, 'โหลดข้อมูลภาพรวมไม่สำเร็จ')))
      .finally(() => setLoading(false))
  }, [])

  const charts = useMemo(() => {
    if (!overview) return null
    return {
      plan: [
        { name: 'Free', value: overview.members.free },
        { name: 'Paid', value: overview.members.paid },
      ],
      paidProgram: [
        { name: 'Paid TH', value: overview.members.paid_th },
        { name: 'Paid EP', value: overview.members.paid_ep },
      ],
      grades: overview.students.by_grade.map((item) => ({ name: `ป.${item.grade}`, value: item.count })),
      gender: overview.students.by_gender.map((item) => ({ name: genderLabel[item.gender] ?? item.gender, value: item.count })),
      age: overview.students.by_age.map((item) => ({ name: String(item.age), value: item.count })),
      status: [
        { name: 'Draft', value: overview.content.draft },
        { name: 'Pending', value: overview.content.pending },
        { name: 'Approved', value: overview.content.approved },
        { name: 'Rejected', value: overview.content.rejected },
      ],
    }
  }, [overview])

  if (loading) return <Shell title="ภาพรวม"><p className="text-sm text-gray-500">กำลังโหลด...</p></Shell>
  if (error) return <Shell title="ภาพรวม"><ErrorMessage message={error} /></Shell>
  if (!overview || !charts) return <Shell title="ภาพรวม"><Empty /></Shell>

  const cards = [
    ['สมาชิกทั้งหมด', overview.members.total],
    ['ฟรี', overview.members.free],
    ['เสียเงินทั้งหมด', overview.members.paid],
    ['Paid TH', overview.members.paid_th],
    ['Paid EP', overview.members.paid_ep],
    ['นักเรียนทั้งหมด', overview.students.total],
    ['บทเรียนทั้งหมด', overview.content.lessons_total],
    ['คำถามทั้งหมด', overview.content.questions_total],
    ['รออนุมัติ', overview.content.pending],
  ] as const

  return (
    <Shell title="ภาพรวม" subtitle="ข้อมูลจริงจาก backend admin overview">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {cards.map(([label, value]) => <Metric key={label} label={label} value={value} />)}
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <ChartCard title="สมาชิกแยกตาม Plan" data={charts.plan} />
        <ChartCard title="Paid แยกตาม Program" data={charts.paidProgram} />
        <ChartCard title="นักเรียนแยกตามระดับชั้น" data={charts.grades} />
        <ChartCard title="นักเรียนแยกตามเพศ" data={charts.gender} />
        <ChartCard title="นักเรียนแยกตามอายุ" data={charts.age} />
        <ChartCard title="Content status" data={charts.status} />
      </section>
    </Shell>
  )
}

const genderLabel: Record<string, string> = {
  male: 'ชาย',
  female: 'หญิง',
  other: 'อื่นๆ',
  unknown: 'ไม่ระบุ',
}

function Shell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-3xl font-extrabold text-gray-950">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
      {children}
    </main>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-extrabold text-gray-950">{Number(value || 0).toLocaleString('th-TH')}</p>
    </div>
  )
}

function ChartCard({ title, data }: { title: string; data: Array<{ name: string; value: number }> }) {
  const hasData = data.some((item) => Number(item.value || 0) > 0)
  return (
    <section className="rounded-lg bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-gray-950">{title}</h2>
      {!hasData ? <Empty /> : (
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}

function Empty() {
  return <div className="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-400">ยังไม่มีข้อมูล</div>
}

function ErrorMessage({ message }: { message: string }) {
  return <pre className="whitespace-pre-wrap rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{message}</pre>
}
