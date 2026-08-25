'use client'

/**
 * Lead Detail Page — Pagina completă pentru un lead
 * 
 * Features:
 * - Vizualizare toate datele lead-ului
 * - Editare inline (oricine are acces la lead)
 * - Schimbare status cu dropdown (+ lost reason modal + won value modal)
 * - Re-asignare lead (admin/manager)
 * - Comentarii / note interne cu timeline
 * - Setare remindere cu dată + notă
 * - Ștergere lead cu confirmare (admin only)
 * - Toast feedback la toate acțiunile
 * - Dark mode complet
 */

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import { SourceIcon } from '@/components/leads/SourceIcon'
import { PriorityBadge } from '@/components/leads/PriorityBadge'
import type { Lead, LeadActivity, PipelineStage, Profile, Reminder, Database } from '@/lib/types/database'
import { fullName, timeAgo, formatDateTime, formatTravelDates, formatTravelers, formatPhone } from '@/lib/utils'
import { LOST_REASONS, TRIP_TYPES } from '@/lib/utils/constants'
import { LeadTimeline } from '@/components/leads/LeadTimeline'
import {
  ArrowLeft, Phone, Mail, MapPin, Calendar, Users, Wallet,
  MessageSquare, Clock, Bell, Tag, ChevronDown, Send, AlertCircle,
  Pencil, X, Check, Trash2, UserPlus, Trophy
} from 'lucide-react'

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { profile, isAdminOrManager, isAdmin } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const supabase = createClient()

  // --- Core state ---
  const [lead, setLead] = useState<Lead | null>(null)
  const [agent, setAgent] = useState<Profile | null>(null)
  const [agents, setAgents] = useState<Profile[]>([])
  const [activities, setActivities] = useState<(LeadActivity & { user?: Profile | null })[]>([])
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)

  // --- Comment form ---
  const [comment, setComment] = useState('')
  const [sendingComment, setSendingComment] = useState(false)

  // --- Status change ---
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)
  const [showLostModal, setShowLostModal] = useState(false)
  const [lostReason, setLostReason] = useState('')
  const [lostReasonCustom, setLostReasonCustom] = useState('')
  const [showWonModal, setShowWonModal] = useState(false)
  const [wonValue, setWonValue] = useState('')

  // --- Reminder ---
  const [showReminderForm, setShowReminderForm] = useState(false)
  const [reminderDate, setReminderDate] = useState('')
  const [reminderNote, setReminderNote] = useState('')

  // --- Edit mode ---
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    first_name: '', last_name: '', phone: '', email: '',
    destination: '', travel_date_from: '', travel_date_to: '',
    nr_adults: 1, nr_children: 0, children_ages: '',
    budget_range: '', trip_type: '', message: '',
    priority: 'medium' as Lead['priority'],
  })
  const [saving, setSaving] = useState(false)

  // --- Delete ---
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // --- Re-assign ---
  const [showAssignDropdown, setShowAssignDropdown] = useState(false)

  // ========================================
  // DATA FETCHING
  // ========================================

  const fetchLead = useCallback(async () => {
    const [leadRes, activitiesRes, stagesRes, remindersRes, agentsRes] = await Promise.all([
      supabase.from('leads').select('*').eq('id', id).single(),
      supabase.from('lead_activities')
        .select('*, user:profiles(id, full_name, avatar_url)')
        .eq('lead_id', id).order('created_at', { ascending: false }),
      supabase.from('pipeline_stages').select('*').order('display_order'),
      supabase.from('reminders').select('*').eq('lead_id', id).order('remind_at', { ascending: true }),
      isAdminOrManager
        ? supabase.from('profiles').select('*').in('role', ['agent', 'manager']).eq('is_active', true).order('full_name')
        : Promise.resolve({ data: [] as Profile[] }),
    ])

    if (leadRes.data) {
      setLead(leadRes.data)
      // Fetch assigned agent profile
      if (leadRes.data.assigned_to) {
        const { data: agentData } = await supabase
          .from('profiles').select('*').eq('id', leadRes.data.assigned_to).single()
        setAgent(agentData)
      } else {
        setAgent(null)
      }
    }

    setActivities((activitiesRes.data as any) || [])
    setStages(stagesRes.data || [])
    setReminders(remindersRes.data || [])
    setAgents(agentsRes.data || [])
    setLoading(false)
  }, [id, supabase, isAdminOrManager])

  useEffect(() => {
    if (!id) return
    fetchLead()
  }, [id, fetchLead])

  // ========================================
  // EDIT LEAD
  // ========================================

  /** Pre-populate edit form with current lead data */
  function startEditing() {
    if (!lead) return
    setEditForm({
      first_name: lead.first_name || '',
      last_name: lead.last_name || '',
      phone: lead.phone || '',
      email: lead.email || '',
      destination: lead.destination || '',
      travel_date_from: lead.travel_date_from || '',
      travel_date_to: lead.travel_date_to || '',
      nr_adults: lead.nr_adults,
      nr_children: lead.nr_children,
      children_ages: lead.children_ages || '',
      budget_range: lead.budget_range || '',
      trip_type: lead.trip_type || '',
      message: lead.message || '',
      priority: lead.priority,
    })
    setEditing(true)
  }

  /** Save edited lead — empty strings become null */
  async function saveEdit() {
    if (!lead) return
    setSaving(true)

    const updates: Database['public']['Tables']['leads']['Update'] = {
      first_name: editForm.first_name || null,
      last_name: editForm.last_name || null,
      phone: editForm.phone || null,
      email: editForm.email || null,
      destination: editForm.destination || null,
      travel_date_from: editForm.travel_date_from || null,
      travel_date_to: editForm.travel_date_to || null,
      nr_adults: Number(editForm.nr_adults) || 1,
      nr_children: Number(editForm.nr_children) || 0,
      children_ages: editForm.children_ages || null,
      budget_range: editForm.budget_range || null,
      trip_type: editForm.trip_type || null,
      message: editForm.message || null,
      priority: editForm.priority,
    }

    await supabase.from('leads').update(updates).eq('id', lead.id)
    await supabase.from('lead_activities').insert({
      lead_id: lead.id, user_id: profile!.id, type: 'edit', content: 'Date lead actualizate',
    })

    setEditing(false)
    setSaving(false)
    toast({ title: 'Lead actualizat', variant: 'success' })
    fetchLead()
  }

  // ========================================
  // STATUS CHANGE
  // ========================================

  async function handleStatusChange(newStatus: string) {
    if (!lead) return
    setShowStatusDropdown(false)

    if (newStatus === 'lost') {
      setShowLostModal(true)
      return
    }
    if (newStatus === 'won') {
      setShowWonModal(true)
      return
    }

    await applyStatusChange(newStatus)
  }

  /** Apply status change to DB + log activity */
  async function applyStatusChange(newStatus: string, reason?: string, value?: number | null) {
    if (!lead) return
    const updates: Database['public']['Tables']['leads']['Update'] = { status: newStatus }
    if (reason) updates.lost_reason = reason
    if (value !== undefined) updates.won_value = value
    if (newStatus !== 'new' && !lead.first_response_at) {
      updates.first_response_at = new Date().toISOString()
    }

    await supabase.from('leads').update(updates).eq('id', lead.id)
    await supabase.from('lead_activities').insert({
      lead_id: lead.id, user_id: profile!.id, type: 'status_change',
      content: reason ? `Motiv: ${reason}` : value ? `Valoare: ${value} EUR` : null,
      metadata: { from_status: lead.status, to_status: newStatus },
    })

    const stageName = stages.find(s => s.slug === newStatus)?.name || newStatus
    toast({ title: `Status: ${stageName}`, variant: newStatus === 'lost' ? 'warning' : 'success' })

    setShowLostModal(false)
    setShowWonModal(false)
    setLostReason('')
    setLostReasonCustom('')
    setWonValue('')
    fetchLead()
  }

  // ========================================
  // COMMENT
  // ========================================

  async function handleComment(e: React.FormEvent) {
    e.preventDefault()
    if (!comment.trim() || !lead) return
    setSendingComment(true)
    await supabase.from('lead_activities').insert({
      lead_id: lead.id, user_id: profile!.id, type: 'comment', content: comment.trim(),
    })
    setComment('')
    setSendingComment(false)
    toast({ title: 'Comentariu adăugat', variant: 'info' })
    fetchLead()
  }

  // ========================================
  // REMINDER
  // ========================================

  async function handleReminder(e: React.FormEvent) {
    e.preventDefault()
    if (!reminderDate || !lead) return
    await supabase.from('reminders').insert({
      lead_id: lead.id, user_id: profile!.id,
      remind_at: new Date(reminderDate).toISOString(), note: reminderNote || null,
    })
    await supabase.from('lead_activities').insert({
      lead_id: lead.id, user_id: profile!.id, type: 'reminder_set',
      content: `Reminder: ${reminderNote || 'Follow-up'} — ${new Date(reminderDate).toLocaleDateString('ro-RO')}`,
    })
    setShowReminderForm(false)
    setReminderDate('')
    setReminderNote('')
    toast({ title: 'Reminder setat', variant: 'success' })
    fetchLead()
  }

  // ========================================
  // RE-ASSIGN
  // ========================================

  async function reassignLead(agentId: string) {
    if (!lead) return
    const agentName = agents.find(a => a.id === agentId)?.full_name || 'agent'

    await supabase.from('leads').update({
      assigned_to: agentId, assigned_by: profile!.id, assigned_at: new Date().toISOString(),
    }).eq('id', lead.id)

    await supabase.from('lead_activities').insert({
      lead_id: lead.id, user_id: profile!.id, type: 'assignment',
      content: `Lead realocat către ${agentName}`, metadata: { assigned_to: agentId },
    })
    await supabase.from('notifications').insert({
      user_id: agentId, type: 'lead_assigned', title: 'Lead realocat',
      body: `${fullName(lead.first_name, lead.last_name)} — ${lead.destination || 'fără destinație'}`,
      lead_id: lead.id,
    })

    setShowAssignDropdown(false)
    toast({ title: `Lead realocat către ${agentName}`, variant: 'success' })
    fetchLead()
  }

  // ========================================
  // DELETE
  // ========================================

  async function handleDelete() {
    if (!lead) return
    setDeleting(true)
    await supabase.from('leads').delete().eq('id', lead.id)
    setDeleting(false)
    toast({ title: 'Lead șters', variant: 'warning' })
    router.push('/leads')
  }

  // ========================================
  // LOADING STATE
  // ========================================

  if (loading || !lead) {
    return (
      <>
        <Header />
        <div className="p-6 animate-pulse">
          <div className="h-6 bg-slate-100 dark:bg-slate-800 rounded w-48 mb-6" />
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 space-y-4">
              <div className="h-48 bg-slate-100 dark:bg-slate-800 rounded-xl" />
              <div className="h-64 bg-slate-100 dark:bg-slate-800 rounded-xl" />
            </div>
            <div className="h-80 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          </div>
        </div>
      </>
    )
  }

  const currentStage = stages.find((s) => s.slug === lead.status)
  const inputClass = "w-full px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"

  // ========================================
  // RENDER
  // ========================================

  return (
    <>
      <Header />
      <div className="p-6">

        {/* ===== TOP BAR: Back + Delete + Status ===== */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
            <ArrowLeft size={16} /> Înapoi
          </button>

          <div className="flex items-center gap-2">
            {/* Delete — admin only */}
            {isAdmin && (
              <button onClick={() => setShowDeleteModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors">
                <Trash2 size={14} /> Șterge
              </button>
            )}

            {/* Status dropdown */}
            <div className="relative">
              <button onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium border rounded-lg transition-colors"
                style={{
                  color: currentStage?.color || '#64748b',
                  borderColor: (currentStage?.color || '#64748b') + '40',
                  backgroundColor: (currentStage?.color || '#64748b') + '08',
                }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: currentStage?.color ?? undefined }} />
                {currentStage?.name || lead.status}
                <ChevronDown size={14} />
              </button>

              {showStatusDropdown && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-10 py-1 max-h-80 overflow-y-auto">
                  {stages.map((stage) => (
                    <button key={stage.id} onClick={() => handleStatusChange(stage.slug)}
                      disabled={stage.slug === lead.status}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${stage.slug === lead.status ? 'text-slate-300 dark:text-slate-600 cursor-default' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}>
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color ?? undefined }} />
                      {stage.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* ===== LEFT COLUMN: Info + Comments + Timeline ===== */}
          <div className="col-span-2 space-y-6">

            {/* Lead info card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
              {/* Edit toggle */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  {!editing && (
                    <button onClick={startEditing} className="p-1 rounded text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors" title="Editează">
                      <Pencil size={14} />
                    </button>
                  )}
                  {editing && (
                    <div className="flex items-center gap-1">
                      <button onClick={saveEdit} disabled={saving} className="p-1 rounded text-green-600 hover:bg-green-50 dark:hover:bg-green-950 transition-colors" title="Salvează">
                        <Check size={16} />
                      </button>
                      <button onClick={() => setEditing(false)} className="p-1 rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Anulează">
                        <X size={16} />
                      </button>
                    </div>
                  )}
                </div>
                {!editing && <PriorityBadge priority={lead.priority} size="md" />}
              </div>

              {editing ? (
                /* --- EDIT MODE --- */
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Prenume</label>
                      <input type="text" value={editForm.first_name} onChange={(e) => setEditForm(f => ({ ...f, first_name: e.target.value }))} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Nume</label>
                      <input type="text" value={editForm.last_name} onChange={(e) => setEditForm(f => ({ ...f, last_name: e.target.value }))} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Telefon</label>
                      <input type="tel" value={editForm.phone} onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Email</label>
                      <input type="email" value={editForm.email} onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))} className={inputClass} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Destinație</label>
                      <input type="text" value={editForm.destination} onChange={(e) => setEditForm(f => ({ ...f, destination: e.target.value }))} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Tip călătorie</label>
                      <select value={editForm.trip_type} onChange={(e) => setEditForm(f => ({ ...f, trip_type: e.target.value }))} className={inputClass}>
                        <option value="">—</option>
                        {TRIP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Plecare</label>
                      <input type="date" value={editForm.travel_date_from} onChange={(e) => setEditForm(f => ({ ...f, travel_date_from: e.target.value }))} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Întoarcere</label>
                      <input type="date" value={editForm.travel_date_to} onChange={(e) => setEditForm(f => ({ ...f, travel_date_to: e.target.value }))} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Adulți</label>
                      <input type="number" min={1} max={20} value={editForm.nr_adults} onChange={(e) => setEditForm(f => ({ ...f, nr_adults: Number(e.target.value) }))} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Copii</label>
                      <input type="number" min={0} max={10} value={editForm.nr_children} onChange={(e) => setEditForm(f => ({ ...f, nr_children: Number(e.target.value) }))} className={inputClass} />
                    </div>
                    {editForm.nr_children > 0 && (
                      <div className="col-span-2">
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Vârste copii</label>
                        <input type="text" value={editForm.children_ages} onChange={(e) => setEditForm(f => ({ ...f, children_ages: e.target.value }))} className={inputClass} placeholder="ex: 4, 7" />
                      </div>
                    )}
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Buget</label>
                      <input type="text" value={editForm.budget_range} onChange={(e) => setEditForm(f => ({ ...f, budget_range: e.target.value }))} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Prioritate</label>
                      <select value={editForm.priority} onChange={(e) => setEditForm(f => ({ ...f, priority: e.target.value as Lead['priority'] }))} className={inputClass}>
                        <option value="low">Scăzut</option>
                        <option value="medium">Mediu</option>
                        <option value="high">Ridicat</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Mesaj / Note</label>
                    <textarea rows={3} value={editForm.message} onChange={(e) => setEditForm(f => ({ ...f, message: e.target.value }))} className={inputClass + ' resize-none'} />
                  </div>
                </div>
              ) : (
                /* --- VIEW MODE --- */
                <>
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                    {fullName(lead.first_name, lead.last_name)}
                  </h2>
                  <div className="flex items-center gap-3 mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                    {lead.phone && <span className="flex items-center gap-1"><Phone size={13} /> {formatPhone(lead.phone)}</span>}
                    {lead.email && <span className="flex items-center gap-1"><Mail size={13} /> {lead.email}</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm mt-4">
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                      <MapPin size={14} /> <span className="text-slate-700 dark:text-slate-300">{lead.destination || '—'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                      <Calendar size={14} /> <span className="text-slate-700 dark:text-slate-300">{formatTravelDates(lead.travel_date_from, lead.travel_date_to)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                      <Users size={14} /> <span className="text-slate-700 dark:text-slate-300">{formatTravelers(lead.nr_adults, lead.nr_children)}{lead.children_ages ? ` (${lead.children_ages} ani)` : ''}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                      <Wallet size={14} /> <span className="text-slate-700 dark:text-slate-300">{lead.budget_range || '—'}</span>
                    </div>
                  </div>
                  {lead.message && (
                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                      <p className="text-xs text-slate-400 mb-1">Mesaj original</p>
                      <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{lead.message}</p>
                    </div>
                  )}
                  {lead.tags && lead.tags.length > 0 && (
                    <div className="mt-3 flex items-center gap-1.5">
                      <Tag size={12} className="text-slate-400" />
                      {lead.tags.map((tag) => (
                        <span key={tag} className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded">{tag}</span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Comment form */}
            <form onSubmit={handleComment} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2}
                placeholder="Scrie o notă sau comentariu..."
                className="w-full text-sm bg-transparent border-0 focus:ring-0 resize-none placeholder:text-slate-400 p-0 text-slate-900 dark:text-slate-100" />
              <div className="flex justify-end mt-2">
                <button type="submit" disabled={!comment.trim() || sendingComment}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-30 transition-colors">
                  <Send size={12} /> Trimite
                </button>
              </div>
            </form>

            {/* ===== TIMELINE ===== */}
            <LeadTimeline
              activities={activities}
              stages={stages}
              onRefresh={fetchLead}
            />
          </div>

          {/* ===== RIGHT COLUMN: Meta + Actions ===== */}
          <div className="space-y-4">
            {/* Meta info */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">Sursă</span>
                <SourceIcon source={lead.source} size="md" showLabel label={lead.source_detail || lead.source} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">Agent</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-900 dark:text-slate-100">{agent?.full_name || 'Nealocat'}</span>
                  {isAdminOrManager && (
                    <div className="relative">
                      <button onClick={() => setShowAssignDropdown(!showAssignDropdown)}
                        className="p-1 rounded text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950" title="Realocă">
                        <UserPlus size={13} />
                      </button>
                      {showAssignDropdown && (
                        <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-10 py-1">
                          {agents.map((a) => (
                            <button key={a.id} onClick={() => reassignLead(a.id)}
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 ${a.id === lead.assigned_to ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-slate-700 dark:text-slate-300'}`}>
                              {a.full_name} {a.id === lead.assigned_to && '✓'}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Creat</span>
                <span className="text-slate-700 dark:text-slate-300 text-xs">{formatDateTime(lead.created_at)}</span>
              </div>
              {lead.assigned_at && (
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Alocat</span>
                  <span className="text-slate-700 dark:text-slate-300 text-xs">{formatDateTime(lead.assigned_at)}</span>
                </div>
              )}
              {lead.first_response_at && (
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Prim răspuns</span>
                  <span className="text-slate-700 dark:text-slate-300 text-xs">{formatDateTime(lead.first_response_at)}</span>
                </div>
              )}
              {lead.won_value && (
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Valoare</span>
                  <span className="text-green-600 font-medium text-xs">{lead.won_value} EUR</span>
                </div>
              )}
              {lead.lost_reason && (
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Motiv pierdere</span>
                  <span className="text-red-600 dark:text-red-400 text-xs">{lead.lost_reason}</span>
                </div>
              )}
            </div>

            {/* Reminder button */}
            <button onClick={() => setShowReminderForm(!showReminderForm)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <Bell size={15} /> Setează Reminder
            </button>

            {showReminderForm && (
              <form onSubmit={handleReminder} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Data și ora</label>
                  <input type="datetime-local" value={reminderDate} onChange={(e) => setReminderDate(e.target.value)} required className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Notă</label>
                  <input type="text" value={reminderNote} onChange={(e) => setReminderNote(e.target.value)} placeholder="Follow-up ofertă..." className={inputClass} />
                </div>
                <button type="submit" className="w-full py-2 text-sm font-medium bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors">
                  Salvează Reminder
                </button>
              </form>
            )}

            {/* Active reminders */}
            {reminders.filter(r => !r.is_completed).length > 0 && (
              <div className="bg-orange-50 dark:bg-orange-950 border border-orange-100 dark:border-orange-900 rounded-xl p-4">
                <h4 className="text-xs font-medium text-orange-800 dark:text-orange-300 mb-2">Remindere active</h4>
                {reminders.filter(r => !r.is_completed).map((rem) => (
                  <div key={rem.id} className="flex items-center justify-between py-1.5 text-xs">
                    <div>
                      <span className="text-orange-700 dark:text-orange-400 font-medium">{new Date(rem.remind_at).toLocaleDateString('ro-RO')}</span>
                      {rem.note && <span className="text-orange-600 dark:text-orange-500 ml-2">{rem.note}</span>}
                    </div>
                    <button onClick={async () => {
                      await supabase.from('reminders').update({ is_completed: true, completed_at: new Date().toISOString() }).eq('id', rem.id)
                      toast({ title: 'Reminder completat', variant: 'info' })
                      fetchLead()
                    }} className="text-orange-500 hover:text-orange-700 dark:hover:text-orange-300 text-[10px] font-medium">
                      Completat
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== LOST REASON MODAL ===== */}
      {showLostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-md p-6 mx-4 border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">Motiv pierdere</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Selectează motivul pentru care lead-ul a fost pierdut.</p>
            <div className="space-y-2 mb-4">
              {LOST_REASONS.map((reason) => (
                <label key={reason} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="lost_reason" value={reason} checked={lostReason === reason} onChange={() => setLostReason(reason)}
                    className="w-4 h-4 text-blue-600 border-slate-300 dark:border-slate-600 focus:ring-blue-500" />
                  <span className="text-sm text-slate-700 dark:text-slate-300">{reason}</span>
                </label>
              ))}
            </div>
            {lostReason === 'Altul' && (
              <input type="text" value={lostReasonCustom} onChange={(e) => setLostReasonCustom(e.target.value)} placeholder="Descrie motivul..." className={inputClass + ' mb-4'} />
            )}
            <div className="flex items-center gap-3 justify-end">
              <button onClick={() => { setShowLostModal(false); setLostReason('') }} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400">Anulează</button>
              <button disabled={!lostReason || (lostReason === 'Altul' && !lostReasonCustom)}
                onClick={() => applyStatusChange('lost', lostReason === 'Altul' ? lostReasonCustom : lostReason)}
                className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors">
                Marchează ca Pierdut
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== WON VALUE MODAL ===== */}
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
              <input type="number" min={0} step={0.01} value={wonValue} onChange={(e) => setWonValue(e.target.value)}
                placeholder="ex: 2500" autoFocus className={inputClass} />
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => { setShowWonModal(false); setWonValue('') }}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                Anulează
              </button>
              <button onClick={() => applyStatusChange('won', undefined, wonValue ? Number(wonValue) : null)}
                className="flex-1 px-4 py-2.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                Confirmă
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== DELETE MODAL ===== */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-sm p-6 mx-4 border border-slate-200 dark:border-slate-700">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={24} />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 text-center mb-1">Șterge lead</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6">
              Ești sigur că vrei să ștergi acest lead? Acțiunea este permanentă și <strong>nu poate fi anulată</strong>. Toate comentariile, reminder-ele și activitățile asociate vor fi șterse.
            </p>
            <div className="flex items-center gap-3">
              <button onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                Anulează
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 px-4 py-2.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors">
                {deleting ? 'Se șterge...' : 'Șterge definitiv'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}