'use client'

import { ChevronRight } from 'lucide-react'
import { playSound } from './audio'
import type { LangMode, LessonProblem, LessonThemeTokens } from './types'

export interface ConceptModeProps {
  problem: LessonProblem
  theme: LessonThemeTokens
  langMode: LangMode
  conceptStep: number
  onConceptStepChange: (step: number) => void
  onFinish: () => void
}

/**
 * Concept mode: the lesson taught one micro-step at a time before the learner
 * switches to practice.
 */
export function ConceptMode({
  problem,
  theme,
  langMode,
  conceptStep,
  onConceptStepChange,
  onFinish,
}: ConceptModeProps) {
  const microSteps = problem.conceptMicroSteps ?? []
  const step = microSteps[conceptStep]
  const isLower = theme.tier === 'lower'

  if (!step) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 py-2 text-center">
        <p className={`text-base font-semibold ${theme.textMuted}`}>ไม่มีเนื้อหาสอนเพิ่มเติมสำหรับบทเรียนนี้</p>
        <button
          onClick={onFinish}
          className={`rounded-2xl px-6 py-3 font-extrabold ${theme.buttonPrimary}`}
        >
          ไปที่แบบฝึกหัด
        </button>
      </div>
    )
  }

  const stepVisual = problem.steps[conceptStep]
  const isEnglish = langMode === 'EP'
  const title = isEnglish ? step.titleEN : step.titleTH
  const body = isEnglish ? step.bodyEN : step.bodyTH
  const actionLabel = isEnglish ? step.actionLabelEN : step.actionLabelTH

  return (
    <div className="flex h-full flex-col items-center justify-between py-2 text-center">
      <div className="flex w-full items-center justify-between border-b pb-3 border-current/10">
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-extrabold ${
              isLower
                ? 'bg-sky-100 text-sky-800'
                : 'border border-cyan-500/30 bg-indigo-950 text-cyan-300'
            }`}
          >
            💡 Interactive Concept Micro-Steps (โหมดสอนทีละสเต็ป)
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {microSteps.map((micro, idx) => (
            <button
              key={micro.titleTH || idx}
              onClick={() => onConceptStepChange(idx)}
              aria-label={`ไปที่สเต็ปที่ ${idx + 1}`}
              className={`h-2.5 rounded-full transition-all ${
                conceptStep === idx ? 'w-8 bg-emerald-500' : 'w-2.5 bg-slate-400/40'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="my-auto flex w-full max-w-2xl flex-col items-center gap-4">
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-2xl text-3xl shadow-md ${
            isLower ? 'border-2 border-amber-300 bg-amber-100' : 'border border-cyan-400/40 bg-indigo-950'
          }`}
        >
          {conceptStep === 0 ? '🧩' : conceptStep === 1 ? '⚡' : '🏆'}
        </div>

        <h2 className="text-xl font-extrabold sm:text-2xl">{title}</h2>
        {langMode === 'BILINGUAL' && <p className="-mt-2 text-sm font-bold opacity-75">{step.titleEN}</p>}

        <p className="max-w-xl text-base leading-relaxed opacity-90 sm:text-lg">{body}</p>

        <div
          className={`flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 p-5 ${
            isLower ? 'border-sky-200 bg-sky-50/90' : 'border-indigo-500/30 bg-slate-950/80'
          }`}
        >
          <div className="text-lg font-extrabold tracking-wide sm:text-xl">{stepVisual?.visual}</div>
          <div className="text-xs opacity-80 sm:text-sm">
            {stepVisual ? (isEnglish ? stepVisual.descEN || stepVisual.descTH : stepVisual.descTH) : null}
          </div>
        </div>

        <button
          onClick={() => {
            playSound('pop')
            if (conceptStep < microSteps.length - 1) {
              onConceptStepChange(conceptStep + 1)
            } else {
              onFinish()
            }
          }}
          className={`mt-2 flex items-center gap-2 rounded-2xl px-6 py-3.5 text-base font-extrabold shadow-lg transition-all active:scale-95 ${
            isLower
              ? 'bg-emerald-500 text-white shadow-[0_4px_0_#059669] hover:bg-emerald-600'
              : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
          }`}
        >
          <span>{actionLabel}</span>
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="text-xs opacity-60">
        เด็กๆ จะได้กดมีส่วนร่วมทีละขั้น (Active Micro-learning) แทนการนั่งดูคลิปวิดีโอยาวๆ
      </div>
    </div>
  )
}
