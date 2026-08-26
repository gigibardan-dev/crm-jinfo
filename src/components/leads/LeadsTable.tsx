/**
 * src/components/leads/LeadsTable.tsx
 *
 * LeadsTable
 *
 * Tabelul „Nume / Destinație / Sursă / Status / Prioritate / Activitate”
 * reutilizat în mai multe locuri (vizualizarea Listă din Pipeline și lista
 * de leaduri alocate din pagina de profil agent). Doar antetul + rândurile —
 * mesajul „niciun lead” și eventuala paginație rămân la componenta apelantă,
 * pentru a păstra exact comportamentul fiecărei pagini de dinainte de
 * refactor.
 *
 * Responsive: are `min-w-[640px]` — pe ecrane înguste containerul părinte
 * trebuie să aibă `overflow-x-auto` (vezi LeadsListView și pagina de agent)
 * ca tabelul să scroleze orizontal în loc să se înghesuie coloanele.
 */

'use client'

import Link from 'next/link'
import { SourceIcon } from '@/components/leads/SourceIcon'
import { PriorityBadge } from '@/components/leads/PriorityBadge'
import { StatusBadge } from '@/components/leads/StatusBadge'
import type { Lead, PipelineStage } from '@/lib/types/database'
import { fullName, timeAgo } from '@/lib/utils'

interface LeadsTableProps {
  leads: Lead[]
  stages: PipelineStage[]
}

export function LeadsTable({ leads, stages }: LeadsTableProps) {
  return (
    <table className="w-full min-w-[640px] text-sm">
      <thead>
        <tr className="border-b border-slate-100 dark:border-slate-800 text-left">
          <th className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Nume</th>
          <th className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Destinație</th>
          <th className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Sursă</th>
          <th className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Status</th>
          <th className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Prioritate</th>
          <th className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Activitate</th>
        </tr>
      </thead>
      <tbody>
        {leads.map((lead) => {
          const stage = stages.find((s) => s.slug === lead.status)
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
              <td className="px-4 py-3"><PriorityBadge priority={lead.priority} size="sm" /></td>
              <td className="px-4 py-3 text-xs text-slate-400">{timeAgo(lead.last_activity_at || lead.created_at)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
