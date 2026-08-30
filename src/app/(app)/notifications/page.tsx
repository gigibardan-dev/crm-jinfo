'use client'

/**
 * src/app/(app)/notifications/page.tsx
 *
 * Notifications Page
 *
 * Centru de notificări in-app, paginat (25/50/100 pe pagină, ca la
 * Pipeline/agent — vezi Pagination.tsx) — fără paginare lista creștea la
 * nesfârșit (doar ultimele 50 erau fixe, fără nicio cale să vezi restul).
 *
 * - Marcare individuală (click pe card, sau butonul dedicat „bifă") sau
 *   bulk ca citite.
 * - Ștergere: individuală (buton coș pe fiecare rând), în grup (checkbox
 *   pe fiecare rând + „Șterge selectate", cu confirmare inline), sau
 *   „Șterge citite" dintr-o mișcare (toate notificările citite, indiferent
 *   de pagină) — necesită migrarea 006 (RLS DELETE, lipsea până acum).
 * - Card-ul cu lead asociat e clickabil integral → navighează la lead ȘI
 *   marchează citit în același timp.
 *
 * Numărul de necitite din antet e query separat (fetchUnreadTotal), nu
 * derivat din pagina curentă — altfel ar arăta greșit odată ce paginăm.
 */

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import { Pagination } from '@/components/ui/Pagination'
import type { Notification } from '@/lib/types/database'
import { timeAgo } from '@/lib/utils'
import { Bell, Inbox, Users, AlertCircle, CheckCheck, Check, ChevronRight, Trash2 } from 'lucide-react'

/** Icon per notification type */
const TYPE_ICONS = {
  lead_assigned: Users,
  reminder_due: Bell,
  lead_new: Inbox,
  mention: AlertCircle,
  system: AlertCircle,
}

export default function NotificationsPage() {
  const { profile } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [unreadTotal, setUnreadTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [confirmDeleteRead, setConfirmDeleteRead] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    const from = (currentPage - 1) * itemsPerPage
    const to = from + itemsPerPage - 1
    const { data, count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', profile!.id)
      .order('created_at', { ascending: false })
      .range(from, to)
    setNotifications(data || [])
    setTotalCount(count || 0)
    setSelected(new Set())
    setLoading(false)
  }, [profile, supabase, currentPage, itemsPerPage])

  const fetchUnreadTotal = useCallback(async () => {
    const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true })
      .eq('user_id', profile!.id).eq('is_read', false)
    setUnreadTotal(count || 0)
  }, [profile, supabase])

  useEffect(() => { if (profile?.id) fetchNotifications() }, [profile?.id, fetchNotifications])
  useEffect(() => { if (profile?.id) fetchUnreadTotal() }, [profile?.id, fetchUnreadTotal])

  /** După o ștergere: dacă am golit pagina curentă (nu e prima), ne mutăm pe
   *  ultima pagină care mai are conținut — altfel doar reîmprospătăm. */
  async function refreshAfterDelete() {
    const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', profile!.id)
    const maxPage = Math.max(1, Math.ceil((count || 0) / itemsPerPage))
    if (currentPage > maxPage) setCurrentPage(maxPage)
    else await fetchNotifications()
    fetchUnreadTotal()
  }

  async function markAllRead() {
    await supabase.from('notifications').update({ is_read: true })
      .eq('user_id', profile!.id).eq('is_read', false)
    await fetchNotifications()
    fetchUnreadTotal()
  }

  async function markRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    fetchUnreadTotal()
  }

  /** Click pe card: marchează citit și, dacă notificarea ține de un lead, navighează la el. */
  function openNotification(notif: Notification) {
    if (!notif.is_read) markRead(notif.id)
    if (notif.lead_id) router.push(`/leads/${notif.lead_id}`)
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const allOnPageSelected = notifications.length > 0 && notifications.every((n) => selected.has(n.id))
  function toggleSelectAllOnPage() {
    setSelected(allOnPageSelected ? new Set() : new Set(notifications.map((n) => n.id)))
  }

  async function deleteOne(id: string) {
    await supabase.from('notifications').delete().eq('id', id)
    toast({ title: 'Notificare ștearsă', variant: 'warning' })
    await refreshAfterDelete()
  }

  async function deleteSelected() {
    const count = selected.size
    if (count === 0) return
    setDeleting(true)
    await supabase.from('notifications').delete().in('id', Array.from(selected))
    setDeleting(false)
    setConfirmBulkDelete(false)
    toast({ title: `${count} ${count === 1 ? 'notificare ștearsă' : 'notificări șterse'}`, variant: 'warning' })
    await refreshAfterDelete()
  }

  async function deleteAllRead() {
    setDeleting(true)
    await supabase.from('notifications').delete().eq('user_id', profile!.id).eq('is_read', true)
    setDeleting(false)
    setConfirmDeleteRead(false)
    toast({ title: 'Notificările citite au fost șterse', variant: 'warning' })
    await refreshAfterDelete()
  }

  const hasReadNotifications = totalCount > unreadTotal

  return (
    <>
      <Header title="Notificări" />
      <div className="p-4 sm:p-6 max-w-2xl">
        {/* Toolbar — rând 1: statistici + marchează toate */}
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {unreadTotal > 0 ? `${unreadTotal} necitite din ${totalCount}` : `Toate citite (${totalCount})`}
          </p>
          {unreadTotal > 0 && (
            <button onClick={markAllRead}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
              <CheckCheck size={14} /> Marchează toate ca citite
            </button>
          )}
        </div>

        {/* Toolbar — rând 2: selecție în grup, sau bara de acțiuni când e ceva selectat */}
        {selected.size > 0 ? (
          <div className="flex items-center justify-between gap-2 mb-3 p-2.5 bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 rounded-lg text-sm flex-wrap">
            <span className="text-red-700 dark:text-red-400 font-medium">{selected.size} selectate</span>
            <div className="flex items-center gap-2 flex-wrap">
              {confirmBulkDelete ? (
                <>
                  <span className="text-xs text-red-600 dark:text-red-400">Sigur?</span>
                  <button onClick={deleteSelected} disabled={deleting}
                    className="px-2.5 py-1 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors">
                    Da, șterge
                  </button>
                  <button onClick={() => setConfirmBulkDelete(false)} className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                    Anulează
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setConfirmBulkDelete(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded hover:bg-red-100 dark:hover:bg-red-900 transition-colors">
                    <Trash2 size={12} /> Șterge selectate
                  </button>
                  <button onClick={() => setSelected(new Set())} className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                    Anulează selecția
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            {notifications.length > 0 && (
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 cursor-pointer">
                <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAllOnPage}
                  className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500" />
                Selectează tot (pagina asta)
              </label>
            )}
            {hasReadNotifications && (
              confirmDeleteRead ? (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-red-600 dark:text-red-400">Ștergi toate notificările citite?</span>
                  <button onClick={deleteAllRead} disabled={deleting}
                    className="px-2 py-1 font-medium bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors">
                    Da, șterge
                  </button>
                  <button onClick={() => setConfirmDeleteRead(false)} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                    Anulează
                  </button>
                </div>
              ) : (
                <button onClick={() => setConfirmDeleteRead(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400">
                  <Trash2 size={12} /> Șterge citite
                </button>
              )
            )}
          </div>
        )}

        {/* Notification list */}
        <div className="space-y-1">
          {notifications.map((notif) => {
            const Icon = TYPE_ICONS[notif.type] || AlertCircle
            return (
              <div key={notif.id}
                className={`group flex items-start gap-3 px-3 sm:px-4 py-3 rounded-xl transition-colors ${
                  notif.is_read
                    ? 'bg-white dark:bg-slate-900'
                    : 'bg-blue-50/50 dark:bg-blue-950/30'
                } hover:bg-slate-50 dark:hover:bg-slate-800`}>
                <input type="checkbox" checked={selected.has(notif.id)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggleSelect(notif.id)}
                  className="w-4 h-4 mt-1 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 shrink-0" />

                <div onClick={() => openNotification(notif)} className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer">
                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mt-0.5 shrink-0">
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm truncate ${notif.is_read ? 'text-slate-700 dark:text-slate-300' : 'text-slate-900 dark:text-slate-100 font-medium'}`}>
                        {notif.title}
                      </p>
                      {!notif.is_read && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                    </div>
                    {notif.body && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{notif.body}</p>}
                    <p className="text-[11px] text-slate-400 mt-1">{timeAgo(notif.created_at)}</p>
                  </div>
                  {notif.lead_id && (
                    <ChevronRight size={14} className="text-slate-300 dark:text-slate-600 group-hover:text-slate-400 dark:group-hover:text-slate-500 transition-colors mt-1.5 shrink-0" />
                  )}
                </div>

                {/* Marchează citit + șterge — vizibile mereu pe mobil, la hover pe desktop. */}
                <div className="flex items-center gap-1 mt-0.5 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  {!notif.is_read && (
                    <button onClick={(e) => { e.stopPropagation(); markRead(notif.id) }} title="Marchează citit"
                      className="p-1.5 rounded text-slate-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-950">
                      <Check size={14} />
                    </button>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); deleteOne(notif.id) }} title="Șterge"
                    className="p-1.5 rounded text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}

          {!loading && notifications.length === 0 && (
            <div className="text-center py-12">
              <Bell size={24} className="text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Nicio notificare.</p>
            </div>
          )}
        </div>

        <Pagination
          currentPage={currentPage}
          totalItems={totalCount}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
        />
      </div>
    </>
  )
}
