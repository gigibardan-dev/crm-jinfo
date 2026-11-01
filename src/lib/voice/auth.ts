/**
 * src/lib/voice/auth.ts
 *
 * Gardă comună pentru rutele /api/voice/* folosite din UI: utilizator logat
 * cu rol admin sau manager. Agenții văd rezultatele apelurilor (prin RLS),
 * dar nu pornesc apeluri și nu configurează campanii.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function requireAdminOrManager(): Promise<{ userId: string; role: 'admin' | 'manager' } | NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'manager')) {
    return NextResponse.json({ error: 'Doar admin sau manager au acces la apelurile AI' }, { status: 403 })
  }
  return { userId: user.id, role: profile.role }
}
