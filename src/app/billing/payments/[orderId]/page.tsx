'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ExternalLink, RefreshCw, Repeat2 } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { getCheckoutErrorMessage, getMppCheckoutUrl } from '@/lib/api/billing'

type Order = { order_id: string; provider: 'mpp'; plan_code: string; amount_minor: number; currency: string; status: string; remote_status: string | null; checkout_url: string | null; merchant_name: string; project_name: string; expires_at: string | null }

export default function PaymentOrderPage({ params }: { params: { orderId: string } }) {
  const [order, setOrder] = useState<Order | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const base = `/billing/mpp/orders/${encodeURIComponent(params.orderId)}`
  useEffect(() => {
    const controller = new AbortController()
    apiClient.get<Order>(base, { signal: controller.signal }).then((res) => setOrder(res.data)).catch(() => { if (!controller.signal.aborted) setError('โหลดรายการชำระเงินไม่สำเร็จ') })
    return () => controller.abort()
  }, [base])
  async function action(name: 'retry' | 'recheck') {
    setBusy(true); setError('')
    try {
      const res = await apiClient.post<Order>(`${base}/${name}`, undefined, { timeout: 30000 })
      setOrder(res.data)
    } catch (err) { setError(getCheckoutErrorMessage(err)) }
    finally { setBusy(false) }
  }
  return <main className="mx-auto max-w-3xl space-y-5 px-5 py-10">
    <Link href="/billing" className="text-sm text-sky-700">กลับหน้าสมาชิก</Link>
    <h1 className="text-2xl font-bold">รายการชำระเงิน</h1>
    {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-red-800">{error}</p>}
    {!order && !error && <p role="status">กำลังโหลด...</p>}
    {order && <>
      <dl className="grid grid-cols-2 gap-3 border-y border-gray-200 py-5 text-sm">
        <dt>แพ็กเกจ</dt><dd>{order.plan_code}</dd><dt>ยอดชำระ</dt><dd>{(order.amount_minor / 100).toLocaleString('th-TH', { style: 'currency', currency: 'THB' })}</dd>
        <dt>Merchant</dt><dd className="break-words">{order.merchant_name}</dd><dt>Project</dt><dd className="break-words">{order.project_name}</dd><dt>สถานะ</dt><dd>{order.status}</dd><dt>สถานะจากผู้ให้บริการ</dt><dd>{order.remote_status || '-'}</dd>
      </dl>
      <p className="text-sm text-gray-600">ชำระครั้งเดียวสำหรับสิทธิ์ 30 วัน ไม่มีการหักเงินต่ออายุอัตโนมัติ</p>
      {order.status === 'PENDING' && <p className="text-sm text-amber-800">กำลังรอการยืนยันการชำระเงิน สิทธิ์สมาชิกจะยังไม่เพิ่มจนกว่าระบบตรวจสอบสำเร็จ</p>}
      <div className="flex flex-wrap gap-3">
        {order.checkout_url && <a href={getMppCheckoutUrl({ ...order, checkout_url: order.checkout_url })} target="_blank" rel="noopener noreferrer" className={button}><ExternalLink size={16} />เปิดหน้าชำระเงิน</a>}
        <button className={button} disabled={busy} onClick={() => action('recheck')}><RefreshCw size={16} />ตรวจสอบสถานะ</button>
        {order.status === 'PENDING' && !order.checkout_url && <button className={button} disabled={busy} onClick={() => action('retry')}><Repeat2 size={16} />ลองรายการเดิมอีกครั้ง</button>}
        {['FAILED', 'EXPIRED'].includes(order.status) && <Link className={button} href="/billing">เลือกรายการใหม่</Link>}
      </div>
    </>}
  </main>
}
const button = 'inline-flex items-center gap-2 rounded border border-gray-300 px-4 py-2 text-sm font-semibold disabled:opacity-40'
