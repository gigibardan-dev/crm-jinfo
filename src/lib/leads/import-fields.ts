/**
 * src/lib/leads/import-fields.ts
 *
 * IMPORT_FIELDS — sursa unică de adevăr pentru coloanele acceptate la
 * importul de leaduri din Excel (`/leads/import`, `src/app/api/leads/import/*`).
 *
 * E folosit în 3 locuri, ca să existe o singură listă de întreținut:
 * 1. Generarea modelului .xlsx de descărcat (antet + rând exemplu + foaia
 *    de instrucțiuni) — vezi `src/app/api/leads/import/template/route.ts`.
 * 2. Potrivirea coloanelor din fișierul încărcat de utilizator după titlu
 *    (nu după poziție — admin-ul poate reordona coloanele) — vezi
 *    `matchHeaders()` din `src/lib/leads/import-parse.ts`.
 * 3. Validarea fiecărui rând — `parseImportRow()` din același fișier.
 *
 * ⚠️ ÎNTREȚINERE: câmpurile de mai jos oglindesc formularul manual de
 * adăugare lead (`src/components/leads/new-lead/NewLeadFormTypes.ts` +
 * secțiunile din `src/components/leads/new-lead/*.tsx`). Dacă adaugi,
 * redenumești sau ștergi un câmp din formularul manual, fă aceeași
 * modificare și aici — restul sistemului de import (model, validare,
 * inserare) se adaptează automat, fără alte schimbări de cod.
 */

import { TRIP_TYPES, PRIORITY_CONFIG } from '@/lib/utils/constants'

export type ImportFieldKind =
  | 'text'
  | 'phone'
  | 'email'
  | 'date'
  | 'int'
  | 'priority'
  | 'tripType'
  | 'source'

export interface ImportFieldDef {
  /** Cheia din payload-ul de insert în `leads` (sau 'source' pentru sursa rândului). */
  key: string
  /** Titlul coloanei din modelul .xlsx — trebuie potrivit (case/diacritice-insensitive) la citire. */
  header: string
  /** Tipul de parsare/validare aplicat valorii celulei. */
  kind: ImportFieldKind
  /** Dacă lipsește complet fișierul nu poate fi procesat deloc (doar pentru identitate). */
  required?: boolean
  /** Valoare exemplu pusă pe rândul-model din fișierul de descărcat. */
  example: string | number
  /** Explicație scurtă pentru foaia „Instrucțiuni” din model și pentru legenda din pagină. */
  hint: string
}

export const IMPORT_FIELDS: ImportFieldDef[] = [
  { key: 'first_name', header: 'Prenume', kind: 'text', example: 'Ion',
    hint: 'Text liber. Cel puțin unul din Prenume / Nume / Telefon / Email trebuie completat.' },
  { key: 'last_name', header: 'Nume', kind: 'text', example: 'Popescu',
    hint: 'Text liber.' },
  { key: 'phone', header: 'Telefon', kind: 'phone', example: '0722123456',
    hint: 'Text liber (orice format) — nu e validat strict, doar semnalat dacă nu conține cifre.' },
  { key: 'email', header: 'Email', kind: 'email', example: 'ion.popescu@email.com',
    hint: 'Trebuie să fie o adresă validă (ex: nume@domeniu.ro) — altfel e ignorat, cu avertisment.' },
  { key: 'source', header: 'Sursă', kind: 'source', example: 'Recomandare',
    hint: 'Numele sau slug-ul unei surse active din Setări → Surse Lead (ex: Recomandare, Altele). Necompletat sau necunoscut → se folosește sursa implicită aleasă în pagina de import.' },
  { key: 'source_detail', header: 'Detalii sursă', kind: 'text', example: 'Recomandat de familia Ionescu',
    hint: 'Text liber, opțional.' },
  { key: 'destination', header: 'Destinație', kind: 'text', example: 'Grecia, Santorini',
    hint: 'Text liber, opțional.' },
  { key: 'trip_type', header: 'Tip călătorie', kind: 'tripType', example: 'Sejur',
    hint: `Una din valorile: ${TRIP_TYPES.map(t => t.label).join(', ')}. Altă valoare → ignorat, cu avertisment.` },
  { key: 'travel_date_from', header: 'Data plecare', kind: 'date', example: '15.09.2026',
    hint: 'Dată (celulă de tip dată în Excel, sau text DD.MM.YYYY / DD/MM/YYYY / YYYY-MM-DD).' },
  { key: 'travel_date_to', header: 'Data întoarcere', kind: 'date', example: '22.09.2026',
    hint: 'Aceleași formate ca „Data plecare”.' },
  { key: 'nr_adults', header: 'Nr. adulți', kind: 'int', example: 2,
    hint: 'Număr întreg ≥ 1. Necompletat sau invalid → implicit 1, cu avertisment dacă era completat greșit.' },
  { key: 'nr_children', header: 'Nr. copii', kind: 'int', example: 0,
    hint: 'Număr întreg ≥ 0. Necompletat sau invalid → implicit 0, cu avertisment dacă era completat greșit.' },
  { key: 'children_ages', header: 'Vârste copii', kind: 'text', example: '',
    hint: 'Text liber, opțional (ex: 4, 7).' },
  { key: 'budget_range', header: 'Buget estimat', kind: 'text', example: '2000-3000 EUR',
    hint: 'Text liber, opțional.' },
  { key: 'priority', header: 'Prioritate', kind: 'priority', example: 'Mediu',
    hint: `Una din valorile: ${Object.values(PRIORITY_CONFIG).map(p => p.label).join(', ')}. Necompletat sau necunoscut → implicit Mediu.` },
  { key: 'message', header: 'Mesaj / Note', kind: 'text', example: 'Preferă hotel 4-5 stele, all inclusive',
    hint: 'Text liber, opțional.' },
]
