/**
 * src/components/leads/new-lead/TravelRequestSection.tsx
 *
 * TravelRequestSection
 *
 * Secțiunea „Cerere Călătorie” din formularul /leads/new — destinație, tip
 * călătorie, interval de date, nr. adulți/copii (+ vârste copii dacă
 * nr_children > 0), buget estimat, prioritate.
 * Extras din src/app/(app)/leads/new/page.tsx — comportament identic,
 * inclusiv tipul de update generic (`string | number`) folosit deja în
 * pagina originală pentru câmpurile numerice.
 */

'use client'

import { TRIP_TYPES } from '@/lib/utils/constants'
import { NEW_LEAD_INPUT_CLASS, type NewLeadFormData } from './NewLeadFormTypes'

type TravelField = 'destination' | 'trip_type' | 'travel_date_from' | 'travel_date_to' | 'nr_adults' | 'nr_children' | 'children_ages' | 'budget_range' | 'priority'

interface TravelRequestSectionProps {
  form: Pick<NewLeadFormData, TravelField>
  onChange: (field: TravelField, value: string | number) => void
}

export function TravelRequestSection({ form, onChange }: TravelRequestSectionProps) {
  return (
    <section>
      <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-3">Cerere Călătorie</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Destinație</label>
          <input type="text" value={form.destination} onChange={(e) => onChange('destination', e.target.value)} className={NEW_LEAD_INPUT_CLASS} placeholder="Grecia, Santorini" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Tip călătorie</label>
          <select value={form.trip_type} onChange={(e) => onChange('trip_type', e.target.value)} className={NEW_LEAD_INPUT_CLASS + ' bg-white dark:bg-slate-800'}>
            <option value="">— selectează —</option>
            {TRIP_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Data plecare</label>
          <input type="date" value={form.travel_date_from} onChange={(e) => onChange('travel_date_from', e.target.value)} className={NEW_LEAD_INPUT_CLASS} />
        </div>
        <div>
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Data întoarcere</label>
          <input type="date" value={form.travel_date_to} onChange={(e) => onChange('travel_date_to', e.target.value)} className={NEW_LEAD_INPUT_CLASS} />
        </div>
        <div>
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Nr. adulți</label>
          <input type="number" min={1} max={20} value={form.nr_adults} onChange={(e) => onChange('nr_adults', e.target.value)} className={NEW_LEAD_INPUT_CLASS} />
        </div>
        <div>
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Nr. copii</label>
          <input type="number" min={0} max={10} value={form.nr_children} onChange={(e) => onChange('nr_children', e.target.value)} className={NEW_LEAD_INPUT_CLASS} />
        </div>
        {Number(form.nr_children) > 0 && (
          <div className="sm:col-span-2">
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Vârste copii</label>
            <input type="text" value={form.children_ages} onChange={(e) => onChange('children_ages', e.target.value)} className={NEW_LEAD_INPUT_CLASS} placeholder="ex: 4, 7" />
          </div>
        )}
        <div>
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Buget estimat</label>
          <input type="text" value={form.budget_range} onChange={(e) => onChange('budget_range', e.target.value)} className={NEW_LEAD_INPUT_CLASS} placeholder="2000-3000 EUR" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Prioritate</label>
          <select value={form.priority} onChange={(e) => onChange('priority', e.target.value)} className={NEW_LEAD_INPUT_CLASS + ' bg-white dark:bg-slate-800'}>
            <option value="low">Scăzut</option>
            <option value="medium">Mediu</option>
            <option value="high">Ridicat</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </div>
    </section>
  )
}
