'use client'

/**
 * Inbox Page — Lead-uri nealocate ("Galeata")
 * 
 * Vizibil doar pentru: Admin, Manager
 * 
 * Features:
 * - Lista cronologică cu toate leadurile cu status "new"
 * - Alocare individuală sau bulk la un agent
 * - Notificare automată la agent după alocare
 * - Toast feedback la acțiuni
 */

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import { SourceIcon } from '@/components/leads/SourceIcon'
import { PriorityBadge } from '@/components/leads/PriorityBadge'
import type { Lead, Profile } from '@/lib/types/database'
import { fullName, timeAgo, formatTravelDates, formatTravelers } from '@/lib/utils'
import { UserPlus, Check, ChevronDown, MapPin, Calendar, Users } from 'lucide-react'
import Link from 'next/link'

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

  // Fetch unassigned leads + active agents
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

  /** Assign a single lead to an agent */
  async function assignLead(leadId: string, agentId: string) {
    setAssigningTo(leadId)
    const lead = leads.find((l) => l.id === leadId)
    const agentName = agents.find((a) => a.id === agentId)?.full_name || 'agent'

    const { error } = await supabase
      .from('leads')
      .update({
        assigned_to: agentId,
        assigned_by: profile!.id,
        assigned_at: new Date().toISOString(),
        status: 'assigned',
      })
      .eq('id', leadId)

    if (!error) {
      // Log activity
      await supabase.from('lead_activities').insert({
        lead_id: leadId,
        user_id: profile!.id,
        type: 'assignment',
        content: `Lead alocat către ${agentName}`,
        metadata: { assigned_to: agentId },
      })

      // Notify agent
      await supabase.from('notifications').insert({
        user_id: agentId,
        type: 'lead_assigned',
        title: 'Lead nou alocat',
        body: `${fullName(lead?.first_name ?? null, lead?.last_name ?? null)} — ${lead?.destination || 'fără destinație'}`,
        lead_id: leadId,
      })

      // Remove from list + show toast
      setLeads((prev) => prev.filter((l) => l.id !== leadId))
      setSelected((prev) => { const next = new Set(prev); next.delete(leadId); return next })
      toast({ title: `Lead alocat către ${agentName}`, variant: 'success' })
    } else {
      toast({ title: 'Eroare la alocare', variant: 'error' })
    }

    setAssigningTo(null)
    setShowAgentDropdown(null)
  }

  /** Bulk assign selected leads to one agent */
  async function bulkAssign(agentId: string) {
    const count = selected.size
    for (const leadId of selected) {
      await assignLead(leadId, agentId)
    }
    setSelected(new Set())
    toast({ title: `${count} leaduri alocate`, variant: 'success' })
  }

  function toggleSelect(leadId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(leadId)) next.delete(leadId)
      else next.add(leadId)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === leads.length) setSelected(new Set())
    else setSelected(new Set(leads.map((l) => l.id)))
  }

  // --- Guard: only admin/manager ---
  if (!isAdminOrManager) {
    return (
      <>
        <Header title="Inbox" />
        <div className="p-6 text-sm text-slate-500 dark:text-slate-400">Nu ai acces la această pagină.</div>
      </>
    )
  }

  return (
    <>
      <Header title="Inbox" />
      <div className="p-6">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {leads.length} {leads.length === 1 ? 'lead nealocat' : 'leaduri nealocate'}
          </p>

          {/* Bulk assign button */}
          {selected.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {selected.size} selectat{selected.size > 1 ? 'e' : ''}
              </span>
              <div className="relative">
                <button
                  onClick={() => setShowAgentDropdown(showAgentDropdown === 'bulk' ? null : 'bulk')}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <UserPlus size={14} />
                  Alocă la...
                  <ChevronDown size={14} />
                </button>
                {showAgentDropdown === 'bulk' && (
                  <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-10 py-1">
                    {agents.map((agent) => (
                      <button key={agent.id} onClick={() => bulkAssign(agent.id)}
                        className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">
                        {agent.full_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Loading skeleton */}
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
          /* Empty state */
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 flex items-center justify-center mx-auto mb-3">
              <Check size={24} />
            </div>
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Inbox gol</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Toate leadurile sunt alocate.</p>
          </div>
        ) : (
          /* Lead list */
          <div className="space-y-2">
            {/* Select all checkbox */}
            <div className="flex items-center gap-3 px-4 py-2">
              <input type="checkbox" checked={selected.size === leads.length && leads.length > 0}
                onChange={toggleAll}
                className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500" />
              <span className="text-xs text-slate-400">Selectează tot</span>
            </div>

            {leads.map((lead) => (
              <div key={lead.id}
                className={`bg-white dark:bg-slate-900 border rounded-xl p-4 flex items-center gap-4 transition-colors ${
                  selected.has(lead.id)
                    ? 'border-blue-300 dark:border-blue-700 bg-blue-50/30 dark:bg-blue-950/30'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <input type="checkbox" checked={selected.has(lead.id)} onChange={() => toggleSelect(lead.id)}
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500" />

                {/* Source icon */}
                <SourceIcon source={lead.source} size="md" />

                {/* Lead info */}
                <Link href={`/leads/${lead.id}`} className="flex-1 min-w-0 group">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {fullName(lead.first_name, lead.last_name)}
                    </span>
                    <PriorityBadge priority={lead.priority} size="sm" />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    {lead.destination && (
                      <span className="flex items-center gap-1"><MapPin size={11} /> {lead.destination}</span>
                    )}
                    {lead.travel_date_from && (
                      <span className="flex items-center gap-1"><Calendar size={11} /> {formatTravelDates(lead.travel_date_from, lead.travel_date_to)}</span>
                    )}
                    <span className="flex items-center gap-1"><Users size={11} /> {formatTravelers(lead.nr_adults, lead.nr_children)}</span>
                  </div>
                </Link>

                {/* Time ago */}
                <span className="text-xs text-slate-400 whitespace-nowrap">{timeAgo(lead.created_at)}</span>

                {/* Assign button */}
                <div className="relative">
                  <button
                    onClick={() => setShowAgentDropdown(showAgentDropdown === lead.id ? null : lead.id)}
                    disabled={assigningTo === lead.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg
                               text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                  >
                    <UserPlus size={13} />
                    Alocă
                  </button>
                  {showAgentDropdown === lead.id && (
                    <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-10 py-1">
                      {agents.map((agent) => (
                        <button key={agent.id} onClick={() => assignLead(lead.id, agent.id)}
                          className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">
                          {agent.full_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
