/**
 * src/lib/supabase/admin.ts
 *
 * createAdminClient — Supabase service-role client
 *
 * Client cu cheia service_role, ocolește RLS. Folosit DOAR în API routes /
 * server actions (webhook-ul de leaduri, gestionarea conturilor de
 * utilizatori) — nu trebuie niciodată expus către browser.
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'

// Service role client — bypasses RLS
// ONLY use in API routes and server actions, NEVER expose to client
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
