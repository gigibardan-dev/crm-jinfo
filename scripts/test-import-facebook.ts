/**
 * scripts/test-import-facebook.ts
 *
 * Test manual pentru `parseFacebookExport()` (src/lib/leads/import-facebook.ts)
 * — rulat cu `npx tsx scripts/test-import-facebook.ts` (sau `npm run test:import`,
 * care rulează toate scripturile din familia asta). Nu există jest/vitest în
 * proiect, deci verificarea e prin `console.assert` pe fixturile reale din
 * `scripts/fixtures/` — exact fișierele exportate din Facebook Lead Ads
 * (câmpul „Regii Franței”, 3 leaduri), în ambele formate pe care le dă Meta:
 * facebook-sample.csv (UTF-16LE, TAB) și facebook-sample.xls (XML SpreadsheetML).
 *
 * Verifică: ambele formate dau EXACT același rezultat (parity CSV ↔ xls),
 * numele e despărțit corect în prenume/nume, telefonul e curățat de
 * prefixul „p:”, sursa e forțată la „Facebook Ads”, „Detalii sursă” conține
 * campania, destinația preia numele formularului, iar întrebarea custom din
 * formular (coloana „0” din exportul Facebook) ajunge integral în mesaj —
 * deci rulează mai departe și prin `parseImportRow()`, ca în ruta reală.
 *
 * Testează și `mapFacebookRows()` direct (fără fișier, doar `string[][]`) —
 * exact cum o folosește `src/app/api/leads/sync/facebook-sheets/route.ts`
 * cu rândurile primite de la Google Sheets API — cu antete în altă ordine
 * și o întrebare custom cu etichetă reală (nu doar coloana „0”).
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseFacebookExport, mapFacebookRows } from '../src/lib/leads/import-facebook'
import { matchHeaders, parseImportRow } from '../src/lib/leads/import-parse'

const FIXTURES = join(__dirname, 'fixtures')
const SOURCES = [{ slug: 'facebook', name: 'Facebook Ads' }, { slug: 'other', name: 'Altele' }]

function run(filename: string) {
  const buffer = readFileSync(join(FIXTURES, filename))
  const parsed = parseFacebookExport(buffer, filename)

  console.assert(parsed.dataRows.length === 3, `[${filename}] ar trebui să fie 3 rânduri, e ${parsed.dataRows.length}`)
  console.assert(parsed.rawRecords.length === 3, `[${filename}] rawRecords ar trebui să aibă 3 elemente`)

  const columnIndex = matchHeaders(parsed.headerRow)
  const rows = parsed.dataRows.map((row, i) => parseImportRow(row, i + 2, columnIndex, SOURCES, 'other'))

  console.log(`\n--- ${filename} ---`)
  console.log(JSON.stringify(rows, null, 2))

  const [r1, r2, r3] = rows
  console.assert(r1 && r1.lead?.first_name === 'Maria' && r1.lead?.last_name === 'Guinea', `[${filename}] r1 nume greșit`)
  console.assert(r1 && r1.lead?.phone === '+40728870869', `[${filename}] r1 telefon ar trebui curățat de „p:”, e „${r1?.lead?.phone}”`)
  console.assert(r1 && r1.lead?.email === 'maria.guinea59@yahoo.ro', `[${filename}] r1 email greșit: ${r1?.lead?.email}`)
  console.assert(r1 && r1.lead?.source === 'facebook', `[${filename}] r1 sursă ar trebui „facebook”, e „${r1?.lead?.source}”`)
  console.assert(r1 && r1.lead?.source_detail?.includes('Campanie:'), `[${filename}] r1 source_detail ar trebui să conțină campania`)
  console.assert(r1 && r1.lead?.destination === 'Regii Frantei', `[${filename}] r1 destinație ar trebui „Regii Frantei”, e „${r1?.lead?.destination}”`)
  console.assert(r1 && r1.lead?.message === 'Franta', `[${filename}] r1 mesaj (întrebarea custom) ar trebui „Franta”, e „${r1?.lead?.message}”`)

  console.assert(r2 && r2.lead?.first_name === 'Elena' && r2.lead?.last_name === 'Logofetescu', `[${filename}] r2 nume greșit`)
  console.assert(r2 && r2.lead?.message?.includes('excursie'), `[${filename}] r2 mesaj ar trebui să conțină textul complet al clientului`)

  console.assert(r3 && r3.lead?.first_name === 'Maria' && r3.lead?.last_name === 'Moldovan', `[${filename}] r3 nume greșit`)
  console.assert(r3 && r3.lead?.message === 'doresc oferta pt Franta', `[${filename}] r3 mesaj greșit: ${r3?.lead?.message}`)

  // Nimic pierdut: rawRecords păstrează tot rândul original, inclusiv coloanele fără echivalent (ad_id, campaign_id, form_id, lead_status...)
  console.assert('campaign_name' in parsed.rawRecords[0], `[${filename}] rawRecords ar trebui să păstreze campaign_name`)
  console.assert('lead_status' in parsed.rawRecords[0], `[${filename}] rawRecords ar trebui să păstreze lead_status`)

  return rows
}

const csvRows = run('facebook-sample.csv')
const xlsRows = run('facebook-sample.xls')

// Parity: ambele formate ale aceluiași export trebuie să dea leaduri identice
for (let i = 0; i < 3; i++) {
  const a = csvRows[i]?.lead
  const b = xlsRows[i]?.lead
  console.assert(
    JSON.stringify(a) === JSON.stringify(b),
    `Parity CSV vs XLS eșuată la rândul ${i + 2}:\nCSV: ${JSON.stringify(a)}\nXLS: ${JSON.stringify(b)}`
  )
}

// --- mapFacebookRows() direct, ca sincronizarea din Google Sheets — antete reordonate + etichetă reală pe întrebarea custom ---
const sheetsStyleRows = [
  ['EMAIL', 'PHONE', 'FULL_NAME', 'id', 'campaign_name', 'ad_name', 'form_name', 'Ce destinație vă interesează?', 'lead_status'],
  ['ana.pop@test.ro', '+40711222333', 'Ana Pop', 'l:999888777', 'Campanie Grecia', 'Reclamă Grecia Vară', 'Grecia Vara', 'Santorini', 'CREATED'],
]
const sheetsMapped = mapFacebookRows(sheetsStyleRows)
const sheetsColumnIndex = matchHeaders(sheetsMapped.headerRow)
const sheetsRows = sheetsMapped.dataRows.map((row, i) => parseImportRow(row, i + 2, sheetsColumnIndex, SOURCES, 'other'))
const sheetsLead = sheetsRows[0]?.lead

console.log('\n--- mapFacebookRows() direct (stil Google Sheets) ---')
console.log(JSON.stringify(sheetsRows, null, 2))

console.assert(sheetsLead?.first_name === 'Ana' && sheetsLead?.last_name === 'Pop', 'mapFacebookRows: nume greșit')
console.assert(sheetsLead?.email === 'ana.pop@test.ro', 'mapFacebookRows: email greșit')
console.assert(sheetsLead?.phone === '+40711222333', 'mapFacebookRows: telefon greșit')
console.assert(sheetsLead?.destination === 'Grecia Vara', 'mapFacebookRows: destinație greșită')
console.assert(sheetsLead?.message === 'Ce destinație vă interesează?: Santorini', `mapFacebookRows: mesaj cu etichetă greșit: ${sheetsLead?.message}`)
console.assert(sheetsMapped.rawRecords[0].id === 'l:999888777', 'mapFacebookRows: id-ul original ar trebui păstrat în rawRecords, pentru deduplicarea din sync')

console.log('\nALL ASSERTIONS PASSED (if no FAIL lines above)')
