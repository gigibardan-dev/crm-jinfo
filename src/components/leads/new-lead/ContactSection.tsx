/**
 * src/components/leads/new-lead/ContactSection.tsx
 *
 * ContactSection
 *
 * Secțiunea „Date Contact” din formularul /leads/new — prenume, nume,
 * telefon, email. Fără state propriu, primește doar câmpurile relevante
 * + funcția de update generică din formularul părinte.
 * Extras din src/app/(app)/leads/new/page.tsx — comportament identic.
 */

'use client'

import { NEW_LEAD_INPUT_CLASS } from './NewLeadFormTypes'

interface ContactSectionProps {
  firstName: string
  lastName: string
  phone: string
  email: string
  onChange: (field: 'first_name' | 'last_name' | 'phone' | 'email', value: string) => void
}

export function ContactSection({ firstName, lastName, phone, email, onChange }: ContactSectionProps) {
  return (
    <section>
      <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-3">Date Contact</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Prenume</label>
          <input type="text" value={firstName} onChange={(e) => onChange('first_name', e.target.value)} className={NEW_LEAD_INPUT_CLASS} placeholder="Ion" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Nume</label>
          <input type="text" value={lastName} onChange={(e) => onChange('last_name', e.target.value)} className={NEW_LEAD_INPUT_CLASS} placeholder="Popescu" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Telefon</label>
          <input type="tel" value={phone} onChange={(e) => onChange('phone', e.target.value)} className={NEW_LEAD_INPUT_CLASS} placeholder="0722.123.456" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Email</label>
          <input type="email" value={email} onChange={(e) => onChange('email', e.target.value)} className={NEW_LEAD_INPUT_CLASS} placeholder="ion@email.com" />
        </div>
      </div>
    </section>
  )
}
