'use client'

import { useEffect, useState } from 'react'
import { playSound } from '../audio'
import type { WorkspaceProps } from '../types'

/**
 * UPPER PRIMARY WORKSPACE: Singapore Math bar model builder.
 *
 * Ported from the approved prototype
 * (src/reference/LessonMasterPrototype.jsx, upper primary workspace).
 *
 * Like the base-10 board this workspace owns its local state and re-seeds it
 * whenever the shell bumps `problemId`.
 */

const DEFAULT_PARTS_A = 3
const DEFAULT_PARTS_B = 2
const MIN_PARTS = 1
const MAX_PARTS = 6

interface BarModelSeed {
  partsA: number
  partsB: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function seedFromConfig(problem: WorkspaceProps['problem']): BarModelSeed {
  const config = problem.barModelConfig
  return {
    partsA: clamp(config?.defaultPartsA ?? DEFAULT_PARTS_A, MIN_PARTS, MAX_PARTS),
    partsB: clamp(config?.defaultPartsB ?? DEFAULT_PARTS_B, MIN_PARTS, MAX_PARTS),
  }
}

export function BarModelWorkspace(props: WorkspaceProps) {
  const { problem, theme, langMode, problemId } = props
  const config = problem.barModelConfig

  const [barPartsA, setBarPartsA] = useState<number>(() => seedFromConfig(problem).partsA)
  const [barPartsB, setBarPartsB] = useState<number>(() => seedFromConfig(problem).partsB)
  const [showUnitValues, setShowUnitValues] = useState<boolean>(false)
  const [showBrackets, setShowBrackets] = useState<boolean>(true)

  // Reset the model whenever the learner moves to another problem.
  useEffect(() => {
    const seed = seedFromConfig(problem)
    setBarPartsA(seed.partsA)
    setBarPartsB(seed.partsB)
    setShowUnitValues(false)
    setShowBrackets(true)
    // `problemId` is the reset signal; the problem object itself is stable
    // for the lifetime of a problem in the shell.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemId])

  const isEnglish = langMode === 'EP'
  const labelA = isEnglish ? config?.labelA_EN : config?.labelA_TH
  const labelB = isEnglish ? config?.labelB_EN : config?.labelB_TH
  const unitValue = config?.unitValue
  const differenceValue = config?.differenceValue
  // The prototype only surfaces the "altogether" total on the ratio problem
  // (the one without a difference bracket). Driven by config, not by problem id.
  const showTotal = config?.totalValue !== undefined && differenceValue === undefined

  function stepPartsA(delta: number) {
    playSound('pop')
    setBarPartsA((prev) => clamp(prev + delta, MIN_PARTS, MAX_PARTS))
  }

  function stepPartsB(delta: number) {
    playSound('pop')
    setBarPartsB((prev) => clamp(prev + delta, MIN_PARTS, MAX_PARTS))
  }

  function toggleUnitValues() {
    playSound('pop')
    setShowUnitValues((prev) => !prev)
  }

  function toggleBrackets() {
    playSound('pop')
    setShowBrackets((prev) => !prev)
  }

  return (
    <div
      className={`flex-1 min-h-[210px] border-2 p-3 sm:p-5 flex flex-col justify-between relative overflow-hidden ${theme.surface} ${theme.surfaceBorder} ${theme.radius}`}
    >
      <div className="h-full flex flex-col justify-between">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-extrabold text-cyan-300 bg-indigo-950/90 px-3 py-1 rounded-xl border border-cyan-500/30">
              📊 เครื่องมือสร้างบาร์โมเดล (Singapore Math Bar Model Builder)
            </span>
          </div>

          {/* Interactive Bar Model Toggles */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleUnitValues}
              aria-pressed={showUnitValues}
              className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all ${
                showUnitValues
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-extrabold'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {showUnitValues ? `✅ แสดงค่า 1 ส่วน = ${unitValue ?? '-'}` : '👁️ แสดงค่าต่อช่อง (Show 1 Unit Value)'}
            </button>

            <button
              type="button"
              onClick={toggleBrackets}
              aria-pressed={showBrackets}
              className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all ${
                showBrackets
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              📐 เส้นปีกกาข้อมูลโจทย์
            </button>
          </div>
        </div>

        {/* Bar Model Visual Canvas */}
        <div className="my-auto py-3 px-2 sm:px-6 flex flex-col gap-4">
          {/* Bar A */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <div className="w-40 shrink-0 flex items-center justify-between">
              <span className="text-xs sm:text-sm font-extrabold text-cyan-300">{labelA ?? '-'}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => stepPartsA(-1)}
                  aria-label="ลดจำนวนส่วนของบาร์ A ลง 1 ส่วน"
                  className="w-6 h-6 rounded-md bg-slate-800 border border-slate-600 flex items-center justify-center text-xs hover:bg-slate-700"
                >
                  -
                </button>
                <span className="text-xs font-mono w-4 text-center">{barPartsA}</span>
                <button
                  type="button"
                  onClick={() => stepPartsA(1)}
                  aria-label="เพิ่มจำนวนส่วนของบาร์ A ขึ้น 1 ส่วน"
                  className="w-6 h-6 rounded-md bg-slate-800 border border-slate-600 flex items-center justify-center text-xs hover:bg-slate-700"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex-1 flex items-center gap-1.5">
              {Array.from({ length: barPartsA }, (_, idx) => (
                <div
                  key={idx}
                  className="h-11 w-16 sm:w-24 rounded-lg bg-gradient-to-b from-cyan-500 to-blue-600 border-2 border-cyan-300 flex items-center justify-center font-extrabold text-slate-950 shadow-md transition-all"
                >
                  {showUnitValues ? unitValue : '1 unit'}
                </div>
              ))}
              {showBrackets && (
                <span className="ml-2 px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-400 text-amber-300 text-xs font-extrabold">
                  ? (สิ่งที่โจทย์ถาม = {barPartsA} ส่วน)
                </span>
              )}
            </div>
          </div>

          {/* Bar B */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <div className="w-40 shrink-0 flex items-center justify-between">
              <span className="text-xs sm:text-sm font-extrabold text-indigo-300">{labelB ?? '-'}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => stepPartsB(-1)}
                  aria-label="ลดจำนวนส่วนของบาร์ B ลง 1 ส่วน"
                  className="w-6 h-6 rounded-md bg-slate-800 border border-slate-600 flex items-center justify-center text-xs hover:bg-slate-700"
                >
                  -
                </button>
                <span className="text-xs font-mono w-4 text-center">{barPartsB}</span>
                <button
                  type="button"
                  onClick={() => stepPartsB(1)}
                  aria-label="เพิ่มจำนวนส่วนของบาร์ B ขึ้น 1 ส่วน"
                  className="w-6 h-6 rounded-md bg-slate-800 border border-slate-600 flex items-center justify-center text-xs hover:bg-slate-700"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex-1 flex items-center gap-1.5">
              {Array.from({ length: barPartsB }, (_, idx) => (
                <div
                  key={idx}
                  className="h-11 w-16 sm:w-24 rounded-lg bg-gradient-to-b from-indigo-500 to-purple-600 border-2 border-indigo-300 flex items-center justify-center font-extrabold text-white shadow-md transition-all"
                >
                  {showUnitValues ? unitValue : '1 unit'}
                </div>
              ))}

              {/* Difference Bracket */}
              {showBrackets && differenceValue ? (
                barPartsA > barPartsB && (
                  <div className="ml-2 px-3 py-1.5 rounded-xl bg-rose-500/20 border border-rose-400/60 text-rose-300 text-xs font-extrabold flex items-center gap-1.5">
                    <span>
                      ◄ ผลต่าง (Difference) {barPartsA - barPartsB} ส่วน = {differenceValue} ซม. ►
                    </span>
                  </div>
                )
              ) : null}
            </div>
          </div>
        </div>

        {/* Bar Model Summary Footer */}
        <div className={`flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-indigo-500/20 text-xs ${theme.text}`}>
          <div>
            อัตราส่วนปัจจุบัน (Current Ratio):{' '}
            <span className="font-extrabold text-cyan-300">
              {barPartsA} : {barPartsB}
            </span>{' '}
            | จำนวนส่วนรวม:{' '}
            <span className="font-extrabold text-emerald-400">{barPartsA + barPartsB} ส่วน (Units)</span>
          </div>
          {showTotal && (
            <div className="font-extrabold text-amber-300">
              รวมทั้งหมด (Total Altogether) = {config?.totalValue} หน่วย
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
