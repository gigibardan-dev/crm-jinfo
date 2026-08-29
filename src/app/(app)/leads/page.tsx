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
 * Filtre: agent, sursă, status, remindere scadente, lead-uri stagnante,
 * prioritate, perioadă
 * Won value modal la marcare câștigat
 *
 * Filtre din URL (folosite de cardurile din Dashboard, ex. /leads?status=won,
 * /leads?reminders=due sau /leads?stagnant=true) — citite o singură dată la
 * montare, sursa de adevăr rămâne state-ul local din pagină cât timp userul
 * mai schimbă filtrele.
 */

'use client'

import { Suspense, useEffect, useState, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import type { Lead, PipelineStage, Profile, LeadSource, Database } from '@/lib/types/database'
import { IN_PROGRESS_STATUSES } from '@/lib/utils/constants'
import { getStagnantInfo } from '@/lib/utils/stagnantLeads'
import { PipelineToolbar, type PipelineViewMode } from '@/components/leads/pipeline/PipelineToolbar'
import { PipelineFilterBar } from '@/components/leads/pipeline/PipelineFilterBar'
import { KanbanBoard } from '@/components/leads/pipeline/KanbanBoard'
import { LeadsListView } from '@/components/leads/pipeline/LeadsListView'
import { WonValueModal } from '@/components/leads/lead-detail/LeadActionModals'
import { type WonDetails, EMPTY_WON_DETAILS, buildWonUpdate, formatWonNote } from '@/lib/types/wonDetails'

const IN_PROGRESS_SET: string[] = [...IN_PROGRESS_STATUSES]

export default function PipelinePage() {
  return (
    <Suspense fallback={<PipelineLoadingSkeleton />}>
      <PipelinePageContent />
    </Suspense>
  )
}

function PipelineLoadingSkeleton() {
  return (
    <>
      <Header title="Pipeline" />
      <div className="p-4 sm:p-6"><div className="flex gap-4 overflow-x-auto">
        {[...Array(5)].map((_, i) => <div key={i} className="w-72 flex-shrink-0 bg-slate-100 dark:bg-slate-800 rounded-xl p-3 animate-pulse h-96" />)}
      </div></div>
    </>
  )
}

function PipelinePageContent() {
  const { profile, isAdminOrManager } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()
  const searchParams = useSearchParams()

  // Filtre venite din URL (cardurile din Dashboard) — citite o singură dată,
  // la primul render. Query params non-goale => pornim direct în listă
  // filtrată, ca userul să vadă imediat leadurile relevante.
  const initialStatus = searchParams.get('status') || 'all'
  const initialRemindersDue = searchParams.get('reminders') === 'due'
  const initialStagnant = searchParams.get('stagnant') === 'true'
  const hasUrlFilters = initialStatus !== 'all' || initialRemindersDue || initialStagnant

  const [leads, setLeads] = useState<Lead[]>([])
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [agents, setAgents] = useState<Profile[]>([])
  const [sources, setSources] = useState<LeadSource[]>([])
  const [reminderLeadIds, setReminderLeadIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<PipelineViewMode>(hasUrlFilters ? 'list' : 'kanban')

  // --- Filters ---
  const [filterAgent, setFilterAgent] = useState<string>('all')
  const [filterSource, setFilterSource] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>(initialStatus)
  const [filterRemindersDue, setFilterRemindersDue] = useState<boolean>(initialRemindersDue)
  const [filterStagnant, setFilterStagnant] = useState<boolean>(initialStagnant)
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [filterDateFrom, setFilterDateFrom] = useState<string>('')
  const [filterDateTo, setFilterDateTo] = useState<string>('')
  const [showFilters, setShowFilters] = useState(hasUrlFilters)

  // --- Pagination (list view only) ---
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)

  // --- Won modal ---
  const [showWonModal, setShowWonModal] = useState(false)
  const [wonLeadId, setWonLeadId] = useState<string | null>(null)
  const [wonDetails, setWonDetails] = useState<WonDetails>(EMPTY_WON_DETAILS)

  // --- Data fetching ---
  const fetchData = useCallback(async () => {
    setLoading(true)
    const [stagesRes, leadsRes, agentsRes, sourcesRes, remindersRes] = await Promise.all([
      supabase.from('pipeline_stages').select('*').order('display_order'),
      supabase.from('leads').select('*').order('created_at', { ascending: false }),
      isAdminOrManager
        ? supabase.from('profiles').select('*').in('role', ['agent', 'manager']).eq('is_active', true).order('full_name')
        : Promise.resolve({ data: [] as Profile[] }),
      supabase.from('lead_sources').select('*').eq('is_active', true).order('name'),
      supabase.from('reminders').select('lead_id')
        .eq('user_id', profile!.id).eq('is_completed', false).lte('remind_at', new Date().toISOString()),
    ])
    setStages(stagesRes.data || [])
    setLeads(leadsRes.data || [])
    setAgents(agentsRes.data || [])
    setSources(sourcesRes.data || [])
    setReminderLeadIds(new Set((remindersRes.data || []).map((r) => r.lead_id)))
    setLoading(false)
  }, [supabase, isAdminOrManager, profile])

  useEffect(() => { if (profile?.id) fetchData() }, [profile?.id, fetchData])

  // Realtime — orice schimbare pe leaduri (inclusiv realocare) sau remindere
  // (ex. marcat completat) reface lista, ca datele să rămână la zi.
  useEffect(() => {
    const channel = supabase
      .channel('leads-pipeline')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reminders' }, () => fetchData())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, fetchData])

  // Map rapid id agent → profil, pentru afișarea numelui alocat pe carduri/tabel
  const agentsById = useMemo(() => {
    const map: Record<string, Profile> = {}
    for (const a of agents) map[a.id] = a
    return map
  }, [agents])

  // --- Filtering ---
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (filterAgent !== 'all' && lead.assigned_to !== filterAgent) return false
      if (filterSource !== 'all' && lead.source !== filterSource) return false
      if (filterStatus === 'in_progress') {
        if (!IN_PROGRESS_SET.includes(lead.status)) return false
      } else if (filterStatus !== 'all' && lead.status !== filterStatus) return false
      if (filterRemindersDue && !reminderLeadIds.has(lead.id)) return false
      if (filterStagnant && !getStagnantInfo(lead.status, lead.last_interaction_at)) return false
      if (filterPriority !== 'all' && lead.priority !== filterPriority) return false
      if (filterDateFrom && lead.created_at < filterDateFrom) return false
      if (filterDateTo && lead.created_at > filterDateTo + 'T23:59:59') return false
      return true
    })
  }, [leads, filterAgent, filterSource, filterStatus, filterRemindersDue, reminderLeadIds, filterStagnant, filterPriority, filterDateFrom, filterDateTo])

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1) }, [filterAgent, filterSource, filterStatus, filterRemindersDue, filterStagnant, filterPriority, filterDateFrom, filterDateTo])

  const hasActiveFilters = filterAgent !== 'all' || filterSource !== 'all' || filterStatus !== 'all' || filterRemindersDue
    || filterStagnant || filterPriority !== 'all' || !!filterDateFrom || !!filterDateTo

  function clearFilters() {
    setFilterAgent('all'); setFilterSource('all'); setFilterStatus('all'); setFilterRemindersDue(false)
    setFilterStagnant(false); setFilterPriority('all'); setFilterDateFrom(''); setFilterDateTo('')
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
      status: 'won', ...buildWonUpdate(wonDetails),
    }
    if (!lead.first_response_at) updates.first_response_at = new Date().toISOString()
    await supabase.from('leads').update(updates).eq('id', wonLeadId)
    const note = formatWonNote(wonDetails)
    await supabase.from('lead_activities').insert({
      lead_id: wonLeadId, user_id: profile!.id, type: 'status_change',
      content: note ?? null,
      metadata: { from_status: lead.status, to_status: 'won' },
    })
    toast({ title: 'Lead marcat ca câștigat', variant: 'success', description: note })
    setShowWonModal(false); setWonLeadId(null); setWonDetails(EMPTY_WON_DETAILS)
    fetchData()
  }

  if (loading) return <PipelineLoadingSkeleton />

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
            stages={stages}
            filterAgent={filterAgent}
            onFilterAgentChange={setFilterAgent}
            filterSource={filterSource}
            onFilterSourceChange={setFilterSource}
            filterStatus={filterStatus}
            onFilterStatusChange={setFilterStatus}
            filterRemindersDue={filterRemindersDue}
            onFilterRemindersDueChange={setFilterRemindersDue}
            filterStagnant={filterStagnant}
            onFilterStagnantChange={setFilterStagnant}
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
          <KanbanBoard visibleStages={visibleStages} leads={filteredLeads} agentsById={agentsById} />
        )}

        {viewMode === 'list' && (
          <LeadsListView
            paginatedLeads={paginatedLeads}
            totalFilteredCount={filteredLeads.length}
            stages={stages}
            agentsById={isAdminOrManager ? agentsById : undefined}
            currentPage={currentPage}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
          />
        )}
      </div>

      {showWonModal && (
        <WonValueModal
          details={wonDetails}
          onChange={(field, value) => setWonDetails((prev) => ({ ...prev, [field]: value }))}
          onCancel={() => { setShowWonModal(false); setWonLeadId(null); setWonDetails(EMPTY_WON_DETAILS) }}
          onConfirm={handleWon}
        />
      )}
    </>
  )
}
