'use client'

import { SignJWT, jwtVerify } from 'jose'
import { apiClient } from './api-client'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string
  email: string
  role: string
}

export interface TokenPayload {
  sub: string
  role: string
  exp?: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSecretKey() {
  // In browser, use a static key for demo — replace with proper key management in production
  return new TextEncoder().encode(process.env.NEXT_PUBLIC_JWT_SECRET || '4-craft-secret-key-change-in-production')
}

export async function decodeToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey())
    return {
      sub: payload.sub as string,
      role: (payload as Record<string, unknown>).role as string || 'parent',
      exp: payload.exp,
    }
  } catch {
    return null
  }
}

export async function getTokenPayload(token: string): Promise<TokenPayload | null> {
  return decodeToken(token)
}

// ─── Auth API ─────────────────────────────────────────────────────────────────

export const authApi = {
  async register(email: string, password: string) {
    const res = await apiClient.post('/auth/register', { email, password })
    return res.data as { access_token: string; token_type: string }
  },

  async login(email: string, password: string) {
    const res = await apiClient.post('/auth/login', { email, password })
    return res.data as { access_token: string; token_type: string }
  },

  async me() {
    const res = await apiClient.get('/auth/me')
    return res.data as AuthUser
  },
}
