/**
 * src/lib/types/wonDetails.ts
 *
 * WonDetails — câmpurile opționale completate la marcarea unui lead ca
 * „Câștigat": suma încasată (EUR/RON), comisionul (EUR/RON) și cele trei
 * numere de referință (comandă în sistem / contract / factură).
 *
 * Folosit din WonValueModal (pagina de detaliu lead + Pipeline — același
 * modal, vezi LeadActionModals.tsx). Valorile sunt ținute ca string în
 * form state (input-uri controlate) — convertite la Number/trim la
 * trimiterea către Supabase, via buildWonUpdate().
 *
 * `value` corespunde coloanei existente `won_value` (EUR) — redenumită
 * doar vizual în UI ca „Sumă totală încasată (EUR)"; celelalte 6 câmpuri
 * sunt coloane noi, adăugate în supabase/migrations/003_won_deal_details.sql.
 */

import type { Database } from '@/lib/types/database'

export interface WonDetails {
  value: string          // won_value — Sumă totală încasată (EUR)
  totalAmountRon: string // total_amount_ron — Sumă totală încasată (RON)
  commissionEur: string  // commission_eur
  commissionRon: string  // commission_ron
  orderNumber: string    // order_number — Nr. comandă în sistem
  contractNumber: string // contract_number — Nr. contract
  invoiceNumber: string  // invoice_number — Nr. factură
}

export const EMPTY_WON_DETAILS: WonDetails = {
  value: '',
  totalAmountRon: '',
  commissionEur: '',
  commissionRon: '',
  orderNumber: '',
  contractNumber: '',
  invoiceNumber: '',
}

type WonUpdateFields = Pick<
  Database['public']['Tables']['leads']['Update'],
  'won_value' | 'total_amount_ron' | 'commission_eur' | 'commission_ron' | 'order_number' | 'contract_number' | 'invoice_number'
>

/** Transformă form state-ul (string) în câmpurile de update pentru Supabase (number | string | null). */
export function buildWonUpdate(details: WonDetails): WonUpdateFields {
  return {
    won_value: details.value ? Number(details.value) : null,
    total_amount_ron: details.totalAmountRon ? Number(details.totalAmountRon) : null,
    commission_eur: details.commissionEur ? Number(details.commissionEur) : null,
    commission_ron: details.commissionRon ? Number(details.commissionRon) : null,
    order_number: details.orderNumber.trim() || null,
    contract_number: details.contractNumber.trim() || null,
    invoice_number: details.invoiceNumber.trim() || null,
  }
}

/** Rezumat lizibil pt. `lead_activities.content` — undefined dacă niciun câmp nu a fost completat. */
export function formatWonNote(details: WonDetails): string | undefined {
  const sums = [
    details.value ? `${details.value} EUR` : null,
    details.totalAmountRon ? `${details.totalAmountRon} RON` : null,
  ].filter(Boolean)
  const commission = [
    details.commissionEur ? `${details.commissionEur} EUR` : null,
    details.commissionRon ? `${details.commissionRon} RON` : null,
  ].filter(Boolean)
  const parts = [
    sums.length ? `Sumă: ${sums.join(' / ')}` : null,
    commission.length ? `Comision: ${commission.join(' / ')}` : null,
    details.orderNumber.trim() ? `Comandă ${details.orderNumber.trim()}` : null,
    details.contractNumber.trim() ? `Contract ${details.contractNumber.trim()}` : null,
    details.invoiceNumber.trim() ? `Factură ${details.invoiceNumber.trim()}` : null,
  ].filter((p): p is string => !!p)

  return parts.length ? parts.join(' · ') : undefined
}
