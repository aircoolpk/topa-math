const BASE = 'http://127.0.0.1:8001'
const login = await fetch(`${BASE}/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'demo@4-craft.com', password: 'demo1234' }),
})
const { access_token } = await login.json()
const cases = [
  ['no-body-at-all', undefined],
  ['empty-string', ''],
  ['null', 'null'],
  ['array', '[]'],
  ['string', '"str"'],
  ['number', '123'],
  ['true', 'true'],
  ['obj-empty', '{}'],
  ['obj-extra', '{"foo":1}'],
]
for (const [name, raw] of cases) {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${access_token}` }
  const init = { method: 'POST', headers }
  if (raw !== undefined) init.body = raw
  const res = await fetch(`${BASE}/billing/create-checkout-session`, init)
  console.log(name, res.status, (await res.text()).slice(0, 300))
}
