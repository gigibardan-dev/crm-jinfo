/**
 * src/components/dashboard/StagnantLeadsWidget.tsx
 *
 * StagnantLeadsWidget
 *
 * Secțiunea „Lead-uri Stagnante / Necesită Atenție" din Dashboard — vezi
 * src/lib/utils/stagnantLeads.ts pt. definiția „stagnant" (nicio
 * interacțiune — comentariu sau schimbare de status — de peste
 * STAGNANT_THRESHOLD_HOURS, status ne-final).
 *
 * Scope pe rol — RLS face treaba automat, nu filtrăm nimic manual aici:
 * - Agent: `leads_select` RLS îi arată doar leadurile proprii, deci
 *   query-ul de mai jos întoarce direct doar lead-urile lui stagnante.
 * - Admin/Manager: RLS le arată toate leadurile — widget-ul devine practic
 *   „tabelul cu alertele la grămadă" cerut (lead + agent + timp), cu un
 *   toggle simplu de sortare (Timp / Agent).
 *
 * Fiecare rând e link direct la /leads/[id]. Realtime pe tabela `leads`:
 * trigger-ul din DB actualizează `last_interaction_at` la orice comentariu
 * nou/schimbare de status, ceea ce emite un UPDATE pe `leads` — widget-ul
 * reface fetch-ul și lead-ul rezolvat dispare instant din listă, fără
 * refresh de pagină.
 *
 * Footer-ul „Vezi toate în Pipeline" duce la /leads?stagnant=true — filtrul
 * „Doar stagnante" din PipelineFilterBar, care poate fi combinat cu
 * celelalte filtre (agent, status etc.) și oferă paginare pt. liste mai
 * lungi decât încape în widget-ul compact de aici.
 */

'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { AlertTriangle, ChevronRight, PartyPopper } from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { TERMINAL_STATUSES } from '@/lib/utils/constants'
import { getStagnantInfo, stagnantThresholdIso } from '@/lib/utils/stagnantLeads'
import { fullName } from '@/lib/utils'
import type { Lead } from '@/lib/types/database'

type StagnantRow = {
  lead: Pick<Lead, 'id' | 'first_name' | 'last_name' | 'destination' | 'status' | 'assigned_to' | 'last_interaction_at'>
  hours: number
  isCritical: boolean
  label: string
  agentName: string | null
}

type SortMode = 'time' | 'agent'

export function StagnantLeadsWidget() {
  const { profile, isAdminOrManager } = useAuth()
  const supabase = createClient()
  const [rows, setRows] = useState<StagnantRow[]>([])
  const [loading, setLoading] = useState(true)
  const [sortMode, setSortMode] = useState<SortMode>('time')

  const fetchStagnant = useCallback(async () => {
    const { data: leads } = await supabase
      .from('leads')
      .select('id, first_name, last_name, destination, status, assigned_to, last_interaction_at')
      .lt('last_interaction_at', stagnantThresholdIso())
      .not('status', 'in', `(${TERMINAL_STATUSES.join(',')})`)
      .order('last_interaction_at', { ascending: true }) // cel mai vechi (= cel mai urgent) primul

    let agentNames: Record<string, string> = {}
    const assignedIds = [...new Set((leads || []).map((l) => l.assigned_to).filter((id): id is string => !!id))]
    if (isAdminOrManager && assignedIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', assignedIds)
      agentNames = Object.fromEntries((profiles || []).map((p) => [p.id, p.full_name]))
    }

    const computed = (leads || [])
      .map((lead): StagnantRow | null => {
        const info = getStagnantInfo(lead.status, lead.last_interaction_at)
        if (!info) return null // status a devenit final între query și verificare, ignorăm
        return {
          lead,
          hours: info.hours,
          isCritical: info.isCritical,
          label: info.label,
          agentName: lead.assigned_to ? agentNames[lead.assigned_to] || null : null,
        }
      })
      .filter((r): r is StagnantRow => r !== null)

    setRows(computed)
    setLoading(false)
  }, [supabase, isAdminOrManager])

  useEffect(() => {
    if (!profile?.id) return
    fetchStagnant()

    const channel = supabase
      .channel('dashboard-stagnant-leads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchStagnant())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile?.id, supabase, fetchStagnant])

  const sortedRows = useMemo(() => {
    if (sortMode === 'agent') {
      return [...rows].sort((a, b) => (a.agentName || 'zzz').localeCompare(b.agentName || 'zzz', 'ro') || b.hours - a.hours)
    }
    return rows // deja sortate cronologic din query (cel mai vechi primul)
  }, [rows, sortMode])

  if (loading) {
    return (
      <div className="mt-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-40 mb-3" />
        <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded" />
      </div>
    )
  }

  return (
    <div className="mt-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <AlertTriangle size={14} />
          </div>
          <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">
            Lead-uri Stagnante
            {rows.length > 0 && <span className="text-slate-400 dark:text-slate-500 font-normal"> ({rows.length})</span>}
          </h3>
        </div>

        {isAdminOrManager && rows.length > 1 && (
          <div className="flex items-center gap-0.5 text-xs bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
            <button onClick={() => setSortMode('time')}
              className={`px-2.5 py-1 rounded-md transition-colors ${sortMode === 'time' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>
              Timp
            </button>
            <button onClick={() => setSortMode('agent')}
              className={`px-2.5 py-1 rounded-md transition-colors ${sortMode === 'agent' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>
              Agent
            </button>
          </div>
        )}
      </div>

      {sortedRows.length === 0 ? (
        <div className="px-5 py-6 flex items-center gap-2.5 text-sm text-slate-400 dark:text-slate-500">
          <PartyPopper size={16} className="shrink-0" />
          Niciun lead stagnant — toate au avut o interacțiune recentă.
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto">
          {sortedRows.map((row) => (
            <Link key={row.lead.id} href={`/leads/${row.lead.id}`}
              title={`Nicio interacțiune de ${row.label}. Actualizează statusul sau adaugă un comentariu.`}
              className="flex items-center gap-3 px-4 sm:px-5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group">
              <span className={`w-2 h-2 rounded-full shrink-0 ${row.isCritical ? 'bg-red-400' : 'bg-amber-400'}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-900 dark:text-slate-100 truncate">
                  {fullName(row.lead.first_name, row.lead.last_name) || 'Fără nume'}
                  {row.lead.destination && <span className="text-slate-400 dark:text-slate-500"> — {row.lead.destination}</span>}
                </p>
                {isAdminOrManager && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{row.agentName || 'Nealocat'}</p>
                )}
              </div>
              <span className={`text-xs font-medium shrink-0 ${row.isCritical ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                Inactiv de {row.label}
              </span>
              <ChevronRight size={14} className="text-slate-300 dark:text-slate-600 shrink-0 group-hover:text-slate-400 dark:group-hover:text-slate-500 transition-colors" />
            </Link>
          ))}
        </div>
      )}

      {rows.length > 0 && (
        <div className="px-4 sm:px-5 py-2.5 border-t border-slate-100 dark:border-slate-800">
          <Link href="/leads?stagnant=true" className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
            Vezi toate în Pipeline →
          </Link>
        </div>
      )}
    </div>
  )
}
