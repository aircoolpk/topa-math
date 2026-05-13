'use client'

import Link from 'next/link'
import type { QuestUI } from './types'

interface Props {
  quest: QuestUI
  childId: string
  onStart?: (questId: string) => void
  onComplete?: (questId: string) => void
  loading?: boolean
}

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  available: {
    wrapper:    'bg-gradient-to-br from-primary-50 to-white border-primary-200',
    badge:      'badge-xp',
    iconBg:     'bg-primary-50 border-primary-100',
    actionBg:   'bg-primary-500 hover:bg-primary-600 shadow-md hover:shadow-lg',
    actionText: 'เริ่มเควส →',
  },
  in_progress: {
    wrapper:    'bg-gradient-to-br from-amber-50 to-white border-amber-200',
    badge:      'bg-amber-100 text-amber-700',
    iconBg:     'bg-amber-50 border-amber-100',
    actionBg:   'bg-amber-500 hover:bg-amber-600 shadow-md hover:shadow-lg',
    actionText: 'ทำต่อ →',
  },
  completed: {
    wrapper:    'bg-gradient-to-br from-green-50 to-white border-green-200',
    badge:      'bg-green-100 text-green-700',
    iconBg:     'bg-green-50 border-green-100',
    actionBg:   'bg-green-100 text-green-600 cursor-default',
    actionText: '✅ เสร็จแล้ว',
  },
  locked: {
    wrapper:    'bg-gray-50 border-gray-200 opacity-70',
    badge:      'bg-gray-100 text-gray-400',
    iconBg:     'bg-gray-100 border-gray-200',
    actionBg:   'bg-gray-100 text-gray-400 cursor-default',
    actionText: '🔒 รอเปิด',
  },
} as const

const DIFFICULTY_BADGE: Record<string, string> = {
  'ง่าย':       'bg-green-100 text-green-700',
  'ปานกลาง':   'bg-amber-100 text-amber-700',
  'ยาก':       'bg-red-100 text-red-700',
}

const RECURRENCE_LABEL: Record<string, string> = {
  daily:   '📅 รายวัน',
  weekly:  '📆 รายสัปดาห์',
  monthly: '🗓️ รายเดือน',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function QuestCard({ quest, childId, onStart, onComplete, loading }: Props) {
  const cfg = STATUS_CONFIG[quest.displayStatus]
  const isActionable = quest.displayStatus === 'available' || quest.displayStatus === 'in_progress'

  function handleAction(e: React.MouseEvent) {
    if (!isActionable) return
    e.preventDefault()
    if (quest.displayStatus === 'available' && onStart) {
      onStart(quest.quest_id)
    } else if (quest.displayStatus === 'in_progress' && onComplete) {
      onComplete(quest.quest_id)
    }
  }

  return (
    <div className={`rounded-2xl border-2 p-4 transition-all hover:shadow-md ${cfg.wrapper}`}>
      <div className="flex items-start gap-3">

        {/* Quest icon */}
        <div className={`w-12 h-12 rounded-2xl ${cfg.iconBg} border flex items-center justify-center text-2xl flex-shrink-0 shadow-sm`}>
          {quest.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-gray-900 text-sm leading-tight">{quest.title}</h4>
              {quest.description && (
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{quest.description}</p>
              )}
            </div>
            <span className={`badge text-xs flex-shrink-0 font-bold ${cfg.badge}`}>
              +{quest.xp_reward} XP
            </span>
          </div>

          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className={`badge text-xs font-semibold ${DIFFICULTY_BADGE[quest.difficulty]}`}>
              {quest.difficulty}
            </span>
            <span className="bg-blue-50 text-blue-600 badge text-xs font-medium">
              🧠 {quest.skill_code ?? 'ทั่วไป'}
            </span>
            <span className="bg-purple-50 text-purple-600 badge text-xs font-medium">
              {RECURRENCE_LABEL[quest.recurrence_type] ?? quest.recurrence_type}
            </span>
            {quest.estimated_minutes != null && (
              <span className="bg-gray-100 text-gray-500 badge text-xs">
                ⏱️ {quest.estimated_minutes} นาที
              </span>
            )}
          </div>

          {/* Progress bar (for in_progress quests) */}
          {quest.displayStatus === 'in_progress' && (
            <div className="mt-2.5">
              <div className="flex justify-between text-xs text-amber-700 mb-1 font-medium">
                <span>📊 ความคืบหน้า</span>
                <span>{quest.progress.current}/{quest.progress.total} ({quest.progress_percent}%)</span>
              </div>
              <div className="h-2 bg-amber-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, quest.progress_percent)}%` }}
                />
              </div>
              {quest.can_claim_reward && (
                <p className="text-xs text-green-600 font-semibold mt-1">🎁 พร้อมรับรางวัล!</p>
              )}
            </div>
          )}

          {/* Reward + action footer */}
          <div className="flex items-center justify-between mt-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-amber-600 font-semibold">
                🪙 +{quest.coin_reward}
              </span>
              {quest.lesson_id || quest.quiz_id ? (
                <span className="text-xs text-green-600">✓ มีบทเรียน</span>
              ) : (
                <span className="text-xs text-gray-400">🎯 ควิซทั่วไป</span>
              )}
            </div>

            {isActionable ? (
              <button
                onClick={handleAction}
                disabled={loading}
                className={`px-4 py-1.5 ${cfg.actionBg} text-white text-sm font-bold rounded-xl transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0`}
              >
                {loading ? '...' : cfg.actionText}
              </button>
            ) : (
              <span className={`px-4 py-1.5 ${cfg.actionBg} text-white text-sm font-bold rounded-xl`}>
                {cfg.actionText}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
