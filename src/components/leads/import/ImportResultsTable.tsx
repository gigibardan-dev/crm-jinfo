/**
 * src/components/leads/import/ImportResultsTable.tsx
 *
 * ImportResultsTable
 *
 * Raportul detaliat per rând după un import: numărul rândului din Excel
 * (rândul 1 e antetul, deci primul rând de date e „2” — coincide cu ce
 * vede admin-ul dacă deschide fișierul), numele/contactul citit, status
 * (Importat/Ignorat) și explicația fiecărei probleme (motiv de ignorare
 * sau lista de avertismente). Tab-urile de filtrare (Toate/Cu avertismente/
 * Ignorate) sunt controlate din pagina părinte — fără state propriu.
 */

'use client'

import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import type { ImportRowReport } from '@/lib/leads/import-parse'

export type ImportResultsFilter = 'all' | 'warnings' | 'skipped'

interface ImportResultsTableProps {
  rows: ImportRowReport[]
  activeFilter: ImportResultsFilter
  onFilterChange: (filter: ImportResultsFilter) => void
  counts: { all: number; warnings: number; skipped: number }
}

export function ImportResultsTable({ rows, activeFilter, onFilterChange, counts }: ImportResultsTableProps) {
  const filteredRows = rows.filter((r) => {
    if (activeFilter === 'warnings') return r.status === 'imported' && r.warnings.length > 0
    if (activeFilter === 'skipped') return r.status === 'skipped'
    return true
  })

  const tabs: { key: ImportResultsFilter; label: string; count: number }[] = [
    { key: 'all', label: 'Toate', count: counts.all },
    { key: 'warnings', label: 'Cu avertismente', count: counts.warnings },
    { key: 'skipped', label: 'Ignorate', count: counts.skipped },
  ]

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div className="flex flex-wrap items-center gap-1 p-2 border-b border-slate-100 dark:border-slate-800">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onFilterChange(tab.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeFilter === tab.key
                ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {filteredRows.length === 0 ? (
        <div className="text-sm text-slate-400 text-center py-10">Niciun rând în această categorie.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-left">
                <th className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Rând</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Nume / Contact</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Status</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Observații</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.rowNumber} className="border-b border-slate-50 dark:border-slate-800 align-top">
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs whitespace-nowrap">#{row.rowNumber}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">{row.displayName}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {row.status === 'imported' ? (
                      row.warnings.length > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded">
                          <AlertTriangle size={11} /> Importat, cu avertismente
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950 px-2 py-0.5 rounded">
                          <CheckCircle2 size={11} /> Importat
                        </span>
                      )
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 px-2 py-0.5 rounded">
                        <XCircle size={11} /> Ignorat
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                    {row.status === 'skipped' && row.skipReason && (
                      <p className="text-red-600 dark:text-red-400">{row.skipReason}</p>
                    )}
                    {row.warnings.map((w, i) => (
                      <p key={i} className={i > 0 ? 'mt-1' : ''}>
                        <span className="font-medium text-slate-600 dark:text-slate-300">{w.field}:</span> {w.message}
                      </p>
                    ))}
                    {row.status === 'imported' && row.warnings.length === 0 && '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
