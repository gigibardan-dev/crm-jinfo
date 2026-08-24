'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import type { Profile } from '@/lib/types/database'
import { getInitials } from '@/lib/utils'

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
        <div className="p-6 text-sm text-slate-500">Nu ai acces la această pagină.</div>
      </>
    )
  }

  function getWorkloadColor(active: number) {
    if (active <= 5) return 'bg-green-500'
    if (active <= 15) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <>
      <Header title="Agenți" />
      <div className="p-6">
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 animate-pulse h-36" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {agentStats.map((stat) => (
              <div key={stat.profile.id} className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-sm font-medium text-slate-600">
                    {getInitials(stat.profile.full_name)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{stat.profile.full_name}</p>
                    <p className="text-xs text-slate-400 capitalize">{stat.profile.role}</p>
                  </div>
                  <div className={`w-2.5 h-2.5 rounded-full ml-auto ${getWorkloadColor(stat.activeLeads)}`} />
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-lg font-semibold text-slate-900">{stat.activeLeads}</p>
                    <p className="text-[10px] text-slate-400 uppercase">Active</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-green-600">{stat.wonLeads}</p>
                    <p className="text-[10px] text-slate-400 uppercase">Câștigate</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-red-500">{stat.lostLeads}</p>
                    <p className="text-[10px] text-slate-400 uppercase">Pierdute</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
