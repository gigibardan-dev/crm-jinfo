'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import { SourceIcon } from '@/components/leads/SourceIcon'
import { PriorityBadge } from '@/components/leads/PriorityBadge'
import { StatusBadge } from '@/components/leads/StatusBadge'
import type { Profile, Lead, PipelineStage } from '@/lib/types/database'
import { getInitials, fullName, timeAgo, formatDateTime } from '@/lib/utils'
import {
  ArrowLeft, Mail, Phone, Shield, Pencil, X, Check, Eye, EyeOff,
  Calendar, TrendingUp, AlertTriangle, Clock
} from 'lucide-react'
import Link from 'next/link'

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
  const [stats, setStats] = useState({ active: 0, won: 0, lost: 0, total: 0 })

  // Edit mode
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ full_name: '', email: '', phone: '', role: 'agent', password: '' })
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
        <div className="p-6 text-sm text-slate-500 dark:text-slate-400">Nu ai acces la această pagină.</div>
      </>
    )
  }

  if (loading || !agent) {
    return (
      <>
        <Header />
        <div className="p-6 animate-pulse">
          <div className="h-6 bg-slate-100 dark:bg-slate-800 rounded w-48 mb-6" />
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 h-80 bg-slate-100 dark:bg-slate-800 rounded-xl" />
            <div className="h-60 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          </div>
        </div>
      </>
    )
  }

  const inputClass = "w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"

  return (
    <>
      <Header />
      <div className="p-6">
        <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors mb-6">
          <ArrowLeft size={16} /> Înapoi la Agenți
        </button>

        <div className="grid grid-cols-3 gap-6">
          {/* Left: Profile + Leads */}
          <div className="col-span-2 space-y-6">

            {/* Profile card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-lg font-semibold text-blue-700 dark:text-blue-300">
                    {getInitials(agent.full_name)}
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{agent.full_name}</h2>
                    <div className="flex items-center gap-3 mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {agent.email && <span className="flex items-center gap-1"><Mail size={13} /> {agent.email}</span>}
                      {agent.phone && <span className="flex items-center gap-1"><Phone size={13} /> {agent.phone}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded capitalize">
                        <Shield size={11} /> {agent.role}
                      </span>
                      <span className={`w-2 h-2 rounded-full ${agent.is_active ? 'bg-green-500' : 'bg-slate-300'}`} />
                      <span className="text-xs text-slate-400">{agent.is_active ? 'Activ' : 'Inactiv'}</span>
                    </div>
                  </div>
                </div>

                {isAdmin && !editing && (
                  <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <Pencil size={14} /> Editează
                  </button>
                )}
              </div>

              {editing && isAdmin && (
                <div className="border-t border-slate-100 dark:border-slate-800 pt-5 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Nume complet</label>
                      <input type="text" value={editForm.full_name} onChange={(e) => setEditForm(f => ({...f, full_name: e.target.value}))} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Email</label>
                      <input type="email" value={editForm.email} onChange={(e) => setEditForm(f => ({...f, email: e.target.value}))} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Telefon</label>
                      <input type="tel" value={editForm.phone} onChange={(e) => setEditForm(f => ({...f, phone: e.target.value}))} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Rol</label>
                      <select value={editForm.role} onChange={(e) => setEditForm(f => ({...f, role: e.target.value}))} className={inputClass}>
                        <option value="agent">Agent</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Parolă nouă (lasă gol pentru a nu schimba)</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={editForm.password}
                        onChange={(e) => setEditForm(f => ({...f, password: e.target.value}))}
                        placeholder="Minim 6 caractere"
                        className={inputClass + ' pr-10'}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {editError && (
                    <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 rounded-lg px-3 py-2">{editError}</div>
                  )}

                  <div className="flex items-center gap-3">
                    <button onClick={saveEdit} disabled={saving}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                      <Check size={14} /> {saving ? 'Se salvează...' : 'Salvează'}
                    </button>
                    <button onClick={() => { setEditing(false); setEditError(null) }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200">
                      <X size={14} /> Anulează
                    </button>
                  </div>
                </div>
              )}

              {editSuccess && (
                <div className="mt-4 text-sm text-green-600 bg-green-50 dark:bg-green-950 border border-green-100 dark:border-green-900 rounded-lg px-3 py-2">
                  Profil actualizat cu succes.
                </div>
              )}
            </div>

            {/* Leads list */}
            <div>
              <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-3">Leaduri alocate ({leads.length})</h3>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                {leads.length === 0 ? (
                  <div className="text-sm text-slate-400 text-center py-10">Niciun lead alocat.</div>
                ) : (
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
                      {leads.map((lead) => {
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
                            <td className="px-4 py-3">
                              <StatusBadge name={stage?.name || lead.status} color={stage?.color} />
                            </td>
                            <td className="px-4 py-3"><PriorityBadge priority={lead.priority} size="sm" /></td>
                            <td className="px-4 py-3 text-xs text-slate-400">{timeAgo(lead.last_activity_at || lead.created_at)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          {/* Right: Stats */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
              <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-4">Statistici</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"><Clock size={15} /> Leaduri active</span>
                  <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">{stats.active}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"><TrendingUp size={15} /> Câștigate</span>
                  <span className="text-lg font-semibold text-green-600">{stats.won}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"><AlertTriangle size={15} /> Pierdute</span>
                  <span className="text-lg font-semibold text-red-500">{stats.lost}</span>
                </div>
                <div className="h-px bg-slate-100 dark:bg-slate-800" />
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"><Calendar size={15} /> Total leaduri</span>
                  <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">{stats.total}</span>
                </div>
                {stats.total > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500 dark:text-slate-400">Rată conversie</span>
                    <span className="text-lg font-semibold text-blue-600">{Math.round((stats.won / stats.total) * 100)}%</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
              <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-3">Detalii cont</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Creat</span>
                  <span className="text-slate-700 dark:text-slate-300 text-xs">{formatDateTime(agent.created_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Status</span>
                  <span className={agent.is_active ? 'text-green-600' : 'text-slate-400'}>{agent.is_active ? 'Activ' : 'Inactiv'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
