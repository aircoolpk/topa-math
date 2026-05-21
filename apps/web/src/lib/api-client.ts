import axios from 'axios'

const appEnv = process.env.NEXT_PUBLIC_APP_ENV || 'local'
const isLocalEnv = ['local', 'dev', 'development', 'test'].includes(appEnv.toLowerCase())
const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || (isLocalEnv ? 'http://127.0.0.1:8001' : undefined)

if (!BASE_URL) {
  throw new Error('NEXT_PUBLIC_API_BASE_URL is required when NEXT_PUBLIC_APP_ENV is staging or production')
}

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
})

// Attach JWT token to every request
apiClient.interceptors.request.use((config) => {
  if (typeof window === 'undefined') return config
  const token = localStorage.getItem('access_token')
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
      localStorage.removeItem('access_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)
