const REFERRAL_KEY = 'topa_referral_token'
const REFERRAL_EXPIRES_KEY = 'topa_referral_expires_at'

export function storeReferralToken(token: string, days = 30) {
  if (typeof window === 'undefined' || !token) return
  const expiresAt = Date.now() + days * 24 * 60 * 60 * 1000
  localStorage.setItem(REFERRAL_KEY, token)
  localStorage.setItem(REFERRAL_EXPIRES_KEY, String(expiresAt))
  document.cookie = `${REFERRAL_KEY}=${encodeURIComponent(token)}; max-age=${days * 24 * 60 * 60}; path=/; SameSite=Lax`
}

export function getStoredReferralToken() {
  if (typeof window === 'undefined') return null
  const expiresAt = Number(localStorage.getItem(REFERRAL_EXPIRES_KEY) || '0')
  const token = localStorage.getItem(REFERRAL_KEY)
  if (!token) return null
  if (expiresAt && expiresAt < Date.now()) {
    localStorage.removeItem(REFERRAL_KEY)
    localStorage.removeItem(REFERRAL_EXPIRES_KEY)
    return null
  }
  return token
}
