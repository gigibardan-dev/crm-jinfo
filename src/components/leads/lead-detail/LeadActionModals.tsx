/**
 * src/components/leads/lead-detail/LeadActionModals.tsx
 *
 * LostReasonModal, WonValueModal, DeleteLeadModal, OriginalEmailModal
 *
 * Modalele folosite pe pagina de detaliu lead pentru acțiuni cu confirmare
 * obligatorie (Lost/Won/Delete) + un modal read-only (OriginalEmailModal,
 * fără confirmare — doar afișare). Fiecare e exportat separat și randat
 * condiționat de componenta care îl deschide (`show && <Modal ... />`).
 * Extras din src/app/(app)/leads/[id]/page.tsx — comportament identic.
 */

'use client'

import { Trophy, Trash2, Mail, X } from 'lucide-react'
import { LOST_REASONS, FORM_INPUT_CLASSES } from '@/lib/utils/constants'
import type { WonDetails } from '@/lib/types/wonDetails'

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
// Toate câmpurile sunt opționale — un agent poate marca rapid un lead ca
// „won" fără să completeze nimic, sau poate adăuga detaliile complete ale
// booking-ului (sumă/comision pe ambele valute + cele 3 numere de
// referință) dacă le are deja la îndemână. Folosit atât din pagina de
// detaliu lead cât și din Pipeline (același modal, vezi leads/page.tsx).

const WON_INPUT_CLASSES =
  'w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500'

interface WonValueModalProps {
  details: WonDetails
  onChange: (field: keyof WonDetails, value: string) => void
  onCancel: () => void
  onConfirm: () => void
}

export function WonValueModal({ details, onChange, onCancel, onConfirm }: WonValueModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 mx-4 border border-slate-200 dark:border-slate-700">
        <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 flex items-center justify-center mx-auto mb-4">
          <Trophy size={24} />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 text-center mb-1">Lead câștigat</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-5">Detaliile booking-ului — toate câmpurile sunt opționale.</p>

        <div className="space-y-4 mb-5">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Sumă totală încasată</label>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" min={0} step={0.01} value={details.value} onChange={(e) => onChange('value', e.target.value)}
                placeholder="EUR" autoFocus className={WON_INPUT_CLASSES} />
              <input type="number" min={0} step={0.01} value={details.totalAmountRon} onChange={(e) => onChange('totalAmountRon', e.target.value)}
                placeholder="RON" className={WON_INPUT_CLASSES} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Comision</label>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" min={0} step={0.01} value={details.commissionEur} onChange={(e) => onChange('commissionEur', e.target.value)}
                placeholder="EUR" className={WON_INPUT_CLASSES} />
              <input type="number" min={0} step={0.01} value={details.commissionRon} onChange={(e) => onChange('commissionRon', e.target.value)}
                placeholder="RON" className={WON_INPUT_CLASSES} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Nr. comandă (sistem)</label>
              <input type="text" value={details.orderNumber} onChange={(e) => onChange('orderNumber', e.target.value)}
                placeholder="ex: CMD-2201" className={WON_INPUT_CLASSES} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Nr. contract</label>
              <input type="text" value={details.contractNumber} onChange={(e) => onChange('contractNumber', e.target.value)}
                placeholder="ex: C-114" className={WON_INPUT_CLASSES} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Nr. factură</label>
              <input type="text" value={details.invoiceNumber} onChange={(e) => onChange('invoiceNumber', e.target.value)}
                placeholder="ex: F-889" className={WON_INPUT_CLASSES} />
            </div>
          </div>
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

// ============================================================
// OriginalEmailModal
// ============================================================
// Read-only — afișează textul brut al emailului original din care a fost
// creat lead-ul (canalul „email", forward de agent — vezi
// /api/leads/inbound-email). Util mai ales pentru leadurile flagged
// „revizuire-ai” (extragere AI eșuată sau fără date esențiale), unde
// agentul chiar are nevoie să citească originalul ca să știe ce să facă.

interface OriginalEmailModalProps {
  subiect: string | null
  expeditor: string | null
  continut: string
  onClose: () => void
}

export function OriginalEmailModal({ subiect, expeditor, continut, onClose }: OriginalEmailModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-slate-200 dark:border-slate-700">
        <div className="flex items-start justify-between gap-3 p-5 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Mail size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">Email original</h3>
            </div>
            {subiect && <p className="text-sm text-slate-600 dark:text-slate-400 truncate">{subiect}</p>}
            {expeditor && <p className="text-xs text-slate-400 mt-0.5 truncate">De la: {expeditor}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 -mr-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto p-5">
          <pre className="whitespace-pre-wrap break-words font-sans text-sm text-slate-700 dark:text-slate-300">{continut}</pre>
        </div>
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            Închide
          </button>
        </div>
      </div>
    </div>
  )
}
