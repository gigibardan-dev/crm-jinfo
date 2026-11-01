/**
 * src/components/leads/AiCallStatusBadge.tsx
 *
 * Badge pentru „Calificarea AI" (leads.ai_call_status / ai_calls.result).
 * Folosit în panoul de apeluri din pagina leadului și, ulterior, în listele
 * de leaduri / pagina Apeluri AI. Etichetele vin din lib/voice/classify.ts.
 */

import { Bot } from 'lucide-react'
import type { AiCallStatus } from '@/lib/types/database'
import { AI_CALL_STATUS_LABELS } from '@/lib/voice/classify'

const STATUS_STYLES: Record<AiCallStatus, string> = {
  queued: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
  in_progress: 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300',
  hot: 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300',
  interested: 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300',
  other_request: 'bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300',
  callback: 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300',
  not_interested: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
  no_answer: 'bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300',
  invalid: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
  failed: 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400',
}

export function AiCallStatusBadge({ status, showIcon = true }: { status: AiCallStatus | null; showIcon?: boolean }) {
  if (!status) return null
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded ${STATUS_STYLES[status]}`}>
      {showIcon && <Bot size={11} />}
      {AI_CALL_STATUS_LABELS[status]}
    </span>
  )
}
