/**
 * src/components/agents/AgentProfileCard.tsx
 *
 * AgentProfileCard
 *
 * Cardul de profil din pagina de detaliu agent: avatar cu inițiale, nume,
 * contact, rol + status activ/inactiv, și (doar admin) formular de editare
 * inline (nume, email, telefon, rol, parolă nouă opțională) cu mesaje de
 * eroare/succes. Mutațiile (fetch PATCH /api/users/:id) rămân în pagina
 * părinte — componenta e strict de prezentare + colectare input.
 * Extras din src/app/(app)/agents/[id]/page.tsx — comportament identic.
 */

'use client'

import { Mail, Phone, Shield, Pencil, X, Check, Eye, EyeOff } from 'lucide-react'
import type { Profile } from '@/lib/types/database'
import { getInitials } from '@/lib/utils'

const inputClass = "w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"

export interface AgentEditForm {
  full_name: string
  email: string
  phone: string
  role: string
  password: string
}

interface AgentProfileCardProps {
  agent: Profile
  isAdmin: boolean
  editing: boolean
  editForm: AgentEditForm
  onEditFormChange: (form: AgentEditForm) => void
  onStartEditing: () => void
  onCancelEditing: () => void
  onSave: () => void
  saving: boolean
  editError: string | null
  editSuccess: boolean
  showPassword: boolean
  onToggleShowPassword: () => void
}

export function AgentProfileCard({
  agent, isAdmin, editing, editForm, onEditFormChange, onStartEditing, onCancelEditing, onSave, saving,
  editError, editSuccess, showPassword, onToggleShowPassword,
}: AgentProfileCardProps) {
  function update<K extends keyof AgentEditForm>(key: K, value: AgentEditForm[K]) {
    onEditFormChange({ ...editForm, [key]: value })
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-lg font-semibold text-blue-700 dark:text-blue-300">
            {getInitials(agent.full_name)}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{agent.full_name}</h2>
            <div className="flex items-center gap-3 mt-1 text-sm text-slate-500 dark:text-slate-400">
              {agent.email && <span className="flex items-center gap-1"><Mail size={13} /> {agent.email}</span>}
              {agent.phone && <span className="flex items-center gap-1"><Phone size={13} /> {agent.phone}</span>}
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded capitalize">
                <Shield size={11} /> {agent.role}
              </span>
              <span className={`w-2 h-2 rounded-full ${agent.is_active ? 'bg-green-500' : 'bg-slate-300'}`} />
              <span className="text-xs text-slate-400">{agent.is_active ? 'Activ' : 'Inactiv'}</span>
            </div>
          </div>
        </div>

        {isAdmin && !editing && (
          <button onClick={onStartEditing} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            <Pencil size={14} /> Editează
          </button>
        )}
      </div>

      {editing && isAdmin && (
        <div className="border-t border-slate-100 dark:border-slate-800 pt-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Nume complet</label>
              <input type="text" value={editForm.full_name} onChange={(e) => update('full_name', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Email</label>
              <input type="email" value={editForm.email} onChange={(e) => update('email', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Telefon</label>
              <input type="tel" value={editForm.phone} onChange={(e) => update('phone', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Rol</label>
              <select value={editForm.role} onChange={(e) => update('role', e.target.value)} className={inputClass}>
                <option value="agent">Agent</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Parolă nouă (lasă gol pentru a nu schimba)</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={editForm.password}
                onChange={(e) => update('password', e.target.value)}
                placeholder="Minim 6 caractere"
                className={inputClass + ' pr-10'}
              />
              <button
                type="button"
                onClick={onToggleShowPassword}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {editError && (
            <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 rounded-lg px-3 py-2">{editError}</div>
          )}

          <div className="flex items-center gap-3">
            <button onClick={onSave} disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
              <Check size={14} /> {saving ? 'Se salvează...' : 'Salvează'}
            </button>
            <button onClick={onCancelEditing}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200">
              <X size={14} /> Anulează
            </button>
          </div>
        </div>
      )}

      {editSuccess && (
        <div className="mt-4 text-sm text-green-600 bg-green-50 dark:bg-green-950 border border-green-100 dark:border-green-900 rounded-lg px-3 py-2">
          Profil actualizat cu succes.
        </div>
      )}
    </div>
  )
}
