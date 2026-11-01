/**
 * src/app/api/voice/campaigns/[id]/route.ts
 *
 * PATCH /api/voice/campaigns/:id — editare campanie (admin/manager):
 * name, vapi_assistant_id (re-verificat în Vapi dacă se schimbă),
 * description, is_active.
 *
 * Nu există DELETE: campaniile au istoric de apeluri legat de ele — se
 * dezactivează, nu se șterg. O campanie inactivă nu mai apare la alegerea
 * campaniei pentru apeluri noi, iar apelurile ei rămase în coadă eșuează
 * cu mesaj clar (vezi dispatcher.ts).
 *
 * `auto_call_enabled` (apelare automată, Pasul 2) e intenționat NEeditabil
 * aici până la implementarea Pasului 2.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminOrManager } from '@/lib/voice/auth'
import { getVapiAssistant } from '@/lib/voice/vapi'
import type { Database } from '@/lib/types/database'

type CampaignUpdate = Database['public']['Tables']['call_campaigns']['Update']

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminOrManager()
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const update: CampaignUpdate = {}

  if (typeof body.name === 'string') {
    if (!body.name.trim()) return NextResponse.json({ error: 'Numele nu poate fi gol' }, { status: 400 })
    update.name = body.name.trim()
  }
  if (typeof body.description === 'string') update.description = body.description.trim() || null
  if (typeof body.is_active === 'boolean') update.is_active = body.is_active

  let assistantName: string | null = null
  if (typeof body.vapi_assistant_id === 'string') {
    const assistantId = body.vapi_assistant_id.trim()
    if (!assistantId) return NextResponse.json({ error: 'ID-ul asistentului nu poate fi gol' }, { status: 400 })
    const check = await getVapiAssistant(assistantId)
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 })
    update.vapi_assistant_id = assistantId
    assistantName = check.name
  }

  if (!Object.keys(update).length) return NextResponse.json({ error: 'Nimic de actualizat' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin.from('call_campaigns').update(update).eq('id', id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ campaign: data, assistantName })
}
