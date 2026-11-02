/**
 * src/lib/voice/import-call-list.ts
 *
 * Importul „Listă de apelare AI" — ramura specială din POST /api/leads/import
 * (activată când formularul trimite `callListName` + `callCampaignId`).
 *
 * Primește rândurile deja parsate și validate de pipeline-ul comun de import
 * (`parseImportRow`, același pentru modelul .xlsx și exportul Facebook) și:
 *
 *   1. creează lista (`call_lists`) legată de campania / agentul AI ales —
 *      fiecare campanie are asistentul ei Vapi, cu textul ei;
 *   2. cere telefon VALID pe fiecare rând (altfel rândul e ignorat — o listă
 *      de apelare fără telefon nu are sens) și elimină numerele dublate în
 *      același fișier;
 *   3. caută numerele care există DEJA în CRM, indiferent de format
 *      (`find_leads_by_phone_suffix`, migrarea 014 — ultimele 9 cifre).
 *      Acolo NU se creează lead nou: leadul existent e adăugat în listă
 *      (poate fi de la altă campanie și trebuie sunat din nou pentru asta);
 *   4. creează leadurile noi (status `new`, nealocate, telefon salvat direct
 *      în format +40…). Sursa: `lista_apelare` (Facebook rămâne Facebook
 *      dacă fișierul e un export Lead Ads);
 *   5. leagă toate leadurile de listă (`call_list_members`) + activitate
 *      în timeline;
 *   6. opțional, le pune direct în coada de apeluri (enqueueLeads +
 *      dispatchQueue) — cu toate protecțiile obișnuite (nu mai suna, deja în
 *      coadă, sunat recent pe aceeași campanie, interval orar).
 *
 * Modifică rândurile primite IN PLACE (skipped/skipReason/warnings), ca
 * raportul per rând din pagina de import să arate exact ce s-a întâmplat.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/types/database'
import type { ParsedImportRow, CallListImportSummary } from '@/lib/leads/import-parse'
import { normalizePhoneE164 } from './phone'
import { enqueueLeads } from './enqueue'
import { dispatchQueue, isWithinCallingHours } from './dispatcher'

type Admin = SupabaseClient<Database>

const SUFFIX_CHUNK = 300

function phoneSuffix(e164: string): string {
  return e164.replace(/\D/g, '').slice(-9)
}

export type CallListImportParams = {
  admin: Admin
  userId: string
  rows: ParsedImportRow[] // TOATE rândurile parsate (inclusiv cele deja sărite)
  listName: string
  campaignId: string
  enqueue: boolean
  sourceFormat: 'model' | 'facebook'
  facebookRawByRowNumber: Map<number, Record<string, string>>
}

export async function importCallList(
  p: CallListImportParams
): Promise<{ ok: true; summary: CallListImportSummary } | { ok: false; error: string; status: number }> {
  const { admin, userId, rows, listName, campaignId } = p

  const { data: campaign } = await admin
    .from('call_campaigns')
    .select('id, name, is_active')
    .eq('id', campaignId)
    .maybeSingle()
  if (!campaign) return { ok: false, error: 'Agentul AI (campania) ales nu există.', status: 400 }
  if (!campaign.is_active) return { ok: false, error: 'Agentul AI (campania) ales este dezactivat.', status: 400 }

  // --- 1. Telefon obligatoriu + valid; dubluri în fișier ---
  const phoneByRow = new Map<number, string>()
  const seen = new Map<string, number>() // sufix → primul rând
  for (const row of rows) {
    if (row.skipped) continue
    const e164 = normalizePhoneE164(row.lead!.phone)
    if (!e164) {
      row.skipped = true
      row.skipReason = row.lead!.phone
        ? `Telefon invalid („${row.lead!.phone}") — rândul nu a fost adăugat în lista de apelare.`
        : 'Fără telefon — rândul nu a fost adăugat în lista de apelare.'
      continue
    }
    const suffix = phoneSuffix(e164)
    const firstRow = seen.get(suffix)
    if (firstRow !== undefined) {
      row.skipped = true
      row.skipReason = `Același număr apare deja pe rândul ${firstRow} din fișier.`
      continue
    }
    seen.set(suffix, row.rowNumber)
    phoneByRow.set(row.rowNumber, e164)
  }

  const valid = rows.filter((r) => !r.skipped)

  // --- 2. Leaduri existente cu același număr (orice format) ---
  const suffixes = [...seen.keys()]
  const existingBySuffix = new Map<string, { id: string; name: string; do_not_call: boolean }>()
  for (let i = 0; i < suffixes.length; i += SUFFIX_CHUNK) {
    const { data, error } = await admin.rpc('find_leads_by_phone_suffix', { suffixes: suffixes.slice(i, i + SUFFIX_CHUNK) })
    if (error) {
      return {
        ok: false,
        error: `Căutarea numerelor existente a eșuat (${error.message}). Ai rulat migrarea 014_find_leads_by_phone.sql?`,
        status: 500,
      }
    }
    for (const l of data ?? []) {
      // rezultatele vin cel mai nou primul — păstrăm primul găsit
      if (!existingBySuffix.has(l.phone_suffix)) {
        existingBySuffix.set(l.phone_suffix, {
          id: l.id,
          name: [l.first_name, l.last_name].filter(Boolean).join(' ') || 'lead existent',
          do_not_call: l.do_not_call,
        })
      }
    }
  }

  // --- 3. Lista ---
  const { data: list, error: listError } = await admin
    .from('call_lists')
    .insert({ name: listName, campaign_id: campaignId, created_by: userId })
    .select('id')
    .single()
  if (listError || !list) return { ok: false, error: `Lista nu a putut fi creată: ${listError?.message}`, status: 500 }

  const linkedIds: string[] = []
  const toCreate: ParsedImportRow[] = []
  for (const row of valid) {
    const existing = existingBySuffix.get(phoneSuffix(phoneByRow.get(row.rowNumber)!))
    if (existing) {
      linkedIds.push(existing.id)
      row.warnings.push({
        field: 'Telefon',
        message: existing.do_not_call
          ? `Există deja leadul „${existing.name}" — adăugat în listă, dar a cerut să NU mai fie sunat (nu va intra în coadă).`
          : `Există deja leadul „${existing.name}" — adăugat în listă, fără lead nou.`,
      })
    } else {
      toCreate.push(row)
    }
  }

  // --- 4. Leaduri noi ---
  let createdIds: string[] = []
  if (toCreate.length) {
    const now = new Date().toISOString()
    const payload = toCreate.map((row) => {
      const facebookRaw = p.facebookRawByRowNumber.get(row.rowNumber)
      const isFacebook = p.sourceFormat === 'facebook'
      return {
        ...row.lead!,
        phone: phoneByRow.get(row.rowNumber)!,
        source: isFacebook ? row.lead!.source : 'lista_apelare',
        source_detail: isFacebook ? row.lead!.source_detail : listName,
        source_raw_data: {
          imported_by: userId,
          imported_at: now,
          original_row: row.rowNumber,
          import_format: p.sourceFormat,
          call_list: { id: list.id, name: listName, campaign_id: campaignId },
          ...(facebookRaw ? { facebook: facebookRaw } : {}),
        } as Json,
        status: 'new',
      }
    })
    const { data: inserted, error: insertError } = await admin.from('leads').insert(payload).select('id')
    if (insertError) return { ok: false, error: `Eroare la salvarea leadurilor: ${insertError.message}`, status: 500 }
    createdIds = (inserted ?? []).map((l) => l.id)
  }

  // --- 5. Membri listă + timeline ---
  const allIds = [...new Set([...linkedIds, ...createdIds])]
  if (allIds.length) {
    await admin
      .from('call_list_members')
      .upsert(allIds.map((lead_id) => ({ list_id: list.id, lead_id })), { onConflict: 'list_id,lead_id', ignoreDuplicates: true })

    const activities = [
      ...createdIds.map((lead_id) => ({
        lead_id,
        user_id: userId,
        type: 'system' as const,
        content: `Lead importat în lista de apelare „${listName}" (agent AI: ${campaign.name})`,
      })),
      ...linkedIds.map((lead_id) => ({
        lead_id,
        user_id: userId,
        type: 'system' as const,
        content: `Adăugat în lista de apelare „${listName}" (agent AI: ${campaign.name})`,
      })),
    ]
    await admin.from('lead_activities').insert(activities)
  }

  // --- 6. Opțional: direct în coadă ---
  const enqueue: CallListImportSummary['enqueue'] = { requested: p.enqueue, queued: 0, skipped: [], outsideHours: false }
  if (p.enqueue && allIds.length) {
    const res = await enqueueLeads(admin, { leadIds: allIds, campaignId, listId: list.id, userId })
    if (!res.ok) {
      enqueue.error = res.error
    } else {
      enqueue.queued = res.queued
      const counts: Record<string, number> = {}
      for (const s of res.skipped) counts[s.reason] = (counts[s.reason] || 0) + 1
      enqueue.skipped = Object.entries(counts).map(([reason, count]) => ({ reason, count }))
      const dispatch = await dispatchQueue(admin)
      if (dispatch.error) enqueue.error = dispatch.error
      enqueue.outsideHours = !isWithinCallingHours()
    }
  }

  return {
    ok: true,
    summary: {
      id: list.id,
      name: listName,
      campaignName: campaign.name,
      created: createdIds.length,
      linked: new Set(linkedIds).size,
      enqueue,
    },
  }
}
