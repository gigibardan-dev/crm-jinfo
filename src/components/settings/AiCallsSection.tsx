/**
 * src/components/settings/AiCallsSection.tsx
 *
 * Setări → Apeluri AI
 *
 * Două blocuri:
 *   1. Starea configurării (citită de pe server prin GET /api/voice/campaigns):
 *      cheie Vapi, număr de telefon, secret webhook, URL webhook, interval
 *      orar, apeluri simultane. Arată clar ce lipsește înainte de primul apel
 *      și avertizează dacă e activ modul de test (AI_CALL_IGNORE_HOURS).
 *      Valorile se schimbă din variabilele de mediu (.env.local / Vercel),
 *      nu din UI — aici sunt doar afișate.
 *   2. Campanii: o campanie = un asistent Vapi (MVP: câte un asistent per
 *      campanie, duplicat în Vapi și modificat doar la prompt/first message).
 *      Adăugare, editare, activare/dezactivare. ID-ul asistentului e verificat
 *      în Vapi la salvare. Comutatorul „Apelare automată" e vizibil dar
 *      blocat — vine în Pasul 2.
 *
 * Self-contained (își face singur fetch-ul), ca FacebookMappingSection.
 */

'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Info, X, Loader2, CheckCircle2, AlertTriangle, Plus, Pencil, Copy, Bot, Clock, Zap,
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import type { CallCampaign } from '@/lib/types/database'

type CampaignRow = CallCampaign & { calls_count: number }

type VoiceConfig = {
  apiKeySet: boolean
  phoneNumberIdSet: boolean
  webhookSecretSet: boolean
  webhookUrl: string | null
  ignoreHours: boolean
  hours: string
  days: string
  maxConcurrent: number
  withinHoursNow: boolean
}

type FormState = { id: string | null; name: string; vapi_assistant_id: string; description: string }

const EMPTY_FORM: FormState = { id: null, name: '', vapi_assistant_id: '', description: '' }

type VoiceDataResult = { campaigns: CampaignRow[]; config: VoiceConfig | null } | { error: string }

/** GET /api/voice/campaigns — campaniile + starea configurării de pe server. */
async function fetchVoiceData(): Promise<VoiceDataResult> {
  try {
    const res = await fetch('/api/voice/campaigns', { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) return { error: data.error || 'Eroare la încărcare' }
    return { campaigns: data.campaigns || [], config: data.config || null }
  } catch {
    return { error: 'Eroare de rețea' }
  }
}

const DAY_NAMES = ['', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă', 'duminică']

function daysLabel(days: string): string {
  const [from, to] = days.split('-').map(Number)
  return from && to ? `${DAY_NAMES[from]}–${DAY_NAMES[to]}` : days
}

const inputClass =
  'w-full px-2.5 py-1.5 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'

/** Un rând din blocul de configurare: etichetă + OK/lipsă. */
function ConfigRow({ label, ok, value }: { label: string; ok: boolean; value?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
      <span
        className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded max-w-[60%] truncate ${
          ok
            ? 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950'
            : 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950'
        }`}
        title={value}
      >
        {ok ? <CheckCircle2 size={11} className="shrink-0" /> : <AlertTriangle size={11} className="shrink-0" />}
        <span className="truncate">{value ?? (ok ? 'Setat' : 'Lipsește')}</span>
      </span>
    </div>
  )
}

export function AiCallsSection() {
  const { toast } = useToast()

  const [campaigns, setCampaigns] = useState<CampaignRow[]>([])
  const [config, setConfig] = useState<VoiceConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showInfo, setShowInfo] = useState(false)

  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  /** Aplică rezultatul fetch-ului în state (folosit la montare și după salvări). */
  const apply = useCallback((r: VoiceDataResult) => {
    if ('error' in r) {
      setLoadError(r.error)
    } else {
      setCampaigns(r.campaigns)
      setConfig(r.config)
      setLoadError(null)
    }
    setLoading(false)
  }, [])

  const load = useCallback(async () => apply(await fetchVoiceData()), [apply])

  useEffect(() => {
    fetchVoiceData().then(apply)
  }, [apply])

  /** Creează sau editează o campanie (ID-ul asistentului e verificat în Vapi pe server). */
  async function saveForm(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    setSaving(true)
    setFormError(null)

    const payload = {
      name: form.name,
      vapi_assistant_id: form.vapi_assistant_id,
      description: form.description,
    }
    const isEdit = !!form.id

    try {
      const res = await fetch(isEdit ? `/api/voice/campaigns/${form.id}` : '/api/voice/campaigns', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setFormError(data.error || 'Eroare la salvare')
      } else {
        toast({
          title: isEdit ? 'Campanie actualizată' : 'Campanie creată',
          description: data.assistantName ? `Asistent Vapi: ${data.assistantName}` : undefined,
          variant: 'success',
        })
        setForm(null)
        await load()
      }
    } catch {
      setFormError('Eroare de rețea')
    }
    setSaving(false)
  }

  async function toggleActive(c: CampaignRow) {
    setTogglingId(c.id)
    try {
      const res = await fetch(`/api/voice/campaigns/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !c.is_active }),
      })
      if (res.ok) {
        setCampaigns((prev) => prev.map((p) => (p.id === c.id ? { ...p, is_active: !c.is_active } : p)))
        toast({ title: !c.is_active ? 'Campanie activată' : 'Campanie dezactivată', variant: !c.is_active ? 'success' : 'warning' })
      } else {
        const data = await res.json()
        toast({ title: data.error || 'Eroare', variant: 'error' })
      }
    } catch {
      toast({ title: 'Eroare de rețea', variant: 'error' })
    }
    setTogglingId(null)
  }

  async function copyId(id: string) {
    try {
      await navigator.clipboard.writeText(id)
      toast({ title: 'ID copiat', variant: 'success' })
    } catch {
      // clipboard indisponibil (ex. HTTP) — nu blocăm nimic
    }
  }

  const configOk =
    !!config && config.apiKeySet && config.phoneNumberIdSet && config.webhookSecretSet && !!config.webhookUrl

  return (
    <div className="space-y-8">
      {/* ---------- 1. Configurare ---------- */}
      <section>
        <div className="flex items-center gap-1.5 mb-4">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Configurare apeluri AI</h3>
          <button
            type="button"
            onClick={() => setShowInfo(!showInfo)}
            aria-label="Cum funcționează"
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
              Apelurile pornesc din CRM direct prin Vapi, de pe numărul Twilio. La finalul fiecărui apel, Vapi
              trimite înapoi transcriptul, rezumatul, înregistrarea și răspunsurile extrase, iar CRM-ul setează
              singur <strong>Calificarea AI</strong> pe lead. Etapa din pipeline nu se schimbă.
            </p>
            <p>
              Valorile de mai jos vin din variabilele de mediu (<code>.env.local</code> local, Settings →
              Environment Variables pe Vercel). După o schimbare pe Vercel e nevoie de un redeploy.
            </p>
            <p>
              <strong>Campanie nouă:</strong> duplici asistentul în Vapi, schimbi promptul și first message-ul,
              verifici că are atașat Structured Output-ul <code>calificare_lead</code>, apoi îi copiezi ID-ul aici.
            </p>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 sm:p-5">
          {loading ? (
            <div className="animate-pulse h-24 bg-slate-50 dark:bg-slate-800 rounded-lg" />
          ) : loadError ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">{loadError}</p>
          ) : config ? (
            <>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                <ConfigRow label="Cheie API Vapi" ok={config.apiKeySet} />
                <ConfigRow label="Număr de telefon (Vapi)" ok={config.phoneNumberIdSet} />
                <ConfigRow label="Secret webhook" ok={config.webhookSecretSet} />
                <ConfigRow label="URL webhook" ok={!!config.webhookUrl} value={config.webhookUrl ?? 'Lipsește'} />
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-start gap-2 rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2.5">
                  <Clock size={15} className="text-slate-400 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="text-slate-700 dark:text-slate-200">
                      {config.ignoreHours ? 'Interval orar ignorat' : `${daysLabel(config.days)}, ${config.hours.replace('-', ':00–')}:00`}
                    </p>
                    <p className="text-xs text-slate-400">
                      {config.ignoreHours
                        ? 'Mod de test — se poate suna oricând'
                        : config.withinHoursNow
                          ? 'Acum se poate suna'
                          : 'Acum e în afara programului'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2 rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2.5">
                  <Zap size={15} className="text-slate-400 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="text-slate-700 dark:text-slate-200">{config.maxConcurrent} apeluri simultan</p>
                    <p className="text-xs text-slate-400">Restul așteaptă în coadă</p>
                  </div>
                </div>
              </div>

              {config.ignoreHours && (
                <p className="mt-3 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                  <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                  AI_CALL_IGNORE_HOURS=true este activ. Șterge variabila înainte de a suna clienți reali.
                </p>
              )}
              {!configOk && (
                <p className="mt-3 flex items-start gap-1.5 text-xs text-red-700 dark:text-red-400">
                  <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                  Apelurile nu pot porni până nu sunt setate toate variabilele de mai sus.
                </p>
              )}
            </>
          ) : null}
        </div>
      </section>

      {/* ---------- 2. Campanii ---------- */}
      <section>
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Campanii AI</h3>
          {!form && (
            <button
              type="button"
              onClick={() => {
                setForm(EMPTY_FORM)
                setFormError(null)
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={15} /> Campanie nouă
            </button>
          )}
        </div>

        {form && (
          <form
            onSubmit={saveForm}
            className="mb-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 sm:p-5 space-y-3"
          >
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {form.id ? 'Editează campania' : 'Campanie nouă'}
            </p>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Nume campanie</label>
              <input
                className={inputClass}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="ex: Revelion Exotic - Thailanda, Vietnam, Cambodgia"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">ID asistent Vapi</label>
              <input
                className={`${inputClass} font-mono`}
                value={form.vapi_assistant_id}
                onChange={(e) => setForm({ ...form, vapi_assistant_id: e.target.value })}
                placeholder="ex: 7850fdfb-7eb6-42d2-b682-211a2909a1fc"
                required
              />
              <p className="text-xs text-slate-400">Vapi → Assistants → asistentul campaniei → ID-ul de sub nume.</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Descriere (opțional)</label>
              <textarea
                className={inputClass}
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="ex: plecare 27 decembrie, 3.704 € / persoană"
              />
            </div>
            {formError && (
              <p className="flex items-start gap-1.5 text-sm text-red-600 dark:text-red-400">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {formError}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setForm(null)}
                className="px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Renunță
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? 'Verific în Vapi…' : 'Salvează'}
              </button>
            </div>
          </form>
        )}

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-4 sm:p-5">
              <div className="animate-pulse h-16 bg-slate-50 dark:bg-slate-800 rounded-lg" />
            </div>
          ) : campaigns.length === 0 ? (
            <p className="p-4 sm:p-5 text-sm text-slate-500 dark:text-slate-400">
              Nicio campanie încă. Adaugă prima campanie cu ID-ul asistentului din Vapi.
            </p>
          ) : (
            campaigns.map((c, i) => (
              <div
                key={c.id}
                className={`px-4 py-3 ${i > 0 ? 'border-t border-slate-100 dark:border-slate-800' : ''} ${
                  c.is_active ? '' : 'opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <Bot size={14} className="text-slate-400 shrink-0" />
                      <span className="truncate">{c.name}</span>
                    </p>
                    {c.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{c.description}</p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                      <button
                        type="button"
                        onClick={() => copyId(c.vapi_assistant_id)}
                        className="inline-flex items-center gap-1 font-mono hover:text-blue-600 dark:hover:text-blue-400"
                        title="Copiază ID-ul asistentului"
                      >
                        {c.vapi_assistant_id.slice(0, 8)}… <Copy size={11} />
                      </button>
                      <span>{c.calls_count} apeluri</span>
                      <span title="Disponibil în Pasul 2">Apelare automată: oprită</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setForm({
                          id: c.id,
                          name: c.name,
                          vapi_assistant_id: c.vapi_assistant_id,
                          description: c.description || '',
                        })
                        setFormError(null)
                      }}
                      className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      aria-label="Editează"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleActive(c)}
                      disabled={togglingId === c.id}
                      className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors disabled:opacity-40 ${
                        c.is_active
                          ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {c.is_active ? 'Activă' : 'Inactivă'}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
