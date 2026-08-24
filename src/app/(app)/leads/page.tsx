'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import type { Lead, PipelineStage, Profile } from '@/lib/types/database'
import { fullName, timeAgo } from '@/lib/utils'
import { SOURCE_ICONS, PRIORITY_CONFIG } from '@/lib/utils/constants'
import { MessageSquare, Bell, List, Kanban } from 'lucide-react'
import Link from 'next/link'

type ViewMode = 'kanban' | 'list'

export default function PipelinePage() {
  const { profile, isAdminOrManager } = useAuth()
  const [leads, setLeads] = useState<Lead[]>([])
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [agents, setAgents] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('kanban')
  const [filterAgent, setFilterAgent] = useState<string>('all')
  const supabase = createClient()

  const fetchData = useCallback(async () => {
    setLoading(true)

    const [stagesRes, leadsRes, agentsRes] = await Promise.all([
      supabase.from('pipeline_stages').select('*').order('display_order'),
      supabase.from('leads').select('*').order('created_at', { ascending: false }),
      isAdminOrManager
        ? supabase.from('profiles').select('*').in('role', ['agent', 'manager']).eq('is_active', true).order('full_name')
        : Promise.resolve({ data: [] }),
    ])

    setStages(stagesRes.data || [])
    setLeads(leadsRes.data || [])
    setAgents(agentsRes.data || [])
    setLoading(false)
  }, [supabase, isAdminOrManager])

  useEffect(() => {
    if (!profile?.id) return
    fetchData()
  }, [profile?.id, fetchData])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('leads-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        fetchData()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, fetchData])

  async function updateLeadStatus(leadId: string, newStatus: string) {
    const lead = leads.find((l) => l.id === leadId)
    if (!lead) return

    await supabase
      .from('leads')
      .update({ status: newStatus })
      .eq('id', leadId)

    await supabase.from('lead_activities').insert({
      lead_id: leadId,
      user_id: profile!.id,
      type: 'status_change',
      content: `Status schimbat`,
      metadata: { from_status: lead.status, to_status: newStatus },
    })
  }

  // Filter leads
  const filteredLeads = leads.filter((lead) => {
    if (filterAgent !== 'all' && lead.assigned_to !== filterAgent) return false
    return true
  })

  // Non-terminal stages for kanban display
  const visibleStages = stages.filter((s) => !s.is_terminal || s.slug === 'won' || s.slug === 'lost')

  function getLeadsForStage(slug: string) {
    return filteredLeads.filter((l) => l.status === slug)
  }

  if (loading) {
    return (
      <>
        <Header title="Pipeline" />
        <div className="p-6">
          <div className="flex gap-4 overflow-x-auto">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="w-72 flex-shrink-0 bg-slate-100 rounded-xl p-3 animate-pulse h-96" />
            ))}
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Header title="Pipeline" />
      <div className="p-6">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Agent filter - admin/manager only */}
            {isAdminOrManager && agents.length > 0 && (
              <select
                value={filterAgent}
                onChange={(e) => setFilterAgent(e.target.value)}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Toți agenții</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.full_name}</option>
                ))}
              </select>
            )}
            <span className="text-sm text-slate-400">
              {filteredLeads.length} leaduri
            </span>
          </div>

          {/* View toggle */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'kanban' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'
              }`}
            >
              <Kanban size={16} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'
              }`}
            >
              <List size={16} />
            </button>
          </div>
        </div>

        {/* Kanban View */}
        {viewMode === 'kanban' && (
          <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '70vh' }}>
            {visibleStages.map((stage) => {
              const stageLeads = getLeadsForStage(stage.slug)
              return (
                <div
                  key={stage.id}
                  className="w-72 flex-shrink-0 bg-slate-50 rounded-xl flex flex-col"
                >
                  {/* Column header */}
                  <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: stage.color || '#94a3b8' }}
                    />
                    <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                      {stage.name}
                    </span>
                    <span className="text-xs text-slate-400 ml-auto">
                      {stageLeads.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {stageLeads.map((lead) => (
                      <Link
                        key={lead.id}
                        href={`/leads/${lead.id}`}
                        className="block bg-white rounded-lg border border-slate-200 p-3
                                   hover:border-slate-300 hover:shadow-sm transition-all"
                      >
                        {/* Top row: priority + source */}
                        <div className="flex items-center justify-between mb-1.5">
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded font-medium uppercase"
                            style={{
                              color: PRIORITY_CONFIG[lead.priority]?.color,
                              backgroundColor: PRIORITY_CONFIG[lead.priority]?.bgColor,
                            }}
                          >
                            {PRIORITY_CONFIG[lead.priority]?.label}
                          </span>
                          <span className="text-xs text-slate-400">
                            {SOURCE_ICONS[lead.source] || '📌'}
                          </span>
                        </div>

                        {/* Name */}
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {fullName(lead.first_name, lead.last_name)}
                        </p>

                        {/* Destination */}
                        {lead.destination && (
                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            {lead.destination}
                          </p>
                        )}

                        {/* Bottom row */}
                        <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-400">
                          <span>{timeAgo(lead.last_activity_at || lead.created_at)}</span>
                          {lead.next_followup_at && (
                            <span className="flex items-center gap-0.5">
                              <Bell size={10} /> Reminder
                            </span>
                          )}
                        </div>
                      </Link>
                    ))}

                    {stageLeads.length === 0 && (
                      <div className="text-xs text-slate-300 text-center py-6">
                        Niciun lead
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* List View */}
        {viewMode === 'list' && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left">
                  <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase">Nume</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase">Destinație</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase">Sursă</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase">Prioritate</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase">Activitate</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead) => {
                  const stage = stages.find((s) => s.slug === lead.status)
                  return (
                    <tr key={lead.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/leads/${lead.id}`} className="font-medium text-slate-900 hover:text-blue-600">
                          {fullName(lead.first_name, lead.last_name)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{lead.destination || '—'}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {SOURCE_ICONS[lead.source]} {lead.source}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{
                            color: stage?.color || '#64748b',
                            backgroundColor: (stage?.color || '#64748b') + '18',
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: stage?.color }} />
                          {stage?.name || lead.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="text-xs font-medium"
                          style={{ color: PRIORITY_CONFIG[lead.priority]?.color }}
                        >
                          {PRIORITY_CONFIG[lead.priority]?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {timeAgo(lead.last_activity_at || lead.created_at)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {filteredLeads.length === 0 && (
              <div className="text-sm text-slate-400 text-center py-12">
                Niciun lead de afișat.
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
