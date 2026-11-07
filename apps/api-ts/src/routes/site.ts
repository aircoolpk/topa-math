/**
 * Public site content endpoints.
 *
 * `GET /site/homepage` serves the CMS payload the Next.js landing page
 * consumes (`src/app/page.tsx`).
 */
import { Hono } from 'hono'

import homepageConfig from '../content/homepage.json'
import type { AppEnv } from '../lib/http'

export const siteRoutes = new Hono<AppEnv>()

siteRoutes.get('/homepage', (c) => {
  // The FastAPI service stamps the payload with `published_at` and sends
  // `Cache-Control: no-store` so the CMS edits show up immediately.
  const payload = {
    ...homepageConfig,
    published_at: new Date().toISOString(),
  }
  c.header('Cache-Control', 'no-store, max-age=0')
  return c.json(payload)
})
