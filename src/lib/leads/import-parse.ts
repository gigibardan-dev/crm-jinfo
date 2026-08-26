/**
 * src/lib/leads/import-parse.ts
 *
 * Motorul de validare pentru importul de leaduri — funcții pure, fără
 * dependențe de Next.js/Supabase, ca să poată fi testate izolat. Folosit
 * din `src/app/api/leads/import/route.ts`, indiferent dacă rândurile vin
 * din modelul nostru .xlsx sau din exportul Facebook normalizat de
 * `src/lib/leads/import-facebook.ts` — o singură logică de validare.
 *
 * Model de erori (două niveluri, cerut explicit — „sistem complet cu
 * erori, cu explicare erori”):
 * - EROARE (blochează rândul, nu se importă): doar când rândul nu are
 *   nicio informație de identitate (Prenume/Nume/Telefon/Email toate
 *   goale) — aceeași regulă ca la formularul manual „Lead Nou”.
 * - AVERTISMENT (rândul TOT se importă, câmpul respectiv primește o
 *   valoare implicită/gol): orice altă problemă — email invalid, dată
 *   neparsabilă, sursă necunoscută, prioritate/tip călătorie necunoscute,
 *   telefon fără cifre, posibil duplicat (telefon/email deja existent).
 *   Rândurile complet goale (toate celulele goale) sunt sărite silențios,
 *   fără să apară ca eroare — sunt tratate ca rânduri libere din fișier.
 */

import { TRIP_TYPES, PRIORITY_CONFIG } from '@/lib/utils/constants'
import { IMPORT_FIELDS } from '@/lib/leads/import-fields'

/**
 * Forma răspunsului JSON al POST /api/leads/import — tip partajat cu
 * front-end-ul (`src/app/(app)/leads/import/page.tsx` și componentele din
 * `src/components/leads/import/*`) ca ambele părți să rămână sincronizate.
 */
export interface ImportRowReport {
  rowNumber: number
  displayName: string
  status: 'imported' | 'skipped'
  skipReason?: string
  warnings: ImportIssue[]
}

export interface ImportApiResponse {
  totalRows: number
  imported: number
  skipped: number
  withWarnings: number
  /** Formatul de fișier detectat — 'model' = .xlsx-ul nostru, 'facebook' = exportul brut .csv/.xls din Facebook Lead Ads. */
  sourceFormat: 'model' | 'facebook'
  rows: ImportRowReport[]
}

export interface ImportIssue {
  field: string
  message: string
}

export interface ImportedLeadPayload {
  first_name: string | null
  last_name: string | null
  phone: string | null
  email: string | null
  destination: string | null
  travel_date_from: string | null
  travel_date_to: string | null
  nr_adults: number
  nr_children: number
  children_ages: string | null
  budget_range: string | null
  trip_type: string | null
  message: string | null
  priority: 'low' | 'medium' | 'high' | 'urgent'
  source: string
  source_detail: string | null
}

export interface ParsedImportRow {
  /** Numărul rândului din fișierul .xlsx (rândul 1 e antetul, deci primul rând de date e 2). */
  rowNumber: number
  /** Nume afișat în raport, chiar și pentru rânduri sărite. */
  displayName: string
  skipped: boolean
  skipReason?: string
  lead?: ImportedLeadPayload
  warnings: ImportIssue[]
}

export interface SourceOption {
  slug: string
  name: string
}

/** Normalizează text pentru comparații case/diacritice-insensitive (antete coloane, valori enum). */
export function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // scoate diacriticele
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

/**
 * Potrivește rândul de antet din fișier (array de string-uri) cu IMPORT_FIELDS,
 * după titlu (nu poziție) — admin-ul poate reordona/omite coloane.
 * Returnează map cheie → index coloană (sau -1 dacă lipsește).
 */
export function matchHeaders(headerRow: unknown[]): Record<string, number> {
  const normalizedHeaders = headerRow.map((h) => (h == null ? '' : normalize(String(h))))
  const result: Record<string, number> = {}
  for (const field of IMPORT_FIELDS) {
    const idx = normalizedHeaders.findIndex((h) => h === normalize(field.header))
    result[field.key] = idx
  }
  return result
}

/** Câte din coloanele așteptate au fost găsite — folosit ca să detectăm un fișier complet greșit. */
export function countMatchedHeaders(columnIndex: Record<string, number>): number {
  return Object.values(columnIndex).filter((idx) => idx >= 0).length
}

function cellAt(row: unknown[], columnIndex: Record<string, number>, key: string): unknown {
  const idx = columnIndex[key]
  if (idx == null || idx < 0) return undefined
  return row[idx]
}

function cellText(row: unknown[], columnIndex: Record<string, number>, key: string): string {
  const raw = cellAt(row, columnIndex, key)
  if (raw == null) return ''
  if (raw instanceof Date) return raw.toISOString()
  return String(raw).trim()
}

/** true dacă toate celulele rândului sunt goale — rând liber din fișier, sărit silențios. */
function isRowBlank(row: unknown[]): boolean {
  return row.every((cell) => cell == null || String(cell).trim() === '')
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Parsează o celulă „dată” — obiect Date (din Excel), sau text DD.MM.YYYY / DD/MM/YYYY / YYYY-MM-DD. */
function parseDateCell(raw: unknown): { iso: string | null; invalidText?: string } {
  if (raw == null || raw === '') return { iso: null }

  if (raw instanceof Date && !isNaN(raw.getTime())) {
    return { iso: raw.toISOString().slice(0, 10) }
  }

  // Serial Excel brut, dacă scapă neconvertit (epoca Excel: 1899-12-30)
  if (typeof raw === 'number' && isFinite(raw)) {
    const ms = (raw - 25569) * 86400 * 1000
    const d = new Date(ms)
    if (!isNaN(d.getTime())) return { iso: d.toISOString().slice(0, 10) }
  }

  const text = String(raw).trim()
  if (!text) return { iso: null }

  // YYYY-MM-DD
  let m = text.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) return { iso: `${m[1]}-${m[2]}-${m[3]}` }

  // DD.MM.YYYY sau DD/MM/YYYY sau DD-MM-YYYY
  m = text.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/)
  if (m) {
    const day = m[1].padStart(2, '0')
    const month = m[2].padStart(2, '0')
    if (Number(month) >= 1 && Number(month) <= 12 && Number(day) >= 1 && Number(day) <= 31) {
      return { iso: `${m[3]}-${month}-${day}` }
    }
  }

  return { iso: null, invalidText: text }
}

function parseIntCell(raw: unknown, fallback: number): { value: number; invalidText?: string } {
  if (raw == null || String(raw).trim() === '') return { value: fallback }
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim().replace(',', '.'))
  if (!isFinite(n) || !Number.isInteger(n) || n < 0) {
    return { value: fallback, invalidText: String(raw) }
  }
  return { value: n }
}

function matchTripType(raw: string): { value: string | null; unrecognized?: string } {
  if (!raw) return { value: null }
  const n = normalize(raw)
  const match = TRIP_TYPES.find((t) => normalize(t.value) === n || normalize(t.label) === n)
  return match ? { value: match.value } : { value: null, unrecognized: raw }
}

function matchPriority(raw: string): { value: 'low' | 'medium' | 'high' | 'urgent'; unrecognized?: string } {
  if (!raw) return { value: 'medium' }
  const n = normalize(raw)
  const entry = (Object.entries(PRIORITY_CONFIG) as [keyof typeof PRIORITY_CONFIG, { label: string }][])
    .find(([key, cfg]) => normalize(key) === n || normalize(cfg.label) === n)
  return entry ? { value: entry[0] } : { value: 'medium', unrecognized: raw }
}

function matchSource(raw: string, sources: SourceOption[], defaultSlug: string): { slug: string; unrecognized?: string } {
  if (!raw) return { slug: defaultSlug }
  const n = normalize(raw)
  const match = sources.find((s) => normalize(s.slug) === n || normalize(s.name) === n)
  return match ? { slug: match.slug } : { slug: defaultSlug, unrecognized: raw }
}

/**
 * Validează + mapează un singur rând de date (fără antet) la un payload de
 * insert în `leads`, sau la un motiv de „sărit” dacă nu are nicio
 * informație de identitate. Nu atinge baza de date — verificarea de
 * duplicate (telefon/email existent) se face separat, în API route, după
 * ce toate rândurile au fost parsate (are nevoie de un query în bloc).
 */
export function parseImportRow(
  row: unknown[],
  rowNumber: number,
  columnIndex: Record<string, number>,
  sources: SourceOption[],
  defaultSourceSlug: string
): ParsedImportRow | null {
  if (isRowBlank(row)) return null // rând liber — ignorat silențios, nu apare deloc în raport

  const warnings: ImportIssue[] = []

  const first_name = cellText(row, columnIndex, 'first_name') || null
  const last_name = cellText(row, columnIndex, 'last_name') || null
  const phoneRaw = cellText(row, columnIndex, 'phone')
  const emailRaw = cellText(row, columnIndex, 'email')

  const displayName = [first_name, last_name].filter(Boolean).join(' ') || phoneRaw || emailRaw || `Rând ${rowNumber}`

  if (!first_name && !last_name && !phoneRaw && !emailRaw) {
    return {
      rowNumber,
      displayName: `Rând ${rowNumber}`,
      skipped: true,
      skipReason: 'Niciun câmp de contact completat (Prenume, Nume, Telefon sau Email) — rândul nu a fost importat.',
      warnings: [],
    }
  }

  const phone: string | null = phoneRaw || null
  if (phone && !/\d/.test(phone)) {
    warnings.push({ field: 'Telefon', message: `„${phone}” nu conține nicio cifră — verifică manual.` })
  }

  let email: string | null = null
  if (emailRaw) {
    if (EMAIL_RE.test(emailRaw)) {
      email = emailRaw.toLowerCase()
    } else {
      warnings.push({ field: 'Email', message: `„${emailRaw}” nu e o adresă de email validă — a fost ignorat.` })
    }
  }

  const destination = cellText(row, columnIndex, 'destination') || null
  const budget_range = cellText(row, columnIndex, 'budget_range') || null
  const children_ages = cellText(row, columnIndex, 'children_ages') || null
  const message = cellText(row, columnIndex, 'message') || null
  const source_detail = cellText(row, columnIndex, 'source_detail') || null

  const tripTypeRaw = cellText(row, columnIndex, 'trip_type')
  const tripTypeMatch = matchTripType(tripTypeRaw)
  if (tripTypeMatch.unrecognized) {
    warnings.push({ field: 'Tip călătorie', message: `„${tripTypeMatch.unrecognized}” nu e o valoare recunoscută — a fost ignorat.` })
  }

  const priorityRaw = cellText(row, columnIndex, 'priority')
  const priorityMatch = matchPriority(priorityRaw)
  if (priorityMatch.unrecognized) {
    warnings.push({ field: 'Prioritate', message: `„${priorityMatch.unrecognized}” nu e o valoare recunoscută — s-a folosit „Mediu”.` })
  }

  const sourceRaw = cellText(row, columnIndex, 'source')
  const sourceMatch = matchSource(sourceRaw, sources, defaultSourceSlug)
  if (sourceMatch.unrecognized) {
    const defaultName = sources.find((s) => s.slug === defaultSourceSlug)?.name || defaultSourceSlug
    warnings.push({ field: 'Sursă', message: `„${sourceMatch.unrecognized}” nu e o sursă activă — s-a folosit sursa implicită „${defaultName}”.` })
  }

  const dateFromRaw = cellAt(row, columnIndex, 'travel_date_from')
  const dateFromParsed = parseDateCell(dateFromRaw)
  if (dateFromParsed.invalidText) {
    warnings.push({ field: 'Data plecare', message: `„${dateFromParsed.invalidText}” nu e o dată recunoscută — a fost ignorată.` })
  }

  const dateToRaw = cellAt(row, columnIndex, 'travel_date_to')
  const dateToParsed = parseDateCell(dateToRaw)
  if (dateToParsed.invalidText) {
    warnings.push({ field: 'Data întoarcere', message: `„${dateToParsed.invalidText}” nu e o dată recunoscută — a fost ignorată.` })
  }

  if (dateFromParsed.iso && dateToParsed.iso && dateToParsed.iso < dateFromParsed.iso) {
    warnings.push({ field: 'Perioadă', message: 'Data de întoarcere e înainte de data de plecare — verifică manual.' })
  }

  const adultsRaw = cellAt(row, columnIndex, 'nr_adults')
  const adultsParsed = parseIntCell(adultsRaw, 1)
  if (adultsParsed.invalidText) {
    warnings.push({ field: 'Nr. adulți', message: `„${adultsParsed.invalidText}” nu e un număr valid — s-a folosit 1.` })
  }

  const childrenRaw = cellAt(row, columnIndex, 'nr_children')
  const childrenParsed = parseIntCell(childrenRaw, 0)
  if (childrenParsed.invalidText) {
    warnings.push({ field: 'Nr. copii', message: `„${childrenParsed.invalidText}” nu e un număr valid — s-a folosit 0.` })
  }

  return {
    rowNumber,
    displayName,
    skipped: false,
    warnings,
    lead: {
      first_name,
      last_name,
      phone,
      email,
      destination,
      travel_date_from: dateFromParsed.iso,
      travel_date_to: dateToParsed.iso,
      nr_adults: adultsParsed.value || 1,
      nr_children: childrenParsed.value,
      children_ages,
      budget_range,
      trip_type: tripTypeMatch.value,
      message,
      priority: priorityMatch.value,
      source: sourceMatch.slug,
      source_detail,
    },
  }
}
