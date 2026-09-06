/**
 * src/app/(app)/settings/page.tsx
 *
 * Settings Page — Admin only
 *
 * Owner de state/date pentru toate secțiunile de setări. Markup-ul e
 * delegat componentelor din src/components/settings/*. Organizate pe
 * taburi (au tot crescut — 6 secțiuni pe-o singură pagină lungă înainte,
 * vezi discuția din chat):
 *
 * - Utilizatori: conturi (creare, activ/inactiv, digest zilnic) + alocare
 *   automată round-robin (ambele despre agenți/manageri și munca lor).
 * - Pipeline: etape (Pipeline Stages) + surse de leaduri (Lead Sources) —
 *   configurația fluxului de vânzare.
 * - Email: status SMTP + test + control notificări automate.
 * - Integrări: mapare formulare Facebook (Google Sheets) — loc pregătit
 *   pt. viitoare integrări noi.
 *
 * Toate taburile rămân montate simultan (ascunse cu CSS, nu demontate) —
 * fiecare secțiune își face propriul fetch o singură dată, la încărcarea
 * paginii, nu de fiecare dată când adminul comută tabul (mai ales
 * FacebookMappingSection, care citește live din Google Sheets — ar fi
 * lent să repete asta la fiecare click pe tab).
 */

'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import { Users, Workflow, Mail, Plug } from 'lucide-react'
import type { Profile, PipelineStage, LeadSource } from '@/lib/types/database'
import { UsersSection } from '@/components/settings/UsersSection'
import type { NewUserFormData } from '@/components/settings/NewUserForm'
import { PipelineStagesSection } from '@/components/settings/PipelineStagesSection'
import { LeadSourcesSection } from '@/components/settings/LeadSourcesSection'
import { AutoAssignPanel } from '@/components/dashboard/AutoAssignPanel'
import { EmailTestSection } from '@/components/settings/EmailTestSection'
import { FacebookMappingSection } from '@/components/settings/FacebookMappingSection'

const TABS = [
  { key: 'utilizatori', label: 'Utilizatori', icon: Users },
  { key: 'pipeline', label: 'Pipeline', icon: Workflow },
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'integrari', label: 'Integrări', icon: Plug },
] as const

type TabKey = (typeof TABS)[number]['key']

export default function SettingsPage() {
  const { isAdmin } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()

  const [users, setUsers] = useState<Profile[]>([])
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [sources, setSources] = useState<LeadSource[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('utilizatori')

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

  /** Toggle digest zilnic pentru un user (migrarea 010) — doar admin, nu e self-service. */
  async function toggleUserDigest(userId: string, currentReceivesDigest: boolean) {
    const res = await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receives_digest: !currentReceivesDigest }),
    })

    if (res.ok) {
      setUsers((prev) => prev.map((u) =>
        u.id === userId ? { ...u, receives_digest: !currentReceivesDigest } : u
      ))
      toast({
        title: !currentReceivesDigest ? 'Digest zilnic activat' : 'Digest zilnic oprit pentru acest user',
        variant: !currentReceivesDigest ? 'success' : 'warning',
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
      <div className="p-4 sm:p-6 max-w-3xl">
        <div className="flex gap-1 mb-6 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                aria-current={isActive}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  isActive
                    ? 'border-blue-600 text-blue-700 dark:text-blue-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Toate taburile rămân montate (ascunse cu `hidden`, nu demontate) —
            vezi nota din docblock-ul de sus. */}
        <div className={activeTab === 'utilizatori' ? 'space-y-8' : 'hidden'}>
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
            onToggleUserDigest={toggleUserDigest}
          />

          {/* Oglindă a panoului de pe Dashboard — aceeași componentă,
              self-gated admin/manager intern. Vezi AutoAssignPanel + migrarea 005. */}
          <AutoAssignPanel />
        </div>

        <div className={activeTab === 'pipeline' ? 'space-y-8' : 'hidden'}>
          <PipelineStagesSection stages={stages} />
          <LeadSourcesSection sources={sources} />
        </div>

        <div className={activeTab === 'email' ? 'space-y-8' : 'hidden'}>
          <EmailTestSection />
        </div>

        <div className={activeTab === 'integrari' ? 'space-y-8' : 'hidden'}>
          <FacebookMappingSection />
        </div>
      </div>
    </>
  )
}
