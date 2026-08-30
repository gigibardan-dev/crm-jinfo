'use client'

/**
 * src/components/layout/Sidebar.tsx
 *
 * Sidebar Component — navigare principală
 *
 * Bara laterală cu: nav principal (Dashboard, Inbox, Pipeline, Lead Nou,
 * Import Leaduri — ultimele două admin/manager), nav management (Agenți,
 * Rapoarte — admin/manager), nav admin (Setări), și blocul de user curent +
 * deconectare. Badge-ul de pe „Inbox” arată numărul de leaduri nealocate,
 * cu subscripție Realtime.
 *
 * Responsive: sub `lg` e un sertar ascuns (`-translate-x-full`) controlat de
 * MobileNavProvider (vezi useMobileNav.tsx) — se deschide din butonul
 * hamburger din Header, se închide la tap pe overlay sau pe un link din
 * nav. De la `lg` în sus rămâne fix, mereu vizibil, ca înainte.
 *
 * Blocul de user curent include și un toggle „Disponibil pt. alocare
 * automată" (doar agent/manager — adminul nu e în pool-ul de round-robin),
 * ca fiecare să-și poată opri propria disponibilitate direct (ex. concediu),
 * fără să depindă de un admin — vezi AutoAssignPanel (Dashboard) și
 * migrarea 005_round_robin_auto_assign.sql. RLS permite update pe propriul
 * profil (`id = auth.uid()`), deci scrie direct în tabel, fără API route.
 */

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { useMobileNav } from '@/lib/hooks/useMobileNav'
import {
  LayoutDashboard, Inbox, Kanban, PlusCircle, Users,
  BarChart3, Settings, LogOut, X, FileSpreadsheet, Shuffle, type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  roles?: string[]
  badgeKey?: string
}

const mainNav: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/leads/inbox', label: 'Inbox', icon: Inbox, roles: ['admin', 'manager'], badgeKey: 'inbox' },
  { href: '/leads', label: 'Pipeline', icon: Kanban },
  { href: '/leads/new', label: 'Lead Nou', icon: PlusCircle },
  { href: '/leads/import', label: 'Import Leaduri', icon: FileSpreadsheet, roles: ['admin', 'manager'] },
]

const managementNav: NavItem[] = [
  { href: '/agents', label: 'Agenți', icon: Users, roles: ['admin', 'manager'] },
  { href: '/reports', label: 'Rapoarte', icon: BarChart3, roles: ['admin', 'manager'] },
]

const adminNav: NavItem[] = [
  { href: '/settings', label: 'Setări', icon: Settings, roles: ['admin'] },
]

function NavLink({ item, isActive, badge, onNavigate }: { item: NavItem; isActive: boolean; badge?: number; onNavigate: () => void }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
        isActive
          ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
      )}
    >
      <Icon size={18} strokeWidth={isActive ? 2 : 1.5} />
      <span className="flex-1">{item.label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="min-w-5 h-5 px-1.5 text-[11px] font-semibold bg-red-500 text-white rounded-full flex items-center justify-center">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const { profile, isAdminOrManager, signOut } = useAuth()
  const [inboxCount, setInboxCount] = useState(0)
  const [available, setAvailable] = useState(true)
  const [savingAvailable, setSavingAvailable] = useState(false)
  const supabase = createClient()
  const role = profile?.role
  const { open, close } = useMobileNav()
  const inAutoAssignPool = role === 'agent' || role === 'manager'

  useEffect(() => {
    if (!isAdminOrManager) return

    async function fetchCount() {
      const { count } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'new')
      setInboxCount(count || 0)
    }

    fetchCount()

    const channel = supabase
      .channel('sidebar-inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        fetchCount()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, isAdminOrManager])

  useEffect(() => {
    setAvailable(profile?.available_for_autoassign ?? true)
  }, [profile?.available_for_autoassign])

  async function toggleAvailability() {
    if (!profile?.id) return
    const next = !available
    setSavingAvailable(true)
    const { error } = await supabase.from('profiles').update({ available_for_autoassign: next }).eq('id', profile.id)
    if (!error) setAvailable(next)
    setSavingAvailable(false)
  }

  function canSee(item: NavItem) {
    if (!item.roles) return true
    return role && item.roles.includes(role)
  }

  function isActive(href: string) {
    if (href === '/leads' && pathname === '/leads') return true
    if (href === '/leads' && pathname?.startsWith('/leads/')) {
      if (pathname === '/leads/inbox' || pathname === '/leads/new' || pathname === '/leads/import') return false
      return true
    }
    return pathname === href || (pathname?.startsWith(href + '/') && href !== '/leads')
  }

  function getBadge(item: NavItem): number | undefined {
    if (item.badgeKey === 'inbox') return inboxCount
    return undefined
  }

  return (
    <>
      {/* Overlay pe mobil/tabletă, sub sertar deschis — tap în afară îl închide */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 bottom-0 w-60 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 flex flex-col z-50 lg:z-30',
          'transition-transform duration-200 ease-out lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="h-14 flex items-center gap-3 px-5 border-b border-slate-100 dark:border-slate-800">
          <div className="w-9 h-9 rounded-lg bg-white dark:bg-slate-100 ring-1 ring-slate-200 dark:ring-slate-700 shadow-sm flex items-center justify-center overflow-hidden shrink-0">
            <Image src="/images/jinfologo-mic.png" alt="J'Info Tours" width={189} height={199} className="w-full h-full object-contain p-0.5" priority />
          </div>
          <div className="flex-1">
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">JinfoTours</span>
            <span className="text-xs text-slate-400 ml-1">CRM</span>
          </div>
          <button
            onClick={close}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Închide meniul"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {mainNav.filter(canSee).map((item) => (
            <NavLink key={item.href} item={item} isActive={isActive(item.href)} badge={getBadge(item)} onNavigate={close} />
          ))}

          {managementNav.filter(canSee).length > 0 && (
            <>
              <div className="h-px bg-slate-100 dark:bg-slate-800 my-3" />
              {managementNav.filter(canSee).map((item) => (
                <NavLink key={item.href} item={item} isActive={isActive(item.href)} onNavigate={close} />
              ))}
            </>
          )}

          {adminNav.filter(canSee).length > 0 && (
            <>
              <div className="h-px bg-slate-100 dark:bg-slate-800 my-3" />
              {adminNav.filter(canSee).map((item) => (
                <NavLink key={item.href} item={item} isActive={isActive(item.href)} onNavigate={close} />
              ))}
            </>
          )}
        </nav>

        <div className="border-t border-slate-100 dark:border-slate-800 p-3">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-medium text-slate-600 dark:text-slate-300">
              {profile?.full_name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{profile?.full_name || 'Se încarcă...'}</p>
              <p className="text-xs text-slate-400 capitalize">{role || ''}</p>
            </div>
          </div>

          {inAutoAssignPool && (
            <button
              onClick={toggleAvailability}
              disabled={savingAvailable}
              title="Disponibilitate pentru alocarea automată (round-robin) a lead-urilor noi"
              className={cn(
                'flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-60',
                available
                  ? 'text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950'
                  : 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              )}
            >
              <Shuffle size={13} strokeWidth={1.5} className="shrink-0" />
              <span className="flex-1 text-left truncate">{available ? 'Disponibil auto-alocare' : 'Indisponibil auto-alocare'}</span>
              <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', available ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600')} />
            </button>
          )}

          <button
            onClick={signOut}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors mt-1"
          >
            <LogOut size={18} strokeWidth={1.5} />
            <span>Deconectare</span>
          </button>
        </div>
      </aside>
    </>
  )
}
