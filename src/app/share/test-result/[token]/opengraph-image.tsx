import { ImageResponse } from 'next/og'
import { buildApiUrl } from '@/lib/public-env'

export const alt = 'TOPA Math test result share card'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

interface TestResultShareData {
  lesson_title?: string
  grade_level?: number
  score_percent?: number
  correct_count?: number
  total_questions?: number
  badge?: string
}

async function getShare(token: string): Promise<TestResultShareData | null> {
  try {
    const res = await fetch(buildApiUrl(`/share/test-result/${encodeURIComponent(token)}`), { cache: 'no-store' })
    if (!res.ok) return null
    const payload = await res.json()
    return payload.data as TestResultShareData
  } catch {
    // Never let a missing API origin / network failure crash the OG image
    // route — render the generic card instead.
    return null
  }
}

export default async function Image({ params }: { params: { token: string } }) {
  const data = await getShare(params.token)
  const score = Math.round(data?.score_percent || 0)
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: 'linear-gradient(135deg, #ecfdf5 0%, #ffffff 48%, #eef2ff 100%)',
          padding: 64,
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <div style={{ display: 'flex', width: '100%', gap: 54, alignItems: 'center' }}>
          <div
            style={{
              width: 290,
              height: 290,
              borderRadius: 999,
              background: '#22c55e',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 82,
              fontWeight: 900,
              boxShadow: '0 24px 60px rgba(34,197,94,0.28)',
            }}
          >
            {score}%
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ fontSize: 42, fontWeight: 900, color: '#4f46e5' }}>TOPA Math</div>
            <div style={{ marginTop: 30, fontSize: 62, fontWeight: 900, color: '#0f172a' }}>{data?.badge || 'ทำได้ดีมาก!'}</div>
            <div style={{ marginTop: 16, fontSize: 34, fontWeight: 700, color: '#475569', maxWidth: 720 }}>
              {`${data?.lesson_title || 'แบบทดสอบ TOPA Math'} · ป.${data?.grade_level || '-'}`}
            </div>
            <div style={{ display: 'flex', gap: 18, marginTop: 34 }}>
              <Pill label="ถูก" value={data?.correct_count || 0} />
              <Pill label="ทั้งหมด" value={data?.total_questions || 0} />
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  )
}

function Pill({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ background: 'white', borderRadius: 22, padding: '16px 30px', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(15,23,42,0.08)' }}>
      <span style={{ fontSize: 34, fontWeight: 900, color: '#0f172a' }}>{value}</span>
      <span style={{ fontSize: 18, fontWeight: 800, color: '#64748b' }}>{label}</span>
    </div>
  )
}
