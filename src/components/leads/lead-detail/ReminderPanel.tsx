/**
 * src/components/leads/lead-detail/ReminderPanel.tsx
 *
 * ReminderPanel
 *
 * Buton „Setează Reminder” + formular (dată/oră + notă) + lista de
 * remindere active pentru lead-ul curent, cu buton „Completat” pe fiecare.
 * Fără state de date proprii — toate mutațiile (creare/completare reminder)
 * rămân în pagina părinte, componenta doar afișează și emite callback-uri.
 * Extras din src/app/(app)/leads/[id]/page.tsx — comportament identic.
 */

'use client'

import { Bell } from 'lucide-react'
import type { Reminder } from '@/lib/types/database'
import { FORM_INPUT_CLASSES } from '@/lib/utils/constants'

interface ReminderPanelProps {
  show: boolean
  onToggleShow: () => void
  reminderDate: string
  onReminderDateChange: (value: string) => void
  reminderNote: string
  onReminderNoteChange: (value: string) => void
  onSubmit: (e: React.FormEvent) => void
  reminders: Reminder[]
  onCompleteReminder: (reminderId: string) => void
}

export function ReminderPanel({
  show, onToggleShow, reminderDate, onReminderDateChange, reminderNote, onReminderNoteChange,
  onSubmit, reminders, onCompleteReminder,
}: ReminderPanelProps) {
  const activeReminders = reminders.filter((r) => !r.is_completed)

  return (
    <>
      <button onClick={onToggleShow}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
        <Bell size={15} /> Setează Reminder
      </button>

      {show && (
        <form onSubmit={onSubmit} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Data și ora</label>
            <input type="datetime-local" value={reminderDate} onChange={(e) => onReminderDateChange(e.target.value)} required className={FORM_INPUT_CLASSES} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Notă</label>
            <input type="text" value={reminderNote} onChange={(e) => onReminderNoteChange(e.target.value)} placeholder="Follow-up ofertă..." className={FORM_INPUT_CLASSES} />
          </div>
          <button type="submit" className="w-full py-2 text-sm font-medium bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors">
            Salvează Reminder
          </button>
        </form>
      )}

      {activeReminders.length > 0 && (
        <div className="bg-orange-50 dark:bg-orange-950 border border-orange-100 dark:border-orange-900 rounded-xl p-4">
          <h4 className="text-xs font-medium text-orange-800 dark:text-orange-300 mb-2">Remindere active</h4>
          {activeReminders.map((rem) => (
            <div key={rem.id} className="flex items-center justify-between py-1.5 text-xs">
              <div>
                <span className="text-orange-700 dark:text-orange-400 font-medium">{new Date(rem.remind_at).toLocaleDateString('ro-RO')}</span>
                {rem.note && <span className="text-orange-600 dark:text-orange-500 ml-2">{rem.note}</span>}
              </div>
              <button onClick={() => onCompleteReminder(rem.id)} className="text-orange-500 hover:text-orange-700 dark:hover:text-orange-300 text-[10px] font-medium">
                Completat
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
