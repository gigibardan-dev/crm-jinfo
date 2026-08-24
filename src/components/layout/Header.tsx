'use client'

/**
 * Header Component
 * 
 * Top bar with:
 * - Page title (left)
 * - Search button with Cmd+K shortcut (right)
 * - Theme toggle dark/light (right)
 * - Notification bell with unread count (right)
 */

import { Bell, Search } from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { SearchDialog } from '@/components/ui/SearchDialog'

export function Header({ title }: { title?: string }) {
  const { profile } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const [searchOpen, setSearchOpen] = useState(false)
  const supabase = createClient()

  // Fetch unread notification count + realtime subscription
  useEffect(() => {
    if (!profile?.id) return

    async function fetchUnread() {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile!.id)
        .eq('is_read', false)
      setUnreadCount(count || 0)
    }

    fetchUnread()

    const channel = supabase
      .channel('header-notifications')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${profile.id}`,
      }, () => {
        setUnreadCount((prev) => prev + 1)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile?.id, supabase, profile])

  // Global Cmd+K / Ctrl+K shortcut for search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <>
      <header className="h-14 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-between px-6">
        <div>
          {title && (
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h1>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Search trigger */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
          >
            <Search size={14} />
            <span className="hidden sm:inline">Caută...</span>
            <kbd className="hidden sm:inline text-[10px] font-medium text-slate-400 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600 ml-2">
              ⌘K
            </kbd>
          </button>

          <ThemeToggle />

          {/* Notification bell */}
          <Link
            href="/notifications"
            className="relative p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 text-[10px] font-medium bg-red-500 text-white rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
        </div>
      </header>

      {/* Search dialog */}
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
