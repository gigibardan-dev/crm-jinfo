'use client'

/**
 * src/app/(app)/notifications/page.tsx
 *
 * Notifications Page
 *
 * Centru de notificări in-app:
 * - Lead alocat, reminder scadent, lead nou, sistem
 * - Marcare individuală (click pe card, sau butonul dedicat „bifă") sau
 *   bulk ca citite
 * - Card-ul cu lead asociat e clickabil integral → navighează la lead ȘI
 *   marchează citit în același timp (înainte, „Vezi lead" avea
 *   stopPropagation și lăsa notificarea necitită la nesfârșit dacă userul
 *   folosea mereu acel link ca să ajungă la lead — bug de corectitudine
 *   fixat aici). Butonul „bifă" separat, cu stopPropagation, marchează
 *   citit FĂRĂ să navigheze — pt. cine vrea doar să închidă alerta.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import type { Notification } from '@/lib/types/database'
import { timeAgo } from '@/lib/utils'
import { Bell, Inbox, Users, AlertCircle, CheckCheck, Check, ChevronRight } from 'lucide-react'

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
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!profile?.id) return
    supabase.from('notifications').select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => { setNotifications(data || []); setLoading(false) })
  }, [profile?.id, supabase])

  async function markAllRead() {
    await supabase.from('notifications').update({ is_read: true })
      .eq('user_id', profile!.id).eq('is_read', false)
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }

  async function markRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
  }

  /** Click pe card: marchează citit și, dacă notificarea ține de un lead, navighează la el. */
  function openNotification(notif: Notification) {
    if (!notif.is_read) markRead(notif.id)
    if (notif.lead_id) router.push(`/leads/${notif.lead_id}`)
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

  return (
    <>
      <Header title="Notificări" />
      <div className="p-4 sm:p-6 max-w-2xl">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {unreadCount > 0 ? `${unreadCount} necitite din ${notifications.length}` : `Toate citite (${notifications.length})`}
          </p>
          {unreadCount > 0 && (
            <button onClick={markAllRead}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
              <CheckCheck size={14} /> Marchează toate ca citite
            </button>
          )}
        </div>

        {/* Notification list */}
        <div className="space-y-1">
          {notifications.map((notif) => {
            const Icon = TYPE_ICONS[notif.type] || AlertCircle
            return (
              <div key={notif.id} onClick={() => openNotification(notif)}
                className={`group flex items-start gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer ${
                  notif.is_read
                    ? 'bg-white dark:bg-slate-900'
                    : 'bg-blue-50/50 dark:bg-blue-950/30'
                } hover:bg-slate-50 dark:hover:bg-slate-800`}>
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

                {/* Marchează citit — acțiune separată, fără navigare (vizibilă mereu pe
                    mobil, la hover pe desktop — nu există hover pe touch). */}
                <div className="flex items-center gap-1 mt-0.5 shrink-0">
                  {!notif.is_read && (
                    <button
                      onClick={(e) => { e.stopPropagation(); markRead(notif.id) }}
                      title="Marchează citit"
                      className="p-1.5 rounded text-slate-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-950 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <Check size={14} />
                    </button>
                  )}
                  {notif.lead_id && (
                    <ChevronRight size={14} className="text-slate-300 dark:text-slate-600 group-hover:text-slate-400 dark:group-hover:text-slate-500 transition-colors" />
                  )}
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
      </div>
    </>
  )
}
