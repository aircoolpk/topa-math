import { apiClient } from '@/lib/api-client'
import { isAxiosError } from 'axios'

// ─── Types ───────────────────────────────────────────────────────────────────

export type BillingPlan = 'free' | 'plus' | 'th_founder' | 'ep_founder' | 'th_plus' | 'ep_plus'

export interface BillingPrices {
  checkout_provider?: 'stripe' | 'mpp'
  plans: BillingPlanRecord[]
  // Founder pool info
  founder_limit?: number
  founder_used?: number
  founder_slots_remaining?: number
  source?: 'backend' | 'dev_fallback'
  using_dev_fallback?: boolean
}

export interface BillingPlanRecord {
  id?: string
  plan_code: string
  name?: string
  name_th?: string
  title?: string
  display_name?: string
  description?: string
  price_monthly?: number | null
  currency?: string
  price_thb?: number
  price_minor?: number | null
  duration_days?: number | null
  auto_renew?: boolean
  original_price_thb?: number  // shown as "normal price" when founder
  interval?: 'monthly' | 'yearly' | 'month' | 'year' | 'none'
  billing_interval?: 'monthly' | 'yearly' | 'month' | 'year' | 'none'
  features?: string[]
  benefits?: string[]
  is_founder?: boolean
  is_promo?: boolean
  price_type?: string | null
  price_code?: string | null
  active_price_code?: string | null
  program_type?: string | null
  available?: boolean  // false when founder slots are full
  is_available?: boolean
  is_current?: boolean
  stripe_price_id?: string | null
  checkout_plan_code?: string | null
  badge?: string
}

export interface BillingStatus {
  provider?: 'mpp' | 'stripe'
  auto_renew?: boolean
  plan: BillingPlan
  is_paid: boolean
  plan_code: string | null
  current_period_end: string | null
  subscription_id: string | null
  // Extended fields from backend (may not be present for all users)
  membership_status?: string | null
  active_price_code?: string | null
  price_type?: string | null
  program_type?: string | null
  subscription_status?: string | null
  cancel_at_period_end?: string | null
}

export interface CheckoutSessionResponse {
  order_id?: string
  provider?: 'mpp' | 'stripe'
  checkout_url?: string
  mode?: 'stripe_checkout' | 'manual_pending' | string
  status?: string
  message?: string
  plan_code?: string
  price_type?: string
  program_type?: string
  payment_request?: {
    id: string
    user_id: string
    plan: string
    program: string
    billing_period: string
    price: number
    status: string
    created_at: string
  }
}

export interface MppOrderSummary {
  order_id: string
  plan_code: string
  status: string
  amount_minor: number
  currency: string
}

export function getMppCheckoutUrl(response: CheckoutSessionResponse): string {
  if (response.provider !== 'mpp' || !response.checkout_url) throw new Error('MPP checkout unavailable')
  const url = new URL(response.checkout_url)
  if (url.origin !== 'https://staging-pay.mmerchant.cc' || url.username || url.password) throw new Error('Unexpected payment host')
  return url.href
}

export function getCheckoutUrl(response: CheckoutSessionResponse): string {
  if (response.provider === 'mpp') return getMppCheckoutUrl(response)
  if (response.provider !== 'stripe' || !response.checkout_url) throw new Error('Checkout unavailable')
  const url = new URL(response.checkout_url)
  if (url.origin !== 'https://checkout.stripe.com' || url.username || url.password) throw new Error('Unexpected payment host')
  return url.href
}

export function getCheckoutErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const status = error.response?.status
    const detail = error.response?.data?.detail
    if (detail?.code === 'MPP_CHECKOUT_DISABLED') return 'ยังไม่เปิดใช้งาน MPP สำหรับรายการใหม่'
    if (detail?.code === 'MPP_CHECKOUT_ACCOUNT_NOT_AUTHORIZED') return 'บัญชีนี้ยังไม่ได้รับสิทธิ์ทดสอบการชำระผ่าน MPP'
    if (['CHECKOUT_PROVIDER_LOCKED', 'CHECKOUT_RECONCILIATION_REQUIRED'].includes(detail?.code)) return 'มีรายการชำระเงินเดิมที่ต้องตรวจสอบ กรุณาอย่าสร้างรายการข้ามระบบชำระเงิน'
    if (detail?.code === 'EXISTING_MPP_MEMBERSHIP') return 'บัญชีนี้มีสิทธิ์ MPP อยู่แล้ว กรุณาต่ออายุผ่านรายการ MPP เพื่อป้องกันชำระซ้ำ'
    if (detail?.code === 'EXISTING_STRIPE_SUBSCRIPTION') return 'บัญชีนี้มีสมาชิกที่เรียกเก็บเงินผ่าน Stripe อยู่แล้ว กรุณาจัดการสมาชิกเดิมก่อนเพื่อป้องกันชำระซ้ำ'
    if (detail?.code === 'PAYMENT_ALREADY_PENDING') return 'มีรายการชำระเงินที่รอยืนยันอยู่ กรุณาตรวจสอบรายการเดิมก่อน'
    if (detail?.code === 'PAYMENT_SESSION_EXPIRED') return 'หน้าชำระเงินหมดอายุแล้ว กรุณาตรวจสอบสถานะรายการก่อนชำระใหม่'
    if (detail?.code === 'MPP_PACKAGE_UNAVAILABLE') return 'แพ็กเกจนี้ยังไม่เปิดชำระผ่าน MPP'
    if (detail?.code === 'MPP_CONTRACT_UNAVAILABLE') return 'ยังไม่สามารถตรวจสอบข้อมูลระบบชำระเงินได้ กรุณาลองรายการเดิมอีกครั้งภายหลัง'
    if (status === 503 && detail?.code === 'MPP_CHECKOUT_BLOCKED') return 'ระบบชำระเงิน MPP ยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลหรือลองใหม่ภายหลัง'
    if (status === 401) return 'กรุณาเข้าสู่ระบบก่อนสมัครแพ็กเกจ'
    if (status === 409) return 'สิทธิ์ Founder Price ครบแล้ว กรุณาเลือกแพ็กเกจราคาปกติ'
    if (!error.response) return 'ไม่สามารถเชื่อมต่อระบบชำระเงินได้ กรุณาลองใหม่'
  }
  return 'ไม่สามารถเปิดหน้าชำระเงินได้ กรุณาลองใหม่'
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const DEV_FALLBACK_BILLING_PRICES: BillingPrices = {
  source: 'dev_fallback',
  using_dev_fallback: true,
  founder_limit: 100,
  founder_slots_remaining: 0,
  plans: [
    {
      id: 'free',
      plan_code: 'free',
      name: 'Free',
      display_name: 'Free',
      program_type: 'FREE',
      price_monthly: 0,
      price_thb: 0,
      currency: 'THB',
      billing_interval: 'none',
      price_type: 'free',
      description: 'ทดลองใช้งาน',
      features: ['ทดลองเรียนฟรี', 'เรียนได้ 3 เควส', 'ทำภารกิจระดับเริ่มต้น', 'Avatar พื้นฐาน'],
      is_current: true,
      is_available: true,
      available: true,
      stripe_price_id: null,
    },
    // ── TH Founder ──────────────────────────────────────────────────
    {
      id: 'th_founder_monthly',
      plan_code: 'th_founder_monthly',
      name: 'Plus TH Founder',
      display_name: 'Plus TH',
      name_th: 'Plus TH',
      program_type: 'THP',
      price_monthly: 199,
      price_thb: 199,
      original_price_thb: 299,
      currency: 'THB',
      billing_interval: 'month',
      price_type: 'founder',
      description: 'บทเรียนภาษาไทย ป.1–ป.6 — Founder Price',
      features: [
        'คณิตศาสตร์ภาษาไทย ป.1–ป.6',
        'บทเรียนทั้งหมด',
        'แบบทดสอบทุกระดับชั้น',
        'ระบบวิเคราะห์จุดอ่อน',
        'แบบฝึกเฉพาะบุคคล',
        'Quest รายวัน / รายสัปดาห์ / รายเดือน',
        'XP / Level / Rank',
        'Avatar และของตกแต่งพื้นฐาน',
      ],
      is_founder: true,
      is_available: true,
      available: false,
      stripe_price_id: null,
    },
    // ── TH Normal ───────────────────────────────────────────────────
    {
      id: 'th_plus_monthly',
      plan_code: 'th_plus_monthly',
      name: 'Plus TH',
      display_name: 'Plus TH',
      name_th: 'Plus TH',
      program_type: 'THP',
      price_monthly: 299,
      price_thb: 299,
      currency: 'THB',
      billing_interval: 'month',
      price_type: 'normal',
      description: 'บทเรียนภาษาไทย ป.1–ป.6',
      features: [
        'คณิตศาสตร์ภาษาไทย ป.1–ป.6',
        'บทเรียนทั้งหมด',
        'แบบทดสอบทุกระดับชั้น',
        'ระบบวิเคราะห์จุดอ่อน',
        'แบบฝึกเฉพาะบุคคล',
        'Quest รายวัน / รายสัปดาห์ / รายเดือน',
        'XP / Level / Rank',
        'Avatar และของตกแต่งพื้นฐาน',
      ],
      is_founder: false,
      is_available: true,
      available: true,
      stripe_price_id: null,
    },
    // ── TH Yearly Promo ─────────────────────────────────────────────
    {
      id: 'th_plus_yearly_promo',
      plan_code: 'th_plus_yearly_promo',
      name: 'Plus TH Yearly',
      display_name: 'Plus TH รายปี',
      name_th: 'Plus TH รายปี',
      program_type: 'THP',
      price_monthly: 2990,
      price_thb: 2990,
      currency: 'THB',
      billing_interval: 'year',
      price_type: 'promo',
      description: 'บทเรียนภาษาไทย ป.1–ป.6 — รายปี',
      features: [
        'คณิตศาสตร์ภาษาไทย ป.1–ป.6',
        'บทเรียนทั้งหมด',
        'แบบทดสอบทุกระดับชั้น',
        'ระบบวิเคราะห์จุดอ่อน',
        'แบบฝึกเฉพาะบุคคล',
        'Quest รายวัน / รายสัปดาห์ / รายเดือน',
        'XP / Level / Rank',
        'Avatar และของตกแต่งพื้นฐาน',
        'ราคาประหยัดกว่ารายเดือน 2 เท่า',
      ],
      is_founder: false,
      is_promo: true,
      is_available: true,
      available: true,
      stripe_price_id: null,
    },
    // ── EP Founder ──────────────────────────────────────────────────
    {
      id: 'ep_founder_monthly',
      plan_code: 'ep_founder_monthly',
      name: 'Plus EP Founder',
      display_name: 'Plus EP',
      name_th: 'Plus EP',
      program_type: 'EP',
      price_monthly: 399,
      price_thb: 399,
      original_price_thb: 599,
      currency: 'THB',
      billing_interval: 'month',
      price_type: 'founder',
      description: 'English Program — Founder Price',
      features: [
        'ทุกอย่างใน Plus TH',
        'โหมด English Program',
        'โจทย์และบทเรียนคณิตเป็นภาษาอังกฤษ',
        'คำศัพท์คณิตศาสตร์อังกฤษ',
        'เหมาะกับเด็ก EP / Inter / สองภาษา',
        'ปลดล็อก TH + EP',
      ],
      is_founder: true,
      is_available: true,
      available: false,
      stripe_price_id: null,
    },
    // ── EP Normal ───────────────────────────────────────────────────
    {
      id: 'ep_plus_monthly',
      plan_code: 'ep_plus_monthly',
      name: 'Plus EP',
      display_name: 'Plus EP',
      name_th: 'Plus EP',
      program_type: 'EP',
      price_monthly: 599,
      price_thb: 599,
      currency: 'THB',
      billing_interval: 'month',
      price_type: 'normal',
      description: 'English Program ป.1–ป.6',
      features: [
        'ทุกอย่างใน Plus TH',
        'โหมด English Program',
        'โจทย์และบทเรียนคณิตเป็นภาษาอังกฤษ',
        'คำศัพท์คณิตศาสตร์อังกฤษ',
        'เหมาะกับเด็ก EP / Inter / สองภาษา',
        'ปลดล็อก TH + EP',
      ],
      is_founder: false,
      is_available: true,
      available: true,
      stripe_price_id: null,
    },
    // ── EP Yearly Promo ─────────────────────────────────────────────
    {
      id: 'ep_plus_yearly_promo',
      plan_code: 'ep_plus_yearly_promo',
      name: 'Plus EP Yearly',
      display_name: 'Plus EP รายปี',
      name_th: 'Plus EP รายปี',
      program_type: 'EP',
      price_monthly: 5990,
      price_thb: 5990,
      currency: 'THB',
      billing_interval: 'year',
      price_type: 'promo',
      description: 'English Program ป.1–ป.6 — รายปี',
      features: [
        'ทุกอย่างใน Plus TH',
        'โหมด English Program',
        'โจทย์และบทเรียนคณิตเป็นภาษาอังกฤษ',
        'คำศัพท์คณิตศาสตร์อังกฤษ',
        'เหมาะกับเด็ก EP / Inter / สองภาษา',
        'ปลดล็อก TH + EP',
        'ราคาประหยัดกว่ารายเดือน 2 เท่า',
      ],
      is_founder: false,
      is_promo: true,
      is_available: true,
      available: true,
      stripe_price_id: null,
    },
  ],
}

export const billingApi = {
  async getMppOrders(): Promise<MppOrderSummary[]> {
    return (await apiClient.get('/billing/mpp/orders')).data as MppOrderSummary[]
  },
  /**
   * Fetch available plans with prices.
   * GET /billing/prices
   * Response: BillingPrices
   */
  async getPrices(): Promise<BillingPrices> {
    try {
      const res = await apiClient.get('/billing/prices')
      const data = res.data as BillingPrices
      return { ...data, plans: data.plans.map((plan) => ({ ...plan, price_thb: typeof plan.price_minor === 'number' ? plan.price_minor / 100 : plan.price_thb })) }
    } catch {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Failed to load billing plans from API, using dev fallback plans')
      }
      // Every plan in the fallback carries the same plan_code and price as the
      // backend catalogue. Filtering the monthly plans out of this list left the
      // pricing cards empty whenever the API was unavailable, so the whole
      // fallback is used as is.
      return {
        ...DEV_FALLBACK_BILLING_PRICES,
        plans: DEV_FALLBACK_BILLING_PRICES.plans.map((plan) => ({ ...plan })),
      }
    }
  },

  /**
   * Request MPP checkout for a selected plan.
   * POST /billing/mpp/checkout
   * Payload: { plan_code: string }
   * Unverified configuration/confirmation contract returns HTTP 503.
   */
  async createCheckoutSession(planCode: string): Promise<CheckoutSessionResponse> {
    const res = await apiClient.post('/billing/create-checkout-session', { plan_code: planCode }, { timeout: 30000 })
    return res.data as CheckoutSessionResponse
  },

  async createMppCheckout(planCode: string): Promise<CheckoutSessionResponse> {
    const res = await apiClient.post('/billing/mpp/checkout', { plan_code: planCode }, { timeout: 30000 })
    return res.data as CheckoutSessionResponse
  },

  /**
   * Create a Stripe Customer Portal session for managing billing.
   * POST /billing/create-portal-session
   * Response: { portal_url: string }
   */
  async createPortalSession(): Promise<{ portal_url: string }> {
    const res = await apiClient.post('/billing/create-portal-session')
    return res.data as { portal_url: string }
  },

  /**
   * Get current billing/membership status.
   * GET /billing/status
   * Response: BillingStatus
   */
  async getStatus(): Promise<BillingStatus> {
    // The pricing page asks for this only to mark the plan the visitor is on.
    // A visitor who is not signed in gets a 401 here, and the shared response
    // interceptor would send them to the login page instead of the prices they
    // came for.
    const res = await apiClient.get('/billing/status', { skipAuthRedirect: true })
    return res.data as BillingStatus
  },
}
