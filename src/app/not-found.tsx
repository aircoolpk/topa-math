import Link from 'next/link'

export default function NotFound() {
  return (
    <main style={{ padding: 24 }}>
      <h1>ไม่พบหน้านี้</h1>
      <Link href="/">กลับหน้าแรก</Link>
    </main>
  )
}
