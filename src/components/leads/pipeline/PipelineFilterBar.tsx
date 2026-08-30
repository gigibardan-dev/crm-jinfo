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
 *
 * Intervalul de date are două căi, care scriu în ACELEAȘI filterDateFrom/
 * filterDateTo:
 * - manual, câmp cu câmp („De la” / „până la”);
 * - rapid, „Lună + An” — selectând o lună, pagina părinte calculează prima/
 *   ultima zi a lunii respective și le pune direct în filterDateFrom/To
 *   (vezi handleMonthChange/handleYearChange din leads/page.tsx). Editarea
 *   manuală a câmpurilor de dată resetează selectul de lună la „Orice lună”,
 *   ca cele două căi să nu rămână desincronizate vizual.
 *
 * Responsive: „De la/până la” stă pe un rând orizontal doar de la `sm` în
 * sus — sub `sm` (telefon) cele două input-uri de tip date (cu lățime
 * minimă impusă de browser) nu încap unul lângă altul pe același rând, deci
 * fiecare stă pe rândul lui.
 * Extras din src/app/(app)/leads/page.tsx — comportament identic.
 */

'use client'

import { Bell, AlertTriangle } from 'lucide-react'
import { MONTHS } from '@/lib/utils/constants'
import type { Profile, LeadSource, PipelineStage } from '@/lib/types/database'

const selectClass = "px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
const dateInputClass = "flex-1 sm:flex-none px-2 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"

// Anii disponibili în selectul rapid „Lună întreagă" — anul curent + ultimii 4.
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 5 }, (_, i) => String(CURRENT_YEAR - i))

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
  filterMonth: string
  onFilterMonthChange: (value: string) => void
  filterYear: string
  onFilterYearChange: (value: string) => void
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
  filterMonth, onFilterMonthChange,
  filterYear, onFilterYearChange,
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
      {/* Interval manual — pe telefon fiecare câmp de dată stă pe rândul lui,
          altfel nu încap unul lângă altul (lățime minimă impusă de browser). */}
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

      {/* Lună întreagă — shortcut pt. intervalul de mai sus: alege o lună (+ an)
          și pagina părinte calculează automat prima/ultima zi a lunii. */}
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
