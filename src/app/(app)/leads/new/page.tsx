'use client'

/**
 * New Lead Page — Formular adăugare manuală
 * 
 * Folosit pentru: Walk-in agenție, telefon, referral
 * Lead-ul se creează cu status "assigned" direct la agentul curent
 * 
 * Fix-uri aplicate:
 * - Câmpuri goale devin null (nu "" care crapă pe DATE columns)
 * - Toast feedback la salvare
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import { TRIP_TYPES } from '@/lib/utils/constants'
import type { LeadSource } from '@/lib/types/database'

export default function NewLeadPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const supabase = createClient()
  const [sources, setSources] = useState<LeadSource[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    first_name: '', last_name: '', phone: '', email: '',
    source: 'walk_in', source_detail: '',
    destination: '', travel_date_from: '', travel_date_to: '',
    nr_adults: 1, nr_children: 0, children_ages: '',
    budget_range: '', trip_type: '', message: '',
    priority: 'medium' as const,
  })

  // Fetch active lead sources for dropdown
  useEffect(() => {
    supabase.from('lead_sources').select('*').eq('is_active', true).order('name')
      .then(({ data }) => setSources(data || []))
  }, [supabase])

  function updateField(field: string, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Validate: at least one contact field
    if (!form.first_name && !form.last_name && !form.phone && !form.email) {
      setError('Completează cel puțin un câmp de contact (nume, telefon sau email).')
      return
    }

    setSaving(true)
    setError(null)

    // Insert lead — empty strings become null to avoid DB type errors
    const { data, error: insertError } = await supabase
      .from('leads')
      .insert({
        first_name: form.first_name || null,
        last_name: form.last_name || null,
        phone: form.phone || null,
        email: form.email || null,
        source: form.source,
        source_detail: form.source_detail || null,
        destination: form.destination || null,
        travel_date_from: form.travel_date_from || null,
        travel_date_to: form.travel_date_to || null,
        nr_adults: Number(form.nr_adults) || 1,
        nr_children: Number(form.nr_children) || 0,
        children_ages: form.children_ages || null,
        budget_range: form.budget_range || null,
        trip_type: form.trip_type || null,
        message: form.message || null,
        priority: form.priority,
        assigned_to: profile!.id,
        assigned_at: new Date().toISOString(),
        assigned_by: profile!.id,
        status: 'assigned',
      })
      .select('id')
      .single()

    if (insertError || !data) {
      setError('Eroare la salvare. Încearcă din nou.')
      setSaving(false)
      return
    }

    // Log activity
    await supabase.from('lead_activities').insert({
      lead_id: data.id,
      user_id: profile!.id,
      type: 'system',
      content: `Lead adăugat manual (${form.source === 'walk_in' ? 'Walk-in' : form.source === 'phone' ? 'Telefon' : form.source})`,
    })

    toast({ title: 'Lead salvat cu succes', variant: 'success' })
    router.push(`/leads/${data.id}`)
  }

  const inputClass = "w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-400"

  return (
    <>
      <Header title="Lead Nou" />
      <div className="p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Contact section */}
          <section>
            <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-3">Date Contact</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Prenume</label>
                <input type="text" value={form.first_name} onChange={(e) => updateField('first_name', e.target.value)} className={inputClass} placeholder="Ion" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Nume</label>
                <input type="text" value={form.last_name} onChange={(e) => updateField('last_name', e.target.value)} className={inputClass} placeholder="Popescu" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Telefon</label>
                <input type="tel" value={form.phone} onChange={(e) => updateField('phone', e.target.value)} className={inputClass} placeholder="0722.123.456" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Email</label>
                <input type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} className={inputClass} placeholder="ion@email.com" />
              </div>
            </div>
          </section>

          {/* Source section */}
          <section>
            <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-3">Sursă</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Sursă lead</label>
                <select value={form.source} onChange={(e) => updateField('source', e.target.value)} className={inputClass + ' bg-white dark:bg-slate-800'}>
                  {sources.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Detalii sursă</label>
                <input type="text" value={form.source_detail} onChange={(e) => updateField('source_detail', e.target.value)} className={inputClass} placeholder="ex: Campanie Grecia 2026" />
              </div>
            </div>
          </section>

          {/* Travel request section */}
          <section>
            <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-3">Cerere Călătorie</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Destinație</label>
                <input type="text" value={form.destination} onChange={(e) => updateField('destination', e.target.value)} className={inputClass} placeholder="Grecia, Santorini" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Tip călătorie</label>
                <select value={form.trip_type} onChange={(e) => updateField('trip_type', e.target.value)} className={inputClass + ' bg-white dark:bg-slate-800'}>
                  <option value="">— selectează —</option>
                  {TRIP_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Data plecare</label>
                <input type="date" value={form.travel_date_from} onChange={(e) => updateField('travel_date_from', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Data întoarcere</label>
                <input type="date" value={form.travel_date_to} onChange={(e) => updateField('travel_date_to', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Nr. adulți</label>
                <input type="number" min={1} max={20} value={form.nr_adults} onChange={(e) => updateField('nr_adults', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Nr. copii</label>
                <input type="number" min={0} max={10} value={form.nr_children} onChange={(e) => updateField('nr_children', e.target.value)} className={inputClass} />
              </div>
              {Number(form.nr_children) > 0 && (
                <div className="col-span-2">
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Vârste copii</label>
                  <input type="text" value={form.children_ages} onChange={(e) => updateField('children_ages', e.target.value)} className={inputClass} placeholder="ex: 4, 7" />
                </div>
              )}
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Buget estimat</label>
                <input type="text" value={form.budget_range} onChange={(e) => updateField('budget_range', e.target.value)} className={inputClass} placeholder="2000-3000 EUR" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Prioritate</label>
                <select value={form.priority} onChange={(e) => updateField('priority', e.target.value)} className={inputClass + ' bg-white dark:bg-slate-800'}>
                  <option value="low">Scăzut</option>
                  <option value="medium">Mediu</option>
                  <option value="high">Ridicat</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
          </section>

          {/* Message */}
          <section>
            <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-3">Mesaj / Note</h3>
            <textarea value={form.message} onChange={(e) => updateField('message', e.target.value)} rows={4}
              className={inputClass + ' resize-none'} placeholder="Detalii suplimentare despre cererea clientului..." />
          </section>

          {/* Error display */}
          {error && (
            <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 rounded-lg px-3.5 py-2.5">{error}</div>
          )}

          {/* Submit */}
          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="px-5 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? 'Se salvează...' : 'Salvează Lead'}
            </button>
            <button type="button" onClick={() => router.back()}
              className="px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors">
              Anulează
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
