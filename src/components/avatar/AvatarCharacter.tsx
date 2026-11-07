'use client'

export function AvatarCharacter({
  gender,
  size = 'xl',
}: {
  gender: 'girl' | 'boy'
  size?: 'sm' | 'lg' | 'xl'
}) {
  const sizeClass =
    size === 'xl' ? 'w-44 h-44' :
    size === 'lg' ? 'w-20 h-20' : 'w-10 h-10'

  if (gender === 'boy') {
    return (
      <div className={`${sizeClass} rounded-3xl bg-gradient-to-br from-blue-200 via-blue-100 to-sky-200 flex flex-col items-center justify-center shadow-xl border-4 border-white relative overflow-hidden`}>
        <div className="absolute top-1 flex gap-0.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`w-2.5 h-3 bg-amber-700 rounded-sm ${i === 1 ? '-mt-1.5' : ''}`} />
          ))}
        </div>
        <div className="w-[60%] h-[55%] rounded-full bg-yellow-100 border-2 border-yellow-200 relative flex items-center justify-center shadow-inner -mt-2">
          <div className="absolute top-[30%] flex gap-3">
            <div className="w-2.5 h-2.5 bg-gray-800 rounded-full flex items-center justify-center"><div className="w-1 h-1 bg-white rounded-full" /></div>
            <div className="w-2.5 h-2.5 bg-gray-800 rounded-full flex items-center justify-center"><div className="w-1 h-1 bg-white rounded-full" /></div>
          </div>
          <div className="absolute bottom-[22%] w-4 h-2 border-b-2 border-yellow-800 rounded-b-full" />
          <div className="absolute top-[38%] left-0.5 w-2.5 h-1.5 bg-pink-200 rounded-full opacity-60" />
          <div className="absolute top-[38%] right-0.5 w-2.5 h-1.5 bg-pink-200 rounded-full opacity-60" />
        </div>
        <div className="w-[80%] h-[28%] -mt-1 rounded-t-2xl bg-blue-400 border-t-2 border-l-2 border-r-2 border-blue-300 relative">
          <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white/30 rounded-full" />
        </div>
      </div>
    )
  }

  return (
    <div className={`${sizeClass} rounded-3xl bg-gradient-to-br from-pink-100 via-rose-100 to-fuchsia-100 flex flex-col items-center justify-center shadow-xl border-4 border-white relative overflow-hidden`}>
      <div className="absolute top-1 left-2 right-2 h-7 bg-amber-600 rounded-t-full" />
      <div className="absolute top-[22%] left-0 w-3 h-10 bg-amber-600 rounded-l-full" />
      <div className="absolute top-[22%] right-0 w-3 h-10 bg-amber-600 rounded-r-full" />
      <div className="w-[60%] h-[55%] rounded-full bg-yellow-50 border-2 border-yellow-200 relative flex items-center justify-center shadow-inner -mt-2">
        <div className="absolute top-[30%] flex gap-3">
          <div className="w-2.5 h-2.5 bg-gray-800 rounded-full flex items-center justify-center"><div className="w-1 h-1 bg-white rounded-full" /></div>
          <div className="w-2.5 h-2.5 bg-gray-800 rounded-full flex items-center justify-center"><div className="w-1 h-1 bg-white rounded-full" /></div>
        </div>
        <div className="absolute bottom-[22%] w-4 h-2 border-b-2 border-yellow-800 rounded-b-full" />
        <div className="absolute top-[40%] left-0.5 w-2.5 h-1.5 bg-pink-200 rounded-full opacity-70" />
        <div className="absolute top-[40%] right-0.5 w-2.5 h-1.5 bg-pink-200 rounded-full opacity-70" />
      </div>
      <div className="w-[80%] h-[28%] -mt-1 rounded-t-2xl bg-pink-400 border-t-2 border-l-2 border-r-2 border-pink-300 relative">
        <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white/30 rounded-full" />
      </div>
    </div>
  )
}