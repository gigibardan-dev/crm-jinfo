/**
 * src/components/leads/pipeline/AiCallBulkBar.tsx
 *
 * Bara de acțiuni pentru selecția multiplă din Pipeline → Listă (doar
 * admin/manager): „N selectate → [campanie] → Adaugă în coada AI".
 *
 * - „Selectează toate cele N filtrate" — nu doar pagina curentă (ex. toate
 *   leadurile Facebook neapelate dintr-o campanie, filtrate în prealabil).
 * - Confirmare înainte de pornire, cu costul estimat (~2 min/apel).
 * - Trimite în loturi de câte 200 (limita POST /api/voice/calls).
 * - La final arată câte au intrat în coadă și de ce au fost sărite celelalte
 *   (fără telefon valid, „nu mai suna", deja în coadă, sunate recent...).
 * Protecțiile reale (dubluri, do_not_call, interval orar) sunt pe server.
 */

'use client'

import { useEffect, useState } from 'react'
import { Bot, Loader2, PhoneCall, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'

const CHUNK = 200
const EST_MINUTES_PER_CALL = 2
const EST_COST_PER_MINUTE_USD = 0.11

interface AiCallBulkBarProps {
  selectedIds: string[]
  filteredCount: number
  onSelectAllFiltered: () => void
  onClear: () => void
  onDone: () => void
  /** Lista de apelare filtrată în Pipeline (dacă există) — salvată pe apeluri (ai_calls.list_id) */
  listId?: string | null
}

export function AiCallBulkBar({ selectedIds, filteredCount, onSelectAllFiltered, onClear, onDone, listId }: AiCallBulkBarProps) {
  const supabase = createClient()
  const { toast } = useToast()
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([])
  const [campaignId, setCampaignId] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    supabase
      .from('call_campaigns')
      .select('id, name')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setCampaigns(data ?? [])
        if (data?.[0]) setCampaignId((prev) => prev || data[0].id)
      })
  }, [supabase])

  const count = selectedIds.length
  if (count === 0) return null

  async function enqueue() {
    const campaign = campaigns.find((c) => c.id === campaignId)
    if (!campaign) return
    const estCost = (count * EST_MINUTES_PER_CALL * EST_COST_PER_MINUTE_USD).toFixed(2)
    const ok = window.confirm(
      `Pui ${count} ${count === 1 ? 'lead' : 'leaduri'} în coada de apeluri AI, campania „${campaign.name}"?\n\n` +
        `Cost estimat: ~${estCost} $ (aprox. ${EST_MINUTES_PER_CALL} min/apel).\n` +
        `Leadurile fără telefon valid, cu „nu mai suna" sau sunate recent pe aceeași campanie sunt sărite automat.`
    )
    if (!ok) return

    setSending(true)
    let queued = 0
    let outsideHours = false
    let dispatchError: string | null = null
    const reasons: Record<string, number> = {}

    try {
      for (let i = 0; i < selectedIds.length; i += CHUNK) {
        const res = await fetch('/api/voice/calls', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lead_ids: selectedIds.slice(i, i + CHUNK), campaign_id: campaignId, list_id: listId || null }),
        })
        const data = await res.json()
        if (!res.ok) {
          toast({ title: data.error || 'Eroare la adăugarea în coadă', variant: 'error' })
          break
        }
        queued += data.queued || 0
        outsideHours = outsideHours || !!data.outsideHours
        if (data.dispatch?.error) dispatchError = data.dispatch.error
        for (const s of data.skipped || []) reasons[s.reason] = (reasons[s.reason] || 0) + 1
      }

      const skippedText = Object.entries(reasons)
        .map(([r, n]) => `${n} × ${r}`)
        .join(' · ')

      if (dispatchError) {
        toast({ title: `${queued} în coadă, dar coada nu a pornit`, description: dispatchError, variant: 'error' })
      } else {
        toast({
          title: `${queued} ${queued === 1 ? 'lead adăugat' : 'leaduri adăugate'} în coada AI`,
          description:
            [outsideHours ? 'În afara intervalului orar — pornesc când reiei coada în program.' : null, skippedText ? `Sărite: ${skippedText}` : null]
              .filter(Boolean)
              .join(' ') || undefined,
          variant: queued > 0 ? 'success' : 'warning',
        })
      }
      onClear()
      onDone()
    } catch {
      toast({ title: 'Eroare de rețea', variant: 'error' })
    }
    setSending(false)
  }

  return (
    <div className="sticky bottom-4 z-20 mt-4">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-white dark:bg-slate-900 border border-violet-200 dark:border-violet-900 rounded-xl shadow-lg">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-900 dark:text-slate-100">
          <Bot size={15} className="text-violet-500" />
          {count} {count === 1 ? 'selectat' : 'selectate'}
        </span>

        {count < filteredCount && (
          <button type="button" onClick={onSelectAllFiltered} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
            Selectează toate cele {filteredCount} filtrate
          </button>
        )}

        <div className="flex items-center gap-2 ml-auto">
          {campaigns.length > 0 ? (
            <>
              <select
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
                className="max-w-[16rem] px-2 py-1.5 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Campanie AI"
              >
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={enqueue}
                disabled={sending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : <PhoneCall size={14} />}
                Adaugă în coada AI
              </button>
            </>
          ) : (
            <span className="text-xs text-slate-400">Nicio campanie AI activă (Setări → Apeluri AI)</span>
          )}
          <button
            type="button"
            onClick={onClear}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Anulează selecția"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
