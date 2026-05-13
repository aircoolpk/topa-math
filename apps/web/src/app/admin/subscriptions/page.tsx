'use client'

import { useEffect, useState } from 'react'
import { adminApi, type AdminSubscriptionRow } from '@/lib/api/admin'

export default function AdminSubscriptionsPage() {
  const [rows, setRows] = useState<AdminSubscriptionRow[]>([])
  const [mock, setMock] = useState(false)

  useEffect(() => {
    adminApi.subscriptions().then((data) => setRows(data.subscriptions || [])).catch(() => { setMock(true); setRows([]) })
  }, [])

  return (
    <main className="mx-auto max-w-7xl space-y-5 px-6 py-8">
      <div><h1 className="text-3xl font-extrabold text-gray-950">Subscriptions</h1><p className="text-sm text-gray-500">Cancel, reactivate, extend, and audit subscription records.</p>{mock && <p className="mt-2 text-sm font-semibold text-amber-700">Mock fallback active</p>}</div>
      <div className="overflow-hidden rounded-lg bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-bold uppercase text-gray-500"><tr>{['Email', 'Plan', 'Membership', 'Stripe sub', 'Period end', 'Cancel at end', 'MRR'].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <tr key={row.subscription_id}>
                  <td className="px-4 py-3">{row.email || row.user_id || '-'}</td>
                  <td className="px-4 py-3">{row.plan_name || row.plan_code || 'free'}</td>
                  <td className="px-4 py-3">{row.membership_status || 'free'} / {row.subscription_status || 'none'}</td>
                  <td className="px-4 py-3 font-mono text-xs">{row.stripe_subscription_id || '-'}</td>
                  <td className="px-4 py-3">{fmt(row.current_period_end)}</td>
                  <td className="px-4 py-3">{row.cancel_at_period_end ? 'yes' : 'no'}</td>
                  <td className="px-4 py-3">฿{Math.round(row.monthly_amount_thb || 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}

function fmt(value?: string | null) {
  return value ? new Date(value).toLocaleDateString() : '-'
}
