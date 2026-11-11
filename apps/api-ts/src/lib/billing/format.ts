/**
 * Response shaping helpers shared by the billing endpoints.
 *
 * The FastAPI service returns Python objects that FastAPI serialises with
 * `jsonable_encoder`:
 *
 *  - `datetime` becomes `datetime.isoformat()` — `2026-11-10T15:14:16.269384+00:00`
 *  - `bool` stays a boolean
 *  - `None` stays `null`
 *
 * The Worker therefore formats timestamps in SQL (`to_char`) so both the Neon
 * HTTP driver and the `pg` driver used by the tests produce byte-identical
 * strings, and the microsecond part is dropped when it is zero — exactly
 * like Python's `datetime.isoformat()`.
 */

/**
 * The SQL expression that renders a `timestamptz` the way Python's
 * `datetime.isoformat()` does.
 *
 * The session timezone of the database is UTC, so the value is converted to
 * UTC explicitly instead of relying on the session setting.
 *
 * @param expression the column (or expression) to format.
 */
export function pythonIsoTimestamp(expression: string): string {
  return `to_char(${expression} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US')`
}

/**
 * Turn the SQL timestamp above into the exact string Python produces.
 *
 * Python prints `2026-11-10T15:14:16.269384+00:00`, and drops the
 * fractional part entirely when the microseconds are zero.
 *
 * @param value the value returned by `pythonIsoTimestamp`.
 */
export function toPythonIso(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null
  }
  const trimmed = value.endsWith('.000000') ? value.slice(0, -7) : value
  return `${trimmed}+00:00`
}

/**
 * The founder-price note shown on the pricing page.
 */
export const FOUNDER_NOTE_TH = '\u0e08\u0e33\u0e01\u0e31\u0e14\u0e23\u0e27\u0e21 100 \u0e2a\u0e34\u0e17\u0e18\u0b34\u0e4c\u0e41\u0e23\u0e01'

/**
 * The message returned when a checkout has to be confirmed by hand.
 */
export const MANUAL_PENDING_MESSAGE = '\u0e2a\u0e48\u0e07\u0e04\u0e33\u0e02\u0e2d\u0e2a\u0e21\u0e31\u0e04\u0e23\u0e41\u0e1e\u0e47\u0e01\u0e40\u0e01\u0e08\u0e41\u0e25\u0e49\u0e27 \u0e01\u0e23\u0e38\u0e13\u0e32\u0e23\u0e2d\u0e1c\u0e39\u0e49\u0e14\u0e39\u0e41\u0e25\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19'

/**
 * The message returned when the Stripe customer id is missing.
 */
export const MISSING_STRIPE_CUSTOMER_MESSAGE = 'ยังไม่พบข้อมูลลูกค้า Stripe'

/**
 * The message returned when the user has no child profile.
 */
export const NO_CHILD_PROFILE_MESSAGE = 'ไม่พบโปรไฟล์นักเรียน'
