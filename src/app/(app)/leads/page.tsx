/**
 * src/app/(app)/leads/page.tsx
 *
 * Pipeline Page — Kanban + List cu paginație
 *
 * Owner de state (leaduri, filtre, paginație, realtime) pentru pagina
 * Pipeline. Markup-ul e delegat unor componente din
 * src/components/leads/pipeline/*, fișierul rămâne axat pe date/filtrare.
 *
 * Kanban: afișează toate leadurile (scroll per coloană)
 * List: paginat la 25/50/100 per pagină
 * Filtre: agent, sursă, prioritate, perioadă
 * Won value modal la marcare câștigat
 */

'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import type { Lead, PipelineStage, Profile, LeadSource, Database } from '@/lib/types/database'
import { PipelineToolbar, type PipelineViewMode } from '@/components/leads/pipeline/PipelineToolbar'
import { PipelineFilterBar } from '@/components/leads/pipeline/PipelineFilterBar'
import { KanbanBoard } from '@/components/leads/pipeline/KanbanBoard'
import { LeadsListView } from '@/components/leads/pipeline/LeadsListView'
import { PipelineWonModal } from '@/components/leads/pipeline/PipelineWonModal'

export default function PipelinePage() {
  const { profile, isAdminOrManager } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()

  const [leads, setLeads] = useState<Lead[]>([])
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [agents, setAgents] = useState<Profile[]>([])
  const [sources, setSources] = useState<LeadSource[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<PipelineViewMode>('kanban')

  // --- Filters ---
  const [filterAgent, setFilterAgent] = useState<string>('all')
  const [filterSource, setFilterSource] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [filterDateFrom, setFilterDateFrom] = useState<string>('')
  const [filterDateTo, setFilterDateTo] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)

  // --- Pagination (list view only) ---
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)

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

  useEffect(() => { if (profile?.id) fetchData() }, [profile?.id, fetchData])

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('leads-pipeline')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchData())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, fetchData])

  // --- Filtering ---
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (filterAgent !== 'all' && lead.assigned_to !== filterAgent) return false
      if (filterSource !== 'all' && lead.source !== filterSource) return false
      if (filterPriority !== 'all' && lead.priority !== filterPriority) return false
      if (filterDateFrom && lead.created_at < filterDateFrom) return false
      if (filterDateTo && lead.created_at > filterDateTo + 'T23:59:59') return false
      return true
    })
  }, [leads, filterAgent, filterSource, filterPriority, filterDateFrom, filterDateTo])

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1) }, [filterAgent, filterSource, filterPriority, filterDateFrom, filterDateTo])

  const hasActiveFilters = filterAgent !== 'all' || filterSource !== 'all' || filterPriority !== 'all' || !!filterDateFrom || !!filterDateTo

  function clearFilters() {
    setFilterAgent('all'); setFilterSource('all'); setFilterPriority('all')
    setFilterDateFrom(''); setFilterDateTo('')
  }

  // --- Pagination slicing (list view only) ---
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredLeads.slice(start, start + itemsPerPage)
  }, [filteredLeads, currentPage, itemsPerPage])

  // Kanban helpers
  const visibleStages = stages.filter((s) => !s.is_terminal || s.slug === 'won' || s.slug === 'lost')

  // --- Won modal ---
  async function handleWon() {
    if (!wonLeadId) return
    const lead = leads.find(l => l.id === wonLeadId)
    if (!lead) return
    const updates: Database['public']['Tables']['leads']['Update'] = {
      status: 'won', won_value: wonValue ? Number(wonValue) : null,
    }
    if (!lead.first_response_at) updates.first_response_at = new Date().toISOString()
    await supabase.from('leads').update(updates).eq('id', wonLeadId)
    await supabase.from('lead_activities').insert({
      lead_id: wonLeadId, user_id: profile!.id, type: 'status_change',
      content: wonValue ? `Valoare: ${wonValue} EUR` : null,
      metadata: { from_status: lead.status, to_status: 'won' },
    })
    toast({ title: 'Lead marcat ca câștigat', variant: 'success', description: wonValue ? `Valoare: ${wonValue} EUR` : undefined })
    setShowWonModal(false); setWonLeadId(null); setWonValue('')
    fetchData()
  }

  if (loading) {
    return (
      <><Header title="Pipeline" />
        <div className="p-4 sm:p-6"><div className="flex gap-4 overflow-x-auto">
          {[...Array(5)].map((_, i) => <div key={i} className="w-72 flex-shrink-0 bg-slate-100 dark:bg-slate-800 rounded-xl p-3 animate-pulse h-96" />)}
        </div></div>
      </>
    )
  }

  return (
    <>
      <Header title="Pipeline" />
      <div className="p-4 sm:p-6">
        <PipelineToolbar
          onToggleFilters={() => setShowFilters(!showFilters)}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearFilters}
          visibleCount={filteredLeads.length}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {showFilters && (
          <PipelineFilterBar
            isAdminOrManager={isAdminOrManager}
            agents={agents}
            sources={sources}
            filterAgent={filterAgent}
            onFilterAgentChange={setFilterAgent}
            filterSource={filterSource}
            onFilterSourceChange={setFilterSource}
            filterPriority={filterPriority}
            onFilterPriorityChange={setFilterPriority}
            filterDateFrom={filterDateFrom}
            onFilterDateFromChange={setFilterDateFrom}
            filterDateTo={filterDateTo}
            onFilterDateToChange={setFilterDateTo}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={clearFilters}
          />
        )}

        {viewMode === 'kanban' && (
          <KanbanBoard visibleStages={visibleStages} leads={filteredLeads} />
        )}

        {viewMode === 'list' && (
          <LeadsListView
            paginatedLeads={paginatedLeads}
            totalFilteredCount={filteredLeads.length}
            stages={stages}
            currentPage={currentPage}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
          />
        )}
      </div>

      {showWonModal && (
        <PipelineWonModal
          wonValue={wonValue}
          onWonValueChange={setWonValue}
          onCancel={() => { setShowWonModal(false); setWonLeadId(null); setWonValue('') }}
          onConfirm={handleWon}
        />
      )}
    </>
  )
}
