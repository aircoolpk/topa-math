/**
 * Shared helpers for the profile / stats / affiliate / referral / avatar /
 * storage endpoints.
 *
 * The legacy FastAPI service renders its responses with Starlette's
 * `JSONResponse`, which differs from `JSON.stringify` in three ways:
 *
 *  - floats keep their `.0` (Python has a separate `float` type — see
 *    `src/lib/fastapiJson.ts`),
 *  - non-ASCII characters are not escaped,
 *  - datetimes are rendered in **two** different shapes:
 *
 *      * responses that go through pydantic (`response_model=…` or a
 *        `-> dict` return annotation) render UTC timestamps as
 *        `2026-05-22T11:27:49.708090Z`,
 *      * responses that FastAPI serialises straight from the ORM
 *        (`jsonable_encoder`) render them as
 *        `2026-05-22T11:27:49.708090+00:00`.
 *
 * The microseconds matter: the database stores them, Python renders all six
 * digits and JavaScript's `Date` only keeps milliseconds. The queries
 * therefore read the timestamps with
 * `to_char(…, 'YYYY-MM-DD HH24:MI:SS.US')`, which keeps the full precision.
 */
import type { Context } from 'hono'

import { HttpError } from '../lib/errors'
import { toFastApiJson } from '../lib/fastapiJson'
import type { AppEnv } from '../lib/http'

/**
 * Build a 422 error whose `detail` is pydantic's validation report.
 *
 * The legacy service answers with `{"detail": [{…}, …]}` when a payload does
 * not satisfy the request model, and the frontend reads that list.
 *
 * @param details the validation errors.
 */
export function fastApiValidationError(details: Array<Record<string, unknown>>): HttpError {
  // `HttpError` types `detail` as an object; a list is what pydantic sends.
  return new HttpError(422, details as unknown as Record<string, unknown>)
}

/** The HTTP status codes the routes below answer with. */
export type JsonStatus = 200 | 201 | 400 | 404 | 405 | 409 | 422

/**
 * Serialise a payload the way Starlette's `JSONResponse` does.
 *
 * @param c the request context.
 * @param payload the payload to serialise.
 * @param status the HTTP status code.
 */
export function jsonBody(c: Context<AppEnv>, payload: unknown, status: JsonStatus = 200) {
  return c.text(toFastApiJson(payload), status, { 'content-type': 'application/json' })
}

/**
 * Turn a `to_char(…, 'YYYY-MM-DD HH24:MI:SS.US')` value into an ISO-8601
 * timestamp without the offset.
 *
 * Python omits the fractional part when the microsecond is zero, so the
 * helper does the same.
 *
 * @param raw the timestamp as read from the database.
 */
function isoBase(raw: string | null | undefined): string {
  const text = String(raw ?? '').trim()
  if (!text) {
    return ''
  }
  const separator = text.indexOf(' ')
  const date = separator === -1 ? text : text.slice(0, separator)
  const time = separator === -1 ? '' : text.slice(separator + 1)
  const dot = time.indexOf('.')
  const clock = dot === -1 ? time : time.slice(0, dot)
  const fraction = dot === -1 ? '' : time.slice(dot + 1)
  const base = `${date}T${clock}`
  return fraction && /[1-9]/.test(fraction) ? `${base}.${fraction}` : base
}

/**
 * Render a UTC timestamp the way pydantic renders it (`…Z`).
 *
 * @param raw the timestamp as read from the database.
 */
export function pydanticTimestamp(raw: string | null | undefined): string {
  return `${isoBase(raw)}Z`
}

/**
 * Render a UTC timestamp the way `datetime.isoformat()` renders it
 * (`…+00:00`).
 *
 * @param raw the timestamp as read from the database.
 */
export function isoTimestamp(raw: string | null | undefined): string {
  return `${isoBase(raw)}+00:00`
}

/**
 * Percent-encode a string the way Python's `urllib.parse.quote(s, safe="")`
 * does.
 *
 * `encodeURIComponent` leaves `!`, `'`, `(`, `)` and `*` alone, while
 * Python escapes them — the share URLs have to match byte for byte.
 *
 * @param value the string to encode.
 */
export function pythonQuote(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  )
}

/**
 * Generate a URL-safe random token (`secrets.token_urlsafe`).
 *
 * @param byteLength the number of random bytes.
 */
export function randomToken(byteLength: number): string {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Mask an email address the way the affiliate service does.
 *
 * @param email the address to mask.
 */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email || !email.includes('@')) {
    return email ?? null
  }
  const at = email.indexOf('@')
  const name = email.slice(0, at)
  const domain = email.slice(at + 1)
  const visible = name.length <= 2 ? name.slice(0, 1) : name.slice(0, 2)
  return `${visible}***@${domain}`
}

/**
 * Keep the last four digits of a value (`_last4`).
 *
 * @param value the value to inspect.
 */
export function last4(value: string | null | undefined): string | null {
  const digits = String(value ?? '').replace(/\D/g, '')
  return digits ? digits.slice(-4) : null
}

/**
 * Mask a stored last-four (`_mask_last4`).
 *
 * @param value the stored last four digits.
 */
export function maskLast4(value: string | null | undefined): string | null {
  return value ? `****${value}` : null
}

/**
 * The public URL of the frontend — the referral links point there.
 *
 * @param c the request context.
 */
export function frontendBaseUrl(c: Context<AppEnv>): string {
  const configured = c.env.FRONTEND_BASE_URL
  return (configured && configured.trim() ? configured : 'https://topamath.com').replace(/\/+$/, '')
}

/**
 * The public URL of this API — the avatar URLs point there.
 *
 * @param c the request context.
 */
export function backendBaseUrl(c: Context<AppEnv>): string {
  const configured = c.env['BACKEND_BASE_URL']
  const base =
    typeof configured === 'string' && configured.trim()
      ? configured
      : new URL(c.req.url).origin
  return base.replace(/\/+$/, '')
}

/**
 * The relative URL of an uploaded avatar.
 *
 * @param filename the stored file name.
 */
export function avatarFileUrl(filename: string): string {
  return `/storage/avatars/${filename}`
}

/**
 * Turn a relative `/storage/…` URL into an absolute one.
 *
 * @param c the request context.
 * @param url the URL to absolutise.
 */
export function absoluteUrl(c: Context<AppEnv>, url: string | null | undefined): string | null {
  if (!url) {
    return null
  }
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }
  if (url.startsWith('/storage/')) {
    return `${backendBaseUrl(c)}${url}`
  }
  return url
}

/**
 * The referral URL of a token (`{frontend}?ref={token}`).
 *
 * @param c the request context.
 * @param token the referral token.
 */
export function referralUrl(c: Context<AppEnv>, token: string): string {
  return `${frontendBaseUrl(c)}?ref=${token}`
}

/**
 * The share URLs of a share link (`_share_urls`).
 *
 * @param c the request context.
 * @param shareUrl the URL that is shared.
 * @param title the title of the share.
 */
export function shareUrls(
  c: Context<AppEnv>,
  shareUrl: string,
  title: string,
): Record<string, string> {
  const encodedUrl = pythonQuote(shareUrl)
  const encodedText = pythonQuote(title)
  return {
    share_url: shareUrl,
    copy_url: shareUrl,
    facebook_url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    x_url: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`,
    line_url: `https://social-plugins.line.me/lineit/share?url=${encodedUrl}`,
  }
}

/**
 * The display name of a child (`_display_name`).
 *
 * @param nickname the nickname of the child.
 * @param firstName the first name of the child.
 */
export function displayName(nickname: string | null, firstName: string | null): string {
  const trimmedNickname = (nickname ?? '').trim()
  if (trimmedNickname) {
    return trimmedNickname
  }
  const trimmedFirst = (firstName ?? '').trim()
  if (trimmedFirst) {
    return `${trimmedFirst.slice(0, 1)}.`
  }
  return 'นักเรียน TOPA'
}
