/**
 * Stripe webhook signature verification.
 *
 * Stripe signs every webhook with the endpoint's signing secret and sends
 * the signature in the `Stripe-Signature` header:
 *
 *   Stripe-Signature: t=1614556800,v1=5257a869e7ec…
 *
 * The signed payload is `${timestamp}.${raw_body}`, signed with HMAC-SHA256
 * and the endpoint secret, and compared against every `v1=` value in the
 * header.
 *
 * The Python service calls `stripe.Webhook.construct_event()`, which
 * performs the same check (plus a timestamp-tolerance check) and raises on
 * a mismatch — which the FastAPI router turns into
 * `400 {"detail": "Invalid Stripe signature"}`.
 */
import { toHex, utf8Encode } from '../base64url'

/** The default tolerance for the signature timestamp, in seconds. */
export const DEFAULT_TOLERANCE_SECONDS = 300

/** A parsed `Stripe-Signature` header. */
export interface ParsedSignature {
  /** The signed timestamp, in seconds since the Unix epoch. */
  timestamp: number
  /** The `v1=` HMAC values. */
  signatures: string[]
}

/**
 * Parse a `Stripe-Signature` header.
 *
 * @param header the raw header value.
 * @returns the parsed header, or `null` when it is malformed.
 */
export function parseStripeSignature(header: string | null | undefined): ParsedSignature | null {
  if (!header) {
    return null
  }

  let timestamp: number | null = null
  const signatures: string[] = []

  for (const part of header.split(',')) {
    const index = part.indexOf('=')
    if (index < 0) {
      continue
    }
    const key = part.slice(0, index).trim()
    const value = part.slice(index + 1).trim()
    if (key === 't') {
      const parsed = Number.parseInt(value, 10)
      if (Number.isFinite(parsed)) {
        timestamp = parsed
      }
    } else if (key === 'v1') {
      signatures.push(value)
    }
  }

  if (timestamp === null || signatures.length === 0) {
    return null
  }
  return { timestamp, signatures }
}

/**
 * Compute the HMAC-SHA256 signature Stripe would send for a payload.
 *
 * @param secret the endpoint signing secret.
 * @param timestamp the signed timestamp, in seconds.
 * @param payload the raw request body.
 */
export async function computeStripeSignature(
  secret: string,
  timestamp: number,
  payload: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    utf8Encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, utf8Encode(`${timestamp}.${payload}`))
  return toHex(new Uint8Array(signature))
}

/**
 * Verify a Stripe webhook signature.
 *
 * @param payload the raw request body.
 * @param header the `Stripe-Signature` header.
 * @param secret the endpoint signing secret.
 * @param toleranceSeconds how old the signature may be.
 * @returns `true` when the signature is valid.
 */
export async function verifyStripeSignature(
  payload: string,
  header: string | null | undefined,
  secret: string,
  toleranceSeconds: number = DEFAULT_TOLERANCE_SECONDS,
): Promise<boolean> {
  const parsed = parseStripeSignature(header)
  if (!parsed) {
    return false
  }

  // Reject stale signatures — the same tolerance the Python SDK applies.
  const age = Math.floor(Date.now() / 1000) - parsed.timestamp
  if (age > toleranceSeconds || age < -toleranceSeconds) {
    return false
  }

  const expected = await computeStripeSignature(secret, parsed.timestamp, payload)
  return parsed.signatures.some((candidate) => candidate.length === expected.length && candidate === expected)
}
