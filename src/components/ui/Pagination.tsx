'use client'

/**
 * src/components/ui/Pagination.tsx
 *
 * Pagination Component
 *
 * Reusable pagination with:
 * - Previous / Next buttons
 * - Page number display
 * - Items per page selector
 * - Total count display
 * 
 * Usage:
 *   <Pagination
 *     currentPage={page}
 *     totalItems={total}
 *     itemsPerPage={perPage}
 *     onPageChange={setPage}
 *     onItemsPerPageChange={setPerPage}
 *   />
 */

import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  currentPage: number
  totalItems: number
  itemsPerPage: number
  onPageChange: (page: number) => void
  onItemsPerPageChange?: (perPage: number) => void
  showPerPage?: boolean
}

export function Pagination({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  showPerPage = true,
}: PaginationProps) {
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  const startItem = (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalItems)

  if (totalItems === 0) return null

  return (
    <div className="flex items-center justify-between py-3 px-1">
      {/* Left: item count */}
      <div className="text-xs text-slate-500 dark:text-slate-400">
        {startItem}–{endItem} din {totalItems}
      </div>

      {/* Center: page navigation */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={16} />
        </button>

        {/* Page numbers — show max 5 */}
        {generatePageNumbers(currentPage, totalPages).map((pageNum, i) =>
          pageNum === '...' ? (
            <span key={`dots-${i}`} className="px-1 text-xs text-slate-400">...</span>
          ) : (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum as number)}
              className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                pageNum === currentPage
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {pageNum}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Right: per page selector */}
      {showPerPage && onItemsPerPageChange ? (
        <select
          value={itemsPerPage}
          onChange={(e) => {
            onItemsPerPageChange(Number(e.target.value))
            onPageChange(1) // Reset to first page
          }}
          className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value={25}>25 / pag</option>
          <option value={50}>50 / pag</option>
          <option value={100}>100 / pag</option>
        </select>
      ) : (
        <div /> // Spacer for layout
      )}
    </div>
  )
}

/** Generate page number array with ellipsis for large ranges */
function generatePageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const pages: (number | '...')[] = [1]

  if (current > 3) pages.push('...')

  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)

  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  if (current < total - 2) pages.push('...')
  pages.push(total)

  return pages
}
