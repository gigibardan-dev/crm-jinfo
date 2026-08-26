/**
 * src/app/(app)/leads/new/page.tsx
 *
 * New Lead Page — Formular adăugare manuală
 *
 * Owner de state (form + submit) — cele 3 secțiuni de câmpuri sunt delegate
 * componentelor din src/components/leads/new-lead/*.
 *
 * Folosit pentru: Walk-in agenție, telefon, referral
 * Lead-ul se creează cu status "assigned" direct la agentul curent
 *
 * Fix-uri aplicate:
 * - Câmpuri goale devin null (nu "" care crapă pe DATE columns)
 * - Toast feedback la salvare
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import type { LeadSource } from '@/lib/types/database'
import { ContactSection } from '@/components/leads/new-lead/ContactSection'
import { SourceSection } from '@/components/leads/new-lead/SourceSection'
import { TravelRequestSection } from '@/components/leads/new-lead/TravelRequestSection'
import { NEW_LEAD_INPUT_CLASS, type NewLeadFormData } from '@/components/leads/new-lead/NewLeadFormTypes'

export default function NewLeadPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const supabase = createClient()
  const [sources, setSources] = useState<LeadSource[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState<NewLeadFormData>({
    first_name: '', last_name: '', phone: '', email: '',
    source: 'walk_in', source_detail: '',
    destination: '', travel_date_from: '', travel_date_to: '',
    nr_adults: 1, nr_children: 0, children_ages: '',
    budget_range: '', trip_type: '', message: '',
    priority: 'medium',
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

  return (
    <>
      <Header title="Lead Nou" />
      <div className="p-4 sm:p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">

          <ContactSection
            firstName={form.first_name}
            lastName={form.last_name}
            phone={form.phone}
            email={form.email}
            onChange={updateField}
          />

          <SourceSection
            sources={sources}
            source={form.source}
            sourceDetail={form.source_detail}
            onChange={updateField}
          />

          <TravelRequestSection form={form} onChange={updateField} />

          {/* Message */}
          <section>
            <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-3">Mesaj / Note</h3>
            <textarea value={form.message} onChange={(e) => updateField('message', e.target.value)} rows={4}
              className={NEW_LEAD_INPUT_CLASS + ' resize-none'} placeholder="Detalii suplimentare despre cererea clientului..." />
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
