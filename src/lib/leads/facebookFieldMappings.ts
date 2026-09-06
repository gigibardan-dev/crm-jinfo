/**
 * src/lib/leads/facebookFieldMappings.ts
 *
 * Citire/scriere pt. tabelul `facebook_form_field_mappings` (migrarea 011) —
 * mapare manuală, per filă din Google Sheets (= formular Facebook), a
 * coloanei care conține nume/email/telefon, pt. formulare cu întrebări
 * custom pe care recunoașterea automată din FIELD_ALIASES
 * (src/lib/leads/import-facebook.ts) nu le prinde. Vezi discuția din chat
 * (formularul „Promotie Circuite Revelion 2027").
 *
 * DOAR prin service-role client (createAdminClient), apelat din API routes
 * gate-uite pe rol admin (src/app/api/leads/facebook-mapping/route.ts) —
 * la fel ca src/lib/email/emailSettings.ts.
 */

import { createAdminClient } from '@/lib/supabase/admin'

export interface FacebookFieldMapping {
  sheetTab: string
  fullNameHeader: string | null
  emailHeader: string | null
  phoneHeader: string | null
}

/** Toate mapările salvate, indexate după numele filei (sheet_tab). */
export async function getFacebookFieldMappings(): Promise<Record<string, FacebookFieldMapping>> {
  const supabase = createAdminClient()
  const { data } = await supabase.from('facebook_form_field_mappings').select('*')

  const result: Record<string, FacebookFieldMapping> = {}
  for (const row of data || []) {
    result[row.sheet_tab] = {
      sheetTab: row.sheet_tab,
      fullNameHeader: row.full_name_header,
      emailHeader: row.email_header,
      phoneHeader: row.phone_header,
    }
  }
  return result
}

export async function upsertFacebookFieldMapping(
  input: FacebookFieldMapping,
  updatedBy: string
): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('facebook_form_field_mappings').upsert(
    {
      sheet_tab: input.sheetTab,
      full_name_header: input.fullNameHeader,
      email_header: input.emailHeader,
      phone_header: input.phoneHeader,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    },
    { onConflict: 'sheet_tab' }
  )
  if (error) throw new Error(error.message)
}
