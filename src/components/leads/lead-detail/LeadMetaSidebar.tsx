/**
 * src/components/leads/lead-detail/LeadMetaSidebar.tsx
 *
 * LeadMetaSidebar
 *
 * Cardul de meta-informații din coloana dreaptă a paginii de detaliu lead:
 * sursă, agent alocat (cu dropdown de realocare pentru admin/manager),
 * dată creare/alocare/prim-răspuns, detaliile booking-ului câștigat (sumă
 * EUR/RON, comision EUR/RON, nr. comandă/contract/factură — toate
 * opționale, completate din WonValueModal) sau motiv de pierdere.
 * Extras din src/app/(app)/leads/[id]/page.tsx — comportament identic.
 *
 * Buton „Vezi email original” — doar pentru lead-uri din sursa „email”
 * (forward de agent, vezi /api/leads/inbound-email) care chiar au text
 * salvat în `source_raw_data.continut`. State-ul modalului e local aici
 * (read-only, nu are nevoie de nimic din pagina părinte).
 */

'use client'

import { useState } from 'react'
import { UserPlus, Mail } from 'lucide-react'
import { SourceIcon } from '@/components/leads/SourceIcon'
import { OriginalEmailModal } from '@/components/leads/lead-detail/LeadActionModals'
import type { Lead, Profile } from '@/lib/types/database'
import { formatDateTime } from '@/lib/utils'

interface LeadMetaSidebarProps {
  lead: Lead
  agent: Profile | null
  agents: Profile[]
  isAdminOrManager: boolean
  showAssignDropdown: boolean
  onToggleAssignDropdown: () => void
  onReassign: (agentId: string) => void
}

export function LeadMetaSidebar({ lead, agent, agents, isAdminOrManager, showAssignDropdown, onToggleAssignDropdown, onReassign }: LeadMetaSidebarProps) {
  const [showEmailModal, setShowEmailModal] = useState(false)

  // Textul brut există doar pe lead-urile canalului „email” (forward de
  // agent) — celelalte surse nu au acest câmp în source_raw_data.
  const rawEmail = lead.source === 'email'
    ? (lead.source_raw_data as { continut?: string; subiect?: string; expeditor?: string } | null)
    : null
  const hasOriginalEmail = !!rawEmail?.continut

  // Detaliile booking-ului („won") — toate opționale, deci construim
  // dinamic doar rândurile care chiar au o valoare completată.
  const wonRows: { label: string; value: string }[] = []
  const sumParts = [lead.won_value ? `${lead.won_value} EUR` : null, lead.total_amount_ron ? `${lead.total_amount_ron} RON` : null].filter(Boolean)
  if (sumParts.length) wonRows.push({ label: 'Sumă încasată', value: sumParts.join(' / ') })
  const commParts = [lead.commission_eur ? `${lead.commission_eur} EUR` : null, lead.commission_ron ? `${lead.commission_ron} RON` : null].filter(Boolean)
  if (commParts.length) wonRows.push({ label: 'Comision', value: commParts.join(' / ') })
  if (lead.order_number) wonRows.push({ label: 'Nr. comandă', value: lead.order_number })
  if (lead.contract_number) wonRows.push({ label: 'Nr. contract', value: lead.contract_number })
  if (lead.invoice_number) wonRows.push({ label: 'Nr. factură', value: lead.invoice_number })

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3 text-sm">
      <div className="flex justify-between items-center">
        <span className="text-slate-500 dark:text-slate-400">Sursă</span>
        <SourceIcon source={lead.source} size="md" showLabel label={lead.source_detail || lead.source} />
      </div>
      {hasOriginalEmail && (
        <button onClick={() => setShowEmailModal(true)}
          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors">
          <Mail size={12} /> Vezi email original
        </button>
      )}
      <div className="flex justify-between items-center">
        <span className="text-slate-500 dark:text-slate-400">Agent</span>
        <div className="flex items-center gap-1.5">
          <span className="text-slate-900 dark:text-slate-100">{agent?.full_name || 'Nealocat'}</span>
          {isAdminOrManager && (
            <div className="relative">
              <button onClick={onToggleAssignDropdown}
                className="p-1 rounded text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950" title="Realocă">
                <UserPlus size={13} />
              </button>
              {showAssignDropdown && (
                <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-10 py-1">
                  {agents.map((a) => (
                    <button key={a.id} onClick={() => onReassign(a.id)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 ${a.id === lead.assigned_to ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-slate-700 dark:text-slate-300'}`}>
                      {a.full_name} {a.id === lead.assigned_to && '✓'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-between">
        <span className="text-slate-500 dark:text-slate-400">Creat</span>
        <span className="text-slate-700 dark:text-slate-300 text-xs">{formatDateTime(lead.created_at)}</span>
      </div>
      {lead.assigned_at && (
        <div className="flex justify-between">
          <span className="text-slate-500 dark:text-slate-400">Alocat</span>
          <span className="text-slate-700 dark:text-slate-300 text-xs">{formatDateTime(lead.assigned_at)}</span>
        </div>
      )}
      {lead.first_response_at && (
        <div className="flex justify-between">
          <span className="text-slate-500 dark:text-slate-400">Prim răspuns</span>
          <span className="text-slate-700 dark:text-slate-300 text-xs">{formatDateTime(lead.first_response_at)}</span>
        </div>
      )}
      {wonRows.length > 0 && (
        <div className="pt-1 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
          {wonRows.map((row) => (
            <div key={row.label} className="flex justify-between gap-3">
              <span className="text-slate-500 dark:text-slate-400">{row.label}</span>
              <span className="text-green-600 dark:text-green-400 font-medium text-xs text-right">{row.value}</span>
            </div>
          ))}
        </div>
      )}
      {lead.lost_reason && (
        <div className="flex justify-between">
          <span className="text-slate-500 dark:text-slate-400">Motiv pierdere</span>
          <span className="text-red-600 dark:text-red-400 text-xs">{lead.lost_reason}</span>
        </div>
      )}

      {showEmailModal && hasOriginalEmail && (
        <OriginalEmailModal
          subiect={rawEmail?.subiect || null}
          expeditor={rawEmail?.expeditor || null}
          continut={rawEmail!.continut!}
          onClose={() => setShowEmailModal(false)}
        />
      )}
    </div>
  )
}
