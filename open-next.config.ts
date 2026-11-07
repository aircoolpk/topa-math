import { defineCloudflareConfig } from '@opennextjs/cloudflare'

/**
 * OpenNext → Cloudflare Workers configuration for Topa Math.
 *
 * The frontend is a Next.js 14 App Router app. The FastAPI backend stays on its
 * own host and is reached through `INTERNAL_API_BASE_URL` (see next.config.js
 * rewrites) — OpenNext handles those rewrites as Worker routes.
 *
 * `nodejs_compat` is required: Next 14 pulls in node built-ins (crypto, buffer,
 * stream) that the Workers runtime only exposes behind that compatibility flag.
 *
 * The runtime compatibility date and flags live in wrangler.toml — that is the
 * file Cloudflare Workers Builds reads when it deploys this project.
 */
export default defineCloudflareConfig({
  // `wrapper: 'cloudflare-node'` is already the adapter default (see
  // node_modules/@opennextjs/cloudflare/dist/api/config.js) — Next 14's node
  // built-ins (crypto, buffer, stream) run under the Workers `nodejs_compat`
  // flag declared in wrangler.toml.
  enableCacheInterception: false,
})
