/**
 * src/lib/utils/reports.ts
 *
 * Utilitare de agregare pt. secțiunea /reports — funcții pure, fără
 * dependențe de Supabase/React, care iau un array de lead-uri (deja
 * filtrate de interval/agent în pagină) și calculează KPI-uri, trend
 * în timp, distribuție pe etape de pipeline, performanță per agent/sursă
 * și motive de pierdere. Vezi src/app/(app)/reports/page.tsx pt. cum se
 * asamblează, și claude/rapoarte-plan.md (proiect Claude) pt. viziunea
 * completă / fazele viitoare.
 *
 * Convenție: toate ratele de conversie sunt won / (won + lost) — un lead
 * "unqualified" nu contează nici la numărător, nici la numitor (nu a fost
 * niciodată o oportunitate reală). `null` înseamnă "fără date" (0 lead-uri
 * închise în selecție), afișat ca „—” în UI, nu ca 0%.
 */

import { differenceInHours, differenceInCalendarDays, startOfDay, startOfWeek, startOfMonth, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, format } from 'date-fns'
import { ro } from 'date-fns/locale'
import type { Lead, Profile, LeadSource, PipelineStage } from '@/lib/types/database'
import { fullName } from '@/lib/utils'

// Subsetul de coloane din `leads` de care are nevoie pagina de rapoarte —
// vezi select-ul din reports/page.tsx, trebuie ținut în sincron.
export type ReportLead = Pick<Lead,
  | 'id' | 'first_name' | 'last_name' | 'email' | 'phone' | 'status' | 'priority' | 'source'
  | 'destination' | 'assigned_to' | 'created_at' | 'first_response_at'
  | 'won_value' | 'total_amount_ron' | 'commission_eur' | 'commission_ron' | 'lost_reason'
>

// ============================================
// KPI-uri sumar
// ============================================

export interface KPISet {
  totalLeads: number
  wonCount: number
  lostCount: number
  conversionRate: number | null
  wonValueEur: number
  avgFirstResponseHours: number | null
  unassignedCount: number
}

export function computeKPIs(leads: ReportLead[], unassignedCount: number): KPISet {
  const wonCount = leads.filter((l) => l.status === 'won').length
  const lostCount = leads.filter((l) => l.status === 'lost').length
  const closedCount = wonCount + lostCount
  const wonValueEur = leads
    .filter((l) => l.status === 'won')
    .reduce((sum, l) => sum + (l.won_value || 0), 0)
  const responded = leads.filter((l) => l.first_response_at)
  const avgFirstResponseHours = responded.length > 0
    ? responded.reduce((sum, l) => sum + differenceInHours(new Date(l.first_response_at!), new Date(l.created_at)), 0) / responded.length
    : null

  return {
    totalLeads: leads.length,
    wonCount,
    lostCount,
    conversionRate: closedCount > 0 ? wonCount / closedCount : null,
    wonValueEur,
    avgFirstResponseHours,
    unassignedCount,
  }
}

// ============================================
// Trend în timp (leaduri create per zi/săptămână/lună)
// ============================================

export interface TrendPoint {
  label: string
  count: number
}

type Granularity = 'day' | 'week' | 'month'

function bucketStart(date: Date, granularity: Granularity): Date {
  if (granularity === 'day') return startOfDay(date)
  if (granularity === 'week') return startOfWeek(date, { weekStartsOn: 1 })
  return startOfMonth(date)
}

/** Alege granularitatea automat, în funcție de lungimea intervalului selectat. */
function pickGranularity(spanDays: number): Granularity {
  if (spanDays <= 31) return 'day'
  if (spanDays <= 180) return 'week'
  return 'month'
}

export function computeTrend(leads: ReportLead[], from: Date, to: Date): TrendPoint[] {
  if (from > to) return []
  const spanDays = differenceInCalendarDays(to, from) + 1
  const granularity = pickGranularity(spanDays)

  const buckets = granularity === 'day'
    ? eachDayOfInterval({ start: from, end: to })
    : granularity === 'week'
      ? eachWeekOfInterval({ start: from, end: to }, { weekStartsOn: 1 })
      : eachMonthOfInterval({ start: from, end: to })

  const counts = new Map<number, number>()
  for (const lead of leads) {
    const key = bucketStart(new Date(lead.created_at), granularity).getTime()
    counts.set(key, (counts.get(key) || 0) + 1)
  }

  const fmt = granularity === 'day' ? 'dd MMM' : granularity === 'week' ? 'dd MMM' : 'MMM yyyy'
  return buckets.map((d) => {
    const key = bucketStart(d, granularity).getTime()
    return { label: format(d, fmt, { locale: ro }), count: counts.get(key) || 0 }
  })
}

// ============================================
// Distribuție pe etape de pipeline (status curent)
// ============================================

export interface FunnelPoint {
  slug: string
  name: string
  color: string | null
  count: number
}

export function computeFunnel(leads: ReportLead[], stages: PipelineStage[]): FunnelPoint[] {
  return stages
    .slice()
    .sort((a, b) => a.display_order - b.display_order)
    .map((stage) => ({
      slug: stage.slug,
      name: stage.name,
      color: stage.color,
      count: leads.filter((l) => l.status === stage.slug).length,
    }))
}

// ============================================
// Performanță per agent
// ============================================

export interface AgentPerf {
  agentId: string
  agentName: string
  total: number
  won: number
  lost: number
  conversionRate: number | null
  wonValueEur: number
  avgFirstResponseHours: number | null
}

export function computeAgentPerformance(leads: ReportLead[], agents: Pick<Profile, 'id' | 'full_name'>[]): AgentPerf[] {
  const byAgent = new Map<string, ReportLead[]>()
  for (const lead of leads) {
    if (!lead.assigned_to) continue
    const arr = byAgent.get(lead.assigned_to) || []
    arr.push(lead)
    byAgent.set(lead.assigned_to, arr)
  }

  const nameById = new Map(agents.map((a) => [a.id, a.full_name]))

  return Array.from(byAgent.entries())
    .map(([agentId, agentLeads]): AgentPerf => {
      const won = agentLeads.filter((l) => l.status === 'won').length
      const lost = agentLeads.filter((l) => l.status === 'lost').length
      const closed = won + lost
      const responded = agentLeads.filter((l) => l.first_response_at)
      return {
        agentId,
        agentName: nameById.get(agentId) || 'Agent șters',
        total: agentLeads.length,
        won,
        lost,
        conversionRate: closed > 0 ? won / closed : null,
        wonValueEur: agentLeads.filter((l) => l.status === 'won').reduce((s, l) => s + (l.won_value || 0), 0),
        avgFirstResponseHours: responded.length > 0
          ? responded.reduce((s, l) => s + differenceInHours(new Date(l.first_response_at!), new Date(l.created_at)), 0) / responded.length
          : null,
      }
    })
    .sort((a, b) => b.wonValueEur - a.wonValueEur || b.won - a.won || b.total - a.total)
}

// ============================================
// Performanță per sursă
// ============================================

export interface SourcePerf {
  sourceSlug: string
  sourceName: string
  total: number
  won: number
  lost: number
  conversionRate: number | null
}

export function computeSourcePerformance(leads: ReportLead[], sources: Pick<LeadSource, 'slug' | 'name'>[]): SourcePerf[] {
  const nameBySlug = new Map(sources.map((s) => [s.slug, s.name]))
  const bySource = new Map<string, ReportLead[]>()
  for (const lead of leads) {
    const arr = bySource.get(lead.source) || []
    arr.push(lead)
    bySource.set(lead.source, arr)
  }

  return Array.from(bySource.entries())
    .map(([slug, sourceLeads]): SourcePerf => {
      const won = sourceLeads.filter((l) => l.status === 'won').length
      const lost = sourceLeads.filter((l) => l.status === 'lost').length
      const closed = won + lost
      return {
        sourceSlug: slug,
        sourceName: nameBySlug.get(slug) || slug,
        total: sourceLeads.length,
        won,
        lost,
        conversionRate: closed > 0 ? won / closed : null,
      }
    })
    .sort((a, b) => b.total - a.total)
}

// ============================================
// Motive de pierdere
// ============================================

export interface LostReasonCount {
  reason: string
  count: number
}

export function computeLostReasons(leads: ReportLead[]): LostReasonCount[] {
  const counts = new Map<string, number>()
  for (const lead of leads) {
    if (lead.status !== 'lost') continue
    const reason = lead.lost_reason || 'Nespecificat'
    counts.set(reason, (counts.get(reason) || 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
}

// ============================================
// Formatare
// ============================================

export function formatPercent(ratio: number | null): string {
  if (ratio === null) return '—'
  return `${Math.round(ratio * 100)}%`
}

export function formatEur(value: number): string {
  return new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)
}

export function formatHoursDuration(hours: number | null): string {
  if (hours === null) return '—'
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`
  if (hours < 24) return `${hours.toFixed(1)} h`
  const days = Math.floor(hours / 24)
  const remHours = Math.round(hours % 24)
  return remHours > 0 ? `${days}z ${remHours}h` : `${days}z`
}

// ============================================
// Export CSV
// ============================================

function csvEscape(value: string): string {
  if (/[",\n;]/.test(value)) return '"' + value.replace(/"/g, '""') + '"'
  return value
}

export function leadsToCSV(
  leads: ReportLead[],
  agents: Pick<Profile, 'id' | 'full_name'>[],
  sources: Pick<LeadSource, 'slug' | 'name'>[]
): string {
  const nameById = new Map(agents.map((a) => [a.id, a.full_name]))
  const sourceNameBySlug = new Map(sources.map((s) => [s.slug, s.name]))

  const headers = ['Nume', 'Email', 'Telefon', 'Sursă', 'Destinație', 'Status', 'Prioritate', 'Agent', 'Creat la', 'Valoare câștigată (EUR)', 'Motiv pierdere']
  const rows = leads.map((l) => [
    fullName(l.first_name, l.last_name),
    l.email || '',
    l.phone || '',
    sourceNameBySlug.get(l.source) || l.source,
    l.destination || '',
    l.status,
    l.priority,
    l.assigned_to ? (nameById.get(l.assigned_to) || 'Agent șters') : 'Nealocat',
    format(new Date(l.created_at), 'dd.MM.yyyy HH:mm'),
    l.status === 'won' ? String(l.won_value ?? '') : '',
    l.lost_reason || '',
  ])

  const lines = [headers, ...rows].map((row) => row.map((cell) => csvEscape(String(cell))).join(';'))
  return lines.join('\n')
}

/** Declanșează descărcarea unui string CSV ca fișier — BOM UTF-8 pt. Excel/România. */
export function downloadCSV(filename: string, csv: string) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
