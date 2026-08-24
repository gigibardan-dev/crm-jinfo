'use client'

/**
 * Settings Page — Admin only
 * 
 * Secțiuni:
 * - Utilizatori: creare cont nou, toggle activ/inactiv
 * - Pipeline Stages: vizualizare configurație
 * - Lead Sources: vizualizare surse cu Lucide icons
 */

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import { SourceIcon } from '@/components/leads/SourceIcon'
import type { Profile, PipelineStage, LeadSource } from '@/lib/types/database'
import { getInitials } from '@/lib/utils'
import { UserPlus, Eye, EyeOff, Shield } from 'lucide-react'
import Link from 'next/link'

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
  const [newUser, setNewUser] = useState({ full_name: '', email: '', phone: '', password: '', role: 'agent' })
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

  const inputClass = "w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-400"

  // Guard: admin only
  if (!isAdmin) {
    return (
      <>
        <Header title="Setări" />
        <div className="p-6 text-sm text-slate-500 dark:text-slate-400">Nu ai acces la această pagină.</div>
      </>
    )
  }

  return (
    <>
      <Header title="Setări" />
      <div className="p-6 max-w-3xl space-y-8">

        {/* ===== USERS MANAGEMENT ===== */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Utilizatori</h3>
            <button onClick={() => setShowNewUser(!showNewUser)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <UserPlus size={14} /> Cont Nou
            </button>
          </div>

          {/* New user form */}
          {showNewUser && (
            <form onSubmit={createUser} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 mb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Nume complet</label>
                  <input type="text" required value={newUser.full_name}
                    onChange={(e) => setNewUser((p) => ({ ...p, full_name: e.target.value }))}
                    className={inputClass} placeholder="Maria Ionescu" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Email</label>
                  <input type="email" required value={newUser.email}
                    onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))}
                    className={inputClass} placeholder="maria@jinfotours.ro" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Telefon</label>
                  <input type="tel" value={newUser.phone}
                    onChange={(e) => setNewUser((p) => ({ ...p, phone: e.target.value }))}
                    className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Parolă inițială</label>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} required minLength={6}
                      value={newUser.password}
                      onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))}
                      className={inputClass + ' pr-10'} placeholder="Minim 6 caractere" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Rol</label>
                <select value={newUser.role}
                  onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value }))}
                  className={inputClass}>
                  <option value="agent">Agent</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {createError && (
                <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 rounded-lg px-3 py-2">{createError}</div>
              )}

              <div className="flex gap-3">
                <button type="submit" disabled={creating}
                  className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {creating ? 'Se creează...' : 'Creează Cont'}
                </button>
                <button type="button" onClick={() => setShowNewUser(false)}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200">
                  Anulează
                </button>
              </div>
            </form>
          )}

          {/* Users list */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            {users.map((user, i) => (
              <div key={user.id}
                className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-slate-50 dark:border-slate-800' : ''}`}>
                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-medium text-slate-600 dark:text-slate-300">
                  {getInitials(user.full_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <Link href={`/agents/${user.id}`}
                    className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                    {user.full_name}
                  </Link>
                  <p className="text-xs text-slate-400">{user.email}</p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded capitalize">
                  <Shield size={10} /> {user.role}
                </span>

                {/* Active/Inactive toggle */}
                <button
                  onClick={() => toggleUserActive(user.id, user.is_active)}
                  className={`text-xs font-medium px-2 py-1 rounded transition-colors ${
                    user.is_active
                      ? 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950 hover:bg-green-100 dark:hover:bg-green-900'
                      : 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                  title={user.is_active ? 'Click pentru dezactivare' : 'Click pentru activare'}
                >
                  {user.is_active ? 'Activ' : 'Inactiv'}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* ===== PIPELINE STAGES ===== */}
        <section>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">Pipeline Stages</h3>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            {stages.map((stage, i) => (
              <div key={stage.id}
                className={`flex items-center gap-3 px-4 py-2.5 ${i > 0 ? 'border-t border-slate-50 dark:border-slate-800' : ''}`}>
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color || '#94a3b8' }} />
                <span className="text-sm text-slate-700 dark:text-slate-300 flex-1">{stage.name}</span>
                <span className="text-xs text-slate-400 font-mono">{stage.slug}</span>
                {stage.is_terminal && (
                  <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded">terminal</span>
                )}
                {stage.is_default && (
                  <span className="text-[10px] bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">implicit</span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ===== LEAD SOURCES ===== */}
        <section>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">Surse Lead</h3>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            {sources.map((source, i) => (
              <div key={source.id}
                className={`flex items-center gap-3 px-4 py-2.5 ${i > 0 ? 'border-t border-slate-50 dark:border-slate-800' : ''}`}>
                <SourceIcon source={source.slug} size="md" />
                <span className="text-sm text-slate-700 dark:text-slate-300 flex-1">{source.name}</span>
                <span className="text-xs text-slate-400 font-mono">{source.slug}</span>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${source.is_active ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}