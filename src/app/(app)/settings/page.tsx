'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import type { Profile, PipelineStage, LeadSource } from '@/lib/types/database'
import { getInitials } from '@/lib/utils'
import { Plus, UserPlus } from 'lucide-react'

export default function SettingsPage() {
  const { isAdmin } = useAuth()
  const supabase = createClient()

  const [users, setUsers] = useState<Profile[]>([])
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [sources, setSources] = useState<LeadSource[]>([])
  const [loading, setLoading] = useState(true)

  // New user form
  const [showNewUser, setShowNewUser] = useState(false)
  const [newUser, setNewUser] = useState({ full_name: '', email: '', phone: '', password: '', role: 'agent' })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAdmin) return

    async function fetch() {
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

    fetch()
  }, [supabase, isAdmin])

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
    } catch {
      setCreateError('Eroare de rețea.')
    }

    setCreating(false)
  }

  if (!isAdmin) {
    return (
      <>
        <Header title="Setări" />
        <div className="p-6 text-sm text-slate-500">Nu ai acces la această pagină.</div>
      </>
    )
  }

  return (
    <>
      <Header title="Setări" />
      <div className="p-6 max-w-3xl space-y-8">
        {/* Users Management */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-900">Utilizatori</h3>
            <button
              onClick={() => setShowNewUser(!showNewUser)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <UserPlus size={14} />
              Cont Nou
            </button>
          </div>

          {showNewUser && (
            <form onSubmit={createUser} className="bg-white border border-slate-200 rounded-xl p-5 mb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Nume complet</label>
                  <input
                    type="text"
                    required
                    value={newUser.full_name}
                    onChange={(e) => setNewUser((p) => ({ ...p, full_name: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Maria Ionescu"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={newUser.email}
                    onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="maria@jinfotours.ro"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Telefon</label>
                  <input
                    type="tel"
                    value={newUser.phone}
                    onChange={(e) => setNewUser((p) => ({ ...p, phone: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Parolă inițială</label>
                  <input
                    type="text"
                    required
                    minLength={6}
                    value={newUser.password}
                    onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Rol</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="agent">Agent</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {createError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {createError}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {creating ? 'Se creează...' : 'Creează Cont'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewUser(false)}
                  className="px-4 py-2 text-sm text-slate-600"
                >
                  Anulează
                </button>
              </div>
            </form>
          )}

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {users.map((user, i) => (
              <div
                key={user.id}
                className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-slate-50' : ''}`}
              >
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium text-slate-600">
                  {getInitials(user.full_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">{user.full_name}</p>
                  <p className="text-xs text-slate-400">{user.email}</p>
                </div>
                <span className="text-xs font-medium text-slate-500 capitalize bg-slate-100 px-2 py-0.5 rounded">
                  {user.role}
                </span>
                <span className={`w-2 h-2 rounded-full ${user.is_active ? 'bg-green-500' : 'bg-slate-300'}`} />
              </div>
            ))}
          </div>
        </section>

        {/* Pipeline Stages */}
        <section>
          <h3 className="text-base font-semibold text-slate-900 mb-4">Pipeline Stages</h3>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {stages.map((stage, i) => (
              <div
                key={stage.id}
                className={`flex items-center gap-3 px-4 py-2.5 ${i > 0 ? 'border-t border-slate-50' : ''}`}
              >
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color || '#94a3b8' }} />
                <span className="text-sm text-slate-700 flex-1">{stage.name}</span>
                <span className="text-xs text-slate-400">{stage.slug}</span>
                {stage.is_terminal && (
                  <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">terminal</span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Lead Sources */}
        <section>
          <h3 className="text-base font-semibold text-slate-900 mb-4">Surse Lead</h3>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {sources.map((source, i) => (
              <div
                key={source.id}
                className={`flex items-center gap-3 px-4 py-2.5 ${i > 0 ? 'border-t border-slate-50' : ''}`}
              >
                <span className="text-base">{source.icon}</span>
                <span className="text-sm text-slate-700 flex-1">{source.name}</span>
                <span className="text-xs text-slate-400">{source.slug}</span>
                <span className={`w-2 h-2 rounded-full ${source.is_active ? 'bg-green-500' : 'bg-slate-300'}`} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}
