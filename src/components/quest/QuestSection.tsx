'use client'

import { useState, useEffect } from 'react'
import { questsApi, type QuestOut } from '@/lib/api/quests'
import { MOCK_DAILY_QUESTS, MOCK_WEEKLY_QUESTS, MOCK_MONTHLY_QUESTS } from '@/lib/mock-quests'
import { getQuestIcon } from '@/lib/api/quests'
import type { QuestUI } from './types'
import QuestCard from './QuestCard'

type Tab = 'daily' | 'weekly' | 'monthly'

interface Props {
  childId: string
  onQuestUpdate?: (updated: QuestOut) => void
  /** Called after a quest is completed — trigger full dashboard refresh */
  onQuestComplete?: () => void
}

// ─── Map backend QuestOut → QuestUI ─────────────────────────────────────────────

function inferDifficulty(quest: QuestOut): 'ง่าย' | 'ปานกลาง' | 'ยาก' {
  if (quest.xp_reward >= 150) return 'ยาก'
  if (quest.xp_reward >= 70)  return 'ปานกลาง'
  return 'ง่าย'
}

function toUI(quest: QuestOut): QuestUI {
  const displayStatus: QuestUI['displayStatus'] =
    quest.locked                           ? 'locked' :
    quest.child_status === 'in_progress' ? 'in_progress' :
    quest.child_status === 'completed'    ? 'completed' :
    'available'

  return {
    ...quest,
    displayStatus,
    icon: getQuestIcon(quest.skill_code),
    difficulty: inferDifficulty(quest),
    // Real progress fields from backend
    progress: { current: quest.progress_current, total: quest.progress_total },
    progress_percent: quest.progress_percent,
    can_claim_reward: quest.can_claim_reward,
  }
}

// ─── Mock data by tab ────────────────────────────────────────────────────────────

const MOCK_BY_TYPE: Record<Tab, QuestOut[]> = {
  daily:   MOCK_DAILY_QUESTS,
  weekly:  MOCK_WEEKLY_QUESTS,
  monthly: MOCK_MONTHLY_QUESTS,
}

// ─── Tab labels ─────────────────────────────────────────────────────────────────

const TAB_LABELS: Record<Tab, { label: string; emoji: string }> = {
  daily:   { label: 'รายวัน',   emoji: '📅' },
  weekly:  { label: 'รายสัปดาห์', emoji: '📆' },
  monthly: { label: 'รายเดือน',  emoji: '🗓️' },
}

// ─── Main component ──────────────────────────────────────────────────────────────

export default function QuestSection({ childId, onQuestUpdate, onQuestComplete }: Props) {
  const [activeTab, setActiveTab]         = useState<Tab>('daily')
  const [quests, setQuests]               = useState<QuestOut[]>([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [usedMock, setUsedMock]           = useState(false)

  async function fetchQuests(tab: Tab) {
    setLoading(true)
    setError(null)
    try {
      const fetchFn =
        tab === 'daily'   ? questsApi.daily   :
        tab === 'weekly'  ? questsApi.weekly  :
        questsApi.monthly
      const data = await fetchFn(childId)
      setQuests(data)
      setUsedMock(false)
    } catch {
      setQuests(MOCK_BY_TYPE[tab])
      setUsedMock(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchQuests(activeTab) }, [activeTab, childId])

  const stats = {
    total: quests.length,
    done:  quests.filter(q => q.child_status === 'completed').length,
    locked: quests.filter(q => q.locked).length,
  }

  async function handleStart(questId: string) {
    setActionLoading(questId)
    try {
      const result = await questsApi.start(childId, questId)
      setQuests(prev => prev.map(q => q.quest_id === questId ? result.quest : q))
      onQuestUpdate?.(result.quest)
    } catch {
      // Optimistic update
      setQuests(prev => prev.map(q =>
        q.quest_id === questId ? { ...q, child_status: 'in_progress' as const } : q
      ))
    } finally {
      setActionLoading(null)
    }
  }

  async function handleComplete(questId: string) {
    setActionLoading(questId)
    try {
      const result = await questsApi.complete(childId, questId)
      setQuests(prev => prev.map(q => q.quest_id === questId ? result.quest : q))
      onQuestUpdate?.(result.quest)
      onQuestComplete?.()
    } catch {
      // Optimistic update
      setQuests(prev => prev.map(q =>
        q.quest_id === questId ? { ...q, child_status: 'completed' as const } : q
      ))
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-extrabold text-gray-900">🎯 เควส</h2>
        <div className="flex items-center gap-2">
          {usedMock && (
            <span className="text-xs text-gray-400 italic">*ข้อมูลจำลอง</span>
          )}
          {stats.locked > 0 && (
            <span className="text-xs bg-gray-100 text-gray-500 font-semibold px-2 py-1 rounded-full">
              🔒 {stats.locked} รอเปิด
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {(['daily', 'weekly', 'monthly'] as Tab[]).map(tab => {
          const { label, emoji } = TAB_LABELS[tab]
          const isActive = activeTab === tab
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={
                'flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all shadow-sm ' +
                (isActive
                  ? 'bg-primary-500 text-white shadow-md scale-[1.03]'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-primary-50 hover:border-primary-300')
              }
            >
              <span>{emoji}</span>
              <span>{label}</span>
              <span className={
                'text-xs px-1.5 py-0.5 rounded-full ' +
                (isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500')
              }>
                {stats.total}
              </span>
            </button>
          )
        })}
      </div>

      {/* Quest list */}
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={() => fetchQuests(activeTab)} />
      ) : quests.length === 0 ? (
        <EmptyState tab={activeTab} />
      ) : (
        <div className="space-y-3">
          {quests.map(quest => (
            <QuestCard
              key={quest.quest_id}
              quest={toUI(quest)}
              childId={childId}
              onStart={handleStart}
              onComplete={handleComplete}
              loading={actionLoading === quest.quest_id}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── States ────────────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <div className="text-5xl animate-bounce">🎮</div>
      <p className="text-sm text-gray-500 font-medium">กำลังโหลดเควส...</p>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 bg-red-50 rounded-2xl border border-red-200">
      <div className="text-4xl">😵</div>
      <p className="text-sm text-red-600 font-medium">{message}</p>
      <button
        onClick={onRetry}
        className="text-sm bg-red-100 text-red-700 font-semibold px-4 py-2 rounded-xl hover:bg-red-200 transition-colors"
      >
        ลองอีกครั้ง
      </button>
    </div>
  )
}

const EMPTY_MESSAGES: Record<Tab, string> = {
  daily:   'ยังไม่มีเควสรายวัน — กลับมาใหม่พรุ่งนี้!',
  weekly:  'สัปดาห์นี้ยังไม่มีเควส — รอสัปดาห์หน้านะ!',
  monthly: 'เดือนนี้ยังไม่มีเควส — รอเดือนหน้านะ!',
}

function EmptyState({ tab }: { tab: Tab }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-300">
      <div className="text-5xl">🎉</div>
      <p className="text-sm text-gray-500 font-medium text-center px-4">{EMPTY_MESSAGES[tab]}</p>
    </div>
  )
}
