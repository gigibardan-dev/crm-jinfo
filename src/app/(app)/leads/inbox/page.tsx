'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import type { Lead, Profile } from '@/lib/types/database'
import { fullName, timeAgo, formatTravelDates, formatTravelers } from '@/lib/utils'
import { SOURCE_ICONS, PRIORITY_CONFIG } from '@/lib/utils/constants'
import { UserPlus, Check, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function InboxPage() {
  const { profile, isAdminOrManager } = useAuth()
  const [leads, setLeads] = useState<Lead[]>([])
  const [agents, setAgents] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [assigningTo, setAssigningTo] = useState<string | null>(null)
  const [showAgentDropdown, setShowAgentDropdown] = useState<string | null>(null)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    if (!isAdminOrManager) return

    async function fetch() {
      const [leadsRes, agentsRes] = await Promise.all([
        supabase
          .from('leads')
          .select('*')
          .eq('status', 'new')
          .order('created_at', { ascending: false }),
        supabase
          .from('profiles')
          .select('*')
          .eq('role', 'agent')
          .eq('is_active', true)
          .order('full_name'),
      ])

      setLeads(leadsRes.data || [])
      setAgents(agentsRes.data || [])
      setLoading(false)
    }

    fetch()
  }, [supabase, isAdminOrManager])

  async function assignLead(leadId: string, agentId: string) {
    setAssigningTo(leadId)

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
        content: `Lead alocat`,
        metadata: { assigned_to: agentId },
      })

      // Create notification for agent
      const lead = leads.find((l) => l.id === leadId)
      await supabase.from('notifications').insert({
        user_id: agentId,
        type: 'lead_assigned',
        title: 'Lead nou alocat',
        body: `${fullName(lead?.first_name ?? null, lead?.last_name ?? null)} — ${lead?.destination || 'fără destinație'}`,
        lead_id: leadId,
      })

      setLeads((prev) => prev.filter((l) => l.id !== leadId))
      setSelected((prev) => {
        const next = new Set(prev)
        next.delete(leadId)
        return next
      })
    }

    setAssigningTo(null)
    setShowAgentDropdown(null)
  }

  async function bulkAssign(agentId: string) {
    for (const leadId of selected) {
      await assignLead(leadId, agentId)
    }
    setSelected(new Set())
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
    if (selected.size === leads.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(leads.map((l) => l.id)))
    }
  }

  if (!isAdminOrManager) {
    return (
      <>
        <Header title="Inbox" />
        <div className="p-6 text-sm text-slate-500">Nu ai acces la această pagină.</div>
      </>
    )
  }

  return (
    <>
      <Header title="Inbox" />
      <div className="p-6">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-slate-500">
            {leads.length} {leads.length === 1 ? 'lead nealocat' : 'leaduri nealocate'}
          </p>

          {selected.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">
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
                  <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-10 py-1">
                    {agents.map((agent) => (
                      <button
                        key={agent.id}
                        onClick={() => bulkAssign(agent.id)}
                        className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        {agent.full_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 animate-pulse">
                <div className="h-4 bg-slate-100 rounded w-48 mb-2" />
                <div className="h-3 bg-slate-100 rounded w-32" />
              </div>
            ))}
          </div>
        ) : leads.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center mx-auto mb-3">
              <Check size={24} />
            </div>
            <p className="text-sm font-medium text-slate-900">Inbox gol</p>
            <p className="text-sm text-slate-500 mt-1">Toate leadurile sunt alocate.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Select all */}
            <div className="flex items-center gap-3 px-4 py-2">
              <input
                type="checkbox"
                checked={selected.size === leads.length && leads.length > 0}
                onChange={toggleAll}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs text-slate-400">Selectează tot</span>
            </div>

            {leads.map((lead) => (
              <div
                key={lead.id}
                className={`bg-white border rounded-xl p-4 flex items-center gap-4 transition-colors ${
                  selected.has(lead.id) ? 'border-blue-300 bg-blue-50/30' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(lead.id)}
                  onChange={() => toggleSelect(lead.id)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />

                {/* Lead info */}
                <Link href={`/leads/${lead.id}`} className="flex-1 min-w-0 group">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-slate-900 group-hover:text-blue-600 transition-colors">
                      {fullName(lead.first_name, lead.last_name)}
                    </span>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded font-medium"
                      style={{
                        color: PRIORITY_CONFIG[lead.priority]?.color,
                        backgroundColor: PRIORITY_CONFIG[lead.priority]?.bgColor,
                      }}
                    >
                      {PRIORITY_CONFIG[lead.priority]?.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>{SOURCE_ICONS[lead.source] || '📌'} {lead.source_detail || lead.source}</span>
                    {lead.destination && <span>🌍 {lead.destination}</span>}
                    {lead.travel_date_from && (
                      <span>📅 {formatTravelDates(lead.travel_date_from, lead.travel_date_to)}</span>
                    )}
                    <span>👥 {formatTravelers(lead.nr_adults, lead.nr_children)}</span>
                  </div>
                </Link>

                {/* Time */}
                <span className="text-xs text-slate-400 whitespace-nowrap">
                  {timeAgo(lead.created_at)}
                </span>

                {/* Assign button */}
                <div className="relative">
                  <button
                    onClick={() =>
                      setShowAgentDropdown(showAgentDropdown === lead.id ? null : lead.id)
                    }
                    disabled={assigningTo === lead.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg
                               text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:opacity-50"
                  >
                    <UserPlus size={13} />
                    Alocă
                  </button>
                  {showAgentDropdown === lead.id && (
                    <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-10 py-1">
                      {agents.map((agent) => (
                        <button
                          key={agent.id}
                          onClick={() => assignLead(lead.id, agent.id)}
                          className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        >
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
