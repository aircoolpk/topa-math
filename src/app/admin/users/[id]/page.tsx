'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { adminApi, type AdminPlanPayload } from '@/lib/api/admin'

type UserDetail = Awaited<ReturnType<typeof adminApi.getUser>>
type PlanType = NonNullable<AdminPlanPayload['plan_type']>
type ProgramType = NonNullable<AdminPlanPayload['program_type']>
type SubscriptionStatus = NonNullable<AdminPlanPayload['subscription_status']>

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>()
  const [detail, setDetail] = useState<UserDetail | null>(null)
  const [plan, setPlan] = useState<AdminPlanPayload['plan']>('free')
  const [planType, setPlanType] = useState<PlanType>('free')
  const [programType, setProgramType] = useState<ProgramType>('FREE')
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>('free')
  const [expires, setExpires] = useState('')
  const [role, setRole] = useState('user')
  const [active, setActive] = useState(true)
  const [savingPlan, setSavingPlan] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function load() {
    const data = await adminApi.getUser(params.id)
    const subscription = data.subscription_summary ?? {}
    const user = data.user ?? {}
    const loadedProgram = (asString(subscription.program_type) || user.program_type || 'FREE') as ProgramType
    const loadedPlanType = (asString(subscription.plan_type) || user.plan_type || programToPlanType(loadedProgram)) as PlanType

    setDetail(data)
    setPlan(((data.profile.plan || user.plan || 'free') as AdminPlanPayload['plan']) || 'free')
    setPlanType(loadedPlanType)
    setProgramType(loadedProgram)
    setSubscriptionStatus(((asString(subscription.subscription_status) || user.subscription_status || 'free') as SubscriptionStatus) || 'free')
    setExpires(toDateInput(asString(subscription.access_ends_at) || asString(subscription.current_period_end) || data.profile.plan_expires_at))
    setRole(data.profile.role || 'user')
    setActive(data.profile.is_active !== false)
  }

  useEffect(() => {
    load().catch(() => setError('โหลดรายละเอียดผู้ใช้ไม่สำเร็จ'))
  }, [params.id])

  function applyProgram(next: ProgramType) {
    setProgramType(next)
    setPlanType(programToPlanType(next))
    setPlan(next === 'FREE' ? 'free' : 'plus')
    if (next === 'FREE') setSubscriptionStatus('free')
    else if (subscriptionStatus === 'free') setSubscriptionStatus('active')
  }

  function applyThirtyDays() {
    const date = new Date()
    date.setDate(date.getDate() + 30)
    setExpires(toDateInput(date.toISOString()))
    setPlan('plus')
    if (programType === 'FREE') applyProgram('THP')
    setSubscriptionStatus('active')
  }

  async function savePlan() {
    const planExpiresAt = expires ? new Date(expires).toISOString() : null
    setSavingPlan(true)
    setMessage('')
    setError('')
    try {
      await adminApi.changeUserPlan(params.id, {
        plan,
        plan_type: planType,
        program_type: programType,
        subscription_status: subscriptionStatus,
        plan_expires_at: planExpiresAt,
        access_ends_at: planExpiresAt,
        reason: `manual admin approval: ${planType}/${programType}/${subscriptionStatus}`,
        note: 'manual admin edit',
        admin_note: 'manual admin edit',
        manual_grant_reason: subscriptionStatus === 'active' ? 'manual beta approval' : undefined,
      })
      setMessage('บันทึกแพ็กเกจสำเร็จ ผู้ใช้จะเห็นสิทธิ์ใหม่หลังรีเฟรช')
      await load()
    } catch {
      setError('บันทึกแพ็กเกจไม่สำเร็จ กรุณาตรวจค่า Plan, Program, Status และวันหมดอายุ')
    } finally {
      setSavingPlan(false)
    }
  }

  async function saveRole() {
    if (!window.confirm(`เปลี่ยนบทบาทเป็น ${role}?`)) return
    try {
      await adminApi.changeUserRole(params.id, role, 'admin dashboard role update')
      setMessage('บันทึกบทบาทแล้ว')
      setError('')
      await load()
    } catch {
      setError('บันทึกบทบาทไม่สำเร็จ')
    }
  }

  async function saveActive() {
    if (!window.confirm(`${active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}บัญชีนี้?`)) return
    try {
      await adminApi.changeUserActive(params.id, active, 'admin dashboard active update')
      setMessage('บันทึกสถานะบัญชีแล้ว')
      setError('')
      await load()
    } catch {
      setError('บันทึกสถานะบัญชีไม่สำเร็จ')
    }
  }

  if (!detail && error) return <main className="mx-auto max-w-5xl px-6 py-8"><Banner tone="error">{error}</Banner></main>
  if (!detail) return <main className="mx-auto max-w-5xl px-6 py-8 text-sm text-gray-500">กำลังโหลด...</main>

  const subscription = detail.subscription_summary ?? {}
  const user = detail.user ?? {}

  return (
    <main className="mx-auto max-w-6xl space-y-5 px-6 py-8">
      <div>
        <Link href="/admin/users" className="text-sm font-semibold text-primary-600">กลับรายชื่อผู้ใช้</Link>
        <h1 className="mt-2 text-3xl font-extrabold text-gray-950">{detail.profile.email}</h1>
        <p className="font-mono text-xs text-gray-400">{detail.profile.user_id}</p>
      </div>
      {message && <Banner tone="success">{message}</Banner>}
      {error && <Banner tone="error">{error}</Banner>}

      <section className="grid gap-4 lg:grid-cols-3">
        <Panel title="โปรไฟล์">
          <Info label="Role" value={detail.profile.role || '-'} />
          <Info label="Plan" value={user.plan || detail.profile.plan || 'free'} />
          <Info label="Plan Type" value={asString(subscription.plan_type) || user.plan_type || '-'} />
          <Info label="Program" value={asString(subscription.program_type) || user.program_type || '-'} />
          <Info label="Subscription" value={asString(subscription.subscription_status) || user.subscription_status || '-'} />
          <Info label="หมดอายุ" value={fmt(asString(subscription.access_ends_at) || asString(subscription.current_period_end) || detail.profile.plan_expires_at)} />
          <Info label="Active" value={detail.profile.is_active === false ? 'disabled' : 'active'} />
          <Info label="สมัครเมื่อ" value={fmt(detail.profile.created_at)} />
          <Info label="เข้าใช้ล่าสุด" value={fmt(detail.profile.last_login_at)} />
        </Panel>

        <Panel title="อนุมัติแพ็กเกจด้วยมือ">
          <Field label="Plan">
            <select value={plan} onChange={(e) => setPlan(e.target.value as AdminPlanPayload['plan'])} className={inputClass}>
              <option value="free">Free</option>
              <option value="plus">Plus</option>
            </select>
          </Field>
          <Field label="Program">
            <select value={programType} onChange={(e) => applyProgram(e.target.value as ProgramType)} className={inputClass}>
              <option value="FREE">Free</option>
              <option value="THP">Plus TH</option>
              <option value="EP">Plus EP</option>
            </select>
          </Field>
          <Field label="Status">
            <select value={subscriptionStatus} onChange={(e) => setSubscriptionStatus(e.target.value as SubscriptionStatus)} className={inputClass}>
              <option value="free">Free</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
            </select>
          </Field>
          <Field label="หมดอายุ">
            <input type="datetime-local" value={expires} onChange={(e) => setExpires(e.target.value)} className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={applyThirtyDays} className={secondaryButton}>Plus 30 วัน</button>
            <button onClick={savePlan} disabled={savingPlan} className={`${primaryButton} disabled:opacity-50`}>
              {savingPlan ? 'กำลังบันทึก...' : 'บันทึกแพ็กเกจ'}
            </button>
          </div>
        </Panel>

        <Panel title="สิทธิ์และสถานะ">
          <Field label="Role">
            <select value={role} onChange={(e) => setRole(e.target.value)} className={inputClass}>
              {['user', 'reviewer', 'admin'].map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </Field>
          <button onClick={saveRole} className={primaryButton}>บันทึกบทบาท</button>
          <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            เปิดใช้งานบัญชี
          </label>
          <button onClick={saveActive} className={secondaryButton}>บันทึกสถานะ</button>
        </Panel>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="นักเรียน">
          <Table headers={['ชื่อ', 'ชั้น', 'XP', 'Level']}>
            {detail.children.map((child) => <tr key={child.id}><td className="px-3 py-2">{child.nickname || child.name}</td><td className="px-3 py-2">ป.{child.grade}</td><td className="px-3 py-2">{child.xp ?? 0}</td><td className="px-3 py-2">{child.level ?? 1}</td></tr>)}
          </Table>
        </Panel>
        <Panel title="แบบทดสอบล่าสุด">
          <Table headers={['บทเรียน', 'สถานะ', 'คะแนน', 'เวลา']}>
            {detail.recent_test_sessions.map((test) => <tr key={test.id}><td className="px-3 py-2">{test.lesson_id || '-'}</td><td className="px-3 py-2">{test.status}</td><td className="px-3 py-2">{test.score ? `${test.score.correct_count}/${test.score.total_questions}` : '-'}</td><td className="px-3 py-2">{fmt(test.started_at)}</td></tr>)}
          </Table>
        </Panel>
      </section>
    </main>
  )
}

const inputClass = 'mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400'
const primaryButton = 'mt-4 rounded-md bg-primary-600 px-4 py-2 text-sm font-bold text-white hover:bg-primary-700'
const secondaryButton = 'mt-3 rounded-md border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50'

function programToPlanType(program: ProgramType): PlanType {
  if (program === 'EP') return 'ep'
  if (program === 'THP') return 'thp'
  return 'free'
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-lg bg-white p-5 shadow-sm"><h2 className="mb-4 text-lg font-bold text-gray-950">{title}</h2><div className="space-y-3">{children}</div></section>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs font-bold text-gray-500">{label}{children}</label>
}

function Info({ label, value }: { label: string; value: string | number }) {
  return <div><p className="text-xs font-bold text-gray-400">{label}</p><p className="font-semibold text-gray-800">{value}</p></div>
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr>{headers.map((h) => <th key={h} className="px-3 py-2 text-left text-xs font-bold text-gray-400">{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>
}

function Banner({ tone, children }: { tone: 'error' | 'success'; children: React.ReactNode }) {
  return <div className={`rounded-lg px-4 py-3 text-sm font-semibold ${tone === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{children}</div>
}

function fmt(value?: string | null) {
  return value ? new Date(value).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '-'
}

function toDateInput(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
