/**
 * src/app/api/leads/sync/facebook-sheets/route.ts
 *
 * GET/POST /api/leads/sync/facebook-sheets — sincronizare automată a
 * leadurilor din foaia Google Sheets conectată de Meta la formularele
 * Facebook Lead Ads (Instant Forms → CRM Connections → Google Sheets).
 *
 * NU e o pagină din UI — e un endpoint făcut să fie apelat periodic de un
 * scheduler/pinger extern (cron-job.org, Vercel Cron, un task programat),
 * fără sesiune de utilizator logat.
 *
 * Autentificare: `CRON_SECRET` (variabilă de mediu dedicată, NU cheia din
 * `lead_sources.webhook_key` — endpoint-ul ăsta nu reprezintă un canal de
 * leaduri ca celelalte, e un trigger de sincronizare, deci are propriul
 * secret, izolat de baza de date). Verificat din oricare din:
 * - header `Authorization: Bearer <CRON_SECRET>` (convenția Vercel Cron —
 *   dacă mutați rularea pe Vercel Cron mai târziu, cu variabila numită
 *   exact `CRON_SECRET`, Vercel trimite automat headerul ăsta, fără altă
 *   configurare)
 * - header `x-cron-secret: <CRON_SECRET>`
 * - query `?key=<CRON_SECRET>` (pentru pingere externe care nu pot seta headere custom)
 * Fără `CRON_SECRET` setat în mediu, endpoint-ul refuză orice cerere (fail
 * closed) — nu există un mod „deschis” din greșeală.
 *
 * Flux:
 * 1. Listează TOATE filele din spreadsheet (`listSheetTitles`) — Meta
 *    creează o filă nouă automat quando pornește o campanie/formular nou
 *    (bifat în „Setări pentru integrarea automată” din Facebook), deci nu
 *    ținem un nume de filă fix — orice filă nouă apărută e citită automat,
 *    fără nicio schimbare de cod aici.
 * 2. Citește toate rândurile din toate filele într-un singur apel
 *    (`getAllSheetsValues`, batchGet).
 * 3. Fiecare filă e mapată la fel ca exportul .csv/.xls Facebook —
 *    `mapFacebookRows()` din `src/lib/leads/import-facebook.ts` — apoi
 *    validată cu ACELAȘI motor ca restul importului,
 *    `matchHeaders()`/`parseImportRow()` din `import-parse.ts`.
 * 4. Deduplicare: fiecare lead Facebook are un `id` stabil (ex:
 *    „l:1037064422454556”) — verificăm dacă a fost deja importat căutând
 *    acel id în `leads.source_raw_data->facebook->>id`. Fără asta, la
 *    fiecare rulare am reimporta toate leadurile din foaie, la nesfârșit.
 * 5. Leadurile chiar noi sunt inserate (nealocate, status `new`, sursa
 *    „facebook”) + activitate de sistem + notificare admin/manager, la fel
 *    ca la restul canalelor.
 *
 * Variabile de mediu necesare — vezi .env.example și
 * `src/lib/leads/google-sheets.ts`: GOOGLE_SHEETS_SPREADSHEET_ID,
 * GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { matchHeaders, parseImportRow, type ParsedImportRow } from '@/lib/leads/import-parse'
import { mapFacebookRows, FacebookFormatError } from '@/lib/leads/import-facebook'
import { listSheetTitles, getAllSheetsValues, GoogleSheetsConfigError } from '@/lib/leads/google-sheets'
import type { Database } from '@/lib/types/database'

type NotificationInsert = Database['public']['Tables']['notifications']['Insert']

interface TabSyncResult {
  tab: string
  rowsFound: number
  imported: number
  alreadySynced: number
  skipped: number
  error?: string
}

async function handleSync(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'Lipsește CRON_SECRET din configurare — endpoint-ul e dezactivat până e setat.' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  const bearerToken = authHeader?.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : null
  const providedKey = bearerToken || request.headers.get('x-cron-secret') || request.nextUrl.searchParams.get('key')

  if (!providedKey || providedKey !== cronSecret) {
    return NextResponse.json({ error: 'Cheie invalidă sau lipsă.' }, { status: 401 })
  }

  const adminClient = createAdminClient()

  const { data: sourcesData } = await adminClient
    .from('lead_sources')
    .select('slug, name')
    .eq('is_active', true)

  const sources = (sourcesData || []).map((s) => ({ slug: s.slug, name: s.name }))
  const facebookSource = sources.find((s) => s.slug === 'facebook')

  if (!facebookSource) {
    return NextResponse.json({ error: 'Sursa „facebook” nu există sau nu e activă în lead_sources.' }, { status: 500 })
  }

  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID
  if (!spreadsheetId) {
    return NextResponse.json({ error: 'Lipsește GOOGLE_SHEETS_SPREADSHEET_ID din configurare.' }, { status: 500 })
  }

  let titles: string[]
  let valuesByTab: Record<string, string[][]>
  try {
    titles = await listSheetTitles(spreadsheetId)
    valuesByTab = await getAllSheetsValues(spreadsheetId, titles)
  } catch (err) {
    const message = err instanceof GoogleSheetsConfigError
      ? err.message
      : 'Nu am putut citi din Google Sheets.'
    return NextResponse.json({ error: message }, { status: 502 })
  }

  const defaultSourceSlug = sources.find((s) => s.slug === 'other')?.slug || facebookSource.slug

  const tabResults: TabSyncResult[] = []
  const allInsertedLeads: { id: string; first_name: string | null; last_name: string | null; destination: string | null; tab: string }[] = []

  for (const title of titles) {
    const rawRows = valuesByTab[title] || []

    if (rawRows.length < 2) {
      tabResults.push({ tab: title, rowsFound: 0, imported: 0, alreadySynced: 0, skipped: 0 })
      continue
    }

    let mapped
    try {
      mapped = mapFacebookRows(rawRows)
    } catch (err) {
      tabResults.push({
        tab: title,
        rowsFound: rawRows.length - 1,
        imported: 0,
        alreadySynced: 0,
        skipped: 0,
        error: err instanceof FacebookFormatError ? err.message : 'Filă nerecunoscută — sărită.',
      })
      continue
    }

    const columnIndex = matchHeaders(mapped.headerRow)

    const rawByRowNumber = new Map<number, Record<string, string>>()
    mapped.dataRows.forEach((_, i) => rawByRowNumber.set(i + 2, mapped.rawRecords[i]))

    const parsedRows = mapped.dataRows
      .map((row, i) => parseImportRow(row, i + 2, columnIndex, sources, defaultSourceSlug))
      .filter((r): r is ParsedImportRow => r !== null)

    const importable = parsedRows.filter((r) => !r.skipped)

    // Deduplicare pe id-ul stabil al leadului Facebook — nu reimportăm ce am mai văzut la o rulare anterioară.
    const fbIds = importable
      .map((row) => rawByRowNumber.get(row.rowNumber)?.id)
      .filter((id): id is string => !!id)

    const existingFbIds = new Set<string>()
    if (fbIds.length > 0) {
      const { data: existing } = await adminClient
        .from('leads')
        .select('source_raw_data')
        .in('source_raw_data->facebook->>id', fbIds)
      for (const lead of existing || []) {
        const fid = (lead.source_raw_data as { facebook?: { id?: string } } | null)?.facebook?.id
        if (fid) existingFbIds.add(fid)
      }
    }

    const newRows = importable.filter((row) => {
      const fbId = rawByRowNumber.get(row.rowNumber)?.id
      return !(fbId && existingFbIds.has(fbId))
    })
    const alreadySynced = importable.length - newRows.length

    // Posibil duplicat (telefon/email deja existent la ALT lead) — informativ, nu blochează, ca la restul importului.
    if (newRows.length > 0) {
      const phones = [...new Set(newRows.map((r) => r.lead!.phone).filter((v): v is string => !!v))]
      const emails = [...new Set(newRows.map((r) => r.lead!.email).filter((v): v is string => !!v))]
      if (phones.length > 0 || emails.length > 0) {
        const orParts: string[] = []
        if (phones.length > 0) orParts.push(`phone.in.(${phones.map((p) => `"${p.replace(/"/g, '')}"`).join(',')})`)
        if (emails.length > 0) orParts.push(`email.in.(${emails.map((e) => `"${e.replace(/"/g, '')}"`).join(',')})`)
        const { data: existingContacts } = await adminClient
          .from('leads')
          .select('id, first_name, last_name, phone, email')
          .or(orParts.join(','))
        const byPhone = new Map((existingContacts || []).filter((l) => l.phone).map((l) => [l.phone as string, l]))
        const byEmail = new Map((existingContacts || []).filter((l) => l.email).map((l) => [l.email as string, l]))
        for (const row of newRows) {
          const match = (row.lead!.phone && byPhone.get(row.lead!.phone)) || (row.lead!.email && byEmail.get(row.lead!.email))
          if (match) {
            const name = [match.first_name, match.last_name].filter(Boolean).join(' ') || 'lead existent'
            row.warnings.push({
              field: row.lead!.phone && byPhone.get(row.lead!.phone) ? 'Telefon' : 'Email',
              message: `Posibil duplicat — există deja leadul „${name}”. A fost importat oricum, ca lead nou.`,
            })
          }
        }
      }
    }

    if (newRows.length > 0) {
      const payload = newRows.map((row) => {
        const raw = rawByRowNumber.get(row.rowNumber)
        return {
          ...row.lead!,
          source_raw_data: {
            imported_via: 'facebook_sheets_sync',
            synced_at: new Date().toISOString(),
            sheet_tab: title,
            original_row: row.rowNumber,
            ...(raw ? { facebook: raw } : {}),
          },
          status: 'new',
          eligible_for_auto_assign: true, // lead nou organic (sincronizare) — vezi 005_round_robin_auto_assign.sql
        }
      })

      const { data: inserted, error: insertError } = await adminClient
        .from('leads')
        .insert(payload)
        .select('id, first_name, last_name, destination')

      if (insertError) {
        tabResults.push({ tab: title, rowsFound: mapped.dataRows.length, imported: 0, alreadySynced, skipped: parsedRows.length - importable.length, error: `Eroare la salvare: ${insertError.message}` })
        continue
      }

      const insertedRows = inserted || []
      if (insertedRows.length === newRows.length) {
        await adminClient.from('lead_activities').insert(
          insertedRows.map((lead, i) => ({
            lead_id: lead.id,
            type: 'system' as const,
            content: `Lead importat automat din Google Sheets (Facebook Lead Ads) — formular „${title}” (rând ${newRows[i].rowNumber})`,
          }))
        )
        allInsertedLeads.push(...insertedRows.map((l) => ({ ...l, tab: title })))
      }
    }

    tabResults.push({
      tab: title,
      rowsFound: mapped.dataRows.length,
      imported: newRows.length,
      alreadySynced,
      skipped: parsedRows.length - importable.length,
    })
  }

  if (allInsertedLeads.length > 0) {
    const { data: managers } = await adminClient
      .from('profiles')
      .select('id')
      .in('role', ['admin', 'manager'])
      .eq('is_active', true)

    if (managers && managers.length > 0) {
      const notifications: NotificationInsert[] = managers.flatMap((m) =>
        allInsertedLeads.map((lead) => ({
          user_id: m.id,
          type: 'lead_new' as const,
          title: 'Lead nou nealocat',
          body: `${lead.first_name || ''} ${lead.last_name || ''} — ${lead.destination || 'fără destinație'} (Facebook Ads, formular „${lead.tab}”)`,
          lead_id: lead.id,
        }))
      )
      await adminClient.from('notifications').insert(notifications)
    }
  }

  return NextResponse.json({
    spreadsheetId,
    tabsScanned: titles.length,
    totalImported: allInsertedLeads.length,
    tabs: tabResults,
  })
}

export async function GET(request: NextRequest) {
  return handleSync(request)
}

export async function POST(request: NextRequest) {
  return handleSync(request)
}
