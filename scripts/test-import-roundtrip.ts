/**
 * scripts/test-import-roundtrip.ts
 *
 * Verificare rapidă: generează modelul .xlsx exact ca API route-ul
 * `/api/leads/import/template`, îl citește înapoi cu `readSheet`, apoi
 * verifică cu `matchHeaders` că toate coloanele se potrivesc perfect.
 * Rulează cu `npx tsx scripts/test-import-roundtrip.ts`.
 */
import writeExcelFile from 'write-excel-file/node'
import { readSheet } from 'read-excel-file/node'
import { IMPORT_FIELDS } from '../src/lib/leads/import-fields'
import { matchHeaders, countMatchedHeaders, parseImportRow } from '../src/lib/leads/import-parse'

async function main() {
  const modelData = [
    IMPORT_FIELDS.map((f) => ({ value: f.header, fontWeight: 'bold' as const, backgroundColor: '#eff6ff' })),
    IMPORT_FIELDS.map((f) => ({ value: String(f.example), type: String })),
  ]
  const modelColumns = IMPORT_FIELDS.map(() => ({ width: 20 }))

  const buffer = await writeExcelFile(
    [{ data: modelData, sheet: 'Model', columns: modelColumns }],
    {}
  ).toBuffer()

  const sheetRows = (await readSheet(buffer as Buffer)) as unknown[][]
  const [headerRow, exampleRow] = sheetRows
  const columnIndex = matchHeaders(headerRow)
  const matched = countMatchedHeaders(columnIndex)
  console.log(`matched ${matched}/${IMPORT_FIELDS.length} headers from generated template`)
  console.assert(matched === IMPORT_FIELDS.length, 'FAIL: template headers do not all match matchHeaders()')

  const sources = [{ slug: 'other', name: 'Altele' }, { slug: 'referral', name: 'Recomandare' }]
  const parsed = parseImportRow(exampleRow, 2, columnIndex, sources, 'other')
  console.log('parsed example row:', JSON.stringify(parsed, null, 2))
  console.assert(parsed !== null, 'FAIL: example row parsed as blank')
  console.assert(parsed && !parsed.skipped, 'FAIL: example row got skipped')
  console.assert((parsed?.warnings.length ?? 99) === 0, 'FAIL: example row produced warnings — template example values do not match validators: ' + JSON.stringify(parsed?.warnings))

  console.log('\nALL ASSERTIONS PASSED (if no FAIL lines above)')
}

main().catch((e) => { console.error(e); process.exit(1) })
