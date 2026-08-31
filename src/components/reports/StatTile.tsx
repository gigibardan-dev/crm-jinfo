'use client'

/**
 * src/components/reports/StatTile.tsx
 *
 * StatTile
 *
 * Cadru KPI reutilizabil pt. /reports: etichetă + valoare mare + subtext
 * opțional. Contractul „figures" din skill-ul dataviz — un singur număr,
 * font sans (fără serif), cifre proporționale (nu tabular) la mărimea asta.
 */

import type { LucideIcon } from 'lucide-react'

interface StatTileProps {
  label: string
  value: string
  sub?: string
  icon: LucideIcon
  tone?: 'default' | 'good' | 'critical'
}

export function StatTile({ label, value, sub, icon: Icon, tone = 'default' }: StatTileProps) {
  const toneClass = tone === 'good'
    ? 'text-[#0ca30c]'
    : tone === 'critical'
      ? 'text-[#d03b3b] dark:text-[#e66767]'
      : 'text-blue-600 dark:text-blue-400'

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
        <div className={`w-7 h-7 rounded-lg bg-slate-50 dark:bg-slate-800 ${toneClass} flex items-center justify-center shrink-0`}>
          <Icon size={14} />
        </div>
      </div>
      <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{value}</div>
      {sub && <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">{sub}</div>}
    </div>
  )
}
