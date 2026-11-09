'use client'

import { Calculator, CheckCircle2, ChevronRight, Delete } from 'lucide-react'
import { playSound } from './audio'
import type { BottomActionBarProps } from './types'

const CHOICE_LETTERS = ['A', 'B', 'C', 'D']

const CHOICE_COLORS = [
  'from-rose-500 to-orange-500 border-rose-700',
  'from-amber-400 to-orange-500 border-amber-600',
  'from-cyan-400 to-teal-500 border-teal-700',
  'from-purple-500 to-indigo-600 border-indigo-800',
]

const KEYPAD_DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']

/** The answer the learner is working on, depending on the active input mode. */
function currentAnswer(inputMode: BottomActionBarProps['inputMode'], selectedAnswer: string, keypadValue: string) {
  return inputMode === 'choices' ? selectedAnswer : keypadValue
}

/**
 * Zone 4: the bottom action bar.
 *
 * Holds the empathic feedback loop (gentle amber nudge, celebratory green
 * success), the input mode switcher between multiple choice and the custom
 * number keypad, and the prominent Check / Next call to action.
 */
export function BottomActionBar(props: BottomActionBarProps) {
  const {
    theme,
    feedbackState,
    inputMode,
    onInputModeChange,
    choices,
    selectedAnswer,
    onSelectAnswer,
    keypadValue,
    onKeypadValueChange,
    onCheck,
    onNext,
    showNext,
    nudgeText,
  } = props

  // What the learner currently typed / picked, in the active input mode.
  const answer = currentAnswer(inputMode, selectedAnswer, keypadValue)
  const isNudge = feedbackState === 'nudge'
  const isCorrect = feedbackState === 'correct'

  const footerTone = isCorrect
    ? theme.footerCorrect
    : isNudge
      ? `${theme.footerNudge} animate-gentle-shake`
      : theme.footerIdle

  const handleDigit = (digit: string) => {
    playSound('pop')
    if (keypadValue.length < 3) onKeypadValueChange(keypadValue + digit)
  }

  const handleBackspace = () => {
    playSound('pop')
    onKeypadValueChange(keypadValue.slice(0, -1))
  }

  const handleClear = () => {
    playSound('pop')
    onKeypadValueChange('')
  }

  return (
    <footer
      className={`z-30 border-t-2 px-3 py-3 transition-colors duration-300 sm:px-8 ${footerTone}`}
    >
      <style>{`
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
      `}</style>

      <div className="mx-auto flex max-w-6xl flex-col gap-2">
        {/* Empathetic Nudge Banner (Attempt 1 - No Red Cross!) */}
        {isNudge && (
          <div className="flex items-center justify-between rounded-2xl bg-white/90 px-4 py-2 text-slate-900 shadow-md">
            <div className="flex items-center gap-2 text-xs font-extrabold sm:text-sm">
              <span className="text-xl">🤖</span>
              <span>{nudgeText}</span>
            </div>
            {/* Re-submitting while the learner is nudged escalates to the
                step by step solution in the lesson shell. */}
            <button
              type="button"
              onClick={onCheck}
              className="ml-2 shrink-0 rounded-xl bg-amber-500 px-3 py-1 text-xs font-extrabold text-white"
              title="ดูวิธีคิดทีละขั้น (Show the worked solution)"
            >
              ดูวิธีคิดทีละขั้น
            </button>
          </div>
        )}

        {/* Celebratory Correct Banner */}
        {isCorrect && (
          <div className="flex items-center justify-between rounded-2xl bg-white/20 px-4 py-1.5">
            <div className="flex items-center gap-2 text-sm font-extrabold sm:text-base">
              <CheckCircle2 className="h-6 w-6 text-white" />
              <span>
                ยอดเยี่ยมมาก! คำตอบที่ถูกต้องคือ {answer || selectedAnswer} (รับเพิ่ม +10 ⭐ และ +1 💎)
              </span>
            </div>
          </div>
        )}

        {/* Main Input Row: Input Mode Toggle + Choices/Keypad + Check Answer CTA */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Input Switcher (Multiple Choice vs Custom Number Pad) */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                playSound('pop')
                onInputModeChange(inputMode === 'choices' ? 'keypad' : 'choices')
              }}
              className="flex items-center gap-1.5 rounded-xl bg-black/20 px-3 py-2 text-xs font-extrabold hover:bg-black/30"
              title="สลับโหมดตัวเลือก A,B,C,D หรือ แป้นพิมพ์ตัวเลข"
            >
              <Calculator className="h-4 w-4" />
              <span className="hidden md:inline">
                {inputMode === 'choices' ? 'สลับเป็นแป้นตัวเลข' : 'สลับเป็นตัวเลือก A-D'}
              </span>
            </button>
          </div>

          {/* CENTER: MULTIPLE CHOICE BUTTONS OR CUSTOM NUMBER KEYPAD */}
          {inputMode === 'choices' ? (
            <div className="flex max-w-2xl flex-1 items-center justify-center gap-2 sm:gap-4">
              {choices.map((choice, idx) => {
                const isSelected = selectedAnswer === choice
                const choiceColor = CHOICE_COLORS[idx % CHOICE_COLORS.length]

                return (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => {
                      playSound('pop')
                      onSelectAnswer(choice)
                    }}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-b px-3 py-2.5 text-white font-extrabold shadow-lg transition-all active:translate-y-0.5 sm:py-3 border-b-4 ${
                      choiceColor
                    } ${
                      isSelected ? 'ring-4 scale-105 brightness-110 ring-white' : 'opacity-90 hover:opacity-100'
                    }`}
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-black/25 text-xs">
                      {CHOICE_LETTERS[idx] ?? idx + 1}
                    </span>
                    <span className="text-lg sm:text-2xl">{choice}</span>
                  </button>
                )
              })}
            </div>
          ) : (
            /* Custom On-Screen Number Keypad (Zero OS Keyboard Obstruction) */
            <div className="flex max-w-2xl flex-1 flex-wrap items-center justify-center gap-1.5">
              <div className="mr-2 min-w-[72px] rounded-xl bg-white px-4 py-2 text-center text-xl font-extrabold text-slate-900 shadow-inner">
                {keypadValue || '?'}
              </div>
              {KEYPAD_DIGITS.map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleDigit(num)}
                  className="h-9 w-9 rounded-xl bg-white/95 text-base font-extrabold text-slate-900 shadow transition-colors hover:bg-white active:scale-95 sm:h-10 sm:w-10"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={handleBackspace}
                className="flex h-9 items-center justify-center rounded-xl bg-white/95 px-2.5 text-slate-900 shadow transition-colors hover:bg-white active:scale-95 sm:h-10"
                title="ลบตัวเลขท้ายหลัง (Backspace)"
                aria-label="ลบตัวเลขท้ายหลัง (Backspace)"
              >
                <Delete className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="h-9 rounded-xl bg-rose-500 px-2.5 text-xs font-extrabold text-white sm:h-10"
                title="ล้างคำตอบ (Clear)"
              >
                ล้าง
              </button>
            </div>
          )}

          {/* RIGHT: PROMINENT CHECK / NEXT BUTTON */}
          <div>
            {showNext ? (
              <button
                type="button"
                onClick={onNext}
                className="flex animate-bounce items-center gap-2 rounded-2xl bg-white px-6 py-3 text-base font-extrabold text-emerald-700 shadow-[0_4px_0_#047857] hover:bg-emerald-50 sm:text-lg"
              >
                <span>ข้อต่อไป (Next)</span>
                <ChevronRight className="h-5 w-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onCheck}
                disabled={!answer}
                className={`flex items-center gap-2 rounded-2xl px-6 py-3 text-base font-extrabold transition-all sm:text-lg ${
                  answer
                    ? 'cursor-pointer border-b-4 border-emerald-800 bg-gradient-to-b from-emerald-400 to-emerald-600 text-white shadow-xl hover:from-emerald-300 hover:to-emerald-500 active:translate-y-0.5'
                    : 'cursor-not-allowed bg-slate-400/40 text-white/60'
                }`}
              >
                <CheckCircle2 className="h-5 w-5" />
                <div className="text-left leading-tight">
                  <div className="text-sm sm:text-base">ตรวจคำตอบ</div>
                  <div className="text-[10px] font-semibold opacity-85">Check Answer</div>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>
    </footer>
  )
}
