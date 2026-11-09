'use client'

import { ArrowLeft, Calculator, Gem, Play, Star } from 'lucide-react'
import { playSound } from './audio'
import type { LangMode, LessonTopBarProps } from './types'

/**
 * Global fonts + the gentle shake animation used by the lesson shell.
 *
 * The prototype injected this <style> block from the root of the screen; the
 * shell mounts the top bar first, so the styles live here and are exported so
 * any other zone can reuse them if it is mounted on its own.
 */
export const LESSON_GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600;700&family=Nunito:wght@500;700;800&family=Sarabun:wght@400;600;700;800&display=swap');
  @keyframes gentleShake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-8px); }
    40% { transform: translateX(8px); }
    60% { transform: translateX(-5px); }
    80% { transform: translateX(5px); }
  }
  .animate-gentle-shake {
    animation: gentleShake 0.45s ease-in-out;
  }
`

const LANG_OPTIONS: ReadonlyArray<{ id: LangMode; label: string }> = [
  { id: 'TH', label: '🇹🇭 TH' },
  { id: 'EP', label: '🇬🇧 EP' },
  { id: 'BILINGUAL', label: '⚡ TH+EP' },
]

/**
 * Zone 1 - the top navigation bar.
 *
 * Exit, age-tier badge, concept/practice switcher, the animated lesson
 * progress bar, the TH / EP / bilingual engine switch and the live star + gem
 * reward counter with the "+10" burst.
 */
export function LessonTopBar(props: LessonTopBarProps) {
  const {
    theme,
    tier,
    langMode,
    onLangModeChange,
    lessonMode,
    onLessonModeChange,
    tierLabel,
    tierLabelEn,
    problemIndex,
    problemCount,
    stars,
    gems,
    rewardBurst,
    onExit,
  } = props

  const safeCount = Math.max(1, problemCount)
  const progress = Math.min(100, Math.max(0, ((problemIndex + 1) / safeCount) * 100))

  const tierEmoji = tier === 'lower' ? '🌱' : '🚀'
  const tierText =
    langMode === 'EP' ? tierLabelEn : langMode === 'TH' ? tierLabel : `${tierLabel} · ${tierLabelEn}`

  const modeLabel = lessonMode === 'concept' ? 'โหมดสอน (Concept)' : 'โหมดโจทย์ (Practice)'

  return (
    <>
      <style>{LESSON_GLOBAL_STYLES}</style>

      <header
        className={`h-16 px-3 sm:px-6 flex items-center justify-between gap-2 shrink-0 border-b z-30 transition-colors ${theme.header}`}
      >
        {/* Left: Exit Button + Age Tier Badge */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => {
              playSound('pop')
              onExit()
            }}
            className={`flex items-center gap-1.5 px-3 py-2 font-bold transition-all active:scale-95 ${theme.buttonPrimary} ${theme.radius}`}
            title="ออกจากบทเรียน (Exit)"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline text-sm">Exit</span>
          </button>

          {/* Current age tier (ป.1-ป.3 Adventure / ป.4-ป.6 Sci-Fi Quest) */}
          <div className={`flex items-center p-1 rounded-xl border ${theme.surface} ${theme.surfaceBorder}`}>
            <span
              className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all shadow-sm ${theme.accent} text-white`}
              title={tier === 'lower' ? 'Adventure tier (ป.1-ป.3)' : 'Sci-Fi Quest tier (ป.4-ป.6)'}
            >
              {tierEmoji} {tierText}
            </span>
          </div>

          {/* Concept vs Practice Mode Switcher */}
          <div
            className={`hidden md:flex items-center p-1 rounded-xl border ${theme.surface} ${theme.surfaceBorder}`}
          >
            <button
              onClick={() => {
                playSound('pop')
                onLessonModeChange('concept')
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                lessonMode === 'concept' ? `${theme.accent} text-white shadow-sm` : theme.textMuted
              }`}
              title="โหมดสอน (Concept)"
            >
              <Play className="w-3 h-3" />
              <span>โหมดสอน (Concept)</span>
            </button>
            <button
              onClick={() => {
                playSound('pop')
                onLessonModeChange('practice')
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                lessonMode === 'practice' ? `${theme.accent} text-white shadow-sm` : theme.textMuted
              }`}
              title="โหมดโจทย์ (Practice)"
            >
              <Calculator className="w-3 h-3" />
              <span>โหมดโจทย์ (Practice)</span>
            </button>
          </div>
        </div>

        {/* Center: Animated Lesson Progress Bar */}
        <div className="flex-1 max-w-xs mx-2 hidden sm:flex flex-col gap-1">
          <div className="flex justify-between items-center text-xs font-bold px-1">
            <span className={theme.headerMuted}>
              ด่านที่ {problemIndex + 1} / {problemCount}
            </span>
            <span className={theme.accentText}>{modeLabel}</span>
          </div>
          <div
            className={`w-full h-3.5 rounded-full overflow-hidden p-0.5 border ${theme.surface} ${theme.surfaceBorder}`}
          >
            <div
              className={`h-full rounded-full transition-all duration-500 ${theme.accent}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Right: Language Toggle (TH / EP / Bilingual) & Real-time Reward Counter */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Bilingual Engine Switcher */}
          <div
            className={`flex items-center p-1 rounded-xl border ${theme.surface} ${theme.surfaceBorder}`}
          >
            {LANG_OPTIONS.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  playSound('pop')
                  onLangModeChange(item.id)
                }}
                className={`px-2 py-1 rounded-lg text-xs font-extrabold transition-all ${
                  langMode === item.id
                    ? `${theme.accent} text-white shadow-sm`
                    : `${theme.textMuted} hover:opacity-80`
                }`}
                title={`เปลี่ยนภาษาเป็น ${item.label}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Reward Counter (Stars & Gems) */}
          <div
            className={`relative flex items-center gap-2.5 px-3 py-1.5 rounded-2xl font-extrabold border ${theme.surface} ${theme.surfaceBorder} ${theme.text}`}
          >
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
              <span className="text-sm">{stars}</span>
            </div>
            <div className="w-px h-4 bg-current opacity-20" />
            <div className="flex items-center gap-1">
              <Gem className="w-4 h-4 fill-pink-400 text-pink-500" />
              <span className="text-sm">{gems}</span>
            </div>

            {/* Floating +10 Star Burst Animation */}
            {rewardBurst && (
              <div className="absolute -bottom-8 right-0 bg-emerald-500 text-white text-xs font-extrabold px-2.5 py-1 rounded-full shadow-lg animate-bounce whitespace-nowrap">
                +10 ⭐ +1 💎
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  )
}

export default LessonTopBar
