/**
 * src/components/leads/pipeline/PipelineToolbar.tsx
 *
 * PipelineToolbar
 *
 * Bara de sus a paginii Pipeline: buton „Filtre” (cu buline active + reset
 * rapid), contorul de leaduri afișate, și switch-ul Kanban/Listă.
 * Fără state propriu — controlat integral din pagina părinte.
 * Extras din src/app/(app)/leads/page.tsx — comportament identic.
 */

'use client'

import { Filter, X, Kanban, List } from 'lucide-react'

export type PipelineViewMode = 'kanban' | 'list'

interface PipelineToolbarProps {
  onToggleFilters: () => void
  hasActiveFilters: boolean
  onClearFilters: () => void
  visibleCount: number
  viewMode: PipelineViewMode
  onViewModeChange: (mode: PipelineViewMode) => void
}

export function PipelineToolbar({
  onToggleFilters, hasActiveFilters, onClearFilters, visibleCount, viewMode, onViewModeChange,
}: PipelineToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={onToggleFilters}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border rounded-lg transition-colors ${
            hasActiveFilters ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400'
              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}>
          <Filter size={14} /> Filtre
          {hasActiveFilters && (
            <button onClick={(e) => { e.stopPropagation(); onClearFilters() }} className="ml-1 p-0.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900"><X size={12} /></button>
          )}
        </button>
        <span className="text-sm text-slate-400">{visibleCount} leaduri{hasActiveFilters ? ' (filtrate)' : ''}</span>
      </div>
      <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
        <button onClick={() => onViewModeChange('kanban')}
          className={`p-1.5 rounded-md transition-colors ${viewMode === 'kanban' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-400'}`}>
          <Kanban size={16} />
        </button>
        <button onClick={() => onViewModeChange('list')}
          className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-400'}`}>
          <List size={16} />
        </button>
      </div>
    </div>
  )
}
