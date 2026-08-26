/**
 * src/lib/leads/google-sheets.ts
 *
 * Client minimal pentru Google Sheets API (v4), folosit DOAR pentru citire
 * (scop `spreadsheets.readonly`) — sincronizarea automată a leadurilor din
 * foaia de calcul conectată de Meta la formularele Facebook Lead Ads (vezi
 * `src/app/api/leads/sync/facebook-sheets/route.ts`).
 *
 * Autentificare: cont de service Google Cloud (JWT), NU OAuth interactiv —
 * potrivit pentru un job server-side care rulează fără utilizator prezent.
 * Contul de service trebuie adăugat ca „Viewer” pe foaia de calcul (Share →
 * emailul contului de service), altfel API-ul întoarce 403.
 *
 * Variabile de mediu necesare (vezi .env.example):
 * - GOOGLE_SERVICE_ACCOUNT_EMAIL
 * - GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY (cu \n literali dacă vine dintr-un
 *   .env cu o singură linie — sunt convertiți automat mai jos)
 * - GOOGLE_SHEETS_SPREADSHEET_ID (id-ul din URL-ul foii, ruta îl citește direct)
 *
 * Deliberat fără pachetul `googleapis` (mare, multe dependențe pentru doar
 * două apeluri de citire) — doar `google-auth-library` (autentificare JWT +
 * refresh token, oficial Google) + REST direct către Sheets API v4.
 */

import { JWT } from 'google-auth-library'

export class GoogleSheetsConfigError extends Error {}

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

let cachedClient: JWT | null = null

function getAuthClient(): JWT {
  if (cachedClient) return cachedClient

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY

  if (!email || !rawKey) {
    throw new GoogleSheetsConfigError(
      'Lipsesc credențialele Google (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) din configurare.'
    )
  }

  cachedClient = new JWT({
    email,
    key: rawKey.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
  return cachedClient
}

interface SpreadsheetMetaResponse {
  sheets?: { properties?: { title?: string; sheetId?: number } }[]
}

/** Titlurile tuturor filelor (tab-urilor) din foaia de calcul — inclusiv cele apărute automat la o campanie/formular nou. */
export async function listSheetTitles(spreadsheetId: string): Promise<string[]> {
  const client = getAuthClient()
  try {
    const res = await client.request<SpreadsheetMetaResponse>({
      url: `${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}`,
      params: { fields: 'sheets.properties.title' },
    })
    return (res.data.sheets || [])
      .map((s) => s.properties?.title)
      .filter((t): t is string => !!t)
  } catch (err) {
    throw wrapGoogleError(err, 'Nu am putut citi lista de file din Google Sheets.')
  }
}

interface ValuesBatchGetResponse {
  valueRanges?: { range: string; values?: string[][] }[]
}

/**
 * Citește toate rândurile (antet + date) din fiecare filă listată, într-un
 * singur apel (`batchGet`) — mai eficient decât un request per filă.
 * Întoarce map titlu filă → rânduri (fiecare rând = array de text).
 */
export async function getAllSheetsValues(
  spreadsheetId: string,
  sheetTitles: string[]
): Promise<Record<string, string[][]>> {
  if (sheetTitles.length === 0) return {}

  const client = getAuthClient()
  try {
    const res = await client.request<ValuesBatchGetResponse>({
      url: `${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}/values:batchGet`,
      params: {
        ranges: sheetTitles,
        majorDimension: 'ROWS',
        valueRenderOption: 'FORMATTED_VALUE',
      },
    })

    const result: Record<string, string[][]> = {}
    for (const vr of res.data.valueRanges || []) {
      // range vine ca "'Nume Filă'!A1:Z999" — extragem doar titlul, ca să potrivim cu sheetTitles
      const title = sheetTitles.find((t) => vr.range === t || vr.range.startsWith(`'${t}'`) || vr.range.startsWith(t))
      if (title) result[title] = (vr.values || []).map((row) => row.map((cell) => (cell == null ? '' : String(cell))))
    }
    return result
  } catch (err) {
    throw wrapGoogleError(err, 'Nu am putut citi datele din Google Sheets.')
  }
}

function wrapGoogleError(err: unknown, fallbackMessage: string): GoogleSheetsConfigError {
  const status = (err as { response?: { status?: number } })?.response?.status
  if (status === 403) {
    return new GoogleSheetsConfigError(
      'Acces respins (403) — contul de service Google nu are acces la foaia de calcul. Verifică ai partajat foaia (Share) cu emailul contului de service, ca Viewer.'
    )
  }
  if (status === 404) {
    return new GoogleSheetsConfigError('Foaia de calcul nu a fost găsită (404) — verifică GOOGLE_SHEETS_SPREADSHEET_ID.')
  }
  return new GoogleSheetsConfigError(`${fallbackMessage} (${err instanceof Error ? err.message : 'eroare necunoscută'})`)
}
