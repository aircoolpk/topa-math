'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'

const navItems = [
  ['/admin/dashboard', 'Dashboard'],
  ['/admin/users', 'Users'],
  ['/admin/subscriptions', 'Subscriptions'],
  ['/admin/revenue', 'Revenue'],
  ['/admin/content', 'Content'],
  ['/admin/content/questions', 'Tests'],
  ['/admin/content-quality', 'QA'],
  ['/admin/settings', 'Settings'],
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, checkAuth } = useAuthStore()
  const [ready, setReady] = useState(false)
  const [forbidden, setForbidden] = useState(false)

  useEffect(() => {
    checkAuth().finally(() => setReady(true))
  }, [checkAuth])

  useEffect(() => {
    if (!ready) return
    const token = localStorage.getItem('access_token')
    if (!token) {
      router.replace('/login')
      return
    }
    const role = user?.role
    if (!role) {
      router.replace('/login')
      return
    }
    if (!['admin', 'owner'].includes(role)) {
      setForbidden(true)
    }
  }, [ready, router, user])

  if (!ready) {
    return <div className="min-h-screen bg-gray-50 p-8 text-gray-500">Loading admin...</div>
  }

  if (forbidden) {
    return (
      <main className="min-h-screen bg-gray-50 px-6 py-16">
        <div className="mx-auto max-w-lg rounded-lg border border-red-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-extrabold text-gray-950">403</h1>
          <p className="mt-2 text-gray-600">Admin access is required.</p>
          <Link href="/dashboard" className="mt-6 inline-flex rounded-lg bg-primary-600 px-4 py-2 text-sm font-bold text-white">
            Back to dashboard
          </Link>
        </div>
      </main>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 lg:flex">
      <aside className="border-b border-gray-200 bg-white lg:fixed lg:inset-y-0 lg:left-0 lg:w-72 lg:border-b-0 lg:border-r">
        <div className="flex h-full flex-col px-5 py-5">
          <div>
            <Link href="/admin/dashboard" className="text-xl font-extrabold text-gray-950">4-Craft Admin</Link>
            <p className="text-sm text-gray-500">Owner operations console</p>
          </div>
          <nav className="mt-6 grid gap-1">
            {navItems.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${pathname === href ? 'bg-primary-100 text-primary-700' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                {label}
              </Link>
            ))}
          </nav>
          <Link href="/dashboard" className="mt-6 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 lg:mt-auto">
            Back to student dashboard
          </Link>
        </div>
      </aside>
      <div className="min-w-0 flex-1 lg:pl-72">
        {children}
      </div>
    </div>
  )
}
