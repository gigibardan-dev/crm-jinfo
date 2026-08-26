/**
 * src/components/leads/new-lead/NewLeadFormTypes.ts
 *
 * Tipul formularului + clasa Tailwind comună pentru câmpurile din
 * /leads/new, partajate între cele 3 secțiuni (contact, sursă, cerere
 * călătorie) și pagina părinte.
 *
 * ⚠️ ÎNTREȚINERE: dacă adaugi/redenumești/ștergi un câmp aici, fă aceeași
 * modificare în `IMPORT_FIELDS` din `src/lib/leads/import-fields.ts` —
 * acela e modelul de coloane pentru importul în masă din Excel
 * (`/leads/import`) și ar trebui să rămână oglindit cu acest formular.
 */

export interface NewLeadFormData {
  first_name: string
  last_name: string
  phone: string
  email: string
  source: string
  source_detail: string
  destination: string
  travel_date_from: string
  travel_date_to: string
  nr_adults: number
  nr_children: number
  children_ages: string
  budget_range: string
  trip_type: string
  message: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
}

export const NEW_LEAD_INPUT_CLASS =
  "w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-400"
