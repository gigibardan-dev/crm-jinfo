/**
 * src/lib/supabase/server.ts
 *
 * createClient — Supabase server client (SSR)
 *
 * Client Supabase pentru Server Components / API routes, legat de cookies
 * (`next/headers`) — respectă RLS, cu sesiunea utilizatorului curent.
 * Folosit în API routes precum src/app/api/users/route.ts pentru a
 * verifica cine face request-ul (înainte de a folosi admin.ts pentru
 * mutații care ocolesc RLS).
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/types/database'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  )
}
