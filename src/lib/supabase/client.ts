/**
 * src/lib/supabase/client.ts
 *
 * createClient — Supabase browser client
 *
 * Client Supabase pentru Client Components (`'use client'`), cheia anon
 * publică — respectă RLS. Folosit din majoritatea paginilor/hook-urilor
 * din src/app/(app)/* și src/lib/hooks/useAuth.tsx.
 */

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/types/database'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
