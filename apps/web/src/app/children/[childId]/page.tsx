'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/auth'
import { childrenApi, type ChildOut, type RankSummary, type Badge, type RecommendedNextQuest } from '@/lib/api/children'
import { learningApi, type CourseMapResponse, type CourseMapItem } from '@/lib/api/learning'
import ProfileHero from '@/components/profile/ProfileHero'
import QuestSection from '@/components/quest/QuestSection'
import { gradeLabel } from '@/lib/utils'
import { TopaBrandMark } from '@/components/brand/TopaBrand'
import { AvatarUpload } from '@/components/avatar/AvatarUpload'

// ─── Recommendation Cards ─────────────────────────────────────────────────────

const SKILL_ICON_MAP: Record<string, string> = {
  addition: '🧮', subtraction: '➖', multiplication: '✖️', division: '➗',
  word_problem: '📖', word_problems: '📖', speed: '⚡', accuracy: '🎯',
  fractions: '🔢', decimals: '🔟', percentages: '💯',
  shapes: '⬜', measurement: '📏', time: '⏰', money: '💰', data: '📊',
  patterns: '🔣', algebra: '🔢', geometry: '📐', default: '⭐',
}

function getSkillIcon(skillCode?: string | null) {
  if (!skillCode) return SKILL_ICON_MAP.default
  return SKILL_ICON_MAP[skillCode?.toLowerCase()] ?? SKILL_ICON_MAP.default
}

interface RecommendationCardProps {
  icon: string
  title: string
  description: string | null | undefined
  xpReward: number
  coinReward: number
  estimatedMinutes?: number | null
  lessonId?: string | null
  questId?: string | null
  childId: string
  badge?: string
  badgeColor?: string
  linkHref?: string
}

function RecommendationCard({
  icon, title, description, xpReward, coinReward,
  estimatedMinutes, lessonId, questId, childId,
  badge, badgeColor = 'bg-accent-100 text-accent-700',
  linkHref,
}: RecommendationCardProps) {
  const href = linkHref ?? (
    lessonId
      ? `/children/${childId}/quiz/${lessonId}`
      : `/children/${childId}/quiz/new?quest=${questId}`
  )

  return (
    <div className="rounded-2xl border-2 border-accent-200 bg-gradient-to-br from-accent-50 to-white p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-2xl bg-accent-100 border border-accent-200 flex items-center justify-center text-2xl flex-shrink-0 shadow-sm">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            {badge && (
              <span className={`badge ${badgeColor} text-xs font-bold`}>{badge}</span>
            )}
          </div>
          <h4 className="font-bold text-gray-900 text-sm leading-tight">{title}</h4>
          {description && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{description}</p>
          )}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className="badge bg-primary-100 text-primary-700 text-xs font-semibold">+{xpReward} XP</span>
            <span className="badge bg-amber-100 text-amber-700 text-xs font-semibold">🪙 +{coinReward}</span>
            {estimatedMinutes != null && (
              <span className="badge bg-gray-100 text-gray-500 text-xs">⏱️ {estimatedMinutes} นาที</span>
            )}
          </div>
        </div>
        <Link
          href={href}
          className="flex-shrink-0 px-4 py-1.5 bg-accent-500 hover:bg-accent-600 text-white text-sm font-bold rounded-xl transition-all shadow-md hover:shadow-lg"
        >
          เริ่มฝึก
        </Link>
      </div>
    </div>
  )
}

// ─── Recommendations Section ─────────────────────────────────────────────────

function RecommendationsSection({
  recommendedQuest,
  courseMap,
  childId,
  childGrade,
}: {
  recommendedQuest: RecommendedNextQuest | null
  courseMap: CourseMapResponse | null
  childId: string
  childGrade: number
}) {
  // Derive available lessons from course map (unlocked, not completed)
  const availableLessons = courseMap?.items.filter(
    item => item.status === 'available' && item.grade === childGrade
  ) ?? []

  // Card 1: Weak skill / recommended lesson
  const weakSkillLesson = availableLessons[0] ?? null

  // Card 2: Main recommended quest (from API)
  const mainQuest = recommendedQuest

  // Card 3: Daily challenge — use next available lesson or fallback
  const dailyChallengeLesson = availableLessons[1] ?? weakSkillLesson

  const hasAnyRecommendation = weakSkillLesson || mainQuest || dailyChallengeLesson

  // Fallback title for when no quest data
  const fallbackTitle = `📚 บทเรียน ป.${childGrade}`

  return (
    <div className="mb-6">
      <h2 className="text-lg font-extrabold text-gray-900 mb-3">✨ ระบบแนะนำสำหรับวันนี้</h2>

      {!hasAnyRecommendation ? (
        // Fallback when no recommendation data — encouraging card with no mock text
        <div className="rounded-2xl border-2 border-accent-200 bg-gradient-to-br from-accent-50 to-white p-5 text-center">
          <div className="text-4xl mb-2">🎯</div>
          <h3 className="font-bold text-gray-900 mb-1">พร้อมเริ่มฝึกหรือยัง?</h3>
          <p className="text-sm text-gray-500">
            เลือกบทเรียนด้านล่างเพื่อเริ่มฝึกฝนวันนี้
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Weak Skill Practice */}
          {weakSkillLesson ? (
            <RecommendationCard
              icon={getSkillIcon(weakSkillLesson.skill_code)}
              title={weakSkillLesson.title}
              description={weakSkillLesson.skill_code}
              xpReward={weakSkillLesson.xp_reward}
              coinReward={Math.floor(weakSkillLesson.xp_reward * 0.3)}
              lessonId={weakSkillLesson.lesson_id}
              childId={childId}
              badge="📌 ฝึกจุดอ่อน"
              badgeColor="bg-rose-100 text-rose-700"
            />
          ) : mainQuest ? (
            <RecommendationCard
              icon={getSkillIcon(mainQuest.skill_code)}
              title={mainQuest.title}
              description={mainQuest.description}
              xpReward={mainQuest.xp_reward}
              coinReward={mainQuest.coin_reward}
              estimatedMinutes={mainQuest.estimated_minutes}
              lessonId={mainQuest.lesson_id}
              questId={mainQuest.quest_id}
              childId={childId}
              badge="📌 ฝึกจุดอ่อน"
              badgeColor="bg-rose-100 text-rose-700"
            />
          ) : (
            <RecommendationCard
              icon="📚"
              title={fallbackTitle}
              description="เลือกบทเรียนที่ต้องการฝึกฝน"
              xpReward={50}
              coinReward={15}
              childId={childId}
              linkHref={`/children/${childId}/quiz/new`}
              badge="📌 ฝึกจุดอ่อน"
              badgeColor="bg-rose-100 text-rose-700"
            />
          )}

          {/* Card 2: Recommended Lesson */}
          {mainQuest ? (
            <RecommendationCard
              icon={getSkillIcon(mainQuest.skill_code)}
              title={mainQuest.title}
              description={mainQuest.description}
              xpReward={mainQuest.xp_reward}
              coinReward={mainQuest.coin_reward}
              estimatedMinutes={mainQuest.estimated_minutes}
              lessonId={mainQuest.lesson_id}
              questId={mainQuest.quest_id}
              childId={childId}
              badge="✨ แนะนำ"
              badgeColor="bg-accent-100 text-accent-700"
            />
          ) : weakSkillLesson ? (
            <RecommendationCard
              icon={getSkillIcon(weakSkillLesson.skill_code)}
              title={weakSkillLesson.title}
              description={weakSkillLesson.skill_code}
              xpReward={weakSkillLesson.xp_reward}
              coinReward={Math.floor(weakSkillLesson.xp_reward * 0.3)}
              lessonId={weakSkillLesson.lesson_id}
              childId={childId}
              badge="✨ แนะนำ"
              badgeColor="bg-accent-100 text-accent-700"
            />
          ) : (
            <RecommendationCard
              icon="📖"
              title={fallbackTitle}
              description="บทเรียนที่แนะนำสำหรับคุณ"
              xpReward={50}
              coinReward={15}
              childId={childId}
              linkHref={`/children/${childId}/quiz/new`}
              badge="✨ แนะนำ"
              badgeColor="bg-accent-100 text-accent-700"
            />
          )}

          {/* Card 3: Daily Challenge */}
          {dailyChallengeLesson ? (
            <RecommendationCard
              icon="⚡"
              title="🔥 เควสประจำวัน"
              description={dailyChallengeLesson.title}
              xpReward={dailyChallengeLesson.xp_reward}
              coinReward={Math.floor(dailyChallengeLesson.xp_reward * 0.5)}
              lessonId={dailyChallengeLesson.lesson_id}
              childId={childId}
              badge="🔥 ด่วน"
              badgeColor="bg-amber-100 text-amber-700"
            />
          ) : (
            <RecommendationCard
              icon="⚡"
              title="🔥 เควสประจำวัน"
              description={fallbackTitle}
              xpReward={75}
              coinReward={20}
              childId={childId}
              linkHref={`/children/${childId}/quiz/new`}
              badge="🔥 ด่วน"
              badgeColor="bg-amber-100 text-amber-700"
            />
          )}
        </div>
      )}
    </div>
  )
}

// ─── Course Map Section ─────────────────────────────────────────────────────────

function CourseMapSection({
  courseMap,
  membership,
  childId,
  childGrade,
}: {
  courseMap: CourseMapResponse | null
  membership: 'free' | 'basic' | 'plus' | 'family'
  childId: string
  childGrade: number
}) {
  const [activeTab, setActiveTab] = useState<'current' | 'review'>('current')
  const canAccessPaid = membership !== 'free'

  // Build items by grade from course map
  const allGrades = courseMap
    ? [...new Set(courseMap.items.map(i => i.grade))].sort((a, b) => a - b)
    : []

  // Current grade items: grade === childGrade
  const currentGradeItems: CourseMapItem[] =
    courseMap?.items.filter(i => i.grade === childGrade) ?? []

  // Review grade items: grade < childGrade (previous grades)
  const reviewItems: CourseMapItem[] =
    courseMap?.items.filter(i => i.grade < childGrade) ?? []

  const displayItems = activeTab === 'current' ? currentGradeItems : reviewItems

  function AccessBadge({ status }: { status: CourseMapItem['status'] }) {
    if (status === 'completed') {
      return <span className="badge bg-green-100 text-green-700 text-xs font-bold">✅ เสร็จแล้ว</span>
    }
    if (status === 'available') {
      return <span className="badge bg-primary-100 text-primary-700 text-xs font-bold">🔓 พร้อมเล่น</span>
    }
    return <span className="badge bg-gray-100 text-gray-400 text-xs font-bold">🔒 ล็อก</span>
  }

  function LessonCard({ item }: { item: CourseMapItem }) {
    const isClickable = item.status !== 'locked' && (item.status === 'available' || item.status === 'completed')
    const isPaidContent = item.grade === childGrade // current grade = paid
    const needsMembership = isPaidContent && !canAccessPaid

    return (
      <div
        className={
          isClickable && !needsMembership
            ? 'rounded-2xl border-2 border-primary-100 bg-gradient-to-br from-white to-primary-50 p-4 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 hover:border-primary-300 transition-all'
            : item.status === 'locked'
            ? 'rounded-2xl border-2 border-gray-200 bg-gray-50 p-4 opacity-60'
            : 'rounded-2xl border-2 border-amber-100 bg-gradient-to-br from-white to-amber-50 p-4'
        }
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h4 className={`font-bold text-sm leading-tight ${item.status === 'locked' ? 'text-gray-400' : 'text-gray-900'}`}>
                {item.title}
              </h4>
              {item.grade < childGrade && (
                <span className="badge bg-blue-100 text-blue-700 text-xs font-semibold">📖 ทบทวน</span>
              )}
              {item.grade === childGrade && (
                <span className="badge bg-primary-100 text-primary-700 text-xs font-semibold">📚 ปัจจุบัน</span>
              )}
            </div>
            <p className="text-xs text-gray-400">📐 {item.skill_code}</p>
          </div>
          <AccessBadge status={item.status} />
        </div>

        <div className="flex items-center justify-between">
          <span className={`badge text-xs font-bold ${item.status === 'locked' ? 'bg-gray-100 text-gray-400' : 'bg-primary-100 text-primary-700'}`}>
            +{item.xp_reward} XP
          </span>
          {item.status === 'locked' ? (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              🔒 ล็อก — ต้องเรียนบทก่อนหน้า
            </span>
          ) : needsMembership ? (
            <span className="text-xs text-amber-600 flex items-center gap-1 font-semibold">
              ⭐ สมัครเป็นสมาชิกเพื่อเล่น
            </span>
          ) : item.status === 'completed' ? (
            <span className="text-xs text-green-600 font-bold flex items-center gap-1">
              ✅ เรียนแล้ว
            </span>
          ) : (
            <Link
              href={item.lesson_id
                ? `/children/${childId}/quiz/${item.lesson_id}`
                : `/children/${childId}/quiz/new?lesson=${item.lesson_id}`
              }
              className="text-xs bg-primary-500 hover:bg-primary-600 text-white font-bold px-3 py-1.5 rounded-xl transition-colors shadow-sm"
            >
              เริ่มเรียน →
            </Link>
          )}
        </div>
      </div>
    )
  }

  const currentCount = currentGradeItems.filter(i => i.status !== 'locked').length
  const reviewCount = reviewItems.filter(i => i.status !== 'locked').length

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-extrabold text-gray-900">📚 บทเรียน</h2>
        {membership === 'free' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 text-xs text-amber-700 font-semibold">
            ⭐ สมัครเป็นสมาชิกเพื่อปลดล็อกบทเรียน ป.{childGrade}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('current')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all shadow-sm ${
            activeTab === 'current'
              ? 'bg-primary-500 text-white shadow-md'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-primary-50 hover:border-primary-300'
          }`}
        >
          📚 บทเรียนปัจจุบัน
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
            activeTab === 'current' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
          }`}>{currentCount}</span>
        </button>
        <button
          onClick={() => setActiveTab('review')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all shadow-sm ${
            activeTab === 'review'
              ? 'bg-primary-500 text-white shadow-md'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-primary-50 hover:border-primary-300'
          }`}
        >
          📖 บททบทวน
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
            activeTab === 'review' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
          }`}>{reviewCount}</span>
        </button>
      </div>

      {/* Content */}
      {displayItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-300">
          <div className="text-4xl">📚</div>
          <p className="text-sm text-gray-500 font-medium">
            {activeTab === 'current' ? 'ยังไม่มีบทเรียนสำหรับระดับชั้นนี้' : 'ยังไม่มีบทเรียนทบทวน'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayItems.map((item) => (
            <LessonCard key={item.skill_code} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function ChildDashboardPage() {
  const params = useParams()
  const childId = params.childId as string
  const router = useRouter()
  const { checkAuth } = useAuthStore()

  const [child, setChild] = useState<ChildOut | null>(null)
  const [rankSummary, setRankSummary] = useState<RankSummary | null>(null)
  const [badges, setBadges] = useState<Badge[]>([])
  const [recommendedQuest, setRecommendedQuest] = useState<RecommendedNextQuest | null>(null)
  const [courseMap, setCourseMap] = useState<CourseMapResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [courseMapLoading, setCourseMapLoading] = useState(false)

  // Auth check
  useEffect(() => {
    checkAuth().then((authenticatedUser) => {
      if (!authenticatedUser) router.push('/login')
    })
  }, [])

  // Fetch child profile
  useEffect(() => {
    if (!childId) return
    childrenApi.get(childId)
      .then(setChild)
      .catch(() => {
        // Graceful fallback — show error but don't crash
        console.warn('Failed to load child profile from backend')
      })
      .finally(() => setLoading(false))
  }, [childId])

  // Fetch rank summary
  useEffect(() => {
    if (!childId) return
    childrenApi.getRankSummary(childId)
      .then(setRankSummary)
      .catch(() => { /* silent */ })
  }, [childId])

  // Fetch badges
  useEffect(() => {
    if (!childId) return
    childrenApi.getBadges(childId)
      .then(setBadges)
      .catch(() => { /* silent */ })
  }, [childId])

  // Fetch recommended next quest
  useEffect(() => {
    if (!childId) return
    childrenApi.getRecommendedNextQuest(childId)
      .then(setRecommendedQuest)
      .catch(() => { /* silent */ })
  }, [childId])

  // Fetch course map
  useEffect(() => {
    if (!childId) return
    setCourseMapLoading(true)
    learningApi.getCourseMap(childId)
      .then(setCourseMap)
      .catch(() => { /* silent — course map may not exist yet */ })
      .finally(() => setCourseMapLoading(false))
  }, [childId])

  // Refresh child profile + rank summary + recommended quest after quest complete
  const handleQuestComplete = useCallback(async () => {
    if (!childId) return
    try {
      const updated = await childrenApi.get(childId)
      setChild(updated)
    } catch { /* silent */ }
    try {
      const summary = await childrenApi.getRankSummary(childId)
      setRankSummary(summary)
    } catch { /* silent */ }
    try {
      const rec = await childrenApi.getRecommendedNextQuest(childId)
      setRecommendedQuest(rec)
    } catch { /* silent */ }
  }, [childId])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">🎮</div>
          <p className="text-gray-500 font-medium">กำลังโหลด...</p>
        </div>
      </div>
    )
  }

  if (!child) return null

  return (
    <div className="min-h-screen bg-background">

      {/* ── HEADER ── */}
      <header className="bg-white border-b border-primary-100 shadow-sm sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/dashboard" className="text-2xl hover:opacity-70 transition">←</Link>
          <div className="flex-1">
            <TopaBrandMark />
          </div>
          <AvatarUpload
            childId={childId}
            currentAvatarUrl={child.student_photo_url}
            onUploadSuccess={(avatarUrl) =>
              setChild((prev) => prev ? { ...prev, student_photo_url: avatarUrl || null } : prev)
            }
          />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">

        {/* ═══════════════════════════════════════════════════════════
            SECTION 1: PROFILE HERO — uses real coins, badges, rank
        ═══════════════════════════════════════════════════════════ */}
        <ProfileHero
          child={child}
          rankSummary={rankSummary}
          badges={badges}
          onAvatarUpdate={(avatarUrl) =>
            setChild((prev) => prev ? { ...prev, student_photo_url: avatarUrl || null } : prev)
          }
        />

        {/* ═══════════════════════════════════════════════════════════
            SECTION 2: RECOMMENDATIONS — 3-card grid
            Weak skill / Recommended lesson / Daily challenge
        ═══════════════════════════════════════════════════════════ */}
        <RecommendationsSection
          recommendedQuest={recommendedQuest}
          courseMap={courseMap}
          childId={childId}
          childGrade={child.grade_level}
        />

        {/* ═══════════════════════════════════════════════════════════
            SECTION 3: QUESTS — Daily / Weekly / Monthly tabs
            After complete: refreshes child profile, rank, rec quest
        ═══════════════════════════════════════════════════════════ */}
        <QuestSection
          childId={childId}
          onQuestComplete={handleQuestComplete}
        />

        {/* ═══════════════════════════════════════════════════════════
            SECTION 4: COURSE MAP — real Grade 1-6 from backend
            Shows current grade + previous grade review lessons
            Supports free/trial (locked) vs paid (accessible)
        ═══════════════════════════════════════════════════════════ */}
        {courseMapLoading ? (
          <div className="mb-6 flex flex-col items-center justify-center py-12 gap-3">
            <div className="text-5xl animate-bounce">📚</div>
            <p className="text-sm text-gray-500 font-medium">กำลังโหลดบทเรียน...</p>
          </div>
        ) : (
          <CourseMapSection
            courseMap={courseMap}
            membership={child.membership ?? 'free'}
            childId={childId}
            childGrade={child.grade_level}
          />
        )}

      </main>
    </div>
  )
}
