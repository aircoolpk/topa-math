/** Times the dashboard endpoint and reports the payload size. */
const BASE = process.argv[2] || 'https://api.topamath.com'
const login = await (
  await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@4-craft.com', password: 'demo1234' }),
  })
).json()
const token = login.access_token

for (const path of ['/me/dashboard?program_type=TH', '/me/lessons?program_type=TH', '/me/profile']) {
  const sizes = []
  const times = []
  for (let i = 0; i < 3; i += 1) {
    const started = Date.now()
    const response = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } })
    const text = await response.text()
    times.push(Date.now() - started)
    sizes.push(text.length)
  }
  console.log(
    `  ${path.padEnd(36)} ${Math.min(...times)}-${Math.max(...times)} ms | ${Math.round(sizes[0] / 1024)} KB`,
  )
}
