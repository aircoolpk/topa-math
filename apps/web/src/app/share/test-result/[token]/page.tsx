import type { Metadata } from 'next'
import Link from 'next/link'
import { ReferralCapture } from '@/components/referral/ReferralCapture'
import { buildApiUrl, getAppBaseUrl } from '@/lib/public-env'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

interface TestResultShareData {
  display_name?: string
  lesson_title?: string
  grade_level?: number
  score_percent?: number
  correct_count?: number
  total_questions?: number
  badge?: string
  title?: string
  description?: string
  cta_url?: string
  referral_token?: string
}

async function getShare(token: string): Promise<TestResultShareData | null> {
  const res = await fetch(buildApiUrl(`/share/test-result/${encodeURIComponent(token)}`), { cache: 'no-store' })
  if (!res.ok) return null
  const payload = await res.json()
  return payload.data as TestResultShareData
}

function appUrl() {
  return getAppBaseUrl()
}

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const data = await getShare(params.token)
  const title = data?.title || 'ผลสอบ TOPA Math'
  const description = data?.description || 'ลองฝึกเลขสนุก ๆ กับ TOPA Math แล้วมาเก็บคะแนนไปด้วยกัน'
  const url = `${appUrl()}/share/test-result/${params.token}`
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

export default async function TestResultSharePage({ params }: { params: { token: string } }) {
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

  const score = Math.round(data.score_percent || 0)
  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 via-white to-primary-50 px-4 py-10">
      <ReferralCapture token={data.referral_token} shareToken={params.token} />
      <section className="mx-auto max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl border border-green-100">
        <div className="bg-gradient-to-r from-green-500 to-primary-600 px-6 py-5 text-white">
          <p className="text-sm font-bold opacity-90">TOPA Math</p>
          <h1 className="mt-1 text-3xl font-black">ผลสอบเลขสุดภูมิใจ</h1>
        </div>
        <div className="p-6 sm:p-10 text-center">
          <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-full bg-green-100 text-4xl font-black text-green-700 shadow-inner">
            {score}%
          </div>
          <h2 className="mt-5 text-3xl font-black text-gray-900">{data.badge || 'ทำได้ดีมาก!'}</h2>
          <p className="mt-2 text-gray-600">{data.lesson_title || 'แบบทดสอบ TOPA Math'} · ป.{data.grade_level || '-'}</p>
          <div className="mt-6 mx-auto grid max-w-md grid-cols-2 gap-3">
            <div className="rounded-2xl bg-green-50 p-4">
              <div className="text-3xl font-black text-green-700">{data.correct_count || 0}</div>
              <div className="text-xs font-bold text-green-500">ข้อที่ถูก</div>
            </div>
            <div className="rounded-2xl bg-primary-50 p-4">
              <div className="text-3xl font-black text-primary-700">{data.total_questions || 0}</div>
              <div className="text-xs font-bold text-primary-500">ข้อทั้งหมด</div>
            </div>
          </div>
          <p className="mt-6 text-gray-600">{data.description || 'ลองฝึกเลขสนุก ๆ กับ TOPA Math แล้วมาเก็บคะแนนไปด้วยกัน'}</p>
          <Link href={data.cta_url || '/'} className="btn-primary mt-8 inline-flex px-8 py-3 text-base">สมัครสมาชิก / เริ่มเรียนเลย</Link>
        </div>
      </section>
    </main>
  )
}
