#!/usr/bin/env node
/**
 * Probe the live FastAPI oracle for the exact request-validation shapes.
 *
 * Read-only: every request below is rejected before it can create an order,
 * a reservation or a Stripe session.
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

const BODIES = [
  ['no body, no content-type', undefined],
  ['null', 'null'],
  ['[]', '[]'],
  ['"hello"', '"hello"'],
  ['123', '123'],
  ['true', 'true'],
  ['{}', '{}'],
  ['plan_code null', '{"plan_code": null}'],
  ['plan_code 123', '{"plan_code": 123}'],
  ['plan_code true', '{"plan_code": true}'],
  ['plan_code list', '{"plan_code": ["a"]}'],
  ['plan_code object', '{"plan_code": {}}'],
  ['plan_code empty string', '{"plan_code": ""}'],
  ['extra field', '{"plan_code": "x", "extra": 1}'],
  ['malformed {not json', '{not json'],
  ['malformed {', '{'],
  ['empty body', ''],
  ['trailing comma', '{"plan_code": "th_plus_monthly",}'],
  ['missing colon', '{"plan_code" "th_plus_monthly"}'],
  ['bare word', 'undefined'],
  ['nan', 'NaN'],
  ['trailing garbage', '{"plan_code": "x"} trailing'],
  ['single quotes', "{'plan_code': 'x'}"],
  ['unterminated string', '{"plan_code": "x}'],
]

async function probe(path, label, body, { auth = true } = {}) {
  const headers = {}
  if (auth) {
    headers.Authorization = `Bearer ${token}`
    headers.Cookie = cookie
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers, body })
  const text = await res.text()
  let parsed
  try { parsed = JSON.parse(text) } catch { parsed = text }
  console.log(`\n--- ${label}`)
  console.log(`    -> ${res.status} ${JSON.stringify(parsed)}`)
}

for (const [label, body] of BODIES) {
  await probe('/billing/create-checkout-session', `checkout ${label}`, body)
}

console.log('\n\n########## anonymous ##########')
for (const [label, body] of [
  ['no body', undefined],
  ['empty object', '{}'],
  ['malformed', '{'],
  ['plan_code null', '{"plan_code": null}'],
]) {
  await probe('/billing/create-checkout-session', `anon ${label}`, body, { auth: false })
}

console.log('\n\n########## mpp checkout ##########')
for (const [label, body] of [
  ['no body', undefined],
  ['null', 'null'],
  ['plan_code null', '{"plan_code": null}'],
  ['valid founder', '{"plan_code": "th_founder_monthly"}'],
  ['unknown plan', '{"plan_code": "nope"}'],
]) {
  await probe('/billing/mpp/checkout', `mpp ${label}`, body)
}

console.log('\n\n########## webhooks ##########')
for (const [path, body, headers] of [
  ['/webhooks/stripe', '{}', {}],
  ['/webhooks/stripe', '{"id":"evt_1"}', { 'Stripe-Signature': 't=1,v1=deadbeef' }],
  ['/webhooks/mpp/payments', '{}', {}],
  ['/webhooks/mpp/staging', '{}', {}],
  ['/webhooks/mpp/staging', '{"event_id":"e1","event_type":"payment.paid","data":{}}', { 'X-Webhook-Signature': 'sha256=abc' }],
]) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body,
  })
  const text = await res.text()
  let parsed
  try { parsed = JSON.parse(text) } catch { parsed = text }
  console.log(`\n--- ${path} ${JSON.stringify(headers)}\n    -> ${res.status} ${JSON.stringify(parsed)}`)
}
