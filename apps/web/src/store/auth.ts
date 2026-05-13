'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi, type AuthUser } from '@/lib/auth'

interface AuthState {
  token: string | null
  user: AuthUser | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<AuthUser>
  register: (email: string, password: string) => Promise<void>
  logout: () => void
  checkAuth: () => Promise<void>
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
          localStorage.setItem('access_token', data.access_token)
          const user = await authApi.me()
          set({ token: data.access_token, user, isLoading: false })
          return user
        } catch (err) {
          set({ isLoading: false })
          throw err
        }
      },

      register: async (email, password) => {
        set({ isLoading: true })
        try {
          const data = await authApi.register(email, password)
          localStorage.setItem('access_token', data.access_token)
          const user = await authApi.me()
          set({ token: data.access_token, user, isLoading: false })
        } catch (err) {
          set({ isLoading: false })
          throw err
        }
      },

      logout: () => {
        localStorage.removeItem('access_token')
        set({ token: null, user: null })
      },

      checkAuth: async () => {
        const token = localStorage.getItem('access_token')
        if (!token) return
        try {
          const user = await authApi.me()
          set({ token, user })
        } catch (err) {
          // Network / server errors: keep the stored token — backend may be temporarily unavailable
          // Only remove token on explicit HTTP 401 (invalid/expired credential)
          const status = err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { status?: number } }).response?.status
            : null
          if (status === 401) {
            localStorage.removeItem('access_token')
            set({ token: null, user: null })
          }
          // For network errors / backend down, leave token intact so user can still use the app
        }
      },
    }),
    {
      name: '4craft-auth',
      partialize: (state) => ({ token: state.token }),
    }
  )
)
