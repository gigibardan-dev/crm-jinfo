'use client'

/**
 * src/components/leads/import/ImportUploadForm.tsx
 *
 * ImportUploadForm
 *
 * Cardul de sus din `/leads/import`: link de descărcare a modelului .xlsx,
 * select pentru sursa implicită (aplicată rândurilor fără coloană „Sursă"
 * completată sau necunoscută), zona de selecție a fișierului
 * (`ImportDropzone` — acceptă și modelul .xlsx, și exportul brut .csv/.xls
 * din Facebook Lead Ads, detectat automat de API) și butonul de import.
 * Fără state propriu de date — primește totul din pagina părinte.
 *
 * Două moduri (comutator sus):
 * - „Leaduri" — importul obișnuit, cu sursă implicită;
 * - „Listă de apelare AI" — în loc de sursă: numele listei (ex. „Listă
 *   apelare Egipt foști clienți"), agentul AI / campania care va suna
 *   (fiecare campanie are asistentul ei Vapi, cu textul ei) și opțiunea de a
 *   pune leadurile direct în coada de apeluri. Vezi
 *   src/lib/voice/import-call-list.ts.
 */

import { Download, UploadCloud, Loader2, Users, PhoneCall } from 'lucide-react'
import type { LeadSource } from '@/lib/types/database'
import { ImportDropzone } from '@/components/leads/import/ImportDropzone'

export type ImportMode = 'leads' | 'call_list'

interface ImportUploadFormProps {
  mode: ImportMode
  onModeChange: (mode: ImportMode) => void
  campaigns: { id: string; name: string }[]
  callListName: string
  onCallListNameChange: (value: string) => void
  callCampaignId: string
  onCallCampaignIdChange: (value: string) => void
  callEnqueue: boolean
  onCallEnqueueChange: (value: boolean) => void
  sources: LeadSource[]
  defaultSource: string
  onDefaultSourceChange: (slug: string) => void
  file: File | null
  onFileSelected: (file: File | null) => void
  onSubmit: () => void
  uploading: boolean
  error: string | null
}

const inputClass = 'w-full sm:w-80 px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500'

export function ImportUploadForm({
  mode, onModeChange, campaigns, callListName, onCallListNameChange, callCampaignId, onCallCampaignIdChange,
  callEnqueue, onCallEnqueueChange,
  sources, defaultSource, onDefaultSourceChange, file, onFileSelected, onSubmit, uploading, error,
}: ImportUploadFormProps) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 sm:p-5 space-y-4">
      {/* Tipul importului */}
      <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
        {([
          { key: 'leads', label: 'Leaduri', icon: Users },
          { key: 'call_list', label: 'Listă de apelare AI', icon: PhoneCall },
        ] as const).map((m) => {
          const Icon = m.icon
          const active = mode === m.key
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => onModeChange(m.key)}
              disabled={uploading}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                active
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Icon size={14} /> {m.label}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">1. Alege sursa fișierului</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-md">
            Descarcă modelul .xlsx și completează-l manual, SAU descarcă direct leadurile din Meta Ads Manager
            (Leads Center → Download, format .csv sau .xls) și urcă fișierul așa cum e — se recunoaște automat.
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

      {mode === 'call_list' ? (
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">2. Lista de apelare</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 max-w-md">
              Fișierul trebuie să aibă telefon pe fiecare rând. Numerele care există deja în CRM nu creează lead
              nou — leadul existent e adăugat în listă și poate fi sunat din nou pentru această campanie.
            </p>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Numele listei</label>
            <input
              value={callListName}
              onChange={(e) => onCallListNameChange(e.target.value)}
              disabled={uploading}
              placeholder="ex: Listă apelare Revelion foști clienți"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Agent AI (campanie)</label>
            {campaigns.length > 0 ? (
              <select
                value={callCampaignId}
                onChange={(e) => onCallCampaignIdChange(e.target.value)}
                disabled={uploading}
                className={inputClass}
              >
                <option value="">— alege agentul AI care va suna —</option>
                {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            ) : (
              <p className="text-xs text-amber-700 dark:text-amber-400">Nicio campanie AI activă — creeaz-o în Setări → Apeluri AI.</p>
            )}
          </div>
          <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer max-w-md">
            <input
              type="checkbox"
              checked={callEnqueue}
              onChange={(e) => onCallEnqueueChange(e.target.checked)}
              disabled={uploading}
              className="mt-0.5 rounded border-slate-300 dark:border-slate-600"
            />
            <span>
              Pune imediat toate numerele în coada de apeluri
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                Altfel le găsești în Pipeline → Listă (filtru Sursă / Apel AI) și le trimiți la apel când vrei.
              </span>
            </span>
          </label>
        </div>
      ) : (
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
      )}

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
        disabled={!file || uploading || (mode === 'call_list' && (!callListName.trim() || !callCampaignId))}
        className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {uploading ? <><Loader2 size={15} className="animate-spin" /> Se importă...</> : <><UploadCloud size={15} /> {mode === 'call_list' ? 'Importă lista de apelare' : 'Importă leaduri'}</>}
      </button>
    </div>
  )
}
