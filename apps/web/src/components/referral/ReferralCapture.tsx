'use client'

import { useEffect } from 'react'
import { apiClient } from '@/lib/api-client'
import { storeReferralToken } from '@/lib/referral'

export function ReferralCapture({ token, shareToken }: { token?: string | null; shareToken?: string | null }) {
  useEffect(() => {
    if (!token) return
    storeReferralToken(token)
    apiClient.post('/referrals/click', { referral_token: token, share_token: shareToken || undefined }).catch(() => {
      // Referral tracking must never block a public page or registration.
    })
  }, [token, shareToken])

  return null
}
