'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Minus, Plus, Sparkles } from 'lucide-react'
import { playSound } from '../audio'
import type { WorkspaceProps } from '../types'

/**
 * LOWER/UPPER PRIMARY WORKSPACE: the place-value chart.
 *
 * The board shows one column per place (หมื่น / พัน / ร้อย / สิบ / หน่วย).
 * Every column carries the worth of that place and an editable digit, so a
 * five digit amount (52,400) can be taken apart and put back together on
 * screen instead of only being read.
 *
 * For a subtraction the number that is taken away is printed underneath the
 * columns, and taking a unit away from an empty column borrows it from the
 * column on the left (กู้ยืมจากหลักซ้าย) - the board never shows a negative
 * amount.
 *
 * Like the other workspaces it owns its local state and re-seeds itself
 * whenever the shell bumps `problemId`.
 */

/** Thai names of the places, from the ones upwards. */
const PLACE_NAMES_TH = ['หน่วย', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน']

const MAX_DIGIT = 9

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('en-US')
}

/** The digits of a whole number, biggest place first. */
function digitsOf(value: number): number[] {
  const safe = Math.max(0, Math.round(Math.abs(value)))
  return String(safe).split('').map((char) => Number(char))
}

/** The Thai name of the n-th place counted from the ones. */
function placeName(exponent: number): string {
  return PLACE_NAMES_TH[exponent] ?? `หลัก ${10 ** exponent}`
}

interface PlaceValueSeed {
  /** The digit that sits in each column. */
  cells: number[]
  /** The worth of one unit of each column, e.g. 10000 for หมื่น. */
  unitValues: number[]
  /** The name of each column, e.g. หมื่น. */
  places: string[]
  /** The digits of the number that is taken away, aligned to the columns. */
  subtrahendCells: number[]
}

function seedFromConfig(problem: WorkspaceProps['problem']): PlaceValueSeed {
  const config = problem.placeValueConfig

  const digits = config?.digits?.length ? config.digits.slice() : digitsOf(config?.number ?? 0)
  const columnCount = Math.max(1, digits.length)
  const places = config?.places?.length === columnCount
    ? config.places.slice()
    : digits.map((_, index) => placeName(columnCount - 1 - index))

  // The lesson data carries the worth of every digit (40,000 for the 4 in
  // หมื่น). Dividing it by the digit gives the worth of one unit of that
  // place, which is what the columns need.
  const unitValues = digits.map((digit, index) => {
    const worth = config?.values?.[index]
    if (digit > 0 && typeof worth === 'number' && worth % digit === 0) {
      return worth / digit
    }
    return 10 ** (columnCount - 1 - index)
  })

  const subtrahend = config?.subtrahend
  const subtrahendDigits = subtrahend === undefined ? [] : digitsOf(subtrahend)
  const subtrahendCells = subtrahendDigits.length
    ? Array.from({ length: columnCount - subtrahendDigits.length }, () => 0).concat(subtrahendDigits)
    : []

  return {
    cells: digits.map((digit) => Math.min(MAX_DIGIT, Math.max(0, digit))),
    unitValues,
    places,
    subtrahendCells,
  }
}

export function PlaceValueWorkspace(props: WorkspaceProps) {
  const { problem, theme, problemId } = props
  const config = problem.placeValueConfig

  const seed = useMemo(() => seedFromConfig(problem), [problem])
  const [cells, setCells] = useState<number[]>(() => seed.cells)
  const [notice, setNotice] = useState<string>('')
  /** The column the last borrow came from, so the board can point at it. */
  const [borrowedFrom, setBorrowedFrom] = useState<number | null>(null)
  /**
   * The digits as they are right now.
   *
   * The board reads them from here instead of from the state, so two quick
   * taps in a row both count - a learner who taps "ลด" three times takes
   * three units away, not one.
   */
  const cellsRef = useRef<number[]>(seed.cells)

  // Reset the chart whenever the learner moves to another problem.
  useEffect(() => {
    const fresh = seedFromConfig(problem).cells
    cellsRef.current = fresh
    setCells(fresh)
    setNotice('')
    setBorrowedFrom(null)
    // `problemId` is the reset signal; the problem object itself is stable
    // for the lifetime of a problem in the shell.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemId])

  const columnCount = cells.length
  const total = cells.reduce((sum, cell, index) => sum + cell * seed.unitValues[index], 0)
  const unit = config?.unit ?? ''

  const subtrahendTotal = config?.subtrahend ?? 0
  const operation = config?.operation ?? 'place'
  const target = operation === 'subtract' ? (config?.number ?? 0) - subtrahendTotal : null

  /** Adds one unit to the column, carrying to the column on the left. */
  function carryInto(next: number[], index: number): boolean {
    if (index < 0) return false
    next[index] += 1
    if (next[index] <= MAX_DIGIT) return true
    next[index] = 0
    return carryInto(next, index - 1)
  }

  /**
   * Takes one unit away from an empty column.
   *
   * The nearest column on the left that still holds something lends one
   * unit, every column in between turns into nine and the column itself
   * ends up with nine as well (10 - 1). When there is nothing left to
   * borrow the board refuses the step, so the amount on the board can never
   * become negative.
   *
   * Returns the column that lent the unit, or -1 when there is none.
   */
  function borrowInto(next: number[], index: number): number {
    let lender = index - 1
    while (lender >= 0 && next[lender] === 0) lender -= 1
    if (lender < 0) return -1
    next[lender] -= 1
    for (let step = lender + 1; step <= index; step += 1) next[step] = MAX_DIGIT
    return lender
  }

  /** Adds one unit to the column the learner picked. */
  function addUnit(index: number) {
    const next = cellsRef.current.slice()
    if (!carryInto(next, index)) {
      playSound('nudge')
      setNotice('หลักนี้เต็มแล้ว เพิ่มไม่ได้ค่ะ')
      return
    }
    playSound('pop')
    cellsRef.current = next
    setNotice('')
    setBorrowedFrom(null)
    setCells(next)
  }

  /** Takes one unit away from the column the learner picked. */
  function removeUnit(index: number) {
    const next = cellsRef.current.slice()
    if (next[index] > 0) {
      next[index] -= 1
      playSound('pop')
      cellsRef.current = next
      setNotice('')
      setBorrowedFrom(null)
      setCells(next)
      return
    }
    const lender = borrowInto(next, index)
    if (lender < 0) {
      playSound('nudge')
      setNotice('หลักซ้ายไม่มีอะไรให้ยืมแล้ว ลบติดลบไม่ได้ค่ะ')
      return
    }
    playSound('pop')
    cellsRef.current = next
    setNotice(`ยืม 1 หลัก${seed.places[lender]} มาลบหลัก${seed.places[index]}`)
    setBorrowedFrom(lender)
    setCells(next)
  }

  function editCell(index: number, raw: string) {
    const cleaned = raw.replace(/[^0-9]/g, '')
    if (!cleaned) return
    const digit = Math.min(MAX_DIGIT, Number(cleaned.slice(-1)))
    const next = cellsRef.current.slice()
    next[index] = digit
    playSound('pop')
    cellsRef.current = next
    setNotice('')
    setBorrowedFrom(null)
    setCells(next)
  }

  /** Puts the chart back to the number the lesson started with. */
  function resetChart() {
    playSound('pop')
    const fresh = seedFromConfig(problem).cells
    cellsRef.current = fresh
    setCells(fresh)
    setNotice('')
    setBorrowedFrom(null)
  }

  const solved = target !== null && total === target

  return (
    <div
      className={`flex-none min-h-[210px] sm:flex-1 border-2 p-2 sm:p-4 flex flex-col justify-between relative overflow-hidden ${theme.surface} ${theme.surfaceBorder} ${theme.radius}`}
    >
      <div className="h-full flex flex-col justify-between gap-2 min-h-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs sm:text-sm font-extrabold text-violet-700 bg-violet-100 px-3 py-1 rounded-xl border border-violet-200">
              📊 กระดานค่าตำแหน่ง (Place Value Chart)
            </span>
            <span className={`text-xs hidden md:inline ${theme.textMuted}`}>
              กดปุ่ม + / - ที่หลักที่ต้องการ แล้วดูว่าค่าบนกระดานเปลี่ยนอย่างไร
            </span>
          </div>

          <div className="flex items-center gap-2 bg-amber-100 border-2 border-amber-300 px-3 py-1 rounded-2xl">
            <span className="text-[10px] sm:text-xs font-bold text-amber-900">ค่าบนกระดาน:</span>
            <span className="text-base sm:text-xl font-extrabold text-orange-600">
              {formatNumber(total)}
            </span>
            {unit && <span className="text-[10px] sm:text-xs font-bold text-amber-700">{unit}</span>}
          </div>
        </div>

        {/* The chart itself */}
        <div className="my-auto py-1 min-h-0 overflow-auto">
          <div
            className="grid gap-1 sm:gap-2 min-w-[300px]"
            style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
          >
            {cells.map((cell, index) => {
              const place = seed.places[index]
              const worth = cell * seed.unitValues[index]
              const subtractCell = seed.subtrahendCells[index]
              const isLender = borrowedFrom === index
              return (
                <div
                  key={place}
                  className={`flex flex-col items-center gap-1 rounded-2xl border-2 p-1 sm:p-2 ${
                    isLender
                      ? 'border-amber-400 bg-amber-50'
                      : 'border-violet-200 bg-violet-50/70'
                  }`}
                >
                  <span className="text-[10px] sm:text-xs font-extrabold text-violet-800">{place}</span>
                  <span className="text-[10px] sm:text-xs font-bold text-violet-500">
                    {formatNumber(seed.unitValues[index])}
                  </span>

                  <input
                    type="text"
                    inputMode="numeric"
                    aria-label={`ตัวเลขหลัก${place}`}
                    value={cell}
                    onChange={(event) => editCell(index, event.target.value)}
                    className="w-full max-w-[64px] text-center text-lg sm:text-2xl font-extrabold text-slate-800 bg-white border-2 border-violet-300 rounded-xl py-0.5 focus:outline-none focus:border-violet-500"
                  />

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => removeUnit(index)}
                      aria-label={`ลดหลัก${place}ลง 1 หลัก`}
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white border border-violet-300 flex items-center justify-center font-bold text-violet-700 hover:bg-violet-100 active:scale-95 shadow-sm"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => addUnit(index)}
                      aria-label={`เพิ่มหลัก${place}ขึ้น 1 หลัก`}
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-violet-600 text-white flex items-center justify-center font-bold hover:bg-violet-700 active:scale-95 shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <span className="text-[10px] sm:text-xs font-extrabold text-emerald-700">
                    {formatNumber(worth)}
                  </span>

                  {operation === 'subtract' && subtractCell !== undefined && (
                    <span
                      className={`text-[10px] sm:text-xs font-extrabold px-1.5 rounded-lg ${
                        subtractCell > 0
                          ? 'bg-rose-100 text-rose-700 border border-rose-200'
                          : 'text-slate-400'
                      }`}
                    >
                      − {subtractCell}
                    </span>
                  )}

                  {isLender && (
                    <span className="text-[9px] sm:text-[10px] font-extrabold text-amber-700">
                      ↩ ให้ยืม
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* The footer: goal, borrow notice and the reset button */}
        <div
          className={`flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-violet-200 text-[11px] sm:text-xs ${theme.text}`}
        >
          <div className="flex flex-col gap-0.5 min-w-0">
            {operation === 'subtract' && (
              <span className="font-bold">
                ตัวลบ {formatNumber(subtrahendTotal)} {unit} · เหลือเป้าหมาย{' '}
                {formatNumber(target ?? 0)} {unit}
              </span>
            )}
            {operation === 'compare' && (
              <span className="font-bold">
                เทียบกับ {formatNumber(subtrahendTotal)} {unit} ·{' '}
                {total > subtrahendTotal
                  ? 'มากกว่า'
                  : total < subtrahendTotal
                    ? 'น้อยกว่า'
                    : 'เท่ากับ'}
              </span>
            )}
            {notice && <span className="font-extrabold text-amber-600">{notice}</span>}
            {solved && (
              <span className="font-extrabold text-emerald-600">🎉 ลบได้ตรงตามเป้าหมายแล้ว!</span>
            )}
          </div>

          <button
            type="button"
            onClick={resetChart}
            className="font-bold text-violet-700 hover:underline flex items-center gap-1 shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>เริ่มใหม่ตามตัวเลขโจทย์</span>
          </button>
        </div>
      </div>
    </div>
  )
}
