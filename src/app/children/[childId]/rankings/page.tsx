'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/auth'
import { rankingsApi, type RankingsResponse, type RankingEntry } from '@/lib/api/rankings'
import { childrenApi, type ChildOut } from '@/lib/api/children'

export default function RankingsPage() {
  const params = useParams()
  const childId = params.childId as string
  const router = useRouter()
  const { checkAuth } = useAuthStore()
  const [scope, setScope] = useState<'country' | 'province'>('country')
  const [data, setData] = useState<RankingsResponse | null>(null)
  const [child, setChild] = useState<ChildOut | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth().then((authenticatedUser) => {
      if (!authenticatedUser) router.push('/login')
    })
  }, [])

  useEffect(() => {
    if (!childId) return
    childrenApi.get(childId).then(setChild).catch(() => router.push('/dashboard'))
  }, [childId])

  useEffect(() => {
    if (!child) return
    setLoading(true)
    rankingsApi
      .get(
        child.grade_level,
        scope,
        scope === 'province' ? { province: child.province || undefined } : {},
      )
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [scope, child])

  // Find nearby rank entries (3 above and 3 below child's rank)
  const nearbyEntries = data?.child_own_rank
    ? (data.entries || []).filter(
        (e) =>
          Math.abs(e.rank_position - data.child_own_rank!.rank_position) <= 5 &&
          e.rank_position !== data.child_own_rank!.rank_position,
      )
    : []

  return (
    <div className="min-h-screen bg-background">

      {/* Header */}
      <header className="bg-white border-b border-primary-100 shadow-sm sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href={`/children/${childId}`} className="text-2xl hover:opacity-70 transition">←</Link>
          <div className="flex items-center gap-2">
            <span className="text-xl">🏆</span>
            <h1 className="font-bold text-gray-900">อันดับ</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">

        {/* Scope Tabs */}
        <div className="flex gap-2 mb-4">
          {[
            { key: 'country', label: '🇹🇭 ทั้งประเทศ', sub: 'ประเทศ' },
            { key: 'province', label: '📍 จังหวัด', sub: child?.province || '' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setScope(tab.key as 'country' | 'province')}
              className={`px-4 py-2.5 rounded-xl font-semibold transition-all flex-1 ${
                scope === tab.key
                  ? 'bg-primary-500 text-white shadow-md'
                  : 'bg-white text-gray-600 hover:bg-primary-50 border border-gray-200'
              }`}
            >
              <span className="block text-base">{tab.key === 'country' ? '🇹🇭' : '📍'}</span>
              <span className="text-xs mt-0.5 block">
                {tab.key === 'country' ? 'ทั้งประเทศ' : (child?.province || 'จังหวัด')}
              </span>
            </button>
          ))}
        </div>

        {/* Grade + scope info */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">
            ชั้น ป. {child?.grade_level} · {scope === 'country' ? 'ทั้งประเทศ' : `จังหวัด${child?.province ? ` ${child.province}` : ''}`}
          </p>
        </div>

        {loading ? (
          <div className="card py-16 text-center">
            <div className="text-5xl mb-3 animate-bounce">🏆</div>
            <p className="text-gray-500 font-medium">กำลังโหลดอันดับ...</p>
          </div>
        ) : data?.entries && data.entries.length > 0 ? (
          <div className="space-y-3">

            {/* Top 3 podium */}
            {data.entries.slice(0, 3).length === 3 && (
              <div className="card bg-gradient-to-br from-amber-50 to-primary-50 border-amber-200 mb-6">
                <h3 className="text-center text-sm font-bold text-amber-700 mb-4">🥇 TOP 3 🥇</h3>
                <div className="flex items-end justify-center gap-3">
                  {/* 2nd */}
                  <div className="text-center flex-1">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-gray-200 to-gray-400 flex items-center justify-center text-xl font-black text-white mx-auto shadow border-4 border-white">
                      {data.entries[1].nickname.charAt(0)}
                    </div>
                    <p className="text-xs font-bold text-gray-600 mt-1 truncate">{data.entries[1].nickname}</p>
                    <div className="text-xs text-gray-400">🥈 #{data.entries[1].rank_position}</div>
                  </div>
                  {/* 1st */}
                  <div className="text-center flex-1">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center text-3xl font-black text-white mx-auto shadow-lg border-4 border-white">
                      {data.entries[0].nickname.charAt(0)}
                    </div>
                    <p className="text-sm font-bold text-amber-800 mt-1">{data.entries[0].nickname}</p>
                    <div className="text-xs text-amber-600">🥇 #{data.entries[0].rank_position}</div>
                  </div>
                  {/* 3rd */}
                  <div className="text-center flex-1">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-200 to-orange-400 flex items-center justify-center text-lg font-black text-white mx-auto shadow border-4 border-white">
                      {data.entries[2].nickname.charAt(0)}
                    </div>
                    <p className="text-xs font-bold text-orange-700 mt-1 truncate">{data.entries[2].nickname}</p>
                    <div className="text-xs text-orange-400">🥉 #{data.entries[2].rank_position}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Nearby rank section */}
            {nearbyEntries.length > 0 && (
              <div className="card bg-green-50 border-green-200 mb-4">
                <h3 className="section-title mb-3 text-green-700">🎯 ใกล้เคียงกับคุณ</h3>
                <div className="space-y-2">
                  {nearbyEntries.slice(0, 5).map((entry) => (
                    <div key={`nearby-${entry.child_profile_id}`} className="flex items-center gap-3 p-2 bg-white rounded-xl">
                      <div className="w-8 h-8 bg-secondary-100 rounded-full flex items-center justify-center text-sm font-bold text-secondary-700">
                        #{entry.rank_position}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-800">{entry.nickname}</p>
                        <p className="text-xs text-gray-400">เลเวล {entry.current_level} · {entry.mastery_points.toLocaleString()} คะแนน</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* All entries */}
            <h3 className="section-title mb-3">📊 อันดับทั้งหมด</h3>
            {data.entries.map((entry) => (
              <div
                key={entry.child_profile_id}
                className={`card flex items-center gap-4 transition-all ${
                  entry.child_profile_id === childId
                    ? 'border-primary-400 bg-primary-50 shadow-md ring-2 ring-primary-300'
                    : ''
                }`}
              >
                {/* Rank */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                  entry.rank_position === 1 ? 'bg-amber-100 text-amber-700 border-2 border-amber-300' :
                  entry.rank_position === 2 ? 'bg-gray-100 text-gray-600 border-2 border-gray-300' :
                  entry.rank_position === 3 ? 'bg-orange-100 text-orange-700 border-2 border-orange-300' :
                  'bg-gray-50 text-gray-500 border-2 border-gray-200'
                }`}>
                  {entry.rank_position <= 3 ? ['🥇', '🥈', '🥉'][entry.rank_position - 1] : `#${entry.rank_position}`}
                </div>

                {/* Avatar circle */}
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-200 to-primary-400 flex items-center justify-center text-white text-sm font-black flex-shrink-0">
                  {entry.nickname.charAt(0)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">
                    {entry.nickname}
                    {entry.child_profile_id === childId && (
                      <span className="ml-1.5 text-xs bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded-full font-normal">คุณ</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400">
                    {entry.province || 'ไม่ระบุจังหวัด'} · เลเวล {entry.current_level}
                  </p>
                </div>

                {/* Score */}
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-primary-600">{entry.mastery_points.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">คะแนน</p>
                </div>
              </div>
            ))}

            {/* Own rank highlight */}
            {data.child_own_rank && (
              <div className="mt-4 p-4 bg-gradient-to-r from-primary-100 to-accent-100 border-2 border-primary-300 rounded-2xl text-center shadow-md">
                <p className="text-sm text-primary-700 font-medium">
                  🏆 อันดับของคุณ: <span className="font-extrabold text-primary-900">#{data.child_own_rank.rank_position}</span>
                  {' · '}
                  {data.child_own_rank.mastery_points.toLocaleString()} คะแนน
                  {' · '}
                  เลเวล {data.child_own_rank.current_level}
                </p>
              </div>
            )}

          </div>
        ) : (
          <div className="card py-16 text-center">
            <div className="text-6xl mb-3">🏆</div>
            <h3 className="section-title mb-2">ยังไม่มีอันดับ</h3>
            <p className="text-gray-500 mb-4">เป็นคนแรกที่ทำควิซในระดับนี้!</p>
            <Link href={`/children/${childId}/quiz/new`} className="btn-primary inline-block">
              เริ่มทำควิซแรก →
            </Link>
          </div>
        )}

        {/* Motivation note */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-400">
            💪 ทำควิซสม่ำเสมอ อันดับจะดีขึ้นเรื่อยๆ! อย่ายอมแพ้นะ
          </p>
        </div>
      </main>
    </div>
  )
}
