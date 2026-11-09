'use client'

import { useEffect, useState } from 'react'
import { Minus, Plus, Sparkles } from 'lucide-react'
import { playSound } from '../audio'
import type { WorkspaceProps } from '../types'

/**
 * LOWER PRIMARY WORKSPACE: virtual Base-10 blocks (tens rods + ones cubes).
 *
 * Ported from the approved prototype
 * (src/reference/LessonMasterPrototype.jsx, lower primary workspace).
 *
 * The workspace owns its own local state and re-seeds itself whenever the
 * shell bumps `problemId`, so a new problem always starts from the
 * configuration seed instead of the previous learner's working state.
 */

const DEFAULT_TENS = 2
const DEFAULT_ONES = 4
const DEFAULT_UNIT_EMOJI = '🍎'
const MAX_TENS = 6
const MAX_ONES = 15

interface Base10Seed {
  tens: number
  ones: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function seedFromConfig(problem: WorkspaceProps['problem']): Base10Seed {
  const config = problem.base10Config
  const tens = config?.initialTens ?? DEFAULT_TENS
  const ones = config?.initialOnes ?? DEFAULT_ONES
  return {
    tens: clamp(tens, 0, MAX_TENS),
    ones: clamp(ones, 0, MAX_ONES),
  }
}

export function Base10Workspace(props: WorkspaceProps) {
  const { problem, theme, problemId } = props
  const config = problem.base10Config

  const [tensCount, setTensCount] = useState<number>(() => seedFromConfig(problem).tens)
  const [onesCount, setOnesCount] = useState<number>(() => seedFromConfig(problem).ones)

  // Reset the board whenever the learner moves to another problem.
  useEffect(() => {
    const seed = seedFromConfig(problem)
    setTensCount(seed.tens)
    setOnesCount(seed.ones)
    // `problemId` is the reset signal; the problem object itself is stable
    // for the lifetime of a problem in the shell.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemId])

  const unitEmoji = config?.unitEmoji ?? DEFAULT_UNIT_EMOJI
  const targetTens = config?.targetTens ?? config?.initialTens ?? DEFAULT_TENS
  const targetOnes = config?.targetOnes ?? config?.initialOnes ?? DEFAULT_ONES
  const totalValue = tensCount * 10 + onesCount

  function removeTen() {
    playSound('pop')
    setTensCount((prev) => Math.max(0, prev - 1))
  }

  function addTen() {
    playSound('pop')
    setTensCount((prev) => Math.min(MAX_TENS, prev + 1))
  }

  function removeOne() {
    playSound('pop')
    setOnesCount((prev) => Math.max(0, prev - 1))
  }

  function addOne() {
    playSound('pop')
    setOnesCount((prev) => Math.min(MAX_ONES, prev + 1))
  }

  function bundleTen() {
    playSound('success')
    setOnesCount((prev) => Math.max(0, prev - 10))
    setTensCount((prev) => Math.min(MAX_TENS, prev + 1))
  }

  function applyPreset() {
    playSound('pop')
    setTensCount(clamp(targetTens, 0, MAX_TENS))
    setOnesCount(clamp(targetOnes, 0, MAX_ONES))
  }

  return (
    <div
      className={`flex-1 min-h-[210px] border-2 p-3 sm:p-5 flex flex-col justify-between relative overflow-hidden ${theme.surface} ${theme.surfaceBorder} ${theme.radius}`}
    >
      <div className="h-full flex flex-col justify-between">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-extrabold text-sky-900 bg-sky-100 px-3 py-1 rounded-xl border border-sky-200">
              🧮 กระดานบล็อกฐานสิบ (Interactive Base-10 Manipulatives)
            </span>
            <span className={`text-xs hidden md:inline ${theme.textMuted}`}>
              ลองกดเพิ่ม/ลด แท่งสิบ และ หน่วยย่อย เพื่อนับจำนวนรวมกัน!
            </span>
          </div>

          {/* Live Value Counter Badge */}
          <div className="flex items-center gap-2 bg-amber-100 border-2 border-amber-300 px-3.5 py-1 rounded-2xl">
            <span className="text-xs font-bold text-amber-900">ค่าบนกระดาน (Total on Board):</span>
            <span className="text-xl font-extrabold text-orange-600">{totalValue}</span>
            <span className="text-xs font-bold text-amber-700">
              ({tensCount * 10} + {onesCount})
            </span>
          </div>
        </div>

        {/* Visual Manipulatives Stage */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-auto py-2">
          {/* Tens Rods Zone */}
          <div className="bg-sky-100/60 border-2 border-sky-200 rounded-2xl p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="font-extrabold text-sm text-sky-900">
                🟦 แท่งหลักสิบ (Tens Rods = {tensCount * 10})
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={removeTen}
                  aria-label="ลดแท่งหลักสิบลง 1 แท่ง"
                  className="w-8 h-8 rounded-xl bg-white border border-sky-300 flex items-center justify-center font-bold text-sky-800 hover:bg-sky-200 active:scale-95 shadow-sm"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={addTen}
                  aria-label="เพิ่มแท่งหลักสิบขึ้น 1 แท่ง"
                  className="w-8 h-8 rounded-xl bg-sky-500 text-white flex items-center justify-center font-bold hover:bg-sky-600 active:scale-95 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Render Tens Rods */}
            <div className="flex items-center justify-center gap-3 min-h-[88px] flex-wrap">
              {Array.from({ length: tensCount }, (_, idx) => (
                <div
                  key={idx}
                  onClick={removeTen}
                  className="cursor-pointer group flex flex-col items-center"
                  title="คลิกเพื่อเอาออก 1 แท่งสิบ"
                >
                  <div className="w-7 h-20 bg-sky-500 rounded-md border-2 border-sky-700 shadow-md flex flex-col justify-between p-0.5 group-hover:scale-105 transition-transform">
                    {Array.from({ length: 10 }, (_, segIdx) => (
                      <div key={segIdx} className="w-full h-1.5 bg-sky-300/80 rounded-[1px]" />
                    ))}
                  </div>
                  <span className="text-[11px] font-extrabold text-sky-800 mt-1">+10</span>
                </div>
              ))}
              {tensCount === 0 && (
                <span className={`text-xs ${theme.textMuted}`}>กดปุ่ม + เพื่อวางแท่งสิบ</span>
              )}
            </div>
          </div>

          {/* Ones Cubes Zone */}
          <div className="bg-orange-100/60 border-2 border-orange-200 rounded-2xl p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="font-extrabold text-sm text-orange-900">
                🟧 บล็อกหลักหน่วย (Ones Cubes = {onesCount})
              </span>
              <div className="flex items-center gap-1.5">
                {onesCount >= 10 && (
                  <button
                    type="button"
                    onClick={bundleTen}
                    className="px-2.5 py-1 rounded-xl bg-emerald-500 text-white text-xs font-extrabold animate-pulse shadow-sm"
                  >
                    ✨ มัดรวม 10 เป็น 1 แท่งสิบ!
                  </button>
                )}
                <button
                  type="button"
                  onClick={removeOne}
                  aria-label="ลดหลักหน่วยลง 1 หน่วย"
                  className="w-8 h-8 rounded-xl bg-white border border-orange-300 flex items-center justify-center font-bold text-orange-800 hover:bg-orange-200 active:scale-95 shadow-sm"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={addOne}
                  aria-label="เพิ่มหลักหน่วยขึ้น 1 หน่วย"
                  className="w-8 h-8 rounded-xl bg-orange-500 text-white flex items-center justify-center font-bold hover:bg-orange-600 active:scale-95 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Render Ten-Frame Grid of Ones Cubes */}
            <div className="flex items-center justify-center gap-2 min-h-[88px] flex-wrap px-2">
              {Array.from({ length: onesCount }, (_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={removeOne}
                  aria-label="คลิกเพื่อเอาออก 1 หน่วย"
                  className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 border-2 border-orange-600 text-white font-extrabold text-xs flex items-center justify-center shadow-sm hover:scale-110 transition-transform"
                  title="คลิกเพื่อเอาออก 1 หน่วย"
                >
                  {unitEmoji}
                </button>
              ))}
              {onesCount === 0 && (
                <span className={`text-xs ${theme.textMuted}`}>กดปุ่ม + เพื่อเพิ่มหลักหน่วย</span>
              )}
            </div>
          </div>
        </div>

        {/* Quick Preset Button to match target problem */}
        <div className={`flex items-center justify-between gap-2 text-xs ${theme.textMuted}`}>
          <span>💡 เคล็ดลับ: ถ้านับหน่วยได้ครบ 10 ชิ้น สามารถกดปุ่ม "มัดรวมเป็นแท่งสิบ" ได้เลย!</span>
          <button
            type="button"
            onClick={applyPreset}
            className="font-bold text-sky-700 hover:underline flex items-center gap-1"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>จัดเรียงบล็อกตามคำตอบ ({problem.correctAnswer})</span>
          </button>
        </div>
      </div>
    </div>
  )
}
