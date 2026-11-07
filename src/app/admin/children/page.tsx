'use client'

import { useEffect, useMemo, useState } from 'react'
import { adminApi, type AdminChildRow } from '@/lib/api/admin'

export default function AdminChildrenPage() {
  const [children, setChildren] = useState<AdminChildRow[]>([])
  const [grade, setGrade] = useState('')
  const [error, setError] = useState('')
  const params = useMemo(() => ({ grade: grade ? Number(grade) : undefined, limit: 200 }), [grade])

  useEffect(() => {
    adminApi.children(params).then((data) => { setChildren(data.children || []); setError('') }).catch(() => setError('โหลดข้อมูลนักเรียนไม่สำเร็จ'))
  }, [params])

  return (
    <main className="mx-auto max-w-7xl space-y-5 px-6 py-8">
      <Header title="นักเรียน" subtitle="โปรไฟล์เด็กทั้งหมด พร้อมชั้นเรียน XP และผู้ปกครอง" />
      {error && <Banner>{error}</Banner>}
      <section className="rounded-lg bg-white p-4 shadow-sm">
        <select value={grade} onChange={(e) => setGrade(e.target.value)} className="rounded-md border border-gray-200 px-3 py-2 text-sm">
          <option value="">ทุกชั้น</option>
          {[1, 2, 3, 4, 5, 6].map((item) => <option key={item} value={item}>ป.{item}</option>)}
        </select>
      </section>
      <Table headers={['ชื่อ', 'ผู้ปกครอง', 'ชั้น', 'XP', 'Level', 'Rank', 'สร้างเมื่อ']}>
        {children.map((child) => (
          <tr key={child.id}>
            <td className="px-4 py-3 font-semibold text-gray-900">{child.nickname || child.name || '-'}</td>
            <td className="px-4 py-3">{child.parent_email || '-'}</td>
            <td className="px-4 py-3">ป.{child.grade ?? child.grade_level ?? '-'}</td>
            <td className="px-4 py-3">{child.xp ?? 0}</td>
            <td className="px-4 py-3">{child.level ?? 1}</td>
            <td className="px-4 py-3">{child.rank || '-'}</td>
            <td className="px-4 py-3">{fmt(child.created_at)}</td>
          </tr>
        ))}
      </Table>
    </main>
  )
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return <div><h1 className="text-3xl font-extrabold text-gray-950">{title}</h1><p className="text-sm text-gray-500">{subtitle}</p></div>
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-lg bg-white shadow-sm"><div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-100 text-sm"><thead className="bg-gray-50 text-left text-xs font-bold uppercase text-gray-500"><tr>{headers.map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{children}</tbody></table></div></div>
}

function Banner({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{children}</div>
}

function fmt(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('th-TH', { dateStyle: 'medium' }) : '-'
}
