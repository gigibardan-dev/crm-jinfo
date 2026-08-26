/**
 * src/components/leads/pipeline/PipelineFilterBar.tsx
 *
 * PipelineFilterBar
 *
 * Rândul de filtre expandabil din pagina Pipeline: agent (doar admin/
 * manager), sursă, prioritate, interval de date + reset. Controlat integral
 * din pagina părinte (values + setteri), fără state propriu.
 * Extras din src/app/(app)/leads/page.tsx — comportament identic.
 */

'use client'

import type { Profile, LeadSource } from '@/lib/types/database'

const selectClass = "px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"

interface PipelineFilterBarProps {
  isAdminOrManager: boolean
  agents: Profile[]
  sources: LeadSource[]
  filterAgent: string
  onFilterAgentChange: (value: string) => void
  filterSource: string
  onFilterSourceChange: (value: string) => void
  filterPriority: string
  onFilterPriorityChange: (value: string) => void
  filterDateFrom: string
  onFilterDateFromChange: (value: string) => void
  filterDateTo: string
  onFilterDateToChange: (value: string) => void
  hasActiveFilters: boolean
  onClearFilters: () => void
}

export function PipelineFilterBar({
  isAdminOrManager, agents, sources,
  filterAgent, onFilterAgentChange,
  filterSource, onFilterSourceChange,
  filterPriority, onFilterPriorityChange,
  filterDateFrom, onFilterDateFromChange,
  filterDateTo, onFilterDateToChange,
  hasActiveFilters, onClearFilters,
}: PipelineFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl">
      {isAdminOrManager && (
        <select value={filterAgent} onChange={(e) => onFilterAgentChange(e.target.value)} className={selectClass}>
          <option value="all">Toți agenții</option>
          {agents.map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
        </select>
      )}
      <select value={filterSource} onChange={(e) => onFilterSourceChange(e.target.value)} className={selectClass}>
        <option value="all">Toate sursele</option>
        {sources.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
      </select>
      <select value={filterPriority} onChange={(e) => onFilterPriorityChange(e.target.value)} className={selectClass}>
        <option value="all">Orice prioritate</option>
        <option value="urgent">Urgent</option>
        <option value="high">Ridicat</option>
        <option value="medium">Mediu</option>
        <option value="low">Scăzut</option>
      </select>
      <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
        <span>De la</span>
        <input type="date" value={filterDateFrom} onChange={(e) => onFilterDateFromChange(e.target.value)}
          className="px-2 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <span>până la</span>
        <input type="date" value={filterDateTo} onChange={(e) => onFilterDateToChange(e.target.value)}
          className="px-2 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      {hasActiveFilters && <button onClick={onClearFilters} className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline">Resetează</button>}
    </div>
  )
}
