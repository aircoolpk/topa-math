'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/auth'
import { adminApi, type AIGenerationJob } from '@/lib/api/admin'

export default function AdminGeneratedContentPage() {
  const router = useRouter()
  const { checkAuth, user } = useAuthStore()
  const [jobs, setJobs] = useState<AIGenerationJob[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    checkAuth().then(async () => {
      const token = localStorage.getItem('access_token')
      if (!token) { router.push('/login'); return }
      try {
        const data = await adminApi.generatedContent()
        setJobs(data)
      } catch {
        setError('backend endpoint missing')
      } finally {
        setLoading(false)
      }
    })
  }, [])

  const handleApprove = async (jobId: string) => {
    setActionLoading(jobId)
    try {
      await adminApi.approve(jobId)
      setJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, status: 'completed' } : j))
    } catch {
      alert('ดำเนินการไม่สำเร็จ')
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (jobId: string) => {
    setActionLoading(jobId)
    try {
      await adminApi.reject(jobId)
      setJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, status: 'rejected' } : j))
    } catch {
      alert('ดำเนินการไม่สำเร็จ')
    } finally {
      setActionLoading(null)
    }
  }

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-700',
      generating: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
    }
    const labels: Record<string, string> = {
      pending: 'รอตรวจ',
      generating: 'กำลังสร้าง',
      completed: 'อนุมัติแล้ว',
      rejected: 'ปฏิเสธ',
    }
    return <span className={`badge ${map[status] || 'bg-gray-100 text-gray-600'}`}>{labels[status] || status}</span>
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white border-b border-primary-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/dashboard" className="text-2xl hover:opacity-70">←</Link>
          <div className="flex items-center gap-2">
            <span className="text-xl">🛡️</span>
            <h1 className="font-bold text-gray-900">จัดการ AI Content</h1>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {error === 'backend endpoint missing' ? (
          <div className="card py-12 text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h3 className="section-title mb-2">Backend endpoint missing</h3>
            <p className="text-gray-500">API endpoint <code>/admin/generated-content</code> อาจต้องการสิทธิ์ admin หรือยังไม่พร้อมใช้งาน</p>
            <p className="text-sm text-gray-400 mt-2">รายการนี้ใช้ได้เฉพาะบัญชี admin</p>
            <p className="text-xs text-gray-400 mt-1">Admin: admin@4-craft.local / admin12345</p>
          </div>
        ) : loading ? (
          <div className="card py-12 text-center">
            <div className="text-4xl animate-bounce">🛡️</div>
            <p className="text-gray-500 mt-3">กำลังโหลด...</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="card py-12 text-center">
            <div className="text-5xl mb-4">📭</div>
            <h3 className="section-title mb-2">ยังไม่มี AI Content</h3>
            <p className="text-gray-500">ยังไม่มีรายการ content ที่รอตรวจสอบ</p>
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <div key={job.id} className="card">
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-mono text-gray-400">#{job.id.slice(-8)}</span>
                      {statusBadge(job.status)}
                    </div>
                    <p className="text-sm text-gray-600 mb-1">
                      Skill: <code>{job.skill_id}</code> · Grade: ป.{job.grade_level}
                    </p>
                    {job.content && (
                      <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-700 max-h-32 overflow-y-auto">
                        {job.content}
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      สร้างเมื่อ: {new Date(job.created_at).toLocaleDateString('th-TH')}
                    </p>
                  </div>
                  {job.status === 'pending' || job.status === 'generating' ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(job.id)}
                        disabled={!!actionLoading}
                        className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                      >
                        {actionLoading === job.id ? '...' : '✅ อนุมัติ'}
                      </button>
                      <button
                        onClick={() => handleReject(job.id)}
                        disabled={!!actionLoading}
                        className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                      >
                        {actionLoading === job.id ? '...' : '❌ ปฏิเสธ'}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
