/**
 * src/components/leads/inbox/InboxLeadRow.tsx
 *
 * InboxLeadRow
 *
 * Un rând din lista /leads/inbox: checkbox de selecție, sursă, nume +
 * prioritate (link către detaliul lead-ului), destinație/date/călători,
 * timp de la creare și dropdown de alocare individuală la un agent.
 * Extras din src/app/(app)/leads/inbox/page.tsx — comportament identic.
 */

'use client'

import Link from 'next/link'
import { UserPlus, MapPin, Calendar, Users } from 'lucide-react'
import { SourceIcon } from '@/components/leads/SourceIcon'
import { PriorityBadge } from '@/components/leads/PriorityBadge'
import type { Lead, Profile } from '@/lib/types/database'
import { fullName, timeAgo, formatTravelDates, formatTravelers } from '@/lib/utils'

interface InboxLeadRowProps {
  lead: Lead
  agents: Profile[]
  selected: boolean
  onToggleSelect: () => void
  assigning: boolean
  dropdownOpen: boolean
  onToggleDropdown: () => void
  onAssign: (agentId: string) => void
}

export function InboxLeadRow({ lead, agents, selected, onToggleSelect, assigning, dropdownOpen, onToggleDropdown, onAssign }: InboxLeadRowProps) {
  return (
    <div className={`bg-white dark:bg-slate-900 border rounded-xl p-4 flex flex-wrap items-center gap-3 sm:gap-4 transition-colors ${
      selected ? 'border-blue-300 dark:border-blue-700 bg-blue-50/30 dark:bg-blue-950/30'
        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
    }`}>
      <input type="checkbox" checked={selected} onChange={onToggleSelect}
        className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 shrink-0" />
      <SourceIcon source={lead.source} size="md" />
      <Link href={`/leads/${lead.id}`} className="flex-1 min-w-[10rem] group">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
            {fullName(lead.first_name, lead.last_name)}
          </span>
          <PriorityBadge priority={lead.priority} size="sm" />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          {lead.destination && <span className="flex items-center gap-1"><MapPin size={11} /> {lead.destination}</span>}
          {lead.travel_date_from && <span className="flex items-center gap-1"><Calendar size={11} /> {formatTravelDates(lead.travel_date_from, lead.travel_date_to)}</span>}
          <span className="flex items-center gap-1"><Users size={11} /> {formatTravelers(lead.nr_adults, lead.nr_children)}</span>
        </div>
      </Link>
      <span className="text-xs text-slate-400 whitespace-nowrap order-last sm:order-none">{timeAgo(lead.created_at)}</span>
      <div className="relative">
        <button onClick={onToggleDropdown}
          disabled={assigning}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50">
          <UserPlus size={13} /> Alocă
        </button>
        {dropdownOpen && (
          <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-10 py-1">
            {agents.map((agent) => (
              <button key={agent.id} onClick={() => onAssign(agent.id)}
                className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">{agent.full_name}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
