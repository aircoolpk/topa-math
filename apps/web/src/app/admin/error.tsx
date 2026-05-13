'use client'

import { useEffect } from 'react'

export default function AdminErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Admin Error]', error)
  }, [error])

  return (
    <div style={{
      minHeight: '60vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '16px',
      padding: '32px',
      fontFamily: 'sans-serif',
      background: '#f8fafc',
    }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#dc2626', margin: 0 }}>
        ❌ เกิดข้อผิดพลาดในส่วน admin
      </h1>
      <p style={{ color: '#64748b', textAlign: 'center' }}>
        เกิดข้อผิดพลาด กรุณาลองรีเฟรชหน้า
      </p>
      {process.env.NODE_ENV === 'development' && (
        <pre style={{
          background: '#f1f5f9',
          padding: '12px',
          borderRadius: '8px',
          fontSize: '11px',
          color: '#475569',
          maxWidth: '500px',
          overflow: 'auto',
        }}>
          {error.digest && `[${error.digest}] `}
          {error.message}
        </pre>
      )}
      <button
        onClick={reset}
        style={{
          padding: '8px 20px',
          background: '#6366f1',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        🔄 ลองใหม่
      </button>
      <a
        href="/admin/dashboard"
        style={{
          padding: '8px 20px',
          background: '#e2e8f0',
          color: '#475569',
          borderRadius: '8px',
          fontWeight: 700,
          textDecoration: 'none',
        }}
      >
        ← กลับ Dashboard
      </a>
    </div>
  )
}
