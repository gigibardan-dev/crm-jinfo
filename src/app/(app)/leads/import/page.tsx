'use client'

/**
 * src/app/(app)/leads/import/page.tsx
 *
 * Import Leaduri Page — import în masă dintr-un fișier .xlsx
 *
 * Owner de state (surse, fișier ales, upload, raport rezultat) — markup-ul
 * e delegat componentelor din src/components/leads/import/*. Acces: admin
 * sau manager (vezi Sidebar.tsx și verificarea din API route).
 *
 * Flux: descarcă model (GET /api/leads/import/template) → completează în
 * Excel → alege sursa implicită → încarcă fișierul (POST /api/leads/import)
 * → raport per rând (importat / importat cu avertismente / ignorat).
 * Leadurile importate intră nealocate, status „new”, vizibile în Inbox.
 *
 * Validarea + explicarea erorilor stă în src/lib/leads/import-parse.ts;
 * coloanele acceptate (și modelul .xlsx) pornesc din
 * src/lib/leads/import-fields.ts — vezi comentariul de acolo dacă
 * formularul manual „Lead Nou” se modifică vreodată.
 */

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import type { LeadSource } from '@/lib/types/database'
import type { ImportApiResponse } from '@/lib/leads/import-parse'
import { ImportUploadForm } from '@/components/leads/import/ImportUploadForm'
import { ImportSummaryCards } from '@/components/leads/import/ImportSummaryCards'
import { ImportResultsTable, type ImportResultsFilter } from '@/components/leads/import/ImportResultsTable'
import { RotateCcw } from 'lucide-react'

export default function LeadsImportPage() {
  const { isAdminOrManager } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()

  const [sources, setSources] = useState<LeadSource[]>([])
  const [defaultSource, setDefaultSource] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportApiResponse | null>(null)
  const [resultsFilter, setResultsFilter] = useState<ImportResultsFilter>('all')

  useEffect(() => {
    if (!isAdminOrManager) return
    supabase.from('lead_sources').select('*').eq('is_active', true).order('name')
      .then(({ data }) => {
        setSources(data || [])
        if (data && data.length > 0) {
          const other = data.find((s) => s.slug === 'other')
          setDefaultSource(other?.slug || data[0].slug)
        }
      })
  }, [supabase, isAdminOrManager])

  function handleFileSelected(newFile: File | null) {
    setFile(newFile)
    setUploadError(null)
  }

  async function handleSubmit() {
    if (!file) return
    setUploading(true)
    setUploadError(null)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('defaultSource', defaultSource)

      const res = await fetch('/api/leads/import', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        setUploadError(data.error || 'Eroare la import.')
        setUploading(false)
        return
      }

      setResult(data)
      setResultsFilter('all')
      toast({
        title: `${data.imported} leaduri importate`,
        variant: data.skipped > 0 ? 'warning' : 'success',
        description: data.skipped > 0 ? `${data.skipped} rânduri ignorate — vezi raportul.` : undefined,
      })
    } catch {
      setUploadError('Eroare de rețea. Încearcă din nou.')
    }

    setUploading(false)
  }

  function handleReset() {
    setFile(null)
    setResult(null)
    setUploadError(null)
    setResultsFilter('all')
  }

  if (!isAdminOrManager) {
    return (
      <>
        <Header title="Import Leaduri" />
        <div className="p-4 sm:p-6 text-sm text-slate-500 dark:text-slate-400">Nu ai acces la această pagină.</div>
      </>
    )
  }

  return (
    <>
      <Header title="Import Leaduri" />
      <div className="p-4 sm:p-6 max-w-4xl space-y-6">
        <p className="text-sm text-slate-500 dark:text-slate-400 -mt-2">
          Adaugă mai multe leaduri deodată dintr-un fișier Excel. Leadurile importate intră nealocate în Inbox,
          exact ca cele venite din canalele online — apoi le aloci agenților de acolo.
        </p>

        <ImportUploadForm
          sources={sources}
          defaultSource={defaultSource}
          onDefaultSourceChange={setDefaultSource}
          file={file}
          onFileSelected={handleFileSelected}
          onSubmit={handleSubmit}
          uploading={uploading}
          error={uploadError}
        />

        {result && (
          <>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">Rezultat import</h3>
              <button onClick={handleReset}
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300">
                <RotateCcw size={12} /> Importă alt fișier
              </button>
            </div>

            <ImportSummaryCards
              totalRows={result.totalRows}
              imported={result.imported}
              withWarnings={result.withWarnings}
              skipped={result.skipped}
            />

            <ImportResultsTable
              rows={result.rows}
              activeFilter={resultsFilter}
              onFilterChange={setResultsFilter}
              counts={{ all: result.rows.length, warnings: result.withWarnings, skipped: result.skipped }}
            />
          </>
        )}
      </div>
    </>
  )
}
