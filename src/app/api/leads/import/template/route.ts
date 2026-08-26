/**
 * src/app/api/leads/import/template/route.ts
 *
 * GET /api/leads/import/template — descarcă modelul .xlsx pentru import leaduri
 *
 * Acces: admin sau manager (la fel ca POST /api/leads/import). Generează un
 * fișier .xlsx cu două foi, direct din `IMPORT_FIELDS`
 * (`src/lib/leads/import-fields.ts` — sursa unică de adevăr a coloanelor):
 * - „Model” — rândul de antet (exact titlurile pe care le caută parserul,
 *   vezi `matchHeaders()`) + un rând cu date exemplu.
 * - „Instrucțiuni” — ce înseamnă fiecare coloană, dacă e obligatorie și ce
 *   format așteaptă, plus valorile posibile pentru Sursă (din tabela
 *   `lead_sources` activă la momentul descărcării).
 *
 * Fiindcă totul pornește din `IMPORT_FIELDS`, o modificare acolo (adăugare/
 * ștergere/redenumire coloană) se reflectă automat aici, fără alt cod.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import writeExcelFile from 'write-excel-file/node'
import { IMPORT_FIELDS } from '@/lib/leads/import-fields'

export async function GET() {
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
    return NextResponse.json({ error: 'Doar admin sau manager pot descărca modelul de import' }, { status: 403 })
  }

  const adminClient = createAdminClient()
  const { data: sources } = await adminClient
    .from('lead_sources')
    .select('name, slug')
    .eq('is_active', true)
    .order('name')

  // Foaia „Model” — antet (bold) + un rând exemplu, exact coloanele din IMPORT_FIELDS
  const modelData = [
    IMPORT_FIELDS.map((f) => ({ value: f.header, fontWeight: 'bold' as const, backgroundColor: '#eff6ff' })),
    IMPORT_FIELDS.map((f) => ({ value: String(f.example), type: String })),
  ]
  const modelColumns = IMPORT_FIELDS.map(() => ({ width: 20 }))

  // Foaia „Instrucțiuni” — o linie per coloană + o secțiune cu sursele active
  const instructionsHeader = [
    { value: 'Coloană', fontWeight: 'bold' as const, backgroundColor: '#eff6ff' },
    { value: 'Obligatoriu', fontWeight: 'bold' as const, backgroundColor: '#eff6ff' },
    { value: 'Explicație', fontWeight: 'bold' as const, backgroundColor: '#eff6ff' },
  ]
  const instructionsRows = IMPORT_FIELDS.map((f) => [
    { value: f.header, type: String },
    { value: f.key === 'first_name' ? 'Cel puțin unul dintre Prenume/Nume/Telefon/Email' : 'Opțional', type: String },
    { value: f.hint, type: String, wrap: true },
  ])

  const sourcesNote = [
    { value: '', type: String },
    { value: '', type: String },
    { value: '', type: String },
  ]
  const sourcesHeaderRow = [
    { value: 'Surse active acum', fontWeight: 'bold' as const, type: String },
    { value: '', type: String },
    { value: '', type: String },
  ]
  const sourceRows = (sources || []).map((s) => [
    { value: s.name, type: String },
    { value: s.slug, type: String },
    { value: '', type: String },
  ])

  const instructionsData = [instructionsHeader, ...instructionsRows, sourcesNote, sourcesHeaderRow, ...sourceRows]
  const instructionsColumns = [{ width: 22 }, { width: 40 }, { width: 70 }]

  const buffer = await writeExcelFile(
    [
      { data: modelData, sheet: 'Model', columns: modelColumns },
      { data: instructionsData, sheet: 'Instrucțiuni', columns: instructionsColumns },
    ],
    {}
  ).toBuffer()

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="model-import-leaduri.xlsx"',
      'Cache-Control': 'no-store',
    },
  })
}
