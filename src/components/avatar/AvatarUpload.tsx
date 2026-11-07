'use client'

import { useRef, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { buildApiUrl } from '@/lib/public-env'

interface Props {
  childId: string
  currentAvatarUrl: string | null
  onUploadSuccess: (avatarUrl: string) => void
}

interface AvatarUploadResponse {
  student_photo_url?: string
  student_photo_absolute_url?: string
  avatar_url?: string
}

const MAX_FILE_SIZE = 5 * 1024 * 1024
const MAX_DIMENSION = 1024
const OUTPUT_QUALITY = 0.8
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

async function resizeToWebp(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img

      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas context unavailable'))
        return
      }

      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => {
          if (!blob) reject(new Error('Canvas toBlob failed'))
          else resolve(blob)
        },
        'image/webp',
        OUTPUT_QUALITY,
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }
    img.src = url
  })
}

export function AvatarUpload({ childId, currentAvatarUrl, onUploadSuccess }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [removeConfirm, setRemoveConfirm] = useState(false)

  function clearPreview() {
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    setSelectedFile(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null)
    const file = e.target.files?.[0]
    if (!file) return

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('รองรับเฉพาะไฟล์ JPG, PNG, หรือ WebP เท่านั้น')
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      setError('ไฟล์รูปภาพใหญ่เกินไป กรุณาเลือกรูปไม่เกิน 5 MB')
      return
    }

    clearPreview()
    setSelectedFile(file)
    setPreview(URL.createObjectURL(file))
  }

  async function uploadSelectedFile() {
    if (!selectedFile) {
      inputRef.current?.click()
      return
    }

    setUploading(true)
    setError(null)
    try {
      const blob = await resizeToWebp(selectedFile)
      const form = new FormData()
      form.append('file', blob, 'avatar.webp')

      const token = localStorage.getItem('access_token')
      const res = await fetch(buildApiUrl(`/me/students/${childId}/avatar`), {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: 'include',
        body: form,
      })
      if (!res.ok) {
        const message = await res.text().catch(() => '')
        throw new Error(message || 'Upload failed')
      }
      const data = await res.json() as AvatarUploadResponse
      const photoUrl = data.student_photo_url ?? data.avatar_url ?? data.student_photo_absolute_url
      if (!photoUrl) {
        throw new Error('Avatar upload response did not include student_photo_url')
      }
      clearPreview()
      onUploadSuccess(`${photoUrl}${photoUrl.includes('?') ? '&' : '?'}v=${Date.now()}`)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err instanceof Error ? err.message : '') ||
        'อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่'
      setError(msg)
    } finally {
      setUploading(false)
    }
  }

  async function handleRemove() {
    setRemoveConfirm(false)
    setError(null)
    try {
      await apiClient.delete(`/me/students/${childId}/avatar`)
      clearPreview()
      onUploadSuccess('')
    } catch {
      setError('ลบรูปโปรไฟล์ไม่สำเร็จ กรุณาลองใหม่')
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        className="hidden"
        onChange={handleFileChange}
      />

      {preview && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-primary-100 bg-white/90 p-3 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="ตัวอย่างรูปโปรไฟล์" className="h-20 w-20 rounded-full object-cover" />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={uploadSelectedFile}
              disabled={uploading}
              className="rounded-xl bg-primary-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
            >
              {uploading ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
            <button
              type="button"
              onClick={clearPreview}
              disabled={uploading}
              className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="max-w-xs rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-sm text-red-600">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="rounded-xl border border-primary-200 bg-white px-4 py-2 text-sm font-bold text-primary-700 shadow-sm transition-colors hover:bg-primary-50 disabled:opacity-50 whitespace-nowrap"
      >
        📷 อัปโหลดรูปโปรไฟล์
      </button>

      {currentAvatarUrl && !removeConfirm && (
        <button
          type="button"
          onClick={() => setRemoveConfirm(true)}
          className="text-xs font-semibold text-gray-400 transition-colors hover:text-red-500"
        >
          ลบรูปโปรไฟล์
        </button>
      )}

      {removeConfirm && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">ยืนยันลบรูปโปรไฟล์?</span>
          <button type="button" onClick={handleRemove} className="text-xs font-semibold text-red-600">
            ลบรูปโปรไฟล์
          </button>
          <button type="button" onClick={() => setRemoveConfirm(false)} className="text-xs text-gray-400">
            ยกเลิก
          </button>
        </div>
      )}
    </div>
  )
}
