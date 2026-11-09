'use client'

import { BookOpen, Pencil } from 'lucide-react'
import { playSound } from './audio'
import type { FloatingUtilityDockProps as DockProps } from './types'

/**
 * The dock contract from types.ts plus an optional hint level.
 *
 * `hintLevel` is optional so the shell keeps working with the base contract;
 * when it is supplied the mascot button shows the current hint level as a
 * superscript badge, otherwise it falls back to the prototype's "?" badge.
 */
export type FloatingUtilityDockProps = DockProps & { hintLevel?: number }

/**
 * Zone 3 - the right hand floating utility dock (แถบเครื่องมือช่วยคิด).
 *
 * Only the button column lives here, the shell renders the drawers (the
 * scratchpad, the vocabulary bank and the mascot hint popover) next to it.
 */
export function FloatingUtilityDock(props: FloatingUtilityDockProps) {
  const {
    theme,
    scratchpadOpen,
    onToggleScratchpad,
    vocabOpen,
    onToggleVocab,
    hintOpen,
    onToggleHint,
    hintLevel,
  } = props

  const hintBadge = typeof hintLevel === 'number' && hintLevel > 0 ? String(hintLevel) : '?'

  return (
    <aside
      className={`ml-2 sm:ml-4 flex flex-col items-center gap-2.5 p-2 rounded-3xl border-2 z-30 shadow-xl ${theme.dock}`}
    >
      {/* Scratchpad Toggle Button */}
      <button
        onClick={() => {
          playSound('pop')
          onToggleScratchpad()
        }}
        className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex flex-col items-center justify-center gap-0.5 font-extrabold transition-all active:scale-95 shadow-md ${
          scratchpadOpen ? 'bg-amber-400 text-slate-950 ring-4 ring-white' : theme.dockButton
        }`}
        title="กระดานทดเลข (Scratchpad)"
      >
        <Pencil className="w-5 h-5" />
        <span className="text-[10px]">ทดเลข</span>
      </button>

      {/* Vocabulary Bank Button */}
      <button
        onClick={() => {
          playSound('pop')
          onToggleVocab()
        }}
        className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex flex-col items-center justify-center gap-0.5 font-extrabold transition-all active:scale-95 shadow-md ${
          vocabOpen ? 'bg-emerald-400 text-slate-950 ring-4 ring-white' : theme.dockButton
        }`}
        title="คลังศัพท์คณิต TH/EP (Math Glossary)"
      >
        <BookOpen className="w-5 h-5" />
        <span className="text-[10px]">คลังศัพท์</span>
      </button>

      {/* Mascot Progressive Hint Button */}
      <button
        onClick={() => {
          playSound('pop')
          onToggleHint()
        }}
        className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex flex-col items-center justify-center gap-0.5 font-extrabold transition-all active:scale-95 shadow-md ${
          hintOpen
            ? 'bg-pink-500 text-white ring-4 ring-white'
            : 'bg-indigo-600 hover:bg-indigo-500 text-white'
        }`}
        title="ขอคำใบ้จากมาสคอต (Progressive Hint)"
      >
        <span className="text-xl leading-none">🤖</span>
        <span className="text-[10px]">คำใบ้</span>
        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black flex items-center justify-center">
          {hintBadge}
        </span>
      </button>
    </aside>
  )
}

export default FloatingUtilityDock
