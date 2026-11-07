import axios from 'axios'
import { getApiBaseUrl } from './public-env'

declare module 'axios' {
  export interface AxiosRequestConfig {
    skipAuthRedirect?: boolean
    requestLabel?: string
  }
}

const BASE_URL = getApiBaseUrl()

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
  timeout: 15000,
})

function readStoredToken(): string | null {
  try {
    return window.localStorage.getItem('access_token')
  } catch {
    return null
  }
}

function removeStoredToken(): void {
  try {
    window.localStorage.removeItem('access_token')
  } catch {
    // Cookie auth remains available when Safari/private mode blocks storage.
  }
}

// Attach JWT token to every request
apiClient.interceptors.request.use((config) => {
  if (typeof window === 'undefined') return config
  const token = readStoredToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 by redirecting to login
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      if (error.config?.skipAuthRedirect) {
        return Promise.reject(error)
      }
      removeStoredToken()
      window.dispatchEvent(new CustomEvent('topa-auth-unauthorized', {
        detail: {
          url: error.config?.url,
          requestLabel: error.config?.requestLabel,
          status: 401,
        },
      }))
      if (!window.location.pathname.startsWith('/login')) {
        const next = `${window.location.pathname}${window.location.search}`
        window.location.href = `/login?next=${encodeURIComponent(next)}`
      }
    }
    return Promise.reject(error)
  }
)
