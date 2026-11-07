// Benchmark: pure-JS PBKDF2 vs WebCrypto PBKDF2 at the iteration counts that
// matter for the Workers CPU budget.
import { pbkdf2Sha256 } from '../src/lib/sha256.ts'

const enc = new TextEncoder()
const password = enc.encode('correct horse battery staple')
const salt = enc.encode('0123456789abcdef')

async function timeIt(label, fn, runs = 5) {
  await fn() // warm up (JIT + lazy native init)
  const t0 = performance.now()
  for (let i = 0; i < runs; i++) await fn()
  const ms = (performance.now() - t0) / runs
  console.log(`${label.padEnd(48)} ${ms.toFixed(3)} ms`)
  return ms
}

console.log('--- WebCrypto PBKDF2 (native) ---')
const key = await crypto.subtle.importKey('raw', password, 'PBKDF2', false, ['deriveBits'])
for (const iters of [10_000, 50_000, 100_000]) {
  await timeIt(`webcrypto pbkdf2 iterations=${iters}`, () =>
    crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: iters, hash: 'SHA-256' }, key, 256),
  )
}

console.log('\n--- pure JS PBKDF2 ---')
for (const iters of [10_000, 100_000]) {
  await timeIt(`pure-js pbkdf2 iterations=${iters}`, () => pbkdf2Sha256(password, salt, iters), 2)
}
