'use client'

import { useEffect, useMemo, useState } from 'react'
import { AvatarCharacter } from './AvatarCharacter'

interface Props {
  studentPhotoUrl: string | null
  avatarGender: 'girl' | 'boy' | 'unspecified' | null
  size?: 'sm' | 'lg' | 'xl'
  alt?: string
  /**
   * Cache-buster — bump this (or change the URL) to force the browser to
   * re-fetch a photo whose filename stayed the same (e.g. after re-upload).
   */
  cacheKey?: string | number | null
}

function withCacheBuster(url: string, cacheKey?: string | number | null): string {
  if (cacheKey === undefined || cacheKey === null || cacheKey === '') return url
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}v=${encodeURIComponent(String(cacheKey))}`
}

export function PhotoAvatar({ studentPhotoUrl, avatarGender, size = 'lg', alt = 'Student profile photo', cacheKey }: Props) {
  const [imgError, setImgError] = useState(false)
  const gender = avatarGender === 'boy' ? 'boy' : 'girl'
  const resolvedPhotoUrl = useMemo(() => {
    if (!studentPhotoUrl) return null
    if (/^https?:\/\//i.test(studentPhotoUrl)) return withCacheBuster(studentPhotoUrl, cacheKey)
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? ''
    const path = studentPhotoUrl.startsWith('/') ? studentPhotoUrl : `/${studentPhotoUrl}`
    return withCacheBuster(`${baseUrl}${path}`, cacheKey)
  }, [studentPhotoUrl, cacheKey])

  useEffect(() => {
    setImgError(false)
  }, [resolvedPhotoUrl])

  const sizeClass =
    size === 'xl' ? 'w-44 h-44' :
    size === 'lg' ? 'w-20 h-20' : 'w-10 h-10'

  const roundedClass = size === 'xl' ? 'rounded-3xl' : 'rounded-full'

  if (resolvedPhotoUrl && !imgError) {
    return (
      <div className={`${sizeClass} ${roundedClass} overflow-hidden border-4 border-white shadow-xl flex-shrink-0`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolvedPhotoUrl}
          alt={alt}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => setImgError(true)}
        />
      </div>
    )
  }

  // Placeholder fallback: the drawn character (never a broken image icon).
  return <AvatarCharacter gender={gender} size={size} />
}
