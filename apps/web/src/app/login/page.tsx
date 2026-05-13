'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/auth'

export default function LoginPage() {
  const router = useRouter()
  const { login, isLoading } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      const user = await login(email, password)
      const isAdmin = user.role === 'owner' || user.role === 'admin'
      window.location.href = isAdmin ? '/admin/dashboard' : '/dashboard'
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } }
      setError(axiosErr.response?.data?.detail || 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-background to-secondary-50 px-4">

      {/* Decorative background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-48 h-48 bg-primary-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20" />
        <div className="absolute bottom-20 right-10 w-56 h-56 bg-accent-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20" />
      </div>

      <div className="relative w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-14 h-14 bg-gradient-to-br from-primary-400 to-primary-600 rounded-2xl flex items-center justify-center shadow-xl">
              <span className="text-white text-2xl font-black">4</span>
            </div>
          </Link>
          <h1 className="text-3xl font-extrabold text-gray-900 mt-3">4-Craft</h1>
          <p className="text-gray-500 mt-1">ระบบเรียนรู้คณิตศาสตร์แบบปรับตัว</p>
        </div>

        {/* Card */}
        <div className="card shadow-2xl border-primary-100">
          <h2 className="text-xl font-bold text-gray-900 mb-6 text-center">เข้าสู่ระบบ</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">อีเมล</label>
              <input
                type="email"
                className="input-field"
                placeholder="parent@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">รหัสผ่าน</label>
              <input
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              className="btn-primary w-full text-base"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">⏳</span> กำลังเข้าสู่ระบบ...
                </span>
              ) : '🚀 เข้าสู่ระบบ'}
            </button>
          </form>

          <div className="mt-5 pt-5 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-500">
              ยังไม่มีบัญชี?{' '}
              <Link href="/register" className="text-primary-600 hover:text-primary-700 font-bold hover:underline">
                สมัครสมาชิกฟรี
              </Link>
            </p>
          </div>

          <div className="mt-3 text-center">
            <p className="text-xs text-gray-400 leading-relaxed">
              QA student: <code className="bg-gray-100 px-1 rounded">demo@4-craft.com</code> / <code className="bg-gray-100 px-1 rounded">demo1234</code>
              <br />
              QA admin: <code className="bg-gray-100 px-1 rounded">admin@4-craft.com</code> / <code className="bg-gray-100 px-1 rounded">admin1234</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
