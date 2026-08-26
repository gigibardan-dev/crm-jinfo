/**
 * src/app/(app)/settings/page.tsx
 *
 * Settings Page — Admin only
 *
 * Owner de state/date pentru cele trei secțiuni de setări. Markup-ul e
 * delegat componentelor din src/components/settings/*.
 *
 * Secțiuni:
 * - Utilizatori: creare cont nou, toggle activ/inactiv
 * - Pipeline Stages: vizualizare configurație
 * - Lead Sources: vizualizare surse cu Lucide icons
 */

'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import type { Profile, PipelineStage, LeadSource } from '@/lib/types/database'
import { UsersSection } from '@/components/settings/UsersSection'
import type { NewUserFormData } from '@/components/settings/NewUserForm'
import { PipelineStagesSection } from '@/components/settings/PipelineStagesSection'
import { LeadSourcesSection } from '@/components/settings/LeadSourcesSection'

export default function SettingsPage() {
  const { isAdmin } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()

  const [users, setUsers] = useState<Profile[]>([])
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [sources, setSources] = useState<LeadSource[]>([])
  const [loading, setLoading] = useState(true)

  // --- New user form ---
  const [showNewUser, setShowNewUser] = useState(false)
  const [newUser, setNewUser] = useState<NewUserFormData>({ full_name: '', email: '', phone: '', password: '', role: 'agent' })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  // Fetch data
  useEffect(() => {
    if (!isAdmin) return

    async function fetchData() {
      const [usersRes, stagesRes, sourcesRes] = await Promise.all([
        supabase.from('profiles').select('*').order('full_name'),
        supabase.from('pipeline_stages').select('*').order('display_order'),
        supabase.from('lead_sources').select('*').order('name'),
      ])
      setUsers(usersRes.data || [])
      setStages(stagesRes.data || [])
      setSources(sourcesRes.data || [])
      setLoading(false)
    }

    fetchData()
  }, [supabase, isAdmin])

  /** Create new user via API (admin only) */
  async function createUser(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      })

      if (!res.ok) {
        const data = await res.json()
        setCreateError(data.error || 'Eroare la creare cont.')
        setCreating(false)
        return
      }

      // Refresh users list
      const { data } = await supabase.from('profiles').select('*').order('full_name')
      setUsers(data || [])
      setShowNewUser(false)
      setNewUser({ full_name: '', email: '', phone: '', password: '', role: 'agent' })
      toast({ title: 'Cont creat cu succes', variant: 'success' })
    } catch {
      setCreateError('Eroare de rețea.')
    }

    setCreating(false)
  }

  /** Toggle user active/inactive */
  async function toggleUserActive(userId: string, currentActive: boolean) {
    const res = await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !currentActive }),
    })

    if (res.ok) {
      setUsers((prev) => prev.map((u) =>
        u.id === userId ? { ...u, is_active: !currentActive } : u
      ))
      toast({
        title: !currentActive ? 'Cont activat' : 'Cont dezactivat',
        variant: !currentActive ? 'success' : 'warning',
      })
    }
  }

  // Guard: admin only
  if (!isAdmin) {
    return (
      <>
        <Header title="Setări" />
        <div className="p-4 sm:p-6 text-sm text-slate-500 dark:text-slate-400">Nu ai acces la această pagină.</div>
      </>
    )
  }

  return (
    <>
      <Header title="Setări" />
      <div className="p-4 sm:p-6 max-w-3xl space-y-8">
        <UsersSection
          users={users}
          showNewUser={showNewUser}
          onToggleNewUser={() => setShowNewUser(!showNewUser)}
          newUser={newUser}
          onNewUserChange={setNewUser}
          onCreateUser={createUser}
          creating={creating}
          createError={createError}
          showPassword={showPassword}
          onToggleShowPassword={() => setShowPassword(!showPassword)}
          onToggleUserActive={toggleUserActive}
        />

        <PipelineStagesSection stages={stages} />

        <LeadSourcesSection sources={sources} />
      </div>
    </>
  )
}
