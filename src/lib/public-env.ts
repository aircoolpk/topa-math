const LOCAL_API_HOST_PATTERN = /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i

/**
 * Fallback API origin used when NEXT_PUBLIC_API_BASE_URL is not available.
 *
 * Why this exists:
 *  - On Cloudflare Workers (OpenNext) `process.env.NEXT_PUBLIC_*` values are
 *    not guaranteed to be inlined into the worker bundle, so the variable can
 *    be `undefined` at runtime.
 *  - `getApiBaseUrl()` used to `throw` in that case, which made
 *    `/share/{token}/opengraph-image` (and any other server-side caller of
 *    `buildApiUrl()`) fail with `ERR_INVALID_URL` / "Invalid URL" instead of
 *    degrading gracefully.
 *
 * The fallback is the public production API. It is only used when no explicit
 * base URL is configured; local development always sets the variable.
 */
const DEFAULT_API_BASE_URL = 'https://api.topamath.com'
const DEFAULT_APP_BASE_URL = 'https://topamath.com'

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '')
}

function publicAppEnv(): string {
  return (process.env.NEXT_PUBLIC_APP_ENV || 'local').toLowerCase()
}

function isDeployedAppEnv(): boolean {
  return ['production', 'prod', 'staging', 'beta'].includes(publicAppEnv())
}

/**
 * Resolve the API base URL without throwing.
 *
 * Returns the configured value when present, otherwise the production
 * fallback. Invalid/empty values never produce an invalid URL.
 */
export function getApiBaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL
  const normalized = value && value.trim() ? normalizeBaseUrl(value) : DEFAULT_API_BASE_URL

  // Never let a misconfigured localhost URL escape to a deployed environment.
  // Fall back instead of throwing, so server-rendered routes keep working.
  if (isDeployedAppEnv() && LOCAL_API_HOST_PATTERN.test(normalized)) {
    return DEFAULT_API_BASE_URL
  }

  return normalized
}

/**
 * Strict variant for code paths that genuinely require an explicit value
 * (e.g. client-side axios base URL during local development).
 */
export function getRequiredApiBaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL
  if (!value || !value.trim()) {
    throw new Error('NEXT_PUBLIC_API_BASE_URL is required. Set it to https://api.topamath.com for production.')
  }

  const normalized = normalizeBaseUrl(value)
  if (isDeployedAppEnv() && LOCAL_API_HOST_PATTERN.test(normalized)) {
    throw new Error('NEXT_PUBLIC_API_BASE_URL must not point to localhost/127.0.0.1 outside local development.')
  }

  return normalized
}

export function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? `/${path}` : path
  return `${getApiBaseUrl()}${normalizedPath}`
}

export function getAppBaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_BASE_URL
  return normalizeBaseUrl(value)
}
