/**
 * src/lib/leads/import-facebook.ts
 *
 * Recunoaște și parsează exportul brut de leaduri din Meta/Facebook Lead
 * Ads (butonul „Download” din Meta Ads Manager → Leads Center), în cele
 * două formate pe care le oferă Meta:
 * - .csv — text UTF-16LE, separat prin TAB (nu virgulă!), cu BOM la
 *   început. Telefonul vine prefixat cu „p:” (ex: p:+40722123456).
 * - .xls — NU e un fișier Excel binar adevărat: e XML „SpreadsheetML”
 *   (formatul vechi Excel 2003) redenumit .xls de Meta.
 *
 * Rezultatul e normalizat la formatul „foaie generică” (antet + rânduri)
 * pe care îl consumă restul motorului de import — antetul generat aici
 * folosește exact titlurile din IMPORT_FIELDS, deci `matchHeaders()` +
 * `parseImportRow()` din `import-parse.ts` rămân neschimbate și se aplică
 * identic, indiferent dacă fișierul e modelul nostru .xlsx sau exportul
 * brut Facebook — o singură logică de validare/avertismente, o singură
 * sursă de adevăr pentru coloane.
 *
 * Nimic nu se pierde: coloanele din fișierul Facebook care nu au un
 * echivalent direct în IMPORT_FIELDS (întrebări custom din formular,
 * id-uri de reclamă/set/campanie/formular, is_organic, platform,
 * lead_status etc.) sunt păstrate integral, per rând, în `rawRecords` —
 * route-ul le atașează la `source_raw_data.facebook` la inserarea în DB,
 * ca arhivă completă și auditabilă a rândului original.
 *
 * Recunoașterea coloanelor standard e după alias (case-insensitive), nu
 * poziție, ca să reziste dacă Meta schimbă ordinea sau adaugă coloane noi
 * pe formulare viitoare — vezi FIELD_ALIASES mai jos.
 */

import { IMPORT_FIELDS } from '@/lib/leads/import-fields'

export interface FacebookParseResult {
  /** Antet „virtual”, identic cu titlurile din IMPORT_FIELDS — compatibil direct cu matchHeaders(). */
  headerRow: string[]
  /** Rânduri „virtuale”, mapate pe poziția coloanelor din headerRow — compatibile direct cu parseImportRow(). */
  dataRows: unknown[][]
  /** Rândul original din fișierul Facebook (antet original → valoare), un element per rând din dataRows, aceeași ordine. */
  rawRecords: Record<string, string>[]
}

export class FacebookFormatError extends Error {}

/** Coloanele standard din exportul Facebook — recunoscute după alias normalizat, indiferent de literă mare/mică. */
const FIELD_ALIASES: Record<string, string[]> = {
  id: ['id', 'lead_id'],
  created_time: ['created_time', 'createdtime', 'created_at'],
  ad_id: ['ad_id'],
  ad_name: ['ad_name'],
  adset_id: ['adset_id'],
  adset_name: ['adset_name'],
  campaign_id: ['campaign_id'],
  campaign_name: ['campaign_name'],
  form_id: ['form_id'],
  form_name: ['form_name'],
  is_organic: ['is_organic'],
  platform: ['platform'],
  full_name: ['full_name', 'fullname', 'name'],
  email: ['email', 'e_mail'],
  phone: ['phone', 'phone_number', 'phonenumber'],
  lead_status: ['lead_status', 'status'],
}

function normalizeHeaderKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function buildAliasLookup(): Record<string, string> {
  const lookup: Record<string, string> = {}
  for (const [canonical, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const alias of aliases) lookup[alias] = canonical
  }
  return lookup
}
const ALIAS_LOOKUP = buildAliasLookup()

// ---------- decodare fișier brut → rânduri de text ----------

/** Detectează encoding-ul după BOM (Meta trimite CSV-ul în UTF-16LE) și întoarce textul decodat, fără BOM. */
function decodeText(buffer: Buffer): string {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.subarray(2).toString('utf16le')
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    // UTF-16BE — Node n-are decoder direct pentru asta; inversăm manual perechile de bytes.
    const body = buffer.subarray(2)
    const swapped = Buffer.alloc(body.length)
    for (let i = 0; i + 1 < body.length; i += 2) {
      swapped[i] = body[i + 1]
      swapped[i + 1] = body[i]
    }
    return swapped.toString('utf16le')
  }
  let text = buffer.toString('utf8')
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1) // BOM UTF-8
  return text
}

/** Parser CSV/TSV generic — respectă câmpuri între ghilimele (`""` ca ghilimea literală), inclusiv linii noi în interior. */
function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue }
        inQuotes = false; i++; continue
      }
      field += ch; i++; continue
    }
    if (ch === '"') { inQuotes = true; i++; continue }
    if (ch === delimiter) { row.push(field); field = ''; i++; continue }
    if (ch === '\r') { i++; continue }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue }
    field += ch; i++
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row) }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === '')) // scoate liniile complet goale (ex: linia finală)
}

function parseCsv(buffer: Buffer): string[][] {
  const text = decodeText(buffer)
  const firstLineEnd = text.indexOf('\n')
  const firstLine = firstLineEnd >= 0 ? text.slice(0, firstLineEnd) : text
  const tabCount = (firstLine.match(/\t/g) || []).length
  const commaCount = (firstLine.match(/,/g) || []).length
  const delimiter = tabCount >= commaCount ? '\t' : ',' // Meta folosește TAB; comma rămâne fallback generic
  return parseDelimited(text, delimiter)
}

const XML_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
function decodeXmlEntities(text: string): string {
  return text.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g, (match, ent: string) => {
    if (ent[0] === '#') {
      const code = ent[1] === 'x' || ent[1] === 'X' ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10)
      return isFinite(code) ? String.fromCodePoint(code) : match
    }
    return XML_ENTITIES[ent] ?? match
  })
}

/** Parsează formatul XML „SpreadsheetML” (Excel 2003) în care Meta livrează exportul „.xls”. */
function parseSpreadsheetMlXls(buffer: Buffer): string[][] {
  const text = decodeText(buffer)
  const rows: string[][] = []
  const rowRe = /<Row[^>]*>([\s\S]*?)<\/Row>/g
  const cellRe = /<Cell[^>]*>([\s\S]*?)<\/Cell>/g
  const dataRe = /<Data[^>]*>([\s\S]*?)<\/Data>/
  let rowMatch: RegExpExecArray | null
  while ((rowMatch = rowRe.exec(text))) {
    const rowXml = rowMatch[1]
    const row: string[] = []
    cellRe.lastIndex = 0
    let cellMatch: RegExpExecArray | null
    while ((cellMatch = cellRe.exec(rowXml))) {
      const dataMatch = dataRe.exec(cellMatch[1])
      row.push(dataMatch ? decodeXmlEntities(dataMatch[1]) : '')
    }
    if (row.length > 0) rows.push(row)
  }
  return rows
}

// ---------- normalizare la foaia „virtuală” compatibilă cu restul pipeline-ului ----------

/**
 * Detectează formatul după extensie și întoarce foaia normalizată (antet cu
 * titlurile IMPORT_FIELDS + rânduri), gata de dat la `matchHeaders()` /
 * `parseImportRow()`, plus rândurile brute originale pentru arhivare.
 */
export function parseFacebookExport(buffer: Buffer, filename: string): FacebookParseResult {
  const lower = filename.toLowerCase()
  let rawRows: string[][]

  if (lower.endsWith('.csv')) {
    rawRows = parseCsv(buffer)
  } else if (lower.endsWith('.xls')) {
    const head = buffer.subarray(0, 512).toString('utf8').replace(/^\uFEFF/, '').trimStart()
    if (head.startsWith('<?xml') || head.startsWith('<Workbook')) {
      rawRows = parseSpreadsheetMlXls(buffer)
    } else {
      throw new FacebookFormatError(
        'Acest .xls pare un fișier Excel binar „adevărat”, nu exportul standard din Facebook Lead Ads — formatul ăsta nu e încă suportat. Din Meta, exportă din nou ca .csv, sau folosește modelul nostru .xlsx.'
      )
    }
  } else {
    throw new FacebookFormatError('Format de fișier nerecunoscut.')
  }

  if (rawRows.length < 2) {
    throw new FacebookFormatError('Fișierul nu conține rânduri de date sub antet.')
  }

  const [rawHeader, ...rawDataRows] = rawRows

  const canonicalIndex: Record<string, number> = {}
  rawHeader.forEach((h, i) => {
    const canonical = ALIAS_LOOKUP[normalizeHeaderKey(h)]
    if (canonical && canonicalIndex[canonical] === undefined) canonicalIndex[canonical] = i
  })

  const hasIdentity = ['full_name', 'email', 'phone'].some((k) => canonicalIndex[k] !== undefined)
  if (!hasIdentity) {
    throw new FacebookFormatError(
      'Fișierul nu pare exportul de leaduri Facebook — nu am găsit nicio coloană de nume, email sau telefon pe antet. Verifică fișierul sau folosește modelul nostru .xlsx.'
    )
  }

  const knownIndexes = new Set(Object.values(canonicalIndex))
  const extraColumns = rawHeader.map((h, i) => ({ h, i })).filter(({ i }) => !knownIndexes.has(i))

  const virtualHeader = IMPORT_FIELDS.map((f) => f.header)
  const fieldPos = Object.fromEntries(IMPORT_FIELDS.map((f, i) => [f.key, i])) as Record<string, number>

  const dataRows: unknown[][] = []
  const rawRecords: Record<string, string>[] = []

  for (const raw of rawDataRows) {
    if (raw.every((c) => (c ?? '').trim() === '')) continue // rând complet gol în fișierul Facebook — ignorat, ca la modelul propriu

    const get = (key: string): string => {
      const idx = canonicalIndex[key]
      return idx !== undefined ? (raw[idx] ?? '').trim() : ''
    }

    const fullName = get('full_name')
    const spaceIdx = fullName.indexOf(' ')
    const firstName = spaceIdx === -1 ? fullName : fullName.slice(0, spaceIdx)
    const lastName = spaceIdx === -1 ? '' : fullName.slice(spaceIdx + 1).trim()

    const phone = get('phone').replace(/^p:/i, '').trim()
    const campaign = get('campaign_name')
    const ad = get('ad_name')
    const form = get('form_name')

    const sourceDetail = [campaign && `Campanie: ${campaign}`, ad && ad !== campaign && `Reclamă: ${ad}`]
      .filter(Boolean)
      .join(' · ')

    // Orice coloană nerecunoscută = întrebare custom din formularul Facebook (ex: „Ce destinație vă interesează?”,
    // răspunsul liber al clientului) — nimic din ea nu se pierde, merge integral în „Mesaj / Note”.
    const customAnswers = extraColumns
      .map(({ h, i }) => ({ label: h, value: (raw[i] ?? '').trim() }))
      .filter(({ value }) => value !== '')
      .map(({ label, value }) => (/^\d+$/.test(label.trim()) ? value : `${label}: ${value}`))
    const message = customAnswers.join('\n')

    const virtualRow: unknown[] = new Array(virtualHeader.length).fill('')
    virtualRow[fieldPos.first_name] = firstName
    virtualRow[fieldPos.last_name] = lastName
    virtualRow[fieldPos.phone] = phone
    virtualRow[fieldPos.email] = get('email')
    virtualRow[fieldPos.source] = 'Facebook Ads'
    virtualRow[fieldPos.source_detail] = sourceDetail
    virtualRow[fieldPos.destination] = form
    virtualRow[fieldPos.message] = message
    dataRows.push(virtualRow)

    const rawRecord: Record<string, string> = {}
    rawHeader.forEach((h, i) => { rawRecord[h] = raw[i] ?? '' })
    rawRecords.push(rawRecord)
  }

  return { headerRow: virtualHeader, dataRows, rawRecords }
}
