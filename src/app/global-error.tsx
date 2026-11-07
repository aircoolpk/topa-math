'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="th">
      <body>
        <main style={{ padding: 24 }}>
          <h1>ระบบมีข้อผิดพลาด</h1>
          <p>{error.message}</p>
          <button onClick={reset}>ลองใหม่</button>
        </main>
      </body>
    </html>
  )
}
