'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import type { Lead, LeadActivity, PipelineStage, Profile, Reminder } from '@/lib/types/database'
import { fullName, timeAgo, formatDateTime, formatTravelDates, formatTravelers, formatPhone } from '@/lib/utils'
import { SOURCE_ICONS, PRIORITY_CONFIG, LOST_REASONS } from '@/lib/utils/constants'
import {
  ArrowLeft, Phone, Mail, MapPin, Calendar, Users, Wallet,
  MessageSquare, Clock, Bell, Tag, ChevronDown, Send, AlertCircle
} from 'lucide-react'
import Link from 'next/link'

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { profile, isAdminOrManager } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [lead, setLead] = useState<Lead | null>(null)
  const [agent, setAgent] = useState<Profile | null>(null)
  const [activities, setActivities] = useState<(LeadActivity & { user?: Profile | null })[]>([])
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)

  // Comment form
  const [comment, setComment] = useState('')
  const [sendingComment, setSendingComment] = useState(false)

  // Status change
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)
  const [showLostModal, setShowLostModal] = useState(false)
  const [lostReason, setLostReason] = useState('')
  const [lostReasonCustom, setLostReasonCustom] = useState('')
  const [pendingStatus, setPendingStatus] = useState<string | null>(null)

  // Reminder
  const [showReminderForm, setShowReminderForm] = useState(false)
  const [reminderDate, setReminderDate] = useState('')
  const [reminderNote, setReminderNote] = useState('')

  const fetchLead = useCallback(async () => {
    const [leadRes, activitiesRes, stagesRes, remindersRes] = await Promise.all([
      supabase.from('leads').select('*').eq('id', id).single(),
      supabase
        .from('lead_activities')
        .select('*, user:profiles(id, full_name, avatar_url)')
        .eq('lead_id', id)
        .order('created_at', { ascending: false }),
      supabase.from('pipeline_stages').select('*').order('display_order'),
      supabase
        .from('reminders')
        .select('*')
        .eq('lead_id', id)
        .order('remind_at', { ascending: true }),
    ])

    if (leadRes.data) {
      setLead(leadRes.data)
      // Fetch assigned agent
      if (leadRes.data.assigned_to) {
        const { data: agentData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', leadRes.data.assigned_to)
          .single()
        setAgent(agentData)
      }
    }

    setActivities((activitiesRes.data as any) || [])
    setStages(stagesRes.data || [])
    setReminders(remindersRes.data || [])
    setLoading(false)
  }, [id, supabase])

  useEffect(() => {
    if (!id) return
    fetchLead()
  }, [id, fetchLead])

  async function handleStatusChange(newStatus: string) {
    if (!lead) return

    if (newStatus === 'lost') {
      setPendingStatus(newStatus)
      setShowLostModal(true)
      setShowStatusDropdown(false)
      return
    }

    await applyStatusChange(newStatus)
  }

  async function applyStatusChange(newStatus: string, reason?: string) {
    if (!lead) return

    const updates: Record<string, any> = { status: newStatus }
    if (reason) updates.lost_reason = reason
    if (newStatus !== 'new' && !lead.first_response_at) {
      updates.first_response_at = new Date().toISOString()
    }

    await supabase.from('leads').update(updates).eq('id', lead.id)

    await supabase.from('lead_activities').insert({
      lead_id: lead.id,
      user_id: profile!.id,
      type: 'status_change',
      content: reason ? `Motiv: ${reason}` : null,
      metadata: { from_status: lead.status, to_status: newStatus },
    })

    setShowStatusDropdown(false)
    setShowLostModal(false)
    setPendingStatus(null)
    setLostReason('')
    setLostReasonCustom('')
    fetchLead()
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault()
    if (!comment.trim() || !lead) return

    setSendingComment(true)
    await supabase.from('lead_activities').insert({
      lead_id: lead.id,
      user_id: profile!.id,
      type: 'comment',
      content: comment.trim(),
    })

    setComment('')
    setSendingComment(false)
    fetchLead()
  }

  async function handleReminder(e: React.FormEvent) {
    e.preventDefault()
    if (!reminderDate || !lead) return

    await supabase.from('reminders').insert({
      lead_id: lead.id,
      user_id: profile!.id,
      remind_at: new Date(reminderDate).toISOString(),
      note: reminderNote || null,
    })

    await supabase.from('lead_activities').insert({
      lead_id: lead.id,
      user_id: profile!.id,
      type: 'reminder_set',
      content: `Reminder: ${reminderNote || 'Follow-up'} — ${new Date(reminderDate).toLocaleDateString('ro-RO')}`,
    })

    setShowReminderForm(false)
    setReminderDate('')
    setReminderNote('')
    fetchLead()
  }

  if (loading || !lead) {
    return (
      <>
        <Header />
        <div className="p-6 animate-pulse">
          <div className="h-6 bg-slate-100 rounded w-48 mb-6" />
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 space-y-4">
              <div className="h-40 bg-slate-100 rounded-xl" />
              <div className="h-60 bg-slate-100 rounded-xl" />
            </div>
            <div className="h-80 bg-slate-100 rounded-xl" />
          </div>
        </div>
      </>
    )
  }

  const currentStage = stages.find((s) => s.slug === lead.status)

  return (
    <>
      <Header />
      <div className="p-6">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft size={16} />
            Înapoi
          </button>

          {/* Status dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowStatusDropdown(!showStatusDropdown)}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium border rounded-lg transition-colors"
              style={{
                color: currentStage?.color || '#64748b',
                borderColor: (currentStage?.color || '#64748b') + '40',
                backgroundColor: (currentStage?.color || '#64748b') + '08',
              }}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: currentStage?.color }} />
              {currentStage?.name || lead.status}
              <ChevronDown size={14} />
            </button>

            {showStatusDropdown && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-10 py-1 max-h-80 overflow-y-auto">
                {stages.map((stage) => (
                  <button
                    key={stage.id}
                    onClick={() => handleStatusChange(stage.slug)}
                    disabled={stage.slug === lead.status}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                      stage.slug === lead.status
                        ? 'text-slate-300 cursor-default'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color || '#94a3b8' }} />
                    {stage.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Left column - main info + timeline */}
          <div className="col-span-2 space-y-6">
            {/* Lead info card */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    {fullName(lead.first_name, lead.last_name)}
                  </h2>
                  <div className="flex items-center gap-3 mt-1.5 text-sm text-slate-500">
                    {lead.phone && (
                      <span className="flex items-center gap-1">
                        <Phone size={13} /> {formatPhone(lead.phone)}
                      </span>
                    )}
                    {lead.email && (
                      <span className="flex items-center gap-1">
                        <Mail size={13} /> {lead.email}
                      </span>
                    )}
                  </div>
                </div>
                <span
                  className="text-xs px-2 py-1 rounded font-medium"
                  style={{
                    color: PRIORITY_CONFIG[lead.priority]?.color,
                    backgroundColor: PRIORITY_CONFIG[lead.priority]?.bgColor,
                  }}
                >
                  {PRIORITY_CONFIG[lead.priority]?.label}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                <div className="flex items-center gap-2 text-slate-500">
                  <MapPin size={14} />
                  <span className="text-slate-700">{lead.destination || '—'}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-500">
                  <Calendar size={14} />
                  <span className="text-slate-700">
                    {formatTravelDates(lead.travel_date_from, lead.travel_date_to)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-500">
                  <Users size={14} />
                  <span className="text-slate-700">
                    {formatTravelers(lead.nr_adults, lead.nr_children)}
                    {lead.children_ages ? ` (${lead.children_ages} ani)` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-500">
                  <Wallet size={14} />
                  <span className="text-slate-700">{lead.budget_range || '—'}</span>
                </div>
              </div>

              {lead.message && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-xs text-slate-400 mb-1">Mesaj original</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{lead.message}</p>
                </div>
              )}

              {lead.tags && lead.tags.length > 0 && (
                <div className="mt-3 flex items-center gap-1.5">
                  <Tag size={12} className="text-slate-400" />
                  {lead.tags.map((tag) => (
                    <span key={tag} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Comment form */}
            <form onSubmit={handleComment} className="bg-white border border-slate-200 rounded-xl p-4">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                placeholder="Scrie o notă sau comentariu..."
                className="w-full text-sm border-0 focus:ring-0 resize-none placeholder:text-slate-400 p-0"
              />
              <div className="flex justify-end mt-2">
                <button
                  type="submit"
                  disabled={!comment.trim() || sendingComment}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg
                             hover:bg-blue-700 disabled:opacity-30 transition-colors"
                >
                  <Send size={12} />
                  Trimite
                </button>
              </div>
            </form>

            {/* Timeline */}
            <div>
              <h3 className="text-sm font-medium text-slate-900 mb-3">Timeline</h3>
              <div className="space-y-0">
                {activities.map((activity) => (
                  <div key={activity.id} className="flex gap-3 py-3 border-b border-slate-50 last:border-0">
                    <div className="mt-0.5">
                      {activity.type === 'comment' && (
                        <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center">
                          <MessageSquare size={13} />
                        </div>
                      )}
                      {activity.type === 'status_change' && (
                        <div className="w-7 h-7 rounded-full bg-green-50 text-green-500 flex items-center justify-center">
                          <Clock size={13} />
                        </div>
                      )}
                      {activity.type === 'assignment' && (
                        <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center">
                          <Users size={13} />
                        </div>
                      )}
                      {activity.type === 'reminder_set' && (
                        <div className="w-7 h-7 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center">
                          <Bell size={13} />
                        </div>
                      )}
                      {activity.type === 'system' && (
                        <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                          <AlertCircle size={13} />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span className="font-medium text-slate-600">
                          {(activity as any).user?.full_name || 'Sistem'}
                        </span>
                        <span>•</span>
                        <span>{formatDateTime(activity.created_at)}</span>
                      </div>

                      {activity.type === 'status_change' && activity.metadata && (
                        <p className="text-sm text-slate-600 mt-0.5">
                          Status schimbat:{' '}
                          <span className="font-medium">
                            {stages.find((s) => s.slug === (activity.metadata as any)?.from_status)?.name || (activity.metadata as any)?.from_status}
                          </span>
                          {' → '}
                          <span className="font-medium">
                            {stages.find((s) => s.slug === (activity.metadata as any)?.to_status)?.name || (activity.metadata as any)?.to_status}
                          </span>
                        </p>
                      )}

                      {activity.content && (
                        <p className="text-sm text-slate-700 mt-0.5 whitespace-pre-wrap">
                          {activity.content}
                        </p>
                      )}
                    </div>
                  </div>
                ))}

                {activities.length === 0 && (
                  <p className="text-sm text-slate-400 py-6 text-center">Nicio activitate încă.</p>
                )}
              </div>
            </div>
          </div>

          {/* Right column - metadata + actions */}
          <div className="space-y-4">
            {/* Meta info */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Sursă</span>
                <span className="text-slate-900">{SOURCE_ICONS[lead.source]} {lead.source_detail || lead.source}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Agent</span>
                <span className="text-slate-900">{agent?.full_name || 'Nealocat'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Creat</span>
                <span className="text-slate-700 text-xs">{formatDateTime(lead.created_at)}</span>
              </div>
              {lead.assigned_at && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Alocat</span>
                  <span className="text-slate-700 text-xs">{formatDateTime(lead.assigned_at)}</span>
                </div>
              )}
              {lead.first_response_at && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Prim răspuns</span>
                  <span className="text-slate-700 text-xs">{formatDateTime(lead.first_response_at)}</span>
                </div>
              )}
              {lead.lost_reason && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Motiv pierdere</span>
                  <span className="text-red-600 text-xs">{lead.lost_reason}</span>
                </div>
              )}
            </div>

            {/* Reminder button */}
            <button
              onClick={() => setShowReminderForm(!showReminderForm)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium
                         border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Bell size={15} />
              Setează Reminder
            </button>

            {showReminderForm && (
              <form onSubmit={handleReminder} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Data și ora</label>
                  <input
                    type="datetime-local"
                    value={reminderDate}
                    onChange={(e) => setReminderDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Notă</label>
                  <input
                    type="text"
                    value={reminderNote}
                    onChange={(e) => setReminderNote(e.target.value)}
                    placeholder="Follow-up ofertă..."
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 text-sm font-medium bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                >
                  Salvează Reminder
                </button>
              </form>
            )}

            {/* Active reminders */}
            {reminders.filter((r) => !r.is_completed).length > 0 && (
              <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
                <h4 className="text-xs font-medium text-orange-800 mb-2">Remindere active</h4>
                {reminders
                  .filter((r) => !r.is_completed)
                  .map((rem) => (
                    <div key={rem.id} className="flex items-center justify-between py-1.5 text-xs">
                      <div>
                        <span className="text-orange-700 font-medium">
                          {new Date(rem.remind_at).toLocaleDateString('ro-RO')}
                        </span>
                        {rem.note && <span className="text-orange-600 ml-2">{rem.note}</span>}
                      </div>
                      <button
                        onClick={async () => {
                          await supabase.from('reminders').update({ is_completed: true, completed_at: new Date().toISOString() }).eq('id', rem.id)
                          fetchLead()
                        }}
                        className="text-orange-500 hover:text-orange-700 text-[10px] font-medium"
                      >
                        Completat
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lost Reason Modal */}
      {showLostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 mx-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Motiv pierdere</h3>
            <p className="text-sm text-slate-500 mb-4">Selectează motivul pentru care lead-ul a fost pierdut.</p>

            <div className="space-y-2 mb-4">
              {LOST_REASONS.map((reason) => (
                <label key={reason} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="lost_reason"
                    value={reason}
                    checked={lostReason === reason}
                    onChange={() => setLostReason(reason)}
                    className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700">{reason}</span>
                </label>
              ))}
            </div>

            {lostReason === 'Altul' && (
              <input
                type="text"
                value={lostReasonCustom}
                onChange={(e) => setLostReasonCustom(e.target.value)}
                placeholder="Descrie motivul..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              />
            )}

            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => {
                  setShowLostModal(false)
                  setPendingStatus(null)
                  setLostReason('')
                }}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900"
              >
                Anulează
              </button>
              <button
                disabled={!lostReason || (lostReason === 'Altul' && !lostReasonCustom)}
                onClick={() => {
                  const reason = lostReason === 'Altul' ? lostReasonCustom : lostReason
                  applyStatusChange('lost', reason)
                }}
                className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700
                           disabled:opacity-50 transition-colors"
              >
                Marchează ca Pierdut
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
