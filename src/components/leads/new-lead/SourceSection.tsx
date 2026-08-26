/**
 * src/components/leads/new-lead/SourceSection.tsx
 *
 * SourceSection
 *
 * Secțiunea „Sursă” din formularul /leads/new — dropdown cu sursele active
 * (`lead_sources`, încărcate de pagina părinte) + câmp liber „Detalii sursă”.
 * Extras din src/app/(app)/leads/new/page.tsx — comportament identic.
 */

'use client'

import type { LeadSource } from '@/lib/types/database'
import { NEW_LEAD_INPUT_CLASS } from './NewLeadFormTypes'

interface SourceSectionProps {
  sources: LeadSource[]
  source: string
  sourceDetail: string
  onChange: (field: 'source' | 'source_detail', value: string) => void
}

export function SourceSection({ sources, source, sourceDetail, onChange }: SourceSectionProps) {
  return (
    <section>
      <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-3">Sursă</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Sursă lead</label>
          <select value={source} onChange={(e) => onChange('source', e.target.value)} className={NEW_LEAD_INPUT_CLASS + ' bg-white dark:bg-slate-800'}>
            {sources.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Detalii sursă</label>
          <input type="text" value={sourceDetail} onChange={(e) => onChange('source_detail', e.target.value)} className={NEW_LEAD_INPUT_CLASS} placeholder="ex: Campanie Grecia 2026" />
        </div>
      </div>
    </section>
  )
}
