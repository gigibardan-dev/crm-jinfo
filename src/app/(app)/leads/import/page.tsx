'use client'

/**
 * src/app/(app)/leads/import/page.tsx
 *
 * Import Leaduri Page — import în masă, din modelul .xlsx SAU direct din
 * exportul brut Facebook Lead Ads (.csv / .xls) — formatul e detectat
 * automat de API, vezi src/lib/leads/import-facebook.ts.
 *
 * Owner de state (surse, fișier ales, upload, raport rezultat) — markup-ul
 * e delegat componentelor din src/components/leads/import/*. Acces: admin
 * sau manager (vezi Sidebar.tsx și verificarea din API route).
 *
 * Flux: descarcă model (GET /api/leads/import/template) sau descarcă
 * direct leadurile din Meta → alege sursa implicită (plasă de siguranță,
 * fișierele Facebook au deja sursa corectă) → încarcă fișierul
 * (POST /api/leads/import) → raport per rând (importat / importat cu
 * avertismente / ignorat). Leadurile importate intră nealocate, status
 * „new”, vizibile în Inbox.
 *
 * Validarea + explicarea erorilor stă în src/lib/leads/import-parse.ts;
 * coloanele acceptate (și modelul .xlsx) pornesc din
 * src/lib/leads/import-fields.ts — vezi comentariul de acolo dacă
 * formularul manual „Lead Nou” se modifică vreodată.
 *
 * Mod „Listă de apelare AI" (comutator în formular): numele listei + agentul
 * AI (campania) + opțional „pune direct în coadă". Logica pe server e în
 * src/lib/voice/import-call-list.ts; aici doar trimitem câmpurile în plus și
 * afișăm rezumatul listei deasupra raportului per rând.
 */

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import type { LeadSource } from '@/lib/types/database'
import type { ImportApiResponse } from '@/lib/leads/import-parse'
import { ImportUploadForm, type ImportMode } from '@/components/leads/import/ImportUploadForm'
import { ImportSummaryCards } from '@/components/leads/import/ImportSummaryCards'
import { ImportResultsTable, type ImportResultsFilter } from '@/components/leads/import/ImportResultsTable'
import { RotateCcw, PhoneCall, AlertTriangle } from 'lucide-react'

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

  // --- Mod „Listă de apelare AI" ---
  const [mode, setMode] = useState<ImportMode>('leads')
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([])
  const [callListName, setCallListName] = useState('')
  const [callCampaignId, setCallCampaignId] = useState('')
  const [callEnqueue, setCallEnqueue] = useState(false)

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
    supabase.from('call_campaigns').select('id, name').eq('is_active', true).order('created_at', { ascending: false })
      .then(({ data }) => setCampaigns(data || []))
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
      if (mode === 'call_list') {
        // Rândurile fără coloana „Sursă" primesc sursa „Listă apelare" (migrarea 013)
        formData.append('defaultSource', 'lista_apelare')
        formData.append('callListName', callListName.trim())
        formData.append('callCampaignId', callCampaignId)
        formData.append('callEnqueue', String(callEnqueue))
      } else {
        formData.append('defaultSource', defaultSource)
      }

      const res = await fetch('/api/leads/import', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        setUploadError(data.error || 'Eroare la import.')
        setUploading(false)
        return
      }

      setResult(data)
      setResultsFilter('all')
      if (data.callList) {
        const cl = data.callList as NonNullable<ImportApiResponse['callList']>
        toast({
          title: `Lista „${cl.name}": ${cl.created + cl.linked} numere`,
          description: `${cl.created} leaduri noi, ${cl.linked} existente adăugate în listă${cl.enqueue.requested ? `, ${cl.enqueue.queued} puse în coada de apeluri` : ''}.`,
          variant: cl.enqueue.error ? 'warning' : 'success',
        })
      } else toast({
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
          Adaugă mai multe leaduri deodată — din modelul nostru .xlsx sau direct din exportul Facebook Lead Ads
          (.csv / .xls, nemodificat). Leadurile importate intră nealocate în Inbox, exact ca cele venite din
          canalele online — apoi le aloci agenților de acolo.
        </p>

        <ImportUploadForm
          mode={mode}
          onModeChange={setMode}
          campaigns={campaigns}
          callListName={callListName}
          onCallListNameChange={setCallListName}
          callCampaignId={callCampaignId}
          onCallCampaignIdChange={setCallCampaignId}
          callEnqueue={callEnqueue}
          onCallEnqueueChange={setCallEnqueue}
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
              <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Rezultat import
                <span className="text-xs font-normal px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                  {result.sourceFormat === 'facebook' ? 'Export Facebook Lead Ads' : 'Model .xlsx'}
                </span>
              </h3>
              <button onClick={handleReset}
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300">
                <RotateCcw size={12} /> Importă alt fișier
              </button>
            </div>

            {/* Rezumatul listei de apelare AI */}
            {result.callList && (
              <div className="bg-violet-50 dark:bg-violet-950 border border-violet-100 dark:border-violet-900 rounded-xl p-4 text-sm text-violet-900 dark:text-violet-100 space-y-1.5">
                <p className="font-medium flex items-center gap-1.5">
                  <PhoneCall size={14} /> Lista „{result.callList.name}” · agent AI: {result.callList.campaignName}
                </p>
                <p>
                  {result.callList.created} leaduri noi create · {result.callList.linked} numere existau deja în CRM și au
                  fost adăugate în listă (fără duplicat).
                </p>
                {result.callList.enqueue.requested ? (
                  <p>
                    {result.callList.enqueue.queued} puse în coada de apeluri
                    {result.callList.enqueue.outsideHours && ' — suntem în afara intervalului orar, pornesc când reiei coada în program'}
                    {result.callList.enqueue.skipped.length > 0 &&
                      `. Nepuse în coadă: ${result.callList.enqueue.skipped.map((s) => `${s.count} × ${s.reason}`).join(' · ')}`}
                    .
                  </p>
                ) : (
                  <p className="text-violet-700/80 dark:text-violet-300/80">
                    Nu au fost puse în coadă. Le găsești în Pipeline → Listă, de unde le selectezi și le trimiți la apel.
                  </p>
                )}
                {result.callList.enqueue.error && (
                  <p className="flex items-start gap-1.5 text-red-700 dark:text-red-400">
                    <AlertTriangle size={13} className="shrink-0 mt-0.5" /> {result.callList.enqueue.error}
                  </p>
                )}
              </div>
            )}

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
