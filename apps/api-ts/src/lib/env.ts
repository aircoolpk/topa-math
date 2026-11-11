/**
 * Environment loading and validation.
 *
 * Cloudflare Workers exposes:
 *  - plain vars from `[vars]` in wrangler.toml (and overrides), and
 *  - secrets from `wrangler secret put` (same `c.env` surface).
 *
 * Both arrive as plain strings on `c.env`, so everything is validated here
 * exactly once per request and cached on the module-level singleton below.
 */
import { z } from 'zod'

/** Raw environment shape as delivered by the Workers runtime. */
export interface Bindings {
  /** Neon pooled Postgres connection string (secret). */
  DATABASE_URL?: string
  /** HS256 signing secret shared with the legacy FastAPI service (secret). */
  JWT_SECRET?: string
  ENVIRONMENT?: string
  CORS_ORIGINS?: string
  AUTH_COOKIE_NAME?: string
  AUTH_COOKIE_SECURE?: string
  AUTH_COOKIE_SAMESITE?: string
  AUTH_COOKIE_DOMAIN?: string
  AUTH_COOKIE_PATH?: string
  ACCESS_TOKEN_EXPIRE_MINUTES?: string
  /** Optional R2 bucket holding the site CMS content (see src/lib/content.ts). */
  CONTENT_BUCKET?: unknown
  /* ── Stripe (billing) ───────────────────────────────────────────────── */
  /** Stripe secret key. */
  STRIPE_SECRET_KEY?: string
  /** Stripe webhook signing secret (`whsec_…`). */
  STRIPE_WEBHOOK_SECRET?: string
  /** Stripe price id for the TH founder plan. */
  STRIPE_PRICE_TH_FOUNDER_MONTHLY?: string
  /** Stripe price id for the EP founder plan. */
  STRIPE_PRICE_EP_FOUNDER_MONTHLY?: string
  /** Stripe price id for the TH plus plan. */
  STRIPE_PRICE_TH_PLUS_MONTHLY?: string
  /** Stripe price id for the EP plus plan. */
  STRIPE_PRICE_EP_PLUS_MONTHLY?: string
  /** Stripe price id for the TH yearly plan. */
  STRIPE_PRICE_TH_PLUS_YEARLY?: string
  /** Stripe price id for the EP yearly plan. */
  STRIPE_PRICE_EP_PLUS_YEARLY?: string
  /** Where the Stripe customer portal returns the user. */
  STRIPE_CUSTOMER_PORTAL_RETURN_URL?: string
  /** Public URL of the Next.js frontend (used for the Stripe redirect URLs). */
  FRONTEND_BASE_URL?: string
  /** Which payment gateway is used for checkouts (`stripe` or `mpp`). */
  PAYMENT_GATEWAY_DEFAULT?: string
  /* ── MPP (one-off payments) ─────────────────────────────────────────── */
  /** Whether MPP checkout is enabled at all. */
  MPP_CHECKOUT_ENABLED?: string
  /** Comma-separated user ids allowed to use MPP checkout. */
  MPP_CHECKOUT_TEST_USER_IDS?: string
  /** MPP API base URL. */
  MPP_API_BASE_URL?: string
  /** MPP hosted payment page base URL. */
  MPP_PAYMENT_BASE_URL?: string
  /** MPP project API key (`X-API-Key`). */
  MPP_PROJECT_API_KEY?: string
  /** MPP webhook signing secret. */
  MPP_WEBHOOK_SIGNING_SECRET?: string
  /** Expected merchant display name in the MPP response. */
  MPP_EXPECTED_MERCHANT_NAME?: string
  /** Expected project name in the MPP response. */
  MPP_EXPECTED_PROJECT_NAME?: string
  /** Amount unit the MPP contract uses (`minor`). */
  MPP_AMOUNT_UNIT?: string
  /* ── Pricing / founder pool ─────────────────────────────────────────── */
  /** Whether the founder-price window is open. */
  FOUNDER_PRICING_ENABLED?: string
  /** Maximum number of founder slots. */
  FOUNDER_USER_LIMIT?: string
  /** Fallback maximum number of founder slots. */
  FOUNDER_PRICE_LIMIT?: string
  /* ── Referral / affiliate rewards ──────────────────────────────────── */
  /** Whether referral rewards are paid out. */
  REFERRAL_ENABLED?: string
  /** Coins awarded to the referrer on a paid subscription. */
  REFERRAL_PAID_COINS?: string
  /** Days a referral reward stays pending. */
  REFERRAL_REWARD_HOLD_DAYS?: string
  /** Affiliate commission in basis points. */
  AFFILIATE_COMMISSION_RATE_BPS?: string
  /** Days an affiliate commission stays pending. */
  AFFILIATE_COMMISSION_HOLD_DAYS?: string
  [key: string]: unknown
}

const booleanFromString = z
  .enum(['true', 'false', '1', '0', 'yes', 'no'])
  .transform((value) => value === 'true' || value === '1' || value === 'yes')

/** Validated, typed environment. */
export interface Env {
  ENVIRONMENT: string
  DATABASE_URL: string
  JWT_SECRET: string
  CORS_ORIGINS: string[]
  AUTH_COOKIE_NAME: string
  AUTH_COOKIE_SECURE: boolean
  AUTH_COOKIE_SAMESITE: 'lax' | 'strict' | 'none'
  AUTH_COOKIE_DOMAIN: string | undefined
  AUTH_COOKIE_PATH: string
  ACCESS_TOKEN_EXPIRE_MINUTES: number
}

const schema = z.object({
  ENVIRONMENT: z.string().default('local'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  CORS_ORIGINS: z.string().default('http://localhost:3000,http://127.0.0.1:3000'),
  AUTH_COOKIE_NAME: z.string().default('access_token'),
  AUTH_COOKIE_SECURE: booleanFromString.default(false),
  AUTH_COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  AUTH_COOKIE_DOMAIN: z.string().optional(),
  AUTH_COOKIE_PATH: z.string().default('/'),
  ACCESS_TOKEN_EXPIRE_MINUTES: z.coerce.number().int().positive().default(1440),
  // NOTE: there is deliberately no PASSWORD_HASH_ITERATIONS variable.
  //
  // Password hashing runs in Postgres (scripts/pbkdf2.sql) because the
  // Workers Free plan allows only 10 ms of CPU per request and a
  // 200,000-round PBKDF2 costs ~86 ms of CPU even through native WebCrypto
  // (measured in workerd). Database time is not charged against the
  // Worker's CPU budget.
  //
  // The iteration count is fixed at 200,000 in SQL, matching the legacy
  // FastAPI service, so hashes stay interchangeable between the two APIs.
})

/** Environment names that must never run with a weak/default secret. */
const DEPLOYED_ENVIRONMENTS = new Set(['staging', 'production', 'prod'])

/** Raised when the environment is missing or unsafe to run with. */
export class EnvError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EnvError'
  }
}

let cached: { key: string; value: Env } | null = null

/**
 * Parse and validate the runtime bindings.
 *
 * The result is memoised per `DATABASE_URL`/`JWT_SECRET` pair so a hot
 * isolate does not re-validate on every request.
 *
 * @param bindings the raw `c.env` object.
 */
export function getEnv(bindings: Bindings): Env {
  const key = `${String(bindings.DATABASE_URL ?? '')}|${String(bindings.JWT_SECRET ?? '')}`
  if (cached && cached.key === key) {
    return cached.value
  }

  const parsed = schema.safeParse({
    ENVIRONMENT: bindings.ENVIRONMENT,
    DATABASE_URL: bindings.DATABASE_URL,
    JWT_SECRET: bindings.JWT_SECRET,
    CORS_ORIGINS: bindings.CORS_ORIGINS,
    AUTH_COOKIE_NAME: bindings.AUTH_COOKIE_NAME,
    AUTH_COOKIE_SECURE: bindings.AUTH_COOKIE_SECURE,
    AUTH_COOKIE_SAMESITE: bindings.AUTH_COOKIE_SAMESITE,
    AUTH_COOKIE_DOMAIN: bindings.AUTH_COOKIE_DOMAIN,
    AUTH_COOKIE_PATH: bindings.AUTH_COOKIE_PATH,
    ACCESS_TOKEN_EXPIRE_MINUTES: bindings.ACCESS_TOKEN_EXPIRE_MINUTES,
  })

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ')
    throw new EnvError(`Invalid environment configuration — ${details}`)
  }

  const value = parsed.data
  const origins = value.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)

  if (DEPLOYED_ENVIRONMENTS.has(value.ENVIRONMENT.toLowerCase())) {
    const problems: string[] = []
    if (value.JWT_SECRET.length < 32) {
      problems.push('JWT_SECRET must be at least 32 characters')
    }
    if (value.JWT_SECRET === 'change-me-in-production' || value.JWT_SECRET === 'change-me') {
      problems.push('JWT_SECRET must not be the default value')
    }
    if (origins.length === 0) {
      problems.push('CORS_ORIGINS must list at least one origin')
    }
    if (origins.includes('*')) {
      problems.push('CORS_ORIGINS must not use a wildcard (credentials are sent)')
    }
    if (origins.some((origin) => origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1'))) {
      problems.push('CORS_ORIGINS must not contain localhost origins')
    }
    if (!value.AUTH_COOKIE_SECURE) {
      problems.push('AUTH_COOKIE_SECURE must be true')
    }
    if (value.AUTH_COOKIE_SAMESITE === 'none' && !value.AUTH_COOKIE_SECURE) {
      problems.push('AUTH_COOKIE_SECURE must be true when AUTH_COOKIE_SAMESITE is none')
    }
    if (!value.AUTH_COOKIE_PATH.startsWith('/')) {
      problems.push('AUTH_COOKIE_PATH must start with /')
    }
    if (problems.length > 0) {
      throw new EnvError(`Unsafe environment for ${value.ENVIRONMENT} — ${problems.join('; ')}`)
    }
  }

  const env: Env = {
    ENVIRONMENT: value.ENVIRONMENT,
    DATABASE_URL: value.DATABASE_URL,
    JWT_SECRET: value.JWT_SECRET,
    CORS_ORIGINS: origins,
    AUTH_COOKIE_NAME: value.AUTH_COOKIE_NAME,
    AUTH_COOKIE_SECURE: value.AUTH_COOKIE_SECURE,
    AUTH_COOKIE_SAMESITE: value.AUTH_COOKIE_SAMESITE,
    AUTH_COOKIE_DOMAIN: value.AUTH_COOKIE_DOMAIN,
    AUTH_COOKIE_PATH: value.AUTH_COOKIE_PATH,
    ACCESS_TOKEN_EXPIRE_MINUTES: value.ACCESS_TOKEN_EXPIRE_MINUTES,
  }

  cached = { key, value: env }
  return env
}
