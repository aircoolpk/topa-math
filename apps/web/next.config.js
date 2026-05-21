/** @type {import('next').NextConfig} */
const appEnv = process.env.NEXT_PUBLIC_APP_ENV || 'local'
const isLocalEnv = ['local', 'dev', 'development', 'test'].includes(appEnv.toLowerCase())
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || (isLocalEnv ? 'http://127.0.0.1:8001' : undefined)
const internalApiBaseUrl = process.env.INTERNAL_API_BASE_URL || apiBaseUrl

if (!apiBaseUrl) {
  throw new Error('NEXT_PUBLIC_API_BASE_URL is required when NEXT_PUBLIC_APP_ENV is staging or production')
}

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/:path*', has: [{ type: 'host', value: 'api.topamath.com' }], destination: `${internalApiBaseUrl}/:path*` },
        { source: '/auth/:path*', destination: `${internalApiBaseUrl}/auth/:path*` },
        { source: '/children/:path*', destination: `${internalApiBaseUrl}/children/:path*` },
        { source: '/quiz-sessions/:path*', destination: `${internalApiBaseUrl}/quiz-sessions/:path*` },
        { source: '/subjects', destination: `${internalApiBaseUrl}/subjects` },
        { source: '/skills', destination: `${internalApiBaseUrl}/skills` },
        { source: '/rankings', destination: `${internalApiBaseUrl}/rankings` },
        { source: '/avatar/:path*', destination: `${internalApiBaseUrl}/avatar/:path*` },
        { source: '/health', destination: `${internalApiBaseUrl}/health` },
      ],
    }
  },
}

module.exports = nextConfig
