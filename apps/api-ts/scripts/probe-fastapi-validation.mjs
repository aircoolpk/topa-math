#!/usr/bin/env node
/**
 * Probe the FastAPI validation/error shapes for the billing endpoints.
 *
 * Read-only: every request below is rejected before it can create an order
 * or a Stripe session. The token never leaves this process.
 */
const BASE = process.argv[2] || 'http://127.0.0.1:8001'

const login = await fetch(`${BASE}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'demo@4-craft.com', password: 'demo1234' }),
})
if (!login.ok) {
  console.error('login failed', login.status)
  process.exit(1)
}
const { access_token: token } = await login.json()
const cookie = (login.headers.get('set-cookie') || '').split(';')[0]

async function probe(label, path, init, { auth = true } = {}) {
  const headers = { ...(init?.headers || {}) }
  if (auth) {
    headers.Authorization = `Bearer ${token}`
    headers.Cookie = cookie
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers })
  const text = await res.text()
  let body
  try { body = JSON.parse(text) } catch { body = text.slice(0, 200) }
  console.log(`\n--- ${label}\n    ${init?.method || 'GET'} ${path} -> ${res.status}`)
  console.log('    ' + JSON.stringify(body).slice(0, 700))
}

const J = (body) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body })

await probe('malformed JSON', '/billing/create-checkout-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{not json' })
await probe('array body', '/billing/create-checkout-session', J('[]'))
await probe('string body', '/billing/create-checkout-session', J('"hello"'))
await probe('null body', '/billing/create-checkout-session', J('null'))
await probe('no body at all', '/billing/create-checkout-session', { method: 'POST' })
await probe('plan_code list', '/billing/create-checkout-session', J(JSON.stringify({ plan_code: ['a'] })))
await probe('plan_code bool', '/billing/create-checkout-session', J(JSON.stringify({ plan_code: true })))
await probe('extra field', '/billing/create-checkout-session', J(JSON.stringify({ plan_code: 'x', extra: 1 })))
await probe('anon + invalid body', '/billing/create-checkout-session', J(JSON.stringify({})), { auth: false })
await probe('anon + malformed json', '/billing/create-checkout-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' }, { auth: false })
await probe('mpp checkout no body', '/billing/mpp/checkout', { method: 'POST' })
await probe('mpp checkout bad plan', '/billing/mpp/checkout', J(JSON.stringify({ plan_code: 'nope' })))
await probe('mpp checkout null plan', '/billing/mpp/checkout', J(JSON.stringify({ plan_code: null })))
await probe('mpp orders other user id', '/billing/mpp/orders/11111111-1111-1111-1111-111111111111')
await probe('mpp order retry other id', '/billing/mpp/orders/11111111-1111-1111-1111-111111111111/retry', { method: 'POST' })
await probe('mpp order recheck other id', '/billing/mpp/orders/11111111-1111-1111-1111-111111111111/recheck', { method: 'POST' })
await probe('checkouts other id', '/billing/checkouts/11111111-1111-1111-1111-111111111111')
await probe('payments (unknown route)', '/billing/payments')
await probe('webhooks stripe no sig', '/webhooks/stripe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
await probe('webhooks mpp payments', '/webhooks/mpp/payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
await probe('webhooks mpp staging', '/webhooks/mpp/staging', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
await probe('status no child (new user)', '/billing/status')
