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
import { enqueueLeads } from '@/lib/voice/enqueue'
import { dispatchQueue, isWithinCallingHours } from '@/lib/voice/dispatcher'
import { getVapiConfigError } from '@/lib/voice/vapi'
import { requireAdminOrManager } from '@/lib/voice/auth'
import type { AiCallStatus } from '@/lib/types/database'

const MAX_PER_REQUEST = 200

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

  const result = await enqueueLeads(admin, { leadIds, campaignId, listId, force, userId: auth.userId })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  const dispatch = await dispatchQueue(admin)

  return NextResponse.json({
    queued: result.queued,
    skipped: result.skipped,
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
