'use client'

import type { AvatarConfig } from '@/lib/api/avatar'

export function AvatarPreview({ config, nickname }: { config: AvatarConfig; nickname: string }) {
  const isGirl = (config.gender ?? 'girl') === 'girl'
  const bgColors: Record<string, string> = {
    bg_blue: 'from-blue-200 to-blue-400',
    bg_green: 'from-green-200 to-green-400',
    bg_pink: 'from-pink-200 to-pink-400',
    bg_purple: 'from-purple-200 to-purple-400',
    bg_yellow: 'from-yellow-200 to-yellow-400',
    bg_default: 'from-rose-100 to-fuchsia-100',
  }
  const bg = config.background
    ? bgColors[config.background] || bgColors.bg_default
    : isGirl
      ? bgColors.bg_pink
      : 'from-blue-200 to-cyan-200'

  if (isGirl) {
    return (
      <div
        className={`w-44 h-52 rounded-3xl bg-gradient-to-br ${bg} flex flex-col items-center justify-center shadow-2xl border-4 border-white/60 relative overflow-hidden mx-auto`}
      >
        {/* Stars decoration */}
        <div className="absolute top-3 right-3 w-5 h-5 bg-white/20 rounded-full" />
        <div className="absolute bottom-6 left-3 w-3 h-3 bg-white/20 rounded-full" />
        <div className="absolute top-6 left-4 w-2 h-2 bg-white/20 rounded-full" />

        {/* Hair top */}
        <div className="absolute top-1 left-2 right-2 h-7 bg-amber-600 rounded-t-full" />
        {/* Side hair */}
        <div className="absolute top-[22%] left-0 w-4 h-10 bg-amber-600 rounded-l-full" />
        <div className="absolute top-[22%] right-0 w-4 h-10 bg-amber-600 rounded-r-full" />

        {/* Head */}
        <div className="w-24 h-24 rounded-full bg-yellow-50 border-4 border-yellow-200 relative flex items-center justify-center shadow-inner mt-3">
          {/* Eyes */}
          <div className="absolute top-[30%] flex gap-5">
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center ${
                config.eyes?.includes('blue')
                  ? 'bg-blue-500'
                  : config.eyes?.includes('green')
                    ? 'bg-green-500'
                    : 'bg-gray-800'
              }`}
            >
              <div className="w-2 h-2 bg-white rounded-full" />
            </div>
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center ${
                config.eyes?.includes('blue')
                  ? 'bg-blue-500'
                  : config.eyes?.includes('green')
                    ? 'bg-green-500'
                    : 'bg-gray-800'
              }`}
            >
              <div className="w-2 h-2 bg-white rounded-full" />
            </div>
          </div>
          {/* Smile */}
          <div className="absolute bottom-5 w-6 h-3 border-b-2 border-yellow-800 rounded-b-full" />
          {/* Cheeks */}
          <div className="absolute top-[40%] left-1 w-4 h-2.5 bg-pink-200 rounded-full opacity-70" />
          <div className="absolute top-[40%] right-1 w-4 h-2.5 bg-pink-200 rounded-full opacity-70" />
        </div>

        {/* Body */}
        <div
          className={`w-28 h-14 -mt-1 rounded-t-3xl ${
            config.outfit?.includes('red')
              ? 'bg-red-400'
              : config.outfit?.includes('blue')
                ? 'bg-blue-400'
                : config.outfit?.includes('green')
                  ? 'bg-green-400'
                  : 'bg-pink-400'
          } border-t-4 border-white/30 relative`}
        >
          {/* Accessory */}
          {config.accessory === 'acc_crown' && (
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-xl">👑</div>
          )}
          {config.accessory === 'acc_glasses' && (
            <div className="absolute top-1 left-1/2 -translate-x-1/2 text-base">🤓</div>
          )}
          {/* Shirt pattern */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-5 h-5 bg-white/30 rounded-full" />
        </div>
      </div>
    )
  }

  // Boy
  return (
    <div
      className={`w-44 h-52 rounded-3xl bg-gradient-to-br ${bg} flex flex-col items-center justify-center shadow-2xl border-4 border-white/60 relative overflow-hidden mx-auto`}
    >
      {/* Stars decoration */}
      <div className="absolute top-3 right-3 w-5 h-5 bg-white/20 rounded-full" />
      <div className="absolute bottom-6 left-3 w-3 h-3 bg-white/20 rounded-full" />

      {/* Spiky hair */}
      <div className="absolute top-1 flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`w-3 h-4 bg-amber-700 rounded-sm ${i === 1 ? '-mt-2' : ''}`}
          />
        ))}
      </div>

      {/* Head */}
      <div className="w-24 h-24 rounded-full bg-yellow-100 border-4 border-yellow-200 relative flex items-center justify-center shadow-inner mt-3">
        {/* Eyes */}
        <div className="absolute top-[30%] flex gap-5">
          <div
            className={`w-5 h-5 rounded-full flex items-center justify-center ${
              config.eyes?.includes('blue')
                ? 'bg-blue-500'
                : config.eyes?.includes('green')
                  ? 'bg-green-500'
                  : 'bg-gray-800'
            }`}
          >
            <div className="w-2 h-2 bg-white rounded-full" />
          </div>
          <div
            className={`w-5 h-5 rounded-full flex items-center justify-center ${
              config.eyes?.includes('blue')
                ? 'bg-blue-500'
                : config.eyes?.includes('green')
                  ? 'bg-green-500'
                  : 'bg-gray-800'
            }`}
          >
            <div className="w-2 h-2 bg-white rounded-full" />
          </div>
        </div>
        {/* Smile */}
        <div className="absolute bottom-5 w-6 h-3 border-b-2 border-yellow-800 rounded-b-full" />
        {/* Cheeks */}
        <div className="absolute top-[40%] left-1 w-4 h-2.5 bg-pink-200 rounded-full opacity-60" />
        <div className="absolute top-[40%] right-1 w-4 h-2.5 bg-pink-200 rounded-full opacity-60" />
      </div>

      {/* Body */}
      <div
        className={`w-28 h-14 -mt-1 rounded-t-3xl ${
          config.outfit?.includes('red')
            ? 'bg-red-400'
            : config.outfit?.includes('green')
              ? 'bg-green-400'
              : config.outfit?.includes('pink')
                ? 'bg-pink-400'
                : 'bg-blue-400'
        } border-t-4 border-white/30 relative`}
      >
        {/* Accessory */}
        {config.accessory === 'acc_crown' && (
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-xl">👑</div>
        )}
        {config.accessory === 'acc_glasses' && (
          <div className="absolute top-1 left-1/2 -translate-x-1/2 text-base">🤓</div>
        )}
        {/* Shirt pattern */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-5 h-5 bg-white/30 rounded-full" />
      </div>
    </div>
  )
}
