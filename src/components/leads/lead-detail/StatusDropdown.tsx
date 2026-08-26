/**
 * src/components/leads/lead-detail/StatusDropdown.tsx
 *
 * StatusDropdown
 *
 * Buton + meniu dropdown pentru schimbarea statusului unui lead, folosit în
 * top bar-ul paginii de detaliu lead. Afișează stage-ul curent (colorat cu
 * culoarea din pipeline_stages) și lista tuturor stage-urilor disponibile.
 * Extras din src/app/(app)/leads/[id]/page.tsx — comportament identic,
 * doar mutat în componentă separată (props-driven, fără state propriu).
 */

'use client'

import { ChevronDown } from 'lucide-react'
import type { PipelineStage } from '@/lib/types/database'

interface StatusDropdownProps {
  stages: PipelineStage[]
  currentStage: PipelineStage | undefined
  currentStatus: string
  open: boolean
  onToggleOpen: () => void
  onSelectStatus: (slug: string) => void
}

export function StatusDropdown({ stages, currentStage, currentStatus, open, onToggleOpen, onSelectStatus }: StatusDropdownProps) {
  return (
    <div className="relative">
      <button onClick={onToggleOpen}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium border rounded-lg transition-colors"
        style={{
          color: currentStage?.color || '#64748b',
          borderColor: (currentStage?.color || '#64748b') + '40',
          backgroundColor: (currentStage?.color || '#64748b') + '08',
        }}>
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: currentStage?.color ?? undefined }} />
        {currentStage?.name || currentStatus}
        <ChevronDown size={14} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-10 py-1 max-h-80 overflow-y-auto">
          {stages.map((stage) => (
            <button key={stage.id} onClick={() => onSelectStatus(stage.slug)}
              disabled={stage.slug === currentStatus}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${stage.slug === currentStatus ? 'text-slate-300 dark:text-slate-600 cursor-default' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color ?? undefined }} />
              {stage.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
