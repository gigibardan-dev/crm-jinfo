/**
 * src/lib/voice/report.ts
 *
 * Procesarea evenimentelor Vapi pentru apelurile AI — folosită de:
 *   - webhook-ul /api/voice/vapi-webhook (evenimente în timp real);
 *   - dispecer (lib/voice/dispatcher.ts), la RECONCILIERE: dacă un apel a
 *     rămas „agățat" (nu a venit raportul de final — se întâmplă la apelurile
 *     care nu s-au conectat deloc: ocupat, respins), dispecerul cere apelul de
 *     la Vapi (GET /call/:id) și îl procesează exact ca pe un raport de final.
 *
 * Idempotent: un apel deja încheiat (`status = ended`) nu mai primește a doua
 * oară activitate în timeline / incrementare de contor — se completează doar
 * datele lipsă (rezumat, înregistrare...).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/types/database'
import { classifyCall, AI_CALL_STATUS_LABELS, type CalificareLead } from './classify'
import { normalizePhoneE164 } from './phone'

// Forma relevantă (parțială) a mesajelor Vapi — câmpurile pot lipsi, citim defensiv
export type VapiMessage = {
  type?: string
  status?: string
  endedReason?: string
  call?: {
    id?: string
    type?: string // 'outboundPhoneCall' | 'inboundPhoneCall' | 'webCall'
    assistantId?: string
    customer?: { number?: string }
    assistantOverrides?: { metadata?: { ai_call_id?: string } }
    metadata?: { ai_call_id?: string }
  }
  customer?: { number?: string }
  assistant?: { id?: string }
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

type Admin = SupabaseClient<Database>

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
    // Doar rezultate de tip obiect — pot exista mai multe outputuri cu același
    // nume (ex. o variantă veche Boolean rămasă atașată la asistent)
    const isObj = (o: { result?: unknown } | undefined) => !!o?.result && typeof o.result === 'object'
    const match =
      entries.find((o) => o?.name === STRUCTURED_OUTPUT_NAME && isObj(o)) ?? entries.find(isObj)
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
function buildTimelineText(label: string, summary: string | null, s: CalificareLead | null, inbound = false): string {
  const lines = [inbound ? `Clientul a sunat înapoi — ${label}` : `Apel AI — ${label}`]
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

export async function handleStatusUpdate(admin: Admin, msg: VapiMessage) {
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
  } else if (msg.status === 'ended' && (row.status === 'queued' || row.status === 'ringing')) {
    // Apelul NU s-a conectat niciodată (ocupat, respins, nu răspunde). Vapi nu
    // trimite mereu raport de final în cazul ăsta — fără finalizarea de aici,
    // rândul rămânea „ringing", ocupa un loc în coadă și oprea toată coada.
    await handleEndOfCallReport(admin, { ...msg, type: 'end-of-call-report' })
  }
  // Apelurile conectate (in_progress) sunt finalizate de end-of-call-report
}

type CallRow = { id: string; lead_id: string; campaign_id: string | null; created_by: string | null }

/**
 * Apel PRIMIT fără rând în ai_calls → găsește/creează leadul după telefon și
 * creează rândul (direction = 'inbound'). Idempotent prin vapi_call_id unic:
 * dacă Vapi retrimite raportul, findAiCall îl găsește data viitoare.
 */
async function createInboundCall(admin: Admin, msg: VapiMessage): Promise<(CallRow & { isNewLead: boolean }) | null> {
  if (msg.call?.type !== 'inboundPhoneCall' || !msg.call.id) return null
  const phone = normalizePhoneE164(msg.call.customer?.number || msg.customer?.number)
  if (!phone) return null

  // Leadul existent (cel mai nou cu acest număr, indiferent de format)
  const { data: matches } = await admin.rpc('find_leads_by_phone_suffix', { suffixes: [phone.replace(/\D/g, '').slice(-9)] })
  let leadId = matches?.[0]?.id ?? null
  let isNewLead = false

  if (!leadId) {
    const { data: created, error } = await admin
      .from('leads')
      .insert({
        phone,
        source: 'phone',
        source_detail: 'A sunat la numărul agentului AI',
        message: 'Lead creat automat: clientul a sunat la numărul agentului AI, fără să existe în CRM.',
        status: 'new',
        priority: 'high',
        source_raw_data: { inbound_ai_call: msg.call.id } as Json,
      })
      .select('id')
      .single()
    if (error || !created) {
      console.error('[vapi-webhook] lead inbound nu a putut fi creat:', error?.message)
      return null
    }
    leadId = created.id
    isNewLead = true
  }

  // Campania = cea al cărei asistent a răspuns (dacă există în CRM)
  const assistantId = msg.call.assistantId || msg.assistant?.id
  let campaignId: string | null = null
  if (assistantId) {
    const { data: camp } = await admin.from('call_campaigns').select('id').eq('vapi_assistant_id', assistantId).limit(1).maybeSingle()
    campaignId = camp?.id ?? null
  }

  const { data: row, error: rowError } = await admin
    .from('ai_calls')
    .insert({
      lead_id: leadId,
      campaign_id: campaignId,
      phone_number: phone,
      vapi_call_id: msg.call.id,
      direction: 'inbound',
      status: 'in_progress',
    })
    .select('id, lead_id, campaign_id, created_by')
    .single()
  if (rowError || !row) {
    console.error('[vapi-webhook] rând ai_calls inbound eșuat:', rowError?.message)
    return null
  }
  return { ...row, isNewLead }
}

/** Prioritate mare + notificare pentru un client care a sunat înapoi. */
async function flagCallback(admin: Admin, leadId: string, label: string, summary: string | null, isNewLead: boolean) {
  const { data: lead } = await admin
    .from('leads')
    .select('first_name, last_name, phone, priority, assigned_to')
    .eq('id', leadId)
    .single()
  if (!lead) return

  if (lead.priority !== 'urgent') await admin.from('leads').update({ priority: 'high' }).eq('id', leadId)

  let recipients: string[] = []
  if (lead.assigned_to) {
    recipients = [lead.assigned_to]
  } else {
    const { data: managers } = await admin.from('profiles').select('id').in('role', ['admin', 'manager']).eq('is_active', true)
    recipients = (managers ?? []).map((m) => m.id)
  }
  if (!recipients.length) return

  const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || lead.phone || 'Client'
  await admin.from('notifications').insert(
    recipients.map((user_id) => ({
      user_id,
      type: 'system' as const,
      title: isNewLead ? `Client nou a sunat la numărul AI (${label})` : `${name} a sunat înapoi (${label})`,
      body: summary ? summary.slice(0, 280) : 'Vezi conversația în pagina leadului.',
      lead_id: leadId,
    }))
  )
}

export async function handleEndOfCallReport(admin: Admin, msg: VapiMessage) {
  const found = await findAiCall(admin, msg)
  const alreadyEnded = found?.status === 'ended'
  let row: CallRow | null = found
  let inbound: { isNewLead: boolean } | null = null
  if (!row) {
    const created = await createInboundCall(admin, msg)
    if (!created) return
    row = created
    inbound = { isNewLead: created.isNewLead }
  }

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

  // Deja finalizat (ex. de status-update „ended" sau de reconcilierea din
  // dispecer) → completăm doar datele, fără activitate / contor dublat
  if (alreadyEnded) {
    await admin
      .from('ai_calls')
      .update({
        result,
        ...(endedReason ? { ended_reason: endedReason } : {}),
        ...(durationSec !== null ? { duration_sec: durationSec } : {}),
        ...(typeof msg.cost === 'number' ? { cost: msg.cost } : {}),
        ...(summary ? { summary } : {}),
        ...(transcript ? { transcript } : {}),
        ...(recordingUrl ? { recording_url: recordingUrl } : {}),
        ...(structured ? { structured_data: structured as Json } : {}),
        raw_report: raw as Json,
      })
      .eq('id', row.id)
    await admin.from('leads').update({ ai_call_status: result }).eq('id', row.lead_id).eq('ai_last_call_id', row.id)
    return
  }

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
    content: buildTimelineText(label, summary, structured, !!inbound),
    metadata: {
      ai_call_id: row.id,
      campaign_id: row.campaign_id,
      result,
      ended_reason: endedReason,
      duration_sec: durationSec,
      recording_url: recordingUrl,
      do_not_call: doNotCall,
      direction: inbound ? 'inbound' : 'outbound',
    } as Json,
  })

  if (inbound) await flagCallback(admin, row.lead_id, label, summary, inbound.isNewLead)
}
