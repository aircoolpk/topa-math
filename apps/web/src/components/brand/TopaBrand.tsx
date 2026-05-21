type MascotSize = 'sm' | 'md' | 'lg' | 'xl'

const mascotSizeClass: Record<MascotSize, string> = {
  sm: 'w-10 h-10 text-sm',
  md: 'w-14 h-14 text-base',
  lg: 'w-24 h-24 text-xl',
  xl: 'w-40 h-40 text-3xl',
}

export function TopaMascot({ size = 'md', className = '' }: { size?: MascotSize; className?: string }) {
  return (
    <img
      src="/brand/topa-mascot.png"
      alt="TOPA Math mascot"
      className={`${mascotSizeClass[size]} rounded-2xl object-contain drop-shadow-md ${className}`}
    />
  )
}

export function TopaBrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <TopaMascot size="sm" />
      {!compact && <span className="font-extrabold text-gray-900 text-lg">TOPA Math</span>}
    </div>
  )
}
