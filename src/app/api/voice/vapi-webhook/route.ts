/**
 * src/app/api/voice/vapi-webhook/route.ts
 *
 * POST /api/voice/vapi-webhook — evenimentele trimise de Vapi pentru
 * apelurile pornite din CRM (Server URL setat per apel în lib/voice/vapi.ts).
 *
 * Autentificare: headerul `x-vapi-secret` trebuie să fie egal cu
 * VAPI_WEBHOOK_SECRET. Ruta e exclusă din auth-ul de sesiune în middleware.ts.
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
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/lib/types/database'
import { classifyCall, AI_CALL_STATUS_LABELS, type CalificareLead } from '@/lib/voice/classify'
import { dispatchQueue } from '@/lib/voice/dispatcher'

// Forma relevantă (parțială) a mesajelor Vapi — câmpurile pot lipsi, citim defensiv
type VapiMessage = {
  type?: string
  status?: string
  endedReason?: string
  call?: {
    id?: string
    assistantOverrides?: { metadata?: { ai_call_id?: string } }
    metadata?: { ai_call_id?: string }
  }
  startedAt?: string
  endedAt?: string
  durationSeconds?: number
  cost?: number
  summary?: string
  transcript?: string
  recordingUrl?: string
  analysis?: { summary?: string; structuredData?: Record<string, unknown> }
  artifact?: {
    transcript?: string
    recordingUrl?: string
    recording?: { mono?: { combinedUrl?: string }; stereoUrl?: string }
    structuredOutputs?: Record<string, { name?: string; result?: unknown }>
  }
}

type Admin = ReturnType<typeof createAdminClient>

// Numele Structured Outputs din Vapi (atașate fiecărui asistent de campanie):
//   calificare_lead — obiect cu răspunsurile clientului (schema din classify.ts)
//   rezumat_apel    — text, rezumatul apelului în română (alternativă la
//                     Analysis → Summary din asistent)
const STRUCTURED_OUTPUT_NAME = 'calificare_lead'
const SUMMARY_OUTPUT_NAME = 'rezumat_apel'

/** Găsește rândul ai_calls corespunzător mesajului. */
async function findAiCall(admin: Admin, msg: VapiMessage) {
  const vapiId = msg.call?.id
  if (vapiId) {
    const { data } = await admin
      .from('ai_calls')
      .select('id, lead_id, campaign_id, status, created_by')
      .eq('vapi_call_id', vapiId)
      .maybeSingle()
    if (data) return data
  }
  const metaId = msg.call?.assistantOverrides?.metadata?.ai_call_id || msg.call?.metadata?.ai_call_id
  if (metaId) {
    const { data } = await admin
      .from('ai_calls')
      .select('id, lead_id, campaign_id, status, created_by')
      .eq('id', metaId)
      .maybeSingle()
    if (data) {
      // Raportul a ajuns înainte să salvăm vapi_call_id — îl completăm acum
      if (vapiId) await admin.from('ai_calls').update({ vapi_call_id: vapiId }).eq('id', data.id)
      return data
    }
  }
  return null
}

/** Datele structurate: întâi Structured Outputs (nou), apoi analysis.structuredData (vechi). */
function extractStructured(msg: VapiMessage): CalificareLead | null {
  const outputs = msg.artifact?.structuredOutputs
  if (outputs && typeof outputs === 'object') {
    const entries = Object.values(outputs)
    const match =
      entries.find((o) => o?.name === STRUCTURED_OUTPUT_NAME) ??
      entries.find((o) => o?.result && typeof o.result === 'object')
    if (match?.result && typeof match.result === 'object') return match.result as CalificareLead
  }
  const legacy = msg.analysis?.structuredData
  if (legacy && typeof legacy === 'object' && Object.keys(legacy).length) return legacy as CalificareLead
  return null
}

/** Rezumatul: Analysis → Summary, apoi Structured Output text `rezumat_apel`. */
function extractSummary(msg: VapiMessage): string | null {
  const fromAnalysis = msg.analysis?.summary || msg.summary
  if (fromAnalysis && fromAnalysis.trim()) return fromAnalysis.trim()
  const outputs = msg.artifact?.structuredOutputs
  if (outputs && typeof outputs === 'object') {
    const match = Object.values(outputs).find((o) => o?.name === SUMMARY_OUTPUT_NAME)
    if (typeof match?.result === 'string' && match.result.trim()) return match.result.trim()
  }
  return null
}

/** Text scurt, lizibil, pentru timeline. */
function buildTimelineText(label: string, summary: string | null, s: CalificareLead | null): string {
  const lines = [`Apel AI — ${label}`]
  if (summary) lines.push(summary)
  if (!summary && !s) lines.push('Fără rezumat și fără date extrase de Vapi — verifică transcriptul și înregistrarea.')
  if (s) {
    const details: string[] = []
    if (s.nr_persoane) details.push(`Persoane: ${s.nr_persoane}`)
    if (s.canal_preferat && s.canal_preferat !== 'nespecificat') details.push(`Canal preferat: ${s.canal_preferat}`)
    if (s.alta_destinatie) details.push(`Altă destinație: ${s.alta_destinatie}`)
    if (s.alta_perioada) details.push(`Altă perioadă: ${s.alta_perioada}`)
    if (s.resunare_cand) details.push(`De resunat: ${s.resunare_cand}`)
    if (s.observatii) details.push(`Observații: ${s.observatii}`)
    if (details.length) lines.push(details.join(' · '))
  }
  return lines.join('\n')
}

async function handleStatusUpdate(admin: Admin, msg: VapiMessage) {
  const row = await findAiCall(admin, msg)
  if (!row) return

  if (msg.status === 'in-progress') {
    await admin
      .from('ai_calls')
      .update({ status: 'in_progress', started_at: new Date().toISOString() })
      .eq('id', row.id)
      .in('status', ['queued', 'ringing'])
    await admin.from('leads').update({ ai_call_status: 'in_progress' }).eq('id', row.lead_id)
  } else if (msg.status === 'ringing') {
    await admin.from('ai_calls').update({ status: 'ringing' }).eq('id', row.id).eq('status', 'queued')
  }
  // 'ended' e tratat complet de end-of-call-report
}

async function handleEndOfCallReport(admin: Admin, msg: VapiMessage) {
  const row = await findAiCall(admin, msg)
  if (!row) return

  const structured = extractStructured(msg)
  const summary = extractSummary(msg)
  const transcript = msg.artifact?.transcript || msg.transcript || null
  const recordingUrl =
    msg.artifact?.recordingUrl ||
    msg.recordingUrl ||
    msg.artifact?.recording?.mono?.combinedUrl ||
    msg.artifact?.recording?.stereoUrl ||
    null

  let durationSec = typeof msg.durationSeconds === 'number' ? Math.round(msg.durationSeconds) : null
  if (durationSec === null && msg.startedAt && msg.endedAt) {
    durationSec = Math.round((Date.parse(msg.endedAt) - Date.parse(msg.startedAt)) / 1000)
  }

  const endedReason = msg.endedReason || null
  const { status: result, doNotCall } = classifyCall({ structured, endedReason, durationSec })

  // Raportul brut, pentru audit/debug — fără `messagesOpenAIFormatted`
  // (aceeași conversație a doua oară, doar în alt format)
  const raw = JSON.parse(JSON.stringify(msg)) as Record<string, unknown>
  const rawArtifact = raw.artifact as Record<string, unknown> | undefined
  if (rawArtifact) delete rawArtifact.messagesOpenAIFormatted

  await admin
    .from('ai_calls')
    .update({
      status: 'ended',
      result,
      ended_reason: endedReason,
      started_at: msg.startedAt || null,
      ended_at: msg.endedAt || new Date().toISOString(),
      duration_sec: durationSec,
      cost: typeof msg.cost === 'number' ? msg.cost : null,
      summary,
      transcript,
      recording_url: recordingUrl,
      structured_data: (structured as Json) ?? null,
      raw_report: raw as Json,
    })
    .eq('id', row.id)

  // Lead: calificarea AI + contor + do_not_call (etapa din pipeline rămâne neatinsă)
  const { data: lead } = await admin.from('leads').select('ai_call_count').eq('id', row.lead_id).single()
  await admin
    .from('leads')
    .update({
      ai_call_status: result,
      ai_call_count: (lead?.ai_call_count ?? 0) + 1,
      ai_last_call_at: new Date().toISOString(),
      ai_last_call_id: row.id,
      ...(doNotCall ? { do_not_call: true } : {}),
    })
    .eq('id', row.lead_id)

  // Eveniment în timeline — vizibil și agentului alocat
  const label = AI_CALL_STATUS_LABELS[result]
  await admin.from('lead_activities').insert({
    lead_id: row.lead_id,
    user_id: row.created_by,
    type: 'ai_call',
    content: buildTimelineText(label, summary, structured),
    metadata: {
      ai_call_id: row.id,
      campaign_id: row.campaign_id,
      result,
      ended_reason: endedReason,
      duration_sec: durationSec,
      recording_url: recordingUrl,
      do_not_call: doNotCall,
    } as Json,
  })
}

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
