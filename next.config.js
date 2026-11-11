/**
 * @type {import('next').NextConfig}
 *
 * The public values are inlined into the bundle at build time. A build that
 * runs on a machine without them — Cloudflare Workers Builds, for example,
 * where `.env.production` is not present because it is git-ignored — would
 * otherwise abort with "NEXT_PUBLIC_API_BASE_URL is required". These defaults
 * describe the deployed site, and any environment variable still wins, so a
 * local `.env.local` can point the app somewhere else.
 */
const DEFAULT_PUBLIC_ENV = {
  NEXT_PUBLIC_API_BASE_URL: 'https://api.topamath.com',
  NEXT_PUBLIC_APP_URL: 'https://topamath.com',
  NEXT_PUBLIC_APP_ENV: 'production',
}

const nextConfig = {
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_PUBLIC_ENV.NEXT_PUBLIC_API_BASE_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || DEFAULT_PUBLIC_ENV.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV || DEFAULT_PUBLIC_ENV.NEXT_PUBLIC_APP_ENV,
  },
  // NOTE: `output: 'standalone'` is REQUIRED by OpenNext/Cloudflare Workers.
  //
  // OpenNext's `createAssets` step reads the HTML pages from
  // `.next/standalone/.next/server/pages-manifest.json`, so the Next.js build
  // must emit the standalone server bundle. The Docker image build sets
  // NEXT_OUTPUT=standalone explicitly as well.
  output: 'standalone',
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  // ---------------------------------------------------------------------------
  // @vercel/og fallback font — required for Cloudflare Workers (OpenNext).
  //
  // Next's file tracer (nft) cannot follow the font reference inside
  // `next/dist/compiled/@vercel/og/index.edge.js` because it is loaded with
  // `fetch(new URL('./noto-sans-v27-latin-regular.ttf', import.meta.url))`
  // rather than a static `require`. As a result the .ttf (and the two .wasm
  // binaries) never land in the route's `.nft.json` trace, so OpenNext's
  // `copyTracedFiles` step never copies them into `.open-next/` and the
  // `patchVercelOgLibrary` step fails with:
  //
  //   ENOENT: ... rename '.../@vercel/og/noto-sans-v27-latin-regular.ttf'
  //             -> '.../@vercel/og/noto-sans-v27-latin-regular.ttf.bin'
  //
  // Forcing these three files into the trace makes OpenNext copy them into the
  // worker bundle, where wrangler's bundler picks them up via the
  // `\.bin|\.wasm(\?module)?$` external rule.
  //
  // See: node_modules/@opennextjs/cloudflare/dist/cli/build/patches/plugins/
  //      wrangler-external.js
  // ---------------------------------------------------------------------------
  experimental: {
    outputFileTracingIncludes: {
      '**/share/**': [
        './node_modules/next/dist/compiled/@vercel/og/noto-sans-v27-latin-regular.ttf',
        './node_modules/next/dist/compiled/@vercel/og/resvg.wasm',
        './node_modules/next/dist/compiled/@vercel/og/yoga.wasm',
      ],
    },
  },
  async rewrites() {
    // On Cloudflare Workers the FastAPI backend is reached over the public
    // Cloudflare Tunnel hostname, not over a Docker network alias.
    // Locally (`wrangler dev`) the tunnel hostname is also the right target
    // because the tunnel maps api.topamath.com -> 4craft-api:8001.
    const origin = process.env.INTERNAL_API_BASE_URL || 'https://api.topamath.com'
    const parsed = new URL(origin)
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
      throw new Error('INTERNAL_API_BASE_URL must be an origin without credentials')
    }
    return {
      beforeFiles: [
        { source: '/:path*', has: [{ type: 'host', value: 'api.topamath.com' }], destination: `${parsed.origin}/:path*` },
      ],
      // Every API prefix the Next.js app calls must be proxied to the
      // FastAPI backend. Without this the Worker answers those paths with
      // the Next.js 404 page instead of JSON, and the client silently falls
      // back to its built-in placeholder data.
      //
      // The rewrites run after the filesystem, because several prefixes are
      // also the names of pages of this app: the admin section has both an
      // /admin page and an /admin/announcements page, and the backend serves
      // the same paths. Running the rewrite before the filesystem sent the
      // page request to the backend, which answered with a JSON 404.
      //
      // Keep this list in sync with the paths under src/lib/api/*.ts and the
      // apiClient calls in src/app/**.
      afterFiles: [
        ...[
          '/admin/:path*',
          '/auth/:path*',
          '/avatar/:path*',
          '/billing/:path*',
          '/children/:path*',
          '/health/:path*',
          '/me/:path*',
          '/quiz-sessions/:path*',
          '/rankings/:path*',
          '/referrals/:path*',
          '/site/:path*',
          '/skills/:path*',
          '/subjects/:path*',
          '/webhooks/:path*',
        ].map(source => ({ source, destination: `${parsed.origin}${source}` })),
      ],
      fallback: [],
    }
  },
}

module.exports = nextConfig
