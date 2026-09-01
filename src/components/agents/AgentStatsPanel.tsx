/**
 * src/components/agents/AgentStatsPanel.tsx
 *
 * AgentStatsPanel
 *
 * Coloana dreaptă din pagina de detaliu agent: cardul de statistici
 * (leaduri active, câștigate, fără succes, total, rată conversie) și cardul
 * de detalii cont (dată creare, status activ/inactiv). Pur prezentațională.
 * Extras din src/app/(app)/agents/[id]/page.tsx — comportament identic.
 */

'use client'

import { Calendar, TrendingUp, AlertTriangle, Clock } from 'lucide-react'
import type { Profile } from '@/lib/types/database'
import { formatDateTime } from '@/lib/utils'

export interface AgentStats {
  active: number
  won: number
  lost: number
  total: number
}

interface AgentStatsPanelProps {
  stats: AgentStats
  agent: Profile
}

export function AgentStatsPanel({ stats, agent }: AgentStatsPanelProps) {
  return (
    <>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
        <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-4">Statistici</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"><Clock size={15} /> Leaduri active</span>
            <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">{stats.active}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"><TrendingUp size={15} /> Câștigate</span>
            <span className="text-lg font-semibold text-green-600">{stats.won}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"><AlertTriangle size={15} /> Fără Succes</span>
            <span className="text-lg font-semibold text-red-500">{stats.lost}</span>
          </div>
          <div className="h-px bg-slate-100 dark:bg-slate-800" />
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"><Calendar size={15} /> Total leaduri</span>
            <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">{stats.total}</span>
          </div>
          {stats.total > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500 dark:text-slate-400">Rată conversie</span>
              <span className="text-lg font-semibold text-blue-600">{Math.round((stats.won / stats.total) * 100)}%</span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
        <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-3">Detalii cont</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">Creat</span>
            <span className="text-slate-700 dark:text-slate-300 text-xs">{formatDateTime(agent.created_at)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">Status</span>
            <span className={agent.is_active ? 'text-green-600' : 'text-slate-400'}>{agent.is_active ? 'Activ' : 'Inactiv'}</span>
          </div>
        </div>
      </div>
    </>
  )
}
