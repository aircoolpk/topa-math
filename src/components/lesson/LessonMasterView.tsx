'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { playSound } from './audio'
import { ConceptMode } from './ConceptMode'
import { BottomActionBar } from './BottomActionBar'
import { DynamicWorkspace } from './DynamicWorkspace'
import { ExitConfirmModal } from './ExitConfirmModal'
import { FloatingUtilityDock } from './FloatingUtilityDock'
import { HintDrawer } from './HintDrawer'
import { LessonTopBar } from './LessonTopBar'
import { ProblemZone } from './ProblemZone'
import { ScratchpadCanvas } from './ScratchpadCanvas'
import { StepByStepModal } from './StepByStepModal'
import { VocabDrawer } from './VocabDrawer'
import { getLessonTheme, tierForGrade } from './theme'
import type { FeedbackState, InputMode, LangMode, LessonMode, LessonProblem } from './types'

export interface LessonMasterViewProps {
  problems: LessonProblem[]
  /** Drives the age tier: 1-3 lower theme, 4-6 upper theme. */
  grade: number
  onExit?: () => void
  initialStars?: number
  initialGems?: number
}

/**
 * The lesson and practice shell.
 *
 * Four zones, no page scrolling:
 *   1. LessonTopBar        - exit, progress, language, rewards
 *   2. MainInteractiveStage- problem zone + dynamic workspace
 *   3. FloatingUtilityDock - scratchpad, vocabulary, mascot hint
 *   4. BottomActionBar     - choices / numpad and the empathic feedback loop
 */
export function LessonMasterView({
  problems,
  grade,
  onExit,
  initialStars = 120,
  initialGems = 15,
}: LessonMasterViewProps) {


  const [currentProblemIndex, setCurrentProblemIndex] = useState(0)
  const [lessonMode, setLessonMode] = useState<LessonMode>('practice')
  const [conceptStep, setConceptStep] = useState(0)
  const [langMode, setLangMode] = useState<LangMode>('BILINGUAL')
  const [isPeekingTranslation, setIsPeekingTranslation] = useState(false)
  const [activeGlossaryTerm, setActiveGlossaryTerm] = useState<string | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)

  const [stars, setStars] = useState(initialStars)
  const [gems, setGems] = useState(initialGems)
  const [rewardBurst, setRewardBurst] = useState(false)
  const [completedIds, setCompletedIds] = useState<string[]>([])

  const [inputMode, setInputMode] = useState<InputMode>('choices')
  const [selectedAnswer, setSelectedAnswer] = useState('')
  const [keypadValue, setKeypadValue] = useState('')
  const [wrongAttempts, setWrongAttempts] = useState(0)
  const [feedbackState, setFeedbackState] = useState<FeedbackState>('idle')

  const [scratchpadOpen, setScratchpadOpen] = useState(false)
  const [penColor, setPenColor] = useState('#ef4444')
  const [isEraser, setIsEraser] = useState(false)
  const [hintDrawerOpen, setHintDrawerOpen] = useState(false)
  const [hintLevel, setHintLevel] = useState(1)
  const [vocabDrawerOpen, setVocabDrawerOpen] = useState(false)
  const [exitModalOpen, setExitModalOpen] = useState(false)

  const problemsLength = problems.length
  const safeIndex = problemsLength > 0 ? currentProblemIndex % problemsLength : 0
  const currentProblem = problems[safeIndex]
  const theme = useMemo(
    () => getLessonTheme(currentProblem?.tier ?? tierForGrade(grade)),
    [currentProblem?.tier, grade],
  )

  // Reset the per-problem state whenever the learner moves on.
  useEffect(() => {
    setSelectedAnswer('')
    setKeypadValue('')
    setWrongAttempts(0)
    setFeedbackState('idle')
    setActiveGlossaryTerm(null)
    setHintDrawerOpen(false)
    setHintLevel(1)
    setConceptStep(0)
  }, [currentProblemIndex])

  const speakQuestion = useCallback(
    (lang: 'TH' | 'EP') => {
      if (!currentProblem) return
      playSound('pop')
      setIsSpeaking(true)
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
        const text = lang === 'TH' ? currentProblem.rawTTS_TH : currentProblem.rawTTS_EN
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = lang === 'TH' ? 'th-TH' : 'en-US'
        utterance.rate = 0.92
        utterance.onend = () => setIsSpeaking(false)
        utterance.onerror = () => setIsSpeaking(false)
        window.speechSynthesis.speak(utterance)
      } else {
        setTimeout(() => setIsSpeaking(false), 2000)
      }
    },
    [currentProblem],
  )

  const handleCheckAnswer = useCallback(() => {
    if (!currentProblem) return
    const answer = inputMode === 'choices' ? selectedAnswer : keypadValue
    if (!answer) return

    if (answer === currentProblem.correctAnswer) {
      playSound('success')
      setFeedbackState('correct')
      setCompletedIds((prev) =>
        prev.includes(currentProblem.id) ? prev : [...prev, currentProblem.id],
      )
      setStars((prev) => prev + 10)
      setGems((prev) => prev + 1)
      setRewardBurst(true)
      window.setTimeout(() => setRewardBurst(false), 1800)
    } else {
      playSound('nudge')
      if (wrongAttempts === 0) {
        // Attempt 1: gentle amber nudge, never a scary red cross.
        setWrongAttempts(1)
        setFeedbackState('nudge')
      } else {
        // Attempt 2: open the step by step solution.
        setWrongAttempts(2)
        setFeedbackState('solution_modal')
      }
    }
  }, [currentProblem, inputMode, keypadValue, selectedAnswer, wrongAttempts])

  const handleNextProblem = useCallback(() => {
    if (problemsLength === 0) return
    playSound('pop')
    setCurrentProblemIndex((prev) => (prev + 1) % problemsLength)
    setFeedbackState('idle')
  }, [problemsLength])

  if (!currentProblem) {
    return (
      <div
        className={`flex h-screen w-screen flex-col items-center justify-center gap-4 ${theme.shell}`}
        style={{ fontFamily: theme.fontFamily }}
      >
        <p className={`text-lg font-bold ${theme.text}`}>ยังไม่มีโจทย์สำหรับบทเรียนนี้</p>
        <button onClick={onExit} className={`rounded-2xl px-5 py-2.5 font-bold ${theme.buttonPrimary}`}>
          กลับหน้าหลัก
        </button>
      </div>
    )
  }

  const isEnglish = langMode === 'EP'
  const nudgeText = isEnglish ? currentProblem.nudgeEN : currentProblem.nudgeTH

  return (
    <div
      className={`flex h-screen w-screen flex-col justify-between overflow-hidden select-none transition-colors duration-500 ${theme.shell}`}
      style={{ fontFamily: theme.fontFamily }}
    >
      <LessonTopBar
        theme={theme}
        tier={theme.tier}
        langMode={langMode}
        onLangModeChange={setLangMode}
        lessonMode={lessonMode}
        onLessonModeChange={setLessonMode}
        tierLabel={currentProblem.gradeLabelTH}
        tierLabelEn={currentProblem.gradeLabelEN}
        problemIndex={safeIndex}
        problemCount={problemsLength}
        stars={stars}
        gems={gems}
        rewardBurst={rewardBurst}
        onExit={() => setExitModalOpen(true)}
      />

      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-3 py-3 sm:px-8">
        <div
          className={`relative flex h-full w-full max-w-6xl flex-col justify-between overflow-y-auto p-4 transition-all border sm:overflow-hidden sm:p-6 ${theme.stage}`}
        >
          {lessonMode === 'concept' ? (
            <ConceptMode
              problem={currentProblem}
              theme={theme}
              langMode={langMode}
              conceptStep={conceptStep}
              onConceptStepChange={setConceptStep}
              onFinish={() => setLessonMode('practice')}
            />
          ) : (
            <div className="flex min-h-full flex-col justify-between gap-3 sm:h-full">
              <ProblemZone
                problem={currentProblem}
                theme={theme}
                langMode={langMode}
                isPeekingTranslation={isPeekingTranslation}
                onTogglePeek={() => setIsPeekingTranslation((prev) => !prev)}
                isSpeaking={isSpeaking}
                onSpeak={speakQuestion}
                activeGlossaryTerm={activeGlossaryTerm}
                onGlossaryTermChange={setActiveGlossaryTerm}
              />
              <DynamicWorkspace
                problem={currentProblem}
                theme={theme}
                langMode={langMode}
              />
            </div>
          )}
        </div>

        <FloatingUtilityDock
          theme={theme}
          scratchpadOpen={scratchpadOpen}
          onToggleScratchpad={() => setScratchpadOpen((prev) => !prev)}
          vocabOpen={vocabDrawerOpen}
          onToggleVocab={() => setVocabDrawerOpen((prev) => !prev)}
          hintOpen={hintDrawerOpen}
          onToggleHint={() => setHintDrawerOpen((prev) => !prev)}
          hintLevel={hintLevel}
        />

        {hintDrawerOpen && (
          <HintDrawer
            theme={theme}
            open={hintDrawerOpen}
            onClose={() => setHintDrawerOpen(false)}
            hintLevel={hintLevel}
            onHintLevelChange={setHintLevel}
            hint1={isEnglish ? currentProblem.hint1EN : currentProblem.hint1TH}
            hint2={isEnglish ? currentProblem.hint2EN : currentProblem.hint2TH}
            langMode={langMode}
          />
        )}

        {vocabDrawerOpen && (
          <VocabDrawer
            theme={theme}
            open={vocabDrawerOpen}
            onClose={() => setVocabDrawerOpen(false)}
            langMode={langMode}
          />
        )}
      </main>

      <BottomActionBar
        theme={theme}
        feedbackState={feedbackState}
        inputMode={inputMode}
        onInputModeChange={setInputMode}
        choices={currentProblem.choices}
        selectedAnswer={selectedAnswer}
        onSelectAnswer={(answer: string) => {
          setSelectedAnswer(answer)
          if (feedbackState !== 'idle') setFeedbackState('idle')
        }}
        keypadValue={keypadValue}
        onKeypadValueChange={(value: string) => {
          setKeypadValue(value)
          if (feedbackState !== 'idle') setFeedbackState('idle')
        }}
        onCheck={handleCheckAnswer}
        onNext={handleNextProblem}
        showNext={feedbackState === 'correct'}
        nudgeText={nudgeText}
      />

      {scratchpadOpen && (
        <ScratchpadCanvas
          open={scratchpadOpen}
          onClose={() => setScratchpadOpen(false)}
          penColor={penColor}
          onPenColorChange={setPenColor}
          isEraser={isEraser}
          onEraserChange={setIsEraser}
          theme={theme}
        />
      )}

      <StepByStepModal
        open={feedbackState === 'solution_modal'}
        steps={currentProblem.steps}
        theme={theme}
        langMode={langMode}
        onClose={() => setFeedbackState('nudge')}
        onContinue={() => {
          setFeedbackState('nudge')
          setWrongAttempts(0)
        }}
      />

      <ExitConfirmModal
        open={exitModalOpen}
        theme={theme}
        onCancel={() => setExitModalOpen(false)}
        onConfirm={() => {
          setExitModalOpen(false)
          onExit?.()
        }}
      />
    </div>
  )
}
