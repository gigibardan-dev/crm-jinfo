/**
 * src/lib/utils/aiCallsReport.ts
 *
 * Agregări pure pentru Rapoarte → Apeluri AI (vezi AiCallsReport.tsx).
 * Rulează client-side pe apelurile din interval (ai_calls + leadul +
 * campania), la fel ca restul rapoartelor (src/lib/utils/reports.ts).
 *
 * Convenții:
 *  - „Apel efectuat" = apel pornit efectiv: status `ended` sau `failed`
 *    (fără cele încă în coadă / anulate).
 *  - „A răspuns" = apel încheiat al cărui rezultat NU e no_answer / invalid
 *    / failed, adică a existat o discuție.
 *  - Indicatorii „pe lead" (calificați, fierbinți, câștigați) folosesc
 *    ULTIMUL apel din interval al fiecărui lead, ca un lead sunat de două
 *    ori să nu fie numărat dublu.
 *  - Apelurile PRIMITE (direction = 'inbound', clientul a sunat înapoi —
 *    migrarea 015) NU intră în apeluri efectuate / rată de răspuns / cost per
 *    lead; apar separat („Au sunat înapoi"), în tabel și în „De sunat urgent".
 *  - „Câștigat" = leadul sunat de AI e acum în etapa `won` din pipeline
 *    (vânzarea o face agentul uman — raportul arată dacă apelul AI a dus
 *    până acolo).
 */

import type { AiCallRunStatus, AiCallStatus, Json } from '@/lib/types/database'
import { AI_CALL_STATUS_LABELS, ENDED_REASON_LABELS } from '@/lib/voice/classify'
import { fullName } from '@/lib/utils'
import { format } from 'date-fns'

export type ReportCall = {
  id: string
  created_at: string
  ended_at: string | null
  lead_id: string
  direction: 'outbound' | 'inbound'
  campaign_id: string | null
  list_id: string | null
  status: AiCallRunStatus
  result: AiCallStatus | null
  ended_reason: string | null
  duration_sec: number | null
  cost: number | null
  summary: string | null
  recording_url: string | null
  structured_data: Json | null
  call_campaigns: { name: string } | null
  leads: {
    first_name: string | null
    last_name: string | null
    phone: string | null
    status: string
    won_value: number | null
    assigned_to: string | null
    last_interaction_at: string
  } | null
}

const NOT_ANSWERED: AiCallStatus[] = ['no_answer', 'invalid', 'failed']
const QUALIFIED: AiCallStatus[] = ['hot', 'interested']
const TERMINAL_LEAD_STATUSES = ['won', 'lost', 'unqualified']

/** Apel IEȘIT efectiv pornit (ended / failed). */
export function isPlaced(c: ReportCall) {
  return c.direction !== 'inbound' && (c.status === 'ended' || c.status === 'failed')
}

/** Apel PRIMIT încheiat (clientul a sunat înapoi). */
export function isInbound(c: ReportCall) {
  return c.direction === 'inbound' && c.status === 'ended'
}

/** Rânduri afișate în tabelul „Toate apelurile" — ieșite pornite + primite încheiate. */
export function isListed(c: ReportCall) {
  return isPlaced(c) || isInbound(c)
}

export function isAnswered(c: ReportCall) {
  return c.status === 'ended' && !!c.result && !NOT_ANSWERED.includes(c.result)
}

/** Ultimul apel al fiecărui lead (după created_at). Implicit doar ieșite; `includeInbound` pt. „De sunat urgent". */
export function latestCallPerLead(calls: ReportCall[], includeInbound = false): ReportCall[] {
  const byLead = new Map<string, ReportCall>()
  for (const c of calls) {
    if (!(includeInbound ? isListed(c) : isPlaced(c))) continue
    const prev = byLead.get(c.lead_id)
    if (!prev || c.created_at > prev.created_at) byLead.set(c.lead_id, c)
  }
  return [...byLead.values()]
}

export type AiCallKPIs = {
  placed: number
  answered: number
  answerRate: number | null
  uniqueLeads: number
  qualifiedLeads: number
  qualifiedRate: number | null // din leadurile care au răspuns
  hotLeads: number
  avgDurationSec: number | null // doar apelurile cu răspuns
  totalCostUsd: number
  costPerHotUsd: number | null
  wonLeads: number
  wonValueEur: number
  callbacks: number // leaduri unice care au sunat înapoi
}

export function computeAiCallKPIs(calls: ReportCall[]): AiCallKPIs {
  const placed = calls.filter(isPlaced)
  const answered = placed.filter(isAnswered)
  const latest = latestCallPerLead(calls)
  const answeredLeads = latest.filter(isAnswered)
  const qualified = latest.filter((c) => c.result && QUALIFIED.includes(c.result))
  const hot = latest.filter((c) => c.result === 'hot')
  const won = latest.filter((c) => c.leads?.status === 'won')

  const durations = answered.map((c) => c.duration_sec).filter((d): d is number => typeof d === 'number')
  const totalCost = placed.reduce((sum, c) => sum + (Number(c.cost) || 0), 0)

  return {
    placed: placed.length,
    answered: answered.length,
    answerRate: placed.length ? answered.length / placed.length : null,
    uniqueLeads: latest.length,
    qualifiedLeads: qualified.length,
    qualifiedRate: answeredLeads.length ? qualified.length / answeredLeads.length : null,
    hotLeads: hot.length,
    avgDurationSec: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null,
    totalCostUsd: totalCost,
    costPerHotUsd: hot.length ? totalCost / hot.length : null,
    wonLeads: won.length,
    wonValueEur: won.reduce((sum, c) => sum + (Number(c.leads?.won_value) || 0), 0),
    callbacks: new Set(calls.filter(isInbound).map((c) => c.lead_id)).size,
  }
}

/** Pâlnia pe leaduri unice: sunați → au răspuns → calificați → fierbinți → câștigați. */
export function computeAiFunnel(calls: ReportCall[]) {
  const latest = latestCallPerLead(calls)
  const leadsAnswered = new Set(calls.filter(isAnswered).map((c) => c.lead_id))
  return [
    { key: 'called', label: 'Sunați', value: latest.length },
    { key: 'answered', label: 'Au răspuns', value: leadsAnswered.size },
    { key: 'qualified', label: 'Interesați + Fierbinți', value: latest.filter((c) => c.result && QUALIFIED.includes(c.result)).length },
    { key: 'hot', label: 'Fierbinți', value: latest.filter((c) => c.result === 'hot').length },
    { key: 'won', label: 'Câștigați', value: latest.filter((c) => c.leads?.status === 'won').length },
  ]
}

/** Distribuția rezultatelor pe apeluri efectuate. */
export function computeResultDistribution(calls: ReportCall[]) {
  const counts = new Map<AiCallStatus, number>()
  for (const c of calls) {
    if (!isPlaced(c) || !c.result) continue
    counts.set(c.result, (counts.get(c.result) || 0) + 1)
  }
  return [...counts.entries()]
    .map(([key, value]) => ({ key, label: AI_CALL_STATUS_LABELS[key], value }))
    .sort((a, b) => b.value - a.value)
}

/** Cum s-au încheiat apelurile (endedReason Vapi). */
export function computeEndedReasons(calls: ReportCall[]) {
  const counts = new Map<string, number>()
  for (const c of calls) {
    if (!isPlaced(c)) continue
    const key = c.ended_reason || (c.status === 'failed' ? 'failed-to-start' : 'unknown')
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  return [...counts.entries()]
    .map(([key, value]) => ({
      key,
      label: ENDED_REASON_LABELS[key] || (key === 'failed-to-start' ? 'Nu a pornit (eroare)' : key === 'unknown' ? 'Necunoscut' : key),
      value,
    }))
    .sort((a, b) => b.value - a.value)
}

export type CampaignPerf = {
  campaignId: string
  name: string
  placed: number
  answerRate: number | null
  qualified: number
  hot: number
  won: number
  wonValueEur: number
  costUsd: number
  costPerHotUsd: number | null
}

export function computeCampaignPerformance(calls: ReportCall[]): CampaignPerf[] {
  const groups = new Map<string, ReportCall[]>()
  for (const c of calls) {
    const key = c.campaign_id || 'none'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(c)
  }
  return [...groups.entries()]
    .map(([campaignId, list]) => {
      const k = computeAiCallKPIs(list)
      return {
        campaignId,
        name: list[0]?.call_campaigns?.name || 'Campanie ștearsă',
        placed: k.placed,
        answerRate: k.answerRate,
        qualified: k.qualifiedLeads,
        hot: k.hotLeads,
        won: k.wonLeads,
        wonValueEur: k.wonValueEur,
        costUsd: k.totalCostUsd,
        costPerHotUsd: k.costPerHotUsd,
      }
    })
    .filter((c) => c.placed > 0)
    .sort((a, b) => b.placed - a.placed)
}

/** Alte destinații cerute de clienți (câmpul `alta_destinatie` extras de Vapi). */
export function computeOtherDestinations(calls: ReportCall[]) {
  const counts = new Map<string, { label: string; value: number }>()
  for (const c of calls) {
    const sd = c.structured_data as Record<string, unknown> | null
    const raw = typeof sd?.alta_destinatie === 'string' ? sd.alta_destinatie.trim() : ''
    if (raw.length < 2 || ['nu', 'nimic', 'nespecificat', 'null', '-'].includes(raw.toLowerCase())) continue
    const key = raw.toLowerCase()
    const prev = counts.get(key)
    counts.set(key, { label: prev?.label || raw.charAt(0).toUpperCase() + raw.slice(1), value: (prev?.value || 0) + 1 })
  }
  return [...counts.entries()]
    .map(([key, v]) => ({ key, label: v.label, value: v.value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12)
}

export type UrgentFollowUp = {
  call: ReportCall
  hoursSinceCall: number
}

/**
 * Leaduri Fierbinte / Interesat după ULTIMUL apel AI, la care niciun agent
 * n-a făcut nimic de atunci: `last_interaction_at` (comentariu sau schimbare
 * de status — migrarea 004) e mai vechi decât finalul apelului. Exclude
 * leadurile deja închise. Cele mai vechi (cele mai „răcite") primele.
 */
export function computeUrgentFollowUps(calls: ReportCall[], now = Date.now()): UrgentFollowUp[] {
  return latestCallPerLead(calls, true)
    .filter((c) => c.result && QUALIFIED.includes(c.result))
    .filter((c) => c.leads && !TERMINAL_LEAD_STATUSES.includes(c.leads.status))
    .filter((c) => {
      const endedAt = c.ended_at || c.created_at
      return !c.leads!.last_interaction_at || c.leads!.last_interaction_at < endedAt
    })
    .map((call) => ({ call, hoursSinceCall: (now - new Date(call.ended_at || call.created_at).getTime()) / 3_600_000 }))
    .sort((a, b) => {
      // Fierbinte înaintea Interesat, apoi cele mai vechi primele
      if (a.call.result !== b.call.result) return a.call.result === 'hot' ? -1 : 1
      return b.hoursSinceCall - a.hoursSinceCall
    })
}

export function formatUsd(value: number | null): string {
  if (value === null) return '—'
  return `${value.toFixed(2)} $`
}

export function formatCallDuration(sec: number | null): string {
  if (sec === null || sec === undefined) return '—'
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return m ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`
}

function csvEscape(value: string): string {
  if (/[",\n;]/.test(value)) return '"' + value.replace(/"/g, '""') + '"'
  return value
}

export function aiCallsToCSV(calls: ReportCall[], agentNameById: Map<string, string>): string {
  const headers = ['Data', 'Direcție', 'Client', 'Telefon', 'Campanie', 'Rezultat', 'Închidere', 'Durată (s)', 'Cost ($)', 'Persoane', 'Canal', 'Altă destinație', 'Rezumat', 'Agent', 'Status lead']
  const rows = calls.filter(isListed).map((c) => {
    const sd = (c.structured_data || {}) as Record<string, unknown>
    return [
      format(new Date(c.created_at), 'dd.MM.yyyy HH:mm'),
      c.direction === 'inbound' ? 'Primit' : 'Ieșit',
      fullName(c.leads?.first_name ?? null, c.leads?.last_name ?? null),
      c.leads?.phone || '',
      c.call_campaigns?.name || '',
      c.result ? AI_CALL_STATUS_LABELS[c.result] : '',
      c.ended_reason ? ENDED_REASON_LABELS[c.ended_reason] || c.ended_reason : '',
      c.duration_sec ?? '',
      c.cost ?? '',
      sd.nr_persoane ?? '',
      sd.canal_preferat ?? '',
      sd.alta_destinatie ?? '',
      c.summary || '',
      c.leads?.assigned_to ? agentNameById.get(c.leads.assigned_to) || '' : 'Nealocat',
      c.leads?.status || '',
    ]
  })
  return [headers, ...rows].map((r) => r.map((cell) => csvEscape(String(cell))).join(';')).join('\n')
}
