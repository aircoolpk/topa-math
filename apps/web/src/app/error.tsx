'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main style={{ padding: 24 }}>
      <h1>เกิดข้อผิดพลาด</h1>
      <p>{error.message}</p>
      <button onClick={reset}>ลองใหม่</button>
    </main>
  )
}
