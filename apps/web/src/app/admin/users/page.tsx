'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { adminApi, type AdminUserRow } from '@/lib/api/admin'

const plans = ['', 'free', 'reviewer', 'founder', 'plus', 'pro']
const roles = ['', 'user', 'reviewer', 'admin']

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [search, setSearch] = useState('')
  const [plan, setPlan] = useState('')
  const [role, setRole] = useState('')
  const [active, setActive] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const params = useMemo(() => ({
    search: search || undefined,
    plan: plan || undefined,
    role: role || undefined,
    active: active === '' ? undefined : active === 'true',
    limit: 100,
  }), [search, plan, role, active])

  useEffect(() => {
    const id = window.setTimeout(() => {
      adminApi.users(params).then((data) => { setUsers(data.users || []); setError('') }).catch(() => setError('โหลดรายชื่อผู้ใช้ไม่สำเร็จ'))
    }, 150)
    return () => window.clearTimeout(id)
  }, [params])

  async function toggleActive(user: AdminUserRow) {
    const next = !(user.is_active ?? true)
    if (!window.confirm(`${next ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}บัญชี ${user.email}?`)) return
    const updated = await adminApi.changeUserActive(user.user_id, next, 'admin dashboard active toggle')
    setUsers((rows) => rows.map((row) => row.user_id === updated.user_id ? { ...row, ...updated } : row))
    setMessage('บันทึกสถานะแล้ว')
  }

  return (
    <main className="mx-auto max-w-7xl space-y-5 px-6 py-8">
      <Header title="ผู้ใช้" subtitle="ค้นหา กรอง และจัดการสิทธิ์ผู้ใช้แบบไม่เปิดเผยข้อมูลลับ" />
      {message && <Banner tone="success">{message}</Banner>}
      {error && <Banner tone="error">{error}</Banner>}

      <section className="grid gap-3 rounded-lg bg-white p-4 shadow-sm md:grid-cols-4">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาอีเมล" className={inputClass} />
        <select value={plan} onChange={(e) => setPlan(e.target.value)} className={inputClass}>{plans.map((item) => <option key={item} value={item}>{item || 'ทุกแผน'}</option>)}</select>
        <select value={role} onChange={(e) => setRole(e.target.value)} className={inputClass}>{roles.map((item) => <option key={item} value={item}>{item || 'ทุกบทบาท'}</option>)}</select>
        <select value={active} onChange={(e) => setActive(e.target.value)} className={inputClass}>
          <option value="">ทุกสถานะ</option>
          <option value="true">เปิดใช้งาน</option>
          <option value="false">ปิดใช้งาน</option>
        </select>
      </section>

      <div className="overflow-hidden rounded-lg bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-bold uppercase text-gray-500">
              <tr>{['Email', 'Role', 'Plan', 'Expires', 'Active', 'Created', 'Children', 'Actions'].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user) => (
                <tr key={user.user_id} className="align-top">
                  <td className="px-4 py-3"><p className="font-semibold text-gray-900">{user.email}</p><p className="font-mono text-xs text-gray-400">{user.user_id}</p></td>
                  <td className="px-4 py-3"><Badge>{user.role || 'user'}</Badge></td>
                  <td className="px-4 py-3">{user.plan || 'free'}</td>
                  <td className="px-4 py-3">{fmt(user.plan_expires_at)}</td>
                  <td className="px-4 py-3">{user.is_active === false ? <Badge tone="red">disabled</Badge> : <Badge tone="green">active</Badge>}</td>
                  <td className="px-4 py-3">{fmt(user.created_at)}</td>
                  <td className="px-4 py-3">{user.children_count ?? user.number_of_child_profiles ?? 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex min-w-[190px] flex-wrap gap-2">
                      <Link href={`/admin/users/${user.user_id}`} className={buttonClass}>ดู</Link>
                      <button onClick={() => toggleActive(user)} className={buttonClass}>{user.is_active === false ? 'เปิด' : 'ปิด'}</button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && <tr><td className="px-4 py-8 text-center text-gray-500" colSpan={8}>ไม่พบผู้ใช้</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}

const inputClass = 'rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-primary-400'
const buttonClass = 'rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50'

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return <div><h1 className="text-3xl font-extrabold text-gray-950">{title}</h1><p className="text-sm text-gray-500">{subtitle}</p></div>
}

function Badge({ children, tone = 'gray' }: { children: React.ReactNode; tone?: 'gray' | 'green' | 'red' }) {
  const color = tone === 'green' ? 'bg-green-50 text-green-700' : tone === 'red' ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-700'
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${color}`}>{children}</span>
}

function Banner({ tone, children }: { tone: 'error' | 'success'; children: React.ReactNode }) {
  return <div className={`rounded-lg px-4 py-3 text-sm font-semibold ${tone === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{children}</div>
}

function fmt(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('th-TH', { dateStyle: 'medium' }) : '-'
}
