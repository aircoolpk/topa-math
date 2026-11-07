/**
 * Measure the CPU cost of the password-hashing paths inside the real
 * workerd runtime.
 *
 * The Workers Free plan allows 10 ms of CPU per request, so the numbers
 * this produces decide whether the login endpoint can run on the Free plan.
 *
 * Usage:
 *   node scripts/bench-cpu.mjs          # write the benchmark worker
 *   npx wrangler dev --config dist/bench-cpu/wrangler.toml --port 8801
 *   curl "http://127.0.0.1:8801/?mode=webcrypto&iters=30000"
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const benchDir = join(PACKAGE_ROOT, 'dist', 'bench-cpu')
mkdirSync(benchDir, { recursive: true })

// A tiny entry point that exercises the real hashing code.
const entry = join(benchDir, 'entry.ts')
writeFileSync(
  entry,
  `import { deriveKey } from '../../src/lib/auth'
import { pbkdf2Sha256 } from '../../src/lib/sha256'

const encoder = new TextEncoder()

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const iterations = Number(url.searchParams.get('iters') || '30000')
    const mode = url.searchParams.get('mode') || 'webcrypto'

    const password = encoder.encode('correct horse battery staple')
    const salt = encoder.encode('a'.repeat(32))

    if (mode === 'webcrypto') {
      const t0 = performance.now()
      await deriveKey(password, salt, iterations)
      const ms = performance.now() - t0
      return new Response(JSON.stringify({ mode, iterations, ms }), {
        headers: { 'content-type': 'application/json' },
      })
    }

    const t0 = performance.now()
    pbkdf2Sha256(password, salt, iterations)
    const ms = performance.now() - t0
    return new Response(JSON.stringify({ mode, iterations, ms }), {
      headers: { 'content-type': 'application/json' },
    })
  },
}
`,
)

// Bundle with esbuild so wrangler receives plain JavaScript.
const { build } = await import('esbuild')
await build({
  entryPoints: [entry],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  outfile: join(benchDir, 'index.js'),
})

writeFileSync(
  join(benchDir, 'wrangler.toml'),
  'name = "topa-bench-cpu"\nmain = "index.js"\ncompatibility_date = "2025-04-01"\n',
)

console.log(`benchmark worker written to ${benchDir}`)
console.log('run it with: npx wrangler dev --config dist/bench-cpu/wrangler.toml --port 8801')
