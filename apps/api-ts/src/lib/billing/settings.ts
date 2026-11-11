/**
 * Billing / payment configuration read from the Worker bindings.
 *
 * The FastAPI service reads the same values through `pydantic-settings`
 * (`apps/api/app/core/config.py`), so the variable names and the defaults
 * below mirror that class one-for-one. Reading them from the raw bindings
 * (`c.env`) instead of the validated `Env` object keeps the values out of
 * the memoised environment — two deployments that share a database but not
 * their Stripe configuration must not see each other's secrets.
 */
import type { Bindings } from '../env'

/** A configuration value that may be absent. */
type Maybe = string | null

/**
 * Read a binding as a trimmed string.
 *
 * @param env the raw bindings.
 * @param key the variable name (checked in upper- and lower-case).
 */
function str(env: Bindings, key: string): Maybe {
  const value = env[key] ?? env[key.toLowerCase()]
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Read a binding as a boolean.
 *
 * Mirrors pydantic's boolean parsing: `1/true/yes/on` are true, `0/false/no/off` are false.
 *
 * @param env the raw bindings.
 * @param key the variable name.
 * @param fallback the value used when the variable is absent.
 */
function bool(env: Bindings, key: string, fallback: boolean): boolean {
  const value = str(env, key)
  if (value === null) {
    return fallback
  }
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

/**
 * Read a binding as an integer.
 *
 * @param env the raw bindings.
 * @param key the variable name.
 * @param fallback the value used when the variable is absent or not a number.
 */
function int(env: Bindings, key: string, fallback: number): number {
  const value = str(env, key)
  if (value === null) {
    return fallback
  }
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

/** Everything the billing endpoints need to know about the environment. */
export interface BillingSettings {
  /* Stripe */
  stripeSecretKey: Maybe
  stripeWebhookSecret: Maybe
  stripePriceThFounderMonthly: Maybe
  stripePriceEpFounderMonthly: Maybe
  stripePriceThPlusMonthly: Maybe
  stripePriceEpPlusMonthly: Maybe
  stripePriceThPlusYearly: Maybe
  stripePriceEpPlusYearly: Maybe
  stripeCustomerPortalReturnUrl: Maybe
  frontendBaseUrl: string
  /** Which gateway handles checkouts. */
  paymentGatewayDefault: string
  /* MPP */
  mppCheckoutEnabled: boolean
  mppCheckoutTestUserIds: string
  mppApiBaseUrl: string
  mppPaymentBaseUrl: string
  mppProjectApiKey: Maybe
  mppWebhookSigningSecret: Maybe
  mppExpectedMerchantName: Maybe
  mppExpectedProjectName: Maybe
  mppAmountUnit: Maybe
  /* Founder pool */
  founderPricingEnabled: boolean
  founderUserLimit: number | null
  founderPriceLimit: number
  /* Referral / affiliate rewards */
  referralEnabled: boolean
  referralPaidCoins: number
  referralRewardHoldDays: number
  affiliateCommissionRateBps: number
  affiliateCommissionHoldDays: number
  /** The deployment environment (`local`, `staging`, `production`, …). */
  environment: string
}

/** The MPP staging hosts the checkout contract is verified against. */
export const MPP_STAGING_API_BASE_URL = 'https://staging-api.mmerchant.cc/api/v1'
/** The MPP hosted-payment host. */
export const MPP_STAGING_PAYMENT_BASE_URL = 'https://staging-pay.mmerchant.cc'

/**
 * Build the billing configuration from the raw bindings.
 *
 * @param env the raw bindings.
 */
export function getBillingSettings(env: Bindings): BillingSettings {
  const founderUserLimit = int(env, 'FOUNDER_USER_LIMIT', 0) || null
  return {
    stripeSecretKey: str(env, 'STRIPE_SECRET_KEY'),
    stripeWebhookSecret: str(env, 'STRIPE_WEBHOOK_SECRET'),
    stripePriceThFounderMonthly: str(env, 'STRIPE_PRICE_TH_FOUNDER_MONTHLY'),
    stripePriceEpFounderMonthly: str(env, 'STRIPE_PRICE_EP_FOUNDER_MONTHLY'),
    stripePriceThPlusMonthly: str(env, 'STRIPE_PRICE_TH_PLUS_MONTHLY'),
    stripePriceEpPlusMonthly: str(env, 'STRIPE_PRICE_EP_PLUS_MONTHLY'),
    stripePriceThPlusYearly: str(env, 'STRIPE_PRICE_TH_PLUS_YEARLY'),
    stripePriceEpPlusYearly: str(env, 'STRIPE_PRICE_EP_PLUS_YEARLY'),
    stripeCustomerPortalReturnUrl: str(env, 'STRIPE_CUSTOMER_PORTAL_RETURN_URL'),
    frontendBaseUrl: str(env, 'FRONTEND_BASE_URL') ?? 'http://127.0.0.1:3000',
    paymentGatewayDefault: (str(env, 'PAYMENT_GATEWAY_DEFAULT') ?? 'stripe').toLowerCase(),
    mppCheckoutEnabled: bool(env, 'MPP_CHECKOUT_ENABLED', false),
    mppCheckoutTestUserIds: str(env, 'MPP_CHECKOUT_TEST_USER_IDS') ?? '',
    mppApiBaseUrl: str(env, 'MPP_API_BASE_URL') ?? MPP_STAGING_API_BASE_URL,
    mppPaymentBaseUrl: str(env, 'MPP_PAYMENT_BASE_URL') ?? MPP_STAGING_PAYMENT_BASE_URL,
    mppProjectApiKey: str(env, 'MPP_PROJECT_API_KEY'),
    mppWebhookSigningSecret: str(env, 'MPP_WEBHOOK_SIGNING_SECRET'),
    mppExpectedMerchantName: str(env, 'MPP_EXPECTED_MERCHANT_NAME'),
    mppExpectedProjectName: str(env, 'MPP_EXPECTED_PROJECT_NAME'),
    mppAmountUnit: str(env, 'MPP_AMOUNT_UNIT'),
    founderPricingEnabled: bool(env, 'FOUNDER_PRICING_ENABLED', false),
    founderUserLimit,
    founderPriceLimit: int(env, 'FOUNDER_PRICE_LIMIT', 100),
    referralEnabled: bool(env, 'REFERRAL_ENABLED', true),
    referralPaidCoins: int(env, 'REFERRAL_PAID_COINS', 100),
    referralRewardHoldDays: int(env, 'REFERRAL_REWARD_HOLD_DAYS', 7),
    affiliateCommissionRateBps: int(env, 'AFFILIATE_COMMISSION_RATE_BPS', 300),
    affiliateCommissionHoldDays: int(env, 'AFFILIATE_COMMISSION_HOLD_DAYS', 7),
    environment: (str(env, 'ENVIRONMENT') ?? 'local').toLowerCase(),
  }
}

/**
 * The founder slot limit.
 *
 * Mirrors `billing._founder_limit()`: the user limit wins, then the price
 * limit, then the built-in default of 100.
 *
 * @param settings the billing configuration.
 */
export function founderLimit(settings: BillingSettings): number {
  return Math.max(0, settings.founderUserLimit || settings.founderPriceLimit || 100)
}

/**
 * The gateway that handles checkouts.
 *
 * Mirrors `checkout_policy.default_gateway()`.
 *
 * @param settings the billing configuration.
 */
export function defaultGateway(settings: BillingSettings): 'stripe' | 'mpp' {
  const gateway = settings.paymentGatewayDefault
  return gateway === 'stripe' || gateway === 'mpp' ? gateway : 'stripe'
}

/**
 * Whether the deployment is a production-like environment.
 *
 * @param settings the billing configuration.
 */
export function isProductionEnvironment(settings: BillingSettings): boolean {
  return settings.environment === 'production' || settings.environment === 'prod'
}
