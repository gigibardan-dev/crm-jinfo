import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  name: string
  color?: string | null
  size?: 'sm' | 'md'
  className?: string
}

export function StatusBadge({ name, color, size = 'sm', className }: StatusBadgeProps) {
  const safeColor = color || '#64748b'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full',
        size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1',
        className,
      )}
      style={{
        color: safeColor,
        backgroundColor: safeColor + '18',
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: safeColor }}
      />
      {name}
    </span>
  )
}
