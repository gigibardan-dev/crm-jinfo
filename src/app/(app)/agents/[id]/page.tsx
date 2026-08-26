/**
 * src/app/(app)/agents/[id]/page.tsx
 *
 * Agent Detail Page — Profil agent + leaduri alocate + statistici
 *
 * Owner de state/date (fetch profil + leaduri alocate + stages, editare
 * profil prin PATCH /api/users/:id). Markup-ul e delegat componentelor
 * AgentProfileCard, LeadsTable și AgentStatsPanel — fișierul rămâne axat
 * pe date/handlere.
 * Acces: doar admin/manager. Editarea profilului: doar admin.
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import { LeadsTable } from '@/components/leads/LeadsTable'
import { AgentProfileCard, type AgentEditForm } from '@/components/agents/AgentProfileCard'
import { AgentStatsPanel, type AgentStats } from '@/components/agents/AgentStatsPanel'
import type { Profile, Lead, PipelineStage } from '@/lib/types/database'
import { ArrowLeft } from 'lucide-react'

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { isAdmin, isAdminOrManager } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [agent, setAgent] = useState<Profile | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [loading, setLoading] = useState(true)

  // Stats
  const [stats, setStats] = useState<AgentStats>({ active: 0, won: 0, lost: 0, total: 0 })

  // Edit mode
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<AgentEditForm>({ full_name: '', email: '', phone: '', role: 'agent', password: '' })
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [editSuccess, setEditSuccess] = useState(false)

  const fetchData = useCallback(async () => {
    const [agentRes, leadsRes, stagesRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single(),
      supabase.from('leads').select('*').eq('assigned_to', id).order('created_at', { ascending: false }).limit(50),
      supabase.from('pipeline_stages').select('*').order('display_order'),
    ])

    if (agentRes.data) {
      setAgent(agentRes.data)
      setEditForm({
        full_name: agentRes.data.full_name,
        email: agentRes.data.email,
        phone: agentRes.data.phone || '',
        role: agentRes.data.role,
        password: '',
      })
    }

    const agentLeads = leadsRes.data || []
    setLeads(agentLeads)
    setStages(stagesRes.data || [])

    const active = agentLeads.filter(l => !['won', 'lost', 'unqualified'].includes(l.status)).length
    const won = agentLeads.filter(l => l.status === 'won').length
    const lost = agentLeads.filter(l => l.status === 'lost').length

    setStats({ active, won, lost, total: agentLeads.length })
    setLoading(false)
  }, [id, supabase])

  useEffect(() => {
    if (!id || !isAdminOrManager) return
    fetchData()
  }, [id, isAdminOrManager, fetchData])

  async function saveEdit() {
    setSaving(true)
    setEditError(null)
    setEditSuccess(false)

    try {
      const body: Record<string, string | boolean> = {
        full_name: editForm.full_name,
        email: editForm.email,
        phone: editForm.phone,
        role: editForm.role,
      }

      if (editForm.password) {
        if (editForm.password.length < 6) {
          setEditError('Parola trebuie să aibă minim 6 caractere.')
          setSaving(false)
          return
        }
        body.password = editForm.password
      }

      const res = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        setEditError(data.error || 'Eroare la salvare.')
        setSaving(false)
        return
      }

      setEditing(false)
      setEditSuccess(true)
      setTimeout(() => setEditSuccess(false), 3000)
      fetchData()
    } catch {
      setEditError('Eroare de rețea.')
    }

    setSaving(false)
  }

  if (!isAdminOrManager) {
    return (
      <>
        <Header title="Profil Agent" />
        <div className="p-4 sm:p-6 text-sm text-slate-500 dark:text-slate-400">Nu ai acces la această pagină.</div>
      </>
    )
  }

  if (loading || !agent) {
    return (
      <>
        <Header />
        <div className="p-4 sm:p-6 animate-pulse">
          <div className="h-6 bg-slate-100 dark:bg-slate-800 rounded w-48 mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-80 bg-slate-100 dark:bg-slate-800 rounded-xl" />
            <div className="h-60 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Header />
      <div className="p-4 sm:p-6">
        <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors mb-6">
          <ArrowLeft size={16} /> Înapoi la Agenți
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Profile + Leads */}
          <div className="lg:col-span-2 space-y-6">
            <AgentProfileCard
              agent={agent}
              isAdmin={isAdmin}
              editing={editing}
              editForm={editForm}
              onEditFormChange={setEditForm}
              onStartEditing={() => setEditing(true)}
              onCancelEditing={() => { setEditing(false); setEditError(null) }}
              onSave={saveEdit}
              saving={saving}
              editError={editError}
              editSuccess={editSuccess}
              showPassword={showPassword}
              onToggleShowPassword={() => setShowPassword(!showPassword)}
            />

            {/* Leads list */}
            <div>
              <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-3">Leaduri alocate ({leads.length})</h3>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                {leads.length === 0 ? (
                  <div className="text-sm text-slate-400 text-center py-10">Niciun lead alocat.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <LeadsTable leads={leads} stages={stages} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Stats */}
          <div className="space-y-4">
            <AgentStatsPanel stats={stats} agent={agent} />
          </div>
        </div>
      </div>
    </>
  )
}
