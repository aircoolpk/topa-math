'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { adminApi, type AdminReferralResponse } from '@/lib/api/admin'

export default function AdminReferralsPage() {
  const [data, setData] = useState<AdminReferralResponse | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function load() {
    setData(await adminApi.referrals())
  }

  useEffect(() => {
    load().catch(() => setError('โหลดข้อมูล Referral ไม่สำเร็จ'))
  }, [])

  async function updateLedger(ledgerId: string, action: 'approve' | 'reverse') {
    setMessage('')
    setError('')
    try {
      if (action === 'approve') await adminApi.approveReferralCoins(ledgerId)
      else await adminApi.reverseReferralCoins(ledgerId)
      setMessage(action === 'approve' ? 'อนุมัติเหรียญแล้ว' : 'ยกเลิกเหรียญแล้ว')
      await load()
    } catch {
      setError('อัปเดตรางวัลไม่สำเร็จ')
    }
  }

  if (error && !data) return <main className="mx-auto max-w-6xl px-6 py-8"><Banner tone="error">{error}</Banner></main>
  if (!data) return <main className="mx-auto max-w-6xl px-6 py-8 text-gray-500">กำลังโหลด...</main>

  return (
    <main className="mx-auto max-w-7xl space-y-5 px-6 py-8">
      <div>
        <h1 className="text-3xl font-extrabold text-gray-950">Referrals</h1>
        <p className="mt-1 text-gray-600">ตรวจสอบการชวนเพื่อนและอนุมัติ Coin</p>
      </div>
      {message && <Banner tone="success">{message}</Banner>}
      {error && <Banner tone="error">{error}</Banner>}

      <section className="grid gap-3 sm:grid-cols-5">
        <Stat label="Clicks" value={data.summary.clicks} />
        <Stat label="Registered" value={data.summary.registered} />
        <Stat label="Paid" value={data.summary.paid} />
        <Stat label="Pending Coin" value={data.summary.pending_coins} />
        <Stat label="Active Coin" value={data.summary.active_coins} />
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>{['Referrer', 'Referred user', 'Status', 'Coins', 'Reward', 'Created', 'Action'].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">ยังไม่มี referral</td></tr>}
            {data.rows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3">
                  <div>{row.referrer_email || row.referrer_user_id}</div>
                  <Link href={`/admin/users/${row.referrer_user_id}`} className="text-xs font-semibold text-primary-600">view user</Link>
                </td>
                <td className="px-4 py-3">
                  {row.referred_user_id ? <Link href={`/admin/users/${row.referred_user_id}`} className="font-semibold text-primary-600">{row.referred_email || row.referred_user_id}</Link> : '-'}
                </td>
                <td className="px-4 py-3">{row.status}</td>
                <td className="px-4 py-3 font-bold">{row.coins_awarded || 0}</td>
                <td className="px-4 py-3">{row.reward_status || '-'}</td>
                <td className="px-4 py-3">{row.created_at ? new Date(row.created_at).toLocaleString('th-TH') : '-'}</td>
                <td className="px-4 py-3">
                  {row.ledger_id ? (
                    <div className="flex gap-2">
                      <button onClick={() => updateLedger(row.ledger_id!, 'approve')} className={buttonClass}>approve</button>
                      <button onClick={() => updateLedger(row.ledger_id!, 'reverse')} className={buttonClass}>reverse</button>
                    </div>
                  ) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  )
}

const buttonClass = 'rounded-md border border-gray-200 px-2 py-1 text-xs font-bold text-gray-700 hover:bg-gray-50'

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="text-2xl font-black text-gray-950">{value.toLocaleString()}</div>
      <div className="mt-1 text-sm font-semibold text-gray-500">{label}</div>
    </div>
  )
}

function Banner({ tone, children }: { tone: 'error' | 'success'; children: React.ReactNode }) {
  const cls = tone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'
  return <div className={`rounded-lg border px-4 py-3 text-sm font-semibold ${cls}`}>{children}</div>
}
