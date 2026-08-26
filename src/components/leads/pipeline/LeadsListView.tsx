/**
 * src/components/leads/pipeline/LeadsListView.tsx
 *
 * LeadsListView
 *
 * Vizualizarea tabelară (listă) din pagina Pipeline: randează LeadsTable
 * (tabelul comun) + controalele de paginație (componenta Pagination).
 * Primește doar pagina curentă de leaduri deja paginate + totalul filtrat.
 * Extras din src/app/(app)/leads/page.tsx — comportament identic.
 */

'use client'

import { LeadsTable } from '@/components/leads/LeadsTable'
import { Pagination } from '@/components/ui/Pagination'
import type { Lead, PipelineStage, Profile } from '@/lib/types/database'

interface LeadsListViewProps {
  paginatedLeads: Lead[]
  totalFilteredCount: number
  stages: PipelineStage[]
  agentsById?: Record<string, Profile>
  currentPage: number
  itemsPerPage: number
  onPageChange: (page: number) => void
  onItemsPerPageChange: (count: number) => void
}

export function LeadsListView({
  paginatedLeads, totalFilteredCount, stages, agentsById, currentPage, itemsPerPage, onPageChange, onItemsPerPageChange,
}: LeadsListViewProps) {
  return (
    <>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <LeadsTable leads={paginatedLeads} stages={stages} agentsById={agentsById} />
        </div>
        {totalFilteredCount === 0 && <div className="text-sm text-slate-400 text-center py-12">Niciun lead de afișat.</div>}
      </div>

      <Pagination
        currentPage={currentPage}
        totalItems={totalFilteredCount}
        itemsPerPage={itemsPerPage}
        onPageChange={onPageChange}
        onItemsPerPageChange={onItemsPerPageChange}
      />
    </>
  )
}
