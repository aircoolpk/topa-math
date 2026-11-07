/**
 * Base64url helpers (RFC 4648 §5) — padding-free, matching the FastAPI
 * `_b64encode` / `_b64decode` helpers in `app/core/security.py`.
 *
 * Python's `base64.urlsafe_b64encode(...).rstrip(b"=")` strips padding, so
 * every JWT segment produced by the legacy service is unpadded. We must
 * produce and consume the exact same alphabet (`-` and `_`, not `+` and `/`)
 * or signature verification breaks.
 */

const BASE64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

/** Encode bytes to an unpadded base64url string. */
export function base64UrlEncode(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] as number
    const b1 = bytes[i + 1]
    const b2 = bytes[i + 2]

    out += BASE64URL_ALPHABET[b0 >> 2]
    if (b1 === undefined) {
      out += BASE64URL_ALPHABET[(b0 & 0x03) << 4]
      break
    }
    out += BASE64URL_ALPHABET[((b0 & 0x03) << 4) | (b1 >> 4)]
    if (b2 === undefined) {
      out += BASE64URL_ALPHABET[(b1 & 0x0f) << 2]
      break
    }
    out += BASE64URL_ALPHABET[((b1 & 0x0f) << 2) | (b2 >> 6)]
    out += BASE64URL_ALPHABET[b2 & 0x3f]
  }
  return out
}

/** Decode an unpadded (or padded) base64url string to bytes. */
export function base64UrlDecode(input: string): Uint8Array {
  const clean = input.replace(/=+$/, '')
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4))

  let outIndex = 0
  let buffer = 0
  let bits = 0

  for (let i = 0; i < clean.length; i++) {
    const value = BASE64URL_ALPHABET.indexOf(clean.charAt(i))
    if (value === -1) {
      throw new Error('Invalid base64url character')
    }
    buffer = (buffer << 6) | value
    bits += 6
    if (bits >= 8) {
      bits -= 8
      out[outIndex++] = (buffer >> bits) & 0xff
    }
  }
  return out.subarray(0, outIndex)
}

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

/** UTF-8 encode a string. */
export function utf8Encode(value: string): Uint8Array {
  return textEncoder.encode(value)
}

/** UTF-8 decode bytes to a string. */
export function utf8Decode(bytes: Uint8Array): string {
  return textDecoder.decode(bytes)
}

/** Concatenate byte arrays into a single buffer. */
export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  let total = 0
  for (const part of parts) total += part.length
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

/** Lowercase hex encoding. */
export function toHex(bytes: Uint8Array): string {
  let out = ''
  for (const byte of bytes) {
    out += byte.toString(16).padStart(2, '0')
  }
  return out
}

/** Decode a lowercase/uppercase hex string to bytes. */
export function fromHex(value: string): Uint8Array {
  if (value.length % 2 !== 0) {
    throw new Error('Invalid hex string length')
  }
  const out = new Uint8Array(value.length / 2)
  for (let i = 0; i < out.length; i++) {
    const byte = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16)
    if (Number.isNaN(byte)) {
      throw new Error('Invalid hex string')
    }
    out[i] = byte
  }
  return out
}

/**
 * Length-independent, data-independent comparison of two byte arrays.
 *
 * Mirrors `hmac.compare_digest` from the Python standard library: it walks
 * every byte so the running time does not leak *where* the first mismatch
 * was. Returns false immediately on a length mismatch (length is public
 * information in this format).
 */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false
  }
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= (a[i] as number) ^ (b[i] as number)
  }
  return diff === 0
}
