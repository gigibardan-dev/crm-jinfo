/**
 * src/components/settings/PipelineStagesSection.tsx
 *
 * PipelineStagesSection
 *
 * Secțiunea „Pipeline Stages” din /settings — listă read-only a stage-urilor
 * configurate (culoare, nume, slug, flag terminal/implicit). Fără editare
 * încă (vezi notă „De construit” din claude/integrari-canale-status.md).
 * Extras din src/app/(app)/settings/page.tsx — comportament identic.
 */

'use client'

import type { PipelineStage } from '@/lib/types/database'

interface PipelineStagesSectionProps {
  stages: PipelineStage[]
}

export function PipelineStagesSection({ stages }: PipelineStagesSectionProps) {
  return (
    <section>
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">Pipeline Stages</h3>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        {stages.map((stage, i) => (
          <div key={stage.id}
            className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 ${i > 0 ? 'border-t border-slate-50 dark:border-slate-800' : ''}`}>
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color || '#94a3b8' }} />
            <span className="text-sm text-slate-700 dark:text-slate-300 flex-1 min-w-[6rem]">{stage.name}</span>
            <span className="text-xs text-slate-400 font-mono">{stage.slug}</span>
            {stage.is_terminal && (
              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded">terminal</span>
            )}
            {stage.is_default && (
              <span className="text-[10px] bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">implicit</span>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
