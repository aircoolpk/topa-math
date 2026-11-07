/**
 * Billing plan catalogue endpoints — `/billing/plans` and `/billing/prices`.
 *
 * The plan catalogue is static configuration (mirroring `PLAN_CATALOG` in the
 * FastAPI billing router); only the founder slot counters come from the
 * database.
 */
import { Hono, type Context } from 'hono'

import type { AppEnv } from '../lib/http'

export const billingRoutes = new Hono<AppEnv>()

/** A purchasable plan. */
interface PlanDefinition {
  plan_code: string
  display_name: string
  program_type: string
  price_thb: number
  billing_interval: 'month' | 'year' | 'none'
  price_type: string
  product_id: string
  features: string[]
}

/** Feature list for the Thai Program plans. */
const TH_PLAN_FEATURES = [
  'ปลดล็อกบทเรียนคณิต ป.1-ป.6 ทั้งหมด',
  'แบบทดสอบทุกระดับชั้น ไม่จำกัด',
  'ระบบ AI วิเคราะห์จุดอ่อน',
  'แบบฝึกเฉพาะบุคคล',
  'Quest รายวัน / รายสัปดาห์ / รายเดือน',
  'XP / Level / Rank ทั่วประเทศ',
  'Avatar และของตกแต่งพื้นฐาน',
]

/** Feature list for the English Program plans. */
const EP_PLAN_FEATURES = [
  'ทุกอย่างในแพ็กเกจ TH',
  'โหมด English Program (EP)',
  'โจทย์และบทเรียนคณิตเป็นภาษาอังกฤษ',
  'คำศัพท์คณิตศาสตร์ภาษาอังกฤษ',
  'เหมาะกับเด็ก EP / Inter / สองภาษา',
  'ปลดล็อกทั้ง TH และ EP ในบัญชีเดียว',
]

/** The plan catalogue, mirroring the FastAPI `PLAN_CATALOG`. */
const PLAN_CATALOG: PlanDefinition[] = [
  {
    plan_code: 'th_founder_monthly',
    display_name: 'Plus TH Founder',
    program_type: 'TH',
    price_thb: 199,
    billing_interval: 'month',
    price_type: 'founder',
    product_id: 'prod_USgNoW3SqfYosf',
    features: TH_PLAN_FEATURES,
  },
  {
    plan_code: 'ep_founder_monthly',
    display_name: 'Plus EP Founder',
    program_type: 'EP',
    price_thb: 399,
    billing_interval: 'month',
    price_type: 'founder',
    product_id: 'prod_USgTRV2ZTxagVu',
    features: EP_PLAN_FEATURES,
  },
  {
    plan_code: 'th_plus_monthly',
    display_name: 'Plus TH',
    program_type: 'TH',
    price_thb: 299,
    billing_interval: 'month',
    price_type: 'normal',
    product_id: 'prod_USg9dDnZ1L1Wye',
    features: TH_PLAN_FEATURES,
  },
  {
    plan_code: 'ep_plus_monthly',
    display_name: 'Plus EP',
    program_type: 'EP',
    price_thb: 599,
    billing_interval: 'month',
    price_type: 'normal',
    product_id: 'prod_USgHn9EzVjHbsW',
    features: EP_PLAN_FEATURES,
  },
  {
    plan_code: 'th_plus_yearly_promo',
    display_name: 'Plus TH Year Promotion',
    program_type: 'TH',
    price_thb: 2990,
    billing_interval: 'year',
    price_type: 'yearly_promo',
    product_id: 'prod_USga3JRbWSg1lM',
    features: TH_PLAN_FEATURES,
  },
  {
    plan_code: 'ep_plus_yearly_promo',
    display_name: 'Plus EP Year Promotion',
    program_type: 'EP',
    price_thb: 5990,
    billing_interval: 'year',
    price_type: 'yearly_promo',
    product_id: 'prod_USgaai45iXRZH',
    features: EP_PLAN_FEATURES,
  },
]

/** The maximum number of founder-price slots. */
const FOUNDER_LIMIT = 100

/** Founder slot counters. */
async function founderSlots(c: Context<AppEnv>) {
  const sql = c.get('sql')
  const rows = (await sql.query(
    `SELECT COUNT(*)::int AS used
     FROM users
     WHERE plan IN ('th_founder', 'ep_founder', 'th_founder_monthly', 'ep_founder_monthly')
       AND is_active = true`,
  )) as Array<{ used: number }>

  const used = Number(rows[0]?.used ?? 0)
  return {
    founder_limit: FOUNDER_LIMIT,
    founder_used: used,
    founder_slots_remaining: Math.max(0, FOUNDER_LIMIT - used),
    founder_shared_pool: true,
  }
}

billingRoutes.get('/prices', async (c) => {
  const founder = await founderSlots(c)
  const freePlan = {
    plan_code: 'free',
    display_name: 'ทดลองใช้งาน',
    program_type: 'FREE',
    price_thb: 0,
    billing_interval: 'none',
    price_type: 'free',
    available: true,
  }

  const plans = [
    freePlan,
    ...PLAN_CATALOG.map((plan) => ({
      plan_code: plan.plan_code,
      display_name: plan.display_name,
      program_type: plan.program_type,
      price_thb: plan.price_thb,
      billing_interval: plan.billing_interval,
      price_type: plan.price_type,
      product_id: plan.product_id,
      stripe_price_id: null,
      available: true,
      features: plan.features,
    })),
  ]

  return c.json({ plans, ...founder, source: 'backend' })
})

billingRoutes.get('/plans', async (c) => {
  const founder = await founderSlots(c)
  const plans = [
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
      is_current: false,
      is_available: true,
      available: true,
    },
    ...PLAN_CATALOG.map((plan) => ({
      id: plan.plan_code,
      plan_code: plan.plan_code,
      name: plan.display_name,
      display_name: plan.display_name,
      program_type: plan.program_type,
      price_monthly: plan.price_thb,
      price_thb: plan.price_thb,
      currency: 'THB',
      billing_interval: plan.billing_interval,
      price_type: plan.price_type,
      features: plan.features,
      is_current: false,
      is_available: true,
      available: true,
    })),
  ]

  return c.json({ plans, ...founder, source: 'backend' })
})
