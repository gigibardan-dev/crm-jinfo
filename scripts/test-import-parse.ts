/**
 * scripts/test-import-parse.ts
 *
 * Verificare rapidă pentru motorul de import leaduri
 *
 * Nu există un runner de teste (jest/vitest) în proiect — acest script e o
 * verificare manuală, cu `console.assert`, pentru `src/lib/leads/import-parse.ts`.
 * Rulează-l cu `npm run test:import` (sau `npx tsx scripts/test-import-parse.ts`)
 * după orice modificare la `import-parse.ts` / `import-fields.ts`, sau după ce
 * schimbi formularul manual „Lead Nou" și actualizezi `IMPORT_FIELDS` în
 * consecință. Nicio linie „FAIL" în output + „ALL ASSERTIONS PASSED" la
 * final = totul e ok.
 */

import { matchHeaders, countMatchedHeaders, parseImportRow } from '../src/lib/leads/import-parse'
import { IMPORT_FIELDS } from '../src/lib/leads/import-fields'

const sources = [
  { slug: 'other', name: 'Altele' },
  { slug: 'referral', name: 'Recomandare' },
  { slug: 'walk_in', name: 'Walk-in Agenție' },
]

const header = IMPORT_FIELDS.map((f) => f.header)
const columnIndex = matchHeaders(header)
console.log('matched headers:', countMatchedHeaders(columnIndex), '/', IMPORT_FIELDS.length)
console.assert(countMatchedHeaders(columnIndex) === IMPORT_FIELDS.length, 'FAIL: not all headers matched')

// Reordered + partially renamed headers should still mostly match
const reordered = ['Email', 'Prenume', 'Nume', 'ceva necunoscut', 'Telefon']
const ci2 = matchHeaders(reordered)
console.log('reordered match:', ci2)

function col(key: string) { return columnIndex[key] }

function buildRow(overrides: Record<string, unknown>) {
  const row = new Array(IMPORT_FIELDS.length).fill('')
  for (const [k, v] of Object.entries(overrides)) {
    row[col(k)] = v
  }
  return row
}

// 1. Happy path, everything valid
const r1 = parseImportRow(buildRow({
  first_name: 'Ion', last_name: 'Popescu', phone: '0722123456', email: 'ion@test.ro',
  destination: 'Grecia', trip_type: 'Sejur', travel_date_from: '15.09.2026', travel_date_to: '22.09.2026',
  nr_adults: 2, nr_children: 1, priority: 'Ridicat', source: 'Recomandare',
}), 2, columnIndex, sources, 'other')
console.log('\n--- r1 (happy path) ---')
console.log(JSON.stringify(r1, null, 2))
console.assert(r1 && !r1.skipped, 'FAIL r1 should not be skipped')
console.assert(r1?.lead?.priority === 'high', 'FAIL r1 priority should map to high')
console.assert(r1?.lead?.source === 'referral', 'FAIL r1 source should map to referral')
console.assert(r1?.lead?.travel_date_from === '2026-09-15', 'FAIL r1 date_from')
console.assert(r1?.warnings.length === 0, 'FAIL r1 should have zero warnings, got ' + r1?.warnings.length)

// 2. No contact info at all -> skipped
const r2 = parseImportRow(buildRow({ destination: 'Grecia' }), 3, columnIndex, sources, 'other')
console.log('\n--- r2 (no contact) ---')
console.log(JSON.stringify(r2, null, 2))
console.assert(r2 && r2.skipped, 'FAIL r2 should be skipped')

// 3. Blank row -> null (silently ignored)
const r3 = parseImportRow(buildRow({}), 4, columnIndex, sources, 'other')
console.log('\n--- r3 (blank row) ---', r3)
console.assert(r3 === null, 'FAIL r3 should be null (blank)')

// 4. Bad email, bad date, bad numbers, unknown priority/source/trip_type -> warnings, still imported
const r4 = parseImportRow(buildRow({
  first_name: 'Maria',
  email: 'not-an-email',
  travel_date_from: '32.13.2026',
  nr_adults: 'doi',
  priority: 'foo',
  source: 'sursa inexistenta',
  trip_type: 'zbor cu OZN',
}), 5, columnIndex, sources, 'other')
console.log('\n--- r4 (many warnings) ---')
console.log(JSON.stringify(r4, null, 2))
console.assert(r4 && !r4.skipped, 'FAIL r4 should still import')
console.assert(r4?.lead?.email === null, 'FAIL r4 email should be nulled')
console.assert(r4?.lead?.nr_adults === 1, 'FAIL r4 nr_adults fallback')
console.assert(r4?.lead?.priority === 'medium', 'FAIL r4 priority fallback')
console.assert(r4?.lead?.source === 'other', 'FAIL r4 source fallback')
console.assert((r4?.warnings.length ?? 0) >= 5, 'FAIL r4 should have several warnings, got ' + r4?.warnings.length)

// 5. Excel date serial as raw JS Date object (simulating readSheet output)
const r5 = parseImportRow(buildRow({ first_name: 'Test', travel_date_from: new Date('2026-01-05T00:00:00.000Z') }), 6, columnIndex, sources, 'other')
console.assert(r5?.lead?.travel_date_from === '2026-01-05', 'FAIL r5 date from Date object')

console.log('\nALL ASSERTIONS PASSED (if no FAIL lines above)')
