'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { TopaLogo } from '@/components/brand/TopaBrand'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'

const navItems = [
  ['/admin', 'ภาพรวม'],
  ['/admin/users', 'ผู้ใช้'],
  ['/admin/students', 'นักเรียน'],
  ['/admin/lessons', 'บทเรียน'],
  ['/admin/tests', 'แบบทดสอบ'],
  ['/admin/qa', 'Content QA'],
  ['/admin/homepage', 'หน้าแรก'],
  ['/admin/system', 'ระบบ'],
  ['/admin/subscriptions', 'สมาชิก'],
  ['/admin/affiliates', 'Affiliate'],
  ['/admin/payment-integration-test', 'Payment UAT'],
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
    if (!user?.role) {
      router.replace('/login')
      return
    }
    if (!['admin', 'owner'].includes(user.role)) setForbidden(true)
  }, [ready, router, user])

  if (!ready) return <div className="min-h-screen bg-gray-50 p-8 text-gray-500">Loading admin...</div>

  if (forbidden) {
    return (
      <main className="min-h-screen bg-gray-50 px-6 py-16">
        <div className="mx-auto max-w-lg rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-extrabold text-gray-950">403</h1>
          <p className="mt-2 text-gray-600">Admin access is required.</p>
          <Link href="/dashboard" className="mt-6 inline-flex rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white">
            กลับแดชบอร์ดนักเรียน
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
            <Link href="/admin" className="inline-flex items-center gap-2">
              <TopaLogo size="sm" />
              <span className="text-sm font-extrabold text-gray-950">Admin</span>
            </Link>
            <p className="text-sm text-gray-500">Content and operations console</p>
          </div>
          <nav className="mt-6 grid gap-1">
            {navItems.map(([href, label]) => {
              const active = href === '/admin' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
              return (
                <Link key={href} href={href} className={`rounded-xl px-3 py-2 text-sm font-semibold ${active ? 'bg-sky-100 text-sky-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                  {label}
                </Link>
              )
            })}
          </nav>
          <Link href="/dashboard" className="mt-6 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 lg:mt-auto">
            กลับแดชบอร์ดนักเรียน
          </Link>
        </div>
      </aside>
      <div className="min-w-0 flex-1 lg:pl-72">{children}</div>
    </div>
  )
}
