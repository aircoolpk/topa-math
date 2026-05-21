'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { billingApi, type BillingStatus } from '@/lib/api/billing'
import { TopaMascot } from '@/components/brand/TopaBrand'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getPlanLabel(planCode: string | null | undefined): string {
  if (!planCode) return 'สมาชิก'
  if (planCode.includes('founder')) return 'Founder'
  if (planCode.includes('ep_')) return 'EP Plus'
  if (planCode.includes('th_')) return 'TH Plus'
  if (planCode.includes('plus')) return 'Plus'
  return 'สมาชิก'
}

function getPlanEmoji(planCode: string | null | undefined): string {
  if (!planCode) return '💎'
  if (planCode.includes('founder')) return '👑'
  if (planCode.includes('ep_')) return '🌏'
  if (planCode.includes('th_')) return '📖'
  return '⚡'
}

// ─── Component ────────────────────────────────────────────────────────────────

type VerifyState = 'checking' | 'paid' | 'pending' | 'error'

export default function BillingSuccessPage() {
  const [verifyState, setVerifyState] = useState<VerifyState>('checking')
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  const verifyStatus = async () => {
    try {
      const status: BillingStatus = await billingApi.getStatus()
      setBillingStatus(status)
      if (status.is_paid) {
        setVerifyState('paid')
      } else {
        setVerifyState('pending')
      }
    } catch {
      setVerifyState('error')
    }
  }

  useEffect(() => {
    verifyStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryCount])

  const handleRetry = () => setRetryCount((c) => c + 1)

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-background to-accent-50 flex items-center justify-center px-4">

      {/* Decorative blobs */}
      <div className="absolute top-20 left-10 w-64 h-64 bg-green-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
      <div className="absolute bottom-20 right-10 w-72 h-72 bg-accent-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />

      <div className="relative w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <TopaMascot size="md" />
          </Link>
        </div>

        {/* Card */}
        <div className="card shadow-2xl border-primary-100 text-center">

          {/* Animated icon */}
          <div className="mb-6">
            {verifyState === 'checking' && (
              <div className="text-6xl animate-bounce">⏳</div>
            )}
            {verifyState === 'paid' && (
              <div className="text-6xl">🎉</div>
            )}
            {verifyState === 'pending' && (
              <div className="text-6xl">🕐</div>
            )}
            {verifyState === 'error' && (
              <div className="text-6xl">😢</div>
            )}
          </div>

          {/* ── Checking ── */}
          {verifyState === 'checking' && (
            <>
              <h2 className="text-xl font-extrabold text-gray-900 mb-2">
                ชำระเงินสำเร็จ
              </h2>
              <p className="text-gray-500 text-sm mb-4">
                กำลังตรวจสอบสถานะสมาชิก...
              </p>
              <div className="flex items-center justify-center gap-2 text-sm text-primary-600">
                <span className="animate-spin text-lg">⏳</span>
                กำลังโหลด...
              </div>
            </>
          )}

          {/* ── Paid ── */}
          {verifyState === 'paid' && (
            <>
              <h2 className="text-xl font-extrabold text-gray-900 mb-2">
                🎉 อัปเกรด{getPlanEmoji(billingStatus?.plan_code)}สำเร็จแล้ว!
              </h2>
              <p className="text-gray-600 text-sm mb-2">
                ยินดีด้วย! คุณได้เป็นสมาชิก{' '}
                <strong className="text-accent-700">
                  {getPlanLabel(billingStatus?.plan_code)}
                </strong>{' '}
                แล้ว
              </p>
              {billingStatus?.current_period_end && (
                <p className="text-xs text-gray-400 mb-6">
                  สิ้นสุด: {new Date(billingStatus.current_period_end).toLocaleDateString('th-TH', {
                    year: 'numeric', month: 'long', day: 'numeric'
                  })}
                </p>
              )}
              {!billingStatus?.current_period_end && (
                <p className="text-xs text-gray-400 mb-6">เข้าถึงได้ทันที</p>
              )}
              <Link
                href="/dashboard"
                className="btn-primary inline-flex items-center justify-center gap-2 text-base px-8 py-3"
              >
                🚀 กลับแดชบอร์ด
              </Link>
              <Link
                href="/billing"
                className="btn-secondary inline-flex items-center justify-center gap-2 text-base px-6 py-3"
              >
                💳 จัดการบิลลิ่ง
              </Link>
            </>
          )}

          {/* ── Pending ── */}
          {verifyState === 'pending' && (
            <>
              <h2 className="text-xl font-extrabold text-gray-900 mb-2">
                🕐 กำลังรอการยืนยันจากระบบชำระเงิน
              </h2>
              <p className="text-gray-500 text-sm mb-4">
                การชำระเงินของคุณกำลังดำเนินการ<br />
                ระบบจะอัปเดตสถานะสมาชิกภายใน 1–2 นาที
              </p>
              <p className="text-xs text-gray-400 mb-6">
                หากรอนานเกินไป กรุณาติดต่อ support@topamath.com
              </p>
              <div className="flex gap-3">
                <button onClick={handleRetry} className="flex-1 btn-primary">
                  🔄 ลองใหม่
                </button>
                <Link href="/dashboard" className="flex-1 btn-secondary">
                  ไปแดชบอร์ดก่อน
                </Link>
              </div>
            </>
          )}

          {/* ── Error ── */}
          {verifyState === 'error' && (
            <>
              <h2 className="text-xl font-extrabold text-gray-900 mb-2">
                เกิดข้อผิดพลาด
              </h2>
              <p className="text-gray-500 text-sm mb-6">
                ไม่สามารถตรวจสอบสถานะได้ กรุณาลองใหม่
              </p>
              <div className="flex gap-3">
                <button onClick={handleRetry} className="flex-1 btn-primary">
                  🔄 ลองใหม่
                </button>
                <Link href="/dashboard" className="flex-1 btn-secondary">
                  กลับแดชบอร์ด
                </Link>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
