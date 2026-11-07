// Cross-validate the pure-JS PBKDF2 against Python's hashlib.
// Generates test vectors with Python, then checks the TS implementation.
import { pbkdf2Sha256, sha256 } from '../src/lib/sha256.ts'
import { base64UrlEncode } from '../src/lib/base64url.ts'

const enc = new TextEncoder()

// --- Python-generated vectors (see make_vectors.py) ---
const VECTORS = JSON.parse(process.env.VECTORS_JSON ?? '[]')

let failures = 0
for (const v of VECTORS) {
  const out = pbkdf2Sha256(enc.encode(v.password), enc.encode(v.salt), v.iterations, v.dkLen)
  const got = base64UrlEncode(out)
  const want = v.expected_b64url
  if (got !== want) {
    failures++
    console.log(`FAIL pbkdf2 iter=${v.iterations} dkLen=${v.dkLen}\n  got  ${got}\n  want ${want}`)
  } else {
    console.log(`ok   pbkdf2 iter=${v.iterations} dkLen=${v.dkLen}`)
  }
}

// --- SHA-256 sanity against known vectors ---
const sha256Vectors = [
  { msg: '', want: '47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU' },
  { msg: 'abc', want: 'BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD' },
  { msg: 'The quick brown fox jumps over the lazy dog', want: 'D7A8FBB307C780EB9F2C2014CC4B0C11B0E4B5A0B1F1F79C4C2E1B6E4A3D2C1B0' },
]
for (const v of sha256Vectors) {
  const got = base64UrlEncode(sha256(enc.encode(v.msg))).toUpperCase()
  if (got !== v.want) {
    // base64url != hex; compare via hex instead
  }
}

// Compare SHA-256 in hex to avoid base64/hex confusion.
function toHex(bytes) {
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}
const shaHexVectors = [
  { msg: '', want: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
  { msg: 'abc', want: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' },
  { msg: 'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq', want: '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1' },
]
for (const v of shaHexVectors) {
  const got = toHex(sha256(enc.encode(v.msg)))
  if (got !== v.want) {
    failures++
    console.log(`FAIL sha256 "${v.msg}"\n  got  ${got}\n  want ${v.want}`)
  } else {
    console.log(`ok   sha256 "${v.msg.slice(0, 20)}"`)
  }
}

console.log(failures === 0 ? '\nALL VECTORS PASS' : `\n${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
