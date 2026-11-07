'use client'

import { useState } from 'react'
import type { ShareResponse } from '@/lib/api/me'

interface ShareModalProps {
  open: boolean
  onClose: () => void
  share: ShareResponse | null
  loading?: boolean
  error?: string | null
  title?: string
  text?: string
}

function openShareUrl(url?: string) {
  if (!url || typeof window === 'undefined') return
  window.open(url, '_blank', 'noopener,noreferrer')
}

export function ShareModal({
  open,
  onClose,
  share,
  loading = false,
  error,
  title = 'TOPA Math',
  text = 'มาเรียนเลขสนุก ๆ กับ TOPA Math กันนะ',
}: ShareModalProps) {
  const [copied, setCopied] = useState(false)

  if (!open) return null

  async function copyLink() {
    if (!share?.copy_url || typeof navigator === 'undefined') return
    await navigator.clipboard.writeText(share.copy_url)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  async function moreShare() {
    if (!share?.share_url || typeof navigator === 'undefined' || !navigator.share) return
    await navigator.share({ title, text, url: share.share_url })
  }

  const canWebShare = typeof navigator !== 'undefined' && Boolean(navigator.share)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 py-5 sm:items-center">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-extrabold text-gray-900">แชร์ TOPA Math</h2>
            <p className="text-sm text-gray-500 mt-1">เลือกช่องทางแชร์ลิงก์สาธารณะ</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-gray-100 px-3 py-1.5 text-sm font-bold text-gray-600 hover:bg-gray-200"
          >
            ปิด
          </button>
        </div>

        <div className="p-5">
          {loading && (
            <div className="rounded-xl bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-700">
              กำลังสร้างลิงก์แชร์...
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}

          {share && (
            <>
              <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600 break-all">
                {share.share_url}
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => openShareUrl(share.facebook_url)}
                  className="rounded-xl bg-[#1877f2] px-4 py-3 text-sm font-extrabold text-white hover:brightness-95"
                >
                  Facebook
                </button>
                <button
                  type="button"
                  onClick={() => openShareUrl(share.x_url)}
                  className="rounded-xl bg-gray-900 px-4 py-3 text-sm font-extrabold text-white hover:bg-black"
                >
                  X
                </button>
                <button
                  type="button"
                  onClick={() => openShareUrl(share.line_url)}
                  className="rounded-xl bg-[#06c755] px-4 py-3 text-sm font-extrabold text-white hover:brightness-95"
                >
                  LINE
                </button>
                <button
                  type="button"
                  onClick={copyLink}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-extrabold text-gray-800 hover:bg-gray-50"
                >
                  {copied ? 'คัดลอกลิงก์แล้ว' : 'Copy Link'}
                </button>
              </div>
              <button
                type="button"
                onClick={moreShare}
                disabled={!canWebShare}
                className="mt-3 w-full rounded-xl bg-primary-600 px-4 py-3 text-sm font-extrabold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
              >
                More...
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
