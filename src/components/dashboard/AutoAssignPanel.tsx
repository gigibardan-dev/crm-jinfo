/**
 * src/components/dashboard/AutoAssignPanel.tsx
 *
 * AutoAssignPanel
 *
 * Panoul „Alocare automată (Round-Robin)" din Dashboard — vizibil doar
 * admin/manager (self-gated intern, la fel ca StagnantLeadsWidget). Vezi
 * supabase/migrations/005_round_robin_auto_assign.sql pt. mecanismul din DB
 * (trigger-ul chiar face alocarea; panoul ăsta doar citește/scrie switch-ul
 * global și disponibilitatea agenților).
 *
 * - Switch global (`app_settings.auto_assign_enabled`): orice admin/manager
 *   îl poate porni/opri direct (RLS `app_settings_update_admin_manager`).
 * - Lista de disponibilitate (`profiles.available_for_autoassign`) pt.
 *   agenți + manageri activi (rolul admin nu intră în pool, nu apare aici):
 *   fiecare user își poate schimba propriul status oricând din Sidebar (vezi
 *   Sidebar.tsx) — RLS `profiles_update` permite `id = auth.uid()`. Din acest
 *   panou, orice admin SAU manager poate suprascrie disponibilitatea ALTUI
 *   user (prin /api/users/[id]/autoassign — endpoint dedicat, deschis și
 *   managerilor, spre deosebire de /api/users/[id] care rămâne admin-only
 *   pt. editarea completă a unui cont).
 *
 * Realtime pe `app_settings` + `profiles` — dacă un admin pornește switch-ul
 * sau altcineva își schimbă disponibilitatea din Sidebar chiar când un alt
 * admin/manager are Dashboard-ul deschis, panoul se reface singur, la fel ca
 * StagnantLeadsWidget.
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import { Shuffle, Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { getInitials } from '@/lib/utils'
import type { Profile } from '@/lib/types/database'

export function AutoAssignPanel() {
  const { profile, isAdminOrManager } = useAuth()
  const supabase = createClient()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [savingSwitch, setSavingSwitch] = useState(false)
  const [pool, setPool] = useState<Profile[]>([])
  const [savingUserId, setSavingUserId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    const [{ data: setting }, { data: users }] = await Promise.all([
      supabase.from('app_settings').select('value').eq('key', 'auto_assign_enabled').single(),
      supabase.from('profiles').select('*').in('role', ['agent', 'manager']).order('full_name'),
    ])
    setEnabled(setting?.value === true)
    setPool(users || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    if (!isAdminOrManager) return
    fetchData()

    const channel = supabase
      .channel('dashboard-auto-assign')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchData())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [isAdminOrManager, fetchData, supabase])

  async function toggleGlobalSwitch() {
    const next = !enabled
    setSavingSwitch(true)
    const { error } = await supabase
      .from('app_settings')
      .update({ value: next, updated_at: new Date().toISOString(), updated_by: profile!.id })
      .eq('key', 'auto_assign_enabled')

    if (!error) {
      setEnabled(next)
      toast({ title: next ? 'Alocare automată pornită' : 'Alocare automată oprită', variant: next ? 'success' : 'info' })
    } else {
      toast({ title: 'Eroare la salvare', variant: 'error' })
    }
    setSavingSwitch(false)
  }

  async function toggleUserAvailability(user: Profile) {
    const isSelf = user.id === profile?.id
    const next = !user.available_for_autoassign
    setSavingUserId(user.id)

    let ok = false
    if (isSelf) {
      const { error } = await supabase.from('profiles').update({ available_for_autoassign: next }).eq('id', user.id)
      ok = !error
    } else {
      // Admin sau manager — endpoint dedicat, vezi doc comment de sus.
      const res = await fetch(`/api/users/${user.id}/autoassign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ available_for_autoassign: next }),
      })
      ok = res.ok
    }

    if (ok) {
      setPool((prev) => prev.map((u) => (u.id === user.id ? { ...u, available_for_autoassign: next } : u)))
    } else {
      toast({ title: 'Eroare la salvare', variant: 'error' })
    }
    setSavingUserId(null)
  }

  if (!isAdminOrManager) return null

  if (loading) {
    return (
      <div className="mt-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-48 mb-3" />
        <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded" />
      </div>
    )
  }

  return (
    <div className="mt-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Shuffle size={14} />
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">Alocare Automată (Round-Robin)</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">Lead-urile noi din formular/webhook/sincronizare merg automat la agentul disponibil de mai mult timp fără alocare.</p>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleGlobalSwitch}
          disabled={savingSwitch}
          aria-pressed={enabled}
          title={enabled ? 'Click pentru oprire' : 'Click pentru pornire'}
          className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60 ${
            enabled
              ? 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950 hover:bg-green-100 dark:hover:bg-green-900'
              : 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          {enabled ? 'Pornită' : 'Oprită'}
        </button>
      </div>

      {pool.length === 0 ? (
        <div className="px-5 py-4 text-sm text-slate-400 dark:text-slate-500">Niciun agent sau manager în sistem încă.</div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto">
          {pool.map((user) => {
            const isSelf = user.id === profile?.id
            // Panoul e vizibil doar pt. admin/manager (gate mai jos), deci
            // oricine vede rândul poate să-l editeze — self direct, altul
            // prin /api/users/[id]/autoassign (admin sau manager).
            return (
              <div key={user.id} className="flex items-center gap-3 px-4 sm:px-5 py-2.5">
                <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[11px] font-medium text-slate-600 dark:text-slate-300 shrink-0">
                  {getInitials(user.full_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-900 dark:text-slate-100 truncate">
                    {user.full_name} {isSelf && <span className="text-slate-400 dark:text-slate-500 font-normal">(tu)</span>}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 capitalize">
                    {user.role}{!user.is_active && ' · cont dezactivat'}
                  </p>
                </div>
                {savingUserId === user.id ? (
                  <Loader2 size={16} className="animate-spin text-slate-300 dark:text-slate-600 shrink-0" />
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleUserAvailability(user)}
                    aria-pressed={user.available_for_autoassign}
                    title={user.available_for_autoassign ? 'Click pentru a opri disponibilitatea' : 'Click pentru a porni disponibilitatea'}
                    className={`shrink-0 text-xs font-medium px-2 py-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      user.available_for_autoassign
                        ? 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950 hover:enabled:bg-green-100 dark:hover:enabled:bg-green-900'
                        : 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:enabled:bg-slate-200 dark:hover:enabled:bg-slate-700'
                    }`}
                  >
                    {user.available_for_autoassign ? 'Disponibil' : 'Indisponibil'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
