'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi, type AuthUser } from '@/lib/auth'

interface AuthState {
  token: string | null
  user: AuthUser | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<AuthUser>
  register: (email: string, password: string, referralToken?: string | null) => Promise<void>
  logout: () => void
  checkAuth: () => Promise<AuthUser | null>
}

function readStoredToken(): string | null {
  try {
    return localStorage.getItem('access_token')
  } catch {
    return null
  }
}

function writeStoredToken(token: string): void {
  try {
    localStorage.setItem('access_token', token)
  } catch {
    // HttpOnly cookie is the primary mobile-safe session.
  }
}

function removeStoredToken(): void {
  try {
    localStorage.removeItem('access_token')
  } catch {
    // Storage can be unavailable in Safari private mode.
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isLoading: false,

      login: async (email, password) => {
        set({ isLoading: true })
        try {
          const data = await authApi.login(email, password)
          writeStoredToken(data.access_token)
          const user = await authApi.me()
          set({ token: data.access_token, user, isLoading: false })
          return user
        } catch (err) {
          set({ isLoading: false })
          throw err
        }
      },

      register: async (email, password, referralToken) => {
        set({ isLoading: true })
        try {
          const data = await authApi.register(email, password, referralToken)
          writeStoredToken(data.access_token)
          const user = await authApi.me()
          set({ token: data.access_token, user, isLoading: false })
        } catch (err) {
          set({ isLoading: false })
          throw err
        }
      },

      logout: () => {
        removeStoredToken()
        void authApi.logout().catch(() => undefined)
        set({ token: null, user: null })
      },

      checkAuth: async () => {
        const token = readStoredToken()
        try {
          const user = await authApi.me()
          set({ token, user })
          return user
        } catch (err) {
          // Network / server errors: keep the stored token — backend may be temporarily unavailable
          // Only remove token on explicit HTTP 401 (invalid/expired credential)
          const status = err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { status?: number } }).response?.status
            : null
          if (status === 401) {
            removeStoredToken()
            set({ token: null, user: null })
          }
          // For network errors / backend down, leave token intact so user can still use the app
          return null
        }
      },
    }),
    {
      name: '4craft-auth',
      partialize: (state) => ({ token: state.token }),
    }
  )
)
