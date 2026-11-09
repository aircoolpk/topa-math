'use client'

import { ChevronRight, X } from 'lucide-react'
import type { LessonStep, StepByStepModalProps } from './types'

/**
 * The worked solution overlay.
 *
 * One block per step: the title, the description and the visual line.
 * Thai shows titleTH / descTH, English shows titleEN / descEN and the
 * bilingual mode shows both.
 */
export function StepByStepModal(props: StepByStepModalProps) {
  const { open, steps, theme, langMode, onClose, onContinue } = props

  if (!open) return null

  const isEnglish = langMode === 'EP'
  const isThai = langMode === 'TH'
  const isBilingual = langMode === 'BILINGUAL'

  const renderStepTitle = (step: LessonStep) => {
    if (isBilingual) {
      return (
        <>
          <div className="text-sm font-extrabold text-amber-500">{step.titleEN}</div>
          <div className="text-xs font-extrabold opacity-70">{step.titleTH}</div>
        </>
      )
    }
    return <div className="text-sm font-extrabold text-amber-500">{isEnglish ? step.titleEN : step.titleTH}</div>
  }

  const renderStepDescription = (step: LessonStep) => {
    if (isBilingual) {
      return (
        <>
          <div className="mt-0.5 text-xs sm:text-sm">{step.descEN}</div>
          <div className="mt-0.5 text-xs opacity-80 sm:text-sm">{step.descTH}</div>
        </>
      )
    }
    return <div className="mt-0.5 text-xs sm:text-sm">{isEnglish ? step.descEN : step.descTH}</div>
  }

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${theme.overlay}`}>
      <div
        className={`w-full max-w-xl border-2 p-6 shadow-2xl ${theme.radius} ${theme.modal}`}
        role="dialog"
        aria-modal="true"
        aria-label="วิธีคิดทีละขั้นด้วยภาพ (Visual Step-by-Step Solution)"
      >
        <div className="mb-4 flex items-center justify-between border-b border-current/10 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="text-3xl">🦉</span>
            <div>
              <h3 className="text-lg font-extrabold">
                วิธีคิดทีละขั้นด้วยภาพ (Visual Step-by-Step Solution)
              </h3>
              <p className="text-xs opacity-75">
                ไม่เป็นไรเลย! มาดูวิธีแยกส่วนคิดทีละสเต็ปไปด้วยกันนะ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 opacity-60 hover:opacity-100"
            title="ปิด (Close)"
            aria-label="ปิด (Close)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-5 space-y-3">
          {steps.map((step, index) => (
            <div
              key={`${step.titleTH}-${index}`}
              className={`flex flex-col justify-between gap-2 rounded-2xl border p-3.5 sm:flex-row sm:items-center ${theme.panel}`}
            >
              <div>
                {renderStepTitle(step)}
                {renderStepDescription(step)}
              </div>
              <div
                className={`shrink-0 rounded-xl px-3 py-1.5 font-mono text-xs font-extrabold sm:text-sm ${theme.surface} ${theme.surfaceBorder} ${theme.textStrong}`}
              >
                {step.visual}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className={`rounded-2xl px-4 py-2.5 text-sm font-extrabold ${theme.buttonGhost}`}
          >
            ลองตอบอีกครั้ง
          </button>
          <button
            type="button"
            onClick={onContinue}
            className={`flex items-center gap-1 rounded-2xl px-5 py-2.5 text-sm font-extrabold ${theme.buttonPrimary}`}
          >
            <span>{isThai ? 'ทำต่อไป' : 'Continue'}</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
