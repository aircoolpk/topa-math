'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { meApi, type ReferralSummary } from '@/lib/api/me'

function platformUrls(url: string) {
  const encodedUrl = encodeURIComponent(url)
  const text = encodeURIComponent('ชวนเพื่อนมาเรียนกับ TOPA Math')
  return {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    x: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${text}`,
    line: `https://social-plugins.line.me/lineit/share?url=${encodedUrl}`,
  }
}

export default function ReferralDashboardPage() {
  const [summary, setSummary] = useState<ReferralSummary | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    meApi.getReferralSummary().then(setSummary).catch(() => setError('โหลดข้อมูลชวนเพื่อนไม่สำเร็จ'))
  }, [])

  async function copyLink() {
    if (!summary) return
    await navigator.clipboard.writeText(summary.referral_url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  if (error) return <main className="mx-auto max-w-5xl px-6 py-8"><Banner tone="error">{error}</Banner></main>
  if (!summary) return <main className="mx-auto max-w-5xl px-6 py-8 text-gray-500">กำลังโหลด...</main>

  const urls = platformUrls(summary.referral_url)
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <div>
        <Link href="/dashboard" className="text-sm font-semibold text-primary-600">กลับแดชบอร์ด</Link>
        <h1 className="mt-2 text-3xl font-extrabold text-gray-950">ชวนเพื่อนมาเรียนกับ TOPA Math</h1>
        <p className="mt-1 text-gray-600">เมื่อเพื่อนสมัครและชำระเงินสำเร็จ คุณจะได้รับ Coin</p>
      </div>

      <section className="rounded-2xl border border-primary-100 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-extrabold text-gray-900">ลิงก์ชวนเพื่อนของฉัน</h2>
        <div className="mt-3 rounded-xl bg-gray-50 p-3 text-sm text-gray-700 break-all">{summary.referral_url}</div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={copyLink} className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-bold text-white hover:bg-primary-700">
            {copied ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์'}
          </button>
          <a href={urls.facebook} target="_blank" rel="noreferrer" className={shareButton}>Facebook</a>
          <a href={urls.x} target="_blank" rel="noreferrer" className={shareButton}>X</a>
          <a href={urls.line} target="_blank" rel="noreferrer" className={shareButton}>LINE</a>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Clicks" value={summary.click_count} />
        <Stat label="สมัครแล้ว" value={summary.registered_count} />
        <Stat label="ชำระเงินแล้ว" value={summary.paid_count} />
        <Stat label="เหรียญรออนุมัติ" value={summary.pending_coins} />
        <Stat label="เหรียญที่ใช้ได้" value={summary.active_coins} />
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-extrabold text-gray-900">ประวัติรางวัล</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>{['ประเภท', 'Coin', 'สถานะ', 'วันที่', 'หมายเหตุ'].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {summary.history.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-500">ยังไม่มีประวัติรางวัล</td></tr>}
              {summary.history.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2">{row.type}</td>
                  <td className="px-3 py-2 font-bold">{row.amount}</td>
                  <td className="px-3 py-2">{row.status}</td>
                  <td className="px-3 py-2">{row.created_at ? new Date(row.created_at).toLocaleString('th-TH') : '-'}</td>
                  <td className="px-3 py-2">{row.note || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

const shareButton = 'rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50'

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
