'use client'

/**
 * src/app/(app)/agents/page.tsx
 *
 * Agents List Page — Admin/Manager only
 *
 * Grid de carduri, unul per agent/manager activ, cu inițiale, rol,
 * indicator de încărcare (verde/galben/roșu după nr. leaduri active) și
 * mini-statistici (active/câștigate/fără succes). Click → /agents/[id].
 */

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import type { Profile } from '@/lib/types/database'
import { getInitials } from '@/lib/utils'
import { TrendingUp, AlertTriangle, Clock, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { OnlineAgentsCard } from '@/components/agents/OnlineAgentsCard'

interface AgentStats {
  profile: Profile
  activeLeads: number
  wonLeads: number
  lostLeads: number
}

export default function AgentsPage() {
  const { isAdminOrManager } = useAuth()
  const [agentStats, setAgentStats] = useState<AgentStats[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!isAdminOrManager) return

    async function fetch() {
      const { data: agents } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['agent', 'manager'])
        .eq('is_active', true)
        .order('full_name')

      if (!agents) { setLoading(false); return }

      const stats: AgentStats[] = await Promise.all(
        agents.map(async (agent) => {
          const [active, won, lost] = await Promise.all([
            supabase.from('leads').select('*', { count: 'exact', head: true })
              .eq('assigned_to', agent.id).not('status', 'in', '("won","lost","unqualified")'),
            supabase.from('leads').select('*', { count: 'exact', head: true })
              .eq('assigned_to', agent.id).eq('status', 'won'),
            supabase.from('leads').select('*', { count: 'exact', head: true })
              .eq('assigned_to', agent.id).eq('status', 'lost'),
          ])
          return {
            profile: agent,
            activeLeads: active.count || 0,
            wonLeads: won.count || 0,
            lostLeads: lost.count || 0,
          }
        })
      )

      setAgentStats(stats)
      setLoading(false)
    }

    fetch()
  }, [supabase, isAdminOrManager])

  if (!isAdminOrManager) {
    return (
      <>
        <Header title="Agenți" />
        <div className="p-4 sm:p-6 text-sm text-slate-500 dark:text-slate-400">Nu ai acces la această pagină.</div>
      </>
    )
  }

  function getWorkloadColor(active: number) {
    if (active <= 5) return 'bg-green-500'
    if (active <= 15) return 'bg-amber-500'
    return 'bg-red-500'
  }

  return (
    <>
      <Header title="Agenți" />
      <div className="p-4 sm:p-6">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 animate-pulse h-36" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {agentStats.map((stat) => (
              <Link
                key={stat.profile.id}
                href={`/agents/${stat.profile.id}`}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm transition-all group"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-sm font-medium text-blue-700 dark:text-blue-300">
                    {getInitials(stat.profile.full_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{stat.profile.full_name}</p>
                    <p className="text-xs text-slate-400 capitalize">{stat.profile.role}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${getWorkloadColor(stat.activeLeads)}`} />
                    <ChevronRight size={16} className="text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 transition-colors" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-2 rounded-lg bg-slate-50 dark:bg-slate-800">
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                      <Clock size={12} className="text-slate-400" />
                    </div>
                    <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{stat.activeLeads}</p>
                    <p className="text-[10px] text-slate-400 uppercase">Active</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-green-50 dark:bg-green-950">
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                      <TrendingUp size={12} className="text-green-500" />
                    </div>
                    <p className="text-lg font-semibold text-green-600">{stat.wonLeads}</p>
                    <p className="text-[10px] text-slate-400 uppercase">Câștigate</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-red-50 dark:bg-red-950">
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                      <AlertTriangle size={12} className="text-red-500" />
                    </div>
                    <p className="text-lg font-semibold text-red-500">{stat.lostLeads}</p>
                    <p className="text-[10px] text-slate-400 uppercase">Fără Succes</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-8">
          <OnlineAgentsCard />
        </div>
      </div>
    </>
  )
}
