/**
 * src/lib/voice/dispatcher.ts
 *
 * Dispecerul cozii de apeluri AI — fără cron.
 *
 * Coada = rândurile din `ai_calls` cu status `queued` și fără `vapi_call_id`.
 * `dispatchQueue()` e apelat în două locuri:
 *   1. imediat după ce Admin/Manager adaugă leaduri în coadă (POST /api/voice/calls);
 *   2. din webhook, la fiecare `end-of-call-report` — un apel se termină,
 *      se eliberează un loc, pornește următorul.
 * Așa coada „curge" singură, câte AI_CALL_MAX_CONCURRENT apeluri deodată.
 *
 * Protecții:
 *   - interval orar (implicit luni–sâmbătă, 10:00–19:00, ora României);
 *     în afara lui apelurile rămân în coadă până la următoarea pornire
 *     manuală (în MVP nu avem cron care să le reia singur dimineața).
 *     Pentru teste în afara programului: AI_CALL_IGNORE_HOURS=true.
 *   - „claim" atomic pe rând (UPDATE ... WHERE status='queued') — același
 *     apel nu poate fi pornit de două ori, chiar dacă webhook-ul și butonul
 *     rulează dispecerul simultan.
 *   - reconciliere: apelurile rămase „agățate" (fără raport de final — tipic
 *     la ocupat / respins) sunt verificate direct în Vapi și finalizate, ca
 *     să nu blocheze locurile din coadă (vezi reconcileStaleCalls).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import { startVapiCall, getVapiCall } from './vapi'
import { handleEndOfCallReport, type VapiMessage } from './report'

type Admin = SupabaseClient<Database>


function maxConcurrent(): number {
  const n = parseInt(process.env.AI_CALL_MAX_CONCURRENT || '2', 10)
  return Number.isFinite(n) && n > 0 ? Math.min(n, 10) : 2
}

/** Interval orar permis: AI_CALL_HOURS="10-19", AI_CALL_DAYS="1-6" (1 = luni, 7 = duminică). */
export function isWithinCallingHours(now = new Date()): boolean {
  if (process.env.AI_CALL_IGNORE_HOURS === 'true') return true

  const [fromH, toH] = (process.env.AI_CALL_HOURS || '10-19').split('-').map(Number)
  const [fromD, toD] = (process.env.AI_CALL_DAYS || '1-6').split('-').map(Number)

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Bucharest',
    weekday: 'short',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(now)
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10)
  const wd = parts.find((p) => p.type === 'weekday')?.value || 'Mon'
  const day = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(wd) + 1

  return day >= fromD && day <= toD && hour >= fromH && hour < toH
}

// Praguri de reconciliere (Max duration pe asistent = 180s):
const RINGING_STALE_MIN = 3 // pornit, dar nu s-a conectat — normal se termină în < 1 min
const IN_PROGRESS_STALE_MIN = 8 // conectat — maxim 3 min + timp pentru raport
const GIVE_UP_MIN = 30 // Vapi nu mai răspunde nici el → îl marcăm eșuat

/**
 * Reconciliere: apelurile rămase „ringing" / „in_progress" peste prag (raport
 * de final pierdut sau netrimis — tipic la ocupat / respins) sunt verificate
 * direct în Vapi. Dacă Vapi spune că s-au încheiat, le procesăm exact ca pe un
 * raport de final (rezultat, timeline, lead). Altfel, după GIVE_UP_MIN, eșuat.
 * Fără asta, un singur raport lipsă ocupa permanent un loc și oprea coada.
 */
async function reconcileStaleCalls(admin: Admin) {
  const now = Date.now()
  const { data: stale } = await admin
    .from('ai_calls')
    .select('id, lead_id, status, vapi_call_id, updated_at')
    .in('status', ['ringing', 'in_progress'])
    .lt('updated_at', new Date(now - RINGING_STALE_MIN * 60_000).toISOString())
    .limit(20)

  for (const row of stale ?? []) {
    const ageMin = (now - new Date(row.updated_at).getTime()) / 60_000
    if (row.status === 'in_progress' && ageMin < IN_PROGRESS_STALE_MIN) continue

    if (row.vapi_call_id) {
      const call = await getVapiCall(row.vapi_call_id)
      if (call && call.status === 'ended') {
        const msg: VapiMessage = {
          type: 'end-of-call-report',
          endedReason: call.endedReason as string | undefined,
          startedAt: call.startedAt as string | undefined,
          endedAt: call.endedAt as string | undefined,
          cost: call.cost as number | undefined,
          summary: call.summary as string | undefined,
          analysis: call.analysis as VapiMessage['analysis'],
          artifact: call.artifact as VapiMessage['artifact'],
          call: {
            id: call.id as string,
            type: call.type as string | undefined,
            assistantId: call.assistantId as string | undefined,
            customer: call.customer as { number?: string } | undefined,
          },
        }
        await handleEndOfCallReport(admin, msg)
        continue
      }
    }

    if (ageMin >= GIVE_UP_MIN || !row.vapi_call_id) {
      await admin
        .from('ai_calls')
        .update({ status: 'failed', result: 'failed', error_message: 'Fără raport de final de la Vapi (timeout)' })
        .eq('id', row.id)
      await admin.from('leads').update({ ai_call_status: 'failed' }).eq('id', row.lead_id).eq('ai_call_status', 'in_progress')
      await admin.from('leads').update({ ai_call_status: 'failed' }).eq('id', row.lead_id).eq('ai_call_status', 'queued')
    }
  }
}

export type DispatchResult = {
  started: number
  failed: number
  remaining: number
  outsideHours: boolean
  /** Eroare internă (ex. interogare eșuată) — afișată în UI / consolă */
  error?: string
}

export async function dispatchQueue(admin: Admin): Promise<DispatchResult> {
  await reconcileStaleCalls(admin)

  const { count: remainingBefore } = await admin
    .from('ai_calls')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'queued')

  if (!isWithinCallingHours()) {
    return { started: 0, failed: 0, remaining: remainingBefore ?? 0, outsideHours: true }
  }

  const { count: active } = await admin
    .from('ai_calls')
    .select('id', { count: 'exact', head: true })
    .in('status', ['ringing', 'in_progress'])

  const slots = maxConcurrent() - (active ?? 0)
  if (slots <= 0) {
    return { started: 0, failed: 0, remaining: remainingBefore ?? 0, outsideHours: false }
  }

  // Cele mai vechi apeluri din coadă, cu asistentul campaniei
  // ATENȚIE: între ai_calls și leads există DOUĂ chei străine (ai_calls.lead_id
  // și leads.ai_last_call_id) — embed-ul trebuie să numească explicit FK-ul,
  // altfel PostgREST refuză cererea („more than one relationship") și coada
  // pare goală.
  const { data: next, error: nextError } = await admin
    .from('ai_calls')
    .select('id, lead_id, campaign_id, phone_number, call_campaigns(vapi_assistant_id, is_active), leads!ai_calls_lead_id_fkey(first_name, last_name, do_not_call)')
    .eq('status', 'queued')
    .is('vapi_call_id', null)
    .order('created_at', { ascending: true })
    .limit(slots)

  if (nextError) {
    console.error('[dispatcher] citire coadă eșuată:', nextError.message)
    return {
      started: 0,
      failed: 0,
      remaining: remainingBefore ?? 0,
      outsideHours: false,
      error: `Citirea cozii a eșuat: ${nextError.message}`,
    }
  }

  let started = 0
  let failed = 0

  for (const row of next ?? []) {
    // Claim atomic: doar cine schimbă efectiv statusul din 'queued' pornește apelul
    const { data: claimed } = await admin
      .from('ai_calls')
      .update({ status: 'ringing' })
      .eq('id', row.id)
      .eq('status', 'queued')
      .select('id')
    if (!claimed?.length) continue

    const campaign = row.call_campaigns as { vapi_assistant_id: string; is_active: boolean } | null
    const lead = row.leads as { first_name: string | null; last_name: string | null; do_not_call: boolean } | null

    let error: string | null = null
    if (!campaign?.vapi_assistant_id) error = 'Campania nu are asistent Vapi'
    else if (!campaign.is_active) error = 'Campania este dezactivată'
    else if (lead?.do_not_call) error = 'Clientul a cerut să nu mai fie sunat'

    if (!error) {
      const res = await startVapiCall({
        assistantId: campaign!.vapi_assistant_id,
        phoneNumber: row.phone_number,
        customerName: [lead?.first_name, lead?.last_name].filter(Boolean).join(' ') || null,
        metadata: { ai_call_id: row.id, lead_id: row.lead_id, campaign_id: row.campaign_id },
      })
      if (res.ok) {
        await admin.from('ai_calls').update({ vapi_call_id: res.vapiCallId }).eq('id', row.id)
        started++
        continue
      }
      error = res.error
    }

    // Pornirea a eșuat — marcăm apelul și leadul, mergem mai departe
    failed++
    await admin
      .from('ai_calls')
      .update({ status: 'failed', result: 'failed', error_message: error })
      .eq('id', row.id)
    await admin.from('leads').update({ ai_call_status: 'failed' }).eq('id', row.lead_id)
  }

  return {
    started,
    failed,
    remaining: Math.max(0, (remainingBefore ?? 0) - started - failed),
    outsideHours: false,
  }
}
