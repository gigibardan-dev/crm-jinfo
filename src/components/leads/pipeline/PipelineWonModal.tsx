/**
 * src/components/leads/pipeline/PipelineWonModal.tsx
 *
 * PipelineWonModal
 *
 * Modal de confirmare „lead câștigat” cu valoare booking opțională, folosit
 * din pagina Pipeline. Momentan nimic din pagină încă nu setează
 * `showWonModal`/`wonLeadId` la true (rămas ca hook pentru o viitoare
 * acțiune rapidă gen drag-to-won din Kanban) — comportamentul e păstrat
 * neschimbat față de fișierul original, doar mutat în componentă separată.
 * Extras din src/app/(app)/leads/page.tsx.
 */

'use client'

import { Trophy } from 'lucide-react'

interface PipelineWonModalProps {
  wonValue: string
  onWonValueChange: (value: string) => void
  onCancel: () => void
  onConfirm: () => void
}

export function PipelineWonModal({ wonValue, onWonValueChange, onCancel, onConfirm }: PipelineWonModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-sm p-6 mx-4 border border-slate-200 dark:border-slate-700">
        <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 flex items-center justify-center mx-auto mb-4"><Trophy size={24} /></div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 text-center mb-1">Lead câștigat</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-5">Introdu valoarea booking-ului (opțional).</p>
        <div className="mb-5">
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Valoare (EUR)</label>
          <input type="number" min={0} step={0.01} value={wonValue} onChange={(e) => onWonValueChange(e.target.value)}
            placeholder="ex: 2500" autoFocus
            className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onCancel}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Anulează</button>
          <button onClick={onConfirm}
            className="flex-1 px-4 py-2.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">Confirmă</button>
        </div>
      </div>
    </div>
  )
}
