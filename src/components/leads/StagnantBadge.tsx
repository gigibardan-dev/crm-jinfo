/**
 * src/components/leads/StagnantBadge.tsx
 *
 * StagnantBadge
 *
 * Indicator vizual discret („Inactiv de X zile") pt. lead-urile fără nicio
 * interacțiune reală (comentariu/schimbare status) de peste
 * STAGNANT_THRESHOLD_HOURS — vezi src/lib/utils/stagnantLeads.ts. Randează
 * `null` când lead-ul nu e stagnant (status final, sau sub prag), deci se
 * poate folosi neconditionat din orice card/rând de lead. Galben sub
 * pragul critic, roșu peste (implicit 96h).
 *
 * Folosit din KanbanBoard, LeadsTable — deci apare atât pe Pipeline
 * (admin/manager) cât și pe lista de leaduri a unui agent.
 */

'use client'

import { AlertTriangle } from 'lucide-react'
import { getStagnantInfo } from '@/lib/utils/stagnantLeads'

interface StagnantBadgeProps {
  status: string
  lastInteractionAt: string | null | undefined
  size?: 'sm' | 'md'
  /** Clase suplimentare (ex: margine) — badge-ul nu randează nimic dacă lead-ul
   *  nu e stagnant, deci un wrapper separat în caller ar lăsa un `<div>` gol. */
  className?: string
}

export function StagnantBadge({ status, lastInteractionAt, size = 'sm', className = '' }: StagnantBadgeProps) {
  const info = getStagnantInfo(status, lastInteractionAt)
  if (!info) return null

  const colorClasses = info.isCritical
    ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950'
    : 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950'
  const sizeClasses = size === 'sm' ? 'text-[10px] px-1.5 py-0.5 gap-0.5' : 'text-xs px-2 py-1 gap-1'

  return (
    <span
      title={`Nicio interacțiune de ${info.label}. Actualizează statusul sau adaugă un comentariu.`}
      className={`inline-flex items-center rounded-full font-medium whitespace-nowrap ${colorClasses} ${sizeClasses} ${className}`}
    >
      <AlertTriangle size={size === 'sm' ? 9 : 11} className="shrink-0" />
      Inactiv de {info.label}
    </span>
  )
}
