/**
 * Response parity check between the legacy FastAPI service and the API
 * Worker.
 *
 * Every path the frontend calls is requested from both services with the
 * same session, and the JSON bodies are compared field by field. Volatile
 * fields (timestamps, generated ids) are ignored so only real differences
 * are reported.
 *
 * Usage:
 *   node scripts/parity-check.mjs [--worker http://127.0.0.1:8787] [--paths-only]
 */

const args = process.argv.slice(2)
function arg(name, fallback) {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : fallback
}

const FASTAPI = arg('--fastapi', 'http://127.0.0.1:8001')
const WORKER = arg('--worker', 'http://127.0.0.1:8787')
const PATHS_ONLY = args.includes('--paths-only')

const EMAIL = 'demo@4-craft.com'
const PASSWORD = 'demo1234'

// The paths the frontend calls, with the concrete ids the demo account uses.
const PATHS = [
  ['GET', '/site/homepage'],
  ['GET', '/skills'],
  ['GET', '/subjects'],
  ['GET', '/rankings?grade_level=3&scope=country'],
  ['GET', '/children'],
  ['GET', '/me/dashboard?program_type=TH'],
  ['GET', '/me/rank-summary'],
  ['GET', '/me/lessons'],
  ['GET', '/me/test-levels'],
  ['GET', '/me/profile'],
  ['GET', '/me/stats'],
  ['GET', '/me/affiliate'],
  ['GET', '/me/referral'],
  ['GET', '/me/quests/daily'],
  ['GET', '/me/quests/weekly'],
  ['GET', '/me/quests/monthly'],
  ['GET', '/me/review-lessons'],
  ['GET', '/me/recommended-lessons'],
  ['GET', '/me/share/dashboard'],
  ['GET', '/me/share/test-result'],
  ['GET', '/avatar/items'],
  ['GET', '/billing/status'],
  ['GET', '/billing/prices'],
  ['GET', '/billing/plans'],
  ['GET', '/billing/mpp/orders'],
  ['GET', '/me/lessons?program_type=TH'],
  ['GET', '/me/tests/start'],
  ['GET', '/me/quests'],
  ['GET', '/me/check-in'],
  ['GET', '/me/affiliate/payout-account'],
  ['GET', '/me/affiliate/withdrawals'],
  ['GET', '/me/students/ME/avatar'],
]

const IGNORE_KEYS = new Set([
  'created_at',
  'updated_at',
  'last_login_at',
  'generated_at',
  'timestamp',
  'expires_at',
  'session_url',
])

function normalise(value, key) {
  if (IGNORE_KEYS.has(key)) return '<ignored>'
  if (Array.isArray(value)) return value.map((v) => normalise(v, key))
  if (value && typeof value === 'object') {
    const out = {}
    for (const k of Object.keys(value).sort()) out[k] = normalise(value[k], k)
    return out
  }
  return value
}

function diff(a, b, path = '') {
  const out = []
  if (Array.isArray(a) !== Array.isArray(b)) return [`${path}: type ${Array.isArray(a) ? 'array' : typeof a} vs ${Array.isArray(b) ? 'array' : typeof b}`]
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)])
    for (const k of keys) {
      if (!(k in a)) { out.push(`${path}.${k}: missing in FastAPI (worker: ${JSON.stringify(b[k]).slice(0, 80)})`); continue }
      if (!(k in b)) { out.push(`${path}.${k}: missing in Worker (fastapi: ${JSON.stringify(a[k]).slice(0, 80)})`); continue }
      out.push(...diff(a[k], b[k], `${path}.${k}`))
    }
    return out
  }
  if (Array.isArray(a)) {
    if (a.length !== b.length) out.push(`${path}: length ${a.length} vs ${b.length}`)
    for (let i = 0; i < Math.min(a.length, b.length); i += 1) out.push(...diff(a[i], b[i], `${path}[${i}]`))
    return out
  }
  if (a !== b) out.push(`${path}: ${JSON.stringify(a)?.slice(0, 90)} vs ${JSON.stringify(b)?.slice(0, 90)}`)
  return out
}

async function login(base) {
  const res = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${base} login -> ${res.status} ${text.slice(0, 120)}`)
  const data = JSON.parse(text)
  const cookie = (res.headers.get('set-cookie') || '').split(';')[0]
  return { token: data.access_token, cookie }
}

async function request(base, auth, method, path) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { Authorization: `Bearer ${auth.token}`, Cookie: auth.cookie },
  })
  const text = await res.text()
  let body
  try { body = JSON.parse(text) } catch { body = text.slice(0, 200) }
  return { status: res.status, body }
}

async function main() {
  console.log(`fastapi : ${FASTAPI}`)
  console.log(`worker  : ${WORKER}\n`)

  if (PATHS_ONLY) {
    for (const [method, path] of PATHS) console.log(`${method} ${path}`)
    return
  }

  const fastAuth = await login(FASTAPI)
  const workerAuth = await login(WORKER)
  console.log('both logins succeeded\n')

  let identical = 0
  const mismatches = []
  for (const [method, path] of PATHS) {
    const [f, w] = await Promise.all([
      request(FASTAPI, fastAuth, method, path),
      request(WORKER, workerAuth, method, path),
    ])
    const sameStatus = f.status === w.status
    const differences = diff(normalise(f.body, ''), normalise(w.body, ''))
    const ok = sameStatus && differences.length === 0
    if (ok) {
      identical += 1
      console.log(`  ✅ ${method} ${path}  [${f.status}]`)
    } else {
      mismatches.push({ method, path, f, w, differences, sameStatus })
      console.log(`  ❌ ${method} ${path}  fastapi=${f.status} worker=${w.status}  diffs=${differences.length}`)
      for (const d of differences.slice(0, 6)) console.log(`       ${d}`)
      if (differences.length > 6) console.log(`       ... ${differences.length - 6} more`)
    }
  }

  console.log(`\nidentical: ${identical}/${PATHS.length}`)
  console.log(`mismatches: ${mismatches.length}`)
  process.exitCode = mismatches.length === 0 ? 0 : 1
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
