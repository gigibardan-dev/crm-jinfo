'use client'

/**
 * Pipeline Page — Vizualizare Kanban + List
 * 
 * Features:
 * - Kanban board cu coloane pe pipeline stages
 * - List view alternativ (tabel)
 * - Filtre: agent, sursă, prioritate, perioadă
 * - Won value modal la marcare câștigat
 * - Realtime updates via Supabase
 * - Toast feedback la schimbare status
 */

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import { SourceIcon } from '@/components/leads/SourceIcon'
import { PriorityBadge } from '@/components/leads/PriorityBadge'
import { StatusBadge } from '@/components/leads/StatusBadge'
import type { Lead, PipelineStage, Profile, LeadSource, Database } from '@/lib/types/database'
import { fullName, timeAgo } from '@/lib/utils'
import { Bell, List, Kanban, Filter, X, Trophy } from 'lucide-react'
import Link from 'next/link'

type ViewMode = 'kanban' | 'list'

export default function PipelinePage() {
  const { profile, isAdminOrManager } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()

  const [leads, setLeads] = useState<Lead[]>([])
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [agents, setAgents] = useState<Profile[]>([])
  const [sources, setSources] = useState<LeadSource[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('kanban')

  // --- Filters ---
  const [filterAgent, setFilterAgent] = useState<string>('all')
  const [filterSource, setFilterSource] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [filterDateFrom, setFilterDateFrom] = useState<string>('')
  const [filterDateTo, setFilterDateTo] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)

  // --- Won modal ---
  const [showWonModal, setShowWonModal] = useState(false)
  const [wonLeadId, setWonLeadId] = useState<string | null>(null)
  const [wonValue, setWonValue] = useState('')

  // --- Data fetching ---
  const fetchData = useCallback(async () => {
    setLoading(true)
    const [stagesRes, leadsRes, agentsRes, sourcesRes] = await Promise.all([
      supabase.from('pipeline_stages').select('*').order('display_order'),
      supabase.from('leads').select('*').order('created_at', { ascending: false }),
      isAdminOrManager
        ? supabase.from('profiles').select('*').in('role', ['agent', 'manager']).eq('is_active', true).order('full_name')
        : Promise.resolve({ data: [] as Profile[] }),
      supabase.from('lead_sources').select('*').eq('is_active', true).order('name'),
    ])
    setStages(stagesRes.data || [])
    setLeads(leadsRes.data || [])
    setAgents(agentsRes.data || [])
    setSources(sourcesRes.data || [])
    setLoading(false)
  }, [supabase, isAdminOrManager])

  useEffect(() => {
    if (!profile?.id) return
    fetchData()
  }, [profile?.id, fetchData])

  // --- Realtime subscription ---
  useEffect(() => {
    const channel = supabase
      .channel('leads-pipeline')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchData())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, fetchData])

  // --- Won modal handler ---
  async function handleWon() {
    if (!wonLeadId) return
    const lead = leads.find(l => l.id === wonLeadId)
    if (!lead) return

    const updates: Database['public']['Tables']['leads']['Update'] = {
      status: 'won',
      won_value: wonValue ? Number(wonValue) : null,
    }
    if (!lead.first_response_at) updates.first_response_at = new Date().toISOString()

    await supabase.from('leads').update(updates).eq('id', wonLeadId)
    await supabase.from('lead_activities').insert({
      lead_id: wonLeadId,
      user_id: profile!.id,
      type: 'status_change',
      content: wonValue ? `Valoare: ${wonValue} EUR` : null,
      metadata: { from_status: lead.status, to_status: 'won' },
    })

    toast({ title: 'Lead marcat ca câștigat', variant: 'success', description: wonValue ? `Valoare: ${wonValue} EUR` : undefined })
    setShowWonModal(false)
    setWonLeadId(null)
    setWonValue('')
    fetchData()
  }

  // --- Status change ---
  async function updateLeadStatus(leadId: string, newStatus: string) {
    const lead = leads.find((l) => l.id === leadId)
    if (!lead) return

    // Intercept "won" → show value modal
    if (newStatus === 'won') {
      setWonLeadId(leadId)
      setShowWonModal(true)
      return
    }

    await supabase.from('leads').update({ status: newStatus }).eq('id', leadId)
    await supabase.from('lead_activities').insert({
      lead_id: leadId, user_id: profile!.id, type: 'status_change',
      content: null, metadata: { from_status: lead.status, to_status: newStatus },
    })

    const stageName = stages.find(s => s.slug === newStatus)?.name || newStatus
    toast({ title: `Status schimbat: ${stageName}`, variant: 'info' })
  }

  // --- Filtering ---
  const filteredLeads = leads.filter((lead) => {
    if (filterAgent !== 'all' && lead.assigned_to !== filterAgent) return false
    if (filterSource !== 'all' && lead.source !== filterSource) return false
    if (filterPriority !== 'all' && lead.priority !== filterPriority) return false
    if (filterDateFrom && lead.created_at < filterDateFrom) return false
    if (filterDateTo && lead.created_at > filterDateTo + 'T23:59:59') return false
    return true
  })

  const hasActiveFilters = filterAgent !== 'all' || filterSource !== 'all' || filterPriority !== 'all' || filterDateFrom || filterDateTo

  function clearFilters() {
    setFilterAgent('all')
    setFilterSource('all')
    setFilterPriority('all')
    setFilterDateFrom('')
    setFilterDateTo('')
  }

  // Show won/lost in kanban, hide unqualified
  const visibleStages = stages.filter((s) => !s.is_terminal || s.slug === 'won' || s.slug === 'lost')

  function getLeadsForStage(slug: string) {
    return filteredLeads.filter((l) => l.status === slug)
  }

  const selectClass = "px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"

  // --- Loading ---
  if (loading) {
    return (
      <>
        <Header title="Pipeline" />
        <div className="p-6">
          <div className="flex gap-4 overflow-x-auto">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="w-72 flex-shrink-0 bg-slate-100 dark:bg-slate-800 rounded-xl p-3 animate-pulse h-96" />
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
          <div className="flex items-center gap-2">
            {/* Filter toggle */}
            <button onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border rounded-lg transition-colors ${
                hasActiveFilters
                  ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}>
              <Filter size={14} />
              Filtre
              {hasActiveFilters && (
                <button onClick={(e) => { e.stopPropagation(); clearFilters() }} className="ml-1 p-0.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900">
                  <X size={12} />
                </button>
              )}
            </button>
            <span className="text-sm text-slate-400">
              {filteredLeads.length} leaduri{hasActiveFilters ? ' (filtrate)' : ''}
            </span>
          </div>

          {/* View toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
            <button onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'kanban' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-400'}`}>
              <Kanban size={16} />
            </button>
            <button onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-400'}`}>
              <List size={16} />
            </button>
          </div>
        </div>

        {/* Filter bar */}
        {showFilters && (
          <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl">
            {isAdminOrManager && (
              <select value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)} className={selectClass}>
                <option value="all">Toți agenții</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
              </select>
            )}
            <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} className={selectClass}>
              <option value="all">Toate sursele</option>
              {sources.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
            </select>
            <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className={selectClass}>
              <option value="all">Orice prioritate</option>
              <option value="urgent">Urgent</option>
              <option value="high">Ridicat</option>
              <option value="medium">Mediu</option>
              <option value="low">Scăzut</option>
            </select>
            <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
              <span>De la</span>
              <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)}
                className="px-2 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <span>până la</span>
              <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)}
                className="px-2 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline">
                Resetează filtrele
              </button>
            )}
          </div>
        )}

        {/* ========== KANBAN VIEW ========== */}
        {viewMode === 'kanban' && (
          <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '70vh' }}>
            {visibleStages.map((stage) => {
              const stageLeads = getLeadsForStage(stage.slug)
              return (
                <div key={stage.id} className="w-72 flex-shrink-0 bg-slate-50 dark:bg-slate-900 rounded-xl flex flex-col border border-slate-100 dark:border-slate-800">
                  {/* Column header */}
                  <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100 dark:border-slate-800">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color || '#94a3b8' }} />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">{stage.name}</span>
                    <span className="text-xs text-slate-400 ml-auto">{stageLeads.length}</span>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {stageLeads.map((lead) => (
                      <Link key={lead.id} href={`/leads/${lead.id}`}
                        className="block bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm transition-all">
                        {/* Priority + Source */}
                        <div className="flex items-center justify-between mb-1.5">
                          <PriorityBadge priority={lead.priority} size="sm" />
                          <SourceIcon source={lead.source} size="sm" />
                        </div>
                        {/* Name */}
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                          {fullName(lead.first_name, lead.last_name)}
                        </p>
                        {/* Destination */}
                        {lead.destination && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{lead.destination}</p>
                        )}
                        {/* Bottom: time + reminder indicator */}
                        <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-400">
                          <span>{timeAgo(lead.last_activity_at || lead.created_at)}</span>
                          {lead.next_followup_at && (
                            <span className="flex items-center gap-0.5"><Bell size={10} /> Reminder</span>
                          )}
                        </div>
                      </Link>
                    ))}
                    {stageLeads.length === 0 && (
                      <div className="text-xs text-slate-300 dark:text-slate-600 text-center py-6">Niciun lead</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ========== LIST VIEW ========== */}
        {viewMode === 'list' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-left">
                  <th className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Nume</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Destinație</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Sursă</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Prioritate</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Activitate</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead) => {
                  const stage = stages.find((s) => s.slug === lead.status)
                  return (
                    <tr key={lead.id} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/leads/${lead.id}`} className="font-medium text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400">
                          {fullName(lead.first_name, lead.last_name)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{lead.destination || '—'}</td>
                      <td className="px-4 py-3"><SourceIcon source={lead.source} size="sm" /></td>
                      <td className="px-4 py-3"><StatusBadge name={stage?.name || lead.status} color={stage?.color} /></td>
                      <td className="px-4 py-3"><PriorityBadge priority={lead.priority} size="sm" /></td>
                      <td className="px-4 py-3 text-xs text-slate-400">{timeAgo(lead.last_activity_at || lead.created_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filteredLeads.length === 0 && (
              <div className="text-sm text-slate-400 text-center py-12">Niciun lead de afișat.</div>
            )}
          </div>
        )}
      </div>

      {/* ========== WON VALUE MODAL ========== */}
      {showWonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-sm p-6 mx-4 border border-slate-200 dark:border-slate-700">
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 flex items-center justify-center mx-auto mb-4">
              <Trophy size={24} />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 text-center mb-1">Lead câștigat</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-5">Introdu valoarea booking-ului (opțional).</p>
            <div className="mb-5">
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Valoare (EUR)</label>
              <input type="number" min={0} step={0.01} value={wonValue}
                onChange={(e) => setWonValue(e.target.value)} placeholder="ex: 2500" autoFocus
                className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => { setShowWonModal(false); setWonLeadId(null); setWonValue('') }}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                Anulează
              </button>
              <button onClick={handleWon}
                className="flex-1 px-4 py-2.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                Confirmă
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
