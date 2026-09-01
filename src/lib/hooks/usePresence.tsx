'use client'

/**
 * src/lib/hooks/usePresence.tsx
 *
 * PresenceProvider / usePresence
 *
 * Prezență live — cine e conectat acum în CRM — via Supabase Realtime
 * Presence. Diferit de `postgres_changes` (folosit peste tot pentru
 * schimbări în date — Header, Sidebar, AutoAssignPanel,
 * StagnantLeadsWidget etc.): Presence e o feature separată a Realtime,
 * „cine ține un canal deschis chiar acum", nu schimbări în DB. Ambele
 * tipuri de canale multiplexează pe același WebSocket per client, deci a
 * adăuga Presence peste subscripțiile deja deschise nu deschide un al
 * doilea websocket și nu consumă execuții Vercel suplimentare — nu e
 * polling.
 *
 * Faza 1, cerută explicit „independent de restul": doar afișare, pe un
 * card separat la finalul /agents (vezi
 * src/components/agents/OnlineAgentsCard.tsx). NU e legată de
 * round-robin, AutoAssignPanel sau altceva — deocamdată.
 *
 * Montat în src/app/(app)/layout.tsx, sub AuthProvider (are nevoie de
 * user + profil pentru a se putea „anunța" pe canal).
 */

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'

export interface OnlinePresenceUser {
  id: string
  full_name: string
  role: string
  online_at: string
}

interface PresenceContextType {
  /** Utilizatorii conectați acum, sortați alfabetic. Include userul curent. */
  onlineUsers: OnlinePresenceUser[]
}

const PresenceContext = createContext<PresenceContextType>({ onlineUsers: [] })

const CHANNEL_NAME = 'presence-online-agents'

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth()
  const [onlineUsers, setOnlineUsers] = useState<OnlinePresenceUser[]>([])
  const supabase = createClient()

  useEffect(() => {
    if (!user || !profile) return

    const channel = supabase.channel(CHANNEL_NAME, {
      config: { presence: { key: user.id } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<OnlinePresenceUser>()
        const users = Object.values(state)
          .map((entries) => entries[0])
          .filter((entry): entry is OnlinePresenceUser & { presence_ref: string } => Boolean(entry))
          .sort((a, b) => a.full_name.localeCompare(b.full_name))
        setOnlineUsers(users)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            id: user.id,
            full_name: profile.full_name,
            role: profile.role,
            online_at: new Date().toISOString(),
          })
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, profile, supabase])

  return (
    <PresenceContext.Provider value={{ onlineUsers }}>
      {children}
    </PresenceContext.Provider>
  )
}

export function usePresence() {
  return useContext(PresenceContext)
}
