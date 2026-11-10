/**
 * src/app/api/leads/bulk-reassign/route.ts
 *
 * POST /api/leads/bulk-reassign { lead_ids: string[], agent_id: string }
 *
 * Realocare în masă din Pipeline → Listă (bara „Realocă", ReassignBulkBar) —
 * DOAR admin / manager. Folosită ca să muți leadurile ținute temporar pe un
 * agent „de urmărire" către agenții reali, sau leadurile unui agent care
 * pleacă către cine îi preia.
 *
 * Aceleași reguli ca realocarea de pe un singur lead (pagina leadului):
 *   - leadurile încă „new" (nealocate) trec pe „assigned"; cele care au
 *     avansat în pipeline își PĂSTREAZĂ etapa — se schimbă doar agentul;
 *   - fiecare lead primește în timeline „Lead realocat către X" (sau
 *     „alocat", la prima alocare);
 *   - agentul primește O SINGURĂ notificare cu numărul de leaduri, nu una
 *     per lead.
 * Leadurile deja alocate agentului ales sunt sărite (nimic de schimbat).
 *
 * `agent_id = "unassigned"` → leadurile se întorc în „Nou / Nealocat" (Inbox),
 * fără agent, ca managerul să le realoace de acolo. Etapa revine la „new"
 * (Inbox-ul arată doar leadurile „new"); istoricul rămâne în timeline, cu
 * agentul și etapa de dinainte notate în activitate.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const MAX_LEADS = 1000
const CHUNK = 200

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!me || !['admin', 'manager'].includes(me.role)) {
    return NextResponse.json({ error: 'Doar admin sau manager pot realoca leaduri' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const leadIds: string[] = Array.isArray(body.lead_ids) ? [...new Set<string>(body.lead_ids)] : []
  const agentId: string | undefined = body.agent_id

  if (!agentId) return NextResponse.json({ error: 'Alege agentul' }, { status: 400 })
  const unassign = agentId === 'unassigned'
  if (!leadIds.length) return NextResponse.json({ error: 'Nu ai selectat niciun lead' }, { status: 400 })
  if (leadIds.length > MAX_LEADS) {
    return NextResponse.json({ error: `Maxim ${MAX_LEADS} leaduri odată` }, { status: 400 })
  }

  const admin = createAdminClient()

  if (unassign) return unassignLeads(admin, leadIds, user.id)

  const { data: agent } = await admin
    .from('profiles')
    .select('id, full_name, is_active')
    .eq('id', agentId)
    .maybeSingle()
  if (!agent) return NextResponse.json({ error: 'Agentul nu există' }, { status: 404 })
  if (!agent.is_active) return NextResponse.json({ error: 'Agentul este dezactivat' }, { status: 400 })

  const now = new Date().toISOString()
  let reassigned = 0
  let alreadyTheirs = 0

  for (let i = 0; i < leadIds.length; i += CHUNK) {
    const chunk = leadIds.slice(i, i + CHUNK)
    const { data: leads, error } = await admin
      .from('leads')
      .select('id, status, assigned_to')
      .in('id', chunk)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const toMove = (leads ?? []).filter((l) => l.assigned_to !== agentId)
    alreadyTheirs += (leads ?? []).length - toMove.length
    if (!toMove.length) continue

    // Prima alocare (încă „new") → „assigned"; restul își păstrează etapa
    const firstIds = toMove.filter((l) => l.status === 'new').map((l) => l.id)
    const otherIds = toMove.filter((l) => l.status !== 'new').map((l) => l.id)
    const base = { assigned_to: agentId, assigned_by: user.id, assigned_at: now }

    if (firstIds.length) {
      const { error: e1 } = await admin.from('leads').update({ ...base, status: 'assigned' }).in('id', firstIds)
      if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
    }
    if (otherIds.length) {
      const { error: e2 } = await admin.from('leads').update(base).in('id', otherIds)
      if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
    }

    await admin.from('lead_activities').insert(
      toMove.map((l) => ({
        lead_id: l.id,
        user_id: user.id,
        type: 'assignment' as const,
        content: l.status === 'new' ? `Lead alocat către ${agent.full_name}` : `Lead realocat către ${agent.full_name}`,
        metadata: { assigned_to: agentId, previous_assigned_to: l.assigned_to, bulk: true },
      }))
    )
    reassigned += toMove.length
  }

  if (reassigned > 0) {
    await admin.from('notifications').insert({
      user_id: agentId,
      type: 'lead_assigned',
      title: reassigned === 1 ? 'Ți-a fost alocat un lead' : `Ți-au fost alocate ${reassigned} leaduri`,
      body: 'Le găsești în Pipeline, filtrate pe numele tău.',
    })
  }

  return NextResponse.json({ reassigned, alreadyTheirs, agentName: agent.full_name })
}

/** Întoarce leadurile în „Nou / Nealocat" (Inbox), păstrând istoricul în timeline. */
async function unassignLeads(admin: ReturnType<typeof createAdminClient>, leadIds: string[], userId: string) {
  const { data: profiles } = await admin.from('profiles').select('id, full_name')
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]))
  const { data: stages } = await admin.from('pipeline_stages').select('slug, name')
  const stageName = new Map((stages ?? []).map((st) => [st.slug, st.name]))

  let unassigned = 0
  let alreadyUnassigned = 0

  for (let i = 0; i < leadIds.length; i += CHUNK) {
    const chunk = leadIds.slice(i, i + CHUNK)
    const { data: leads, error } = await admin.from('leads').select('id, status, assigned_to').in('id', chunk)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const toMove = (leads ?? []).filter((l) => l.assigned_to !== null || l.status !== 'new')
    alreadyUnassigned += (leads ?? []).length - toMove.length
    if (!toMove.length) continue

    const { error: e } = await admin
      .from('leads')
      .update({ assigned_to: null, assigned_by: null, assigned_at: null, status: 'new' })
      .in('id', toMove.map((l) => l.id))
    if (e) return NextResponse.json({ error: e.message }, { status: 500 })

    await admin.from('lead_activities').insert(
      toMove.map((l) => {
        const fromAgent = l.assigned_to ? nameById.get(l.assigned_to) || 'agent șters' : null
        const fromStage = l.status !== 'new' ? stageName.get(l.status) || l.status : null
        const detail = [fromAgent ? `era alocat lui ${fromAgent}` : null, fromStage ? `etapa „${fromStage}”` : null]
          .filter(Boolean)
          .join(', ')
        return {
          lead_id: l.id,
          user_id: userId,
          type: 'assignment' as const,
          content: `Lead întors în Nou / Nealocat (Inbox)${detail ? ` — ${detail}` : ''}`,
          metadata: { assigned_to: null, previous_assigned_to: l.assigned_to, previous_status: l.status, bulk: true },
        }
      })
    )
    unassigned += toMove.length
  }

  return NextResponse.json({ reassigned: unassigned, alreadyTheirs: alreadyUnassigned, agentName: 'Nou / Nealocat', unassigned: true })
}
