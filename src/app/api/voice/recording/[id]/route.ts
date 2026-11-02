/**
 * src/app/api/voice/recording/[id]/route.ts
 *
 * GET /api/voice/recording/:aiCallId — redă înregistrarea unui apel AI.
 *
 * De ce nu folosim direct `ai_calls.recording_url`: contul Vapi stochează
 * înregistrările într-un bucket privat (`hipaa-recordings` pe Cloudflare R2).
 * Linkul simplu răspunde 400 fără semnătură, iar linkurile semnate
 * (`presignedMonoUrl` etc.) din raportul de final EXPIRĂ după un timp.
 *
 * Așa că, la fiecare redare:
 *   1. verificăm că utilizatorul logat are voie să vadă apelul — citirea se
 *      face cu clientul de sesiune, deci RLS-ul pe ai_calls decide
 *      (admin/manager: toate; agent: doar leadurile lui);
 *   2. cerem apelul proaspăt de la Vapi (GET /call/:id), care întoarce
 *      linkuri semnate noi;
 *   3. redirecționăm player-ul (302) către linkul semnat.
 * Rezervă: dacă Vapi nu răspunde, încercăm linkurile semnate din raportul
 * salvat (merg cât timp nu au expirat), apoi linkul simplu.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type ArtifactLike = {
  presignedMonoUrl?: string
  presignedStereoUrl?: string
  recordingUrl?: string
  recording?: { mono?: { combinedUrl?: string }; stereoUrl?: string }
}

function pickUrl(a: ArtifactLike | null | undefined): string | null {
  if (!a) return null
  return a.presignedMonoUrl || a.presignedStereoUrl || null
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

  // RLS: agentul primește rândul doar dacă leadul îi e alocat
  const { data: call } = await supabase
    .from('ai_calls')
    .select('vapi_call_id, recording_url, raw_report')
    .eq('id', id)
    .maybeSingle()
  if (!call) return NextResponse.json({ error: 'Apel inexistent sau fără acces' }, { status: 404 })

  // 1. Link semnat proaspăt de la Vapi
  if (call.vapi_call_id && process.env.VAPI_API_KEY) {
    try {
      const res = await fetch(`https://api.vapi.ai/call/${encodeURIComponent(call.vapi_call_id)}`, {
        headers: { Authorization: `Bearer ${process.env.VAPI_API_KEY}` },
        cache: 'no-store',
      })
      if (res.ok) {
        const fresh = (await res.json()) as { artifact?: ArtifactLike }
        const url = pickUrl(fresh.artifact)
        if (url) return NextResponse.redirect(url, 302)
      }
    } catch {
      // continuăm cu rezervele de mai jos
    }
  }

  // 2. Link semnat din raportul salvat (poate fi expirat)
  const report = call.raw_report as { artifact?: ArtifactLike } | null
  const saved = pickUrl(report?.artifact)
  if (saved) return NextResponse.redirect(saved, 302)

  // 3. Linkul simplu (merge doar dacă bucketul e public)
  if (call.recording_url) return NextResponse.redirect(call.recording_url, 302)

  return NextResponse.json({ error: 'Apelul nu are înregistrare' }, { status: 404 })
}
