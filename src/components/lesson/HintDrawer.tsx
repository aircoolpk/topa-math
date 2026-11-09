'use client'

import { X } from 'lucide-react'
import { playSound } from './audio'
import type { HintDrawerProps } from './types'

/**
 * The floating progressive hint popover.
 *
 * Robo-Buddy never gives the answer away: it walks the learner through two
 * levels of hints. Level 1 is the idea, level 2 is how to set the problem up.
 */
export function HintDrawer(props: HintDrawerProps) {
  const { theme, open, onClose, hintLevel, onHintLevelChange, hint1, hint2, langMode } = props

  if (!open) return null

  const level = hintLevel === 1 ? 1 : 2
  const isEnglish = langMode === 'EP'

  const stepLabel = (step: number) => {
    if (isEnglish) return `Level ${step}`
    if (langMode === 'BILINGUAL') return `ขั้นที่ ${step} / Level ${step}`
    return `ขั้นที่ ${step}`
  }

  return (
    <div
      className={`absolute right-20 sm:right-28 bottom-6 w-80 sm:w-96 p-4 rounded-3xl border-2 shadow-2xl z-40 ${theme.modal} ${theme.modalBorder}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🤖</span>
          <div>
            <h4 className="font-extrabold text-sm">Robo-Buddy Hint (คำใบ้ทีละขั้น)</h4>
            <p className="text-[11px] opacity-70">ไม่เฉลยคำตอบตรงๆ แต่ช่วยแนะวิธีคิด!</p>
          </div>
        </div>
        <button
          onClick={() => {
            playSound('pop')
            onClose()
          }}
          className="p-1 opacity-60 hover:opacity-100"
          title="ปิดคำใบ้ (Close)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Level stepper */}
      <div className="flex items-center gap-2 mb-2">
        {[1, 2].map((step) => (
          <button
            key={step}
            onClick={() => {
              playSound('pop')
              onHintLevelChange(step)
            }}
            aria-label={`ไปที่คำใบ้ขั้นที่ ${step}`}
            aria-pressed={level === step}
            className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold transition-all ${
              level === step
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-black/5 opacity-70 hover:opacity-100'
            }`}
          >
            {stepLabel(step)}
          </button>
        ))}
      </div>

      <div className={`p-3 rounded-2xl text-xs sm:text-sm font-bold mb-3 ${theme.panel} ${theme.panelBorder}`}>
        {level === 1 ? (
          <>
            <div className="text-amber-500 font-extrabold mb-1">💡 คำใบ้ขั้นที่ 1 (แนวคิด):</div>
            <p>{hint1}</p>
          </>
        ) : (
          <>
            <div className="text-emerald-500 font-extrabold mb-1">✨ คำใบ้ขั้นที่ 2 (วิธีตั้งต้น):</div>
            <p>{hint2}</p>
          </>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => {
            playSound('pop')
            onHintLevelChange(level === 1 ? 2 : 1)
          }}
          className="text-xs font-extrabold px-3 py-1.5 rounded-xl bg-amber-500 text-white hover:bg-amber-600"
        >
          {level === 1 ? 'ดูคำใบ้ขั้นที่ 2 ถัดไป →' : '← กลับไปคำใบ้ขั้นที่ 1'}
        </button>
      </div>
    </div>
  )
}

export default HintDrawer
