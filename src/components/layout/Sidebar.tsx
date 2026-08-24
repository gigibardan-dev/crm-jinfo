'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import {
  LayoutDashboard,
  Inbox,
  Kanban,
  PlusCircle,
  Users,
  BarChart3,
  Settings,
  LogOut,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  roles?: string[]
  badge?: boolean
}

const mainNav: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/leads/inbox', label: 'Inbox', icon: Inbox, roles: ['admin', 'manager'] },
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

function NavLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
        isActive
          ? 'bg-blue-50 text-blue-700'
          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
      )}
    >
      <Icon size={18} strokeWidth={isActive ? 2 : 1.5} />
      <span>{item.label}</span>
    </Link>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const { profile, signOut } = useAuth()

  const role = profile?.role

  function canSee(item: NavItem) {
    if (!item.roles) return true
    return role && item.roles.includes(role)
  }

  function isActive(href: string) {
    if (href === '/leads' && pathname === '/leads') return true
    if (href === '/leads' && pathname?.startsWith('/leads/')) {
      // Don't highlight Pipeline for sub-routes like inbox, new
      if (pathname === '/leads/inbox' || pathname === '/leads/new') return false
      return true
    }
    return pathname === href || (pathname?.startsWith(href + '/') && href !== '/leads')
  }

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-60 bg-white border-r border-slate-200 flex flex-col z-30">
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-slate-100">
        <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
          JT
        </div>
        <div>
          <span className="text-sm font-semibold text-slate-900">JinfoTours</span>
          <span className="text-xs text-slate-400 ml-1">CRM</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {/* Main */}
        {mainNav.filter(canSee).map((item) => (
          <NavLink key={item.href} item={item} isActive={isActive(item.href)} />
        ))}

        {/* Management - show separator only if there are visible items */}
        {managementNav.filter(canSee).length > 0 && (
          <>
            <div className="h-px bg-slate-100 my-3" />
            {managementNav.filter(canSee).map((item) => (
              <NavLink key={item.href} item={item} isActive={isActive(item.href)} />
            ))}
          </>
        )}

        {/* Admin */}
        {adminNav.filter(canSee).length > 0 && (
          <>
            <div className="h-px bg-slate-100 my-3" />
            {adminNav.filter(canSee).map((item) => (
              <NavLink key={item.href} item={item} isActive={isActive(item.href)} />
            ))}
          </>
        )}
      </nav>

      {/* User section */}
      <div className="border-t border-slate-100 p-3">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium text-slate-600">
            {profile?.full_name
              ?.split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">
              {profile?.full_name || 'Se încarcă...'}
            </p>
            <p className="text-xs text-slate-400 capitalize">{role || ''}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-slate-500
                     hover:text-red-600 hover:bg-red-50 transition-colors mt-1"
        >
          <LogOut size={18} strokeWidth={1.5} />
          <span>Deconectare</span>
        </button>
      </div>
    </aside>
  )
}
