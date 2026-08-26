/**
 * src/app/(app)/leads/[id]/page.tsx
 *
 * Lead Detail Page — Pagina completă pentru un lead
 *
 * Owner de state și logică (fetch, mutații Supabase, toasturi) pentru
 * pagina de detaliu a unui lead. Randarea propriu-zisă e delegată unor
 * componente mici din src/components/leads/lead-detail/*, astfel încât
 * acest fișier rămâne axat pe date/handlere, nu pe markup.
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

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import type { Lead, LeadActivity, PipelineStage, Profile, Reminder, Database } from '@/lib/types/database'
import { fullName } from '@/lib/utils'
import { LeadTimeline } from '@/components/leads/LeadTimeline'
import { StatusDropdown } from '@/components/leads/lead-detail/StatusDropdown'
import { LeadInfoCard, type LeadEditForm } from '@/components/leads/lead-detail/LeadInfoCard'
import { JinfocruiseDetailsPanel } from '@/components/leads/lead-detail/JinfocruiseDetailsPanel'
import { CommentForm } from '@/components/leads/lead-detail/CommentForm'
import { LeadMetaSidebar } from '@/components/leads/lead-detail/LeadMetaSidebar'
import { ReminderPanel } from '@/components/leads/lead-detail/ReminderPanel'
import { LostReasonModal, WonValueModal, DeleteLeadModal } from '@/components/leads/lead-detail/LeadActionModals'
import { ArrowLeft, Trash2 } from 'lucide-react'

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
  const [editForm, setEditForm] = useState<LeadEditForm>({
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

  /** Mark a reminder as completed (from the active-reminders list) */
  async function completeReminder(reminderId: string) {
    await supabase.from('reminders').update({ is_completed: true, completed_at: new Date().toISOString() }).eq('id', reminderId)
    toast({ title: 'Reminder completat', variant: 'info' })
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
        <div className="p-4 sm:p-6 animate-pulse">
          <div className="h-6 bg-slate-100 dark:bg-slate-800 rounded w-48 mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
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

  // JinfoCruise: `jinfocruise_request` și `jinfocruise_reservation` trimit date structurate
  // de croazieră în `source_raw_data.metadata` care nu au coloană dedicată în `leads`
  // (navă, cabină, tarif, breakdown preț, link) — le afișăm într-un panel separat, read-only.
  // `jinfocruise_contact` nu are date de croazieră (doar subject/source_url), deci nu afișează acest panel.
  const jinfocruiseMeta: any =
    lead.source === 'jinfocruise_request' || lead.source === 'jinfocruise_reservation'
      ? (lead.source_raw_data as any)?.metadata || {}
      : null
  const jinfocruisePassengers: any[] = Array.isArray(jinfocruiseMeta?.passengers) ? jinfocruiseMeta.passengers : []

  // ========================================
  // RENDER
  // ========================================

  return (
    <>
      <Header />
      <div className="p-4 sm:p-6">

        {/* ===== TOP BAR: Back + Delete + Status ===== */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <button onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
            <ArrowLeft size={16} /> Înapoi
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Delete — admin only */}
            {isAdmin && (
              <button onClick={() => setShowDeleteModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors">
                <Trash2 size={14} /> Șterge
              </button>
            )}

            <StatusDropdown
              stages={stages}
              currentStage={currentStage}
              currentStatus={lead.status}
              open={showStatusDropdown}
              onToggleOpen={() => setShowStatusDropdown(!showStatusDropdown)}
              onSelectStatus={handleStatusChange}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ===== LEFT COLUMN: Info + Comments + Timeline ===== */}
          <div className="lg:col-span-2 space-y-6">

            <LeadInfoCard
              lead={lead}
              editing={editing}
              editForm={editForm}
              onEditFormChange={setEditForm}
              onStartEditing={startEditing}
              onCancelEditing={() => setEditing(false)}
              onSave={saveEdit}
              saving={saving}
            />

            {/* Detalii croazieră — JinfoCruise (request/reservation), din source_raw_data.metadata */}
            {jinfocruiseMeta && (
              <JinfocruiseDetailsPanel source={lead.source} meta={jinfocruiseMeta} passengers={jinfocruisePassengers} />
            )}

            <CommentForm comment={comment} onCommentChange={setComment} onSubmit={handleComment} sending={sendingComment} />

            {/* ===== TIMELINE ===== */}
            <LeadTimeline
              activities={activities}
              stages={stages}
              onRefresh={fetchLead}
            />
          </div>

          {/* ===== RIGHT COLUMN: Meta + Actions ===== */}
          <div className="space-y-4">
            <LeadMetaSidebar
              lead={lead}
              agent={agent}
              agents={agents}
              isAdminOrManager={isAdminOrManager}
              showAssignDropdown={showAssignDropdown}
              onToggleAssignDropdown={() => setShowAssignDropdown(!showAssignDropdown)}
              onReassign={reassignLead}
            />

            <ReminderPanel
              show={showReminderForm}
              onToggleShow={() => setShowReminderForm(!showReminderForm)}
              reminderDate={reminderDate}
              onReminderDateChange={setReminderDate}
              reminderNote={reminderNote}
              onReminderNoteChange={setReminderNote}
              onSubmit={handleReminder}
              reminders={reminders}
              onCompleteReminder={completeReminder}
            />
          </div>
        </div>
      </div>

      {/* ===== LOST REASON MODAL ===== */}
      {showLostModal && (
        <LostReasonModal
          lostReason={lostReason}
          onLostReasonChange={setLostReason}
          lostReasonCustom={lostReasonCustom}
          onLostReasonCustomChange={setLostReasonCustom}
          onCancel={() => { setShowLostModal(false); setLostReason('') }}
          onConfirm={() => applyStatusChange('lost', lostReason === 'Altul' ? lostReasonCustom : lostReason)}
        />
      )}

      {/* ===== WON VALUE MODAL ===== */}
      {showWonModal && (
        <WonValueModal
          wonValue={wonValue}
          onWonValueChange={setWonValue}
          onCancel={() => { setShowWonModal(false); setWonValue('') }}
          onConfirm={() => applyStatusChange('won', undefined, wonValue ? Number(wonValue) : null)}
        />
      )}

      {/* ===== DELETE MODAL ===== */}
      {showDeleteModal && (
        <DeleteLeadModal
          deleting={deleting}
          onCancel={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
        />
      )}
    </>
  )
}
