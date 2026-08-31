'use client'

/**
 * src/components/reports/ReportsFilterBar.tsx
 *
 * ReportsFilterBar
 *
 * Rândul de filtre globale din /reports: interval de date (manual sau
 * rapid „Lună + An", același pattern ca PipelineFilterBar), agent (doar
 * pt. a restrânge tot raportul la un singur agent) și butonul de export
 * CSV. Controlat integral din pagina părinte (values + setteri), fără
 * state propriu.
 */

import { Download } from 'lucide-react'
import { MONTHS } from '@/lib/utils/constants'
import type { Profile } from '@/lib/types/database'

const selectClass = "px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
const dateInputClass = "flex-1 sm:flex-none px-2 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 5 }, (_, i) => String(CURRENT_YEAR - i))

interface ReportsFilterBarProps {
  agents: Profile[]
  filterAgent: string
  onFilterAgentChange: (value: string) => void
  filterDateFrom: string
  onFilterDateFromChange: (value: string) => void
  filterDateTo: string
  onFilterDateToChange: (value: string) => void
  filterMonth: string
  onFilterMonthChange: (value: string) => void
  filterYear: string
  onFilterYearChange: (value: string) => void
  onExportCSV: () => void
  exportDisabled: boolean
}

export function ReportsFilterBar({
  agents, filterAgent, onFilterAgentChange,
  filterDateFrom, onFilterDateFromChange,
  filterDateTo, onFilterDateToChange,
  filterMonth, onFilterMonthChange,
  filterYear, onFilterYearChange,
  onExportCSV, exportDisabled,
}: ReportsFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl">
      <select value={filterAgent} onChange={(e) => onFilterAgentChange(e.target.value)} className={selectClass}>
        <option value="all">Toți agenții</option>
        {agents.map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
      </select>

      <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 w-full sm:w-auto text-sm text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="shrink-0">De la</span>
          <input type="date" value={filterDateFrom} onChange={(e) => onFilterDateFromChange(e.target.value)} className={dateInputClass} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="shrink-0">până la</span>
          <input type="date" value={filterDateTo} onChange={(e) => onFilterDateToChange(e.target.value)} className={dateInputClass} />
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <select value={filterMonth} onChange={(e) => onFilterMonthChange(e.target.value)} className={selectClass} title="Lună întreagă">
          <option value="">Orice lună</option>
          {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <select value={filterYear} onChange={(e) => onFilterYearChange(e.target.value)} className={selectClass} title="An">
          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <button
        type="button"
        onClick={onExportCSV}
        disabled={exportDisabled}
        className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Download size={14} /> Export CSV
      </button>
    </div>
  )
}
