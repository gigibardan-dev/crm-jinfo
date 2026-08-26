/**
 * src/components/settings/LeadSourcesSection.tsx
 *
 * LeadSourcesSection
 *
 * Secțiunea „Surse Lead” din /settings — listă read-only a surselor
 * configurate în `lead_sources` (icon, nume, slug, activ/inactiv). Nu există
 * încă UI de generare/rotire webhook keys (vezi „De construit, nu urgent”
 * din claude/integrari-canale-status.md) — se face manual din SQL.
 * Extras din src/app/(app)/settings/page.tsx — comportament identic.
 */

'use client'

import { SourceIcon } from '@/components/leads/SourceIcon'
import type { LeadSource } from '@/lib/types/database'

interface LeadSourcesSectionProps {
  sources: LeadSource[]
}

export function LeadSourcesSection({ sources }: LeadSourcesSectionProps) {
  return (
    <section>
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">Surse Lead</h3>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        {sources.map((source, i) => (
          <div key={source.id}
            className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 ${i > 0 ? 'border-t border-slate-50 dark:border-slate-800' : ''}`}>
            <SourceIcon source={source.slug} size="md" />
            <span className="text-sm text-slate-700 dark:text-slate-300 flex-1 min-w-[6rem]">{source.name}</span>
            <span className="text-xs text-slate-400 font-mono">{source.slug}</span>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${source.is_active ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
          </div>
        ))}
      </div>
    </section>
  )
}
