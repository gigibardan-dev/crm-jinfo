/**
 * src/components/settings/NewUserForm.tsx
 *
 * NewUserForm
 *
 * Formular „Cont Nou” din /settings — nume, email, telefon, parolă
 * inițială, rol. Submisia (POST /api/users) și refresh-ul listei rămân în
 * pagina părinte; componenta doar colectează input-ul și afișează eroarea.
 * Extras din src/app/(app)/settings/page.tsx — comportament identic.
 */

'use client'

import { Eye, EyeOff } from 'lucide-react'

const inputClass = "w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-400"

export interface NewUserFormData {
  full_name: string
  email: string
  phone: string
  password: string
  role: string
}

interface NewUserFormProps {
  value: NewUserFormData
  onChange: (value: NewUserFormData) => void
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
  creating: boolean
  createError: string | null
  showPassword: boolean
  onToggleShowPassword: () => void
}

export function NewUserForm({ value, onChange, onSubmit, onCancel, creating, createError, showPassword, onToggleShowPassword }: NewUserFormProps) {
  function update<K extends keyof NewUserFormData>(key: K, val: NewUserFormData[K]) {
    onChange({ ...value, [key]: val })
  }

  return (
    <form onSubmit={onSubmit} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 mb-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Nume complet</label>
          <input type="text" required value={value.full_name}
            onChange={(e) => update('full_name', e.target.value)}
            className={inputClass} placeholder="Maria Ionescu" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Email</label>
          <input type="email" required value={value.email}
            onChange={(e) => update('email', e.target.value)}
            className={inputClass} placeholder="maria@jinfotours.ro" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Telefon</label>
          <input type="tel" value={value.phone}
            onChange={(e) => update('phone', e.target.value)}
            className={inputClass} />
        </div>
        <div>
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Parolă inițială</label>
          <div className="relative">
            <input type={showPassword ? 'text' : 'password'} required minLength={6}
              value={value.password}
              onChange={(e) => update('password', e.target.value)}
              className={inputClass + ' pr-10'} placeholder="Minim 6 caractere" />
            <button type="button" onClick={onToggleShowPassword}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>
      </div>
      <div>
        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Rol</label>
        <select value={value.role}
          onChange={(e) => update('role', e.target.value)}
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
        <button type="button" onClick={onCancel}
          className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200">
          Anulează
        </button>
      </div>
    </form>
  )
}
