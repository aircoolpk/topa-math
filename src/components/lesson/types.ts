import type { ReactNode } from 'react'
/**
 * Shared data contract for the Lesson & Practice master architecture.
 *
 * Every component in src/components/lesson speaks these types, so a lesson
 * only has to be mapped into LessonProblem[] to render anywhere in the new
 * architecture.
 */

export type LessonTier = 'lower' | 'upper'

export type LangMode = 'TH' | 'EP' | 'BILINGUAL'

export type InputMode = 'choices' | 'keypad'

export type FeedbackState = 'idle' | 'nudge' | 'correct' | 'solution_modal'

export type LessonMode = 'practice' | 'concept'

/** Which interactive manipulative a problem is played with. */
export type WorkspaceType = 'base10' | 'barModel' | 'fraction' | 'clock' | 'none'

export type GlossaryDiagramKind =
  | 'addition'
  | 'tens'
  | 'difference'
  | 'ratio'
  | 'perimeter'
  | 'equal_parts'

/** One piece of a bilingual question. */
export interface QuestionSegment {
  text?: string
  highlight?: boolean
  /** Glossary key - clicking it opens the visual glossary popover. */
  term?: string
  /** The text shown in the current language (defaults to the term key). */
  display?: string
}

/** One step of the worked solution shown in the StepByStepModal. */
export interface LessonStep {
  titleTH: string
  titleEN: string
  descTH: string
  descEN: string
  /** Small illustrative string shown under the description. */
  visual?: string
}

/** One micro-step of the concept (teaching) mode. */
export interface MicroStep {
  titleTH: string
  titleEN: string
  bodyTH: string
  bodyEN: string
  actionLabelTH?: string
  actionLabelEN?: string
  emoji?: string
}

export interface Base10Config {
  initialTens: number
  initialOnes: number
  targetTens: number
  targetOnes: number
  /** Emoji used for the ones cubes. */
  unitEmoji?: string
}

export interface BarModelConfig {
  defaultPartsA: number
  defaultPartsB: number
  unitValue: number
  labelA_TH: string
  labelA_EN: string
  labelB_TH: string
  labelB_EN: string
  /** When set, a difference bracket is drawn between the two bars. */
  differenceValue?: number
  /** Total value of all units together (e.g. 45 students). */
  totalValue?: number
}

export interface FractionConfig {
  numerator: number
  denominator: number
  /** Target fraction the learner has to build, e.g. 5/8. */
  targetNumerator?: number
  targetDenominator?: number
  /** How many parts start out shaded. */
  shadedParts?: number
}

export interface ClockConfig {
  hour: number
  minute: number
  targetHour?: number
  targetMinute?: number
}

export interface LessonProblem {
  id: string
  tier: LessonTier
  /** Drives which workspace the DynamicWorkspace mounts. */
  workspaceType: WorkspaceType
  gradeLabelTH: string
  gradeLabelEN: string
  topicTH: string
  topicEN: string
  questionEN: QuestionSegment[]
  questionTH: QuestionSegment[]
  rawTTS_EN: string
  rawTTS_TH: string
  choices: string[]
  correctAnswer: string
  hint1TH: string
  hint1EN: string
  hint2TH: string
  hint2EN: string
  nudgeTH: string
  nudgeEN: string
  steps: LessonStep[]
  conceptMicroSteps?: MicroStep[]
  base10Config?: Base10Config
  barModelConfig?: BarModelConfig
  fractionConfig?: FractionConfig
  clockConfig?: ClockConfig
}

export interface GlossaryEntry {
  en: string
  th: string
  phonetic?: string
  descEN: string
  descTH: string
  diagram?: GlossaryDiagramKind
}

/** Props every workspace receives from the DynamicWorkspace. */
export interface WorkspaceProps {
  problem: LessonProblem
  tier: LessonTier
  langMode: LangMode
  theme: LessonThemeTokens
  /** Bumped by the shell when the learner picks a new problem. */
  problemId: string
}

export interface LessonThemeTokens {
  tier: LessonTier
  /** Root shell background and text colour. */
  shell: string
  fontFamily: string
  header: string
  headerText: string
  headerMuted: string
  stage: string
  panel: string
  panelBorder: string
  surface: string
  surfaceBorder: string
  text: string
  textMuted: string
  textStrong: string
  accent: string
  accentText: string
  footerIdle: string
  footerNudge: string
  footerCorrect: string
  dock: string
  dockButton: string
  overlay: string
  modal: string
  modalBorder: string
  buttonPrimary: string
  buttonGhost: string
  /** Question text size, larger for the lower tier. */
  questionSize: string
  /** Card corner radius - softer for the lower tier. */
  radius: string
  /** Base font size for body copy. */
  bodySize: string
}


/* ------------------------------------------------------------------ */
/* Component contracts. Every zone component takes its data through     */
/* these props so the shell can be assembled in any order.              */
/* ------------------------------------------------------------------ */

export interface LessonTopBarProps {
  theme: LessonThemeTokens
  tier: LessonTier
  langMode: LangMode
  onLangModeChange: (mode: LangMode) => void
  lessonMode: LessonMode
  onLessonModeChange: (mode: LessonMode) => void
  tierLabel: string
  tierLabelEn: string
  problemIndex: number
  problemCount: number
  stars: number
  gems: number
  rewardBurst: boolean
  onExit: () => void
}

export interface ProblemZoneProps {
  problem: LessonProblem
  theme: LessonThemeTokens
  langMode: LangMode
  isPeekingTranslation: boolean
  onTogglePeek: () => void
  isSpeaking: boolean
  onSpeak: (lang: 'TH' | 'EP') => void
  activeGlossaryTerm: string | null
  onGlossaryTermChange: (term: string | null) => void
}

export interface DynamicWorkspaceProps {
  problem: LessonProblem
  theme: LessonThemeTokens
  langMode: LangMode
}

export interface FloatingUtilityDockProps {
  theme: LessonThemeTokens
  scratchpadOpen: boolean
  onToggleScratchpad: () => void
  vocabOpen: boolean
  onToggleVocab: () => void
  hintOpen: boolean
  onToggleHint: () => void
}

export interface ScratchpadCanvasProps {
  open: boolean
  onClose: () => void
  penColor: string
  onPenColorChange: (color: string) => void
  isEraser: boolean
  onEraserChange: (isEraser: boolean) => void
  theme: LessonThemeTokens
}

export interface BottomActionBarProps {
  theme: LessonThemeTokens
  feedbackState: FeedbackState
  inputMode: InputMode
  onInputModeChange: (mode: InputMode) => void
  choices: string[]
  selectedAnswer: string
  onSelectAnswer: (answer: string) => void
  keypadValue: string
  onKeypadValueChange: (value: string) => void
  onCheck: () => void
  onNext: () => void
  showNext: boolean
  nudgeText: string
}

export interface StepByStepModalProps {
  open: boolean
  steps: LessonStep[]
  theme: LessonThemeTokens
  langMode: LangMode
  onClose: () => void
  onContinue: () => void
}

export interface ExitConfirmModalProps {
  open: boolean
  theme: LessonThemeTokens
  onCancel: () => void
  onConfirm: () => void
}

export interface HintDrawerProps {
  theme: LessonThemeTokens
  open: boolean
  onClose: () => void
  hintLevel: number
  onHintLevelChange: (level: number) => void
  hint1: string
  hint2: string
  langMode: LangMode
}

export interface VocabDrawerProps {
  theme: LessonThemeTokens
  open: boolean
  onClose: () => void
  langMode: LangMode
}
