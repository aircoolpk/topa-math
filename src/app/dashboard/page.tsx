'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BarChart3, BookOpen, Camera, GraduationCap, LineChart, Lock, Share2, Sparkles, Star, Target, Trophy } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { meApi, type DashboardData, type Lesson, type LessonProgram, type Quest, type TestLevel } from '@/lib/api/me'
import { rankingsApi } from '@/lib/api/rankings'
import { MascotAvatar, SectionHeader, TopaButton, TopaCard } from '@/components/topa/TopaUI'
import { TopaLogo } from '@/components/brand/TopaBrand'
import { defaultMascots } from '@/lib/topa-content'
import { PhotoAvatar } from '@/components/avatar/PhotoAvatar'
import { AvatarUpload } from '@/components/avatar/AvatarUpload'

function Stat({ label, value, icon, href }: { label: string; value: string | number; icon: React.ReactNode; href?: string }) {
  const content = (
    <TopaCard className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
        </div>
        <div className="rounded-2xl bg-sky-50 p-3 text-sky-600">{icon}</div>
      </div>
    </TopaCard>
  )
  return href ? <Link href={href}>{content}</Link> : content
}

function QuestCard({ quest }: { quest: Quest }) {
  const pct = quest.progress_total ? Math.min(100, (quest.progress_current / quest.progress_total) * 100) : 0
  return (
    <TopaCard className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-black text-slate-950">{quest.title_th || quest.title}</h3>
          <p className="mt-1 text-sm text-slate-500">{quest.description_th || quest.description || 'ฝึกต่ออีกนิดเพื่อเก็บ XP'}</p>
        </div>
        <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-black text-amber-700">+{quest.exp_reward || quest.xp_reward} XP</span>
      </div>
      <div className="mt-4 h-2 rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-amber-400" style={{ width: `${pct}%` }} />
      </div>
    </TopaCard>
  )
}

function LessonCard({ lesson, onStart, onTest, programType }: { lesson: Lesson; onStart: (lesson: Lesson) => void; onTest: (lesson: Lesson) => void; programType: LessonProgram }) {
  const locked = lesson.status === 'locked' || lesson.is_locked
  const hasTest = lesson.test_available === true
  const unavailableReason = lesson.test_disabled_reason || lesson.test_unavailable_reason || 'ยังไม่มีแบบทดสอบที่อนุมัติสำหรับบทนี้'
  const lessonGroupId = lesson.lesson_group_id || lesson.lesson_id
  return (
    <TopaCard className={`p-5 ${locked ? 'opacity-70' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-black text-sky-700">ป.{lesson.grade_level}</span>
          <h3 className="mt-3 font-black text-slate-950">{lesson.title_th || lesson.title || lesson.lesson_id}</h3>
          <p className="mt-1 text-sm text-slate-500">{lesson.description || lesson.description_th || lesson.topic_code || lesson.skill_code || 'TOPA Math'} · {lesson.duration || lesson.estimated_minutes || 10} นาที</p>
        </div>
        <BookOpen className="h-5 w-5 text-amber-500" />
      </div>
      <div className="mt-5 flex gap-2">
        {locked ? (
          <Link href="/pricing" className="flex-1 rounded-xl bg-amber-50 px-3 py-2 text-center text-sm font-black text-amber-700">อัปเกรดเพื่อเรียน</Link>
        ) : (
          <>
            <button onClick={() => onStart(lesson)} className="flex-1 rounded-xl bg-sky-500 px-3 py-2 text-sm font-black text-white">เรียนต่อ</button>
            <button
              onClick={() => hasTest && onTest(lesson)}
              disabled={!hasTest}
              title={hasTest ? 'ทำเทสจากบทนี้' : unavailableReason}
              className={`flex-1 rounded-xl px-3 py-2 text-sm font-black ${hasTest ? 'bg-orange-500 text-white hover:bg-orange-600' : 'cursor-not-allowed bg-slate-100 text-slate-400'}`}
            >
              {hasTest ? 'ทำเทสจากบทนี้' : 'ยังไม่มีเทส'}
            </button>
          </>
        )}
      </div>
      {!locked && (
        <Link
          href={`/dashboard/lessons/${lessonGroupId}/master?program_type=${programType}`}
          className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-3 py-2 text-sm font-black text-slate-950 transition hover:from-amber-500 hover:to-amber-600"
        >
          <Sparkles className="h-4 w-4" />
          เรียนแบบโต้ตอบ
        </Link>
      )}
    </TopaCard>
  )
}

function EmptyState({ text }: { text: string }) {
  return <TopaCard className="p-8 text-center text-sm font-semibold text-slate-500">{text}</TopaCard>
}

function isEpLesson(lesson: Lesson) {
  return lesson.program_type === 'EP' || lesson.lesson_id.toLowerCase().endsWith('_ep')
}

function ProgramSwitch({
  activeProgram,
  canAccessEp,
  onSelect,
}: {
  activeProgram: LessonProgram
  canAccessEp: boolean
  onSelect: (program: LessonProgram) => void
}) {
  const epLocked = !canAccessEp
  return (
    <div className="inline-flex rounded-full bg-white/95 p-1 shadow-sm ring-1 ring-white/70">
      <button
        type="button"
        onClick={() => onSelect('TH')}
        className={`min-w-16 rounded-full px-4 py-2 text-sm font-black transition ${activeProgram === 'TH' ? 'bg-amber-400 text-slate-950 shadow-sm' : 'text-slate-600 hover:bg-sky-50'}`}
      >
        TH
      </button>
      <button
        type="button"
        onClick={() => onSelect('EP')}
        title={epLocked ? 'แพ็กเกจ EP ยังไม่ได้เปิดใช้งาน' : 'EP'}
        className={`min-w-20 rounded-full px-4 py-2 text-sm font-black transition ${activeProgram === 'EP' ? 'bg-sky-600 text-white shadow-sm' : epLocked ? 'text-slate-400 hover:bg-slate-100' : 'text-slate-600 hover:bg-sky-50'}`}
      >
        <span className="inline-flex items-center justify-center gap-1">
          {epLocked && <Lock className="h-3.5 w-3.5" />}
          EP
        </span>
      </button>
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const { checkAuth } = useAuthStore()
  const dashboardAbortRef = useRef<AbortController | null>(null)
  const dashboardRequestSeq = useRef(0)
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')
  const [retryHint, setRetryHint] = useState('')
  const [programMessage, setProgramMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [testLoading, setTestLoading] = useState('')
  const [activeProgram, setActiveProgram] = useState<LessonProgram>('TH')
  const [affiliateRegisteredCount, setAffiliateRegisteredCount] = useState(0)
  const [rankSummary, setRankSummary] = useState<{ total_score: number; rank_title: string; rank_position?: number | null; total_in_grade?: number | null } | null>(null)
  const [ownRank, setOwnRank] = useState<{ rank_position: number; total_in_grade: number } | null>(null)

  const loadAffiliateSummary = useCallback(async () => {
    try {
      const data = await meApi.getAffiliateSummary()
      setAffiliateRegisteredCount(data.registered_count || 0)
    } catch {
      setAffiliateRegisteredCount(0)
    }
  }, [])

  const loadRankSummary = useCallback(async () => {
    try {
      const data = await meApi.getRankSummary()
      setRankSummary({
        total_score: data.total_score || 0,
        rank_title: data.rank_title || '',
        rank_position: data.rank_position ?? null,
        total_in_grade: data.total_in_grade ?? null,
      })
    } catch {
      // No child profile yet — keep summary null
      setRankSummary(null)
    }
  }, [])

  /**
   * Real leaderboard position for the current child.
   * `/me/rank-summary` only exposes the rank TITLE, so the numeric position
   * has to come from `/rankings` → `child_own_rank.rank_position`.
   */
  const loadOwnRank = useCallback(async (gradeLevel: number) => {
    try {
      const data = await rankingsApi.get(gradeLevel, 'country')
      const own = data.child_own_rank
      if (own) {
        setOwnRank({
          rank_position: own.rank_position,
          total_in_grade: data.entries?.length || 0,
        })
      } else {
        setOwnRank(null)
      }
    } catch {
      setOwnRank(null)
    }
  }, [])

  const redirectToLogin = useCallback(() => {
    router.replace(`/login?next=${encodeURIComponent('/dashboard')}`)
  }, [router])

  const loadDashboard = useCallback(async (program: LessonProgram, signal?: AbortSignal) => {
    setProgramMessage('')
    const data = await meApi.getDashboard(program, { signal, requestLabel: `dashboard:${program}`, timeout: 30000 })
    setDashboard(data)
    setAffiliateRegisteredCount(data.affiliate_summary?.registered_count || 0)
    setActiveProgram((data.active_program || program) === 'EP' ? 'EP' : 'TH')
  }, [loadRankSummary])

  const loadDashboardSafely = useCallback(async (program: LessonProgram = 'TH') => {
    dashboardAbortRef.current?.abort()
    const controller = new AbortController()
    dashboardAbortRef.current = controller
    const requestId = dashboardRequestSeq.current + 1
    dashboardRequestSeq.current = requestId
    setLoading(true)
    setError('')
    setRetryHint('')
    try {
      const authenticatedUser = await checkAuth()
      if (!authenticatedUser) {
        redirectToLogin()
        return
      }
      await loadDashboard(program, controller.signal)
      if (requestId === dashboardRequestSeq.current) {
        loadAffiliateSummary()
      }
    } catch (err: unknown) {
      const e = err as { code?: string; name?: string; response?: { status?: number } }
      if (controller.signal.aborted || e?.code === 'ERR_CANCELED' || e?.name === 'CanceledError') return
      if (e?.response?.status === 401) {
        redirectToLogin()
        return
      }
      if (e?.code === 'ECONNABORTED') {
        setRetryHint('ใช้เวลานานกว่าปกติ กรุณาลองโหลดใหม่')
      }
      setError('โหลดแดชบอร์ดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
    } finally {
      if (requestId === dashboardRequestSeq.current) {
        setLoading(false)
      }
    }
  }, [checkAuth, loadAffiliateSummary, loadDashboard, redirectToLogin])

  useEffect(() => {
    loadDashboardSafely('TH')
      .catch(() => setError('โหลดแดชบอร์ดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'))
      .finally(() => setLoading(false))
  }, [loadDashboardSafely])

  useEffect(() => {
    if (dashboard) loadAffiliateSummary()
    if (dashboard) loadRankSummary()
  }, [dashboard, loadAffiliateSummary, loadRankSummary])

  useEffect(() => {
    const grade = dashboard?.child?.grade_level ?? dashboard?.grade_level
    if (typeof grade === 'number' && grade > 0) {
      void loadOwnRank(grade)
    } else {
      setOwnRank(null)
    }
  }, [dashboard, loadOwnRank])

  useEffect(() => {
    return () => dashboardAbortRef.current?.abort()
  }, [])

  const child = dashboard?.child
  const quests = useMemo(() => [...(dashboard?.daily_quests || []), ...(dashboard?.weekly_quests || []), ...(dashboard?.monthly_quests || [])].slice(0, 6), [dashboard])
  const weakSkills = dashboard?.weak_skills?.slice(0, 3) || []
  const filterProgramLessons = (items: Lesson[]) => items.filter((lesson) => activeProgram === 'EP' ? isEpLesson(lesson) : !isEpLesson(lesson))
  const currentLessons = filterProgramLessons(dashboard?.current_grade_lessons || dashboard?.lesson_sections?.current_grade_lessons || dashboard?.lessons || [])
    .filter((lesson) => (lesson.status !== 'locked' && !lesson.is_locked) || lesson.is_free_preview)
    .filter((lesson) => !child?.grade_level || lesson.grade_level === child.grade_level)
  const visibleCurrentLessons = child?.grade_level === 3 ? currentLessons : currentLessons.slice(0, 6)
  const reviewLessons = filterProgramLessons(dashboard?.review_lessons || dashboard?.lesson_sections?.review_lessons || [])
    .filter((lesson) => (lesson.status !== 'locked' && !lesson.is_locked) || lesson.is_free_preview)
    .filter((lesson) => !child?.grade_level || lesson.grade_level === Math.max(1, child.grade_level - 1))
    .slice(0, 4)
  const lessons = visibleCurrentLessons.length ? visibleCurrentLessons : filterProgramLessons(dashboard?.lessons || []).filter((lesson) => lesson.status !== 'locked' || lesson.is_free_preview).slice(0, child?.grade_level === 3 ? 11 : 6)
  const mascot = defaultMascots[(child?.current_level || 0) % defaultMascots.length]
  const testLevel = dashboard?.test_levels?.find((level: TestLevel) => level.status !== 'locked')

  // "บทเรียนจบ" — backend `lesson_summary.completed` is authoritative.
  // The visible `lessons` list only contains unlocked items, so counting
  // `status === 'completed'` there always yielded 0.
  const completedLessonCount = dashboard?.lesson_summary?.completed
    ?? dashboard?.lessons?.filter((lesson) => lesson.status === 'completed').length
    ?? 0

  // "เทสที่ทำ" — `test_levels` is a lock-status list, not a completion log.
  // The real counter is `profile.total_tests_completed` (fallback: status).
  const completedTestCount = dashboard?.profile?.total_tests_completed
    ?? dashboard?.child?.total_tests_completed
    ?? dashboard?.status?.test_attempts_used
    ?? 0

  // "อันดับปัจจุบัน" — numeric position (rank_summary only carries the title).
  const currentRankPosition = ownRank?.rank_position ?? rankSummary?.rank_position ?? null
  const totalInGrade = ownRank?.total_in_grade || rankSummary?.total_in_grade || null

  const startLesson = async (lesson: Lesson) => {
    const lessonGroupId = lesson.lesson_group_id || lesson.lesson_id
    await meApi.startLesson(lessonGroupId, activeProgram).catch(() => null)
    router.push(`/dashboard/lessons/${lessonGroupId}?program_type=${activeProgram}`)
  }

  const startTest = async (lesson: Lesson) => {
    const lessonId = lesson.lesson_group_id || lesson.lesson_id
    setTestLoading(lessonId)
    try {
      const result = await meApi.startLessonTest(lessonId, activeProgram)
      router.push(`/dashboard/tests/${result.session_id}`)
    } finally {
      setTestLoading('')
    }
  }

  const startRecommendedPractice = () => {
    const first = weakSkills[0]
    if (first?.recommended_lesson_id) router.push(`/dashboard/lessons/${first.recommended_lesson_id}?program_type=${activeProgram}`)
    else if (testLevel) meApi.startTest({ grade_level: testLevel.grade, session_type: 'placement' }).then((result) => router.push(`/dashboard/tests/${result.session_id}`))
  }

  const selectProgram = async (program: LessonProgram) => {
    if (program === activeProgram) return
    if (program === 'EP' && !dashboard?.can_access_ep && !dashboard?.child?.can_access_ep) {
      setProgramMessage('แพ็กเกจ EP ยังไม่ได้เปิดใช้งาน')
      return
    }
    setLoading(true)
    try {
      dashboardAbortRef.current?.abort()
      const controller = new AbortController()
      dashboardAbortRef.current = controller
      await loadDashboard(program, controller.signal)
      loadAffiliateSummary()
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { detail?: { message?: string } } } }
      if (program === 'EP' && e?.response?.status === 403) {
        setActiveProgram('TH')
        setProgramMessage(e.response.data?.detail?.message || 'แพ็กเกจ EP ยังไม่ได้เปิดใช้งาน')
      } else if (e?.response?.status === 401) {
        redirectToLogin()
      } else {
        setError('โหลดแดชบอร์ดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
      }
    } finally {
      setLoading(false)
    }
  }

  const updateProfilePhoto = (studentPhotoUrl: string) => {
    setDashboard((current) => current && current.child ? ({
      ...current,
      child: { ...current.child, student_photo_url: studentPhotoUrl || null },
    }) : current)
  }

  if (loading) return <main className="min-h-screen bg-sky-50 p-8 text-slate-500">กำลังโหลดแดชบอร์ด...</main>

  if (dashboard && !child) {
    return (
      <div className="min-h-screen bg-[#f7fbff]">
        <header className="border-b border-sky-100 bg-white/90">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
            <Link href="/" aria-label="TOPA Math homepage"><TopaLogo size="sm" /></Link>
            <Link href="/register" className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-black text-white">สร้างโปรไฟล์นักเรียน</Link>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-16">
          <TopaCard className="p-8 text-center">
            <GraduationCap className="mx-auto h-12 w-12 text-sky-500" />
            <h1 className="mt-4 text-2xl font-black text-slate-950">ยังไม่มีข้อมูลนักเรียน กรุณาสร้างโปรไฟล์นักเรียน</h1>
            <p className="mt-3 text-slate-600">ยังไม่ระบุระดับชั้น ระบบจะแสดงบทเรียนและคำแนะนำหลังตั้งค่าโปรไฟล์เรียบร้อย</p>
            <TopaButton href="/register" className="mt-6">เริ่มสร้างโปรไฟล์นักเรียน</TopaButton>
          </TopaCard>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f7fbff]">
      <header className="border-b border-sky-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link href="/" aria-label="TOPA Math homepage"><TopaLogo size="sm" /></Link>
          <div className="flex items-center gap-3">
            <Link href={child?.id ? `/children/${child.id}` : '/register'} prefetch={false} className="hidden rounded-xl px-3 py-2 text-sm font-bold text-slate-600 hover:bg-sky-50 sm:block">นักเรียน</Link>
            <Link href="/pricing" className="rounded-xl bg-amber-100 px-3 py-2 text-sm font-black text-amber-700">แผนสมาชิก</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            <div>{error}</div>
            {retryHint && <div className="mt-1 text-red-600">{retryHint}</div>}
            <button type="button" onClick={() => loadDashboardSafely(activeProgram)} className="mt-3 rounded-lg bg-red-600 px-3 py-2 text-xs font-black text-white hover:bg-red-700">
              โหลดใหม่
            </button>
          </div>
        )}
        {programMessage && <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black text-amber-800">{programMessage}</div>}

        <section className="mb-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          <TopaCard className="overflow-hidden">
            <div className="bg-gradient-to-br from-sky-500 to-amber-400 p-6 text-white md:p-8">
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-bold text-white/80">ยินดีต้อนรับกลับมา</p>
                  <h1 className="mt-2 text-4xl font-black">สวัสดี {child?.nickname || 'นักเรียน TOPA'}</h1>
                  <p className="mt-3 text-white/90">{child?.grade_level ? `ป.${child.grade_level}` : 'ยังไม่ระบุระดับชั้น'} · {child?.membership || 'free'} plan · {child?.rank_title || 'TOPA Learner'}</p>
                </div>
                <div className="flex flex-col items-center gap-3">
                  <PhotoAvatar
                    studentPhotoUrl={child?.student_photo_url || null}
                    avatarGender={child?.avatar_gender || null}
                    size="xl"
                    alt={child ? `${child.nickname || child.first_name} profile photo` : 'Student profile photo'}
                  />
                  <ProgramSwitch activeProgram={activeProgram} canAccessEp={Boolean(dashboard?.can_access_ep || child?.can_access_ep)} onSelect={selectProgram} />
                </div>
              </div>
              {child?.id && (
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <div className="rounded-2xl bg-white/95 px-3 py-2 text-slate-800 shadow-sm">
                    <div className="flex items-center gap-2 text-sm font-black">
                      <Camera className="h-4 w-4 text-sky-600" />
                      เปลี่ยนรูปโปรไฟล์
                    </div>
                    <div className="mt-2">
                      <AvatarUpload childId={child.id} currentAvatarUrl={child.student_photo_url || null} onUploadSuccess={updateProfilePhoto} />
                    </div>
                  </div>
                  <Link href="/dashboard/referral" className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-sky-700 shadow-sm hover:bg-sky-50">
                    <Share2 className="h-4 w-4" />
                    แชร์ affiliate
                  </Link>
                  <Link href="/#ranking" className="inline-flex items-center gap-2 rounded-2xl bg-amber-100 px-4 py-3 text-sm font-black text-amber-800 shadow-sm hover:bg-amber-50">
                    <Trophy className="h-4 w-4" />
                    ดูอันดับของหนู
                  </Link>
                </div>
              )}
            </div>
          </TopaCard>
          <TopaCard className="p-6">
            <div className="flex items-start gap-4">
              <MascotAvatar mascot={mascot} size="md" />
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-sky-500">Mascot helper</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">{mascot.name} แนะนำวันนี้</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">ลองเลือกโจทย์ที่ยังไม่มั่นใจ 3 ข้อ แล้วอ่านช้า ๆ ก่อนตอบ คะแนนจะค่อย ๆ ขึ้นแน่นอน</p>
              </div>
            </div>
          </TopaCard>
        </section>

        <section className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <Stat label="Level" value={child?.current_level || 1} icon={<Star />} />
          <Stat label="XP" value={(child?.total_xp || 0).toLocaleString('th-TH')} icon={<Sparkles />} />
          <Stat label="คะแนนรวม" value={(child?.total_score || 0).toLocaleString('th-TH')} icon={<Trophy />} />
          <Stat label="บทเรียนจบ" value={completedLessonCount} icon={<BookOpen />} />
          <Stat label="เทสที่ทำ" value={completedTestCount} icon={<GraduationCap />} />
          <Stat label="Affiliate" value={affiliateRegisteredCount.toLocaleString('th-TH')} icon={<Share2 />} href="/dashboard/affiliate" />
        </section>

        <section className="mb-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <TopaCard className="p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-black text-amber-500">AI วิเคราะห์จุดที่ควรฝึกเพิ่ม</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">โฟกัส 3 ทักษะนี้ก่อน</h2>
              </div>
              <button onClick={startRecommendedPractice} className="rounded-2xl bg-sky-500 px-4 py-2 text-sm font-black text-white">เริ่มฝึกที่แนะนำ</button>
            </div>
            <div className="mt-5 grid gap-3">
              {weakSkills.length ? weakSkills.map((skill, index) => (
                <div key={skill.skill_code || index} className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                  <div className="flex items-center gap-3">
                    <Target className="h-5 w-5 text-amber-600" />
                    <div>
                      <p className="font-black text-slate-950">{skill.skill_name}</p>
                      <p className="text-sm text-slate-600">{skill.reason || skill.recommended_lesson_title || 'ควรฝึกเพิ่มอีกเล็กน้อย'}</p>
                    </div>
                  </div>
                </div>
              )) : <EmptyState text="ยังไม่มีจุดอ่อนเด่นชัด ระบบจะแสดงเมื่อมีผลทดสอบมากขึ้น" />}
            </div>
          </TopaCard>

          <TopaCard className="p-6">
            <p className="text-sm font-black text-sky-500">Ranking preview</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">อันดับของหนู</h2>
            <div className="mt-5 rounded-3xl bg-sky-50 p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-500">อันดับปัจจุบัน</span>
                <span className="text-3xl font-black text-sky-600">
                  {currentRankPosition ? `#${currentRankPosition}` : '—'}
                </span>
              </div>
              <p className="mt-2 text-xs font-semibold text-slate-500">
                {rankSummary?.rank_title
                  || dashboard?.child?.current_rank_title
                  || (child?.total_score ? `${child.total_score.toLocaleString('th-TH')} คะแนน` : 'ยังไม่มีคะแนนสะสม')}
                {totalInGrade ? ` · จากทั้งหมด ${totalInGrade} คน` : ''}
              </p>
              <div className="mt-4 h-3 rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-400 to-amber-400"
                  style={{
                    width: currentRankPosition && totalInGrade
                      ? `${Math.min(100, Math.max(0, 100 - ((currentRankPosition / totalInGrade) * 100)))}%`
                      : '0%',
                  }}
                />
              </div>
            </div>
            <TopaButton href="/#ranking" variant="secondary" className="mt-5 w-full">ดูอันดับหน้าแรก</TopaButton>
          </TopaCard>
        </section>

        <section className="mb-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SectionHeader align="left" title={child?.grade_level ? `บทเรียนหลัก ป.${child.grade_level}` : 'บทเรียนหลัก · ยังไม่ระบุระดับชั้น'} subtitle="แสดงบทเรียนระดับชั้นปัจจุบันเป็นเส้นทางหลัก และยังเคารพ approved-content gating จาก backend" />
            <Link
              href={`/dashboard/lessons?program_type=${activeProgram}`}
              className="mb-10 inline-flex items-center gap-2 rounded-2xl border-2 border-sky-200 bg-white px-4 py-2.5 text-sm font-black text-slate-800 shadow-sm transition hover:border-sky-300 hover:bg-sky-50"
            >
              <GraduationCap className="h-4 w-4 text-sky-500" />
              เลือกบทเรียน ป.1–ป.6
            </Link>
          </div>
          {lessons.length ? <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{lessons.map((lesson) => <LessonCard key={lesson.lesson_id} lesson={lesson} onStart={startLesson} onTest={testLoading ? () => null : startTest} programType={activeProgram} />)}</div> : <EmptyState text="ยังไม่มีบทเรียนที่เปิดให้เรียนตอนนี้" />}
        </section>

        <section className="mb-10">
          <SectionHeader align="left" title={child?.grade_level ? `ทบทวนพื้นฐาน ป.${Math.max(1, child.grade_level - 1)}` : 'ทบทวนพื้นฐาน · ยังไม่ระบุระดับชั้น'} subtitle="บททบทวนจากระดับก่อนหน้า ช่วยปิดช่องว่างก่อนเรียนเรื่องใหม่" />
          {reviewLessons.length ? <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">{reviewLessons.map((lesson) => <LessonCard key={lesson.lesson_id} lesson={lesson} onStart={startLesson} onTest={testLoading ? () => null : startTest} programType={activeProgram} />)}</div> : <EmptyState text="ยังไม่มีบททบทวนจากระดับก่อนหน้าที่เปิดให้เรียนตอนนี้" />}
        </section>

        <section className="mb-10">
          <SectionHeader align="left" title="เควสประจำวัน / สัปดาห์ / เดือน" />
          {quests.length ? <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{quests.map((quest) => <QuestCard key={quest.quest_id} quest={quest} />)}</div> : <EmptyState text="ยังไม่มีเควสใหม่ในตอนนี้ กลับมาเช็กอีกครั้งได้เลย" />}
        </section>

        <section className="mb-4">
          <TopaCard className="p-6">
            <div className="flex items-start gap-4">
              <LineChart className="h-6 w-6 text-sky-600" />
              <div>
                <h2 className="text-xl font-black text-slate-950">สรุปสำหรับผู้ปกครอง</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">วันนี้มี XP รวม {(child?.total_xp || 0).toLocaleString('th-TH')} คะแนนรวม {(child?.total_score || 0).toLocaleString('th-TH')} และ streak {child?.streak_count || 0} วัน ขั้นถัดไปคือฝึกตามคำแนะนำของ AI และทำแบบทดสอบสั้นหลังเรียน</p>
              </div>
              <BarChart3 className="ml-auto hidden h-12 w-12 text-amber-300 md:block" />
            </div>
          </TopaCard>
        </section>
      </main>
    </div>
  )
}
