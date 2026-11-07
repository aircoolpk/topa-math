const LOCAL_API_HOST_PATTERN = /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '')
}

function publicAppEnv(): string {
  return (process.env.NEXT_PUBLIC_APP_ENV || 'local').toLowerCase()
}

function isDeployedAppEnv(): boolean {
  return ['production', 'prod', 'staging', 'beta'].includes(publicAppEnv())
}

export function getApiBaseUrl(): string {
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
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${getApiBaseUrl()}${normalizedPath}`
}

export function getAppBaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_APP_URL || 'https://topamath.com'
  return normalizeBaseUrl(value)
}
