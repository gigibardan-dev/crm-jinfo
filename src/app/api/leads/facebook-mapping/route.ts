/**
 * src/app/api/leads/facebook-mapping/route.ts
 *
 * GET   /api/leads/facebook-mapping — pt. fiecare filă din Google Sheets
 *       (= formular Facebook), antetul brut curent + ce ar detecta automat
 *       recunoașterea din FIELD_ALIASES (import-facebook.ts) pt.
 *       nume/email/telefon + mapare manuală deja salvată (dacă există) +
 *       ce lipsește încă. Admin only. Citește LIVE din Google Sheets (ca
 *       sincronizarea reală) — nu din leaduri deja importate.
 * PATCH /api/leads/facebook-mapping — salvează/actualizează mapare manuală
 *       pt. o filă. Admin only.
 *
 * Vezi supabase/migrations/011_facebook_field_mappings.sql +
 * src/lib/leads/facebookFieldMappings.ts pt. schemă, și discuția din chat
 * (formularul „Promotie Circuite Revelion 2027", construit cu întrebări
 * custom text în loc de câmpul standard Meta pt. nume/telefon).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listSheetTitles, getAllSheetsValues, GoogleSheetsConfigError } from '@/lib/leads/google-sheets'
import { detectIdentityFields, type IdentityField } from '@/lib/leads/import-facebook'
import { getFacebookFieldMappings, upsertFacebookFieldMapping, type FacebookFieldMapping } from '@/lib/leads/facebookFieldMappings'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, status: 401, error: 'Neautorizat' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') {
    return { ok: false as const, status: 403, error: 'Doar adminii pot administra maparea formularelor Facebook' }
  }
  return { ok: true as const, userId: user.id }
}

export interface TabMappingInfo {
  tab: string
  headers: string[]
  rowsFound: number
  detected: Partial<Record<IdentityField, string>>
  override: FacebookFieldMapping | null
  missing: IdentityField[]
}

const IDENTITY_FIELDS: IdentityField[] = ['full_name', 'email', 'phone']

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

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
    const message = err instanceof GoogleSheetsConfigError ? err.message : 'Nu am putut citi din Google Sheets.'
    return NextResponse.json({ error: message }, { status: 502 })
  }

  const savedMappings = await getFacebookFieldMappings()

  const tabs: TabMappingInfo[] = titles.map((tab) => {
    const rows = valuesByTab[tab] || []
    const headers = rows[0] || []
    const detected = headers.length > 0 ? detectIdentityFields(headers) : {}
    const override = savedMappings[tab] || null

    const overrideByField: Record<IdentityField, string | null> = {
      full_name: override?.fullNameHeader ?? null,
      email: override?.emailHeader ?? null,
      phone: override?.phoneHeader ?? null,
    }
    const missing = IDENTITY_FIELDS.filter((field) => !overrideByField[field] && !detected[field])

    return {
      tab,
      headers,
      rowsFound: Math.max(rows.length - 1, 0),
      detected,
      override,
      missing,
    }
  })

  return NextResponse.json({ spreadsheetId, tabs })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Corp invalid.' }, { status: 400 })
  }

  const { sheetTab, fullNameHeader, emailHeader, phoneHeader } = body as Record<string, unknown>

  if (typeof sheetTab !== 'string' || !sheetTab.trim()) {
    return NextResponse.json({ error: 'sheetTab e obligatoriu.' }, { status: 400 })
  }
  for (const [key, value] of Object.entries({ fullNameHeader, emailHeader, phoneHeader })) {
    if (value !== undefined && value !== null && typeof value !== 'string') {
      return NextResponse.json({ error: `${key} trebuie să fie text sau null.` }, { status: 400 })
    }
  }

  const mapping: FacebookFieldMapping = {
    sheetTab,
    fullNameHeader: (fullNameHeader as string | null | undefined) ?? null,
    emailHeader: (emailHeader as string | null | undefined) ?? null,
    phoneHeader: (phoneHeader as string | null | undefined) ?? null,
  }

  try {
    await upsertFacebookFieldMapping(mapping, auth.userId)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Eroare la salvare.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, mapping })
}
