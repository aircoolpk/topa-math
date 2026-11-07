'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Copy, Share2 } from 'lucide-react'
import { meApi, type AffiliateSummary } from '@/lib/api/me'

function money(minor: number) {
  return (minor / 100).toLocaleString('th-TH', { style: 'currency', currency: 'THB' })
}

function dateLabel(value?: string | null) {
  return value ? new Date(value).toLocaleString('th-TH') : '-'
}

function platformUrls(url: string) {
  const encodedUrl = encodeURIComponent(url)
  const text = encodeURIComponent('ชวนมาเรียนกับ TOPA Math')
  return {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    x: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${text}`,
    line: `https://social-plugins.line.me/lineit/share?url=${encodedUrl}`,
  }
}

export default function AffiliatePage() {
  const [data, setData] = useState<AffiliateSummary | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [form, setForm] = useState({
    payout_method: 'bank',
    account_holder_name: '',
    bank_name: '',
    account_number: '',
    promptpay_value: '',
  })
  const [withdrawMinor, setWithdrawMinor] = useState(50000)

  async function load() {
    const summary = await meApi.getAffiliateSummary()
    setData(summary)
    setWithdrawMinor(Math.max(summary.min_withdrawal_minor, Math.min(summary.available_balance_minor, summary.min_withdrawal_minor)))
  }

  useEffect(() => {
    load().catch(() => setError('โหลดข้อมูล Affiliate ไม่สำเร็จ'))
  }, [])

  const urls = useMemo(() => platformUrls(data?.referral_url || ''), [data?.referral_url])

  async function copyLink() {
    if (!data) return
    await navigator.clipboard.writeText(data.referral_url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  async function saveAccount() {
    setSaving(true)
    setError('')
    try {
      await meApi.saveAffiliatePayoutAccount(form)
      await load()
    } catch {
      setError('บันทึกบัญชีรับเงินไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  async function withdraw() {
    setWithdrawing(true)
    setError('')
    try {
      await meApi.createAffiliateWithdrawal(withdrawMinor)
      await load()
    } catch {
      setError('ส่งคำขอถอนไม่สำเร็จ ตรวจสอบยอดขั้นต่ำและ Available balance')
    } finally {
      setWithdrawing(false)
    }
  }

  if (!data && !error) return <main className="mx-auto max-w-6xl px-6 py-8 text-slate-500">กำลังโหลด...</main>

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <Link href="/dashboard" className="text-sm font-bold text-sky-700">กลับแดชบอร์ด</Link>
          <h1 className="mt-2 text-3xl font-black text-slate-950">Affiliate</h1>
          <p className="mt-1 text-sm text-slate-600">รับค่าคอมมิชชัน 3% จากยอดชำระสำเร็จของผู้ที่สมัครผ่านลิงก์ของคุณ</p>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}

      {data && (
        <>
          <section className="rounded-lg border border-sky-100 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-950">Referral link</h2>
            <div className="mt-3 break-all rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{data.referral_url}</div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={copyLink} className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-black text-white">
                <Copy className="h-4 w-4" /> {copied ? 'คัดลอกแล้ว' : 'Copy'}
              </button>
              <a href={urls.facebook} target="_blank" rel="noreferrer" className={shareClass}><Share2 className="h-4 w-4" /> Facebook</a>
              <a href={urls.x} target="_blank" rel="noreferrer" className={shareClass}>X</a>
              <a href={urls.line} target="_blank" rel="noreferrer" className={shareClass}>LINE</a>
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="ผู้สมัครผ่านลิงก์" value={data.registered_count.toLocaleString('th-TH')} />
            <Stat label="สมาชิกที่ชำระเงิน" value={data.paid_member_count.toLocaleString('th-TH')} />
            <Stat label="ยอดชำระรวม" value={money(data.total_referred_paid_minor)} />
            <Stat label="ค่าคอมมิชชันรวม" value={money(data.total_commission_minor)} />
            <Stat label="Pending balance" value={money(data.pending_balance_minor)} />
            <Stat label="Available balance" value={money(data.available_balance_minor)} />
            <Stat label="ยอดถอนแล้ว" value={money(data.withdrawn_balance_minor)} />
            <Stat label="ถอนขั้นต่ำ" value={money(data.min_withdrawal_minor)} />
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-100 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black text-slate-950">บัญชีรับเงิน</h2>
              {data.payout_account && (
                <p className="mt-2 text-sm text-slate-600">
                  ปัจจุบัน: {data.payout_account.payout_method === 'bank' ? data.payout_account.bank_name : 'PromptPay'} {data.payout_account.account_masked || data.payout_account.promptpay_masked}
                </p>
              )}
              <div className="mt-4 grid gap-3">
                <select value={form.payout_method} onChange={(e) => setForm({ ...form, payout_method: e.target.value })} className={inputClass}>
                  <option value="bank">บัญชีธนาคาร</option>
                  <option value="promptpay">PromptPay</option>
                </select>
                <input value={form.account_holder_name} onChange={(e) => setForm({ ...form, account_holder_name: e.target.value })} placeholder="ชื่อบัญชี" className={inputClass} />
                {form.payout_method === 'bank' ? (
                  <>
                    <input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} placeholder="ธนาคาร" className={inputClass} />
                    <input value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} placeholder="เลขบัญชี" className={inputClass} />
                  </>
                ) : (
                  <input value={form.promptpay_value} onChange={(e) => setForm({ ...form, promptpay_value: e.target.value })} placeholder="เบอร์โทร/เลขบัตร PromptPay" className={inputClass} />
                )}
                <button onClick={saveAccount} disabled={saving} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:opacity-50">{saving ? 'กำลังบันทึก...' : 'บันทึกบัญชีรับเงิน'}</button>
              </div>
            </div>

            <div className="rounded-lg border border-slate-100 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black text-slate-950">ถอนเงิน</h2>
              <p className="mt-2 text-sm text-slate-600">ถอนจาก Available balance เท่านั้น ระบบจะ reserve ยอดทันทีเมื่อส่งคำขอ</p>
              <div className="mt-4 grid gap-3">
                <input type="number" min={data.min_withdrawal_minor / 100} value={withdrawMinor / 100} onChange={(e) => setWithdrawMinor(Math.round(Number(e.target.value || 0) * 100))} className={inputClass} />
                <button onClick={withdraw} disabled={withdrawing || data.available_balance_minor < data.min_withdrawal_minor} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50">
                  {withdrawing ? 'กำลังส่งคำขอ...' : 'ส่งคำขอถอน'}
                </button>
              </div>
            </div>
          </section>

          <Table title="ประวัติผู้สมัคร" headers={['อีเมล', 'สถานะจ่ายเงิน', 'วันที่สมัคร']}>
            {data.registrations.length === 0 && <Empty colSpan={3} />}
            {data.registrations.map((row) => (
              <tr key={row.user_id}><td className={td}>{row.email_masked || '-'}</td><td className={td}>{row.has_paid ? 'ชำระแล้ว' : 'ยังไม่ชำระ'}</td><td className={td}>{dateLabel(row.created_at)}</td></tr>
            ))}
          </Table>

          <Table title="ประวัติค่าคอมมิชชัน" headers={['ผู้ถูกแนะนำ', 'ยอดชำระ', 'คอมมิชชัน', 'สถานะ', 'Available']}>
            {data.commissions.length === 0 && <Empty colSpan={5} />}
            {data.commissions.map((row) => (
              <tr key={row.id}>
                <td className={td}>{row.referred_email_masked || row.referred_user_id}</td>
                <td className={td}>{money(row.amount_paid_minor)}</td>
                <td className={td}>{money(row.commission_minor)}</td>
                <td className={td}>{row.status}</td>
                <td className={td}>{dateLabel(row.available_at)}</td>
              </tr>
            ))}
          </Table>

          <Table title="ประวัติถอนเงิน" headers={['ยอดถอน', 'สถานะ', 'วันที่ส่งคำขอ', 'วันที่จ่าย', 'หมายเหตุ']}>
            {data.withdrawals.length === 0 && <Empty colSpan={5} />}
            {data.withdrawals.map((row) => (
              <tr key={row.id}><td className={td}>{money(row.amount_minor)}</td><td className={td}>{row.status}</td><td className={td}>{dateLabel(row.requested_at)}</td><td className={td}>{dateLabel(row.paid_at)}</td><td className={td}>{row.admin_note || '-'}</td></tr>
            ))}
          </Table>
        </>
      )}
    </main>
  )
}

const shareClass = 'inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50'
const inputClass = 'rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-500'
const td = 'px-3 py-2 text-sm text-slate-700'

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-slate-100 bg-white p-4 shadow-sm"><div className="text-xl font-black text-slate-950">{value}</div><div className="mt-1 text-sm font-bold text-slate-500">{label}</div></div>
}

function Table({ title, headers, children }: { title: string; headers: string[]; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-100 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black text-slate-950">{title}</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{headers.map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{children}</tbody>
        </table>
      </div>
    </section>
  )
}

function Empty({ colSpan }: { colSpan: number }) {
  return <tr><td colSpan={colSpan} className="px-3 py-8 text-center text-sm text-slate-500">ยังไม่มีข้อมูล</td></tr>
}
