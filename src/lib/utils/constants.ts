/**
 * src/lib/utils/constants.ts
 *
 * App Constants
 *
 * Centralized config values used across the CRM.
 * Note: Source icons are now handled by SourceIcon component (src/components/leads/SourceIcon.tsx)
 * Note: Priority display is handled by PriorityBadge component (src/components/leads/PriorityBadge.tsx)
 */

// Lost reasons dropdown — shown when marking a lead as "lost"
export const LOST_REASONS = [
  'Preț prea mare',
  'A ales altă agenție',
  'A renunțat la călătorie',
  'Nu răspunde / Ghost',
  'Date indisponibile',
  'Destinație indisponibilă',
  'Cerințe imposibil de îndeplinit',
  'Altul',
] as const

// Trip types — used in lead forms
export const TRIP_TYPES = [
  { value: 'sejur', label: 'Sejur' },
  { value: 'circuit', label: 'Circuit' },
  { value: 'croaziera', label: 'Croazieră' },
  { value: 'city_break', label: 'City Break' },
  { value: 'all_inclusive', label: 'All Inclusive' },
  { value: 'excursie', label: 'Excursie' },
  { value: 'honeymoon', label: 'Lună de Miere' },
  { value: 'ski', label: 'Ski' },
  { value: 'other', label: 'Altul' },
] as const

// Luni — folosit de filtrul rapid „Lună întreagă" din Pipeline
// (PipelineFilterBar), ca alternativă la alegerea manuală „De la / până la".
export const MONTHS = [
  { value: '01', label: 'Ianuarie' },
  { value: '02', label: 'Februarie' },
  { value: '03', label: 'Martie' },
  { value: '04', label: 'Aprilie' },
  { value: '05', label: 'Mai' },
  { value: '06', label: 'Iunie' },
  { value: '07', label: 'Iulie' },
  { value: '08', label: 'August' },
  { value: '09', label: 'Septembrie' },
  { value: '10', label: 'Octombrie' },
  { value: '11', label: 'Noiembrie' },
  { value: '12', label: 'Decembrie' },
] as const

// Priority config — kept for backward compatibility, PriorityBadge handles display
export const PRIORITY_CONFIG = {
  low: { label: 'Scăzut', color: '#94a3b8', bgColor: '#f1f5f9' },
  medium: { label: 'Mediu', color: '#f59e0b', bgColor: '#fffbeb' },
  high: { label: 'Ridicat', color: '#ef4444', bgColor: '#fef2f2' },
  urgent: { label: 'Urgent', color: '#dc2626', bgColor: '#fee2e2' },
} as const

// Statusuri considerate „în lucru" — folosit pe Dashboard (card „În Lucru") și
// pe pagina Pipeline (filtrul de status „În lucru", pentru link-ul din Dashboard)
export const IN_PROGRESS_STATUSES = [
  'contacted', 'no_response', 'quote_sent', 'follow_up', 'quote_accepted', 'booking_pending', 'payment_received', 'confirmed',
] as const

// Statusuri finale (is_terminal=true în pipeline_stages) — excluse din
// verificarea de lead stagnant (un lead câștigat/pierdut/necalificat nu mai
// „stagnează", e închis). Hardcodat ca și restul statusurilor din cod
// (status === 'won'/'lost' apare deja peste tot ca literal), nu citit din
// DB, ca să nu mai facem un fetch suplimentar doar pt. atât.
export const TERMINAL_STATUSES = ['won', 'lost', 'unqualified'] as const

// Alerte lead-uri stagnante (follow-up reminders) — vezi
// src/lib/utils/stagnantLeads.ts. Prag „stagnant": nicio interacțiune
// (comentariu/schimbare status) de peste N ore. Prag „critic": culoare
// roșie în loc de galben, pt. lead-uri și mai vechi.
export const STAGNANT_THRESHOLD_HOURS = 48
export const STAGNANT_CRITICAL_HOURS = 96

// Date format constants
export const DATE_FORMAT = 'dd MMM yyyy'
export const DATETIME_FORMAT = 'dd MMM yyyy, HH:mm'
export const TIME_FORMAT = 'HH:mm'

// Shared Tailwind classes for compact form inputs (lead detail edit mode, reminder form, lead forms)
export const FORM_INPUT_CLASSES =
  "w-full px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"