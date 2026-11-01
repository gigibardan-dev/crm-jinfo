/**
 * src/app/api/voice/campaigns/route.ts
 *
 * Campanii de apelare AI (o campanie = un asistent Vapi) — admin/manager.
 *
 *   GET  /api/voice/campaigns → { campaigns (cu nr. de apeluri), config }
 *        `config` = starea configurării de pe server (variabile de mediu,
 *        URL webhook, interval orar, apeluri simultane) — afișată în Setări,
 *        ca să se vadă imediat dacă lipsește ceva înainte de primul apel.
 *        Cheile secrete NU sunt trimise, doar dacă sunt setate sau nu.
 *
 *   POST /api/voice/campaigns { name, vapi_assistant_id, description? }
 *        ID-ul asistentului e verificat în Vapi înainte de salvare.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminOrManager } from '@/lib/voice/auth'
import { getVapiAssistant } from '@/lib/voice/vapi'
import { isWithinCallingHours } from '@/lib/voice/dispatcher'

function buildConfig() {
  return {
    apiKeySet: !!process.env.VAPI_API_KEY,
    phoneNumberIdSet: !!process.env.VAPI_PHONE_NUMBER_ID,
    webhookSecretSet: !!process.env.VAPI_WEBHOOK_SECRET,
    webhookUrl: process.env.VAPI_WEBHOOK_URL || null,
    ignoreHours: process.env.AI_CALL_IGNORE_HOURS === 'true',
    hours: process.env.AI_CALL_HOURS || '10-19',
    days: process.env.AI_CALL_DAYS || '1-6',
    maxConcurrent: parseInt(process.env.AI_CALL_MAX_CONCURRENT || '2', 10) || 2,
    withinHoursNow: isWithinCallingHours(),
  }
}

export async function GET() {
  const auth = await requireAdminOrManager()
  if (auth instanceof NextResponse) return auth

  const admin = createAdminClient()
  const { data: campaigns, error } = await admin
    .from('call_campaigns')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Număr de apeluri terminate per campanie (puține campanii → câte o interogare head)
  const withCounts = await Promise.all(
    (campaigns ?? []).map(async (c) => {
      const { count } = await admin
        .from('ai_calls')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', c.id)
        .eq('status', 'ended')
      return { ...c, calls_count: count ?? 0 }
    })
  )

  return NextResponse.json({ campaigns: withCounts, config: buildConfig() })
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminOrManager()
  if (auth instanceof NextResponse) return auth

  const body = await request.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const assistantId = typeof body.vapi_assistant_id === 'string' ? body.vapi_assistant_id.trim() : ''
  const description = typeof body.description === 'string' && body.description.trim() ? body.description.trim() : null

  if (!name) return NextResponse.json({ error: 'Numele campaniei este obligatoriu' }, { status: 400 })
  if (!assistantId) return NextResponse.json({ error: 'ID-ul asistentului Vapi este obligatoriu' }, { status: 400 })

  const check = await getVapiAssistant(assistantId)
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('call_campaigns')
    .insert({ name, vapi_assistant_id: assistantId, description, created_by: auth.userId })
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ campaign: { ...data, calls_count: 0 }, assistantName: check.name })
}
