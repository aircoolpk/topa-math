'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { billingApi, getCheckoutErrorMessage, getCheckoutUrl, type MppOrderSummary, type BillingStatus, type BillingPrices, type BillingPlanRecord } from '@/lib/api/billing'
import { TopaBrandMark, TopaMascot } from '@/components/brand/TopaBrand'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPrice(amount: number): string {
  return new Intl.NumberFormat('th-TH').format(amount)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// ─── Label helpers ────────────────────────────────────────────────────────────

function planCodeLabel(planCode: string | null): string {
  if (!planCode) return 'ยังไม่มีแพ็กเกจ'
  if (planCode === 'free') return 'ทดลองใช้ฟรี'
  if (planCode.includes('th_founder') || planCode === 'th_plus') return 'สมาชิก Plus TH'
  if (planCode.includes('ep_founder') || planCode === 'ep_plus') return 'สมาชิก Plus EP'
  if (planCode.includes('plus')) return 'สมาชิก Plus'
  return planCode
}

function subscriptionStatusLabel(status: string | null): string {
  if (!status) return 'ยังไม่มีแพ็กเกจ'
  switch (status) {
    case 'active':        return 'ใช้งานอยู่'
    case 'past_due':      return 'รอชำระเงิน'
    case 'pending':       return 'รอผู้ดูแลยืนยัน'
    case 'canceled':     return 'ยกเลิกแล้ว'
    case 'trialing':     return 'ทดลองใช้'
    case 'incomplete':   return 'รอชำระเงิน'
    default:             return status
  }
}

function subscriptionStatusColor(status: string | null): string {
  if (!status) return 'text-gray-500'
  switch (status) {
    case 'active':      return 'text-green-600'
    case 'past_due':   return 'text-red-600'
    case 'pending':    return 'text-amber-600'
    case 'canceled':   return 'text-gray-500'
    case 'trialing':   return 'text-blue-600'
    default:           return 'text-gray-500'
  }
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface DisplayPlan {
  auto_renew?: boolean
  id?: string
  plan_code: string
  name?: string
  name_th?: string
  title?: string
  display_name?: string
  description?: string
  price_monthly?: number | null
  currency?: string
  price_thb: number
  original_price_thb?: number
  interval?: 'monthly' | 'yearly' | 'month' | 'year' | 'none'
  billing_interval?: 'monthly' | 'yearly' | 'month' | 'year' | 'none'
  features?: string[]
  benefits?: string[]
  is_founder: boolean
  is_promo: boolean
  price_type?: string | null
  price_code?: string | null
  active_price_code?: string | null
  program_type?: string | null
  available?: boolean
  is_available?: boolean
  is_current?: boolean
  stripe_price_id?: string | null
  checkout_plan_code?: string | null
  badge?: string
  tag?: string  // e.g. "Founder Price", "Yearly Promo", "รายเดือน"
}

// Feature copy is served by the backend (PLAN_CATALOG in routers/billing.py).
// We no longer hardcode benefit lists here — if the backend returns nothing,
// show an empty list (better than misleading copy that contradicts the catalog).

const getPlanFeatures = (plan: Partial<DisplayPlan> | BillingPlanRecord | null | undefined): string[] => {
  const normalizeFeature = (feature: string) =>
    feature === 'Singapore Math diagrams' ? 'แผนภาพแบบ Singapore Math' : feature
  if (Array.isArray(plan?.features) && plan.features.length > 0) return plan.features.map(normalizeFeature)
  if (Array.isArray(plan?.benefits) && plan.benefits.length > 0) return plan.benefits.map(normalizeFeature)
  return []
}

const getPlanCode = (plan: Partial<DisplayPlan> | BillingPlanRecord | null | undefined): string => {
  return String(plan?.plan_code ?? plan?.id ?? plan?.price_code ?? plan?.active_price_code ?? '')
}

const getPlanName = (plan: Partial<DisplayPlan> | BillingPlanRecord | null | undefined): string => {
  const planCode = getPlanCode(plan)
  return String(plan?.name ?? plan?.name_th ?? plan?.display_name ?? plan?.title ?? (planCode || 'แพ็กเกจ'))
}

const getPlanPrice = (plan: Partial<DisplayPlan> | BillingPlanRecord | null | undefined): number => {
  const value = Number(plan?.price_thb ?? plan?.price_monthly ?? 0)
  return Number.isFinite(value) ? value : 0
}

const getPlanProgramType = (plan: Partial<DisplayPlan> | BillingPlanRecord | null | undefined): string => {
  const planCode = getPlanCode(plan).toLowerCase()
  return String(plan?.program_type ?? (planCode.includes('ep') ? 'EP' : planCode.includes('th') ? 'THP' : planCode.includes('family') ? 'BOTH' : 'FREE'))
}

const getPlanInterval = (plan: Partial<DisplayPlan> | BillingPlanRecord | null | undefined): DisplayPlan['interval'] => {
  const interval = plan?.interval ?? plan?.billing_interval
  if (interval === 'year') return 'yearly'
  if (interval === 'month') return 'monthly'
  return interval ?? 'monthly'
}

const getIsFounderPlan = (plan: Partial<DisplayPlan> | BillingPlanRecord | null | undefined): boolean => {
  const priceType = String(plan?.price_type ?? '').toLowerCase()
  return Boolean(plan?.is_founder) || priceType === 'founder' || getPlanCode(plan).includes('founder')
}

const getIsPromoPlan = (plan: Partial<DisplayPlan> | BillingPlanRecord | null | undefined): boolean => {
  const priceType = String(plan?.price_type ?? '').toLowerCase()
  return Boolean(plan?.is_promo) || priceType === 'yearly_promo' || getPlanCode(plan).includes('yearly')
}

const toDisplayPlan = (plan: BillingPlanRecord): DisplayPlan => ({
  ...plan,
  plan_code: getPlanCode(plan),
  name_th: getPlanName(plan),
  price_thb: getPlanPrice(plan),
  interval: getPlanInterval(plan),
  features: getPlanFeatures(plan),
  benefits: Array.isArray(plan.benefits) ? plan.benefits : undefined,
  is_founder: getIsFounderPlan(plan),
  is_promo: getIsPromoPlan(plan),
  program_type: getPlanProgramType(plan),
  price_code: plan.price_code ?? plan.active_price_code ?? plan.plan_code,
  available: plan.available !== false && plan.is_available !== false,
})

// ─── Plan Card Component ───────────────────────────────────────────────────────

interface PlanCardProps {
  plan: DisplayPlan
  isCurrentPlan: boolean
  onSubscribe: (planCode: string) => void
  loading: string | null
  error: string | null
  errorPlan: string | null
}

function PlanCard({ plan, isCurrentPlan, onSubscribe, loading, error, errorPlan }: PlanCardProps) {
  const planCode = getPlanCode(plan)
  const planName = getPlanName(plan)
  const planPrice = getPlanPrice(plan)
  const planFeatures = getPlanFeatures(plan)
  const isFounder = getIsFounderPlan(plan)
  const isPromo = getIsPromoPlan(plan)
  const isFree = planCode === 'free'
  const isYearly = planCode.includes('yearly') || getPlanInterval(plan) === 'yearly'
  const programType = getPlanProgramType(plan).toUpperCase()
  const isEP = programType === 'EP' || planCode.includes('ep_')
  const isFamily = programType === 'BOTH' || planCode.includes('family')

  const accentClass = isEP
    ? 'border-blue-200 hover:border-blue-400'
    : isFamily
      ? 'border-accent-200 hover:border-accent-400'
    : 'border-primary-200 hover:border-primary-400'

  const badgeBgClass = isEP
    ? 'bg-gradient-to-r from-blue-400 to-blue-600'
    : isFamily
      ? 'bg-gradient-to-r from-accent-400 to-accent-600'
    : 'bg-gradient-to-r from-primary-400 to-primary-600'

  const ctaClass = isEP
    ? 'bg-blue-500 hover:bg-blue-600'
    : isFamily
      ? 'bg-accent-500 hover:bg-accent-600'
    : 'bg-primary-500 hover:bg-primary-600'

  if (isFounder) {
    badgeBgClass
  }

  return (
    <div className={`card border-2 flex flex-col overflow-hidden transition-all ${accentClass} ${isCurrentPlan ? 'ring-2 ring-green-400' : ''}`}>
      {/* Badge */}
      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
        {isFounder ? (
          <div className="bg-gradient-to-r from-amber-400 to-amber-600 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow flex items-center gap-1.5">
            👑 {plan.tag ?? 'Founder Price'}
          </div>
        ) : isPromo && isYearly ? (
          <div className="bg-gradient-to-r from-accent-400 to-accent-600 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow flex items-center gap-1.5">
            🔥 {plan.tag ?? 'Yearly Promo'}
          </div>
        ) : (
          <div className={`${badgeBgClass} text-white text-xs font-bold px-4 py-1.5 rounded-full shadow`}>
            {plan.tag ?? (isYearly ? 'รายปี' : 'รายเดือน')}
          </div>
        )}
      </div>

      {/* Card content */}
      <div className="pt-6 pb-4 px-5 flex flex-col flex-1">
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg shadow ${
            isFounder
              ? 'bg-gradient-to-br from-amber-300 to-amber-500'
              : isEP
                ? 'bg-gradient-to-br from-blue-300 to-blue-500'
                : 'bg-gradient-to-br from-primary-300 to-primary-500'
          }`}>
            {isFounder ? '👑' : isFree ? '0' : isEP ? '🌏' : isFamily ? 'F' : '📖'}
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm leading-tight">{planName}</p>
            <p className="text-xs text-gray-400">{plan.description ?? (isFree ? 'ทดลองใช้งาน' : isFamily ? 'THP + EP' : isEP ? 'English Program · ป.1–ป.6' : 'หลักสูตรภาษาไทย · ป.1–ป.6')}</p>
          </div>
        </div>

        {/* Price */}
        <div className="mb-1">
          <span className="text-3xl font-extrabold text-gray-900">฿{formatPrice(planPrice)}</span>
          <span className="text-xs text-gray-400 font-medium ml-1">
            /{isFree ? 'ฟรี' : isYearly ? 'ปี' : plan.auto_renew === false ? '30 วัน' : 'เดือน'}
          </span>
        </div>
        {plan.original_price_thb && plan.original_price_thb > planPrice && (
          <p className="text-xs text-gray-400 line-through mb-0.5">
            ฿{formatPrice(plan.original_price_thb)}/เดือน
          </p>
        )}
        <p className="text-xs text-gray-400 mb-4">
          {isYearly ? 'ราคารายปี' : plan.auto_renew === false ? 'ชำระครั้งเดียวสำหรับสิทธิ์ 30 วัน' : 'สมาชิกแบบต่ออายุอัตโนมัติ'}
        </p>

        {/* Features */}
        <ul className="space-y-1.5 mb-4 flex-1">
          {planFeatures.slice(0, 4).map((f, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
              <span className={`flex-shrink-0 mt-0.5 ${isFounder ? 'text-amber-500' : isEP ? 'text-blue-500' : 'text-primary-500'}`}>✓</span>
              {f}
            </li>
          ))}
        </ul>

        {/* CTA */}
        <div className="border-t border-gray-200 pt-3">
          {isCurrentPlan ? (
            <div className="w-full py-2.5 text-center rounded-xl bg-green-50 border-2 border-green-300">
              <p className="text-xs font-bold text-green-700">✓ แพ็กเกจปัจจุบัน</p>
            </div>
          ) : isFree ? (
            <button
              onClick={() => onSubscribe(planCode)}
              className="w-full font-bold py-2.5 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors text-sm"
            >
              เริ่มใช้ฟรี
            </button>
          ) : plan.available === false ? (
            <div className="w-full py-2.5 text-center rounded-xl bg-gray-100 text-gray-400 font-bold text-xs">
              แพ็กเกจนี้ยังไม่เปิดชำระเงิน
            </div>
          ) : (
            <>
              <button
                onClick={() => onSubscribe(planCode)}
                disabled={!!loading}
                className={`w-full font-bold py-2.5 rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm ${isFounder ? 'bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700' : ctaClass}`}
              >
                {loading === planCode ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <span className="animate-spin text-sm">⏳</span>กำลังเปิด...
                  </span>
                ) : 'เลือกแพ็กเกจ'}
              </button>
              {error && errorPlan === planCode && (
                <p role="alert" className="text-xs text-red-600 mt-1.5 text-center">{error}</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Membership Status Card ───────────────────────────────────────────────────

interface MembershipCardProps {
  status: BillingStatus | null
  loading: boolean
}

function MembershipCard({ status, loading }: MembershipCardProps) {
  const subStatus = status?.subscription_status ?? null
  const isPaid = status?.is_paid ?? false

  // Status banner
  let statusBanner: React.ReactNode = null
  if (subStatus === 'past_due') {
    statusBanner = (
      <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 flex items-start gap-2">
        <span className="text-red-500 text-sm mt-0.5">⚠️</span>
        <p className="text-sm text-red-700 font-medium">
          ยังมีการชำระเงินค้างอยู่ กรุณาจัดการบัตรหรือชำระเงิน
        </p>
      </div>
    )
  } else if (subStatus === 'active' || isPaid) {
    statusBanner = (
      <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-4 flex items-start gap-2">
        <span className="text-green-500 text-sm mt-0.5">✅</span>
        <p className="text-sm text-green-700 font-medium">
          สมาชิกของคุณใช้งานได้ปกติ
        </p>
      </div>
    )
  } else if (!status) {
    statusBanner = (
      <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-4 flex items-start gap-2">
        <span className="text-gray-400 text-sm mt-0.5">⏳</span>
        <p className="text-sm text-gray-500 font-medium">
          กำลังโหลดสถานะสมาชิก...
        </p>
      </div>
    )
  } else {
    statusBanner = (
      <div className="bg-accent-50 border border-accent-200 rounded-xl px-4 py-3 mb-4 flex items-start gap-2">
        <span className="text-accent-500 text-sm mt-0.5">💡</span>
        <p className="text-sm text-accent-700 font-medium">
          เลือกแพ็กเกจเพื่อปลดล็อกบทเรียน ป.1–ป.6
        </p>
      </div>
    )
  }

  // plan_code label
  const planLabel = planCodeLabel(status?.plan_code ?? null)
  const subLabel = subscriptionStatusLabel(subStatus)
  const subColor = subscriptionStatusColor(subStatus)

  return (
    <div className="card shadow-md border-primary-100 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <TopaMascot size="sm" />
        <h2 className="font-bold text-gray-900 text-base">สถานะสมาชิก</h2>
      </div>

      {statusBanner}

      {loading && !status ? (
        <div className="space-y-3">
          <div className="h-4 bg-gray-100 rounded animate-pulse w-3/4" />
          <div className="h-4 bg-gray-100 rounded animate-pulse w-1/2" />
          <div className="h-4 bg-gray-100 rounded animate-pulse w-2/3" />
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
            <span className="text-gray-500">แพ็กเกจ</span>
            <span className="font-semibold text-gray-900">{planLabel}</span>
          </div>
          <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
            <span className="text-gray-500">สถานะ</span>
            <span className={`font-semibold ${subColor}`}>{subLabel}</span>
          </div>
          {status?.cancel_at_period_end && (
            <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
              <span className="text-gray-500">ยกเลิกเมื่อ</span>
              <span className="font-semibold text-red-600">
                {formatDate(status.cancel_at_period_end)}
              </span>
            </div>
          )}
          {status?.current_period_end && (
            <div className="flex justify-between items-center py-1.5">
              <span className="text-gray-500">สิ้นสุด</span>
              <span className="font-semibold text-gray-700">
                {formatDate(status.current_period_end)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Payment Method Section ───────────────────────────────────────────────────

interface PaymentMethodSectionProps {
  status: BillingStatus | null
  loading: boolean
  onManageCard: () => void
  managingCard: boolean
  cardError: string | null
}

function PaymentMethodSection({
  status,
  loading,
  onManageCard,
  managingCard,
  cardError,
}: PaymentMethodSectionProps) {
  const isPaid = status?.is_paid ?? false
  const hasActiveSub = status?.subscription_status === 'active'

  if (loading && !status) {
    return (
      <div className="card shadow-md border-gray-100 mb-6">
        <div className="h-5 bg-gray-100 rounded animate-pulse w-1/3 mb-3" />
        <div className="h-4 bg-gray-100 rounded animate-pulse w-2/3" />
      </div>
    )
  }

  if (isPaid || hasActiveSub) {
    return (
      <div className="card shadow-md border-blue-100 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm">💳</span>
          </div>
          <h2 className="font-bold text-gray-900 text-base">วิธีการชำระเงิน</h2>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-7 bg-gradient-to-r from-blue-100 to-blue-200 rounded flex items-center justify-center border border-blue-300">
              <span className="text-blue-700 text-xs font-bold">VISA</span>
            </div>
            <p className="text-sm text-gray-600">•••• •••• •••• ••••</p>
          </div>
          <button
            onClick={onManageCard}
            disabled={managingCard}
            className="text-xs font-bold bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors disabled:opacity-50"
          >
            {managingCard ? (
              <span className="flex items-center gap-1"><span className="animate-spin text-sm">⏳</span>กำลังเปิด...</span>
            ) : 'จัดการบัตร / ใบแจ้งหนี้'}
          </button>
        </div>
        {cardError && (
          <p className="text-xs text-red-600 mt-2">{cardError}</p>
        )}
      </div>
    )
  }

  return (
    <div className="card shadow-md border-gray-100 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 bg-gradient-to-br from-gray-300 to-gray-500 rounded-lg flex items-center justify-center">
          <span className="text-white text-sm">💳</span>
        </div>
        <h2 className="font-bold text-gray-900 text-base">วิธีการชำระเงิน</h2>
      </div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-gray-400 text-sm">ยังไม่ได้ผูกบัตร</span>
      </div>
      <p className="text-xs text-gray-400">
        เลือกแพ็กเกจด้านล่างเพื่อสมัครสมาชิก
      </p>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null)
  const [prices, setPrices] = useState<BillingPrices | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [loadingPrices, setLoadingPrices] = useState(true)
  const [subscribeLoading, setSubscribeLoading] = useState<string | null>(null)
  const [subscribeError, setSubscribeError] = useState<string | null>(null)
  const [subscribeErrorPlan, setSubscribeErrorPlan] = useState<string | null>(null)
  const [subscribeSuccess, setSubscribeSuccess] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalError, setPortalError] = useState<string | null>(null)
  const [mppOrders, setMppOrders] = useState<MppOrderSummary[]>([])

  useEffect(() => {
    setMounted(true)
    billingApi.getMppOrders().then(setMppOrders).catch(() => undefined)

    // Load billing status
    billingApi.getStatus()
      .then((data) => {
        setBillingStatus(data)
      })
      .catch(() => {
        // non-critical — status may fail if free user has no Stripe customer yet
      })
      .finally(() => setLoadingStatus(false))

    // Load prices
    billingApi.getPrices()
      .then((data) => setPrices(data))
      .catch(() => {})
      .finally(() => setLoadingPrices(false))
  }, [router])

  const isDevMode = process.env.NODE_ENV === 'development'

  const handleSubscribe = async (planCode: string) => {
    const selectedPlan = (prices?.plans ?? []).map(toDisplayPlan).find((plan) => getPlanCode(plan) === planCode)
    if (planCode === 'free') {
      setSubscribeError('คุณใช้แพ็กเกจ Free ได้เลย')
      setSubscribeErrorPlan(planCode)
      setSubscribeSuccess(null)
      return
    }
    setSubscribeLoading(planCode)
    setSubscribeError(null)
    setSubscribeErrorPlan(null)
    setSubscribeSuccess(null)
    try {
      const checkoutPlanCode = selectedPlan?.checkout_plan_code ?? planCode
      const res = billingStatus?.provider === 'mpp'
        ? await billingApi.createMppCheckout(checkoutPlanCode)
        : await billingApi.createCheckoutSession(checkoutPlanCode)
      window.location.href = getCheckoutUrl(res)
    } catch (err: unknown) {
      setSubscribeError(getCheckoutErrorMessage(err))
      billingApi.getMppOrders().then(setMppOrders).catch(() => undefined)
      setSubscribeErrorPlan(planCode)
      setSubscribeLoading(null)
    }
  }

  const handleManageCard = async () => {
    setPortalLoading(true)
    setPortalError(null)
    try {
      const res = await billingApi.createPortalSession()
      const portalUrl = (res as unknown as Record<string, unknown>).portal_url as string
      if (!portalUrl) throw new Error('Missing portal_url')
      window.location.href = portalUrl
    } catch {
      setPortalError('ไม่สามารถเปิดหน้าจัดการบิลลิ่งได้ กรุณาลองใหม่')
      setPortalLoading(false)
    }
  }

  if (!mounted) return null

  // Build display plans from API
  const allPlans = (prices?.plans ?? []).map(toDisplayPlan)
  const freePlans = allPlans.filter((p) => getPlanCode(p) === 'free')
  const thPlans = allPlans.filter((p) => /(^th_|thp)/.test(getPlanCode(p)) && !getPlanCode(p).includes('yearly'))
  const epPlans = allPlans.filter((p) => getPlanCode(p).includes('ep') && !getPlanCode(p).includes('yearly'))
  const familyPlans = allPlans.filter((p) => getPlanCode(p).includes('family'))
  const thYearlyPlans = allPlans.filter((p) => getPlanCode(p).includes('th_') && getPlanCode(p).includes('yearly'))
  const epYearlyPlans = allPlans.filter((p) => getPlanCode(p).includes('ep_') && getPlanCode(p).includes('yearly'))

  // Attach display tags
  thPlans.forEach(p => {
    if (getIsFounderPlan(p)) p.tag = 'Founder Price'
    else p.tag = 'รายเดือน'
  })
  epPlans.forEach(p => {
    if (getIsFounderPlan(p)) p.tag = 'Founder Price'
    else p.tag = 'รายเดือน'
  })
  familyPlans.forEach(p => { p.tag = 'Family' })
  thYearlyPlans.forEach(p => { p.tag = 'Yearly Promo' })
  epYearlyPlans.forEach(p => { p.tag = 'Yearly Promo' })

  const currentPlanCode = billingStatus?.plan_code ?? null

  const hasAnyPlans = allPlans.length > 0
  const pageLoading = loadingStatus && loadingPrices

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-background to-accent-50">

      {/* Header */}
      <header className="bg-white border-b border-primary-100 shadow-sm sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
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

      <main className="max-w-3xl mx-auto px-4 py-8">

        {/* Page title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-white border border-primary-200 rounded-full px-4 py-1.5 mb-4 shadow-sm">
            <span className="text-sm font-semibold text-primary-700">💳 จัดการบิลลิ่ง</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-2">
            จัดการบิลลิ่ง
          </h1>
          <p className="text-gray-500 text-sm md:text-base">
            ดูสถานะสมาชิก ผูกบัตร และจัดการแพ็กเกจของคุณ
          </p>
        </div>

        {/* Loading state */}
        {pageLoading && (
          <div className="space-y-4">
            <div className="card h-40 animate-pulse bg-gray-100" />
            <div className="card h-24 animate-pulse bg-gray-100" />
          </div>
        )}

        {/* Load error */}
        {!pageLoading && !hasAnyPlans && (
          <div className="card text-center py-10 border-2 border-red-200 bg-red-50 mb-6">
            <div className="text-4xl mb-3">😢</div>
            <p className="text-red-700 font-semibold mb-4">โหลดข้อมูลบิลลิ่งไม่สำเร็จ</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl shadow transition-colors"
            >
              🔄 ลองใหม่
            </button>
          </div>
        )}

        {hasAnyPlans && (
          <>
            {/* ── Membership status ── */}
            <MembershipCard status={billingStatus} loading={loadingStatus} />

            {/* ── Payment method ── */}
            <PaymentMethodSection
              status={billingStatus}
              loading={loadingStatus}
              onManageCard={handleManageCard}
              managingCard={portalLoading}
              cardError={portalError}
            />

            <p className="mb-5 text-sm text-gray-600">{prices?.checkout_provider === 'mpp' ? 'MPP ชำระครั้งเดียว 30 วัน ไม่มีการหักเงินอัตโนมัติ' : 'Stripe ต่ออายุอัตโนมัติ จัดการสมาชิกได้ผ่าน Customer Portal'}</p>
            {billingStatus?.provider === 'mpp' && billingStatus.active_price_code && <button className="mb-5 rounded-lg border border-sky-300 px-4 py-2 text-sm font-bold text-sky-800 disabled:opacity-40" disabled={!!subscribeLoading} onClick={() => handleSubscribe(billingStatus.active_price_code!)}>ต่ออายุสิทธิ์อีก 30 วัน</button>}
            {mppOrders.length > 0 && <section className="mb-6 border-y border-gray-200 py-4"><h2 className="mb-3 font-bold">ประวัติชำระเงิน MPP</h2><ul className="divide-y divide-gray-100">{mppOrders.map((order) => <li key={order.order_id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><span>{order.plan_code} · {(order.amount_minor / 100).toLocaleString('th-TH')} บาท · {order.status}</span><Link className="font-semibold text-sky-700" href={`/billing/payments/${order.order_id}`}>ตรวจสอบรายการ</Link></li>)}</ul></section>}
            {subscribeSuccess && (
              <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">
                {subscribeSuccess}
              </div>
            )}

            {prices?.using_dev_fallback && process.env.NODE_ENV === 'development' && (
              <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                ใช้ข้อมูลแพ็กเกจชั่วคราวสำหรับ dev
              </div>
            )}

            {/* ── Founder note ── */}
            {prices?.founder_slots_remaining != null && (
              <div className="bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 border-2 border-amber-300 rounded-2xl px-5 py-4 mb-8 text-center">
                <p className="text-amber-800 font-extrabold text-sm">
                  👑 Founder Price จำกัดรวม 100 สิทธิ์แรก หากยกเลิกแล้วสมัครใหม่จะเป็นราคาปกติ
                </p>
                {prices.founder_slots_remaining > 0 ? (
                  <p className="text-amber-700 text-xs font-semibold mt-1">
                    ✨ เหลือ Founder Price อีก {prices.founder_slots_remaining} สิทธิ์
                  </p>
                ) : (
                  <p className="text-red-600 text-xs font-semibold mt-1">
                    ❌ สิทธิ์เต็มแล้ว — ใช้ราคาปกติได้เลย
                  </p>
                )}
              </div>
            )}

            {/* ── Monthly plans ── */}
            {(freePlans.length > 0 || thPlans.length > 0 || epPlans.length > 0 || familyPlans.length > 0) && (
              <div className="mb-6">
                <h3 className="text-base font-extrabold text-gray-900 mb-4 flex items-center gap-2">
                  <span>📋</span> แพ็กเกจสมาชิก
                </h3>
                <div className="grid md:grid-cols-2 gap-5">
                  {freePlans.map(plan => (
                    <PlanCard
                      key={plan.plan_code}
                      plan={plan}
                      isCurrentPlan={currentPlanCode === plan.plan_code || !billingStatus?.is_paid}
                      onSubscribe={handleSubscribe}
                      loading={subscribeLoading}
                      error={subscribeError}
                      errorPlan={subscribeErrorPlan}
                    />
                  ))}
                  {thPlans.map(plan => (
                    <PlanCard
                      key={plan.plan_code}
                      plan={plan}
                      isCurrentPlan={currentPlanCode === plan.plan_code}
                      onSubscribe={handleSubscribe}
                      loading={subscribeLoading}
                      error={subscribeError}
                      errorPlan={subscribeErrorPlan}
                    />
                  ))}
                  {epPlans.map(plan => (
                    <PlanCard
                      key={plan.plan_code}
                      plan={plan}
                      isCurrentPlan={currentPlanCode === plan.plan_code}
                      onSubscribe={handleSubscribe}
                      loading={subscribeLoading}
                      error={subscribeError}
                      errorPlan={subscribeErrorPlan}
                    />
                  ))}
                  {familyPlans.map(plan => (
                    <PlanCard
                      key={plan.plan_code}
                      plan={plan}
                      isCurrentPlan={currentPlanCode === plan.plan_code}
                      onSubscribe={handleSubscribe}
                      loading={subscribeLoading}
                      error={subscribeError}
                      errorPlan={subscribeErrorPlan}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── Yearly plans ── */}
            {(thYearlyPlans.length > 0 || epYearlyPlans.length > 0) && (
              <div className="mb-6">
                <h3 className="text-base font-extrabold text-gray-900 mb-4 flex items-center gap-2">
                  <span>🔥</span> แพ็กเกจรายปี — ประหยัดสูงสุด
                </h3>
                <div className="grid md:grid-cols-2 gap-5">
                  {thYearlyPlans.map(plan => (
                    <PlanCard
                      key={plan.plan_code}
                      plan={plan}
                      isCurrentPlan={currentPlanCode === plan.plan_code}
                      onSubscribe={handleSubscribe}
                      loading={subscribeLoading}
                      error={subscribeError}
                      errorPlan={subscribeErrorPlan}
                    />
                  ))}
                  {epYearlyPlans.map(plan => (
                    <PlanCard
                      key={plan.plan_code}
                      plan={plan}
                      isCurrentPlan={currentPlanCode === plan.plan_code}
                      onSubscribe={handleSubscribe}
                      loading={subscribeLoading}
                      error={subscribeError}
                      errorPlan={subscribeErrorPlan}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── Trust badges ── */}
            <div className="mt-8 text-center">
              <div className="flex flex-wrap justify-center gap-5 text-xs text-gray-500">
                <span className="flex items-center gap-1.5">🔒 {prices?.checkout_provider === 'mpp' ? 'MPP (Staging)' : 'Stripe'}</span>
                <span className="flex items-center gap-1.5">🚫 ยกเลิกได้ทุกเมื่อ</span>
                <span className="flex items-center gap-1.5">👨‍👩‍👧 เหมาะสำหรับครอบครัว</span>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

