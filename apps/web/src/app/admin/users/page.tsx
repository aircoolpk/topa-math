'use client'

import { useEffect, useMemo, useState } from 'react'
import { adminApi, type AdminPlanPayload, type AdminUserRow } from '@/lib/api/admin'

type ModalMode = 'view' | 'role' | 'plan' | null

const PLAN_OPTIONS = [
  { value: 'free', label: 'Free' },
  { value: 'thp', label: 'THP' },
  { value: 'ep', label: 'EP' },
  { value: 'family', label: 'Family' },
  { value: 'reviewer', label: 'Reviewer' },
] as const

const PROGRAM_OPTIONS = [
  { value: 'FREE', label: 'FREE' },
  { value: 'THP', label: 'THP' },
  { value: 'EP', label: 'EP' },
  { value: 'BOTH', label: 'BOTH' },
] as const

const STATUS_OPTIONS = [
  { value: 'free', label: 'Free' },
  { value: 'active', label: 'Active' },
  { value: 'trial', label: 'Trial' },
  { value: 'manual_grant', label: 'สิทธิ์ทดลองโดยแอดมิน' },
  { value: 'expired', label: 'Expired' },
  { value: 'canceled', label: 'Canceled' },
] as const

const DURATION_OPTIONS = [
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '180', label: '180 days' },
  { value: '365', label: '365 days' },
  { value: 'custom', label: 'Custom date' },
] as const

const ROLE_OPTIONS = ['parent', 'admin', 'owner', 'editor', 'viewer']

const REASON_OPTIONS = [
  'reviewer access',
  'marketing demo',
  'customer support',
  'manual payment',
  'internal test',
]

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [mock, setMock] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<AdminUserRow | null>(null)
  const [modalMode, setModalMode] = useState<ModalMode>(null)
  const [roleValue, setRoleValue] = useState('parent')
  const [roleNote, setRoleNote] = useState('')
  const [planForm, setPlanForm] = useState<AdminPlanPayload>({
    plan_type: 'free',
    program_type: 'FREE',
    subscription_status: 'free',
    access_ends_at: null,
    admin_note: '',
    manual_grant_reason: 'reviewer access',
  })
  const [duration, setDuration] = useState('30')

  const loadUsers = async () => {
    setLoading(true)
    setError('')
    try {
      await adminApi.expireOverdueSubscriptions().catch(() => null)
      const data = await adminApi.users()
      setUsers(Array.isArray(data.users) ? data.users : [])
      setMock(false)
    } catch {
      setMock(true)
      setUsers([])
      setError('โหลดรายชื่อผู้ใช้ไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const selectedRemaining = useMemo(() => remainingTimeLabel(selected?.access_ends_at), [selected])

  const openModal = (user: AdminUserRow, mode: ModalMode) => {
    setSelected(user)
    setModalMode(mode)
    setMessage('')
    setError('')
    setRoleValue(user.role || 'parent')
    setRoleNote('')
    setDuration('30')
    setPlanForm({
      plan_type: normalizePlanType(user.plan_type),
      program_type: normalizeProgramType(user.program_type),
      subscription_status: normalizeStatus(user.subscription_status),
      access_ends_at: user.access_ends_at || user.current_period_end || null,
      admin_note: user.admin_note || '',
      manual_grant_reason: user.manual_grant_reason || 'reviewer access',
    })
  }

  const closeModal = () => {
    setSelected(null)
    setModalMode(null)
    setSaving(false)
  }

  const refreshAfter = async (successText: string) => {
    await loadUsers()
    setMessage(successText)
    closeModal()
  }

  const handleChangeRole = async () => {
    if (!selected) return
    setSaving(true)
    try {
      await adminApi.changeUserRole(selected.user_id, roleValue, roleNote)
      await refreshAfter('เปลี่ยนสิทธิ์ผู้ใช้สำเร็จ')
    } catch {
      setError('เปลี่ยนสิทธิ์ไม่สำเร็จ')
      setSaving(false)
    }
  }

  const handleChangePlan = async () => {
    if (!selected) return
    setSaving(true)
    try {
      await adminApi.changeUserPlan(selected.user_id, planForm)
      await refreshAfter('เปลี่ยนแพ็กเกจสำเร็จ')
    } catch {
      setError('เปลี่ยนแพ็กเกจไม่สำเร็จ')
      setSaving(false)
    }
  }

  const handleAction = async (user: AdminUserRow, action: 'extend' | 'cancel' | 'reactivate' | 'free') => {
    setSaving(true)
    setError('')
    try {
      if (action === 'extend') await adminApi.extendUserSubscription(user.user_id, 30, 'extend from admin users page')
      if (action === 'cancel') await adminApi.cancelUserSubscription(user.user_id, 'cancel from admin users page')
      if (action === 'reactivate') await adminApi.reactivateUserSubscription(user.user_id, 30, 'reactivate from admin users page')
      if (action === 'free') await adminApi.setUserFree(user.user_id, 'set free from admin users page')
      await loadUsers()
      setMessage(actionMessage(action))
    } catch {
      setError('ทำรายการไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-5 px-6 py-8">
      <Header title="Users" subtitle="จัดการบทบาท แพ็กเกจ สิทธิ์ทดลอง และวันหมดอายุของผู้ใช้" mock={mock} />

      {message && <Banner tone="success">{message}</Banner>}
      {error && <Banner tone="error">{error}</Banner>}

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {loading ? 'กำลังโหลด...' : `ทั้งหมด ${users.length} ผู้ใช้`}
        </p>
        <button
          onClick={loadUsers}
          disabled={loading || saving}
          className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          รีเฟรช
        </button>
      </div>

      <Table>
        <thead className="bg-gray-50 text-left text-xs font-bold uppercase text-gray-500">
          <tr>
            {['User', 'Role', 'Subscription', 'Plan', 'Program', 'Period End', 'เหลือเวลา', 'Children', 'Created', 'Actions'].map((head) => (
              <th key={head} className="px-4 py-3">{head}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {users.map((user) => (
            <tr key={user.user_id} className="align-top">
              <td className="px-4 py-3">
                <p className="font-semibold text-gray-900">{user.name || 'User'}</p>
                <p className="text-xs text-gray-500">{user.email || user.user_id}</p>
                {user.admin_note && <p className="mt-1 text-xs text-amber-700">{user.admin_note}</p>}
              </td>
              <td className="px-4 py-3"><Badge>{user.role || 'parent'}</Badge></td>
              <td className="px-4 py-3"><StatusBadge status={user.subscription_status} /></td>
              <td className="px-4 py-3">{planLabel(user.plan_type, user.plan_name)}</td>
              <td className="px-4 py-3">{user.program_type || 'FREE'}</td>
              <td className="px-4 py-3">{fmt(user.access_ends_at || user.current_period_end)}</td>
              <td className="px-4 py-3">{remainingTimeLabel(user.access_ends_at || user.current_period_end)}</td>
              <td className="px-4 py-3">{user.number_of_child_profiles ?? 0}</td>
              <td className="px-4 py-3">{fmt(user.created_at)}</td>
              <td className="px-4 py-3">
                <div className="flex min-w-[360px] flex-wrap gap-2">
                  <ActionButton onClick={() => openModal(user, 'view')}>View</ActionButton>
                  <ActionButton onClick={() => openModal(user, 'role')}>เปลี่ยนสิทธิ์</ActionButton>
                  <ActionButton onClick={() => openModal(user, 'plan')}>เปลี่ยนแพ็กเกจ</ActionButton>
                  <ActionButton onClick={() => handleAction(user, 'extend')} disabled={saving}>ต่ออายุ</ActionButton>
                  <ActionButton onClick={() => handleAction(user, 'cancel')} disabled={saving}>ยกเลิกสิทธิ์</ActionButton>
                  <ActionButton onClick={() => handleAction(user, 'reactivate')} disabled={saving}>Reactivate</ActionButton>
                  <ActionButton danger onClick={() => handleAction(user, 'free')} disabled={saving}>คืนเป็น Free</ActionButton>
                </div>
              </td>
            </tr>
          ))}
          {!loading && users.length === 0 && (
            <tr>
              <td className="px-4 py-8 text-center text-sm text-gray-500" colSpan={10}>
                ไม่พบข้อมูลผู้ใช้
              </td>
            </tr>
          )}
        </tbody>
      </Table>

      {selected && modalMode === 'view' && (
        <Modal title="รายละเอียดผู้ใช้" onClose={closeModal}>
          <UserSummary user={selected} remaining={selectedRemaining} />
        </Modal>
      )}

      {selected && modalMode === 'role' && (
        <Modal title="เปลี่ยนสิทธิ์ผู้ใช้" onClose={closeModal}>
          <UserSummary user={selected} remaining={selectedRemaining} />
          <div className="mt-5 space-y-3">
            <Field label="Role">
              <select value={roleValue} onChange={(e) => setRoleValue(e.target.value)} className={inputClass}>
                {ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
            </Field>
            <Field label="เหตุผลการเปลี่ยนสิทธิ์">
              <textarea value={roleNote} onChange={(e) => setRoleNote(e.target.value)} className={inputClass} rows={3} />
            </Field>
            <ModalActions onCancel={closeModal} onSave={handleChangeRole} saving={saving} saveText="บันทึกสิทธิ์" />
          </div>
        </Modal>
      )}

      {selected && modalMode === 'plan' && (
        <Modal title="เปลี่ยนแพ็กเกจ" onClose={closeModal}>
          <UserSummary user={selected} remaining={selectedRemaining} />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="plan_type">
              <select value={planForm.plan_type} onChange={(e) => setPlanForm({ ...planForm, plan_type: e.target.value as AdminPlanPayload['plan_type'] })} className={inputClass}>
                {PLAN_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Field>
            <Field label="program_type">
              <select value={planForm.program_type} onChange={(e) => setPlanForm({ ...planForm, program_type: e.target.value as AdminPlanPayload['program_type'] })} className={inputClass}>
                {PROGRAM_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Field>
            <Field label="subscription_status">
              <select value={planForm.subscription_status} onChange={(e) => setPlanForm({ ...planForm, subscription_status: e.target.value as AdminPlanPayload['subscription_status'] })} className={inputClass}>
                {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Field>
            <Field label="access duration">
              <select
                value={duration}
                onChange={(e) => {
                  const next = e.target.value
                  setDuration(next)
                  if (next !== 'custom') setPlanForm({ ...planForm, access_ends_at: dateAfter(Number(next)) })
                }}
                className={inputClass}
              >
                {DURATION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Field>
            <Field label="custom end date">
              <input
                type="datetime-local"
                value={toLocalInput(planForm.access_ends_at)}
                onChange={(e) => {
                  setDuration('custom')
                  setPlanForm({ ...planForm, access_ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })
                }}
                className={inputClass}
              />
            </Field>
            <Field label="เหตุผลการให้สิทธิ์">
              <select value={planForm.manual_grant_reason || ''} onChange={(e) => setPlanForm({ ...planForm, manual_grant_reason: e.target.value })} className={inputClass}>
                {REASON_OPTIONS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
              </select>
            </Field>
            <div className="md:col-span-2">
              <Field label="admin note / reason">
                <textarea
                  value={planForm.admin_note || ''}
                  onChange={(e) => setPlanForm({ ...planForm, admin_note: e.target.value })}
                  className={inputClass}
                  rows={3}
                />
              </Field>
            </div>
          </div>
          <ModalActions onCancel={closeModal} onSave={handleChangePlan} saving={saving} saveText="บันทึกแพ็กเกจ" />
        </Modal>
      )}
    </main>
  )
}

function Header({ title, subtitle, mock }: { title: string; subtitle: string; mock?: boolean }) {
  return (
    <div>
      <h1 className="text-3xl font-extrabold text-gray-950">{title}</h1>
      <p className="text-sm text-gray-500">{subtitle}</p>
      {mock && <p className="mt-2 text-sm font-semibold text-amber-700">Mock fallback active</p>}
    </div>
  )
}

function Table({ children }: { children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-lg bg-white shadow-sm"><div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-100 text-sm">{children}</table></div></div>
}

function ActionButton({ children, danger, disabled, onClick }: { children: React.ReactNode; danger?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
        danger
          ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  )
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-gray-950">{title}</h2>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-sm font-bold text-gray-500 hover:bg-gray-100">ปิด</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function UserSummary({ user, remaining }: { user: AdminUserRow; remaining: string }) {
  return (
    <div className="grid gap-3 rounded-lg bg-gray-50 p-4 text-sm md:grid-cols-2">
      <Info label="ชื่อ/อีเมล" value={`${user.name || 'User'} / ${user.email || user.user_id}`} />
      <Info label="Current role" value={user.role || 'parent'} />
      <Info label="Current plan" value={planLabel(user.plan_type, user.plan_name)} />
      <Info label="Current subscription status" value={user.subscription_status || 'none'} />
      <Info label="Current access end date" value={fmt(user.access_ends_at || user.current_period_end)} />
      <Info label="Remaining days" value={remaining} />
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-bold uppercase text-gray-400">{label}</p><p className="font-semibold text-gray-800">{value}</p></div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-bold text-gray-500">{label}</span>{children}</label>
}

function ModalActions({ onCancel, onSave, saving, saveText }: { onCancel: () => void; onSave: () => void; saving: boolean; saveText: string }) {
  return (
    <div className="mt-6 flex justify-end gap-3">
      <button onClick={onCancel} className="rounded-md border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">ยกเลิก</button>
      <button onClick={onSave} disabled={saving} className="rounded-md bg-primary-600 px-4 py-2 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-50">
        {saving ? 'กำลังบันทึก...' : saveText}
      </button>
    </div>
  )
}

function Banner({ children, tone }: { children: React.ReactNode; tone: 'success' | 'error' }) {
  return (
    <div className={`rounded-lg px-4 py-3 text-sm font-semibold ${tone === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
      {children}
    </div>
  )
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">{children}</span>
}

function StatusBadge({ status }: { status?: string | null }) {
  const value = status || 'none'
  const color = value === 'active' || value === 'manual_grant'
    ? 'bg-green-50 text-green-700'
    : value === 'expired' || value === 'canceled'
      ? 'bg-red-50 text-red-700'
      : 'bg-gray-100 text-gray-700'
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${color}`}>{statusLabel(value)}</span>
}

const inputClass = 'w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none'

function fmt(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('th-TH', { dateStyle: 'medium' }) : '-'
}

function normalizePlanType(value?: string | null): AdminPlanPayload['plan_type'] {
  if (value === 'thp' || value === 'ep' || value === 'family' || value === 'reviewer') return value
  return 'free'
}

function normalizeProgramType(value?: string | null): AdminPlanPayload['program_type'] {
  if (value === 'THP' || value === 'EP' || value === 'BOTH') return value
  return 'FREE'
}

function normalizeStatus(value?: string | null): AdminPlanPayload['subscription_status'] {
  if (value === 'active' || value === 'trial' || value === 'manual_grant' || value === 'expired' || value === 'canceled') return value
  return 'free'
}

function dateAfter(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

function toLocalInput(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function remainingTimeLabel(value?: string | null) {
  if (!value) return 'no expiry'
  const end = new Date(value).getTime()
  if (Number.isNaN(end)) return 'no expiry'
  const diff = end - Date.now()
  if (diff <= 0) return 'หมดอายุแล้ว'
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days >= 1) return `${days} days left`
  const hours = Math.max(1, Math.floor(diff / (1000 * 60 * 60)))
  return `${hours} hours left`
}

function planLabel(planType?: string | null, planName?: string | null) {
  if (planType === 'reviewer') return 'Reviewer'
  if (planType === 'family') return 'Family'
  if (planType === 'ep') return 'EP'
  if (planType === 'thp') return 'THP'
  return planName || 'Free'
}

function statusLabel(status: string) {
  if (status === 'manual_grant') return 'สิทธิ์ทดลองโดยแอดมิน'
  if (status === 'expired') return 'หมดอายุแล้ว'
  if (status === 'canceled') return 'ยกเลิกแล้ว'
  if (status === 'trial') return 'ทดลองใช้'
  if (status === 'active') return 'ใช้งานอยู่'
  if (status === 'free') return 'Free'
  return status
}

function actionMessage(action: 'extend' | 'cancel' | 'reactivate' | 'free') {
  if (action === 'extend') return 'ต่ออายุผู้ใช้สำเร็จ'
  if (action === 'cancel') return 'ยกเลิกสิทธิ์ผู้ใช้สำเร็จ'
  if (action === 'reactivate') return 'Reactivate ผู้ใช้สำเร็จ'
  return 'คืนผู้ใช้เป็น Free สำเร็จ'
}
