/**
 * src/components/leads/pipeline/ReassignBulkBar.tsx
 *
 * Bara „Realocă" din Pipeline → Listă (doar admin / manager), afișată
 * DEASUPRA tabelului când sunt leaduri selectate. E separată intenționat de
 * bara de apeluri AI (AiCallBulkBar, jos, violet), ca cele două acțiuni să nu
 * fie confundate: realocarea e albastră și stă sus.
 *
 * Mută leadurile selectate — de la orice agent sau nealocate — la agentul
 * ales, cu confirmare. Opțiunea „Nou / Nealocat" le întoarce în Inbox, fără
 * agent (etapa revine la „Nou"), ca managerul să le realoace de acolo. Logica (etapă păstrată, timeline, o singură
 * notificare) e în POST /api/leads/bulk-reassign.
 */

'use client'

import { useState } from 'react'
import { Loader2, UserCog } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import type { Profile } from '@/lib/types/database'

/** Valoare specială: leadurile se întorc în „Nou / Nealocat" (vezi API-ul). */
const UNASSIGNED = 'unassigned'

interface ReassignBulkBarProps {
  selectedIds: string[]
  filteredCount: number
  agents: Profile[]
  onSelectAllFiltered: () => void
  onClear: () => void
  onDone: () => void
}

export function ReassignBulkBar({ selectedIds, filteredCount, agents, onSelectAllFiltered, onClear, onDone }: ReassignBulkBarProps) {
  const { toast } = useToast()
  const [agentId, setAgentId] = useState('')
  const [saving, setSaving] = useState(false)

  const count = selectedIds.length
  if (count === 0) return null

  async function reassign() {
    const unassign = agentId === UNASSIGNED
    const agent = agents.find((a) => a.id === agentId)
    if (!unassign && !agent) return
    const question = unassign
      ? `Întorci ${count} ${count === 1 ? 'lead' : 'leaduri'} în „Nou / Nealocat"?\n\nLeadurile rămân fără agent și apar în Inbox; etapa revine la „Nou". Istoricul (comentarii, apeluri AI) rămâne pe fiecare lead.`
      : `Realoci ${count} ${count === 1 ? 'lead' : 'leaduri'} către ${agent!.full_name}?\n\nEtapa din pipeline rămâne aceeași; leadurile încă „Nou" trec pe „Alocat".`
    if (!window.confirm(question)) return

    setSaving(true)
    try {
      const res = await fetch('/api/leads/bulk-reassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_ids: selectedIds, agent_id: agentId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: data.error || 'Eroare la realocare', variant: 'error' })
      } else {
        toast({
          title: data.unassigned
            ? `${data.reassigned} ${data.reassigned === 1 ? 'lead întors' : 'leaduri întoarse'} în Nou / Nealocat`
            : `${data.reassigned} ${data.reassigned === 1 ? 'lead realocat' : 'leaduri realocate'} către ${data.agentName}`,
          description: data.alreadyTheirs ? (data.unassigned ? `${data.alreadyTheirs} erau deja nealocate.` : `${data.alreadyTheirs} erau deja ale lui.`) : undefined,
          variant: 'success',
        })
        setAgentId('')
        onClear()
        onDone()
      }
    } catch {
      toast({ title: 'Eroare de rețea', variant: 'error' })
    }
    setSaving(false)
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 px-4 py-2.5 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900 rounded-xl">
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-900 dark:text-blue-100">
        <UserCog size={15} />
        {count} {count === 1 ? 'selectat' : 'selectate'}
      </span>

      {count < filteredCount && (
        <button type="button" onClick={onSelectAllFiltered} className="text-xs text-blue-700 dark:text-blue-300 hover:underline">
          Selectează toate cele {filteredCount} filtrate
        </button>
      )}

      <div className="flex items-center gap-2 ml-auto">
        <span className="text-sm text-blue-900 dark:text-blue-100">Realocă către</span>
        <select
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          className="max-w-[14rem] px-2 py-1.5 text-sm border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Agentul către care realoci"
        >
          <option value="">— alege agentul —</option>
          <option value={UNASSIGNED}>Nou / Nealocat (înapoi în Inbox)</option>
          {agents.map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
        </select>
        <button
          type="button"
          onClick={reassign}
          disabled={!agentId || saving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          Realocă
        </button>
      </div>
    </div>
  )
}
