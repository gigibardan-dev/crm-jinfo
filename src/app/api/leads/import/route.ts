/**
 * src/app/api/leads/import/route.ts
 *
 * POST /api/leads/import — import în masă de leaduri, din DOUĂ formate
 * posibile de fișier:
 * - .xlsx — modelul nostru descărcabil (GET /api/leads/import/template),
 *   citit cu `read-excel-file`.
 * - .csv sau .xls — exportul BRUT, nemodificat, din Facebook Lead Ads
 *   (Meta Ads Manager → Leads Center → Download), recunoscut și normalizat
 *   de `parseFacebookExport()` din `src/lib/leads/import-facebook.ts`.
 *   Cine administrează reclamele poate descărca leadurile din Meta și le
 *   urcă direct, fără copy-paste în model.
 *
 * Acces: admin sau manager (verificat din `profiles.role`, ca la celelalte
 * rute din `src/app/api/*`). Primește `multipart/form-data` cu:
 * - `file` — fișierul (.xlsx / .csv / .xls)
 * - `defaultSource` — slug-ul sursei folosite pentru rândurile fără coloană
 *   „Sursă” completată sau cu o valoare necunoscută acolo (pentru fișierele
 *   Facebook practic nu se ajunge aici — sursa e „Facebook Ads”, deja
 *   activă din seed — dar rămâne ca plasă de siguranță)
 *
 * Indiferent de format, ambele ajung la aceeași foaie „antet + rânduri”,
 * deci de aici încolo pipeline-ul e IDENTIC: `matchHeaders()` +
 * `parseImportRow()` din `src/lib/leads/import-parse.ts` (acolo e explicat
 * modelul de erori vs. avertismente) — o singură logică de validare,
 * indiferent de sursa fișierului. După parsare, rândurile care nu au fost
 * sărite sunt verificate în bloc pentru posibile duplicate (telefon/email
 * deja existent în CRM) — nu blochează importul, doar adaugă un
 * avertisment. Leadurile importate intră nealocate, cu status `new` (apar
 * în Inbox, exact ca leadurile venite din canalele online), la fel ca la
 * webhook-ul din `src/app/api/leads/inbound/route.ts`.
 *
 * Pentru fișierele Facebook, rândul original (toate coloanele, inclusiv
 * cele fără echivalent în CRM — id-uri de campanie/reclamă/set, platform,
 * is_organic, lead_status etc.) e păstrat integral în
 * `leads.source_raw_data.facebook`, ca nimic să nu se piardă.
 *
 * Răspuns: JSON cu rezumat (totalRows/imported/skipped/withWarnings) +
 * detaliu per rând (rowNumber, displayName, status, warnings/skipReason) —
 * folosit direct de `src/app/(app)/leads/import/page.tsx` pentru raport.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { readSheet } from 'read-excel-file/node'
import { matchHeaders, countMatchedHeaders, parseImportRow, type ParsedImportRow, type ImportApiResponse } from '@/lib/leads/import-parse'
import { IMPORT_FIELDS } from '@/lib/leads/import-fields'
import { parseFacebookExport, FacebookFormatError } from '@/lib/leads/import-facebook'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_DATA_ROWS = 2000

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'manager'].includes(profile.role)) {
    return NextResponse.json({ error: 'Doar admin sau manager pot importa leaduri' }, { status: 403 })
  }

  const formData = await request.formData()
  const file = formData.get('file')
  const defaultSource = String(formData.get('defaultSource') || '')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Niciun fișier trimis.' }, { status: 400 })
  }
  const lowerName = file.name.toLowerCase()
  const isXlsx = lowerName.endsWith('.xlsx')
  const isFacebookFile = lowerName.endsWith('.csv') || lowerName.endsWith('.xls')
  if (!isXlsx && !isFacebookFile) {
    return NextResponse.json({ error: 'Fișierul trebuie să fie .xlsx (modelul nostru) sau .csv/.xls (exportul din Facebook Lead Ads).' }, { status: 400 })
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: `Fișierul e prea mare (${(file.size / 1024 / 1024).toFixed(1)} MB) — maxim 5 MB.` }, { status: 400 })
  }
  if (!defaultSource) {
    return NextResponse.json({ error: 'Lipsește sursa implicită.' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  const { data: sourcesData } = await adminClient
    .from('lead_sources')
    .select('slug, name')
    .eq('is_active', true)

  const sources = sourcesData || []
  if (!sources.some((s) => s.slug === defaultSource)) {
    return NextResponse.json({ error: 'Sursa implicită selectată nu (mai) există sau nu e activă.' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  let headerRow: unknown[]
  let dataRows: unknown[][]
  let facebookRawRecords: Record<string, string>[] | null = null
  let sourceFormat: ImportApiResponse['sourceFormat'] = 'model'

  if (isXlsx) {
    let sheetRows: unknown[][]
    try {
      sheetRows = (await readSheet(buffer)) as unknown[][]
    } catch {
      return NextResponse.json({ error: 'Fișierul nu poate fi citit — verifică că e un .xlsx valid, nesalvat cu parolă.' }, { status: 400 })
    }
    if (sheetRows.length === 0) {
      return NextResponse.json({ error: 'Fișierul e gol.' }, { status: 400 })
    }
    ;[headerRow, ...dataRows] = sheetRows
  } else {
    try {
      const parsed = parseFacebookExport(buffer, file.name)
      headerRow = parsed.headerRow
      dataRows = parsed.dataRows
      facebookRawRecords = parsed.rawRecords
      sourceFormat = 'facebook'
    } catch (err) {
      const message = err instanceof FacebookFormatError
        ? err.message
        : 'Fișierul nu poate fi citit ca export Facebook Lead Ads.'
      return NextResponse.json({ error: message }, { status: 400 })
    }
  }

  const columnIndex = matchHeaders(headerRow)

  if (countMatchedHeaders(columnIndex) === 0) {
    return NextResponse.json({
      error: `Fișierul nu pare să respecte modelul de import — niciuna din coloanele așteptate (${IMPORT_FIELDS.map(f => f.header).join(', ')}) nu a fost găsită pe primul rând. Descarcă modelul din pagină și completează datele acolo.`,
    }, { status: 400 })
  }

  if (dataRows.length > MAX_DATA_ROWS) {
    return NextResponse.json({ error: `Fișierul are ${dataRows.length} rânduri de date — maxim ${MAX_DATA_ROWS} per import. Împarte-l în fișiere mai mici.` }, { status: 400 })
  }

  // Rândul 1 e antetul -> primul rând de date e rândul 2 din fișier (același număr pentru fișierele Facebook)
  const facebookRawByRowNumber = new Map<number, Record<string, string>>()
  if (facebookRawRecords) {
    dataRows.forEach((_, i) => facebookRawByRowNumber.set(i + 2, facebookRawRecords![i]))
  }

  const parsedRows = dataRows
    .map((row, i) => parseImportRow(row, i + 2, columnIndex, sources, defaultSource))
    .filter((r): r is ParsedImportRow => r !== null) // scoate rândurile complet goale, silențios

  const importable = parsedRows.filter((r) => !r.skipped)

  // Verificare duplicate (telefon/email deja existent) — informativ, nu blochează importul
  const phones = [...new Set(importable.map((r) => r.lead!.phone).filter((v): v is string => !!v))]
  const emails = [...new Set(importable.map((r) => r.lead!.email).filter((v): v is string => !!v))]

  const existingByPhone = new Map<string, { id: string; name: string }>()
  const existingByEmail = new Map<string, { id: string; name: string }>()

  if (phones.length > 0 || emails.length > 0) {
    const orParts: string[] = []
    if (phones.length > 0) orParts.push(`phone.in.(${phones.map((p) => `"${p.replace(/"/g, '')}"`).join(',')})`)
    if (emails.length > 0) orParts.push(`email.in.(${emails.map((e) => `"${e.replace(/"/g, '')}"`).join(',')})`)

    const { data: existing } = await adminClient
      .from('leads')
      .select('id, first_name, last_name, phone, email')
      .or(orParts.join(','))

    for (const lead of existing || []) {
      const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'lead existent'
      if (lead.phone) existingByPhone.set(lead.phone, { id: lead.id, name })
      if (lead.email) existingByEmail.set(lead.email, { id: lead.id, name })
    }
  }

  for (const row of importable) {
    const phoneMatch = row.lead!.phone ? existingByPhone.get(row.lead!.phone) : undefined
    const emailMatch = row.lead!.email ? existingByEmail.get(row.lead!.email) : undefined
    const match = phoneMatch || emailMatch
    if (match) {
      row.warnings.push({
        field: phoneMatch ? 'Telefon' : 'Email',
        message: `Posibil duplicat — există deja leadul „${match.name}” cu ${phoneMatch ? 'acest telefon' : 'acest email'}. A fost importat oricum, ca lead nou.`,
      })
    }
  }

  // Inserare în bloc a leadurilor valide — nealocate, status `new` (intră în Inbox)
  let insertedIds: string[] = []
  if (importable.length > 0) {
    const payload = importable.map((row) => {
      const facebookRaw = facebookRawByRowNumber.get(row.rowNumber)
      return {
        ...row.lead!,
        source_raw_data: {
          imported_by: user.id,
          imported_at: new Date().toISOString(),
          original_row: row.rowNumber,
          import_format: sourceFormat,
          ...(facebookRaw ? { facebook: facebookRaw } : {}),
        },
        status: 'new',
      }
    })

    const { data: inserted, error: insertError } = await adminClient
      .from('leads')
      .insert(payload)
      .select('id')

    if (insertError) {
      return NextResponse.json({ error: `Eroare la salvarea leadurilor: ${insertError.message}` }, { status: 500 })
    }

    insertedIds = (inserted || []).map((l) => l.id)

    if (insertedIds.length === importable.length) {
      const activitySource = sourceFormat === 'facebook' ? 'exportul Facebook Lead Ads' : 'fișierul Excel'
      await adminClient.from('lead_activities').insert(
        insertedIds.map((leadId, i) => ({
          lead_id: leadId,
          user_id: user.id,
          type: 'system' as const,
          content: `Lead importat din ${activitySource} (rând ${importable[i].rowNumber})`,
        }))
      )
    }
  }

  const rowsReport = parsedRows.map((row) => ({
    rowNumber: row.rowNumber,
    displayName: row.displayName,
    status: row.skipped ? 'skipped' as const : 'imported' as const,
    skipReason: row.skipReason,
    warnings: row.warnings,
  }))

  const response: ImportApiResponse = {
    totalRows: parsedRows.length,
    imported: importable.length,
    skipped: parsedRows.length - importable.length,
    withWarnings: rowsReport.filter((r) => r.status === 'imported' && r.warnings.length > 0).length,
    sourceFormat,
    rows: rowsReport,
  }

  return NextResponse.json(response)
}
