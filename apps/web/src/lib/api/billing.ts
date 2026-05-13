import { apiClient } from '@/lib/api-client'

// ─── Types ───────────────────────────────────────────────────────────────────

export type BillingPlan = 'free' | 'plus' | 'th_founder' | 'ep_founder' | 'th_plus' | 'ep_plus'

export interface BillingPrices {
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
  /**
   * Fetch available plans with prices.
   * GET /billing/prices
   * Response: BillingPrices
   */
  async getPrices(): Promise<BillingPrices> {
    try {
      const res = await apiClient.get('/billing/prices')
      return res.data as BillingPrices
    } catch {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Failed to load billing plans from API, using dev fallback plans')
      }
      return DEV_FALLBACK_BILLING_PRICES
    }
  },

  /**
   * Create a Stripe Checkout session for a selected plan.
   * POST /billing/create-checkout-session
   * Payload: { plan_code: string }
   * Response: { checkout_url: string }
   */
  async createCheckoutSession(planCode: string): Promise<{ checkout_url: string }> {
    const res = await apiClient.post('/billing/create-checkout-session', { plan_code: planCode })
    return res.data as { checkout_url: string }
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
    const res = await apiClient.get('/billing/status')
    return res.data as BillingStatus
  },
}
