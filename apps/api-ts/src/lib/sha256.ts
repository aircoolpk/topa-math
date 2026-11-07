/**
 * Pure-JS SHA-256 / HMAC / PBKDF2.
 *
 * WHY THIS EXISTS
 * ---------------
 * Cloudflare Workers' `crypto.subtle.deriveBits` refuses PBKDF2 above
 * 100,000 iterations:
 *
 *   NotSupportedError: iteration counts above 100000 are not supported
 *
 * The legacy FastAPI service hashes passwords with **200,000** PBKDF2-SHA256
 * iterations (`app/core/security.py`), so an existing user's stored hash can
 * only be verified by an implementation that is not bound by the WebCrypto
 * ceiling. This module provides one.
 *
 * It is written for the hot PBKDF2 loop: the HMAC inner and outer chaining
 * states are precomputed once per derivation, so each iteration compresses
 * only the two 32-byte payload blocks instead of re-hashing the 64-byte pad
 * blocks.
 *
 * The output is bit-identical to Python's `hashlib.pbkdf2_hmac("sha256", …)`
 * and to `crypto.subtle.deriveBits` — see `tests/password.test.ts`.
 */

/** SHA-256 round constants. */
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

/** Initial SHA-256 chaining state. */
const INITIAL_STATE = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
])

const BLOCK_SIZE = 64
const DIGEST_SIZE = 32

/** Scratch space for the message schedule — reused across compressions to avoid per-iteration allocation. */
const W = new Uint32Array(64)

function rotr(value: number, bits: number): number {
  return ((value >>> bits) | (value << (32 - bits))) >>> 0
}

/**
 * Compress one 64-byte block into the running SHA-256 state.
 *
 * @param state 8-word chaining state, mutated in place.
 * @param block buffer holding the message.
 * @param offset byte offset of the 64-byte block inside `block`.
 */
function compress(state: Uint32Array, block: Uint8Array, offset: number): void {
  const w = W

  for (let i = 0; i < 16; i++) {
    const j = offset + i * 4
    w[i] =
      (((block[j] as number) << 24) |
        ((block[j + 1] as number) << 16) |
        ((block[j + 2] as number) << 8) |
        (block[j + 3] as number)) >>>
      0
  }
  for (let i = 16; i < 64; i++) {
    const w15 = w[i - 15] as number
    const w2 = w[i - 2] as number
    const s0 = (rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3)) >>> 0
    const s1 = (rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10)) >>> 0
    w[i] = (((w[i - 16] as number) + s0 + ((w[i - 7] as number) + s1)) >>> 0) >>> 0
  }

  let a = state[0] as number
  let b = state[1] as number
  let c = state[2] as number
  let d = state[3] as number
  let e = state[4] as number
  let f = state[5] as number
  let g = state[6] as number
  let h = state[7] as number

  for (let i = 0; i < 64; i++) {
    const S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0
    const ch = ((e & f) ^ (~e & g)) >>> 0
    const temp1 = (h + S1 + ch + (K[i] as number) + (w[i] as number)) >>> 0
    const S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0
    const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0
    const temp2 = (S0 + maj) >>> 0

    h = g
    g = f
    f = e
    e = (d + temp1) >>> 0
    d = c
    c = b
    b = a
    a = (temp1 + temp2) >>> 0
  }

  state[0] = ((state[0] as number) + a) >>> 0
  state[1] = ((state[1] as number) + b) >>> 0
  state[2] = ((state[2] as number) + c) >>> 0
  state[3] = ((state[3] as number) + d) >>> 0
  state[4] = ((state[4] as number) + e) >>> 0
  state[5] = ((state[5] as number) + f) >>> 0
  state[6] = ((state[6] as number) + g) >>> 0
  state[7] = ((state[7] as number) + h) >>> 0
}

/** Extract the 32-byte digest from a chaining state. */
function digestFromState(state: Uint32Array): Uint8Array {
  const out = new Uint8Array(DIGEST_SIZE)
  const view = new DataView(out.buffer)
  for (let i = 0; i < 8; i++) {
    view.setUint32(i * 4, state[i] as number, false)
  }
  return out
}

/**
 * Continue a SHA-256 computation from an existing chaining state.
 *
 * `baseState` must already have consumed exactly `alreadyBytes` bytes (a
 * multiple of the 64-byte block size), and `message` continues that stream.
 *
 * @param baseState chaining state after `alreadyBytes` bytes.
 * @param message continuation bytes.
 * @param alreadyBytes number of bytes already folded into `baseState`.
 */
function sha256FromState(baseState: Uint32Array, message: Uint8Array, alreadyBytes: number): Uint8Array {
  const state = baseState.slice()
  const total = alreadyBytes + message.length

  // The continuation stream is `message || 0x80 || zeros || 64-bit length`,
  // where the length covers the whole message (alreadyBytes + message).
  const tailLen = Math.ceil((message.length + 1 + 8) / BLOCK_SIZE) * BLOCK_SIZE
  const tail = new Uint8Array(tailLen)
  tail.set(message)
  tail[message.length] = 0x80

  const view = new DataView(tail.buffer)
  view.setUint32(tailLen - 8, Math.floor(total / 0x20000000), false)
  view.setUint32(tailLen - 4, (total << 3) >>> 0, false)

  for (let offset = 0; offset < tailLen; offset += BLOCK_SIZE) {
    compress(state, tail, offset)
  }
  return digestFromState(state)
}

/**
 * Compute SHA-256 of a message.
 *
 * @param message bytes to hash.
 * @returns the 32-byte digest.
 */
export function sha256(message: Uint8Array): Uint8Array {
  const state = INITIAL_STATE.slice()
  const paddedLen = Math.ceil((message.length + 1 + 8) / BLOCK_SIZE) * BLOCK_SIZE
  const padded = new Uint8Array(paddedLen)
  padded.set(message)
  padded[message.length] = 0x80

  const view = new DataView(padded.buffer)
  view.setUint32(paddedLen - 8, Math.floor(message.length / 0x20000000), false)
  view.setUint32(paddedLen - 4, (message.length << 3) >>> 0, false)

  for (let offset = 0; offset < paddedLen; offset += BLOCK_SIZE) {
    compress(state, padded, offset)
  }
  return digestFromState(state)
}

/**
 * Precomputed HMAC-SHA256 key schedule.
 *
 * Holds the chaining state after the 64-byte ipad/opad blocks so that the
 * per-iteration work in PBKDF2 only compresses the payload block.
 */
export interface HmacKeySchedule {
  readonly innerState: Uint32Array
  readonly outerState: Uint32Array
}

/**
 * Prepare an HMAC-SHA256 key schedule for `key`.
 *
 * @param key the HMAC key (hashed down to 32 bytes when longer than 64).
 */
export function prepareHmacKey(key: Uint8Array): HmacKeySchedule {
  let normalized = key
  if (normalized.length > BLOCK_SIZE) {
    normalized = sha256(normalized)
  }

  const innerPad = new Uint8Array(BLOCK_SIZE)
  const outerPad = new Uint8Array(BLOCK_SIZE)
  innerPad.set(normalized)
  outerPad.set(normalized)
  for (let i = 0; i < BLOCK_SIZE; i++) {
    innerPad[i] = (innerPad[i] as number) ^ 0x36
    outerPad[i] = (outerPad[i] as number) ^ 0x5c
  }

  const innerState = INITIAL_STATE.slice()
  compress(innerState, innerPad, 0)
  const outerState = INITIAL_STATE.slice()
  compress(outerState, outerPad, 0)

  return { innerState, outerState }
}

/**
 * Compute HMAC-SHA256 using a precomputed key schedule.
 *
 * @param schedule key schedule from {@link prepareHmacKey}.
 * @param message the message to authenticate.
 */
export function hmacSha256(schedule: HmacKeySchedule, message: Uint8Array): Uint8Array {
  const inner = sha256FromState(schedule.innerState, message, BLOCK_SIZE)
  return sha256FromState(schedule.outerState, inner, BLOCK_SIZE)
}

/**
 * PBKDF2-HMAC-SHA256.
 *
 * Bit-identical to Python's `hashlib.pbkdf2_hmac("sha256", password, salt, iterations)`
 * and to `crypto.subtle.deriveBits` with the PBKDF2/SHA-256 parameters.
 *
 * @param password the password bytes.
 * @param salt the salt bytes.
 * @param iterations iteration count (must be a positive integer).
 * @param dkLen derived key length in bytes (defaults to 32).
 */
export function pbkdf2Sha256(
  password: Uint8Array,
  salt: Uint8Array,
  iterations: number,
  dkLen: number = DIGEST_SIZE,
): Uint8Array {
  if (!Number.isInteger(iterations) || iterations < 1) {
    throw new RangeError('iterations must be a positive integer')
  }
  if (dkLen < 1 || dkLen > 0xffffffff * DIGEST_SIZE) {
    throw new RangeError('dkLen out of range')
  }

  const schedule = prepareHmacKey(password)
  const blocks = Math.ceil(dkLen / DIGEST_SIZE)
  const out = new Uint8Array(blocks * DIGEST_SIZE)

  const block = new Uint8Array(salt.length + 4)
  block.set(salt)

  for (let blockIndex = 1; blockIndex <= blocks; blockIndex++) {
    block[salt.length] = (blockIndex >>> 24) & 0xff
    block[salt.length + 1] = (blockIndex >>> 16) & 0xff
    block[salt.length + 2] = (blockIndex >>> 8) & 0xff
    block[salt.length + 3] = blockIndex & 0xff

    let u = hmacSha256(schedule, block)
    const acc = u.slice()

    for (let i = 1; i < iterations; i++) {
      u = hmacSha256(schedule, u)
      for (let j = 0; j < DIGEST_SIZE; j++) {
        acc[j] = (acc[j] as number) ^ (u[j] as number)
      }
    }

    out.set(acc, (blockIndex - 1) * DIGEST_SIZE)
  }

  return out.subarray(0, dkLen)
}
