'use client'

/**
 * src/components/leads/import/ImportUploadForm.tsx
 *
 * ImportUploadForm
 *
 * Cardul de sus din `/leads/import`: link de descărcare a modelului .xlsx,
 * select pentru sursa implicită (aplicată rândurilor fără coloană „Sursă"
 * completată sau necunoscută), zona de selecție a fișierului
 * (`ImportDropzone`) și butonul de import. Fără state propriu de date —
 * primește totul din pagina părinte.
 */

import { Download, UploadCloud, Loader2 } from 'lucide-react'
import type { LeadSource } from '@/lib/types/database'
import { ImportDropzone } from '@/components/leads/import/ImportDropzone'

interface ImportUploadFormProps {
  sources: LeadSource[]
  defaultSource: string
  onDefaultSourceChange: (slug: string) => void
  file: File | null
  onFileSelected: (file: File | null) => void
  onSubmit: () => void
  uploading: boolean
  error: string | null
}

export function ImportUploadForm({
  sources, defaultSource, onDefaultSourceChange, file, onFileSelected, onSubmit, uploading, error,
}: ImportUploadFormProps) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">1. Descarcă modelul</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-md">
            Fișierul .xlsx cu coloanele corecte + o foaie „Instrucțiuni” cu explicații pentru fiecare câmp.
          </p>
        </div>
        <a
          href="/api/leads/import/template"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shrink-0"
        >
          <Download size={14} /> Descarcă model .xlsx
        </a>
      </div>

      <div className="h-px bg-slate-100 dark:bg-slate-800" />

      <div>
        <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">2. Sursă implicită</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 max-w-md">
          Folosită pentru rândurile fără coloană „Sursă” completată (sau cu o valoare necunoscută acolo).
        </p>
        <select
          value={defaultSource}
          onChange={(e) => onDefaultSourceChange(e.target.value)}
          disabled={uploading}
          className="w-full sm:w-64 px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {sources.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
        </select>
      </div>

      <div className="h-px bg-slate-100 dark:bg-slate-800" />

      <div>
        <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">3. Fișierul completat</h3>
        <ImportDropzone selectedFile={file} onFileSelected={onFileSelected} disabled={uploading} />
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 rounded-lg px-3.5 py-2.5">{error}</div>
      )}

      <button
        onClick={onSubmit}
        disabled={!file || uploading}
        className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {uploading ? <><Loader2 size={15} className="animate-spin" /> Se importă...</> : <><UploadCloud size={15} /> Importă leaduri</>}
      </button>
    </div>
  )
}
