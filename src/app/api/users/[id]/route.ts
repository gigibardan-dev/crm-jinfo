/**
 * src/app/api/users/[id]/route.ts
 *
 * PATCH /api/users/:id — editare cont existent (admin only)
 *
 * Verifică sesiunea + rolul curent (trebuie admin). Actualizează selectiv,
 * prin service-role client: email/parolă în Supabase Auth (doar dacă
 * trimise), și câmpurile din `profiles` (full_name, email, phone, role,
 * is_active) — folosit atât din pagina de profil agent (editare completă),
 * cât și din /settings (toggle rapid activ/inactiv, doar `is_active`).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/lib/types/database'

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

  if (!currentProfile || currentProfile.role !== 'admin') {
    return NextResponse.json({ error: 'Doar adminii pot edita conturi' }, { status: 403 })
  }

  const body = await request.json()
  const { full_name, email, phone, role, password, is_active } = body

  const adminClient = createAdminClient()

  // Update auth email if changed
  if (email) {
    const { error: authError } = await adminClient.auth.admin.updateUserById(id, {
      email,
    })
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }
  }

  // Update password if provided
  if (password && password.length >= 6) {
    const { error: pwError } = await adminClient.auth.admin.updateUserById(id, {
      password,
    })
    if (pwError) {
      return NextResponse.json({ error: pwError.message }, { status: 400 })
    }
  }

  // Update profile
    const profileUpdate: Database['public']['Tables']['profiles']['Update'] = {}
  if (full_name !== undefined) profileUpdate.full_name = full_name
  if (email !== undefined) profileUpdate.email = email
  if (phone !== undefined) profileUpdate.phone = phone || null
  if (role !== undefined) profileUpdate.role = role
  if (is_active !== undefined) profileUpdate.is_active = is_active

  if (Object.keys(profileUpdate).length > 0) {
    const { error: profileError } = await adminClient
      .from('profiles')
      .update(profileUpdate)
      .eq('id', id)

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}
