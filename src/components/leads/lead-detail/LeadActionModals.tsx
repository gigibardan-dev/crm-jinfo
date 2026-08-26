/**
 * src/components/leads/lead-detail/LeadActionModals.tsx
 *
 * LostReasonModal, WonValueModal, DeleteLeadModal
 *
 * Cele trei modale folosite pe pagina de detaliu lead pentru acțiuni cu
 * confirmare obligatorie: marcare „pierdut” (motiv obligatoriu din listă
 * sau text liber), marcare „câștigat” (valoare booking opțională) și
 * ștergere lead (admin only, ireversibil). Fiecare e exportat separat și
 * randat condiționat de pagina părinte (`show && <Modal ... />`).
 * Extras din src/app/(app)/leads/[id]/page.tsx — comportament identic.
 */

'use client'

import { Trophy, Trash2 } from 'lucide-react'
import { LOST_REASONS, FORM_INPUT_CLASSES } from '@/lib/utils/constants'

// ============================================================
// LostReasonModal
// ============================================================

interface LostReasonModalProps {
  lostReason: string
  onLostReasonChange: (value: string) => void
  lostReasonCustom: string
  onLostReasonCustomChange: (value: string) => void
  onCancel: () => void
  onConfirm: () => void
}

export function LostReasonModal({ lostReason, onLostReasonChange, lostReasonCustom, onLostReasonCustomChange, onCancel, onConfirm }: LostReasonModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-md p-6 mx-4 border border-slate-200 dark:border-slate-700">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">Motiv pierdere</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Selectează motivul pentru care lead-ul a fost pierdut.</p>
        <div className="space-y-2 mb-4">
          {LOST_REASONS.map((reason) => (
            <label key={reason} className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="lost_reason" value={reason} checked={lostReason === reason} onChange={() => onLostReasonChange(reason)}
                className="w-4 h-4 text-blue-600 border-slate-300 dark:border-slate-600 focus:ring-blue-500" />
              <span className="text-sm text-slate-700 dark:text-slate-300">{reason}</span>
            </label>
          ))}
        </div>
        {lostReason === 'Altul' && (
          <input type="text" value={lostReasonCustom} onChange={(e) => onLostReasonCustomChange(e.target.value)} placeholder="Descrie motivul..." className={FORM_INPUT_CLASSES + ' mb-4'} />
        )}
        <div className="flex items-center gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400">Anulează</button>
          <button disabled={!lostReason || (lostReason === 'Altul' && !lostReasonCustom)}
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors">
            Marchează ca Pierdut
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// WonValueModal
// ============================================================

interface WonValueModalProps {
  wonValue: string
  onWonValueChange: (value: string) => void
  onCancel: () => void
  onConfirm: () => void
}

export function WonValueModal({ wonValue, onWonValueChange, onCancel, onConfirm }: WonValueModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-sm p-6 mx-4 border border-slate-200 dark:border-slate-700">
        <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 flex items-center justify-center mx-auto mb-4">
          <Trophy size={24} />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 text-center mb-1">Lead câștigat</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-5">Introdu valoarea booking-ului (opțional).</p>
        <div className="mb-5">
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Valoare (EUR)</label>
          <input type="number" min={0} step={0.01} value={wonValue} onChange={(e) => onWonValueChange(e.target.value)}
            placeholder="ex: 2500" autoFocus className={FORM_INPUT_CLASSES} />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onCancel}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            Anulează
          </button>
          <button onClick={onConfirm}
            className="flex-1 px-4 py-2.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
            Confirmă
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// DeleteLeadModal
// ============================================================

interface DeleteLeadModalProps {
  deleting: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function DeleteLeadModal({ deleting, onCancel, onConfirm }: DeleteLeadModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-sm p-6 mx-4 border border-slate-200 dark:border-slate-700">
        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-4">
          <Trash2 size={24} />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 text-center mb-1">Șterge lead</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6">
          Ești sigur că vrei să ștergi acest lead? Acțiunea este permanentă și <strong>nu poate fi anulată</strong>. Toate comentariile, reminder-ele și activitățile asociate vor fi șterse.
        </p>
        <div className="flex items-center gap-3">
          <button onClick={onCancel}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            Anulează
          </button>
          <button onClick={onConfirm} disabled={deleting}
            className="flex-1 px-4 py-2.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors">
            {deleting ? 'Se șterge...' : 'Șterge definitiv'}
          </button>
        </div>
      </div>
    </div>
  )
}
