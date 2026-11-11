/**
 * The billing plan catalogue and the founder-slot counters.
 *
 * Ported from `PLAN_CATALOG` and `_founder_slots()` in
 * `apps/api/app/routers/billing.py`. The catalogue is static configuration;
 * only the founder counters come from the database.
 */
import type { Sql } from '../db'
import { founderLimit, type BillingSettings } from './settings'

/** The settings key holding the Stripe price id of a plan. */
export type PriceEnvKey =
  | 'stripePriceThFounderMonthly'
  | 'stripePriceEpFounderMonthly'
  | 'stripePriceThPlusMonthly'
  | 'stripePriceEpPlusMonthly'
  | 'stripePriceThPlusYearly'
  | 'stripePriceEpPlusYearly'

/** A purchasable plan. */
export interface BillingPlan {
  /** The plan code used by the checkout endpoints. */
  plan_code: string
  /** The settings key holding the Stripe price id. */
  price_env: PriceEnvKey
  /** The Stripe product id. */
  product_id: string
  /** The name shown to the customer. */
  display_name: string
  /** `TH` or `EP`. */
  program_type: string
  /** `month`, `year` or `none`. */
  billing_interval: string
  /** `founder`, `normal` or `yearly_promo`. */
  price_type: string
  /** The price in Thai Baht. */
  amount_thb: number
  /** The benefits shown on the pricing page. */
  features: string[]
}

/** Feature list for the Thai Program plans. */
export const TH_PLAN_FEATURES = [
  'ปลดล็อกบทเรียนคณิต ป.1-ป.6 ทั้งหมด',
  'แบบทดสอบทุกระดับชั้น ไม่จำกัด',
  'ระบบ AI วิเคราะห์จุดอ่อน',
  'แบบฝึกเฉพาะบุคคล',
  'Quest รายวัน / รายสัปดาห์ / รายเดือน',
  'XP / Level / Rank ทั่วประเทศ',
  'Avatar และของตกแต่งพื้นฐาน',
]

/** Feature list for the English Program plans. */
export const EP_PLAN_FEATURES = [
  'ทุกอย่างในแพ็กเกจ TH',
  'โหมด English Program (EP)',
  'โจทย์และบทเรียนคณิตเป็นภาษาอังกฤษ',
  'คำศัพท์คณิตศาสตร์ภาษาอังกฤษ',
  'เหมาะกับเด็ก EP / Inter / สองภาษา',
  'ปลดล็อกทั้ง TH และ EP ในบัญชีเดียว',
]

/**
 * The plan catalogue.
 *
 * The order matters: `/billing/prices` returns the plans in this order, and
 * `/billing/plans` returns the two founder plans in this order.
 */
export const PLAN_CATALOG: BillingPlan[] = [
  {
    plan_code: 'th_founder_monthly',
    price_env: 'stripePriceThFounderMonthly',
    product_id: 'prod_USgNoW3SqfYosf',
    display_name: 'Plus TH Founder',
    program_type: 'TH',
    billing_interval: 'month',
    price_type: 'founder',
    amount_thb: 199,
    features: TH_PLAN_FEATURES,
  },
  {
    plan_code: 'ep_founder_monthly',
    price_env: 'stripePriceEpFounderMonthly',
    product_id: 'prod_USgTRV2ZTxagVu',
    display_name: 'Plus EP Founder',
    program_type: 'EP',
    billing_interval: 'month',
    price_type: 'founder',
    amount_thb: 399,
    features: EP_PLAN_FEATURES,
  },
  {
    plan_code: 'th_plus_monthly',
    price_env: 'stripePriceThPlusMonthly',
    product_id: 'prod_USg9dDnZ1L1Wye',
    display_name: 'Plus TH',
    program_type: 'TH',
    billing_interval: 'month',
    price_type: 'normal',
    amount_thb: 299,
    features: TH_PLAN_FEATURES,
  },
  {
    plan_code: 'ep_plus_monthly',
    price_env: 'stripePriceEpPlusMonthly',
    product_id: 'prod_USgHn9EzVjHbsW',
    display_name: 'Plus EP',
    program_type: 'EP',
    billing_interval: 'month',
    price_type: 'normal',
    amount_thb: 599,
    features: EP_PLAN_FEATURES,
  },
  {
    plan_code: 'th_plus_yearly_promo',
    price_env: 'stripePriceThPlusYearly',
    product_id: 'prod_USga7vRK8g1M0d',
    display_name: 'Plus TH Year Promotion',
    program_type: 'TH',
    billing_interval: 'year',
    price_type: 'yearly_promo',
    amount_thb: 2990,
    features: TH_PLAN_FEATURES,
  },
  {
    plan_code: 'ep_plus_yearly_promo',
    price_env: 'stripePriceEpPlusYearly',
    product_id: 'prod_USgai3JWRR6tQ2',
    display_name: 'Plus EP Year Promotion',
    program_type: 'EP',
    billing_interval: 'year',
    price_type: 'yearly_promo',
    amount_thb: 5990,
    features: EP_PLAN_FEATURES,
  },
]

/** The plan codes that use the founder price. */
export const FOUNDER_PLAN_CODES = new Set(['th_founder_monthly', 'ep_founder_monthly'])

/**
 * Whether a plan uses the founder price.
 *
 * @param planCode the plan code (or a plan).
 */
export function isFounderPlan(planCode: string | null | undefined): boolean {
  return FOUNDER_PLAN_CODES.has(String(planCode ?? ''))
}

/**
 * The entitlement a plan grants on the child profile.
 *
 * @param plan the plan.
 */
export function entitlementPlanCode(plan: BillingPlan): string {
  return plan.program_type === 'EP' ? 'ep_plus' : 'th_plus'
}

/**
 * Find a plan by its code.
 *
 * @param planCode the plan code.
 */
export function findPlan(planCode: string | null | undefined): BillingPlan | undefined {
  return PLAN_CATALOG.find((plan) => plan.plan_code === planCode)
}

/**
 * Find the plan a Stripe price id belongs to.
 *
 * @param priceId the Stripe price id.
 * @param settings the billing configuration.
 */
export function planFromPriceId(
  priceId: string | null | undefined,
  settings: BillingSettings,
): BillingPlan | undefined {
  if (!priceId) {
    return undefined
  }
  return PLAN_CATALOG.find((plan) => settings[plan.price_env] === priceId)
}

/**
 * The Stripe price id configured for a plan.
 *
 * @param plan the plan.
 * @param settings the billing configuration.
 */
export function priceIdForPlan(
  plan: BillingPlan,
  settings: BillingSettings,
): string | null {
  return settings[plan.price_env] ?? null
}

/** The founder slot counters. */
export interface FounderSlots {
  founder_limit: number
  founder_used: number
  founder_slots_remaining: number
  founder_shared_pool: boolean
}

/**
 * Count the founder slots in use.
 *
 * A slot is used by a child profile that is on a founder price and either
 * has an active Stripe subscription or an active MPP membership. Pending
 * MPP founder orders hold a slot as well.
 *
 * @param sql the database handle.
 * @param settings the billing configuration.
 */
export async function founderSlots(
  sql: Sql,
  settings: BillingSettings,
): Promise<FounderSlots> {
  const limit = founderLimit(settings)

  const usedRows = (await sql.query(
    `SELECT count(*)::int AS used
     FROM child_profiles
     WHERE active_price_code IN ('th_founder_monthly', 'ep_founder_monthly')
       AND membership_status IN ('paid', 'plus')
       AND (
         ((membership_provider IS NULL OR membership_provider <> 'mpp')
            AND subscription_status IN ('active', 'trialing', 'paid'))
         OR (membership_provider = 'mpp' AND mpp_access_ends_at > now())
       )`,
  )) as Array<{ used: number }>
  const used = Number(usedRows[0]?.used ?? 0)

  // The MPP tables are optional: they only exist once the MPP migration has
  // been applied. A missing table must not take the pricing page down, so
  // the reserved count falls back to zero.
  let reserved = 0
  try {
    const reservedRows = (await sql.query(
      `SELECT count(*)::int AS reserved
       FROM mpp_purchase_orders
       WHERE plan_code IN ('th_founder_monthly', 'ep_founder_monthly')
         AND status = 'PENDING'`,
    )) as Array<{ reserved: number }>
    reserved = Number(reservedRows[0]?.reserved ?? 0)
  } catch {
    reserved = 0
  }

  return {
    founder_limit: limit,
    founder_used: used,
    founder_slots_remaining: Math.max(0, limit - used - reserved),
    founder_shared_pool: true,
  }
}

/**
 * Whether the pricing page shows only the founder plans.
 *
 * Mirrors `founder_only = founder_pricing_enabled and slots_remaining > 0`.
 *
 * @param settings the billing configuration.
 * @param slots the founder slot counters.
 */
export function founderOnly(settings: BillingSettings, slots: FounderSlots): boolean {
  return settings.founderPricingEnabled && slots.founder_slots_remaining > 0
}
