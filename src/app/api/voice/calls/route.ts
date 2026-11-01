/**
 * src/app/api/voice/calls/route.ts
 *
 * Coada de apeluri AI — DOAR Admin și Manager (agenții nu pornesc apeluri).
 *
 *   POST   /api/voice/calls  { lead_ids: string[], campaign_id: string, list_id?: string, force?: boolean }
 *          Adaugă leadurile în coadă și pornește imediat primele apeluri
 *          (până la AI_CALL_MAX_CONCURRENT). Restul pornesc singure, pe măsură
 *          ce se termină apelurile (vezi lib/voice/dispatcher.ts).
 *          Leadurile sărite sunt raportate cu motiv: fără telefon valid,
 *          „nu mai suna", deja în coadă / în apel, sau deja sunat pe aceeași
 *          campanie în ultimele 24h (ocolibil cu force: true).
 *
 *   GET    /api/voice/calls  → starea cozii (câte în coadă / în apel)
 *          + reia dispecerul (util după ce coada a stat în afara programului).
 *
 *   DELETE /api/voice/calls  → oprește coada: anulează apelurile încă
 *          nepornite. Apelurile deja în desfășurare continuă normal.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizePhoneE164 } from '@/lib/voice/phone'
import { dispatchQueue, isWithinCallingHours } from '@/lib/voice/dispatcher'
import { getVapiConfigError } from '@/lib/voice/vapi'
import { requireAdminOrManager } from '@/lib/voice/auth'
import type { AiCallStatus } from '@/lib/types/database'

const MAX_PER_REQUEST = 200
const RECALL_GUARD_HOURS = 24

type Skipped = { lead_id: string; reason: string }

export async function POST(request: NextRequest) {
  const auth = await requireAdminOrManager()
  if (auth instanceof NextResponse) return auth

  const configError = getVapiConfigError()
  if (configError) return NextResponse.json({ error: configError }, { status: 500 })

  const body = await request.json().catch(() => ({}))
  const leadIds: string[] = Array.isArray(body.lead_ids) ? [...new Set<string>(body.lead_ids)] : []
  const campaignId: string | undefined = body.campaign_id
  const listId: string | null = body.list_id || null
  const force = body.force === true

  if (!campaignId) return NextResponse.json({ error: 'Alege o campanie' }, { status: 400 })
  if (!leadIds.length) return NextResponse.json({ error: 'Nu ai selectat niciun lead' }, { status: 400 })
  if (leadIds.length > MAX_PER_REQUEST) {
    return NextResponse.json({ error: `Maxim ${MAX_PER_REQUEST} leaduri odată` }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: campaign } = await admin
    .from('call_campaigns')
    .select('id, is_active')
    .eq('id', campaignId)
    .single()
  if (!campaign) return NextResponse.json({ error: 'Campania nu există' }, { status: 404 })
  if (!campaign.is_active) return NextResponse.json({ error: 'Campania este dezactivată' }, { status: 400 })

  const { data: leads, error: leadsError } = await admin
    .from('leads')
    .select('id, phone, do_not_call')
    .in('id', leadIds)
  if (leadsError) return NextResponse.json({ error: leadsError.message }, { status: 500 })

  // Apeluri active (în coadă / în desfășurare) pentru oricare din leaduri
  const { data: activeCalls } = await admin
    .from('ai_calls')
    .select('lead_id')
    .in('lead_id', leadIds)
    .in('status', ['queued', 'ringing', 'in_progress'])
  const activeSet = new Set((activeCalls ?? []).map((c) => c.lead_id))

  // Sunate recent pe aceeași campanie
  const since = new Date(Date.now() - RECALL_GUARD_HOURS * 3600_000).toISOString()
  const { data: recentCalls } = force
    ? { data: [] as { lead_id: string }[] }
    : await admin
        .from('ai_calls')
        .select('lead_id')
        .in('lead_id', leadIds)
        .eq('campaign_id', campaignId)
        .eq('status', 'ended')
        .gte('created_at', since)
  const recentSet = new Set((recentCalls ?? []).map((c) => c.lead_id))

  const skipped: Skipped[] = []
  const rows: { lead_id: string; campaign_id: string; list_id: string | null; phone_number: string; created_by: string }[] = []

  const foundIds = new Set((leads ?? []).map((l) => l.id))
  for (const id of leadIds) if (!foundIds.has(id)) skipped.push({ lead_id: id, reason: 'Lead inexistent' })

  for (const lead of leads ?? []) {
    const phone = normalizePhoneE164(lead.phone)
    if (lead.do_not_call) skipped.push({ lead_id: lead.id, reason: 'A cerut să nu mai fie sunat' })
    else if (!phone) skipped.push({ lead_id: lead.id, reason: 'Telefon lipsă sau invalid' })
    else if (activeSet.has(lead.id)) skipped.push({ lead_id: lead.id, reason: 'Deja în coadă sau în apel' })
    else if (recentSet.has(lead.id)) skipped.push({ lead_id: lead.id, reason: `Sunat pe această campanie în ultimele ${RECALL_GUARD_HOURS}h` })
    else rows.push({ lead_id: lead.id, campaign_id: campaignId, list_id: listId, phone_number: phone, created_by: auth.userId })
  }

  if (rows.length) {
    const { error: insertError } = await admin.from('ai_calls').insert(rows)
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
    await admin
      .from('leads')
      .update({ ai_call_status: 'queued' })
      .in('id', rows.map((r) => r.lead_id))
  }

  const dispatch = await dispatchQueue(admin)

  return NextResponse.json({
    queued: rows.length,
    skipped,
    dispatch,
    outsideHours: !isWithinCallingHours(),
  })
}

export async function GET() {
  const auth = await requireAdminOrManager()
  if (auth instanceof NextResponse) return auth

  const admin = createAdminClient()
  const dispatch = await dispatchQueue(admin)

  const { count: inProgress } = await admin
    .from('ai_calls')
    .select('id', { count: 'exact', head: true })
    .in('status', ['ringing', 'in_progress'])

  return NextResponse.json({
    queued: dispatch.remaining,
    inProgress: inProgress ?? 0,
    outsideHours: dispatch.outsideHours,
  })
}

export async function DELETE() {
  const auth = await requireAdminOrManager()
  if (auth instanceof NextResponse) return auth

  const admin = createAdminClient()

  const { data: cancelled, error } = await admin
    .from('ai_calls')
    .update({ status: 'cancelled', error_message: 'Anulat manual din coadă' })
    .eq('status', 'queued')
    .is('vapi_call_id', null)
    .select('lead_id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Leadurile anulate revin la calificarea dinainte (rezultatul ultimului apel, sau neapelat)
  const leadIds = [...new Set((cancelled ?? []).map((c) => c.lead_id))]
  if (leadIds.length) {
    const { data: leads } = await admin.from('leads').select('id, ai_last_call_id').in('id', leadIds)
    const lastIds = (leads ?? []).map((l) => l.ai_last_call_id).filter(Boolean) as string[]
    const { data: lastCalls } = lastIds.length
      ? await admin.from('ai_calls').select('id, result').in('id', lastIds)
      : { data: [] as { id: string; result: AiCallStatus | null }[] }
    const resultById = new Map((lastCalls ?? []).map((c) => [c.id, c.result]))

    for (const lead of leads ?? []) {
      const previous = lead.ai_last_call_id ? resultById.get(lead.ai_last_call_id) ?? null : null
      await admin
        .from('leads')
        .update({ ai_call_status: previous })
        .eq('id', lead.id)
    }
  }

  return NextResponse.json({ cancelled: cancelled?.length ?? 0 })
}
