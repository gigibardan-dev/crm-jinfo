/**
 * src/components/leads/lead-detail/LeadInfoCard.tsx
 *
 * LeadInfoCard
 *
 * Cardul principal de informații al lead-ului (pagina de detaliu), cu două
 * moduri: vizualizare (nume, contact, destinație, date, buget, mesaj, tag-uri)
 * și editare inline (formular complet). Comută între cele două prin props
 * controlate din pagina părinte — nu ține state propriu de date, doar
 * afișează `editForm` și trimite modificările înapoi prin `onEditFormChange`.
 * Extras din src/app/(app)/leads/[id]/page.tsx — comportament identic.
 */

'use client'

import { Pencil, X, Check, Phone, Mail, MapPin, Calendar, Users, Wallet, Tag } from 'lucide-react'
import { PriorityBadge } from '@/components/leads/PriorityBadge'
import type { Lead } from '@/lib/types/database'
import { fullName, formatTravelDates, formatTravelers, formatPhone } from '@/lib/utils'
import { TRIP_TYPES, FORM_INPUT_CLASSES } from '@/lib/utils/constants'

export interface LeadEditForm {
  first_name: string
  last_name: string
  phone: string
  email: string
  destination: string
  travel_date_from: string
  travel_date_to: string
  nr_adults: number
  nr_children: number
  children_ages: string
  budget_range: string
  trip_type: string
  message: string
  priority: Lead['priority']
}

interface LeadInfoCardProps {
  lead: Lead
  editing: boolean
  editForm: LeadEditForm
  onEditFormChange: (form: LeadEditForm) => void
  onStartEditing: () => void
  onCancelEditing: () => void
  onSave: () => void
  saving: boolean
}

export function LeadInfoCard({ lead, editing, editForm, onEditFormChange, onStartEditing, onCancelEditing, onSave, saving }: LeadInfoCardProps) {
  function update<K extends keyof LeadEditForm>(key: K, value: LeadEditForm[K]) {
    onEditFormChange({ ...editForm, [key]: value })
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
      {/* Edit toggle */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          {!editing && (
            <button onClick={onStartEditing} className="p-1 rounded text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors" title="Editează">
              <Pencil size={14} />
            </button>
          )}
          {editing && (
            <div className="flex items-center gap-1">
              <button onClick={onSave} disabled={saving} className="p-1 rounded text-green-600 hover:bg-green-50 dark:hover:bg-green-950 transition-colors" title="Salvează">
                <Check size={16} />
              </button>
              <button onClick={onCancelEditing} className="p-1 rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Anulează">
                <X size={16} />
              </button>
            </div>
          )}
        </div>
        {!editing && <PriorityBadge priority={lead.priority} size="md" />}
      </div>

      {editing ? (
        /* --- EDIT MODE --- */
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Prenume</label>
              <input type="text" value={editForm.first_name} onChange={(e) => update('first_name', e.target.value)} className={FORM_INPUT_CLASSES} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Nume</label>
              <input type="text" value={editForm.last_name} onChange={(e) => update('last_name', e.target.value)} className={FORM_INPUT_CLASSES} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Telefon</label>
              <input type="tel" value={editForm.phone} onChange={(e) => update('phone', e.target.value)} className={FORM_INPUT_CLASSES} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Email</label>
              <input type="email" value={editForm.email} onChange={(e) => update('email', e.target.value)} className={FORM_INPUT_CLASSES} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Destinație</label>
              <input type="text" value={editForm.destination} onChange={(e) => update('destination', e.target.value)} className={FORM_INPUT_CLASSES} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Tip călătorie</label>
              <select value={editForm.trip_type} onChange={(e) => update('trip_type', e.target.value)} className={FORM_INPUT_CLASSES}>
                <option value="">—</option>
                {TRIP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Plecare</label>
              <input type="date" value={editForm.travel_date_from} onChange={(e) => update('travel_date_from', e.target.value)} className={FORM_INPUT_CLASSES} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Întoarcere</label>
              <input type="date" value={editForm.travel_date_to} onChange={(e) => update('travel_date_to', e.target.value)} className={FORM_INPUT_CLASSES} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Adulți</label>
              <input type="number" min={1} max={20} value={editForm.nr_adults} onChange={(e) => update('nr_adults', Number(e.target.value))} className={FORM_INPUT_CLASSES} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Copii</label>
              <input type="number" min={0} max={10} value={editForm.nr_children} onChange={(e) => update('nr_children', Number(e.target.value))} className={FORM_INPUT_CLASSES} />
            </div>
            {editForm.nr_children > 0 && (
              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Vârste copii</label>
                <input type="text" value={editForm.children_ages} onChange={(e) => update('children_ages', e.target.value)} className={FORM_INPUT_CLASSES} placeholder="ex: 4, 7" />
              </div>
            )}
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Buget</label>
              <input type="text" value={editForm.budget_range} onChange={(e) => update('budget_range', e.target.value)} className={FORM_INPUT_CLASSES} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Prioritate</label>
              <select value={editForm.priority} onChange={(e) => update('priority', e.target.value as Lead['priority'])} className={FORM_INPUT_CLASSES}>
                <option value="low">Scăzut</option>
                <option value="medium">Mediu</option>
                <option value="high">Ridicat</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Mesaj / Note</label>
            <textarea rows={3} value={editForm.message} onChange={(e) => update('message', e.target.value)} className={FORM_INPUT_CLASSES + ' resize-none'} />
          </div>
        </div>
      ) : (
        /* --- VIEW MODE --- */
        <>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            {fullName(lead.first_name, lead.last_name)}
          </h2>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            {lead.phone && <span className="flex items-center gap-1 min-w-0"><Phone size={13} className="shrink-0" /> <span className="truncate">{formatPhone(lead.phone)}</span></span>}
            {lead.email && <span className="flex items-center gap-1 min-w-0"><Mail size={13} className="shrink-0" /> <span className="truncate">{lead.email}</span></span>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm mt-4">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <MapPin size={14} /> <span className="text-slate-700 dark:text-slate-300">{lead.destination || '—'}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <Calendar size={14} /> <span className="text-slate-700 dark:text-slate-300">{formatTravelDates(lead.travel_date_from, lead.travel_date_to)}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <Users size={14} /> <span className="text-slate-700 dark:text-slate-300">{formatTravelers(lead.nr_adults, lead.nr_children)}{lead.children_ages ? ` (${lead.children_ages} ani)` : ''}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <Wallet size={14} /> <span className="text-slate-700 dark:text-slate-300">{lead.budget_range || '—'}</span>
            </div>
          </div>
          {lead.message && (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs text-slate-400 mb-1">Mesaj original</p>
              <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{lead.message}</p>
            </div>
          )}
          {lead.tags && lead.tags.length > 0 && (
            <div className="mt-3 flex items-center gap-1.5">
              <Tag size={12} className="text-slate-400" />
              {lead.tags.map((tag) => (
                <span key={tag} className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded">{tag}</span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
