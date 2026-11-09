/**
 * src/components/leads/lead-detail/AiCallsPanel.tsx
 *
 * Panoul „Apeluri AI" din pagina leadului.
 *
 * Pentru fiecare apel AI (cel mai recent sus):
 *   - rezultatul (Calificarea AI), campania, data, durata
 *   - rezumatul + datele extrase (persoane, canal, altă destinație...)
 *   - player pentru înregistrare (prin /api/voice/recording/:id — link semnat)
 *   - conversația completă, formatată ca în Vapi (Lea / Client, cu minutul),
 *     citită din raw_report.artifact.messages; dacă lipsește, din transcript.
 *
 * Vizibilitate: agentul alocat vede tot (RLS pe ai_calls), dar butonul
 * „Sună cu AI" apare doar pentru admin/manager. Pentru un agent, panoul e
 * ascuns complet dacă leadul nu are niciun apel AI.
 *
 * Cât timp există un apel în coadă / în desfășurare, panoul se reîncarcă
 * singur la 10 secunde; la final cheamă `onCallFinished` ca pagina să
 * reîncarce leadul și timeline-ul.
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Bot, ChevronDown, Loader2, PhoneCall, User, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { formatDateTime } from '@/lib/utils'
import type { AiCallRunStatus, AiCallStatus, Json } from '@/lib/types/database'
import { AiCallStatusBadge } from '@/components/leads/AiCallStatusBadge'
import { ENDED_REASON_LABELS, type CalificareLead } from '@/lib/voice/classify'

type CallRow = {
  id: string
  created_at: string
  direction: 'outbound' | 'inbound'
  status: AiCallRunStatus
  result: AiCallStatus | null
  ended_reason: string | null
  duration_sec: number | null
  summary: string | null
  transcript: string | null
  recording_url: string | null
  structured_data: Json | null
  error_message: string | null
  call_campaigns: { name: string } | null
  messages: Json | null
}

type ChatLine = { speaker: 'bot' | 'user'; text: string; seconds: number | null }

const ACTIVE_STATUSES: AiCallRunStatus[] = ['queued', 'ringing', 'in_progress']

const RUN_STATUS_LABELS: Record<AiCallRunStatus, string> = {
  queued: 'În coadă',
  ringing: 'Sună…',
  in_progress: 'În apel',
  ended: 'Încheiat',
  failed: 'Eșuat',
  cancelled: 'Anulat',
}


const FIELD_LABELS: { key: keyof CalificareLead; label: string }[] = [
  { key: 'interesat', label: 'Interesat' },
  { key: 'vrea_rezervare', label: 'Vrea rezervare' },
  { key: 'tip_vacanta', label: 'Tip vacanță' },
  { key: 'destinatie_dorita', label: 'Destinație dorită' },
  { key: 'perioada_dorita', label: 'Perioadă dorită' },
  { key: 'nr_persoane', label: 'Persoane' },
  { key: 'canal_preferat', label: 'Canal preferat' },
  { key: 'alta_destinatie', label: 'Altă destinație' },
  { key: 'alta_perioada', label: 'Altă perioadă' },
  { key: 'resunare_cand', label: 'De resunat' },
  { key: 'nu_mai_suna', label: 'Nu mai suna' },
  { key: 'observatii', label: 'Observații' },
]

function formatDuration(sec: number | null): string {
  if (sec === null || sec === undefined) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m ? `${m} min ${s}s` : `${s}s`
}

function formatSeconds(sec: number | null): string {
  if (sec === null) return ''
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatFieldValue(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'boolean') return v ? 'Da' : 'Nu'
  return String(v)
}

/** Conversația din artifact.messages (roluri bot/user); altfel din transcript („AI: …" / „User: …"). */
function buildChat(call: CallRow): ChatLine[] {
  if (Array.isArray(call.messages)) {
    const lines: ChatLine[] = []
    for (const m of call.messages as { role?: string; message?: string; secondsFromStart?: number }[]) {
      if (!m?.message || (m.role !== 'bot' && m.role !== 'assistant' && m.role !== 'user')) continue
      lines.push({
        speaker: m.role === 'user' ? 'user' : 'bot',
        text: m.message,
        seconds: typeof m.secondsFromStart === 'number' ? m.secondsFromStart : null,
      })
    }
    if (lines.length) return lines
  }
  if (!call.transcript) return []
  return call.transcript
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const isUser = /^(user|client|customer)\s*:/i.test(l)
      return { speaker: isUser ? 'user' : 'bot', text: l.replace(/^[^:]{1,12}:\s*/, ''), seconds: null } as ChatLine
    })
}

interface AiCallsPanelProps {
  leadId: string
  canCall: boolean
  onCallFinished: () => void
}

export function AiCallsPanel({ leadId, canCall, onCallFinished }: AiCallsPanelProps) {
  const supabase = createClient()
  const { toast } = useToast()

  const [calls, setCalls] = useState<CallRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([])
  const [campaignId, setCampaignId] = useState('')
  const [starting, setStarting] = useState(false)
  const hadActive = useRef(false)

  const fetchCalls = useCallback(async () => {
    const { data } = await supabase
      .from('ai_calls')
      .select(
        'id, created_at, direction, status, result, ended_reason, duration_sec, summary, transcript, recording_url, structured_data, error_message, call_campaigns(name), messages:raw_report->artifact->messages'
      )
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(20)
    return (data ?? []) as unknown as CallRow[]
  }, [supabase, leadId])

  const applyCalls = useCallback(
    (rows: CallRow[]) => {
      setCalls(rows)
      setLoaded(true)
      const active = rows.some((c) => ACTIVE_STATUSES.includes(c.status))
      // Un apel tocmai s-a încheiat → pagina reîncarcă leadul + timeline-ul
      if (hadActive.current && !active) onCallFinished()
      hadActive.current = active
      // Primul apel se deschide automat
      if (rows[0]) setExpanded((prev) => (Object.keys(prev).length ? prev : { [rows[0].id]: true }))
    },
    [onCallFinished]
  )

  // Încărcare inițială
  useEffect(() => {
    fetchCalls().then(applyCalls)
  }, [fetchCalls, applyCalls])

  // Reîncărcare la 10s cât timp există un apel activ
  const hasActive = calls.some((c) => ACTIVE_STATUSES.includes(c.status))
  useEffect(() => {
    if (!hasActive) return
    const t = setInterval(() => fetchCalls().then(applyCalls), 10_000)
    return () => clearInterval(t)
  }, [hasActive, fetchCalls, applyCalls])

  // Campaniile active — doar pentru cine poate porni apeluri
  useEffect(() => {
    if (!canCall) return
    supabase
      .from('call_campaigns')
      .select('id, name')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setCampaigns(data ?? [])
        if (data?.[0]) setCampaignId((prev) => prev || data[0].id)
      })
  }, [canCall, supabase])

  async function startCall(force = false) {
    if (!campaignId) return
    setStarting(true)
    try {
      const res = await fetch('/api/voice/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_ids: [leadId], campaign_id: campaignId, force }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: data.error || 'Eroare la pornirea apelului', variant: 'error' })
      } else if (data.queued === 0 && data.skipped?.[0]) {
        const reason: string = data.skipped[0].reason
        if (!force && reason.startsWith('Sunat pe această campanie')) {
          if (window.confirm(`${reason}. Suni oricum?`)) {
            setStarting(false)
            return startCall(true)
          }
        } else {
          toast({ title: 'Apelul nu a pornit', description: reason, variant: 'warning' })
        }
      } else if (data.dispatch?.error) {
        toast({ title: 'Apel pus în coadă, dar coada nu a pornit', description: data.dispatch.error, variant: 'error' })
      } else if (data.outsideHours) {
        toast({ title: 'Apel pus în coadă', description: 'Suntem în afara intervalului orar — pornește când reiei coada în program.', variant: 'info' })
      } else if (data.dispatch?.failed) {
        toast({ title: 'Apelul nu a putut porni', description: 'Detaliile apar în panoul de mai jos.', variant: 'error' })
      } else {
        toast({ title: data.dispatch?.started ? 'Se sună clientul' : 'Apel pus în coadă', variant: 'success' })
      }
      applyCalls(await fetchCalls())
    } catch {
      toast({ title: 'Eroare de rețea', variant: 'error' })
    }
    setStarting(false)
  }

  // Agent fără niciun apel pe lead → nu afișăm nimic
  if (!canCall && (!loaded || calls.length === 0)) return null

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
          <Bot size={15} className="text-violet-500" /> Apeluri AI
        </h3>

        {canCall && (
          <div className="flex items-center gap-2">
            {campaigns.length > 0 ? (
              <>
                <select
                  value={campaignId}
                  onChange={(e) => setCampaignId(e.target.value)}
                  className="max-w-[14rem] px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Campanie"
                >
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => startCall()}
                  disabled={starting || hasActive}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {starting ? <Loader2 size={13} className="animate-spin" /> : <PhoneCall size={13} />}
                  Sună cu AI
                </button>
              </>
            ) : (
              <span className="text-xs text-slate-400">Nicio campanie activă (Setări → Apeluri AI)</span>
            )}
          </div>
        )}
      </div>

      {!loaded ? (
        <div className="animate-pulse h-12 bg-slate-50 dark:bg-slate-800 rounded-lg" />
      ) : calls.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Leadul nu a fost sunat încă de asistentul AI.</p>
      ) : (
        <div className="space-y-3">
          {calls.map((call) => {
            const isOpen = !!expanded[call.id]
            const isActive = ACTIVE_STATUSES.includes(call.status)
            const structured = (call.structured_data && typeof call.structured_data === 'object' && !Array.isArray(call.structured_data)
              ? call.structured_data
              : null) as CalificareLead | null
            const chat = isOpen ? buildChat(call) : []

            return (
              <div key={call.id} className="border border-slate-100 dark:border-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => ({ ...prev, [call.id]: !prev[call.id] }))}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-lg transition-colors"
                >
                  <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1">
                    {call.result ? (
                      <AiCallStatusBadge status={call.result} />
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                        {isActive && <Loader2 size={11} className="animate-spin" />}
                        {RUN_STATUS_LABELS[call.status]}
                      </span>
                    )}
                    {call.direction === 'inbound' && (
                      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">A sunat înapoi</span>
                    )}
                    <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {call.call_campaigns?.name || (call.direction === 'inbound' ? 'Apel primit' : 'Campanie ștearsă')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-xs text-slate-400">
                    <span>{formatDateTime(call.created_at)}</span>
                    <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {isOpen && (
                  <div className="px-3 pb-3 space-y-3">
                    {/* Meta */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                      <span>Durată: {formatDuration(call.duration_sec)}</span>
                      {call.ended_reason && (
                        <span>Închidere: {ENDED_REASON_LABELS[call.ended_reason] || call.ended_reason}</span>
                      )}
                    </div>

                    {call.error_message && (
                      <p className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400">
                        <AlertTriangle size={13} className="shrink-0 mt-0.5" /> {call.error_message}
                      </p>
                    )}

                    {/* Rezumat */}
                    {call.summary && (
                      <p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2">
                        {call.summary}
                      </p>
                    )}

                    {/* Date extrase */}
                    {structured && (
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                        {FIELD_LABELS.map(({ key, label }) => {
                          const value = formatFieldValue(structured[key])
                          if (!value) return null
                          return (
                            <div key={key} className="flex gap-2 min-w-0">
                              <dt className="text-slate-400 shrink-0">{label}:</dt>
                              <dd className="text-slate-800 dark:text-slate-200 break-words min-w-0">{value}</dd>
                            </div>
                          )
                        })}
                      </dl>
                    )}

                    {/* Înregistrare — prin /api/voice/recording (link semnat proaspăt de la Vapi;
                        bucketul e privat, linkul direct răspunde 400) */}
                    {call.recording_url && (
                      <audio controls preload="none" src={`/api/voice/recording/${call.id}`} className="w-full h-10">
                        Browserul nu poate reda înregistrarea.
                      </audio>
                    )}

                    {/* Conversația completă */}
                    {chat.length > 0 && (
                      <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Conversația completă</p>
                        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                          {chat.map((line, i) => (
                            <div key={i} className={`flex gap-2 ${line.speaker === 'user' ? 'flex-row-reverse' : ''}`}>
                              <div
                                className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                                  line.speaker === 'user'
                                    ? 'bg-blue-50 dark:bg-blue-950 text-blue-500'
                                    : 'bg-violet-50 dark:bg-violet-950 text-violet-500'
                                }`}
                              >
                                {line.speaker === 'user' ? <User size={12} /> : <Bot size={12} />}
                              </div>
                              <div
                                className={`max-w-[80%] rounded-lg px-3 py-1.5 text-sm ${
                                  line.speaker === 'user'
                                    ? 'bg-blue-50 dark:bg-blue-950 text-slate-800 dark:text-slate-100'
                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100'
                                }`}
                              >
                                <p className="text-[11px] text-slate-400 mb-0.5">
                                  {line.speaker === 'user' ? 'Client' : 'Lea (AI)'}
                                  {line.seconds !== null && ` · ${formatSeconds(line.seconds)}`}
                                </p>
                                <p className="whitespace-pre-wrap">{line.text}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
