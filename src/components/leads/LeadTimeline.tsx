'use client'

/**
 * src/components/leads/LeadTimeline.tsx
 *
 * LeadTimeline Component
 *
 * Displays chronological activity for a lead:
 * - Status changes, comments, assignments, reminders, edits, system events
 *
 * Editare/ștergere — vezi canEdit()/canDelete() mai jos:
 * - Editare: doar comentarii proprii (conținut liber); admin poate edita
 *   comentariul oricui. Alte tipuri (status_change, assignment etc.) n-au
 *   conținut liber de editat.
 * - Ștergere: proprii comentarii, ca și până acum — DAR adminul poate
 *   șterge ORICE înregistrare din timeline, de orice tip și de la orice
 *   utilizator (inclusiv evenimente generate de sistem, cu user_id NULL).
 *   RLS deja permitea asta la nivel de DB (migrarea 002: `user_id =
 *   auth.uid() OR is_admin()`, fără restricție de tip) — era doar
 *   restricționat aici, în UI.
 */

import { useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import type { LeadActivity, PipelineStage, Profile } from '@/lib/types/database'
import { formatDateTime } from '@/lib/utils'
import {
  MessageSquare, Clock, Users, Bell, Pencil, AlertCircle,
  Mail, Phone, Trash2, Check, X,
} from 'lucide-react'

/** Icon + color config per activity type */
const ACTIVITY_ICONS: Record<string, { icon: typeof Clock; color: string }> = {
  comment:       { icon: MessageSquare, color: 'bg-blue-50 dark:bg-blue-950 text-blue-500' },
  status_change: { icon: Clock,         color: 'bg-green-50 dark:bg-green-950 text-green-500' },
  assignment:    { icon: Users,         color: 'bg-indigo-50 dark:bg-indigo-950 text-indigo-500' },
  reminder_set:  { icon: Bell,          color: 'bg-orange-50 dark:bg-orange-950 text-orange-500' },
  edit:          { icon: Pencil,        color: 'bg-amber-50 dark:bg-amber-950 text-amber-500' },
  system:        { icon: AlertCircle,   color: 'bg-slate-100 dark:bg-slate-800 text-slate-400' },
  email_sent:    { icon: Mail,          color: 'bg-cyan-50 dark:bg-cyan-950 text-cyan-500' },
  call_logged:   { icon: Phone,         color: 'bg-green-50 dark:bg-green-950 text-green-500' },
}

interface LeadTimelineProps {
  activities: (LeadActivity & { user?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'> | null })[]
  stages: PipelineStage[]
  onRefresh: () => void
}

export function LeadTimeline({ activities, stages, onRefresh }: LeadTimelineProps) {
  const { profile, isAdmin } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()

  // --- Edit state ---
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  // --- Delete state ---
  const [deletingId, setDeletingId] = useState<string | null>(null)

  /** Poate edita această activitate? — doar comentarii (conținut liber);
      owner sau admin. */
  function canEdit(activity: LeadActivity & { user?: Pick<Profile, 'id'> | null }): boolean {
    if (activity.type !== 'comment') return false
    if (isAdmin) return true
    return activity.user_id === profile?.id
  }

  /** Poate șterge această activitate? — adminul poate șterge orice tip, de
      la oricine; restul utilizatorilor doar comentariile proprii, ca și
      până acum. */
  function canDelete(activity: LeadActivity & { user?: Pick<Profile, 'id'> | null }): boolean {
    if (isAdmin) return true
    if (activity.type !== 'comment') return false
    return activity.user_id === profile?.id
  }

  /** Start editing a comment */
  function startEdit(activity: LeadActivity) {
    setEditingId(activity.id)
    setEditText(activity.content || '')
  }

  /** Save edited comment */
  async function saveEdit(activityId: string) {
    if (!editText.trim()) return

    await supabase
      .from('lead_activities')
      .update({ content: editText.trim() })
      .eq('id', activityId)

    setEditingId(null)
    setEditText('')
    toast({ title: 'Comentariu actualizat', variant: 'info' })
    onRefresh()
  }

  /** Șterge o înregistrare din timeline — comentariu sau (doar admin)
      orice alt tip de eveniment. */
  async function deleteActivity(activity: LeadActivity) {
    await supabase
      .from('lead_activities')
      .delete()
      .eq('id', activity.id)

    setDeletingId(null)
    toast({ title: activity.type === 'comment' ? 'Comentariu șters' : 'Înregistrare ștearsă', variant: 'warning' })
    onRefresh()
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-3">Timeline</h3>
      <div className="space-y-0">
        {activities.map((activity) => {
          const cfg = ACTIVITY_ICONS[activity.type] || ACTIVITY_ICONS.system
          const ActivityIcon = cfg.icon
          const isEditing = editingId === activity.id
          const isDeleting = deletingId === activity.id
          const editable = canEdit(activity)
          const deletable = canDelete(activity)

          return (
            <div key={activity.id} className="flex gap-3 py-3 border-b border-slate-50 dark:border-slate-800 last:border-0 group">
              {/* Activity icon */}
              <div className={`w-7 h-7 rounded-full ${cfg.color} flex items-center justify-center mt-0.5 flex-shrink-0`}>
                <ActivityIcon size={13} />
              </div>

              <div className="flex-1 min-w-0">
                {/* Header: user + timestamp + edit/delete actions */}
                <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-xs text-slate-400">
                  <span className="font-medium text-slate-600 dark:text-slate-300 truncate max-w-[60vw] sm:max-w-none">
                    {activity.user?.full_name || 'Sistem'}
                  </span>
                  <span>·</span>
                  <span className="shrink-0">{formatDateTime(activity.created_at)}</span>

                  {/* Edit/Delete buttons — vizibile mereu pe mobil/tabletă (nu există
                      hover pe touch, deci un admin de pe telefon n-ar putea niciodată
                      să le atingă); pe desktop rămân ascunse până la hover pe rând,
                      ca să nu aglomereze vizual timeline-ul. */}
                  {(editable || deletable) && !isEditing && !isDeleting && (
                    <div className="ml-auto flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      {editable && (
                        <button onClick={() => startEdit(activity)}
                          className="p-1.5 sm:p-1 rounded text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950"
                          title="Editează comentariu">
                          <Pencil size={12} />
                        </button>
                      )}
                      {deletable && (
                        <button onClick={() => setDeletingId(activity.id)}
                          className="p-1.5 sm:p-1 rounded text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950"
                          title={activity.type === 'comment' ? 'Șterge comentariu' : 'Șterge înregistrare'}>
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Status change display */}
                {activity.type === 'status_change' && activity.metadata && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                    Status:{' '}
                    <span className="font-medium">
                      {stages.find(s => s.slug === (activity.metadata as any)?.from_status)?.name || (activity.metadata as any)?.from_status}
                    </span>
                    {' → '}
                    <span className="font-medium">
                      {stages.find(s => s.slug === (activity.metadata as any)?.to_status)?.name || (activity.metadata as any)?.to_status}
                    </span>
                  </p>
                )}

                {/* Comment content — normal or edit mode */}
                {isEditing ? (
                  <div className="mt-1.5">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={2}
                      autoFocus
                      className="w-full px-3 py-1.5 text-sm border border-blue-300 dark:border-blue-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                    <div className="flex items-center gap-1 mt-1">
                      <button onClick={() => saveEdit(activity.id)}
                        disabled={!editText.trim()}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-30 transition-colors">
                        <Check size={11} /> Salvează
                      </button>
                      <button onClick={() => { setEditingId(null); setEditText('') }}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                        <X size={11} /> Anulează
                      </button>
                    </div>
                  </div>
                ) : isDeleting ? (
                  /* Delete confirmation inline */
                  <div className="mt-1.5 flex items-center gap-2 text-xs">
                    <span className="text-red-600 dark:text-red-400">
                      {activity.type === 'comment' ? 'Ștergi acest comentariu?' : 'Ștergi această înregistrare din timeline?'}
                    </span>
                    <button onClick={() => deleteActivity(activity)}
                      className="px-2 py-1 font-medium bg-red-600 text-white rounded hover:bg-red-700 transition-colors">
                      Da, șterge
                    </button>
                    <button onClick={() => setDeletingId(null)}
                      className="px-2 py-1 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                      Anulează
                    </button>
                  </div>
                ) : (
                  /* Normal content display */
                  activity.content && (
                    <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5 whitespace-pre-wrap">
                      {activity.content}
                    </p>
                  )
                )}
              </div>
            </div>
          )
        })}

        {activities.length === 0 && (
          <p className="text-sm text-slate-400 py-6 text-center">Nicio activitate încă.</p>
        )}
      </div>
    </div>
  )
}
