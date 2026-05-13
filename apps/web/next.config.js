/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Frontend serves at http://127.0.0.1:3000
  // Proxy API calls to FastAPI backend at http://127.0.0.1:8001
  async rewrites() {
    return {
      beforeFiles: [
        // API routes only — frontend pages (/, /login, /register, etc.) are NOT proxied
        { source: '/auth/:path*', destination: 'http://127.0.0.1:8001/auth/:path*' },
        { source: '/children/:path*', destination: 'http://127.0.0.1:8001/children/:path*' },
        { source: '/quiz-sessions/:path*', destination: 'http://127.0.0.1:8001/quiz-sessions/:path*' },
        { source: '/subjects', destination: 'http://127.0.0.1:8001/subjects' },
        { source: '/skills', destination: 'http://127.0.0.1:8001/skills' },
        { source: '/rankings', destination: 'http://127.0.0.1:8001/rankings' },
        { source: '/avatar/:path*', destination: 'http://127.0.0.1:8001/avatar/:path*' },
        { source: '/health', destination: 'http://127.0.0.1:8001/health' },
      ],
    }
  },
}

module.exports = nextConfig
