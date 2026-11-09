'use client'

import { BookOpen, X } from 'lucide-react'
import { playSound } from './audio'
import { GLOSSARY_DB, GlossaryDiagram } from './glossary'
import type { VocabDrawerProps } from './types'

/**
 * The floating maths vocabulary bank (คลังศัพท์คณิตศาสตร์ EP / TH).
 *
 * Every entry of the glossary is listed with its Thai and its English meaning
 * plus the little visual diagram that makes the idea click.
 */
export function VocabDrawer(props: VocabDrawerProps) {
  const { theme, open, onClose, langMode } = props

  if (!open) return null

  const isEnglish = langMode === 'EP'
  const showEnglish = langMode === 'EP' || langMode === 'BILINGUAL'

  return (
    <div
      className={`absolute right-20 sm:right-28 top-6 w-80 sm:w-96 p-4 rounded-3xl border-2 shadow-2xl z-40 max-h-[80%] overflow-y-auto ${theme.modal} ${theme.modalBorder}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-sky-500" />
          <h4 className="font-extrabold text-sm">คลังศัพท์คณิตศาสตร์ EP / TH</h4>
        </div>
        <button
          onClick={() => {
            playSound('pop')
            onClose()
          }}
          className="p-1 opacity-60 hover:opacity-100"
          title="ปิดคลังศัพท์ (Close)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2.5">
        {Object.entries(GLOSSARY_DB).map(([key, item]) => (
          <div key={key} className={`p-2.5 rounded-2xl border ${theme.surface} ${theme.surfaceBorder}`}>
            <div className="flex items-center justify-between font-extrabold text-sm">
              <span className="text-amber-500">{item.en}</span>
              <span>{item.th}</span>
            </div>
            <p className="text-xs opacity-80 mt-1">{isEnglish ? item.descEN : item.descTH}</p>
            {showEnglish && langMode === 'BILINGUAL' ? (
              <p className="text-xs opacity-70 mt-1">{item.descEN}</p>
            ) : null}
            <div className="mt-2">
              <GlossaryDiagram type={item.diagram} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default VocabDrawer
