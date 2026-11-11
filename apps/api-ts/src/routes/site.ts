/**
 * Public site content endpoints.
 *
 * `GET /site/homepage` serves the CMS payload the Next.js landing page
 * consumes (`src/app/page.tsx`).
 */
import { Hono } from 'hono'

import homepageConfig from '../content/homepage.json'
import type { Sql } from '../lib/db'
import type { AppEnv } from '../lib/http'

export const siteRoutes = new Hono<AppEnv>()

/** The number of announcements the public homepage shows. */
const PUBLIC_ANNOUNCEMENT_LIMIT = 20

/** Title of the news card, used when the config does not carry one. */
const DEFAULT_ANNOUNCEMENTS_TITLE = 'สาวสาร & ฝากประกาศ'
const DEFAULT_ANNOUNCEMENTS_SUBTITLE = 'ข่าวสารและประกาศล่าสุดจากทีมงาน TOPA Math'

interface AnnouncementRow {
  id: string
  title: string
  body: string
  link_url: string | null
  published_at: string | null
}

/**
 * The published announcements, newest first.
 *
 * The legacy service reads them from the database and merges them under
 * the homepage payload, so the news card on the landing page is never a
 * stale copy of the file.
 */
async function publicAnnouncements(sql: Sql): Promise<AnnouncementRow[]> {
  try {
    const rows = (await sql.query(
      `SELECT id, title, body, link_url, published_at
         FROM site_announcements
        WHERE published = true
        ORDER BY sort_order ASC, published_at DESC NULLS LAST, created_at DESC, id ASC
        LIMIT $1`,
      [PUBLIC_ANNOUNCEMENT_LIMIT],
    )) as AnnouncementRow[]
    return rows
  } catch {
    // The table is created by a migration; a missing one must not take the
    // whole homepage down.
    return []
  }
}

/** The title and subtitle of the news card. */
function announcementsChrome(): { title: string; subtitle: string } {
  const raw = homepageConfig as unknown as Record<string, unknown>
  const section = raw.announcements
  const config = section && typeof section === 'object' ? (section as Record<string, unknown>) : {}
  const title = typeof config.title === 'string' ? config.title.trim() : ''
  const subtitle = typeof config.subtitle === 'string' ? config.subtitle.trim() : ''
  return {
    title: title || DEFAULT_ANNOUNCEMENTS_TITLE,
    subtitle: subtitle || DEFAULT_ANNOUNCEMENTS_SUBTITLE,
  }
}

siteRoutes.get('/homepage', async (c) => {
  // The FastAPI service stamps the payload with `published_at` and sends
  // `Cache-Control: no-store` so the CMS edits show up immediately.
  const sql = c.get('sql')
  const items = await publicAnnouncements(sql)
  const payload = {
    ...homepageConfig,
    published_at: new Date().toISOString(),
    announcements: {
      ...announcementsChrome(),
      items,
    },
  }
  c.header('Cache-Control', 'no-store, max-age=0')
  return c.json(payload)
})

/** The published announcements on their own. */
siteRoutes.get('/announcements', async (c) => {
  const sql = c.get('sql')
  const items = await publicAnnouncements(sql)
  c.header('Cache-Control', 'no-store, max-age=0')
  return c.json({ items })
})
