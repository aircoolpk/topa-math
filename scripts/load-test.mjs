/**
 * Load test for the Topa Math API against Neon.
 *
 * The FastAPI service in front of it runs on the host and every request
 * goes to Neon, so this measures the real production path: the API, the
 * tunnel and the database.
 *
 * Usage: node scripts/load-test.mjs [requests] [concurrency]
 */

const BASE = process.env.LOAD_BASE_URL || 'http://127.0.0.1:8001'
const TOTAL = Number(process.argv[2] || 300)
const CONCURRENCY = Number(process.argv[3] || 20)

const EMAIL = process.env.LOAD_EMAIL || 'demo@4-craft.com'
const PASSWORD = process.env.LOAD_PASSWORD || 'demo1234'

const READ_PATHS = [
  '/health/ready',
  '/site/homepage',
  '/me/dashboard?program_type=TH',
  '/me/lessons',
  '/me/rank-summary',
  '/rankings?grade_level=3&scope=country',
  '/children',
  '/skills',
  '/subjects',
  '/me/profile',
  '/me/stats',
]

function percentile(sorted, p) {
  if (!sorted.length) return 0
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  return sorted[index]
}

async function login() {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (!res.ok) throw new Error(`login failed: ${res.status}`)
  const data = await res.json()
  const cookie = res.headers.get('set-cookie')
  return { token: data.access_token, cookie: cookie ? cookie.split(';')[0] : '' }
}

async function main() {
  const started = Date.now()
  const auth = await login()
  console.log(`base      : ${BASE}`)
  console.log(`requests  : ${TOTAL} (concurrency ${CONCURRENCY})`)
  console.log(`paths     : ${READ_PATHS.length} read endpoints\n`)

  const latencies = []
  const perPath = new Map()
  let errors = 0
  let next = 0

  async function worker() {
    while (next < TOTAL) {
      const index = next++
      const path = READ_PATHS[index % READ_PATHS.length]
      const t0 = performance.now()
      try {
        const res = await fetch(`${BASE}${path}`, {
          headers: { Authorization: `Bearer ${auth.token}`, Cookie: auth.cookie },
        })
        await res.arrayBuffer()
        const ms = performance.now() - t0
        latencies.push(ms)
        const entry = perPath.get(path) ?? { count: 0, total: 0, max: 0, failures: 0 }
        entry.count += 1
        entry.total += ms
        entry.max = Math.max(entry.max, ms)
        if (!res.ok) {
          entry.failures += 1
          errors += 1
        }
        perPath.set(path, entry)
      } catch (error) {
        errors += 1
        const entry = perPath.get(path) ?? { count: 0, total: 0, max: 0, failures: 0 }
        entry.count += 1
        entry.failures += 1
        perPath.set(path, entry)
      }
    }
  }

  const wallStart = Date.now()
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  const wall = (Date.now() - wallStart) / 1000

  const sorted = [...latencies].sort((a, b) => a - b)
  const rps = TOTAL / wall

  console.log('--- latency (ms) ---')
  console.log(`  p50  ${percentile(sorted, 50).toFixed(1)}`)
  console.log(`  p90  ${percentile(sorted, 90).toFixed(1)}`)
  console.log(`  p99  ${percentile(sorted, 99).toFixed(1)}`)
  console.log(`  max  ${(sorted[sorted.length - 1] ?? 0).toFixed(1)}`)
  console.log(`\nthroughput : ${rps.toFixed(1)} req/s over ${wall.toFixed(1)}s`)
  console.log(`errors     : ${errors} (${((errors / TOTAL) * 100).toFixed(1)}%)`)

  console.log('\n--- per path ---')
  for (const [path, e] of [...perPath.entries()].sort()) {
    console.log(
      `  ${path.padEnd(34)} n=${String(e.count).padStart(3)}  avg=${(e.total / e.count).toFixed(0).padStart(5)}ms  max=${e.max.toFixed(0).padStart(5)}ms  fail=${e.failures}`,
    )
  }
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
