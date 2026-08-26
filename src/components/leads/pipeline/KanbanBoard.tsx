/**
 * src/components/leads/pipeline/KanbanBoard.tsx
 *
 * KanbanBoard
 *
 * Vizualizarea Kanban din pagina Pipeline: o coloană per pipeline stage
 * (vizibile: cele non-terminale + won/lost), fiecare cu scroll propriu și
 * cardurile de lead (prioritate, sursă, nume, destinație, agentul alocat,
 * ultima activitate, indicator reminder). Pur prezentațională — primește
 * lista deja filtrată și stage-urile vizibile. Numele agentului se
 * actualizează automat la realocare (pagina părinte reface fetch-ul pe
 * orice schimbare din tabela `leads`, deci `leads` ajunge mereu la zi).
 * Extras din src/app/(app)/leads/page.tsx — comportament identic.
 */

'use client'

import Link from 'next/link'
import { Bell, User } from 'lucide-react'
import { SourceIcon } from '@/components/leads/SourceIcon'
import { PriorityBadge } from '@/components/leads/PriorityBadge'
import type { Lead, PipelineStage, Profile } from '@/lib/types/database'
import { fullName, timeAgo } from '@/lib/utils'

interface KanbanBoardProps {
  visibleStages: PipelineStage[]
  leads: Lead[]
  agentsById?: Record<string, Profile>
}

export function KanbanBoard({ visibleStages, leads, agentsById }: KanbanBoardProps) {
  function getLeadsForStage(slug: string) {
    return leads.filter((l) => l.status === slug)
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '70vh' }}>
      {visibleStages.map((stage) => {
        const stageLeads = getLeadsForStage(stage.slug)
        return (
          <div key={stage.id} className="w-72 flex-shrink-0 bg-slate-50 dark:bg-slate-900 rounded-xl flex flex-col border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100 dark:border-slate-800">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color || '#94a3b8' }} />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">{stage.name}</span>
              <span className="text-xs text-slate-400 ml-auto">{stageLeads.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {stageLeads.map((lead) => {
                const agent = lead.assigned_to ? agentsById?.[lead.assigned_to] : undefined
                return (
                  <Link key={lead.id} href={`/leads/${lead.id}`}
                    className="block bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm transition-all">
                    <div className="flex items-center justify-between mb-1.5">
                      <PriorityBadge priority={lead.priority} size="sm" />
                      <SourceIcon source={lead.source} size="sm" />
                    </div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{fullName(lead.first_name, lead.last_name)}</p>
                    {lead.destination && <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{lead.destination}</p>}
                    {agent && (
                      <p className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 truncate">
                        <User size={10} className="shrink-0" /> {agent.full_name}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-400">
                      <span>{timeAgo(lead.last_activity_at || lead.created_at)}</span>
                      {lead.next_followup_at && <span className="flex items-center gap-0.5"><Bell size={10} /> Reminder</span>}
                    </div>
                  </Link>
                )
              })}
              {stageLeads.length === 0 && <div className="text-xs text-slate-300 dark:text-slate-600 text-center py-6">Niciun lead</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
