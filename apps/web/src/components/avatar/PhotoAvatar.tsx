'use client'

import { useEffect, useMemo, useState } from 'react'
import { AvatarCharacter } from './AvatarCharacter'

interface Props {
  studentPhotoUrl: string | null
  avatarGender: 'girl' | 'boy' | 'unspecified' | null
  size?: 'sm' | 'lg' | 'xl'
  alt?: string
}

export function PhotoAvatar({ studentPhotoUrl, avatarGender, size = 'lg', alt = 'Student profile photo' }: Props) {
  const [imgError, setImgError] = useState(false)
  const gender = avatarGender === 'boy' ? 'boy' : 'girl'
  const resolvedPhotoUrl = useMemo(() => {
    if (!studentPhotoUrl) return null
    if (/^https?:\/\//i.test(studentPhotoUrl)) return studentPhotoUrl
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? ''
    return `${baseUrl}${studentPhotoUrl.startsWith('/') ? '' : '/'}${studentPhotoUrl}`
  }, [studentPhotoUrl])

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
          onError={() => setImgError(true)}
        />
      </div>
    )
  }

  return <AvatarCharacter gender={gender} size={size} />
}
