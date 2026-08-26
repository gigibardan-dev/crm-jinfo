/**
 * src/components/leads/import/ImportSummaryCards.tsx
 *
 * ImportSummaryCards
 *
 * Cele 4 carduri de rezumat afișate după un import: total rânduri citite,
 * importate cu succes, importate dar cu avertismente (necesită o verificare
 * rapidă), și ignorate (fără nicio informație de contact). Pur
 * prezentațională — primește doar numerele calculate din răspunsul API.
 */

import { FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'

interface ImportSummaryCardsProps {
  totalRows: number
  imported: number
  withWarnings: number
  skipped: number
}

export function ImportSummaryCards({ totalRows, imported, withWarnings, skipped }: ImportSummaryCardsProps) {
  const cards = [
    { label: 'Rânduri citite', value: totalRows, icon: FileSpreadsheet, color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800' },
    { label: 'Importate', value: imported, icon: CheckCircle2, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950' },
    { label: 'Cu avertismente', value: withWarnings, icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950' },
    { label: 'Ignorate', value: skipped, icon: XCircle, color: 'text-red-500 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950' },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div key={card.label} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">{card.label}</span>
              <div className={`w-7 h-7 rounded-lg ${card.bg} ${card.color} flex items-center justify-center`}>
                <Icon size={14} />
              </div>
            </div>
            <span className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{card.value}</span>
          </div>
        )
      })}
    </div>
  )
}
