'use client'

import { useState } from 'react'
import type { LessonItem } from '@/lib/mock-lessons'

interface Props {
  reviewLessons: LessonItem[]
  currentGradeLessons: LessonItem[]
  membership: 'free' | 'basic' | 'plus' | 'family'
  childId: string
}

// ─── Access badge ───────────────────────────────────────────────────────────────

function AccessBadge({ state }: { state: LessonItem['access_state'] }) {
  if (state === 'free') {
    return <span className="badge bg-green-100 text-green-700 text-xs font-bold">🔓 ฟรี</span>
  }
  if (state === 'paid') {
    return <span className="badge bg-amber-100 text-amber-700 text-xs font-bold">⭐ เป็นสมาชิก</span>
  }
  return <span className="badge bg-gray-100 text-gray-400 text-xs font-bold">🔒 ล็อก</span>
}

// ─── Score badge ────────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return null
  const color = score >= 80 ? 'bg-green-100 text-green-700' : score >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
  return (
    <span className={`badge text-xs font-bold ${color}`}>
      ✅ {score}%
    </span>
  )
}

// ─── Lesson card ───────────────────────────────────────────────────────────────

function LessonCard({ lesson, canAccess, onStart }: {
  lesson: LessonItem
  canAccess: boolean
  onStart: (lesson: LessonItem) => void
}) {
  const { is_locked, access_state, title, topic, estimated_minutes, is_review, xp_reward, completed_at, best_score, attempt_count } = lesson

  const isClickable = !is_locked && (access_state === 'free' || canAccess)

  function handleClick() {
    if (!isClickable) return
    onStart(lesson)
  }

  const wrapperClass = is_locked
    ? 'rounded-2xl border-2 border-gray-200 bg-gray-50 p-4 opacity-60'
    : isClickable
    ? 'rounded-2xl border-2 border-primary-100 bg-gradient-to-br from-white to-primary-50 p-4 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 hover:border-primary-300 transition-all'
    : 'rounded-2xl border-2 border-amber-100 bg-gradient-to-br from-white to-amber-50 p-4'

  return (
    <div className={wrapperClass} onClick={handleClick}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h4 className={`font-bold text-sm leading-tight ${is_locked ? 'text-gray-400' : 'text-gray-900'}`}>
              {title}
            </h4>
            {is_review && (
              <span className="badge bg-blue-100 text-blue-700 text-xs font-semibold">📖 ทบทวน</span>
            )}
            {!is_review && (
              <span className="badge bg-primary-100 text-primary-700 text-xs font-semibold">📚 ปัจจุบัน</span>
            )}
          </div>
          <p className="text-xs text-gray-400">{topic} · ⏱️ {estimated_minutes} นาที</p>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <AccessBadge state={access_state} />
          {completed_at && <ScoreBadge score={best_score} />}
        </div>
      </div>

      {/* Progress summary */}
      {attempt_count > 0 && (
        <div className="mb-2 text-xs text-gray-500">
          ทำแล้ว {attempt_count} ครั้ง
          {best_score !== null && <span className="ml-2">· คะแนนดีสุด {best_score}%</span>}
        </div>
      )}

      {/* Action */}
      <div className="flex items-center justify-between">
        <span className={`badge text-xs font-bold ${is_locked ? 'bg-gray-100 text-gray-400' : 'bg-primary-100 text-primary-700'}`}>
          +{xp_reward} XP
        </span>
        {is_locked ? (
          <span className="text-xs text-gray-400 flex items-center gap-1">
            🔒 ล็อก — ต้องเรียนบทก่อนหน้า
          </span>
        ) : !canAccess && access_state === 'paid' ? (
          <span className="text-xs text-amber-600 flex items-center gap-1 font-semibold">
            ⭐ สมัครเป็นสมาชิกเพื่อเล่น
          </span>
        ) : completed_at ? (
          <span className="text-xs text-green-600 font-bold flex items-center gap-1">
            ✅ เรียนแล้ว
          </span>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onStart(lesson) }}
            className="text-xs bg-primary-500 hover:bg-primary-600 text-white font-bold px-3 py-1.5 rounded-xl transition-colors shadow-sm"
          >
            เริ่มเรียน →
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Section ────────────────────────────────────────────────────────────────────

export default function LessonSection({ reviewLessons, currentGradeLessons, membership, childId }: Props) {
  const [activeTab, setActiveTab] = useState<'current' | 'review'>('current')

  const canAccessPaid = membership !== 'free'

  function handleStartLesson(lesson: LessonItem) {
    // Navigate to quiz if quiz_id exists, otherwise placeholder
    if (lesson.quiz_id) {
      window.location.href = `/children/${childId}/quiz/${lesson.quiz_id}`
    } else if (lesson.lesson_id) {
      window.location.href = `/children/${childId}/quiz/new?lesson=${lesson.lesson_id}`
    } else {
      // Placeholder — lesson not yet ready
      alert('เควสนี้กำลังเตรียมบทเรียนให้พร้อม 📚')
    }
  }

  const currentCount = currentGradeLessons.filter(l => !l.is_locked).length
  const reviewCount = reviewLessons.filter(l => !l.is_locked).length

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-extrabold text-gray-900">📚 บทเรียน</h2>
        {membership === 'free' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 text-xs text-amber-700 font-semibold">
            ⭐ สมัครเป็นสมาชิกเพื่อปลดล็อกบทเรียน ป.3
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
      <div className="space-y-3">
        {activeTab === 'current' ? (
          currentGradeLessons.length === 0 ? (
            <EmptyState message="ยังไม่มีบทเรียนสำหรับระดับชั้นนี้" />
          ) : (
            currentGradeLessons.map((lesson) => (
              <LessonCard
                key={lesson.id}
                lesson={lesson}
                canAccess={canAccessPaid}
                onStart={handleStartLesson}
              />
            ))
          )
        ) : (
          reviewLessons.length === 0 ? (
            <EmptyState message="ยังไม่มีบทเรียนทบทวน" />
          ) : (
            reviewLessons.map((lesson) => (
              <LessonCard
                key={lesson.id}
                lesson={lesson}
                canAccess={canAccessPaid}
                onStart={handleStartLesson}
              />
            ))
          )
        )}
      </div>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-300">
      <div className="text-4xl">📚</div>
      <p className="text-sm text-gray-500 font-medium">{message}</p>
    </div>
  )
}
