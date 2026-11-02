/**
 * src/lib/voice/enqueue.ts
 *
 * Pune leaduri în coada de apeluri AI (rânduri `ai_calls` cu status
 * `queued`) — logica comună pentru:
 *   - POST /api/voice/calls  (butonul „Sună cu AI" / selecția multiplă)
 *   - POST /api/leads/import (import „Listă de apelare" cu „pune direct în coadă")
 *
 * NU pornește apelurile — apelantul cheamă apoi `dispatchQueue()`.
 *
 * Leaduri sărite (cu motiv): inexistente, „nu mai suna", fără telefon valid,
 * deja în coadă / în apel, sau sunate pe aceeași campanie în ultimele
 * RECALL_GUARD_HOURS ore (ocolibil cu `force`).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import { normalizePhoneE164 } from './phone'

type Admin = SupabaseClient<Database>

export const RECALL_GUARD_HOURS = 24
const DB_CHUNK = 200

export type EnqueueSkipped = { lead_id: string; reason: string }

export type EnqueueResult =
  | { ok: true; queued: number; skipped: EnqueueSkipped[] }
  | { ok: false; error: string; status: number }

export async function enqueueLeads(
  admin: Admin,
  params: { leadIds: string[]; campaignId: string; listId?: string | null; force?: boolean; userId: string }
): Promise<EnqueueResult> {
  const leadIds = [...new Set(params.leadIds)]
  const { campaignId, userId } = params
  const listId = params.listId ?? null

  const { data: campaign } = await admin
    .from('call_campaigns')
    .select('id, is_active')
    .eq('id', campaignId)
    .maybeSingle()
  if (!campaign) return { ok: false, error: 'Campania nu există', status: 404 }
  if (!campaign.is_active) return { ok: false, error: 'Campania este dezactivată', status: 400 }

  const skipped: EnqueueSkipped[] = []
  let queued = 0
  const since = new Date(Date.now() - RECALL_GUARD_HOURS * 3600_000).toISOString()

  // Pe loturi — `.in()` cu mii de id-uri ar depăși lungimea URL-ului
  for (let i = 0; i < leadIds.length; i += DB_CHUNK) {
    const chunk = leadIds.slice(i, i + DB_CHUNK)

    const { data: leads, error: leadsError } = await admin
      .from('leads')
      .select('id, phone, do_not_call')
      .in('id', chunk)
    if (leadsError) return { ok: false, error: leadsError.message, status: 500 }

    const { data: activeCalls } = await admin
      .from('ai_calls')
      .select('lead_id')
      .in('lead_id', chunk)
      .in('status', ['queued', 'ringing', 'in_progress'])
    const activeSet = new Set((activeCalls ?? []).map((c) => c.lead_id))

    const { data: recentCalls } = params.force
      ? { data: [] as { lead_id: string }[] }
      : await admin
          .from('ai_calls')
          .select('lead_id')
          .in('lead_id', chunk)
          .eq('campaign_id', campaignId)
          .eq('status', 'ended')
          .gte('created_at', since)
    const recentSet = new Set((recentCalls ?? []).map((c) => c.lead_id))

    const foundIds = new Set((leads ?? []).map((l) => l.id))
    for (const id of chunk) if (!foundIds.has(id)) skipped.push({ lead_id: id, reason: 'Lead inexistent' })

    const rows: Database['public']['Tables']['ai_calls']['Insert'][] = []
    for (const lead of leads ?? []) {
      const phone = normalizePhoneE164(lead.phone)
      if (lead.do_not_call) skipped.push({ lead_id: lead.id, reason: 'A cerut să nu mai fie sunat' })
      else if (!phone) skipped.push({ lead_id: lead.id, reason: 'Telefon lipsă sau invalid' })
      else if (activeSet.has(lead.id)) skipped.push({ lead_id: lead.id, reason: 'Deja în coadă sau în apel' })
      else if (recentSet.has(lead.id)) skipped.push({ lead_id: lead.id, reason: `Sunat pe această campanie în ultimele ${RECALL_GUARD_HOURS}h` })
      else rows.push({ lead_id: lead.id, campaign_id: campaignId, list_id: listId, phone_number: phone, created_by: userId })
    }

    if (rows.length) {
      const { error: insertError } = await admin.from('ai_calls').insert(rows)
      if (insertError) return { ok: false, error: insertError.message, status: 500 }
      await admin
        .from('leads')
        .update({ ai_call_status: 'queued' })
        .in('id', rows.map((r) => r.lead_id))
      queued += rows.length
    }
  }

  return { ok: true, queued, skipped }
}
