'use client'

import type { ExitConfirmModalProps } from './types'

/**
 * Gentle exit confirmation.
 *
 * Protects young learners from leaving the lesson by accident: staying is the
 * loud, friendly option, leaving is the quiet one.
 */
export function ExitConfirmModal(props: ExitConfirmModalProps) {
  const { open, theme, onCancel, onConfirm } = props

  if (!open) return null

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${theme.overlay}`}>
      <div
        className={`w-full max-w-md border-2 p-6 text-center shadow-2xl ${theme.radius} ${theme.modal}`}
        role="dialog"
        aria-modal="true"
        aria-label="ต้องการกลับไปที่แผนที่บทเรียนใช่ไหม?"
      >
        <div className="mb-3 text-5xl">🗺️</div>
        <h3 className="mb-1 text-xl font-extrabold">ต้องการกลับไปที่แผนที่บทเรียนใช่ไหม?</h3>
        <p className="mb-5 text-sm opacity-75">
          Wait! Do you want to exit this lesson? อีกนิดเดียวก็จะจบด่านและได้รับเพชรโบนัสแล้วนะ!
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-2xl bg-emerald-500 py-3 font-extrabold text-white shadow-md hover:bg-emerald-600"
          >
            เรียนต่อเลย! (Stay)
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-2xl bg-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-300"
          >
            ออกชั่วคราว
          </button>
        </div>
      </div>
    </div>
  )
}
