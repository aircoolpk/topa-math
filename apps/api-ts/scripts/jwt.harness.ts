// JWT compatibility harness.
//
// Mints a token with the TypeScript implementation and prints it, so the
// Python script can compare it byte-for-byte against the FastAPI output.
//
// Usage: node --experimental-strip-types tests/jwt.harness.ts <secret> <userId> <role> <expiresAt>
const [, , secret, userId, role, expiresRaw] = process.argv
const expiresAt = Number(expiresRaw)

const { createAccessToken, verifyAccessToken } = await import('../src/lib/auth.ts')

const token = await createAccessToken(userId, role, secret, expiresAt - Math.floor(Date.now() / 1000))
console.log(token)

const payload = await verifyAccessToken(token, secret)
if (!payload) {
  console.error('self-verification failed')
  process.exit(1)
}
console.error(`self-verified: ${JSON.stringify(payload)}`)
