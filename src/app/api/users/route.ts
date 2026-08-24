import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Doar adminii pot crea conturi' }, { status: 403 })
  }

  const body = await request.json()
  const { full_name, email, phone, password, role } = body

  if (!full_name || !email || !password) {
    return NextResponse.json({ error: 'Câmpuri lipsă' }, { status: 400 })
  }

  if (!['admin', 'manager', 'agent'].includes(role)) {
    return NextResponse.json({ error: 'Rol invalid' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError || !authUser.user) {
    return NextResponse.json(
      { error: authError?.message || 'Eroare la creare cont auth' },
      { status: 400 }
    )
  }

  const { error: profileError } = await adminClient
    .from('profiles')
    .insert({
      id: authUser.user.id,
      full_name,
      email,
      phone: phone || null,
      role,
    })

  if (profileError) {
    await adminClient.auth.admin.deleteUser(authUser.user.id)
    return NextResponse.json({ error: 'Eroare la creare profil' }, { status: 500 })
  }

  return NextResponse.json({ id: authUser.user.id, email, role }, { status: 201 })
}