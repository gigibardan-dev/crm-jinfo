/**
 * src/app/(app)/leads/inbox/page.tsx
 *
 * Inbox Page — Leaduri nealocate cu paginație
 *
 * Owner de state (leaduri nealocate, selecție, alocare) — markup-ul rândului
 * și al toolbar-ului e delegat componentelor din
 * src/components/leads/inbox/*.
 *
 * Vizibil: Admin, Manager
 * Features: alocare individuală/bulk, paginație, toast
 */

'use client'

import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import { Pagination } from '@/components/ui/Pagination'
import type { Lead, Profile } from '@/lib/types/database'
import { fullName } from '@/lib/utils'
import { Check } from 'lucide-react'
import { InboxToolbar } from '@/components/leads/inbox/InboxToolbar'
import { InboxLeadRow } from '@/components/leads/inbox/InboxLeadRow'

export default function InboxPage() {
  const { profile, isAdminOrManager } = useAuth()
  const { toast } = useToast()
  const [leads, setLeads] = useState<Lead[]>([])
  const [agents, setAgents] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [assigningTo, setAssigningTo] = useState<string | null>(null)
  const [showAgentDropdown, setShowAgentDropdown] = useState<string | null>(null)
  const supabase = createClient()

  // --- Pagination ---
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)

  useEffect(() => {
    if (!isAdminOrManager) return
    async function fetch() {
      const [leadsRes, agentsRes] = await Promise.all([
        supabase.from('leads').select('*').eq('status', 'new').order('created_at', { ascending: false }),
        supabase.from('profiles').select('*').in('role', ['agent', 'manager']).eq('is_active', true).order('full_name'),
      ])
      setLeads(leadsRes.data || [])
      setAgents(agentsRes.data || [])
      setLoading(false)
    }
    fetch()
  }, [supabase, isAdminOrManager])

  // Paginated slice
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return leads.slice(start, start + itemsPerPage)
  }, [leads, currentPage, itemsPerPage])

  async function assignLead(leadId: string, agentId: string) {
    setAssigningTo(leadId)
    const lead = leads.find((l) => l.id === leadId)
    const agentName = agents.find((a) => a.id === agentId)?.full_name || 'agent'

    const { error } = await supabase.from('leads').update({
      assigned_to: agentId, assigned_by: profile!.id,
      assigned_at: new Date().toISOString(), status: 'assigned',
    }).eq('id', leadId)

    if (!error) {
      await supabase.from('lead_activities').insert({
        lead_id: leadId, user_id: profile!.id, type: 'assignment',
        content: `Lead alocat către ${agentName}`, metadata: { assigned_to: agentId },
      })
      await supabase.from('notifications').insert({
        user_id: agentId, type: 'lead_assigned', title: 'Lead nou alocat',
        body: `${fullName(lead?.first_name ?? null, lead?.last_name ?? null)} — ${lead?.destination || 'fără destinație'}`,
        lead_id: leadId,
      })
      setLeads((prev) => prev.filter((l) => l.id !== leadId))
      setSelected((prev) => { const next = new Set(prev); next.delete(leadId); return next })
      toast({ title: `Lead alocat către ${agentName}`, variant: 'success' })
    } else {
      toast({ title: 'Eroare la alocare', variant: 'error' })
    }
    setAssigningTo(null)
    setShowAgentDropdown(null)
  }

  async function bulkAssign(agentId: string) {
    const count = selected.size
    for (const leadId of selected) { await assignLead(leadId, agentId) }
    setSelected(new Set())
    toast({ title: `${count} leaduri alocate`, variant: 'success' })
  }

  function toggleSelect(leadId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(leadId)) next.delete(leadId); else next.add(leadId)
      return next
    })
  }

  function toggleAll() {
    // Select/deselect only current page items
    const pageIds = paginatedLeads.map(l => l.id)
    const allSelected = pageIds.every(id => selected.has(id))
    if (allSelected) {
      setSelected((prev) => { const next = new Set(prev); pageIds.forEach(id => next.delete(id)); return next })
    } else {
      setSelected((prev) => { const next = new Set(prev); pageIds.forEach(id => next.add(id)); return next })
    }
  }

  if (!isAdminOrManager) {
    return <><Header title="Inbox" /><div className="p-4 sm:p-6 text-sm text-slate-500 dark:text-slate-400">Nu ai acces la această pagină.</div></>
  }

  return (
    <>
      <Header title="Inbox" />
      <div className="p-4 sm:p-6">
        <InboxToolbar
          totalCount={leads.length}
          selectedCount={selected.size}
          agents={agents}
          bulkDropdownOpen={showAgentDropdown === 'bulk'}
          onToggleBulkDropdown={() => setShowAgentDropdown(showAgentDropdown === 'bulk' ? null : 'bulk')}
          onBulkAssign={bulkAssign}
        />

        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 animate-pulse">
                <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-48 mb-2" />
                <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-32" />
              </div>
            ))}
          </div>
        ) : leads.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 flex items-center justify-center mx-auto mb-3"><Check size={24} /></div>
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Inbox gol</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Toate leadurile sunt alocate.</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex items-center gap-3 px-4 py-2">
                <input type="checkbox"
                  checked={paginatedLeads.length > 0 && paginatedLeads.every(l => selected.has(l.id))}
                  onChange={toggleAll}
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500" />
                <span className="text-xs text-slate-400">Selectează pagina</span>
              </div>

              {paginatedLeads.map((lead) => (
                <InboxLeadRow
                  key={lead.id}
                  lead={lead}
                  agents={agents}
                  selected={selected.has(lead.id)}
                  onToggleSelect={() => toggleSelect(lead.id)}
                  assigning={assigningTo === lead.id}
                  dropdownOpen={showAgentDropdown === lead.id}
                  onToggleDropdown={() => setShowAgentDropdown(showAgentDropdown === lead.id ? null : lead.id)}
                  onAssign={(agentId) => assignLead(lead.id, agentId)}
                />
              ))}
            </div>

            {/* Pagination */}
            <Pagination
              currentPage={currentPage}
              totalItems={leads.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={setItemsPerPage}
            />
          </>
        )}
      </div>
    </>
  )
}
