/**
 * src/app/api/voice/vapi-webhook/route.ts
 *
 * POST /api/voice/vapi-webhook — evenimentele trimise de Vapi pentru
 * apelurile pornite din CRM (Server URL setat per apel în lib/voice/vapi.ts).
 *
 * Autentificare: headerul `x-vapi-secret` trebuie să fie egal cu
 * VAPI_WEBHOOK_SECRET. Ruta e exclusă din auth-ul de sesiune în middleware.ts.
 *
 * Logica de procesare stă în src/lib/voice/report.ts (folosită și de
 * dispecer, la reconcilierea apelurilor fără raport de final).
 *
 * Evenimente tratate:
 *   - status-update       → actualizează starea apelului (sună / în apel)
 *   - end-of-call-report  → salvează transcript, rezumat, înregistrare, cost,
 *                           durată, datele structurate; calculează „Calificarea
 *                           AI"; scrie o activitate `ai_call` în timeline;
 *                           pornește următorul apel din coadă.
 * Orice alt tip de eveniment primește 200 și e ignorat.
 *
 * Potrivirea cu rândul din `ai_calls`: după `vapi_call_id` (salvat la
 * pornire) sau, ca rezervă, după `metadata.ai_call_id` trimis de noi.
 *
 * Leadul NU își schimbă etapa din pipeline — doar `ai_call_status`.
 *
 * APELURI PRIMITE (clientul sună înapoi la numărul Twilio): răspunde
 * asistentul setat la Inbound pe număr în Vapi, iar raportul vine prin
 * Server URL-ul NUMĂRULUI (Vapi → Phone Numbers). Nu există rând în
 * ai_calls, așa că la `end-of-call-report` îl creăm aici (direction =
 * 'inbound', migrarea 015): leadul e găsit după telefon (orice format,
 * migrarea 014) sau creat nou cu sursa „Telefon". Leadul primește prioritate
 * mare, eveniment „Clientul a sunat înapoi" în timeline și notificare
 * (agentul alocat sau, dacă e nealocat, adminii/managerii).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { dispatchQueue } from '@/lib/voice/dispatcher'
import { handleStatusUpdate, handleEndOfCallReport, type VapiMessage } from '@/lib/voice/report'

export async function POST(request: NextRequest) {
  const secret = process.env.VAPI_WEBHOOK_SECRET
  if (!secret || request.headers.get('x-vapi-secret') !== secret) {
    return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
  }

  let body: { message?: VapiMessage }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalid' }, { status: 400 })
  }

  const msg = body.message
  if (!msg?.type) return NextResponse.json({ ok: true })

  const admin = createAdminClient()

  try {
    if (msg.type === 'status-update') {
      await handleStatusUpdate(admin, msg)
      // Un apel neconectat (ocupat / respins) e finalizat la „ended" → loc liber în coadă
      if (msg.status === 'ended') await dispatchQueue(admin)
    } else if (msg.type === 'end-of-call-report') {
      await handleEndOfCallReport(admin, msg)
      // S-a eliberat un loc — pornim următorul apel din coadă
      await dispatchQueue(admin)
    }
  } catch (err) {
    console.error('[vapi-webhook]', msg.type, err)
    return NextResponse.json({ error: 'Eroare la procesare' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
