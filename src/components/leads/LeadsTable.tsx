/**
 * src/components/leads/LeadsTable.tsx
 *
 * LeadsTable
 *
 * Tabelul „Nume / Destinație / Sursă / Status / (Agent) / Prioritate /
 * Activitate” reutilizat în mai multe locuri (vizualizarea Listă din
 * Pipeline și lista de leaduri alocate din pagina de profil agent). Doar
 * antetul + rândurile — mesajul „niciun lead” și eventuala paginație rămân
 * la componenta apelantă, pentru a păstra exact comportamentul fiecărei
 * pagini de dinainte de refactor.
 *
 * Coloana „Agent” apare doar când i se dă `agentsById` (Pipeline, pentru
 * admin/manager) — pe pagina unui agent individual toate leadurile sunt ale
 * lui, deci coloana ar fi redundantă și rămâne ascunsă by default.
 *
 * Responsive: are `min-w-[640px]` (`min-w-[760px]` cu coloana de agent) —
 * pe ecrane înguste containerul părinte trebuie să aibă `overflow-x-auto`
 * (vezi LeadsListView și pagina de agent) ca tabelul să scroleze orizontal
 * în loc să se înghesuie coloanele.
 */

'use client'

import Link from 'next/link'
import { SourceIcon } from '@/components/leads/SourceIcon'
import { PriorityBadge } from '@/components/leads/PriorityBadge'
import { StatusBadge } from '@/components/leads/StatusBadge'
import { StagnantBadge } from '@/components/leads/StagnantBadge'
import type { Lead, PipelineStage, Profile } from '@/lib/types/database'
import { fullName, timeAgo } from '@/lib/utils'

interface LeadsTableProps {
  leads: Lead[]
  stages: PipelineStage[]
  agentsById?: Record<string, Profile>
}

export function LeadsTable({ leads, stages, agentsById }: LeadsTableProps) {
  const showAgentColumn = !!agentsById

  return (
    <table className={`w-full ${showAgentColumn ? 'min-w-[760px]' : 'min-w-[640px]'} text-sm`}>
      <thead>
        <tr className="border-b border-slate-100 dark:border-slate-800 text-left">
          <th className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Nume</th>
          <th className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Destinație</th>
          <th className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Sursă</th>
          <th className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Status</th>
          {showAgentColumn && <th className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Agent</th>}
          <th className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Prioritate</th>
          <th className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Activitate</th>
        </tr>
      </thead>
      <tbody>
        {leads.map((lead) => {
          const stage = stages.find((s) => s.slug === lead.status)
          const agent = showAgentColumn && lead.assigned_to ? agentsById?.[lead.assigned_to] : undefined
          return (
            <tr key={lead.id} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <td className="px-4 py-3">
                <Link href={`/leads/${lead.id}`} className="font-medium text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400">
                  {fullName(lead.first_name, lead.last_name)}
                </Link>
              </td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{lead.destination || '—'}</td>
              <td className="px-4 py-3"><SourceIcon source={lead.source} size="sm" /></td>
              <td className="px-4 py-3"><StatusBadge name={stage?.name || lead.status} color={stage?.color} /></td>
              {showAgentColumn && <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{agent?.full_name || '—'}</td>}
              <td className="px-4 py-3"><PriorityBadge priority={lead.priority} size="sm" /></td>
              <td className="px-4 py-3 text-xs text-slate-400">
                <div>{timeAgo(lead.last_activity_at || lead.created_at)}</div>
                <StagnantBadge status={lead.status} lastInteractionAt={lead.last_interaction_at} className="mt-1" />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
