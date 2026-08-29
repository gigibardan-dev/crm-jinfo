/**
 * src/components/leads/pipeline/PipelineFilterBar.tsx
 *
 * PipelineFilterBar
 *
 * Rândul de filtre expandabil din pagina Pipeline: agent (doar admin/
 * manager), sursă, status (inclusiv „În lucru”, care acoperă toate etapele
 * active), remindere scadente, lead-uri stagnante, prioritate, interval de
 * date + reset. Controlat integral din pagina părinte (values + setteri),
 * fără state propriu. Filtrele de status/remindere/stagnante sunt cele
 * populate automat când se vine de pe cardurile din Dashboard (ex.
 * /leads?status=won sau /leads?stagnant=true).
 * Extras din src/app/(app)/leads/page.tsx — comportament identic.
 */

'use client'

import { Bell, AlertTriangle } from 'lucide-react'
import type { Profile, LeadSource, PipelineStage } from '@/lib/types/database'

const selectClass = "px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"

interface PipelineFilterBarProps {
  isAdminOrManager: boolean
  agents: Profile[]
  sources: LeadSource[]
  stages: PipelineStage[]
  filterAgent: string
  onFilterAgentChange: (value: string) => void
  filterSource: string
  onFilterSourceChange: (value: string) => void
  filterStatus: string
  onFilterStatusChange: (value: string) => void
  filterRemindersDue: boolean
  onFilterRemindersDueChange: (value: boolean) => void
  filterStagnant: boolean
  onFilterStagnantChange: (value: boolean) => void
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
  isAdminOrManager, agents, sources, stages,
  filterAgent, onFilterAgentChange,
  filterSource, onFilterSourceChange,
  filterStatus, onFilterStatusChange,
  filterRemindersDue, onFilterRemindersDueChange,
  filterStagnant, onFilterStagnantChange,
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
      <select value={filterStatus} onChange={(e) => onFilterStatusChange(e.target.value)} className={selectClass}>
        <option value="all">Toate statusurile</option>
        <option value="in_progress">În lucru (orice etapă activă)</option>
        {stages.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
      </select>
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
      <button
        type="button"
        onClick={() => onFilterRemindersDueChange(!filterRemindersDue)}
        aria-pressed={filterRemindersDue}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border rounded-lg transition-colors ${
          filterRemindersDue
            ? 'border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-400'
            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
        }`}>
        <Bell size={14} /> Remindere scadente
      </button>
      <button
        type="button"
        onClick={() => onFilterStagnantChange(!filterStagnant)}
        aria-pressed={filterStagnant}
        title="Lead-uri fără nicio interacțiune (comentariu/schimbare status) de peste pragul configurat"
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border rounded-lg transition-colors ${
          filterStagnant
            ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400'
            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
        }`}>
        <AlertTriangle size={14} /> Doar stagnante
      </button>
      {hasActiveFilters && <button onClick={onClearFilters} className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline">Resetează</button>}
    </div>
  )
}
