'use client'

import type { AvatarConfig } from '@/lib/api/avatar'

export function GenderSelector({
  config,
  onSelect,
}: {
  config: { gender?: 'girl' | 'boy' }
  onSelect: (g: 'girl' | 'boy') => void
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <button
        onClick={() => onSelect('girl')}
        className={`p-4 rounded-2xl border-2 text-center transition-all ${
          (config.gender ?? 'girl') === 'girl'
            ? 'border-primary-400 bg-primary-50 shadow-md ring-2 ring-primary-200'
            : 'border-gray-200 bg-white hover:border-primary-200'
        }`}
      >
        <div className="text-5xl mb-2">👧</div>
        <p
          className={`text-sm font-bold ${
            (config.gender ?? 'girl') === 'girl' ? 'text-primary-700' : 'text-gray-600'
          }`}
        >
          เด็กผู้หญิง
        </p>
        <p className="text-xs text-gray-400 mt-0.5">ผมยาว น่ารัก</p>
      </button>
      <button
        onClick={() => onSelect('boy')}
        className={`p-4 rounded-2xl border-2 text-center transition-all ${
          config.gender === 'boy'
            ? 'border-primary-400 bg-primary-50 shadow-md ring-2 ring-primary-200'
            : 'border-gray-200 bg-white hover:border-primary-200'
        }`}
      >
        <div className="text-5xl mb-2">👦</div>
        <p
          className={`text-sm font-bold ${
            config.gender === 'boy' ? 'text-primary-700' : 'text-gray-600'
          }`}
        >
          เด็กผู้ชาย
        </p>
        <p className="text-xs text-gray-400 mt-0.5">ผมสั้น สุภาพ</p>
      </button>
    </div>
  )
}
