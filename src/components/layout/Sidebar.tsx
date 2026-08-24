'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, Inbox, Kanban, PlusCircle, Users,
  BarChart3, Settings, LogOut, type LucideIcon,
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
]

const managementNav: NavItem[] = [
  { href: '/agents', label: 'Agenți', icon: Users, roles: ['admin', 'manager'] },
  { href: '/reports', label: 'Rapoarte', icon: BarChart3, roles: ['admin', 'manager'] },
]

const adminNav: NavItem[] = [
  { href: '/settings', label: 'Setări', icon: Settings, roles: ['admin'] },
]

function NavLink({ item, isActive, badge }: { item: NavItem; isActive: boolean; badge?: number }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
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
  const supabase = createClient()
  const role = profile?.role

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

  function canSee(item: NavItem) {
    if (!item.roles) return true
    return role && item.roles.includes(role)
  }

  function isActive(href: string) {
    if (href === '/leads' && pathname === '/leads') return true
    if (href === '/leads' && pathname?.startsWith('/leads/')) {
      if (pathname === '/leads/inbox' || pathname === '/leads/new') return false
      return true
    }
    return pathname === href || (pathname?.startsWith(href + '/') && href !== '/leads')
  }

  function getBadge(item: NavItem): number | undefined {
    if (item.badgeKey === 'inbox') return inboxCount
    return undefined
  }

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-60 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 flex flex-col z-30">
      <div className="h-14 flex items-center gap-3 px-5 border-b border-slate-100 dark:border-slate-800">
        <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
          JT
        </div>
        <div>
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">JinfoTours</span>
          <span className="text-xs text-slate-400 ml-1">CRM</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {mainNav.filter(canSee).map((item) => (
          <NavLink key={item.href} item={item} isActive={isActive(item.href)} badge={getBadge(item)} />
        ))}

        {managementNav.filter(canSee).length > 0 && (
          <>
            <div className="h-px bg-slate-100 dark:bg-slate-800 my-3" />
            {managementNav.filter(canSee).map((item) => (
              <NavLink key={item.href} item={item} isActive={isActive(item.href)} />
            ))}
          </>
        )}

        {adminNav.filter(canSee).length > 0 && (
          <>
            <div className="h-px bg-slate-100 dark:bg-slate-800 my-3" />
            {adminNav.filter(canSee).map((item) => (
              <NavLink key={item.href} item={item} isActive={isActive(item.href)} />
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
        <button
          onClick={signOut}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors mt-1"
        >
          <LogOut size={18} strokeWidth={1.5} />
          <span>Deconectare</span>
        </button>
      </div>
    </aside>
  )
}
