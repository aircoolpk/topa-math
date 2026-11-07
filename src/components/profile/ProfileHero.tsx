'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import type { ChildOut, RankSummary, Badge } from '@/lib/api/children'
import { AvatarUpload } from '@/components/avatar/AvatarUpload'
import { PhotoAvatar } from '@/components/avatar/PhotoAvatar'
import { ShareModal } from '@/components/share/ShareModal'
import { meApi, type ShareResponse } from '@/lib/api/me'
import { xpLevelProgress } from '@/lib/utils'

interface Props {
  child: ChildOut
  rankSummary?: RankSummary | null
  badges?: Badge[]
  onAvatarUpdate?: (avatarUrl: string) => void
}

// ─── Avatar character SVG ──────────────────────────────────────────────────────

export function AvatarCharacter({
  gender,
  size = 'xl',
}: {
  gender: 'girl' | 'boy'
  size?: 'sm' | 'lg' | 'xl'
}) {
  const sizeClass =
    size === 'xl' ? 'w-44 h-44' :
    size === 'lg' ? 'w-20 h-20' : 'w-10 h-10'

  if (gender === 'boy') {
    return (
      <div className={`${sizeClass} rounded-3xl bg-gradient-to-br from-blue-200 via-blue-100 to-sky-200 flex flex-col items-center justify-center shadow-xl border-4 border-white relative overflow-hidden`}>
        <div className="absolute top-1 flex gap-0.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`w-2.5 h-3 bg-amber-700 rounded-sm ${i === 1 ? '-mt-1.5' : ''}`} />
          ))}
        </div>
        <div className="w-[60%] h-[55%] rounded-full bg-yellow-100 border-2 border-yellow-200 relative flex items-center justify-center shadow-inner -mt-2">
          <div className="absolute top-[30%] flex gap-3">
            <div className="w-2.5 h-2.5 bg-gray-800 rounded-full flex items-center justify-center"><div className="w-1 h-1 bg-white rounded-full" /></div>
            <div className="w-2.5 h-2.5 bg-gray-800 rounded-full flex items-center justify-center"><div className="w-1 h-1 bg-white rounded-full" /></div>
          </div>
          <div className="absolute bottom-[22%] w-4 h-2 border-b-2 border-yellow-800 rounded-b-full" />
          <div className="absolute top-[38%] left-0.5 w-2.5 h-1.5 bg-pink-200 rounded-full opacity-60" />
          <div className="absolute top-[38%] right-0.5 w-2.5 h-1.5 bg-pink-200 rounded-full opacity-60" />
        </div>
        <div className="w-[80%] h-[28%] -mt-1 rounded-t-2xl bg-blue-400 border-t-2 border-l-2 border-r-2 border-blue-300 relative">
          <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white/30 rounded-full" />
        </div>
      </div>
    )
  }

  return (
    <div className={`${sizeClass} rounded-3xl bg-gradient-to-br from-pink-100 via-rose-100 to-fuchsia-100 flex flex-col items-center justify-center shadow-xl border-4 border-white relative overflow-hidden`}>
      <div className="absolute top-1 left-2 right-2 h-7 bg-amber-600 rounded-t-full" />
      <div className="absolute top-[22%] left-0 w-3 h-10 bg-amber-600 rounded-l-full" />
      <div className="absolute top-[22%] right-0 w-3 h-10 bg-amber-600 rounded-r-full" />
      <div className="w-[60%] h-[55%] rounded-full bg-yellow-50 border-2 border-yellow-200 relative flex items-center justify-center shadow-inner -mt-2">
        <div className="absolute top-[30%] flex gap-3">
          <div className="w-2.5 h-2.5 bg-gray-800 rounded-full flex items-center justify-center"><div className="w-1 h-1 bg-white rounded-full" /></div>
          <div className="w-2.5 h-2.5 bg-gray-800 rounded-full flex items-center justify-center"><div className="w-1 h-1 bg-white rounded-full" /></div>
        </div>
        <div className="absolute bottom-[22%] w-4 h-2 border-b-2 border-yellow-800 rounded-b-full" />
        <div className="absolute top-[40%] left-0.5 w-2.5 h-1.5 bg-pink-200 rounded-full opacity-70" />
        <div className="absolute top-[40%] right-0.5 w-2.5 h-1.5 bg-pink-200 rounded-full opacity-70" />
      </div>
      <div className="w-[80%] h-[28%] -mt-1 rounded-t-2xl bg-pink-400 border-t-2 border-l-2 border-r-2 border-pink-300 relative">
        <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white/30 rounded-full" />
      </div>
    </div>
  )
}

// ─── Rank title badge ─────────────────────────────────────────────────────────

/**
 * Keys MUST match `apps/api/app/services/rank_titles.py`:
 * เด็กหลังห้อง / เด็กนักเรียน / เด็กเก่ง / เด็กหัวแถว / หัวหน้าห้อง / ประธานรุ่น / เด็กอัจฉริยะ
 */
const RANK_CONFIG: Record<string, { emoji: string; bg: string; text: string }> = {
  'เด็กหลังห้อง':  { emoji: '🌱', bg: 'bg-green-100', text: 'text-green-700' },
  'เด็กนักเรียน':  { emoji: '🐣', bg: 'bg-lime-100', text: 'text-lime-700' },
  'เด็กเก่ง':     { emoji: '🧠', bg: 'bg-blue-100', text: 'text-blue-700' },
  'เด็กหัวแถว':   { emoji: '⚔️', bg: 'bg-purple-100', text: 'text-purple-700' },
  'หัวหน้าห้อง':   { emoji: '🏆', bg: 'bg-amber-100', text: 'text-amber-800' },
  'ประธานรุ่น':    { emoji: '👑', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  'เด็กอัจฉริยะ':  { emoji: '💎', bg: 'bg-pink-100', text: 'text-pink-700' },
}

const DEFAULT_RANK_TITLE = 'เด็กหลังห้อง'

function RankBadge({ rank }: { rank: string }) {
  const cfg = RANK_CONFIG[rank] ?? { emoji: '⭐', bg: 'bg-gray-100', text: 'text-gray-600' }
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${cfg.bg} ${cfg.text}`}>
      {cfg.emoji} {rank}
    </span>
  )
}

// ─── Stat pill ─────────────────────────────────────────────────────────────────

function StatPill({ emoji, label, value, color = 'text-gray-700' }: {
  emoji: string; label: string; value: string | number; color?: string
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-base">{emoji}</span>
      <span className={`text-sm font-bold ${color}`}>{value}</span>
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  )
}

// ─── Badge item ───────────────────────────────────────────────────────────────

/**
 * Client-side Thai fallback for the legacy English badge payload.
 * The backend is moving to `name_th`; this keeps the UI Thai until then.
 */
const BADGE_NAME_TH: Record<string, string> = {
  'first-lesson': 'บทเรียนแรก',
  'streak-3': 'ต่อเนื่อง 3 วัน',
  'streak-7': 'ต่อเนื่อง 7 วัน',
  'addition-hero': 'ผู้เชี่ยวชาญการบวก',
  'speed-star': 'ดาวความเร็ว',
  'improvement-champion': 'แชมป์การพัฒนา',
}

function badgeLabel(badge: Badge): string {
  return (
    badge.name_th?.trim() ||
    BADGE_NAME_TH[badge.code]?.trim() ||
    badge.name?.trim() ||
    badge.code
  )
}

function badgeIcon(badge: Badge): string {
  return badge.icon?.trim() || badge.icon_url?.trim() || '🏅'
}

function BadgeItem({ badge }: { badge: Badge }) {
  const icon = badgeIcon(badge)
  const isImage = icon.startsWith('http://') || icon.startsWith('https://') || icon.startsWith('/')
  return (
    <div className="flex flex-col items-center gap-1 p-2 w-16">
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center text-lg shadow-sm border-2 border-white">
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={icon} alt="" className="w-6 h-6 object-contain" />
        ) : (
          icon
        )}
      </div>
      <span className="text-xs text-gray-600 font-medium text-center leading-tight line-clamp-2">
        {badgeLabel(badge)}
      </span>
    </div>
  )
}

// ─── XP progress bar ──────────────────────────────────────────────────────────

function XPBar({ child, rankSummary }: { child: ChildOut; rankSummary?: RankSummary | null }) {
  const totalXp = child.total_xp ?? 0
  // Local fallback mirrors `apps/api/app/services/xp.py` (ceil(100 * level ** 1.35)).
  const local = xpLevelProgress(totalXp)

  const xpIntoLevel = rankSummary?.xp_into_level ?? local.xpIntoLevel
  const xpNeeded = rankSummary?.xp_needed_for_next_level ?? local.xpNeededForNextLevel
  const percent = xpNeeded > 0
    ? Math.min(100, Math.max(0, (xpIntoLevel / xpNeeded) * 100))
    : 0

  const level = rankSummary?.level ?? local.level
  const xpToNextRank = rankSummary?.xp_to_next_rank ?? local.xpToNextLevel
  const nextRankName = rankSummary?.next_rank ?? 'ระดับถัดไป'

  return (
    <div className="w-full max-w-xs">
      <div className="flex justify-between items-baseline text-xs text-gray-500 mb-1.5 gap-2">
        <span className="font-medium whitespace-nowrap">XP {totalXp.toLocaleString()}</span>
        <span className="font-bold text-right">
          {xpToNextRank} XP สู่ {nextRankName}
        </span>
      </div>
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full shadow-sm transition-all duration-700"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-[11px] text-gray-400 mt-1">
        เลเวล {level} · {xpIntoLevel}/{xpNeeded} XP ของเลเวลนี้
      </p>
    </div>
  )
}

// ─── Share card preview ───────────────────────────────────────────────────────

function ShareCardPreview({ child, onShare }: { child: ChildOut; onShare: () => void }) {
  return (
    <div className="bg-gradient-to-br from-primary-500 to-accent-500 rounded-2xl p-4 text-white shadow-lg">
      <div className="flex items-center gap-3 mb-3">
        <PhotoAvatar
          studentPhotoUrl={child.student_photo_url}
          avatarGender={child.avatar_gender}
          size="sm"
        />
        <div className="flex-1 min-w-0">
          <p className="font-extrabold text-sm leading-tight truncate">{child.nickname}</p>
          <p className="text-xs text-white/70 truncate">{child.school_name ?? 'โรงเรียนของเรา'}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="bg-white/20 text-xs font-semibold px-2 py-0.5 rounded-full">
              🎮 {child.total_score.toLocaleString()} คะแนน
            </span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-xl font-black">{child.current_level}</div>
          <div className="text-xs text-white/60">เลเวล</div>
        </div>
      </div>

      <button
        onClick={onShare}
        className="w-full bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white text-sm font-bold py-2 rounded-xl transition-all flex items-center justify-center gap-2"
      >
        📤 แชร์การ์ดอวดเพื่อน
      </button>
    </div>
  )
}

// ─── Floating stat badge ───────────────────────────────────────────────────────

function FloatingStat({ emoji, value, label, className = '' }: {
  emoji: string; value: string | number; label: string; className?: string
}) {
  return (
    <div className={`absolute bg-white rounded-2xl shadow-lg px-3 py-1.5 flex items-center gap-2 whitespace-nowrap ${className}`}>
      <span className="text-lg leading-none">{emoji}</span>
      <div className="flex flex-col">
        <span className="text-sm font-black text-gray-800 leading-tight">{value}</span>
        <span className="text-xs text-gray-400">{label}</span>
      </div>
    </div>
  )
}

// ─── Main ProfileHero ─────────────────────────────────────────────────────────

export default function ProfileHero({ child, rankSummary, badges = [], onAvatarUpdate }: Props) {
  const avatarGender: 'girl' | 'boy' = child.avatar_gender === 'boy' ? 'boy' : 'girl'
  const [shareOpen, setShareOpen] = useState(false)
  const [shareData, setShareData] = useState<ShareResponse | null>(null)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)

  function handleAvatarSuccess(avatarUrl: string) {
    onAvatarUpdate?.(avatarUrl)
  }

  // Rank title NAME — the child profile returns `current_rank_title`,
  // the rank summary returns `current_rank` / `rank_title`.
  const rankTitle =
    child.current_rank_title?.trim() ||
    child.rank_title?.trim() ||
    rankSummary?.current_rank?.trim() ||
    rankSummary?.rank_title?.trim() ||
    DEFAULT_RANK_TITLE

  // Only badges the child actually earned.
  const earnedBadges = badges.filter((badge) => badge.earned !== false)

  // Province/country position are NUMBERS — `current_rank` is the rank title name.
  const provinceRank = typeof rankSummary?.province_rank === 'number' ? rankSummary.province_rank : null
  const countryRank = typeof rankSummary?.country_rank === 'number' ? rankSummary.country_rank : null

  // Cache the share payload — opening the sheet must not POST every time.
  const openShareSheet = useCallback(async () => {
    setShareOpen(true)
    if (shareData) return
    setShareLoading(true)
    setShareError(null)
    try {
      const response = await meApi.createDashboardShare()
      setShareData(response)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ไม่สามารถสร้างลิงก์แชร์ได้'
      setShareError(message)
    } finally {
      setShareLoading(false)
    }
  }, [shareData])

  return (
    <div className="w-full">
      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        share={shareData}
        loading={shareLoading}
        error={shareError}
        title="TOPA Math"
        text="มาเรียนเลขสนุก ๆ กับ TOPA Math กันนะ"
      />

      {/* ── TWO COLUMN GAME LAYOUT ── */}
      <div className="flex flex-col lg:flex-row gap-6">

        {/* ═══ LEFT: Student Info Card ═══ */}
        <div className="flex-1 bg-white rounded-2xl shadow-lg p-6 border border-gray-100">

          {/* Header: Avatar + Name */}
          <div className="flex items-start gap-4 mb-5">
            <PhotoAvatar
              studentPhotoUrl={child.student_photo_url}
              avatarGender={avatarGender}
              size="lg"
            />
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-extrabold text-gray-800 leading-tight break-words">
                {child.first_name || ''} {child.last_name || ''}
                {!child.first_name && !child.last_name ? child.nickname : ''}
              </h1>
              {child.nickname && (
                <p className="text-sm text-gray-500 mt-0.5">ชื่อเล่น: {child.nickname}</p>
              )}
              <div className="mt-2">
                <RankBadge rank={rankTitle} />
              </div>
            </div>
          </div>

          {/* School + Grade */}
          <div className="bg-gray-50 rounded-xl p-3 mb-5">
            <div className="flex items-center gap-2 text-sm text-gray-600 flex-wrap">
              <span>🏫</span>
              <span>{child.school_name ?? 'ไม่ระบุโรงเรียน'}</span>
              <span className="text-gray-300">•</span>
              <span>ระดับชั้น ป.{child.grade_level}</span>
            </div>
          </div>

          {/* THP / EP Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <Link
              href={`/children/${child.id}/avatar`}
              className="flex-1 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white text-sm font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md whitespace-nowrap"
            >
              🎨 แต่งตัวละคร (THP)
            </Link>
            <Link
              href={`/children/${child.id}/rankings`}
              className="flex-1 bg-gradient-to-r from-accent-500 to-accent-600 hover:from-accent-600 hover:to-accent-700 text-white text-sm font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md whitespace-nowrap"
            >
              📝 อันดับ (EP)
            </Link>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-3 text-center border border-amber-200">
              <div className="text-2xl mb-1">🪙</div>
              <div className="text-lg font-black text-amber-700">{child.coins?.toLocaleString() ?? 0}</div>
              <div className="text-xs text-amber-600">เหรียญ</div>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-3 text-center border border-blue-200">
              <div className="text-2xl mb-1">⭐</div>
              <div className="text-lg font-black text-blue-700">{child.total_xp?.toLocaleString() ?? 0}</div>
              <div className="text-xs text-blue-600">XP</div>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-3 text-center border border-orange-200">
              <div className="text-2xl mb-1">🔥</div>
              <div className="text-lg font-black text-orange-700">{child.streak_count ?? 0}</div>
              <div className="text-xs text-orange-600">วันต่อเนื่อง</div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-3 text-center border border-green-200">
              <div className="text-2xl mb-1">📅</div>
              <div className="text-lg font-black text-green-700">{child.days_active ?? 0}</div>
              <div className="text-xs text-green-600">วันเข้าเรียน</div>
            </div>
          </div>

          {/* Level + Score Row */}
          <div className="flex items-center gap-4 mb-5">
            <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-xl px-4 py-2">
              <span className="text-2xl">🎮</span>
              <div>
                <div className="text-sm font-black text-purple-700">เลเวล {child.current_level}</div>
                <div className="text-xs text-purple-500">{child.total_score?.toLocaleString() ?? 0} คะแนน</div>
              </div>
            </div>
          </div>

          {/* XP Bar */}
          <XPBar child={child} rankSummary={rankSummary} />

        </div>

        {/* ═══ RIGHT: Avatar Panel ═══ */}
        <div className="w-full lg:w-96 relative">

          {/* Game Card Background — overflow-visible so floating badges are never clipped */}
          <div className="bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 rounded-2xl shadow-lg p-6 border border-purple-200 relative">

            {/* Decorative circles (clipped by their own layer, not the whole card) */}
            <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none" aria-hidden>
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-200 rounded-full opacity-20 -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-pink-200 rounded-full opacity-20 translate-y-1/2 -translate-x-1/2" />
            </div>

            {/* Large Avatar Centered */}
            <div className="flex justify-center mb-4 relative z-10">
              <PhotoAvatar
                studentPhotoUrl={child.student_photo_url}
                avatarGender={avatarGender}
                size="xl"
              />
            </div>

            {/* Floating Status Badges — anchored INSIDE the card padding box (never clipped) */}
            <FloatingStat
              emoji="🪙"
              value={child.coins?.toLocaleString() ?? 0}
              label="เหรียญ"
              className="top-6 left-6 z-20"
            />
            <FloatingStat
              emoji="⭐"
              value={child.total_xp?.toLocaleString() ?? 0}
              label="XP"
              className="top-6 right-6 z-20"
            />

            {/* Rank + Nickname */}
            <div className="text-center mb-4 relative z-10">
              <div className="text-sm font-bold text-gray-500 mb-1">
                {child.nickname ?? child.first_name}
              </div>
              <RankBadge rank={rankTitle} />
            </div>

            {/* Level + Streak row — normal flow so it can never cover the share card */}
            <div className="flex items-center justify-center gap-3 mb-4 relative z-10">
              <div className="flex items-center gap-1.5 bg-white/80 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm border border-purple-100 whitespace-nowrap">
                <span className="text-base leading-none">🎮</span>
                <span className="text-sm font-black text-gray-800">{child.current_level}</span>
                <span className="text-xs text-gray-500">เลเวล</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/80 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm border border-purple-100 whitespace-nowrap">
                <span className="text-base leading-none">🔥</span>
                <span className="text-sm font-black text-gray-800">{child.streak_count ?? 0}</span>
                <span className="text-xs text-gray-500">วันต่อเนื่อง</span>
              </div>
            </div>

            {/* Province / Country Rank Pills */}
            <div className="flex flex-wrap justify-center gap-3 mb-4 relative z-10">
              <div className="bg-white/80 backdrop-blur-sm rounded-full px-4 py-1.5 shadow-sm border border-purple-100">
                <span className="text-xs font-bold text-purple-700 whitespace-nowrap">
                  🌏 อันดับจังหวัด: {provinceRank !== null ? `#${provinceRank}` : '-'}
                </span>
              </div>
              {countryRank !== null && (
                <div className="bg-white/80 backdrop-blur-sm rounded-full px-4 py-1.5 shadow-sm border border-purple-100">
                  <span className="text-xs font-bold text-purple-700 whitespace-nowrap">
                    🇹🇭 อันดับประเทศ: #{countryRank}
                  </span>
                </div>
              )}
            </div>

            {/* Action Buttons — the single upload button on this page */}
            <div className="flex flex-col sm:flex-row gap-3 mb-5 relative z-10">
              <div className="flex-1 flex justify-center">
                <AvatarUpload
                  childId={child.id}
                  currentAvatarUrl={child.student_photo_url ?? ''}
                  onUploadSuccess={handleAvatarSuccess}
                />
              </div>
              <button
                onClick={openShareSheet}
                className="flex-1 bg-gradient-to-r from-accent-500 to-accent-600 hover:from-accent-600 hover:to-accent-700 text-white text-sm font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md whitespace-nowrap"
              >
                📤 แชร์โปรไฟล์
              </button>
            </div>

            {/* Badges Section */}
            {earnedBadges.length > 0 && (
              <div className="bg-white/60 backdrop-blur-sm rounded-xl p-3 mb-4 border border-white/80 relative z-10">
                <p className="text-xs text-gray-600 font-semibold mb-2 text-center">
                  🏅 เหรียญที่ได้รับ ({earnedBadges.length})
                </p>
                <div className="flex flex-wrap justify-center gap-1">
                  {earnedBadges.slice(0, 8).map(badge => (
                    <BadgeItem key={badge.code || badge.id} badge={badge} />
                  ))}
                  {earnedBadges.length > 8 && (
                    <div className="flex flex-col items-center gap-1 p-2 w-16">
                      <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-sm font-bold text-purple-700 border-2 border-white">
                        +{earnedBadges.length - 8}
                      </div>
                      <span className="text-xs text-gray-400">เหรียญ</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Share Card Preview */}
            <div className="relative z-10">
              <ShareCardPreview child={child} onShare={openShareSheet} />
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}
