/**
 * src/app/api/users/[id]/autoassign/route.ts
 *
 * PATCH /api/users/:id/autoassign — suprascrie disponibilitatea round-robin
 * (`profiles.available_for_autoassign`) a ALTUI utilizator — admin SAU
 * manager (spre deosebire de /api/users/[id], care e admin-only și editează
 * profilul complet).
 *
 * Endpoint dedicat, minimal — scrie STRICT `available_for_autoassign`,
 * nimic altceva din profil — ca un manager să poată administra panoul de
 * Alocare Automată (vezi AutoAssignPanel.tsx) fără să capete și drepturi de
 * editare completă a conturilor (acelea rămân doar admin, prin celălalt
 * endpoint). Fiecare utilizator își poate schimba oricum singur propriul
 * status, direct din Sidebar, fără niciun endpoint — RLS `profiles_update`
 * permite `id = auth.uid()`.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
  }

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!currentProfile || !['admin', 'manager'].includes(currentProfile.role)) {
    return NextResponse.json({ error: 'Doar admin sau manager pot administra alocarea automată' }, { status: 403 })
  }

  const body = await request.json()
  const { available_for_autoassign } = body

  if (typeof available_for_autoassign !== 'boolean') {
    return NextResponse.json({ error: 'available_for_autoassign trebuie să fie boolean' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('profiles')
    .update({ available_for_autoassign })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
