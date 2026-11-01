/**
 * src/lib/voice/classify.ts
 *
 * „Calificare AI" — transformă rezultatul unui apel Vapi într-una din
 * valorile `AiCallStatus` (leads.ai_call_status / ai_calls.result).
 *
 * Sursele, în ordinea priorității:
 *   1. Datele structurate extrase de Vapi (Structured Output `calificare_lead`,
 *      schema din claude/vapi-asistenti-prompturi.md): interesat, vrea_rezervare,
 *      nr_persoane, canal_preferat, alta_destinatie, alta_perioada,
 *      resunare_cand, nu_mai_suna, observatii.
 *   2. `endedReason` de la Vapi — pentru apelurile la care nu s-a vorbit
 *      (nu răspunde, ocupat, căsuță vocală, număr invalid, erori).
 *
 * Etichetele în română sunt aici ca să fie folosite identic în tot UI-ul.
 */

import type { AiCallStatus } from '@/lib/types/database'

export const AI_CALL_STATUS_LABELS: Record<AiCallStatus, string> = {
  queued: 'În coadă',
  in_progress: 'În apel',
  hot: 'Fierbinte',
  interested: 'Interesat',
  other_request: 'Altă cerere',
  callback: 'De resunat',
  not_interested: 'Neinteresat',
  no_answer: 'Nu răspunde',
  invalid: 'Număr invalid',
  failed: 'Eroare',
}

/** Forma (tolerantă) a datelor structurate — LLM-ul poate întoarce variații. */
export type CalificareLead = {
  interesat?: string | boolean | null
  vrea_rezervare?: boolean | string | null
  nr_persoane?: number | string | null
  canal_preferat?: string | null
  alta_destinatie?: string | null
  alta_perioada?: string | null
  resunare_cand?: string | null
  nu_mai_suna?: boolean | string | null
  observatii?: string | null
}

function isYes(v: unknown): boolean {
  if (v === true) return true
  if (typeof v === 'string') return ['da', 'yes', 'true'].includes(v.trim().toLowerCase())
  return false
}

function isNo(v: unknown): boolean {
  if (v === false) return true
  if (typeof v === 'string') return ['nu', 'no', 'false'].includes(v.trim().toLowerCase())
  return false
}

/** Text completat cu ceva real (nu "", "nu", "-", "nespecificat", "null"). */
function hasText(v: unknown): boolean {
  if (typeof v !== 'string') return false
  const t = v.trim().toLowerCase()
  return t.length > 1 && !['nu', 'nimic', 'nespecificat', 'null', 'n/a', 'none', '-'].includes(t)
}

function toNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = parseInt(v, 10)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/** endedReason-uri Vapi = clientul nu a fost efectiv în apel. */
// („silence-timed-out" NU e aici — poate apărea și după o discuție reală;
// acolo decid datele structurate / durata, mai jos.)
const NO_ANSWER_REASONS = ['did-not-answer', 'customer-busy', 'voicemail', 'no-answer']
const INVALID_REASONS = ['invalid', 'not-found', 'unallocated', 'number-not-in-service']

export function classifyCall(params: {
  structured: CalificareLead | null
  endedReason: string | null
  durationSec: number | null
}): { status: AiCallStatus; doNotCall: boolean } {
  const s = params.structured
  const reason = (params.endedReason || '').toLowerCase()

  // 1. „Nu mă mai sunați" bate orice altceva
  if (s && isYes(s.nu_mai_suna)) return { status: 'not_interested', doNotCall: true }

  // 2. Probleme de linie / număr — nu s-a purtat nicio discuție
  if (INVALID_REASONS.some((r) => reason.includes(r))) return { status: 'invalid', doNotCall: false }
  if (NO_ANSWER_REASONS.some((r) => reason.includes(r))) return { status: 'no_answer', doNotCall: false }

  // 3. Avem date structurate — calificăm după conținutul discuției
  if (s) {
    const persons = toNumber(s.nr_persoane)
    if (isYes(s.vrea_rezervare) || (isYes(s.interesat) && persons !== null && persons > 0)) {
      return { status: 'hot', doNotCall: false }
    }
    if (hasText(s.alta_destinatie) || hasText(s.alta_perioada)) return { status: 'other_request', doNotCall: false }
    if (hasText(s.resunare_cand)) return { status: 'callback', doNotCall: false }
    if (isYes(s.interesat)) return { status: 'interested', doNotCall: false }
    if (isNo(s.interesat)) return { status: 'not_interested', doNotCall: false }
    // "nesigur" → îl lăsăm „Interesat", ca un agent să citească discuția
    if (typeof s.interesat === 'string' && s.interesat.trim()) return { status: 'interested', doNotCall: false }
  }

  // 4. Erori tehnice
  if (reason.includes('error') || reason.includes('failed')) return { status: 'failed', doNotCall: false }

  // 5. Apel foarte scurt fără date = practic n-a vorbit nimeni
  if ((params.durationSec ?? 0) < 15) return { status: 'no_answer', doNotCall: false }

  // 6. A existat o discuție, dar fără date clare → om de verificat
  return { status: 'interested', doNotCall: false }
}
