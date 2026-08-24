import {
  Megaphone,
  Music,
  Search,
  Globe,
  Ship,
  Bot,
  Mail,
  Building2,
  Phone,
  Handshake,
  MoreHorizontal,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const SOURCE_ICON_MAP: Record<string, LucideIcon> = {
  facebook: Megaphone,
  tiktok: Music,
  google: Search,
  website_form: Globe,
  jinfocruise: Ship,
  chat_ai: Bot,
  email: Mail,
  walk_in: Building2,
  phone: Phone,
  referral: Handshake,
  other: MoreHorizontal,
}

const SOURCE_COLOR_MAP: Record<string, string> = {
  facebook: 'text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400',
  tiktok: 'text-pink-600 bg-pink-50 dark:bg-pink-950 dark:text-pink-400',
  google: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-400',
  website_form: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-950 dark:text-cyan-400',
  jinfocruise: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950 dark:text-indigo-400',
  chat_ai: 'text-violet-600 bg-violet-50 dark:bg-violet-950 dark:text-violet-400',
  email: 'text-amber-600 bg-amber-50 dark:bg-amber-950 dark:text-amber-400',
  walk_in: 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-400',
  phone: 'text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400',
  referral: 'text-orange-600 bg-orange-50 dark:bg-orange-950 dark:text-orange-400',
  other: 'text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400',
}

interface SourceIconProps {
  source: string
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  label?: string
  className?: string
}

const sizeMap = {
  sm: { icon: 12, wrapper: 'w-5 h-5' },
  md: { icon: 14, wrapper: 'w-7 h-7' },
  lg: { icon: 18, wrapper: 'w-9 h-9' },
}

export function SourceIcon({ source, size = 'sm', showLabel = false, label, className }: SourceIconProps) {
  const Icon = SOURCE_ICON_MAP[source] || SOURCE_ICON_MAP.other
  const colors = SOURCE_COLOR_MAP[source] || SOURCE_COLOR_MAP.other
  const s = sizeMap[size]

  if (showLabel) {
    return (
      <span className={cn('inline-flex items-center gap-1.5', className)}>
        <span className={cn('rounded flex items-center justify-center', s.wrapper, colors)}>
          <Icon size={s.icon} />
        </span>
        <span className="text-sm text-slate-600 dark:text-slate-400">{label || source}</span>
      </span>
    )
  }

  return (
    <span className={cn('rounded flex items-center justify-center', s.wrapper, colors, className)} title={label || source}>
      <Icon size={s.icon} />
    </span>
  )
}

export function SourceIconInline({ source, size = 14 }: { source: string; size?: number }) {
  const Icon = SOURCE_ICON_MAP[source] || SOURCE_ICON_MAP.other
  return <Icon size={size} />
}