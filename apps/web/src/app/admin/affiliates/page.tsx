'use client'

import { useEffect, useState } from 'react'
import { adminApi, type AdminAffiliateResponse } from '@/lib/api/admin'

function money(minor: number) {
  return (minor / 100).toLocaleString('th-TH', { style: 'currency', currency: 'THB' })
}

function dateLabel(value?: string | null) {
  return value ? new Date(value).toLocaleString('th-TH') : '-'
}

export default function AdminAffiliatesPage() {
  const [data, setData] = useState<AdminAffiliateResponse | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')

  async function load() {
    setData(await adminApi.affiliates())
  }

  useEffect(() => {
    load().catch(() => setError('โหลดข้อมูล Affiliate ไม่สำเร็จ'))
  }, [])

  async function action(id: string, value: 'approve' | 'processing' | 'paid' | 'reject') {
    setBusy(id + value)
    try {
      await adminApi.updateAffiliateWithdrawal(id, value)
      await load()
    } catch {
      setError('อัปเดตคำขอถอนไม่สำเร็จ')
    } finally {
      setBusy('')
    }
  }

  if (!data && !error) return <main className="p-8 text-gray-500">Loading...</main>

  return (
    <main className="space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="text-3xl font-extrabold text-gray-950">Affiliate</h1>
        <p className="mt-1 text-sm text-gray-500">ตรวจสอบผู้แนะนำ ค่าคอมมิชชัน และคำขอถอนเงิน</p>
      </div>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}
      {data && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="ผู้สมัคร" value={data.summary.registered.toLocaleString('th-TH')} />
            <Stat label="สมาชิกที่จ่ายเงิน" value={data.summary.paid_members.toLocaleString('th-TH')} />
            <Stat label="ค่าคอมมิชชันรวม" value={money(data.summary.total_commission_minor)} />
            <Stat label="Available balance" value={money(data.summary.available_balance_minor)} />
          </section>

          <Table title="รายชื่อ Affiliate" headers={['Affiliate', 'สมัคร', 'จ่ายเงิน', 'ยอดชำระ', 'คอมมิชชัน', 'Available', 'Withdrawn']}>
            {data.affiliates.length === 0 && <Empty colSpan={7} />}
            {data.affiliates.map((row) => (
              <tr key={row.user_id}>
                <td className={td}>{row.email_masked || row.user_id}</td>
                <td className={td}>{row.registered_count}</td>
                <td className={td}>{row.paid_member_count}</td>
                <td className={td}>{money(row.total_referred_paid_minor)}</td>
                <td className={td}>{money(row.total_commission_minor)}</td>
                <td className={td}>{money(row.available_balance_minor)}</td>
                <td className={td}>{money(row.withdrawn_balance_minor)}</td>
              </tr>
            ))}
          </Table>

          <Table title="คำขอถอนเงิน" headers={['Affiliate', 'บัญชีรับเงิน', 'ยอด', 'สถานะ', 'วันที่ขอ', 'การจัดการ']}>
            {data.withdrawals.length === 0 && <Empty colSpan={6} />}
            {data.withdrawals.map((row) => (
              <tr key={row.id}>
                <td className={td}>{row.email_masked || row.user_id}</td>
                <td className={td}>
                  {row.payout_account ? `${row.payout_account.payout_method === 'bank' ? row.payout_account.bank_name : 'PromptPay'} ${row.payout_account.account_masked || row.payout_account.promptpay_masked || ''}` : '-'}
                </td>
                <td className={td}>{money(row.amount_minor)}</td>
                <td className={td}>{row.status}</td>
                <td className={td}>{dateLabel(row.requested_at)}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    <button disabled={!!busy || row.status !== 'pending_review'} onClick={() => action(row.id, 'approve')} className={buttonClass}>อนุมัติ</button>
                    <button disabled={!!busy || !['approved', 'pending_review'].includes(row.status)} onClick={() => action(row.id, 'processing')} className={buttonClass}>กำลังโอน</button>
                    <button disabled={!!busy || !['approved', 'processing'].includes(row.status)} onClick={() => action(row.id, 'paid')} className={buttonClass}>โอนแล้ว</button>
                    <button disabled={!!busy || row.status === 'paid' || row.status === 'rejected'} onClick={() => action(row.id, 'reject')} className={dangerButtonClass}>ปฏิเสธ</button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>

          <Table title="ประวัติค่าคอมมิชชันล่าสุด" headers={['Affiliate', 'ผู้ถูกแนะนำ', 'ยอดชำระ', 'คอมมิชชัน', 'สถานะ', 'วันที่']}>
            {data.recent_commissions.length === 0 && <Empty colSpan={6} />}
            {data.recent_commissions.map((row) => (
              <tr key={row.id}>
                <td className={td}>{row.affiliate_email_masked || '-'}</td>
                <td className={td}>{row.referred_email_masked || '-'}</td>
                <td className={td}>{money(row.amount_paid_minor)}</td>
                <td className={td}>{money(row.commission_minor)}</td>
                <td className={td}>{row.status}</td>
                <td className={td}>{dateLabel(row.created_at)}</td>
              </tr>
            ))}
          </Table>
        </>
      )}
    </main>
  )
}

const td = 'px-3 py-2 text-sm text-gray-700'
const buttonClass = 'rounded-md bg-sky-600 px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-40'
const dangerButtonClass = 'rounded-md bg-red-600 px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-40'

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm"><div className="text-xl font-black text-gray-950">{value}</div><div className="mt-1 text-sm font-semibold text-gray-500">{label}</div></div>
}

function Table({ title, headers, children }: { title: string; headers: string[]; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-extrabold text-gray-950">{title}</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr>{headers.map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">{children}</tbody>
        </table>
      </div>
    </section>
  )
}

function Empty({ colSpan }: { colSpan: number }) {
  return <tr><td colSpan={colSpan} className="px-3 py-8 text-center text-sm text-gray-500">ยังไม่มีข้อมูล</td></tr>
}
