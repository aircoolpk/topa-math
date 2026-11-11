#!/usr/bin/env node
/**
 * Capture the live FastAPI responses for the billing/webhook surface.
 *
 * The token is never printed — it stays inside this process.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.argv[2] || 'http://127.0.0.1:8001'
const OUT = process.argv[3] || join(process.cwd(), 'tmp')

const login = await fetch(`${BASE}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'demo@4-craft.com', password: 'demo1234' }),
})
if (!login.ok) {
  console.error('login failed', login.status, (await login.text()).slice(0, 200))
  process.exit(1)
}
const loginBody = await login.json()
const token = loginBody.access_token
const cookie = (login.headers.get('set-cookie') || '').split(';')[0]
mkdirSync(OUT, { recursive: true })

const CASES = [
  ['GET', '/billing/status', null],
  ['GET', '/billing/prices', null],
  ['GET', '/billing/plans', null],
  ['GET', '/billing/mpp/orders', null],
  ['GET', '/billing/mpp/orders/00000000-0000-0000-0000-000000000000', null],
  ['GET', '/billing/checkouts/00000000-0000-0000-0000-000000000000', null],
  ['GET', '/billing/payments', null],
  ['POST', '/billing/create-checkout-session', { plan_code: 'not_a_plan' }],
  ['POST', '/billing/create-checkout-session', { plan_code: null }],
  ['POST', '/billing/create-checkout-session', {}],
  ['POST', '/billing/create-checkout-session', { plan_code: 123 }],
  ['POST', '/billing/create-checkout-session', { plan_code: '' }],
  ['POST', '/billing/create-checkout-session', { plan_code: 'x', extra: 1 }],
  ['POST', '/billing/mpp/checkout', { plan_code: 'not_a_plan' }],
  ['POST', '/billing/mpp/checkout', { plan_code: 'th_founder_monthly' }],
  ['POST', '/billing/mpp/checkout', null],
  ['POST', '/billing/create-portal-session', undefined],
  ['POST', '/billing/mpp/orders/00000000-0000-0000-0000-000000000000/retry', undefined],
  ['POST', '/billing/mpp/orders/00000000-0000-0000-0000-000000000000/recheck', undefined],
  ['POST', '/webhooks/stripe', undefined],
  ['POST', '/webhooks/mpp/payments', undefined],
  ['POST', '/webhooks/mpp/staging', undefined],
]

const results = []
for (const [method, path, body] of CASES) {
  const init = { method, headers: { Authorization: `Bearer ${token}`, Cookie: cookie } }
  if (body !== undefined && method !== 'GET') {
    init.headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(body)
  }
  const res = await fetch(`${BASE}${path}`, init)
  const text = await res.text()
  let parsed
  try { parsed = JSON.parse(text) } catch { parsed = text }
  results.push({ method, path, status: res.status, body: parsed })
  console.log(`${method} ${path} -> ${res.status}`)
}

for (const [method, path, body] of [
  ['GET', '/billing/status', null],
  ['GET', '/billing/mpp/orders', null],
  ['POST', '/billing/create-checkout-session', { plan_code: 'th_plus_monthly' }],
  ['POST', '/billing/create-portal-session', undefined],
  ['POST', '/billing/mpp/checkout', { plan_code: 'th_plus_monthly' }],
]) {
  const init = { method, headers: {} }
  if (body !== undefined && method !== 'GET') {
    init.headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(body)
  }
  const res = await fetch(`${BASE}${path}`, init)
  const text = await res.text()
  let parsed
  try { parsed = JSON.parse(text) } catch { parsed = text }
  results.push({ method, path, status: res.status, body: parsed, anonymous: true })
  console.log(`(anon) ${method} ${path} -> ${res.status}`)
}

writeFileSync(join(OUT, 'oracle-live.json'), JSON.stringify(results, null, 2))
console.log(`\nsaved -> ${join(OUT, 'oracle-live.json')}`)
