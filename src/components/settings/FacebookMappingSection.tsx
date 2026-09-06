'use client'

/**
 * src/components/settings/FacebookMappingSection.tsx
 *
 * Secțiunea „Mapare formulare Facebook" din /settings — admin only.
 *
 * Pt. fiecare filă din Google Sheets (= formular Facebook Lead Ads), arată
 * ce coloane a detectat automat recunoașterea (FIELD_ALIASES,
 * import-facebook.ts) pt. nume/email/telefon, și — DOAR pt. fila la care
 * ceva lipsește (sau are deja o mapare manuală salvată) — trei liste
 * derulante ca să alegi manual coloana corectă. Rezolvă formulare
 * construite cu întrebări custom text (ex: „Nume complet" în loc de
 * câmpul standard Meta), care exportă header-e nerecunoscute automat —
 * vezi discuția din chat (formularul „Promotie Circuite Revelion 2027").
 *
 * Citește LIVE din Google Sheets prin GET /api/leads/facebook-mapping (ca
 * sincronizarea reală), salvează prin PATCH pe aceeași rută. Mapările
 * salvate se aplică automat la următoarea sincronizare (la 10 minute) —
 * fără alt pas.
 */

import { useEffect, useState } from 'react'
import { Info, X, Loader2, CheckCircle2, AlertTriangle, ChevronDown } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

type IdentityField = 'full_name' | 'email' | 'phone'

const FIELD_LABELS: Record<IdentityField, string> = {
  full_name: 'Nume complet',
  email: 'Email',
  phone: 'Telefon',
}

interface FacebookFieldMapping {
  sheetTab: string
  fullNameHeader: string | null
  emailHeader: string | null
  phoneHeader: string | null
}

interface TabMappingInfo {
  tab: string
  headers: string[]
  rowsFound: number
  detected: Partial<Record<IdentityField, string>>
  override: FacebookFieldMapping | null
  missing: IdentityField[]
}

function overrideValue(override: FacebookFieldMapping | null, field: IdentityField): string {
  if (!override) return ''
  if (field === 'full_name') return override.fullNameHeader || ''
  if (field === 'email') return override.emailHeader || ''
  return override.phoneHeader || ''
}

export function FacebookMappingSection() {
  const { toast } = useToast()

  const [tabs, setTabs] = useState<TabMappingInfo[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showInfo, setShowInfo] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [drafts, setDrafts] = useState<Record<string, Record<IdentityField, string>>>({})
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/leads/facebook-mapping')
      .then((res) => res.json())
      .then((data: { tabs?: TabMappingInfo[]; error?: string }) => {
        if (data.error) {
          setLoadError(data.error)
          return
        }
        const list = data.tabs || []
        setTabs(list)
        const initialExpanded: Record<string, boolean> = {}
        const initialDrafts: Record<string, Record<IdentityField, string>> = {}
        for (const t of list) {
          initialExpanded[t.tab] = t.missing.length > 0
          initialDrafts[t.tab] = {
            full_name: overrideValue(t.override, 'full_name'),
            email: overrideValue(t.override, 'email'),
            phone: overrideValue(t.override, 'phone'),
          }
        }
        setExpanded(initialExpanded)
        setDrafts(initialDrafts)
      })
      .catch(() => setLoadError('Eroare de rețea — nu am putut citi din Google Sheets.'))
      .finally(() => setLoading(false))
  }, [])

  async function saveTab(tab: string) {
    setSaving(tab)
    const draft = drafts[tab]
    try {
      const res = await fetch('/api/leads/facebook-mapping', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheetTab: tab,
          fullNameHeader: draft.full_name || null,
          emailHeader: draft.email || null,
          phoneHeader: draft.phone || null,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setTabs((prev) =>
          (prev || []).map((t) => {
            if (t.tab !== tab) return t
            const override: FacebookFieldMapping = data.mapping
            const missing = (['full_name', 'email', 'phone'] as IdentityField[]).filter(
              (f) => !overrideValue(override, f) && !t.detected[f]
            )
            return { ...t, override, missing }
          })
        )
        toast({ title: `Mapare salvată pt. „${tab}”`, variant: 'success' })
      } else {
        toast({ title: data.error || 'Eroare la salvare', variant: 'error' })
      }
    } catch {
      toast({ title: 'Eroare de rețea', variant: 'error' })
    }
    setSaving(null)
  }

  return (
    <section>
      <div className="flex items-center gap-1.5 mb-4">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Mapare formulare Facebook</h3>
        <button
          type="button"
          onClick={() => setShowInfo(!showInfo)}
          aria-label="Cum funcționează maparea"
          className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <Info size={15} />
        </button>
      </div>

      {showInfo && (
        <div className="mb-4 bg-blue-50 dark:bg-blue-950 border border-blue-100 dark:border-blue-900 rounded-xl p-4 text-sm text-blue-900 dark:text-blue-200 space-y-2 relative">
          <button
            type="button"
            onClick={() => setShowInfo(false)}
            className="absolute top-3 right-3 text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            aria-label="Închide"
          >
            <X size={14} />
          </button>
          <p className="pr-5">
            Meta completează automat coloanele de nume/email/telefon DOAR dacă formularul folosește câmpul{' '}
            <strong>standard</strong> din Meta Ads Manager („Full Name” / „Phone Number” ca tip de întrebare
            predefinit). Dacă formularul a fost construit cu o întrebare <strong>custom</strong> (text liber,
            etichetată de exemplu „Nume complet”), Meta exportă coloana cu eticheta întrebării, nu cu numele
            standard — CRM-ul nu mai poate ghici singur ce reprezintă, iar leadul intră fără nume/telefon.
          </p>
          <p>
            <strong>Cum repari:</strong> la fila (formularul) unde lipsește ceva, alege din lista derulantă
            coloana corectă — o vezi exact cum a venit din Meta — și apasă Salvează. De la următoarea
            sincronizare (la 10 minute), leadurile de pe formularul ăla vin cu câmpul completat corect,
            automat, fără alt pas.
          </p>
          <p className="text-blue-700/80 dark:text-blue-300/80">
            Pe termen lung: dacă cel care creează formularele folosește tipul de câmp standard din Meta pt.
            nume și telefon (nu întrebări custom text), nu mai e nevoie de nicio mapare manuală, niciodată.
          </p>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-4 sm:p-5">
            <div className="animate-pulse h-16 bg-slate-50 dark:bg-slate-800 rounded-lg" />
          </div>
        ) : loadError ? (
          <p className="p-4 sm:p-5 text-sm text-slate-500 dark:text-slate-400">{loadError}</p>
        ) : !tabs || tabs.length === 0 ? (
          <p className="p-4 sm:p-5 text-sm text-slate-500 dark:text-slate-400">Niciun formular găsit în Google Sheets.</p>
        ) : (
          tabs.map((t, i) => {
            const isExpanded = !!expanded[t.tab]
            const draft = drafts[t.tab] || { full_name: '', email: '', phone: '' }
            return (
              <div key={t.tab} className={i > 0 ? 'border-t border-slate-100 dark:border-slate-800' : ''}>
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => ({ ...prev, [t.tab]: !prev[t.tab] }))}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{t.tab}</p>
                    <p className="text-xs text-slate-400">{t.rowsFound} leaduri în filă</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {t.missing.length === 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950 px-2 py-0.5 rounded">
                        <CheckCircle2 size={11} /> Mapat
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded">
                        <AlertTriangle size={11} /> Lipsesc: {t.missing.map((f) => FIELD_LABELS[f]).join(', ')}
                      </span>
                    )}
                    <ChevronDown size={15} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3">
                    {(['full_name', 'email', 'phone'] as IdentityField[]).map((field) => (
                      <div key={field} className="grid grid-cols-1 sm:grid-cols-[8rem_1fr] gap-1.5 sm:items-center">
                        <label className="text-xs font-medium text-slate-500 dark:text-slate-400">{FIELD_LABELS[field]}</label>
                        <select
                          value={draft[field]}
                          onChange={(e) =>
                            setDrafts((prev) => ({ ...prev, [t.tab]: { ...prev[t.tab], [field]: e.target.value } }))
                          }
                          className="w-full px-2.5 py-1.5 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">
                            {t.detected[field] ? `— auto: ${t.detected[field]} —` : '— nedetectat, alege coloana —'}
                          </option>
                          {t.headers.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => saveTab(t.tab)}
                        disabled={saving === t.tab}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {saving === t.tab ? <Loader2 size={14} className="animate-spin" /> : null}
                        Salvează
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}
