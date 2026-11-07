type MascotSize = 'sm' | 'md' | 'lg' | 'xl'
type LogoSize = 'sm' | 'md' | 'lg'

const mascotSizeClass: Record<MascotSize, string> = {
  sm: 'w-10 h-10 text-sm',
  md: 'w-14 h-14 text-base',
  lg: 'w-24 h-24 text-xl',
  xl: 'w-40 h-40 text-3xl',
}

const logoSizeClass: Record<LogoSize, string> = {
  sm: 'h-10 w-auto',
  md: 'h-14 w-auto',
  lg: 'h-[94px] w-auto',
}

export function TopaLogo({ size = 'md', className = '' }: { size?: LogoSize; className?: string }) {
  return (
    <img
      src="/brand/topa/topa-math-logo-new.png"
      alt="TOPA Math"
      className={`${logoSizeClass[size]} max-w-full object-contain ${className}`}
    />
  )
}

export function TopaMascot({ size = 'md', className = '' }: { size?: MascotSize; className?: string }) {
  return (
    <img
      src="/brand/topa/mascot-topa-feature.png"
      alt="TOPA Math mascot"
      className={`${mascotSizeClass[size]} object-contain drop-shadow-md ${className}`}
    />
  )
}

export function TopaBrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <TopaLogo size={compact ? 'sm' : 'md'} />
  )
}
