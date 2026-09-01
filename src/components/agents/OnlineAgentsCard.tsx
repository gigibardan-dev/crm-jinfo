'use client'

/**
 * src/components/agents/OnlineAgentsCard.tsx
 *
 * OnlineAgentsCard
 *
 * Card separat, la finalul paginii /agents — „Prezență live": cine e
 * conectat acum în CRM, via Supabase Realtime Presence (vezi
 * src/lib/hooks/usePresence.tsx). Faza 1, cerută explicit: componentă de
 * sine stătătoare, NElegată de round-robin/AutoAssignPanel sau altceva.
 */

import { usePresence } from '@/lib/hooks/usePresence'
import { getInitials, timeAgo } from '@/lib/utils'
import { Radio } from 'lucide-react'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  manager: 'Manager',
  agent: 'Agent',
}

export function OnlineAgentsCard() {
  const { onlineUsers } = usePresence()

  return (
    <section>
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">Prezență live</h3>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 sm:p-5">
        {onlineUsers.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500">
            <Radio size={14} className="animate-pulse" />
            Se conectează...
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {onlineUsers.map((u) => (
              <li key={u.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="relative shrink-0">
                  <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-medium text-blue-700 dark:text-blue-300">
                    {getInitials(u.full_name)}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-white dark:border-slate-900" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{u.full_name}</p>
                  <p className="text-xs text-slate-400 capitalize">{ROLE_LABELS[u.role] || u.role}</p>
                </div>
                <p className="text-xs text-slate-400 shrink-0">conectat {timeAgo(u.online_at)}</p>
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-slate-400 dark:text-slate-500 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
          {onlineUsers.length} {onlineUsers.length === 1 ? 'persoană conectată' : 'persoane conectate'} acum, în timp real.
        </p>
      </div>
    </section>
  )
}
