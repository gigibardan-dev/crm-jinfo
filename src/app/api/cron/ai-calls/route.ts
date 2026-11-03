/**
 * src/app/api/cron/ai-calls/route.ts
 *
 * GET/POST /api/cron/ai-calls — „bătăile de inimă" ale cozii de apeluri AI.
 *
 * Dispecerul (lib/voice/dispatcher.ts) rulează la fiecare eveniment Vapi și
 * la fiecare acțiune din UI. Dacă însă un raport de final se pierde (ex.
 * apel ocupat / respins) și nu mai vine niciun eveniment, coada stătea pe loc.
 * Ruta asta, apelată periodic de un pinger extern (cron-job.org, același ca
 * la sincronizarea Facebook — la 2–5 minute), rulează dispecerul:
 * reconciliază apelurile agățate cu Vapi și pornește următoarele din coadă
 * (doar în intervalul orar permis).
 *
 * Autentificare: CRON_SECRET, la fel ca /api/leads/sync/facebook-sheets —
 * `Authorization: Bearer <secret>`, `x-cron-secret: <secret>` sau `?key=<secret>`.
 * Exclusă din auth-ul de sesiune în middleware.ts (prefixul /api/cron/).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { dispatchQueue } from '@/lib/voice/dispatcher'

async function handle(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'Lipsește CRON_SECRET din configurare.' }, { status: 500 })
  }
  const provided =
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    request.headers.get('x-cron-secret') ||
    request.nextUrl.searchParams.get('key')
  if (provided !== cronSecret) {
    return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
  }

  const dispatch = await dispatchQueue(createAdminClient())
  return NextResponse.json({ ok: true, ...dispatch })
}

export const GET = handle
export const POST = handle
