/**
 * src/components/leads/lead-detail/LeadMetaSidebar.tsx
 *
 * LeadMetaSidebar
 *
 * Cardul de meta-informații din coloana dreaptă a paginii de detaliu lead:
 * sursă, agent alocat (cu dropdown de realocare pentru admin/manager),
 * dată creare/alocare/prim-răspuns, valoare câștigată sau motiv de pierdere.
 * Extras din src/app/(app)/leads/[id]/page.tsx — comportament identic.
 */

'use client'

import { UserPlus } from 'lucide-react'
import { SourceIcon } from '@/components/leads/SourceIcon'
import type { Lead, Profile } from '@/lib/types/database'
import { formatDateTime } from '@/lib/utils'

interface LeadMetaSidebarProps {
  lead: Lead
  agent: Profile | null
  agents: Profile[]
  isAdminOrManager: boolean
  showAssignDropdown: boolean
  onToggleAssignDropdown: () => void
  onReassign: (agentId: string) => void
}

export function LeadMetaSidebar({ lead, agent, agents, isAdminOrManager, showAssignDropdown, onToggleAssignDropdown, onReassign }: LeadMetaSidebarProps) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3 text-sm">
      <div className="flex justify-between items-center">
        <span className="text-slate-500 dark:text-slate-400">Sursă</span>
        <SourceIcon source={lead.source} size="md" showLabel label={lead.source_detail || lead.source} />
      </div>
      <div className="flex justify-between items-center">
        <span className="text-slate-500 dark:text-slate-400">Agent</span>
        <div className="flex items-center gap-1.5">
          <span className="text-slate-900 dark:text-slate-100">{agent?.full_name || 'Nealocat'}</span>
          {isAdminOrManager && (
            <div className="relative">
              <button onClick={onToggleAssignDropdown}
                className="p-1 rounded text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950" title="Realocă">
                <UserPlus size={13} />
              </button>
              {showAssignDropdown && (
                <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-10 py-1">
                  {agents.map((a) => (
                    <button key={a.id} onClick={() => onReassign(a.id)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 ${a.id === lead.assigned_to ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-slate-700 dark:text-slate-300'}`}>
                      {a.full_name} {a.id === lead.assigned_to && '✓'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-between">
        <span className="text-slate-500 dark:text-slate-400">Creat</span>
        <span className="text-slate-700 dark:text-slate-300 text-xs">{formatDateTime(lead.created_at)}</span>
      </div>
      {lead.assigned_at && (
        <div className="flex justify-between">
          <span className="text-slate-500 dark:text-slate-400">Alocat</span>
          <span className="text-slate-700 dark:text-slate-300 text-xs">{formatDateTime(lead.assigned_at)}</span>
        </div>
      )}
      {lead.first_response_at && (
        <div className="flex justify-between">
          <span className="text-slate-500 dark:text-slate-400">Prim răspuns</span>
          <span className="text-slate-700 dark:text-slate-300 text-xs">{formatDateTime(lead.first_response_at)}</span>
        </div>
      )}
      {lead.won_value && (
        <div className="flex justify-between">
          <span className="text-slate-500 dark:text-slate-400">Valoare</span>
          <span className="text-green-600 font-medium text-xs">{lead.won_value} EUR</span>
        </div>
      )}
      {lead.lost_reason && (
        <div className="flex justify-between">
          <span className="text-slate-500 dark:text-slate-400">Motiv pierdere</span>
          <span className="text-red-600 dark:text-red-400 text-xs">{lead.lost_reason}</span>
        </div>
      )}
    </div>
  )
}
