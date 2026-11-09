import type { LessonThemeTokens, LessonTier } from './types'

/**
 * Adaptive age-tiered theme engine.
 *
 * Grades 1-3 (ป.1-ป.3) get the "lower" theme: warm pastel, amber-orange,
 * soft rounded corners and large type for early readers.
 *
 * Grades 4-6 (ป.4-ป.6) get the "upper" theme: sci-fi quest, slate-950 dark
 * mode, sharper corners and a bento grid feel.
 */
export function tierForGrade(grade: number): LessonTier {
  if (Number.isFinite(grade) && grade >= 1 && grade <= 3) return 'lower'
  if (Number.isFinite(grade) && grade >= 4 && grade <= 6) return 'upper'
  // Fall back to the tier that reads best for the given grade.
  return grade <= 3 ? 'lower' : 'upper'
}

const lowerTheme: LessonThemeTokens = {
  tier: 'lower',
  shell:
    'bg-gradient-to-b from-sky-100 via-amber-50/60 to-emerald-50 text-slate-800',
  fontFamily: "'Fredoka', 'Sarabun', sans-serif",
  header: 'bg-white/90 backdrop-blur-md border-amber-200 shadow-sm',
  headerText: 'text-slate-800',
  headerMuted: 'text-slate-600',
  stage: 'bg-white/95 border-amber-300 rounded-[28px] shadow-[0_10px_30px_rgba(245,158,11,0.15)]',
  panel: 'bg-amber-50/70 border-amber-200',
  panelBorder: 'border-amber-200',
  surface: 'bg-white',
  surfaceBorder: 'border-amber-200',
  text: 'text-slate-800',
  textMuted: 'text-slate-500',
  textStrong: 'text-slate-900',
  accent: 'bg-sky-600',
  accentText: 'text-sky-600',
  footerIdle: 'bg-sky-600 border-sky-700 text-white',
  footerNudge: 'bg-amber-400 border-amber-500 text-slate-950',
  footerCorrect: 'bg-emerald-500 border-emerald-600 text-white',
  dock: 'bg-sky-500/95 border-sky-300 text-white',
  dockButton: 'bg-white/25 hover:bg-white/40 border-white/40',
  overlay: 'bg-slate-950/70 backdrop-blur-sm',
  modal: 'bg-white border-amber-400 text-slate-800',
  modalBorder: 'border-amber-400',
  buttonPrimary: 'bg-sky-600 text-white hover:bg-sky-700',
  buttonGhost: 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50',
  questionSize: 'text-lg sm:text-2xl',
  radius: 'rounded-3xl',
  bodySize: 'text-base',
}

const upperTheme: LessonThemeTokens = {
  tier: 'upper',
  shell:
    'bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-slate-100',
  fontFamily: "'Nunito', 'Sarabun', sans-serif",
  header: 'bg-slate-900/90 backdrop-blur-md border-indigo-500/30 shadow-lg',
  headerText: 'text-slate-100',
  headerMuted: 'text-slate-300',
  stage: 'bg-slate-900/90 border-indigo-500/40 rounded-2xl shadow-[0_10px_40px_rgba(6,182,212,0.12)]',
  panel: 'bg-slate-950/70 border-indigo-500/30',
  panelBorder: 'border-indigo-500/30',
  surface: 'bg-slate-800/80',
  surfaceBorder: 'border-indigo-500/30',
  text: 'text-slate-100',
  textMuted: 'text-slate-400',
  textStrong: 'text-white',
  accent: 'bg-cyan-500',
  accentText: 'text-cyan-400',
  footerIdle: 'bg-slate-900 border-indigo-500/40 text-slate-100',
  footerNudge: 'bg-amber-400 border-amber-500 text-slate-950',
  footerCorrect: 'bg-emerald-500 border-emerald-600 text-white',
  dock: 'bg-slate-900/95 border-indigo-500/40 text-slate-100',
  dockButton: 'bg-white/10 hover:bg-white/20 border-indigo-500/40',
  overlay: 'bg-slate-950/75 backdrop-blur-sm',
  modal: 'bg-slate-900 border-cyan-400 text-slate-100',
  modalBorder: 'border-cyan-400',
  buttonPrimary: 'bg-cyan-500 text-slate-950 hover:bg-cyan-400',
  buttonGhost: 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700',
  questionSize: 'text-base sm:text-xl',
  radius: 'rounded-2xl',
  bodySize: 'text-sm',
}

export function getLessonTheme(tier: LessonTier): LessonThemeTokens {
  return tier === 'lower' ? lowerTheme : upperTheme
}

/** Theme for a raw grade number (1-6). */
export function getThemeForGrade(grade: number): LessonThemeTokens {
  return getLessonTheme(tierForGrade(grade))
}
