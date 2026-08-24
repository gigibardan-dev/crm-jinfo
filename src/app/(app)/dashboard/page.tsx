'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import { Inbox, TrendingUp, Clock, AlertTriangle, Users, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

interface DashboardStats {
  totalNew: number
  totalAssigned: number
  totalInProgress: number
  totalWon: number
  totalLost: number
  todayReminders: number
}

const TERMINAL_STATUSES = ['won', 'lost', 'unqualified']
const IN_PROGRESS_STATUSES = ['contacted', 'quote_sent', 'follow_up', 'quote_accepted', 'booking_pending', 'payment_received', 'confirmed']

export default function DashboardPage() {
  const { profile, isAdminOrManager } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!profile?.id) return

    async function fetchStats() {
      setLoading(true)

      const [newLeads, assignedLeads, inProgressLeads, wonLeads, lostLeads, reminders] =
        await Promise.all([
          supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'new'),
          supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'assigned'),
          supabase.from('leads').select('*', { count: 'exact', head: true }).in('status', IN_PROGRESS_STATUSES),
          supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'won'),
          supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'lost'),
          supabase
            .from('reminders')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', profile!.id)
            .eq('is_completed', false)
            .lte('remind_at', new Date().toISOString()),
        ])

      setStats({
        totalNew: newLeads.count || 0,
        totalAssigned: assignedLeads.count || 0,
        totalInProgress: inProgressLeads.count || 0,
        totalWon: wonLeads.count || 0,
        totalLost: lostLeads.count || 0,
        todayReminders: reminders.count || 0,
      })
      setLoading(false)
    }

    fetchStats()
  }, [profile?.id, supabase, profile])

  if (loading || !stats) {
    return (
      <>
        <Header title="Dashboard" />
        <div className="p-6">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
                <div className="h-4 bg-slate-100 rounded w-24 mb-3" />
                <div className="h-8 bg-slate-100 rounded w-16" />
              </div>
            ))}
          </div>
        </div>
      </>
    )
  }

  const cards = [
    {
      label: 'Leaduri Noi',
      value: stats.totalNew,
      icon: Inbox,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      href: '/leads/inbox',
      show: isAdminOrManager,
    },
    {
      label: 'Alocate',
      value: stats.totalAssigned,
      icon: Users,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      href: '/leads',
      show: true,
    },
    {
      label: 'În Lucru',
      value: stats.totalInProgress,
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      href: '/leads',
      show: true,
    },
    {
      label: 'Câștigate',
      value: stats.totalWon,
      icon: TrendingUp,
      color: 'text-green-600',
      bg: 'bg-green-50',
      href: '/leads',
      show: true,
    },
    {
      label: 'Pierdute',
      value: stats.totalLost,
      icon: AlertTriangle,
      color: 'text-red-500',
      bg: 'bg-red-50',
      href: '/leads',
      show: isAdminOrManager,
    },
    {
      label: 'Remindere Azi',
      value: stats.todayReminders,
      icon: CheckCircle2,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      href: '/leads',
      show: true,
    },
  ]

  return (
    <>
      <Header title="Dashboard" />
      <div className="p-6">
        {/* Greeting */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-slate-900">
            Bună, {profile?.full_name?.split(' ')[0]}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {isAdminOrManager
              ? 'Iată o privire de ansamblu asupra activității.'
              : 'Iată leadurile tale de azi.'}
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {cards
            .filter((c) => c.show)
            .map((card) => {
              const Icon = card.icon
              return (
                <Link
                  key={card.label}
                  href={card.href}
                  className="bg-white rounded-xl border border-slate-200 p-5 hover:border-slate-300 hover:shadow-sm transition-all group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-slate-500">{card.label}</span>
                    <div className={`w-8 h-8 rounded-lg ${card.bg} ${card.color} flex items-center justify-center`}>
                      <Icon size={16} />
                    </div>
                  </div>
                  <span className="text-2xl font-semibold text-slate-900">
                    {card.value}
                  </span>
                </Link>
              )
            })}
        </div>

        {/* Quick Actions */}
        {stats.totalNew > 0 && isAdminOrManager && (
          <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-900">
                {stats.totalNew} {stats.totalNew === 1 ? 'lead nou nealocat' : 'leaduri noi nealocate'}
              </p>
              <p className="text-xs text-blue-600 mt-0.5">
                Alocă-le agenților pentru a nu pierde oportunități.
              </p>
            </div>
            <Link
              href="/leads/inbox"
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Deschide Inbox
            </Link>
          </div>
        )}

        {stats.todayReminders > 0 && (
          <div className="mt-4 bg-orange-50 border border-orange-100 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-900">
                Ai {stats.todayReminders} {stats.todayReminders === 1 ? 'reminder' : 'remindere'} scadent{stats.todayReminders === 1 ? '' : 'e'}
              </p>
              <p className="text-xs text-orange-600 mt-0.5">
                Verifică leadurile care necesită follow-up.
              </p>
            </div>
            <Link
              href="/leads"
              className="px-4 py-2 text-sm font-medium bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
            >
              Vezi Leaduri
            </Link>
          </div>
        )}
      </div>
    </>
  )
}
