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
 *   - apelurile rămase „agățate" (fără raport de final > 15 min, ex. webhook
 *     pierdut) sunt marcate `failed`, ca să nu blocheze locurile din coadă.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import { startVapiCall } from './vapi'

type Admin = SupabaseClient<Database>

const STALE_MINUTES = 15

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

/** Marchează ca eșuate apelurile pornite care n-au primit raport de final de prea mult timp. */
async function releaseStaleCalls(admin: Admin) {
  const cutoff = new Date(Date.now() - STALE_MINUTES * 60_000).toISOString()
  await admin
    .from('ai_calls')
    .update({ status: 'failed', result: 'failed', error_message: 'Fără raport de final de la Vapi (timeout)' })
    .in('status', ['ringing', 'in_progress'])
    .lt('updated_at', cutoff)
}

export type DispatchResult = {
  started: number
  failed: number
  remaining: number
  outsideHours: boolean
}

export async function dispatchQueue(admin: Admin): Promise<DispatchResult> {
  await releaseStaleCalls(admin)

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
  const { data: next } = await admin
    .from('ai_calls')
    .select('id, lead_id, campaign_id, phone_number, call_campaigns(vapi_assistant_id, is_active), leads(first_name, last_name, do_not_call)')
    .eq('status', 'queued')
    .is('vapi_call_id', null)
    .order('created_at', { ascending: true })
    .limit(slots)

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
