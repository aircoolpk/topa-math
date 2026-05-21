import type { Metadata } from 'next'
import Link from 'next/link'
import { ReferralCapture } from '@/components/referral/ReferralCapture'

export const dynamic = 'force-dynamic'

interface DashboardShareData {
  display_name?: string
  avatar_url?: string | null
  avatar_gender?: string
  grade_level?: number
  level?: number
  xp?: number
  score?: number
  rank?: string
  title?: string
  description?: string
  cta_url?: string
  referral_token?: string
}

async function getShare(token: string): Promise<DashboardShareData | null> {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8001'
  const res = await fetch(`${apiBase}/share/dashboard/${encodeURIComponent(token)}`, { cache: 'no-store' })
  if (!res.ok) return null
  const payload = await res.json()
  return payload.data as DashboardShareData
}

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://topamath.com').replace(/\/$/, '')
}

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const data = await getShare(params.token)
  const title = data?.title || 'TOPA Math'
  const description = data?.description || 'มาเรียนเลขสนุก ๆ กับ TOPA Math กันนะ'
  const url = `${appUrl()}/share/dashboard/${params.token}`
  const image = `${url}/opengraph-image`
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: 'TOPA Math',
      images: [{ url: image, width: 1200, height: 630, alt: title }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  }
}

export default async function DashboardSharePage({ params }: { params: { token: string } }) {
  const data = await getShare(params.token)
  if (!data) {
    return (
      <main className="min-h-screen bg-primary-50 flex items-center justify-center px-4">
        <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
          <h1 className="text-2xl font-extrabold text-gray-900">ไม่พบลิงก์แชร์นี้</h1>
          <Link href="/" className="btn-primary mt-6 inline-flex px-6 py-3">เริ่มเรียนเลย</Link>
        </div>
      </main>
    )
  }

  const name = data.display_name || 'นักเรียน TOPA'
  return (
    <main className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50 px-4 py-10">
      <ReferralCapture token={data.referral_token} shareToken={params.token} />
      <section className="mx-auto max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl border border-primary-100">
        <div className="bg-gradient-to-r from-primary-600 to-accent-500 px-6 py-5 text-white">
          <p className="text-sm font-bold opacity-90">TOPA Math</p>
          <h1 className="mt-1 text-3xl font-black">มาเรียนเลขสนุก ๆ ด้วยกัน</h1>
        </div>
        <div className="p-6 sm:p-10 text-center">
          {data.avatar_url ? (
            <img src={data.avatar_url} alt={name} className="mx-auto h-28 w-28 rounded-3xl object-cover shadow-lg border-4 border-white" />
          ) : (
            <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-3xl bg-primary-100 text-4xl font-black text-primary-700 shadow-lg">
              {name.slice(0, 1)}
            </div>
          )}
          <h2 className="mt-5 text-3xl font-black text-gray-900">{name}</h2>
          <p className="mt-2 text-gray-600">{data.description || 'มาเรียนเลขสนุก ๆ กับ TOPA Math กันนะ'}</p>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl bg-primary-50 p-4">
              <div className="text-2xl font-black text-primary-700">{data.level || 1}</div>
              <div className="text-xs font-bold text-primary-500">Level</div>
            </div>
            <div className="rounded-2xl bg-amber-50 p-4">
              <div className="text-2xl font-black text-amber-700">{(data.xp || 0).toLocaleString()}</div>
              <div className="text-xs font-bold text-amber-500">XP</div>
            </div>
            <div className="rounded-2xl bg-green-50 p-4">
              <div className="text-2xl font-black text-green-700">{(data.score || 0).toLocaleString()}</div>
              <div className="text-xs font-bold text-green-500">Score</div>
            </div>
            <div className="rounded-2xl bg-purple-50 p-4">
              <div className="text-lg font-black text-purple-700">ป.{data.grade_level || '-'}</div>
              <div className="text-xs font-bold text-purple-500">{data.rank || 'TOPA Learner'}</div>
            </div>
          </div>
          <Link href={data.cta_url || '/'} className="btn-primary mt-8 inline-flex px-8 py-3 text-base">สมัครสมาชิก / เริ่มเรียนเลย</Link>
        </div>
      </section>
    </main>
  )
}
