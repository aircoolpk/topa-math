'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { rankingsApi, type RankingsResponse, type RankingEntry } from '@/lib/api/rankings'
import { useAuthStore } from '@/store/auth'

const SCOPES = [
  { key: 'country', label: '🇹🇭 ทั้งประเทศ', sub: 'ประเทศ' },
  { key: 'province', label: '📍 จังหวัด', sub: 'จังหวัด' },
] as const

const GRADES = [1, 2, 3, 4, 5, 6] as const

export default function PublicRankingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">กำลังโหลด...</div>}>
      <RankingPageInner />
    </Suspense>
  )
}

function RankingPageInner() {
  const router = useRouter()
  const search = useSearchParams()
  const { user } = useAuthStore()

  const initialScope = (search?.get('scope') as 'country' | 'province') || 'country'
  const initialProvince = search?.get('province') || ''
  const initialGrade = Number(search?.get('grade_level')) || 3

  const [scope, setScope] = useState<'country' | 'province'>(initialScope)
  const [province, setProvince] = useState<string>(initialProvince)
  const [gradeLevel, setGradeLevel] = useState<number>(initialGrade)
  const [data, setData] = useState<RankingsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Keep URL in sync so the page is shareable
  useEffect(() => {
    const params = new URLSearchParams()
    params.set('scope', scope)
    params.set('grade_level', String(gradeLevel))
    if (scope === 'province' && province) params.set('province', province)
    router.replace(`/ranking?${params.toString()}`)
  }, [scope, gradeLevel, province, router])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    rankingsApi
      .get(gradeLevel, scope, scope === 'province' ? { province } : {})
      .then((res) => {
        if (!cancelled) setData(res)
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.detail || 'ไม่สามารถโหลดข้อมูลได้')
        if (!cancelled) setData(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [gradeLevel, scope, province])

  const provinces = useMemo(() => data?.province_summary ?? [], [data])
  const topThree = useMemo(() => (data?.entries ?? []).slice(0, 3), [data])
  const restEntries = useMemo(() => (data?.entries ?? []).slice(3), [data])

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 via-white to-secondary-50">
      <header className="bg-white border-b border-primary-100 shadow-sm sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/" className="text-2xl hover:opacity-70 transition" aria-label="กลับหน้าแรก">
            ←
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xl">🏆</span>
            <h1 className="font-bold text-gray-900">อันดับนักเรียน</h1>
          </div>
          <div className="ml-auto">
            {user ? (
              <Link href="/dashboard" className="text-sm font-semibold text-primary-600 hover:underline">
                ไปแดชบอร์ด
              </Link>
            ) : (
              <Link href="/login" className="text-sm font-semibold text-primary-600 hover:underline">
                เข้าสู่ระบบ
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* Scope tabs */}
        <div className="flex gap-2 mb-4">
          {SCOPES.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setScope(tab.key)}
              className={`px-4 py-2.5 rounded-xl font-semibold transition-all flex-1 ${
                scope === tab.key
                  ? 'bg-primary-500 text-white shadow-md'
                  : 'bg-white text-gray-600 hover:bg-primary-50 border border-gray-200'
              }`}
            >
              <span className="block text-base">{tab.key === 'country' ? '🇹🇭' : '📍'}</span>
              <span className="text-xs mt-0.5 block">
                {tab.key === 'country' ? 'ทั้งประเทศ' : 'จังหวัด'}
              </span>
            </button>
          ))}
        </div>

        {/* Grade selector */}
        <div className="card mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">เลือกระดับชั้น</span>
            <span className="text-xs text-gray-500">
              ชั้น ป.{gradeLevel} ·{' '}
              {scope === 'country'
                ? 'ทั้งประเทศ'
                : province
                ? `จังหวัด${province}`
                : 'เ�ือกจังหวัดด้านล่าง'}
            </span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {GRADES.map((g) => (
              <button
                key={g}
                onClick={() => setGradeLevel(g)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  gradeLevel === g
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                ป.{g}
              </button>
            ))}
          </div>
        </div>

        {/* Province picker (only when scope=province) */}
        {scope === 'province' && (
          <div className="card mb-4">
            <label className="text-sm font-semibold text-gray-700 mb-2 block">เลือกจังหวัด</label>
            {provinces.length === 0 ? (
              <p className="text-sm text-gray-500">ยังไม่มีข้อมูลจังหวัดสำหรับชั้น �.{gradeLevel}</p>
            ) : (
              <select
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm"
              >
                <option value="">— เลือกจังหวัด —</option>
                {provinces.map((p) => (
                  <option key={p.province} value={p.province}>
                    {p.province} ({p.child_count} �น)
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="card py-16 text-center">
            <div className="text-5xl mb-3 animate-bounce">�</div>
            <p className="text-gray-500 font-medium">กำลังโหลดอันดับ...</p>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="card py-12 text-center bg-red-50 border-red-200">
            <div className="text-4xl mb-2">😢</div>
            <p className="text-red-600 font-semibold">{error}</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && data && data.entries.length === 0 && (
          <div className="card py-16 text-center">
            <div className="text-5xl mb-3">📭</div>
            <p className="text-gray-600 font-semibold mb-1">ยังไม่มีอันดับในข�ะนี้</p>
            <p className="text-sm text-gray-500">
              {scope === 'province' && !province
                ? 'กรุณาเลือกจังหวัดเพื่อดูอันดับ'
                : `ยังไม่มีนักเรียนที่ทำแบบทดสอบในชั้น ป.${gradeLevel}`}
            </p>
          </div>
        )}

        {/* Real data */}
        {!loading && !error && data && data.entries.length > 0 && (
          <>
            {/* Top 3 podium */}
            {topThree.length === 3 && (
              <div className="card bg-gradient-to-br from-amber-50 to-primary-50 border-amber-200 mb-6">
                <h3 className="text-center text-sm font-bold text-amber-700 mb-4">🥇 TOP 3 🥇</h3>
                <div className="flex items-end justify-center gap-3">
                  <PodiumColumn entry={topThree[1]} rank={2} medal="🥈" color="gray" topXp={topThree[0].mastery_points || 1} />
                  <PodiumColumn entry={topThree[0]} rank={1} medal="🥇" color="amber" topXp={topThree[0].mastery_points || 1} />
                  <PodiumColumn entry={topThree[2]} rank={3} medal="🥉" color="orange" topXp={topThree[0].mastery_points || 1} />
                </div>
              </div>
            )}

            {/* Province roll-up (only when country scope) */}
            {scope === 'country' && provinces.length > 0 && (
              <div className="card mb-6">
                <h3 className="section-title mb-3">🗺️ �รุปตามจังหวัด (ชั้น ป.{gradeLevel})</h3>
                <div className="grid grid-cols-2 gap-2">
                  {provinces.slice(0, 8).map((p) => (
                    <button
                      key={p.province}
                      onClick={() => {
                        setScope('province')
                        setProvince(p.province)
                      }}
                      className="flex items-center justify-between p-2 bg-gray-50 hover:bg-primary-50 rounded-lg text-sm"
                    >
                      <span className="font-semibold text-gray-700 truncate">{p.province}</span>
                      <span className="text-xs text-gray-500 ml-2">{p.child_count} คน</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Full ranking list */}
            <h3 className="section-title mb-3">📊 อันดับทั้งหมด</h3>
            <div className="space-y-2">
              {data.entries.map((entry) => (
                <RankingRow key={entry.child_profile_id} entry={entry} isTop3={entry.rank_position <= 3} />
              ))}
            </div>

            {/* Own rank (if logged in) */}
            {data.child_own_rank && !data.entries.find((e) => e.child_profile_id === data.child_own_rank?.child_profile_id) && (
              <div className="card bg-secondary-50 border-secondary-200 mt-6">
                <h3 className="section-title mb-3 text-secondary-700">⭐ อันดับของคุณ</h3>
                <RankingRow entry={data.child_own_rank} isTop3={false} highlight />
              </div>
            )}

            <p className="text-center text-xs text-gray-400 mt-6">
              �้อมูลอัปเดตแบบเรียลไทม์ · แสดงเฉพาะนักเรียนที่มีการทำแบบทดสอบ
            </p>
          </>
        )}
      </main>
    </div>
  )
}

function PodiumColumn({
  entry,
  rank,
  medal,
  color,
  topXp,
}: {
  entry: RankingEntry
  rank: number
  medal: string
  color: 'amber' | 'gray' | 'orange'
  topXp: number
}) {
  const size = rank === 1 ? 'w-20 h-20 text-3xl' : rank === 2 ? 'w-14 h-14 text-xl' : 'w-12 h-12 text-lg'
  const colorClasses =
    color === 'amber'
      ? 'from-amber-300 to-amber-500 text-amber-800'
      : color === 'gray'
      ? 'from-gray-200 to-gray-400 text-gray-600'
      : 'from-orange-200 to-orange-400 text-orange-700'
  const progress =
    topXp > 0 ? Math.min(100, Math.round(((entry.mastery_points || 0) / topXp) * 100)) : 0
  const barColor = color === 'amber' ? 'bg-amber-400' : color === 'gray' ? 'bg-gray-400' : 'bg-orange-400'
  const barBg = color === 'amber' ? 'bg-amber-200' : color === 'gray' ? 'bg-gray-200' : 'bg-orange-200'
  return (
    <div className="text-center flex-1">
      <div className={`${size} rounded-full bg-gradient-to-br ${colorClasses} flex items-center justify-center font-black text-white mx-auto shadow border-4 border-white`}>
        {entry.nickname.charAt(0)}
      </div>
      <p className="text-xs font-bold mt-1 truncate">{entry.nickname}</p>
      <div className={`text-xs mt-0.5`}>
        {medal} #{entry.rank_position}
      </div>
      <div className={`mt-1 ${barBg} rounded-full h-2 w-full overflow-hidden`}>
        <div className={`h-full ${barColor} rounded-full`} style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
}

function RankingRow({ entry, isTop3, highlight }: { entry: RankingEntry; isTop3: boolean; highlight?: boolean }) {
  return (
    <div
      className={`card flex items-center gap-4 transition-all ${
        highlight ? 'ring-2 ring-secondary-300' : ''
      } ${isTop3 ? 'bg-gradient-to-r from-amber-50 to-white' : ''}`}
    >
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black ${
          entry.rank_position === 1
            ? 'bg-amber-400 text-white'
            : entry.rank_position === 2
            ? 'bg-gray-300 text-white'
            : entry.rank_position === 3
            ? 'bg-orange-300 text-white'
            : 'bg-gray-100 text-gray-600'
        }`}
      >
        {entry.rank_position}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-800 truncate">{entry.nickname}</p>
        <p className="text-xs text-gray-500 truncate">
          {entry.province || 'ไม่ระบุจังหวัด'}
          {entry.school_name ? ` · ${entry.school_name}` : ''}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold text-primary-600">
          {entry.mastery_points.toLocaleString()} คะแนน
        </p>
        <p className="text-xs text-gray-400">
          เลเ�ล {entry.current_level} · {entry.total_tests_completed} tests
        </p>
      </div>
    </div>
  )
}
