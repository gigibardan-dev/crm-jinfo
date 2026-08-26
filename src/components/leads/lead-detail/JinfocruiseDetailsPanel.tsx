/**
 * src/components/leads/lead-detail/JinfocruiseDetailsPanel.tsx
 *
 * JinfocruiseDetailsPanel
 *
 * Panel read-only cu detaliile de croazieră pentru leadurile venite de la
 * JinfoCruise.ro (surse `jinfocruise_request` și `jinfocruise_reservation`).
 * Citește direct din `lead.source_raw_data.metadata` (fără coloane noi în
 * `leads`) — navă, cod rezervare, dată plecare/nopți, port, preț, cabină,
 * tarif, taxe, avertisment de ocupanță neconfirmată (doar la `request`) și
 * lista de pasageri (doar la `reservation`). `jinfocruise_contact` nu are
 * date de croazieră, deci apelantul nu randează acest panel pentru acea sursă.
 * Extras din src/app/(app)/leads/[id]/page.tsx — logică și markup identice.
 * Vezi și: claude/integrari-canale-status.md (secțiunea JinfoCruise.ro).
 */

'use client'

import { AlertCircle, Calendar, MapPin, Wallet, Tag } from 'lucide-react'
import type { Lead } from '@/lib/types/database'

interface JinfocruisePassenger {
  first_name?: string
  last_name?: string
  pax_type?: string
  date_of_birth?: string
}

interface JinfocruiseDetailsPanelProps {
  source: Lead['source']
  meta: Record<string, any>
  passengers: JinfocruisePassenger[]
}

export function JinfocruiseDetailsPanel({ source, meta, passengers }: JinfocruiseDetailsPanelProps) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            🚢 {meta.ship_name || 'Detalii croazieră'}
          </h3>
          {(meta.jinfo_no || meta.cruise_id) && (
            <p className="text-xs text-slate-400 mt-0.5">
              {meta.jinfo_no ? `Rezervare ${meta.jinfo_no} · ` : ''}
              {meta.cruise_id || ''}
            </p>
          )}
        </div>
        {meta.page_url && (
          <a href={meta.page_url} target="_blank" rel="noopener noreferrer"
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap">
            Vezi pagina ↗
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <Calendar size={14} />
          <span className="text-slate-700 dark:text-slate-300">
            {meta.sailing_date ? new Date(meta.sailing_date).toLocaleDateString('ro-RO') : '—'}
            {typeof meta.nights === 'number' ? ` · ${meta.nights} nopți` : ''}
          </span>
        </div>
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <MapPin size={14} />
          <span className="text-slate-700 dark:text-slate-300">{meta.sailing_port || '—'}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <Wallet size={14} />
          <span className="text-slate-700 dark:text-slate-300">
            {meta.gross_amount
              ? `${meta.gross_amount} EUR total`
              : meta.price
                ? `${meta.price} EUR${meta.price_type === 'total' ? ' total' : '/persoană'}`
                : '—'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <Tag size={14} />
          <span className="text-slate-700 dark:text-slate-300">
            {meta.category_name || meta.category || '—'}
            {meta.cabin_no ? ` · cabina ${meta.cabin_no}` : meta.cabin_name ? ` · ${meta.cabin_name}` : ''}
          </span>
        </div>
      </div>

      {meta.fare_desc && (
        <p className="text-xs text-slate-400 mt-3">Tarif: {meta.fare_desc}</p>
      )}

      {(meta.port_charges || meta.service_charge_total) && (
        <p className="text-xs text-slate-400 mt-1">
          {meta.port_charges ? `Taxe port: ${meta.port_charges} EUR` : ''}
          {meta.port_charges && meta.service_charge_total ? ' · ' : ''}
          {meta.service_charge_total ? `Taxe serviciu: ${meta.service_charge_total} EUR` : ''}
        </p>
      )}

      {source === 'jinfocruise_request' && meta.occupancy && (
        <div className="mt-3 flex items-start gap-2 text-xs bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 rounded-lg px-3 py-2">
          <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
          <span>
            Ocupanță menționată în cerere: <strong>{meta.occupancy}</strong> — neconfirmat pe câmpurile Adulți/Copii, verifică mesajul și completează manual dacă e nevoie.
          </span>
        </div>
      )}

      {passengers.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <p className="text-xs text-slate-400 mb-2">Pasageri ({passengers.length})</p>
          <div className="space-y-1.5">
            {passengers.map((p, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-slate-700 dark:text-slate-300">
                  {p.first_name} {p.last_name}{p.pax_type === 'child' ? ' (copil)' : ''}
                </span>
                <span className="text-xs text-slate-400">
                  {p.date_of_birth ? new Date(p.date_of_birth).toLocaleDateString('ro-RO') : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
