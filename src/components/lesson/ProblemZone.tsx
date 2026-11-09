'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { Eye, Sparkles, Volume2, X } from 'lucide-react'
import { playSound } from './audio'
import { GlossaryDiagram, getGlossaryEntry } from './glossary'
import type { ProblemZoneProps, QuestionSegment } from './types'

/**
 * Problem statement panel.
 *
 * Owns the bilingual reading tools:
 *   - dual voice TTS (Thai / English program)
 *   - the "peek translation" reveal
 *   - the tokenised question with highlighted numbers and clickable glossary
 *     terms that open the visual glossary popover.
 */
export function ProblemZone(props: ProblemZoneProps) {
  const {
    problem,
    theme,
    langMode,
    isPeekingTranslation,
    onTogglePeek,
    isSpeaking,
    onSpeak,
    activeGlossaryTerm,
    onGlossaryTermChange,
  } = props

  // Press and hold reveals the translation without latching it, a tap latches it.
  const [isHoldingPeek, setIsHoldingPeek] = useState(false)
  const isPeeking = isPeekingTranslation || isHoldingPeek

  // English shows in EP and BILINGUAL, Thai shows in TH and BILINGUAL.
  // Peeking always reveals the other language on top of the current one.
  const showEnglish =
    langMode === 'EP' || langMode === 'BILINGUAL' || (langMode === 'TH' && isPeeking)
  const showThai =
    langMode === 'TH' || langMode === 'BILINGUAL' || (langMode === 'EP' && isPeeking)

  const glossaryEntry = getGlossaryEntry(activeGlossaryTerm)

  /**
   * Renders one tokenised line: plain text, highlighted numbers and glossary
   * terms that open the visual glossary popover.
   */
  const renderTokenizedLine = (segments: QuestionSegment[]): ReactNode => (
    <span className="leading-relaxed">
      {segments.map((segment, index) => {
        if (segment.term) {
          const isActive = activeGlossaryTerm === segment.term
          return (
            <button
              key={index}
              type="button"
              onClick={() => {
                playSound('pop')
                onGlossaryTermChange(isActive ? null : segment.term ?? null)
              }}
              className={`inline-flex cursor-pointer items-center gap-1 rounded-lg border-b-2 border-dashed px-1.5 py-0.5 font-bold transition-all mx-1 ${
                isActive
                  ? `${theme.buttonPrimary} scale-105`
                  : `${theme.surface} ${theme.surfaceBorder} ${theme.accentText}`
              }`}
              title="Click for Bilingual Visual Glossary"
            >
              <span>{segment.display ?? segment.term}</span>
              <Sparkles className="inline h-3.5 w-3.5 shrink-0 opacity-80" />
            </button>
          )
        }

        if (segment.highlight) {
          return (
            <span
              key={index}
              className={`inline-block rounded-lg px-2 py-0.5 font-extrabold shadow-sm mx-0.5 ${theme.buttonPrimary}`}
            >
              {segment.text}
            </span>
          )
        }

        return <span key={index}>{segment.text}</span>
      })}
    </span>
  )

  return (
    <div className={`relative rounded-2xl border p-3.5 transition-all sm:p-5 ${theme.panel}`}>
      <style>{`
        @keyframes lessonFadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: lessonFadeIn 0.2s ease-out;
        }
      `}</style>

      {/* Header Badges & Bilingual Controls */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`rounded-lg px-2.5 py-1 text-xs font-extrabold ${theme.surface} ${theme.surfaceBorder} ${theme.accentText}`}
          >
            {langMode === 'EP' ? problem.gradeLabelEN : problem.gradeLabelTH}
          </span>
          <span className="text-xs font-bold opacity-75">
            • แตะคำที่มีเส้นประเพื่อดูคลังศัพท์ภาพ (Visual Glossary)
          </span>
        </div>

        {/* Dual-Voice TTS & Peek Translation Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onSpeak('TH')}
            className={`flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold transition-all active:scale-95 ${theme.surface} ${theme.surfaceBorder} ${theme.text}`}
            title="อ่านโจทย์ภาษาไทย (Thai TTS)"
          >
            <Volume2 className={`h-3.5 w-3.5 text-orange-500 ${isSpeaking ? 'animate-ping' : ''}`} />
            <span>ฟัง TH</span>
          </button>

          <button
            type="button"
            onClick={() => onSpeak('EP')}
            className={`flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold transition-all active:scale-95 ${theme.surface} ${theme.surfaceBorder} ${theme.text}`}
            title="Listen in English (EP TTS)"
          >
            <Volume2 className={`h-3.5 w-3.5 text-blue-500 ${isSpeaking ? 'animate-ping' : ''}`} />
            <span>Listen EP</span>
          </button>

          {langMode !== 'BILINGUAL' && (
            <button
              type="button"
              onPointerDown={() => setIsHoldingPeek(true)}
              onPointerUp={() => setIsHoldingPeek(false)}
              onPointerLeave={() => setIsHoldingPeek(false)}
              onPointerCancel={() => setIsHoldingPeek(false)}
              onKeyDown={(event) => {
                if (event.key === ' ' || event.key === 'Enter') setIsHoldingPeek(true)
              }}
              onKeyUp={() => setIsHoldingPeek(false)}
              onClick={onTogglePeek}
              className={`flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold transition-all ${
                isPeeking ? theme.footerCorrect : theme.buttonGhost
              }`}
              title="แอบดูคำแปล (Peek translation)"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>แอบดูคำแปล (Peek)</span>
            </button>
          )}
        </div>
      </div>

      {/* Problem Text Display (Adaptive Font Size for Lower vs Upper Primary) */}
      <div className="space-y-1.5">
        {showEnglish && (
          <div className={`font-bold tracking-tight ${theme.questionSize}`}>
            {renderTokenizedLine(problem.questionEN)}
          </div>
        )}

        {showThai && (
          <div
            className={`font-bold ${
              langMode === 'BILINGUAL'
                ? `${theme.bodySize} ${theme.textMuted}`
                : theme.questionSize
            }`}
          >
            {renderTokenizedLine(problem.questionTH)}
          </div>
        )}
      </div>

      {/* Interactive Math Glossary Popover Card */}
      {glossaryEntry && (
        <div
          className={`mt-3 flex flex-col items-center justify-between gap-4 rounded-2xl border-2 p-3.5 shadow-xl z-20 animate-fadeIn sm:flex-row ${theme.modal}`}
        >
          <div className="flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-md px-2 py-0.5 text-xs font-extrabold ${theme.buttonPrimary}`}
              >
                EP Math Glossary
              </span>
              <span className={`text-base font-extrabold sm:text-lg ${theme.textStrong}`}>
                {glossaryEntry.en} = {glossaryEntry.th}
              </span>
              {glossaryEntry.phonetic ? (
                <span className="font-mono text-xs opacity-60">{glossaryEntry.phonetic}</span>
              ) : null}
            </div>
            <p className="text-xs opacity-90 sm:text-sm">🇹🇭 {glossaryEntry.descTH}</p>
            <p className="text-xs opacity-75">🇬🇧 {glossaryEntry.descEN}</p>
          </div>
          <div className="w-48 shrink-0">
            <GlossaryDiagram type={glossaryEntry.diagram} />
          </div>
          <button
            type="button"
            onClick={() => onGlossaryTermChange(null)}
            className="self-start rounded-lg p-1.5 opacity-60 hover:opacity-100"
            title="ปิดคลังศัพท์ (Close glossary)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
