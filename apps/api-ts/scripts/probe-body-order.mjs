const BASE = 'http://127.0.0.1:8001'
const login = await fetch(`${BASE}/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'demo@4-craft.com', password: 'demo1234' }),
})
const { access_token } = await login.json()
const cases = [
  ['anon-malformed', null, '{not json'],
  ['auth-malformed', access_token, '{not json'],
  ['anon-empty-body', null, ''],
  ['anon-array', null, '[]'],
  ['anon-string-body', null, '"hello"'],
  ['anon-number-body', null, '123'],
  ['anon-null-body', null, 'null'],
  ['anon-true-body', null, 'true'],
  ['auth-extra-field', access_token, JSON.stringify({ plan_code: 'x', extra: 1 })],
  ['auth-empty-string', access_token, JSON.stringify({ plan_code: '' })],
  ['auth-bool', access_token, JSON.stringify({ plan_code: true })],
  ['auth-list', access_token, JSON.stringify({ plan_code: ['a'] })],
  ['auth-float', access_token, JSON.stringify({ plan_code: 1.5 })],
  ['auth-trailing-comma', access_token, '{"plan_code": "th_plus_monthly",}'],
  ['auth-unterminated', access_token, '{"plan_code": "x'],
]
for (const [name, token, raw] of cases) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${BASE}/billing/create-checkout-session`, { method: 'POST', headers, body: raw })
  const text = await res.text()
  console.log(name, res.status, text.slice(0, 400))
}
