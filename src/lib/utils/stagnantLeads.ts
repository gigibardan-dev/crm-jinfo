/**
 * src/lib/utils/stagnantLeads.ts
 *
 * Alerte pentru lead-uri stagnante (follow-up reminders)
 *
 * Un lead e „stagnant" când nu a avut nicio interacțiune reală
 * (comentariu SAU schimbare de status — vezi `leads.last_interaction_at`,
 * întreținut automat de un trigger, migrarea 004_stagnant_lead_alerts.sql)
 * de mai mult de STAGNANT_THRESHOLD_HOURS, ȘI statusul lui nu e final
 * (won/lost/unqualified — un lead închis nu mai „stagnează").
 *
 * Alerta dispare automat: de îndată ce agentul adaugă un comentariu sau
 * schimbă statusul, trigger-ul din DB actualizează `last_interaction_at`,
 * deci `getStagnantInfo()` nu mai întoarce nimic pt. lead-ul respectiv la
 * următorul fetch — nu există niciun flag separat de „resetat manual".
 *
 * Folosit din StagnantBadge (indicator pe card Kanban / rând tabel) și din
 * StagnantLeadsWidget (secțiunea dedicată din Dashboard).
 */

import { formatDistanceToNow } from 'date-fns'
import { ro } from 'date-fns/locale'
import { TERMINAL_STATUSES, STAGNANT_THRESHOLD_HOURS, STAGNANT_CRITICAL_HOURS } from '@/lib/utils/constants'

export interface StagnantInfo {
  /** Ore de la ultima interacțiune reală. */
  hours: number
  /** Peste pragul critic (implicit 96h) — indicator roșu în loc de galben. */
  isCritical: boolean
  /** Durată lizibilă în română, ex: "3 zile", "5 ore" — pt. „Inactiv de {label}". */
  label: string
}

/** null = nu e stagnant (status final, sau sub prag) sau nu avem încă data (lead fără last_interaction_at). */
export function getStagnantInfo(status: string, lastInteractionAt: string | null | undefined): StagnantInfo | null {
  if (!lastInteractionAt) return null
  if ((TERMINAL_STATUSES as readonly string[]).includes(status)) return null

  const hours = (Date.now() - new Date(lastInteractionAt).getTime()) / 3_600_000
  if (hours < STAGNANT_THRESHOLD_HOURS) return null

  return {
    hours,
    isCritical: hours >= STAGNANT_CRITICAL_HOURS,
    label: formatDistanceToNow(new Date(lastInteractionAt), { locale: ro }),
  }
}

/** Pragul ca ISO string — util pt. filtrarea `.lt('last_interaction_at', ...)` direct în query-ul Supabase. */
export function stagnantThresholdIso(): string {
  return new Date(Date.now() - STAGNANT_THRESHOLD_HOURS * 3_600_000).toISOString()
}

export interface InteractionAge {
  /** Ore de la ultima interacțiune reală. */
  hours: number
  /** Durată lizibilă în română, ex: "3 zile", "5 ore". */
  label: string
}

/**
 * Vârsta interacțiunii, NECONDIȚIONATĂ de pragul de stagnare (spre
 * deosebire de getStagnantInfo, care întoarce null sub prag) — folosită de
 * digestul zilnic (src/lib/email/digest.ts) ca să arate „de cât timp" pe
 * FIECARE lead activ dintr-o listă completă, nu doar pe cele stagnante.
 */
export function getInteractionAge(lastInteractionAt: string): InteractionAge {
  const hours = (Date.now() - new Date(lastInteractionAt).getTime()) / 3_600_000
  return { hours, label: formatDistanceToNow(new Date(lastInteractionAt), { locale: ro }) }
}
