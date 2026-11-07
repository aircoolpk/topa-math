'use client'

import { useEffect, useState } from 'react'
import { adminApi } from '@/lib/api/admin'

type Health = Awaited<ReturnType<typeof adminApi.systemHealth>>

export default function AdminSystemPage() {
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    adminApi.systemHealth().then(setHealth).catch(() => setError('โหลดสถานะระบบไม่สำเร็จ'))
  }, [])

  return (
    <main className="mx-auto max-w-5xl space-y-5 px-6 py-8">
      <div>
        <h1 className="text-3xl font-extrabold text-gray-950">ระบบ</h1>
        <p className="text-sm text-gray-500">ตรวจสถานะ API, database, Redis และ content files โดยไม่แสดง secrets</p>
      </div>
      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
      {!health ? <p className="text-sm text-gray-500">กำลังโหลด...</p> : (
        <section className="grid gap-4 sm:grid-cols-2">
          <Status label="API" value={health.api_status} />
          <Status label="Database" value={health.database_status} />
          <Status label="Redis" value={health.redis_status} />
          <Status label="Environment" value={health.environment} />
          <Status label="Content files" value={health.content_file_count} />
          <Status label="Version" value={health.app_version || '-'} />
        </section>
      )}
      <section className="rounded-lg bg-white p-5 text-sm text-gray-600 shadow-sm">
        <h2 className="mb-2 text-lg font-bold text-gray-950">Docker / API notes</h2>
        <p>ใช้ Docker Desktop ตรวจ container `4craft-api`, `4craft-postgres`, `4craft-redis`, `4craft-cloudflared` และให้ frontend deploy ผ่าน Cloudflare Pages</p>
      </section>
    </main>
  )
}

function Status({ label, value }: { label: string; value: string | number }) {
  const ok = ['ok', 'reachable', 'local', 'beta', 'production'].includes(String(value).toLowerCase()) || typeof value === 'number'
  return <div className="rounded-lg bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-gray-500">{label}</p><p className={`mt-1 text-2xl font-extrabold ${ok ? 'text-green-700' : 'text-amber-700'}`}>{value}</p></div>
}
