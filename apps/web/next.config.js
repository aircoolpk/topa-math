/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  async rewrites() {
    const origin = process.env.INTERNAL_API_BASE_URL || 'http://4craft-api:8001'
    const parsed = new URL(origin)
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
      throw new Error('INTERNAL_API_BASE_URL must be an origin without credentials')
    }
    return {
      beforeFiles: [
        { source: '/:path*', has: [{ type: 'host', value: 'api.topamath.com' }], destination: `${parsed.origin}/:path*` },
        ...['/auth/:path*', '/quiz-sessions/:path*', '/subjects', '/skills', '/rankings', '/avatar/:path*', '/health'].map(source => ({ source, destination: `${parsed.origin}${source}` })),
      ],
      afterFiles: [],
      fallback: [],
    }
  },
}

module.exports = nextConfig
