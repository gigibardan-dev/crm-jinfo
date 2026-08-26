/**
 * src/components/settings/UsersSection.tsx
 *
 * UsersSection
 *
 * Secțiunea „Utilizatori” din /settings: header cu buton „Cont Nou” (afișează
 * NewUserForm), și lista de utilizatori cu rol + toggle activ/inactiv.
 * Mutațiile (creare, toggle activ) rămân în pagina părinte.
 * Extras din src/app/(app)/settings/page.tsx — comportament identic.
 */

'use client'

import Link from 'next/link'
import { UserPlus, Shield } from 'lucide-react'
import type { Profile } from '@/lib/types/database'
import { getInitials } from '@/lib/utils'
import { NewUserForm, type NewUserFormData } from '@/components/settings/NewUserForm'

interface UsersSectionProps {
  users: Profile[]
  showNewUser: boolean
  onToggleNewUser: () => void
  newUser: NewUserFormData
  onNewUserChange: (value: NewUserFormData) => void
  onCreateUser: (e: React.FormEvent) => void
  creating: boolean
  createError: string | null
  showPassword: boolean
  onToggleShowPassword: () => void
  onToggleUserActive: (userId: string, currentActive: boolean) => void
}

export function UsersSection({
  users, showNewUser, onToggleNewUser, newUser, onNewUserChange, onCreateUser, creating, createError,
  showPassword, onToggleShowPassword, onToggleUserActive,
}: UsersSectionProps) {
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Utilizatori</h3>
        <button onClick={onToggleNewUser}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <UserPlus size={14} /> Cont Nou
        </button>
      </div>

      {showNewUser && (
        <NewUserForm
          value={newUser}
          onChange={onNewUserChange}
          onSubmit={onCreateUser}
          onCancel={onToggleNewUser}
          creating={creating}
          createError={createError}
          showPassword={showPassword}
          onToggleShowPassword={onToggleShowPassword}
        />
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        {users.map((user, i) => (
          <div key={user.id}
            className={`flex flex-wrap items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-slate-50 dark:border-slate-800' : ''}`}>
            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-medium text-slate-600 dark:text-slate-300 shrink-0">
              {getInitials(user.full_name)}
            </div>
            <div className="flex-1 min-w-[8rem]">
              <Link href={`/agents/${user.id}`}
                className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate block">
                {user.full_name}
              </Link>
              <p className="text-xs text-slate-400 truncate">{user.email}</p>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded capitalize shrink-0">
              <Shield size={10} /> {user.role}
            </span>

            {/* Active/Inactive toggle */}
            <button
              onClick={() => onToggleUserActive(user.id, user.is_active)}
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
  )
}
