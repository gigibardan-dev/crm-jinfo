import { cn } from '@/lib/utils'
import { AlertTriangle, ArrowUp, ArrowRight, ArrowDown } from 'lucide-react'
import type { LeadPriority } from '@/lib/types/database'

const PRIORITY_CONFIG: Record<LeadPriority, {
  label: string
  icon: typeof ArrowUp
  className: string
}> = {
  urgent: {
    label: 'Urgent',
    icon: AlertTriangle,
    className: 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-950',
  },
  high: {
    label: 'Ridicat',
    icon: ArrowUp,
    className: 'text-orange-700 bg-orange-100 dark:text-orange-400 dark:bg-orange-950',
  },
  medium: {
    label: 'Mediu',
    icon: ArrowRight,
    className: 'text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-950',
  },
  low: {
    label: 'Scăzut',
    icon: ArrowDown,
    className: 'text-slate-500 bg-slate-100 dark:text-slate-400 dark:bg-slate-800',
  },
}

interface PriorityBadgeProps {
  priority: LeadPriority
  size?: 'sm' | 'md'
  showLabel?: boolean
  className?: string
}

export function PriorityBadge({ priority, size = 'sm', showLabel = true, className }: PriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium
  const Icon = config.icon
  const iconSize = size === 'sm' ? 11 : 13

  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded font-medium',
      size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1',
      config.className,
      className,
    )}>
      <Icon size={iconSize} />
      {showLabel && <span>{config.label}</span>}
    </span>
  )
}
