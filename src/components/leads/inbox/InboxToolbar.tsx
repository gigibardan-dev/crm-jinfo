/**
 * src/components/leads/inbox/InboxToolbar.tsx
 *
 * InboxToolbar
 *
 * Bara de sus din /leads/inbox: contorul de leaduri nealocate și, când sunt
 * leaduri selectate, controlul de alocare în masă („Alocă la...” + dropdown
 * cu agenți). Fără state propriu — dropdown-ul deschis e controlat din
 * pagina părinte (același `showAgentDropdown` folosit și pe rândurile
 * individuale, cu valoarea specială `'bulk'`).
 * Extras din src/app/(app)/leads/inbox/page.tsx — comportament identic.
 */

'use client'

import { UserPlus, ChevronDown } from 'lucide-react'
import type { Profile } from '@/lib/types/database'

interface InboxToolbarProps {
  totalCount: number
  selectedCount: number
  agents: Profile[]
  bulkDropdownOpen: boolean
  onToggleBulkDropdown: () => void
  onBulkAssign: (agentId: string) => void
}

export function InboxToolbar({ totalCount, selectedCount, agents, bulkDropdownOpen, onToggleBulkDropdown, onBulkAssign }: InboxToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {totalCount} {totalCount === 1 ? 'lead nealocat' : 'leaduri nealocate'}
      </p>
      {selectedCount > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600 dark:text-slate-400">{selectedCount} selectat{selectedCount > 1 ? 'e' : ''}</span>
          <div className="relative">
            <button onClick={onToggleBulkDropdown}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <UserPlus size={14} /> Alocă la... <ChevronDown size={14} />
            </button>
            {bulkDropdownOpen && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-10 py-1">
                {agents.map((agent) => (
                  <button key={agent.id} onClick={() => onBulkAssign(agent.id)}
                    className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">{agent.full_name}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
