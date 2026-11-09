/**
 * src/lib/voice/classify.ts
 *
 * „Calificare AI" — transformă rezultatul unui apel Vapi într-una din
 * valorile `AiCallStatus` (leads.ai_call_status / ai_calls.result).
 *
 * Regula de bază: dacă CLIENTUL n-a spus (aproape) nimic, apelul NU poate fi
 * „Interesat" — e „A închis repede" sau „Nu răspunde", indiferent ce a
 * completat LLM-ul în datele structurate. „Interesat" cere un „da" explicit;
 * un răspuns vag devine „Neclar" (de ascultat de un om).
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
  hung_up: 'A închis repede',
  unclear: 'Neclar',
  invalid: 'Număr invalid',
  failed: 'Eroare',
}

/** Motivul închiderii apelului (Vapi `endedReason`) în română — panoul de apel + raport. */
export const ENDED_REASON_LABELS: Record<string, string> = {
  'customer-ended-call': 'Clientul a închis',
  'assistant-ended-call': 'Asistentul a închis',
  'customer-did-not-answer': 'Nu a răspuns',
  'customer-busy': 'Ocupat',
  voicemail: 'Căsuță vocală',
  'silence-timed-out': 'Închis după tăcere',
  'exceeded-max-duration': 'Durata maximă depășită',
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
  // Campanii generale (ex. „Reduceri 2027 – clienți fideli"): clientul spune
  // ce vacanță vrea — destinația dorită e SCOPUL apelului, nu o „altă cerere"
  tip_vacanta?: string | null
  destinatie_dorita?: string | null
  perioada_dorita?: string | null
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

/** Cât a vorbit clientul efectiv în apel (din conversația Vapi). */
export type CustomerSpeech = { turns: number; words: number }

/**
 * Numără replicile și cuvintele CLIENTULUI din conversație: întâi din
 * artifact.messages (rol `user`), altfel din transcript (rânduri „User:" /
 * „Customer:"). Folosit ca să nu calificăm un apel în care clientul n-a spus
 * nimic — Structured Output-ul e completat de un LLM și poate „ghici" valori
 * chiar dacă discuția n-a avut loc.
 */
export function countCustomerSpeech(
  messages: { role?: string; message?: string }[] | undefined | null,
  transcript: string | null | undefined
): CustomerSpeech {
  let turns = 0
  let words = 0
  const add = (text: string) => {
    const w = text.trim().split(/\s+/).filter((x) => /[\p{L}\p{N}]/u.test(x)).length
    if (w > 0) {
      turns++
      words += w
    }
  }
  if (Array.isArray(messages) && messages.length) {
    for (const m of messages) if (m?.role === 'user' && typeof m.message === 'string') add(m.message)
    return { turns, words }
  }
  for (const line of (transcript || '').split('\n')) {
    const match = line.match(/^\s*(user|customer|client)\s*:\s*(.*)$/i)
    if (match) add(match[2])
  }
  return { turns, words }
}

/** Sub atâtea cuvinte spuse de client, discuția nu e considerată reală. */
const MIN_CUSTOMER_WORDS = 3

export function classifyCall(params: {
  structured: CalificareLead | null
  endedReason: string | null
  durationSec: number | null
  /** null = nu știm (raport fără conversație) — se folosește doar durata */
  speech: CustomerSpeech | null
}): { status: AiCallStatus; doNotCall: boolean } {
  const s = params.structured
  const reason = (params.endedReason || '').toLowerCase()
  const customerEnded = reason.includes('customer-ended')

  // 1. „Nu mă mai sunați" bate orice altceva
  if (s && isYes(s.nu_mai_suna)) return { status: 'not_interested', doNotCall: true }

  // 2. Probleme de linie / număr — nu s-a purtat nicio discuție
  if (INVALID_REASONS.some((r) => reason.includes(r))) return { status: 'invalid', doNotCall: false }
  if (NO_ANSWER_REASONS.some((r) => reason.includes(r))) return { status: 'no_answer', doNotCall: false }

  // 3. Erori tehnice
  if (reason.includes('error') || reason.includes('failed')) return { status: 'failed', doNotCall: false }

  // 4. Clientul n-a vorbit (aproape) deloc → nu ne bazăm pe datele extrase
  const words = params.speech ? params.speech.words : null
  const barelySpoke = words !== null ? words < MIN_CUSTOMER_WORDS : (params.durationSec ?? 0) < 15
  if (barelySpoke) {
    // Un „nu" scurt, explicit, rămâne refuz; altfel: a răspuns și a închis repede
    // vs. n-a fost nimeni la telefon
    if (words && s && isNo(s.interesat)) return { status: 'not_interested', doNotCall: false }
    return { status: words || customerEnded || (params.durationSec ?? 0) >= 5 ? 'hung_up' : 'no_answer', doNotCall: false }
  }

  // 5. A existat o discuție — calificăm după datele extrase
  if (s) {
    const persons = toNumber(s.nr_persoane)
    if (isYes(s.vrea_rezervare) || (isYes(s.interesat) && persons !== null && persons > 0)) {
      return { status: 'hot', doNotCall: false }
    }
    // Campanie generală: destinație dorită + (persoane sau perioadă) = gata de ofertă
    const wantsDestination = hasText(s.destinatie_dorita) || hasText(s.tip_vacanta)
    if (wantsDestination && !isNo(s.interesat)) {
      if (hasText(s.destinatie_dorita) && (persons !== null && persons > 0 || hasText(s.perioada_dorita))) {
        return { status: 'hot', doNotCall: false }
      }
      return { status: 'interested', doNotCall: false }
    }
    if (hasText(s.alta_destinatie) || hasText(s.alta_perioada)) return { status: 'other_request', doNotCall: false }
    if (hasText(s.resunare_cand)) return { status: 'callback', doNotCall: false }
    if (isYes(s.interesat)) return { status: 'interested', doNotCall: false }
    if (isNo(s.interesat)) return { status: 'not_interested', doNotCall: false }
  }

  // 6. A vorbit, dar fără un răspuns clar („nesigur" sau fără date) → om de verificat
  return { status: 'unclear', doNotCall: false }
}
