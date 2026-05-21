'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { billingApi, type BillingPrices, type BillingPlanRecord } from '@/lib/api/billing'
import { TopaBrandMark } from '@/components/brand/TopaBrand'

// ─── Fallback feature lists ──────────────────────────────────────────────────

const DEFAULT_FREE_FEATURES: string[] = [
  "ทดลองเรียนฟรี",
  "เรียนได้ 3 เควส",
  "ทำเทสวัดระดับได้จำกัด",
  "Avatar พื้นฐาน",
  "เหมาะสำหรับลองใช้งาน",
]

const DEFAULT_TH_FEATURES: string[] = [
  "คณิตศาสตร์ภาษาไทย ป.1–ป.6",
  "บทเรียนทั้งหมด",
  "แบบทดสอบทุกระดับชั้น",
  "ระบบวิเคราะห์จุดอ่อน",
  "แบบฝึกเฉพาะบุคคล",
  "Quest รายวัน / รายสัปดาห์ / รายเดือน",
  "XP / Level / Rank",
  "Avatar และของตกแต่งพื้นฐาน",
]

const DEFAULT_EP_FEATURES: string[] = [
  "ทุกอย่างใน Plus TH",
  "โหมด English Program",
  "โจทย์และบทเรียนคณิตเป็นภาษาอังกฤษ",
  "คำศัพท์คณิตศาสตร์อังกฤษ",
  "เหมาะกับเด็ก EP / Inter / สองภาษา",
  "ปลดล็อก TH + EP",
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPrice(amount: number): string {
  return new Intl.NumberFormat('th-TH').format(amount)
}

function isYearly(planCode: string): boolean {
  return planCode.includes('yearly')
}

function getArray<T>(val: unknown, fallback: T[]): T[] {
  if (Array.isArray(val)) return val as T[]
  return fallback
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface PricePlan {
  id?: string
  plan_code: string
  name?: string
  name_th: string
  display_name?: string
  price_thb: number
  price_monthly?: number | null
  original_price_thb?: number
  interval: 'monthly' | 'yearly'
  features?: string[]
  is_founder: boolean
  is_promo: boolean
  available?: boolean
  is_available?: boolean
  stripe_price_id?: string | null
  checkout_plan_code?: string | null
  badge?: string
}

// ─── Free Plan Card ──────────────────────────────────────────────────────────

interface FreePlanCardProps {
  currentPlanCode: string | null
}

function FreePlanCard({ currentPlanCode }: FreePlanCardProps) {
  const features = DEFAULT_FREE_FEATURES
  const isCurrent = currentPlanCode === 'free'

  return (
    <div className="card border-2 border-gray-200 flex flex-col overflow-hidden">
      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
        <div className="bg-gradient-to-r from-gray-400 to-gray-600 text-white text-xs font-bold px-5 py-1.5 rounded-full shadow">
          ฟรี
        </div>
      </div>

      <div className="pt-6 pb-4 px-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-300 to-gray-500 flex items-center justify-center text-xl shadow">
            🆓
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 leading-tight">Free</h3>
            <p className="text-xs text-gray-400">ทดลองใช้งาน</p>
          </div>
        </div>

        <div className="mb-1">
          <span className="text-4xl font-extrabold text-gray-900">฿0</span>
          <span className="text-sm text-gray-400 font-medium">/ถาวร</span>
        </div>
        <p className="text-xs text-gray-400">ไม่มีวันหมดอายุ</p>
      </div>

      <ul className="px-6 space-y-2 mb-6 flex-1">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
            <span className="flex-shrink-0 mt-0.5 text-gray-400">✓</span>
            {f}
          </li>
        ))}
      </ul>

      <div className="px-6 pb-6 border-t border-gray-200 pt-4">
        {isCurrent ? (
          <div className="w-full py-3 text-center rounded-xl bg-green-50 border-2 border-green-300">
            <p className="text-sm font-bold text-green-700">✓ แพ็กเกจปัจจุบัน</p>
          </div>
        ) : (
          <div className="w-full py-3 text-center rounded-xl bg-gray-100 text-gray-500 font-bold text-sm">
            แพ็กเกจปัจจุบัน
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Hero Plan Card (TH or EP) ────────────────────────────────────────────────

interface HeroPlanCardProps {
  thPlan: PricePlan | null       // th_founder or th_plus monthly
  epPlan: PricePlan | null      // ep_founder or ep_plus monthly
  founderSlotsRemaining: number | null
  founderLimit: number | null
  onSubscribe: (planCode: string) => void
  loading: string | null
  error: string | null
  currentPlanCode: string | null
}

function HeroPlanCard({
  thPlan,
  epPlan,
  founderSlotsRemaining,
  founderLimit,
  onSubscribe,
  loading,
  error,
  currentPlanCode,
}: HeroPlanCardProps) {
  // Safe feature arrays — never call .map on undefined
  const thFeatures = thPlan ? getArray(thPlan.features, DEFAULT_TH_FEATURES) : DEFAULT_TH_FEATURES
  const epFeatures = epPlan ? getArray(epPlan.features, DEFAULT_EP_FEATURES) : DEFAULT_EP_FEATURES

  const founderAvailable = (thPlan?.is_founder && thPlan.available !== false) ||
    (epPlan?.is_founder && epPlan.available !== false)
  const slotsText = founderSlotsRemaining != null
    ? founderSlotsRemaining > 0
      ? `เหลือ Founder Price อีก ${founderSlotsRemaining} สิทธิ์`
      : 'Founder Price เต็มแล้ว'
    : null

  return (
    <>
      {/* ── Global founder limit banner ── */}
      {(founderSlotsRemaining != null || founderLimit != null) && (
        <div className="bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 border-2 border-amber-300 rounded-2xl px-6 py-4 mb-8 text-center">
          <p className="text-amber-800 font-extrabold text-base">
            👑 Founder Price จำกัดรวม 100 สิทธิ์แรก
          </p>
          {slotsText && (
            <p className={`text-sm font-semibold mt-1 ${founderSlotsRemaining === 0 ? 'text-red-600' : 'text-amber-700'}`}>
              {founderSlotsRemaining === 0 ? '❌ สิทธิ์เต็มแล้ว — ใช้ราคาปกติได้เลย' : `✨ ${slotsText}`}
            </p>
          )}
          {founderLimit && (
            <p className="text-xs text-amber-500 mt-1">
              (แบ่งใช้ระหว่าง TH + EP Founder)
            </p>
          )}
        </div>
      )}

      {/* ── TH + EP Hero Cards ── */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">

        {/* TH Plus Hero Card */}
        {thPlan ? (
          <div className={`card border-2 relative flex flex-col overflow-hidden ${
            thPlan.is_founder && thPlan.available !== false
              ? 'border-amber-300 shadow-xl'
              : 'border-primary-200 shadow-lg'
          }`}>
            {/* Badge */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              {thPlan.is_founder && thPlan.available !== false ? (
                <div className="bg-gradient-to-r from-amber-400 to-amber-600 text-white text-xs font-bold px-5 py-1.5 rounded-full shadow flex items-center gap-1.5">
                  👑 Founder Price
                </div>
              ) : (
                <div className="bg-gradient-to-r from-primary-400 to-primary-600 text-white text-xs font-bold px-5 py-1.5 rounded-full shadow">
                  📖 TH Plus
                </div>
              )}
            </div>

            {/* Header */}
            <div className="pt-6 pb-4 px-6">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shadow ${
                  thPlan.is_founder && thPlan.available !== false
                    ? 'bg-gradient-to-br from-amber-300 to-amber-500'
                    : 'bg-gradient-to-br from-primary-300 to-primary-500'
                }`}>
                  {thPlan.is_founder && thPlan.available !== false ? '👑' : '📖'}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 leading-tight">Plus TH</h3>
                  <p className="text-xs text-gray-400">หลักสูตรภาษาไทย · ป.1–ป.6</p>
                </div>
              </div>

              {/* Price */}
              <div className="mb-1">
                <span className="text-4xl font-extrabold text-gray-900">
                  ฿{formatPrice(thPlan.price_thb)}
                </span>
                <span className="text-sm text-gray-400 font-medium">/เดือน</span>
                {thPlan.original_price_thb && thPlan.original_price_thb > thPlan.price_thb && (
                  <span className="ml-2 text-sm text-gray-400 line-through">
                    ฿{formatPrice(thPlan.original_price_thb)}
                  </span>
                )}
              </div>
              {thPlan.is_founder && thPlan.available !== false && thPlan.original_price_thb && (
                <p className="text-xs text-amber-600 font-medium mb-2">
                  ปกติ ฿{formatPrice(thPlan.original_price_thb)}/เดือน → ประหยัด ฿{formatPrice(thPlan.original_price_thb - thPlan.price_thb)}/เดือน
                </p>
              )}
              <p className="text-xs text-gray-400">
                {isYearly(thPlan.plan_code) ? 'ราคารายปี' : 'ราคารายเดือน'}
              </p>
            </div>

            {/* Features */}
            <ul className="px-6 space-y-2 mb-6 flex-1">
              {thFeatures.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className={`flex-shrink-0 mt-0.5 ${
                    thPlan.is_founder && thPlan.available !== false ? 'text-amber-500' : 'text-primary-500'
                  }`}>✓</span>
                  {f}
                </li>
              ))}
            </ul>

            {/* CTA */}
            <div className="px-6 pb-6 border-t border-gray-200 pt-4">
              {currentPlanCode === thPlan.plan_code ? (
                <div className="w-full py-3 text-center rounded-xl bg-green-50 border-2 border-green-300">
                  <p className="text-sm font-bold text-green-700">✓ แพ็กเกจปัจจุบัน</p>
                </div>
              ) : thPlan.available === false ? (
                <div className="space-y-2">
                  <div className="w-full py-3 text-center rounded-xl bg-gray-100 text-gray-500 font-bold text-sm">
                    ❌ Founder Price เต็มแล้ว
                  </div>
                  <button
                    onClick={() => onSubscribe(thPlan.plan_code)}
                    disabled={!!loading}
                    className="w-full font-bold py-3 rounded-xl bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-md transition-all"
                  >
                    {loading === thPlan.plan_code ? '⏳ กำลังเปิด...' : `สมัคร ฿${formatPrice(thPlan.price_thb)}/เดือน`}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => onSubscribe(thPlan.plan_code)}
                  disabled={!!loading}
                  className={`w-full font-bold py-3 rounded-xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    thPlan.is_founder
                      ? 'bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-white hover:shadow-lg'
                      : 'bg-primary-500 hover:bg-primary-600 text-white hover:shadow-lg'
                  }`}
                >
                  {loading === thPlan.plan_code ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin text-lg">⏳</span>กำลังเปิดหน้าชำระเงิน...
                    </span>
                  ) : thPlan.is_founder
                    ? `สมัคร Founder ฿${formatPrice(thPlan.price_thb)}/เดือน`
                    : `สมัคร ฿${formatPrice(thPlan.price_thb)}/เดือน`}
                </button>
              )}
              {error && loading && (
                <p className="text-xs text-red-600 mt-2 text-center">{error}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="card border-2 border-gray-200 flex items-center justify-center h-full min-h-[300px]">
            <p className="text-gray-400 text-sm">ไม่พบแพ็กเกจ TH Plus</p>
          </div>
        )}

        {/* EP Plus Hero Card */}
        {epPlan ? (
          <div className={`card border-2 relative flex flex-col overflow-hidden ${
            epPlan.is_founder && epPlan.available !== false
              ? 'border-amber-300 shadow-xl'
              : 'border-blue-200 shadow-lg'
          }`}>
            {/* Badge */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              {epPlan.is_founder && epPlan.available !== false ? (
                <div className="bg-gradient-to-r from-amber-400 to-amber-600 text-white text-xs font-bold px-5 py-1.5 rounded-full shadow flex items-center gap-1.5">
                  👑 Founder Price
                </div>
              ) : (
                <div className="bg-gradient-to-r from-blue-400 to-blue-600 text-white text-xs font-bold px-5 py-1.5 rounded-full shadow">
                  🌏 EP Plus
                </div>
              )}
            </div>

            {/* Header */}
            <div className="pt-6 pb-4 px-6">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shadow ${
                  epPlan.is_founder && epPlan.available !== false
                    ? 'bg-gradient-to-br from-amber-300 to-amber-500'
                    : 'bg-gradient-to-br from-blue-300 to-blue-500'
                }`}>
                  {epPlan.is_founder && epPlan.available !== false ? '👑' : '🌏'}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 leading-tight">Plus EP</h3>
                  <p className="text-xs text-gray-400">English Program · ป.1–ป.6</p>
                </div>
              </div>

              {/* Price */}
              <div className="mb-1">
                <span className="text-4xl font-extrabold text-gray-900">
                  ฿{formatPrice(epPlan.price_thb)}
                </span>
                <span className="text-sm text-gray-400 font-medium">/เดือน</span>
                {epPlan.original_price_thb && epPlan.original_price_thb > epPlan.price_thb && (
                  <span className="ml-2 text-sm text-gray-400 line-through">
                    ฿{formatPrice(epPlan.original_price_thb)}
                  </span>
                )}
              </div>
              {epPlan.is_founder && epPlan.available !== false && epPlan.original_price_thb && (
                <p className="text-xs text-amber-600 font-medium mb-2">
                  ปกติ ฿{formatPrice(epPlan.original_price_thb)}/เดือน → ประหยัด ฿{formatPrice(epPlan.original_price_thb - epPlan.price_thb)}/เดือน
                </p>
              )}
              <p className="text-xs text-gray-400">
                {isYearly(epPlan.plan_code) ? 'ราคารายปี' : 'ราคารายเดือน'}
              </p>
            </div>

            {/* Features */}
            <ul className="px-6 space-y-2 mb-6 flex-1">
              {epFeatures.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className={`flex-shrink-0 mt-0.5 ${
                    epPlan.is_founder && epPlan.available !== false ? 'text-amber-500' : 'text-blue-500'
                  }`}>✓</span>
                  {f}
                </li>
              ))}
            </ul>

            {/* CTA */}
            <div className="px-6 pb-6 border-t border-gray-200 pt-4">
              {currentPlanCode === epPlan.plan_code ? (
                <div className="w-full py-3 text-center rounded-xl bg-green-50 border-2 border-green-300">
                  <p className="text-sm font-bold text-green-700">✓ แพ็กเกจปัจจุบัน</p>
                </div>
              ) : epPlan.available === false ? (
                <div className="space-y-2">
                  <div className="w-full py-3 text-center rounded-xl bg-gray-100 text-gray-500 font-bold text-sm">
                    ❌ Founder Price เต็มแล้ว
                  </div>
                  <button
                    onClick={() => onSubscribe(epPlan.plan_code)}
                    disabled={!!loading}
                    className="w-full font-bold py-3 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-md transition-all"
                  >
                    {loading === epPlan.plan_code ? '⏳ กำลังเปิด...' : `สมัคร ฿${formatPrice(epPlan.price_thb)}/เดือน`}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => onSubscribe(epPlan.plan_code)}
                  disabled={!!loading}
                  className={`w-full font-bold py-3 rounded-xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    epPlan.is_founder
                      ? 'bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-white hover:shadow-lg'
                      : 'bg-blue-500 hover:bg-blue-600 text-white hover:shadow-lg'
                  }`}
                >
                  {loading === epPlan.plan_code ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin text-lg">⏳</span>กำลังเปิดหน้าชำระเงิน...
                    </span>
                  ) : epPlan.is_founder
                    ? `สมัคร Founder ฿${formatPrice(epPlan.price_thb)}/เดือน`
                    : `สมัคร ฿${formatPrice(epPlan.price_thb)}/เดือน`}
                </button>
              )}
              {error && loading && (
                <p className="text-xs text-red-600 mt-2 text-center">{error}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="card border-2 border-gray-200 flex items-center justify-center h-full min-h-[300px]">
            <p className="text-gray-400 text-sm">ไม่พบแพ็กเกจ EP Plus</p>
          </div>
        )}
      </div>

      {/* Founder Explanation */}
      <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-5 mb-8">
        <h3 className="font-bold text-amber-800 mb-2 flex items-center gap-2">
          <span>💡</span> ทำความเข้าใจราคา Founder
        </h3>
        <p className="text-sm text-amber-700">
          สิทธิ์ Founder จะคงอยู่ตราบใดที่ยังไม่ยกเลิกสมาชิก หากยกเลิกแล้วสมัครใหม่ จะเป็นราคาปกติ
        </p>
      </div>

      {/* Yearly promo callout */}
      <YearlyPromoSection plans={null} />
    </>
  )
}

// ─── Yearly Promo Section ────────────────────────────────────────────────────

function YearlyPromoSection({ plans }: { plans: PricePlan[] | null }) {
  // Show if we have any yearly plans
  return (
    <div className="bg-gradient-to-r from-accent-50 to-primary-50 border-2 border-accent-200 rounded-2xl p-6 mb-8 text-center">
      <div className="text-3xl mb-2">🎉</div>
      <h3 className="text-lg font-extrabold text-gray-900 mb-1">
        สมัครรายปี — ประหยัดสูงสุด!
      </h3>
      <p className="text-sm text-gray-600">
        แพ็กเกจรายปี คุ้มกว่าสมัครรายเดือน แถมได้ราคาโปรโมชันพิเศษ
      </p>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [prices, setPrices] = useState<BillingPrices | null>(null)
  const [currentPlanCode, setCurrentPlanCode] = useState<string | null>(null)
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [planError, setPlanError] = useState<string | null>(null)
  const [planSuccess, setPlanSuccess] = useState<string | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
    const token = localStorage.getItem('access_token')
    if (!token) {
      router.push('/login')
      return
    }

    billingApi.getPrices()
      .then((pricesData) => {
        setPrices(pricesData)
      })
      .catch(() => {
        setPageError(null)
      })

    billingApi.getStatus()
      .then((statusData) => setCurrentPlanCode(statusData.plan_code))
      .catch(() => {
        // Billing status is optional on pricing; plans still render from fallback.
      })
  }, [router])

  const handleSubscribe = async (planCode: string) => {
    const selectedPlan = (prices?.plans ?? []).find((plan) => plan.plan_code === planCode || plan.id === planCode) as PricePlan | undefined
    setLoadingPlan(planCode)
    setPlanError(null)
    setPlanSuccess(null)
    try {
      const checkoutPlanCode = selectedPlan?.checkout_plan_code ?? planCode
      const res = await billingApi.createCheckoutSession(checkoutPlanCode)

      const checkoutUrl = res.checkout_url
      if (checkoutUrl) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[billing] create-checkout-session success', {
            endpoint: 'POST /billing/create-checkout-session',
            plan_code: planCode,
            status: 200,
            responseBody: res,
          })
        }
        window.location.href = checkoutUrl
        return
      }

      if (res.mode === 'manual_pending') {
        setPlanSuccess(res.message || 'ส่งคำขอสมัครแพ็กเกจแล้ว กรุณารอผู้ดูแลยืนยัน')
        setLoadingPlan(null)
        return
      }

      if (!checkoutUrl) {
        throw Object.assign(new Error('Missing checkout_url in response'), {
          code: 'MISSING_CHECKOUT_URL',
          status: null,
          responseBody: res,
        })
      }
    } catch (err: unknown) {
      const errObj = err as Record<string, unknown>
      const status = errObj.status as number | undefined
      const isOffline =
        errObj.code === 'ECONNREFUSED' ||
        errObj.code === 'ERR_NETWORK' ||
        errObj.code === 'ECONNABORTED' ||
        errObj.code === 'MISSING_CHECKOUT_URL'
      const isConflict = status === 409
      const isUnauthorized = status === 401

      if (process.env.NODE_ENV === 'development') {
        console.error('[billing] create-checkout-session error', {
          endpoint: 'POST /billing/create-checkout-session',
          plan_code: planCode,
          status: status ?? null,
          code: errObj.code ?? null,
          responseBody: errObj.responseBody ?? null,
        })
      }

      if (isUnauthorized) {
        setPlanError('กรุณาเข้าสู่ระบบก่อนสมัครแพ็กเกจ')
        router.push('/login')
      } else if (isConflict) {
        setPlanError('สิทธิ์ Founder Price ครบแล้ว กรุณาเลือกแพ็กเกจราคาปกติ')
      } else {
        setPlanError(
          isOffline
            ? 'ไม่สามารถเชื่อมต่อระบบชำระเงินได้'
            : 'ไม่สามารถเปิดหน้าชำระเงินได้ กรุณาลองใหม่'
        )
      }
      setLoadingPlan(null)
    }
  }

  if (!mounted) return null

  // Derive TH and EP monthly plans — never crash on missing plans
  const allPlans = (prices?.plans ?? []) as PricePlan[]

  if (process.env.NODE_ENV !== 'production') {
    // Warn about any expected plan codes that are missing from API
    const foundCodes = new Set(allPlans.map(p => p.plan_code))
    const expected = ['free', 'th_founder_monthly', 'ep_founder_monthly', 'th_plus_monthly', 'ep_plus_monthly', 'th_plus_yearly_promo', 'ep_plus_yearly_promo']
    expected.forEach(code => {
      if (!foundCodes.has(code) && code !== 'free') {
        console.warn(`[pricing] Expected plan code "${code}" not found in API response. Will use fallback.`)
      }
    })
  }

  const thMonthly = allPlans.find(p => p.plan_code === 'th_plus_monthly') ?? null
  const thFounder = allPlans.find(p => p.plan_code === 'th_founder_monthly') ?? null
  const epMonthly = allPlans.find(p => p.plan_code === 'ep_plus_monthly') ?? null
  const epFounder = allPlans.find(p => p.plan_code === 'ep_founder_monthly') ?? null

  // TH card: prefer founder if available, else normal
  const thPlan: PricePlan | null = thFounder && thFounder.available !== false ? thFounder : thMonthly
  // EP card: prefer founder if available, else normal
  const epPlan: PricePlan | null = epFounder && epFounder.available !== false ? epFounder : epMonthly

  // Attach original_price for display when founder plan is shown
  if (thFounder && thFounder.available !== false && thPlan === thFounder && thMonthly) {
    thFounder.original_price_thb = thMonthly.price_thb
  }
  if (epFounder && epFounder.available !== false && epPlan === epFounder && epMonthly) {
    epFounder.original_price_thb = epMonthly.price_thb
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-background to-accent-50">

      {/* Header */}
      <header className="bg-white border-b border-primary-100 shadow-sm sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <TopaBrandMark />
          </Link>
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-gray-600 hover:text-primary-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-primary-50"
          >
            ← กลับแดชบอร์ด
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10">

        {/* Page title */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-white border border-primary-200 rounded-full px-4 py-1.5 mb-4 shadow-sm">
            <span className="text-sm font-semibold text-primary-700">💎 เลือกแพ็กเกจ</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-3">
            พร้อมเรียนขึ้นเรื่อยๆ แล้วหรือยัง?
          </h1>
          <p className="text-gray-500 text-lg">
            อัปเกรดเพื่อปลดล็อกทุกบทเรียน ป.1–ป.6
          </p>
        </div>

        {/* Error state */}
        {pageError && (
          <div className="card text-center py-8 max-w-md mx-auto mb-8 border-2 border-red-200 bg-red-50">
            <div className="text-4xl mb-3">😢</div>
            <p className="text-red-700 font-semibold mb-4">{pageError}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl shadow transition-colors"
            >
              🔄 ลองใหม่
            </button>
          </div>
        )}

        {/* Free Plan — always visible */}
        <div className="mb-6">
          <FreePlanCard currentPlanCode={currentPlanCode} />
        </div>

        {planSuccess && (
          <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">
            {planSuccess}
          </div>
        )}

        {/* Pricing — Plus TH + Plus EP */}
        {prices && (
          <HeroPlanCard
            thPlan={thPlan}
            epPlan={epPlan}
            founderSlotsRemaining={prices.founder_slots_remaining ?? null}
            founderLimit={prices.founder_limit ?? null}
            onSubscribe={handleSubscribe}
            loading={loadingPlan}
            error={planError}
            currentPlanCode={currentPlanCode}
          />
        )}

        {/* Loading skeletons */}
        {!prices && !pageError && (
          <div className="space-y-8">
            <div className="h-20 bg-amber-100 rounded-2xl animate-pulse mb-8" />
            <div className="grid md:grid-cols-2 gap-6">
              <div className="card h-80 animate-pulse bg-gray-100" />
              <div className="card h-80 animate-pulse bg-gray-100" />
            </div>
          </div>
        )}

        {/* Trust badges */}
        <div className="mt-10 text-center">
          <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-500">
            <span className="flex items-center gap-1.5">🔒 ชำระเงินปลอดภัยผ่าน Stripe</span>
            <span className="flex items-center gap-1.5">🚫 ยกเลิกได้ทุกเมื่อ</span>
            <span className="flex items-center gap-1.5">👨‍👩‍👧 เหมาะสำหรับครอบครัว</span>
          </div>
        </div>

        {/* Back link */}
        <div className="mt-6 text-center">
          <Link
            href="/dashboard"
            className="text-sm text-gray-500 hover:text-primary-600 transition-colors"
          >
            ← กลับไปที่แดชบอร์ด
          </Link>
        </div>
      </main>
    </div>
  )
}

