'use client'

/**
 * src/app/(app)/dashboard/page.tsx
 *
 * Dashboard Page
 *
 * Adaptat pe rol:
 * - Admin/Manager: vede toate KPI-urile + alerte leaduri nealocate
 * - Agent: vede doar leadurile proprii + remindere
 * 
 * Carduri: Leaduri noi, Alocate, În lucru, Câștigate, Fără Succes, Remindere,
 * Nu A Răspuns (shortcut spre /leads?status=no_response), Leaduri Închise
 * (shortcut spre /leads?status=closed — toate cele 3 statusuri terminale)
 * Alertă: Leaduri nealocate (admin/manager) + Remindere scadente
 */

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import { Inbox, TrendingUp, Clock, AlertTriangle, Users, CheckCircle2, PhoneMissed, Archive } from 'lucide-react'
import Link from 'next/link'
import { IN_PROGRESS_STATUSES, NO_SUCCESS_STATUSES, TERMINAL_STATUSES } from '@/lib/utils/constants'
import { StagnantLeadsWidget } from '@/components/dashboard/StagnantLeadsWidget'
import { AutoAssignPanel } from '@/components/dashboard/AutoAssignPanel'

interface DashboardStats {
  totalNew: number
  totalAssigned: number
  totalInProgress: number
  totalWon: number
  totalLost: number
  totalNoResponse: number
  totalClosed: number
  todayReminders: number
}

export default function DashboardPage() {
  const { profile, isAdminOrManager } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!profile?.id) return

    async function fetchStats() {
      setLoading(true)
      const [newLeads, assignedLeads, inProgressLeads, wonLeads, lostLeads, noResponseLeads, closedLeads, reminders] =
        await Promise.all([
          supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'new'),
          supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'assigned'),
          supabase.from('leads').select('*', { count: 'exact', head: true }).in('status', IN_PROGRESS_STATUSES),
          supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'won'),
          // 'lost' + 'unqualified' — ambele statusuri terminale negative, vezi
          // nota din constants.ts. Înainte se număra doar 'lost'.
          supabase.from('leads').select('*', { count: 'exact', head: true }).in('status', NO_SUCCESS_STATUSES),
          // Shortcut card „Nu A Răspuns" — deschise, status exact 'no_response'.
          supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'no_response'),
          // Shortcut card „Leaduri Închise" — TOATE cele 3 statusuri terminale
          // (câștigat + pierdut + necalificat), spre deosebire de „Fără Succes"
          // care numără doar cele 2 negative.
          supabase.from('leads').select('*', { count: 'exact', head: true }).in('status', TERMINAL_STATUSES),
          supabase.from('reminders').select('*', { count: 'exact', head: true })
            .eq('user_id', profile!.id).eq('is_completed', false).lte('remind_at', new Date().toISOString()),
        ])
      setStats({
        totalNew: newLeads.count || 0,
        totalAssigned: assignedLeads.count || 0,
        totalInProgress: inProgressLeads.count || 0,
        totalWon: wonLeads.count || 0,
        totalLost: lostLeads.count || 0,
        totalNoResponse: noResponseLeads.count || 0,
        totalClosed: closedLeads.count || 0,
        todayReminders: reminders.count || 0,
      })
      setLoading(false)
    }

    fetchStats()
  }, [profile?.id, supabase, profile])

  // Loading skeleton
  if (loading || !stats) {
    return (
      <>
        <Header title="Dashboard" />
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5 animate-pulse">
                <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-24 mb-3" />
                <div className="h-8 bg-slate-100 dark:bg-slate-800 rounded w-16" />
              </div>
            ))}
          </div>
        </div>
      </>
    )
  }

  // KPI card definitions
  const cards = [
    { label: 'Leaduri Noi', value: stats.totalNew, icon: Inbox, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950', href: '/leads/inbox', show: isAdminOrManager },
    { label: 'Alocate', value: stats.totalAssigned, icon: Users, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950', href: '/leads?status=assigned', show: true },
    { label: 'În Lucru', value: stats.totalInProgress, icon: Clock, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950', href: '/leads?status=in_progress', show: true },
    { label: 'Câștigate', value: stats.totalWon, icon: TrendingUp, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950', href: '/leads?status=won', show: true },
    { label: 'Fără Succes', value: stats.totalLost, icon: AlertTriangle, color: 'text-red-500 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950', href: '/leads?status=no_success', show: isAdminOrManager },
    { label: 'Remindere Azi', value: stats.todayReminders, icon: CheckCircle2, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950', href: '/leads?reminders=due', show: true },
    { label: 'Nu A Răspuns', value: stats.totalNoResponse, icon: PhoneMissed, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950', href: '/leads?status=no_response', show: true },
    { label: 'Leaduri Închise', value: stats.totalClosed, icon: Archive, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-950', href: '/leads?status=closed', show: true },
  ]

  return (
    <>
      <Header title="Dashboard" />
      <div className="p-4 sm:p-6">
        {/* Greeting */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Bună, {profile?.full_name?.split(' ')[0]}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {isAdminOrManager ? 'Iată o privire de ansamblu asupra activității.' : 'Iată leadurile tale de azi.'}
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.filter((c) => c.show).map((card) => {
            const Icon = card.icon
            return (
              <Link key={card.label} href={card.href}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm transition-all group">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-slate-500 dark:text-slate-400">{card.label}</span>
                  <div className={`w-8 h-8 rounded-lg ${card.bg} ${card.color} flex items-center justify-center`}>
                    <Icon size={16} />
                  </div>
                </div>
                <span className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{card.value}</span>
              </Link>
            )
          })}
        </div>

        {/* Alerts */}
        {stats.totalNew > 0 && isAdminOrManager && (
          <div className="mt-6 bg-blue-50 dark:bg-blue-950 border border-blue-100 dark:border-blue-900 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                {stats.totalNew} {stats.totalNew === 1 ? 'lead nou nealocat' : 'leaduri noi nealocate'}
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                Alocă-le agenților pentru a nu pierde oportunități.
              </p>
            </div>
            <Link href="/leads/inbox"
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-center shrink-0">
              Deschide Inbox
            </Link>
          </div>
        )}

        {stats.todayReminders > 0 && (
          <div className="mt-4 bg-orange-50 dark:bg-orange-950 border border-orange-100 dark:border-orange-900 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-orange-900 dark:text-orange-200">
                Ai {stats.todayReminders} {stats.todayReminders === 1 ? 'reminder' : 'remindere'} scadent{stats.todayReminders === 1 ? '' : 'e'}
              </p>
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">
                Verifică leadurile care necesită follow-up.
              </p>
            </div>
            <Link href="/leads?reminders=due"
              className="px-4 py-2 text-sm font-medium bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-center shrink-0">
              Vezi Leaduri
            </Link>
          </div>
        )}

        {/* Lead-uri stagnante — fără nicio interacțiune (comentariu/schimbare
            status) de peste pragul configurat. Vezi StagnantLeadsWidget. */}
        <StagnantLeadsWidget />

        {/* Alocare automată round-robin — doar admin/manager (self-gated
            intern). Vezi AutoAssignPanel + migrarea 005. */}
        <AutoAssignPanel />
      </div>
    </>
  )
}
