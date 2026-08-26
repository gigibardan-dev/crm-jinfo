/**
 * src/lib/leads/jinfocruise-mapping.ts
 *
 * Mapare câmpuri specifică celor 3 surse JinfoCruise.ro
 * (`jinfocruise_request`, `jinfocruise_contact`, `jinfocruise_reservation`)
 * pentru endpoint-ul POST /api/leads/inbound. Toate 3 folosesc aceeași cheie
 * x-api-key ca `website_form` și NU au deduplicare (fiecare cerere/contact/
 * rezervare e un eveniment de business separat, la cererea explicită a lui
 * Gigi — vezi JINFOCRUISE_SOURCES + folosirea lui în route.ts).
 * Extras din src/app/api/leads/inbound/route.ts.
 * Vezi și: claude/integrari-canale-status.md (secțiunea JinfoCruise.ro).
 */

// Cele 3 surse JinfoCruise: fără deduplicare (fiecare cerere/rezervare e un
// eveniment de business separat) și cu mapare proprie de câmpuri.
export const JINFOCRUISE_SOURCES = ['jinfocruise_request', 'jinfocruise_contact', 'jinfocruise_reservation']

export function jinfocruiseBudgetRange(source: string, metadata: any): string | null {
  if (!metadata) return null
  if (source === 'jinfocruise_request' && metadata.price) {
    const perPersoana = metadata.price_type !== 'total'
    return `${metadata.price} EUR${perPersoana ? '/persoană' : ' total'}`
  }
  if (source === 'jinfocruise_reservation' && metadata.gross_amount) {
    return `${metadata.gross_amount} EUR total`
  }
  return null
}

export function jinfocruisePriority(source: string): 'low' | 'medium' | 'high' {
  if (source === 'jinfocruise_reservation') return 'high' // rezervare confirmată — urgentă
  return 'medium' // jinfocruise_request și jinfocruise_contact
}

function addDays(dateStr: string, days: number): string | null {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

// sailing_date + nights sunt de încredere (vin din sistemul de rezervări) —
// se mapează direct pe travel_date_from/to.
export function jinfocruiseDates(metadata: any): { travel_date_from: string | null; travel_date_to: string | null } {
  const sailingDate: string | null = metadata?.sailing_date || null
  if (!sailingDate) return { travel_date_from: null, travel_date_to: null }
  const nights = typeof metadata?.nights === 'number' ? metadata.nights : null
  return {
    travel_date_from: sailingDate,
    travel_date_to: nights ? addDays(sailingDate, nights) : null,
  }
}

// Nr. adulți/copii: se mapează DOAR când sursa e sigură (jinfocruise_reservation
// trimite no_adults/no_children explicit din sistemul de rezervări). La
// jinfocruise_request avem doar `occupancy` — un total ambiguu (poate include
// și copii, poate fi per-cabină) — NU se presupune nimic; rămâne vizibil în
// panoul de detalii croazieră din raw data, iar agentul completează manual
// nr_adults/nr_children pe lead dacă e nevoie, citind mesajul/ocupanța.
export function jinfocruisePax(source: string, metadata: any): { nr_adults?: number; nr_children?: number } {
  if (source !== 'jinfocruise_reservation' || !metadata) return {}
  const result: { nr_adults?: number; nr_children?: number } = {}
  if (typeof metadata.no_adults === 'number') result.nr_adults = metadata.no_adults
  if (typeof metadata.no_children === 'number') result.nr_children = metadata.no_children
  return result
}
