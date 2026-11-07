import { ImageResponse } from 'next/og'
import { buildApiUrl } from '@/lib/public-env'

export const alt = 'TOPA Math dashboard share card'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

interface DashboardShareData {
  display_name?: string
  grade_level?: number
  level?: number
  xp?: number
  score?: number
  rank?: string
  description?: string
}

async function getShare(token: string): Promise<DashboardShareData | null> {
  try {
    const res = await fetch(buildApiUrl(`/share/dashboard/${encodeURIComponent(token)}`), { cache: 'no-store' })
    if (!res.ok) return null
    const payload = await res.json()
    return payload.data as DashboardShareData
  } catch {
    // Never let a missing API origin / network failure crash the OG image
    // route — render the generic card instead.
    return null
  }
}

export default async function Image({ params }: { params: { token: string } }) {
  const data = await getShare(params.token)
  const name = data?.display_name || 'TOPA Learner'
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: 'linear-gradient(135deg, #eef2ff 0%, #ffffff 45%, #dcfce7 100%)',
          padding: 64,
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 42, fontWeight: 900, color: '#4f46e5' }}>TOPA Math</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a' }}>{`ป.${data?.grade_level || '-'}`}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 48 }}>
            <div
              style={{
                width: 190,
                height: 190,
                borderRadius: 42,
                background: '#4f46e5',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 96,
                fontWeight: 900,
                boxShadow: '0 24px 60px rgba(79,70,229,0.28)',
              }}
            >
              {name.slice(0, 1)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 62, fontWeight: 900, color: '#0f172a', maxWidth: 720 }}>{name}</div>
              <div style={{ marginTop: 12, fontSize: 32, fontWeight: 700, color: '#475569' }}>
                {data?.description || 'มาเรียนเลขสนุก ๆ กับ TOPA Math กันนะ'}
              </div>
              <div style={{ display: 'flex', gap: 18, marginTop: 30 }}>
                <Pill label="Level" value={data?.level || 1} />
                <Pill label="XP" value={(data?.xp || 0).toLocaleString()} />
                <Pill label="Score" value={(data?.score || 0).toLocaleString()} />
              </div>
            </div>
          </div>
          <div style={{ fontSize: 30, fontWeight: 800, color: '#16a34a' }}>{data?.rank || 'TOPA Learner'}</div>
        </div>
      </div>
    ),
    size,
  )
}

function Pill({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ background: 'white', borderRadius: 22, padding: '16px 24px', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(15,23,42,0.08)' }}>
      <span style={{ fontSize: 28, fontWeight: 900, color: '#0f172a' }}>{value}</span>
      <span style={{ fontSize: 18, fontWeight: 800, color: '#64748b' }}>{label}</span>
    </div>
  )
}
