'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, Plus, RefreshCw, Repeat2, Send } from 'lucide-react'
import { apiClient } from '@/lib/api-client'

type Check = { state: 'NOT_STARTED' | 'PASS' | 'FAIL'; action: string; expected: string; actual: string; response: Record<string, unknown> }
type Transaction = { id: string; kind: 'payment' | 'withdrawal'; merchant_order_id: string; status: string; remote_status: string | null; payment_id: string | null; withdrawal_id: string | null; hosted_payment_ready: boolean; checks: Record<string, Check> }
type TestData = { configured: boolean; webhook_configured: boolean; transactions: Transaction[] }
const base = '/admin/payment-integration-test'
const fields = { merchant_customer_id: 'Customer reference', first_name: 'First name', last_name: 'Last name', phone: 'Phone', bank_code: 'Bank code', bank_name: 'Bank name', bank_account_number: 'Account number', bank_account_name: 'Account holder' }
const definitions: Record<string, [string, string]> = {
  order: ['Create TOPA test order', 'PENDING_PAYMENT; 1500 satang'],
  payment: ['POST /payments', 'Staging hosted session created'],
  hosted: ['Open hosted payment page', 'Staging payment page opened'],
  idempotency: ['Repeat POST /payments with same key and body', 'Same payment_id; no duplicate'],
  webhook: ['Receive signed webhook', 'Verified event processed once'],
  recheck: ['Server-side GET public status', 'Transaction identity and amount match'],
  withdrawal: ['POST /withdrawals', 'Withdrawal ID and status token stored'],
}
const buttonClass = 'inline-flex items-center gap-2 rounded border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-100 disabled:opacity-40'

export default function PaymentIntegrationTestPage() {
  const [data, setData] = useState<TestData | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [recipient, setRecipient] = useState<Record<string, string>>({})
  const [opened, setOpened] = useState<Record<string, boolean>>({})
  async function load(signal?: AbortSignal) {
    setData((await apiClient.get<TestData>(base, { signal })).data)
  }
  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal).catch(() => { if (!controller.signal.aborted) setError('Unable to load UAT transactions') })
    return () => controller.abort()
  }, [])
  async function action(path: string, body?: unknown) {
    setBusy(path); setError('')
    try {
      if (path === '/refresh') await load()
      else { await apiClient.post(base + path, body); await load() }
      if (path === '/withdrawals') setRecipient({})
    } catch { setError('Action failed. Refresh the transaction list before trying again.') }
    finally { setBusy('') }
  }
  async function openHosted(row: Transaction) {
    const popup = window.open('about:blank', '_blank')
    if (popup) popup.opener = null
    setBusy(row.id)
    try {
      const url = new URL((await apiClient.get<{ url: string }>(`${base}/${row.id}/hosted-url`)).data.url)
      if (url.origin !== 'https://staging-pay.mmerchat.cc' || !popup) throw new Error('Unable to open')
      popup.location.href = url.href
      setOpened((value) => ({ ...value, [row.id]: true }))
    } catch { popup?.close(); setError('Unable to open hosted payment page; check popup permissions') }
    finally { setBusy('') }
  }
  return <main className="space-y-6 p-6 lg:p-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold text-gray-950">Payment Integration Test</h1><p className="mt-1 text-sm text-gray-600">MPP staging / TOPAMath UAT / THB 15.00 (1500 satang)</p></div><button className={buttonClass} disabled={!!busy} onClick={() => action('/refresh')}><RefreshCw size={16} />Refresh</button></div>
    {error && <div role="alert" className="border-l-4 border-red-600 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    {!data ? <p role="status">{error ? 'Unable to load tests. Use Refresh to retry.' : 'Loading UAT tests...'}</p> : <>
      <div className="flex flex-wrap gap-4 border-y border-gray-200 py-3 text-sm"><span>API key: {data.configured ? 'Configured' : 'Missing'}</span><span>Webhook secret: {data.webhook_configured ? 'Configured' : 'Missing'}</span><span>Staging only</span></div>
      <section className="border-b border-gray-200 pb-5"><h2 className="mb-3 text-lg font-semibold">Payment</h2><button className={buttonClass} disabled={!!busy} onClick={() => action('/orders')}><Plus size={16} />Create test order</button></section>
      <section className="border-b border-gray-200 pb-5"><h2 className="mb-3 text-lg font-semibold">Withdrawal / staging test recipient</h2><form onSubmit={(event) => { event.preventDefault(); action('/withdrawals', recipient) }}><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Object.entries(fields).map(([field, label]) => <label key={field} className="text-sm text-gray-700">{label}<input required autoComplete="off" value={recipient[field] || ''} onChange={(event) => setRecipient((value) => ({ ...value, [field]: event.target.value }))} className="mt-1 block w-full rounded border border-gray-300 bg-white px-3 py-2" /></label>)}</div><button type="submit" className={`${buttonClass} mt-4`} disabled={!!busy || !data.configured}><Send size={16} />Submit staging withdrawal / THB 15.00</button></form></section>
      {data.transactions.length === 0 && <div className="py-8 text-gray-500">NOT_STARTED / No UAT transactions</div>}
      {data.transactions.map((row) => <section key={row.id} className="border-b border-gray-200 pb-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold capitalize">{row.kind} / {row.status}</h2><p className="break-all text-xs text-gray-600">{row.merchant_order_id}</p><p className="mt-1 text-sm text-gray-500">Remote: {row.remote_status || '-'} / {row.payment_id || row.withdrawal_id || '-'}</p></div><div className="flex flex-wrap gap-2">{row.kind === 'payment' && <>
        <button className={buttonClass} disabled={!!busy || !data.configured || !!row.payment_id} onClick={() => action(`/${row.id}/payment`)}><Send size={16} />Create payment</button>
        <button className={buttonClass} disabled={!!busy || !row.hosted_payment_ready} onClick={() => openHosted(row)}><ExternalLink size={16} />Hosted payment</button>
        <button className={buttonClass} disabled={!!busy || !row.payment_id} onClick={() => action(`/${row.id}/retry`)}><Repeat2 size={16} />Idempotency retry</button>
      </>}<button className={buttonClass} disabled={!!busy || !(row.payment_id || row.withdrawal_id)} onClick={() => action(`/${row.id}/recheck`)}><RefreshCw size={16} />Recheck status</button></div></div>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-gray-100 text-gray-600"><tr>{['State', 'Request / action', 'Expected result', 'Actual result', 'Sanitized response'].map((label) => <th key={label} className="p-2 font-semibold">{label}</th>)}</tr></thead><tbody className="divide-y divide-gray-200">{(row.kind === 'payment' ? ['order', 'payment', 'hosted', 'idempotency', 'webhook', 'recheck'] : ['withdrawal', 'webhook', 'recheck']).map((key) => {
          const result = key === 'hosted' && opened[row.id] ? { state: 'PASS', action: definitions[key][0], expected: definitions[key][1], actual: 'Staging page opened; confirmation pending', response: {} } : row.checks[key]
          const state = result?.state || 'NOT_STARTED'
          return <tr key={key}><td className={`p-2 font-semibold ${state === 'PASS' ? 'text-emerald-700' : state === 'FAIL' ? 'text-red-700' : 'text-gray-500'}`}>{state}</td><td className="p-2">{result?.action || definitions[key][0]}</td><td className="p-2">{result?.expected || definitions[key][1]}</td><td className="p-2">{result?.actual || '-'}</td><td className="max-w-xs p-2"><pre className="whitespace-pre-wrap break-all text-xs">{result ? JSON.stringify(result.response, null, 2) : '-'}</pre></td></tr>
        })}</tbody></table></div>
      </section>)}
    </>}
    {busy && <p role="status" className="text-sm text-gray-500">Request in progress...</p>}
  </main>
}
