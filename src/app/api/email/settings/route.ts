/**
 * src/app/api/email/settings/route.ts
 *
 * GET   /api/email/settings — setările curente de email (switch general +
 *       mod testare + adresă de test), admin only.
 * PATCH /api/email/settings — actualizează una sau mai multe setări,
 *       admin only.
 *
 * Vezi src/lib/email/emailSettings.ts pt. detalii + vezi
 * supabase/migrations/007_email_notification_settings.sql pt. schema din
 * `app_settings`. Nu afectează /api/email/test (testul manual rămâne mereu
 * disponibil, indiferent de `notificationsEnabled`).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEmailSettings, updateEmailSettings } from '@/lib/email/emailSettings'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, status: 401, error: 'Neautorizat' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') {
    return { ok: false as const, status: 403, error: 'Doar adminii pot administra setările de email' }
  }
  return { ok: true as const, userId: user.id }
}

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  return NextResponse.json(await getEmailSettings())
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Corp invalid.' }, { status: 400 })
  }

  const { notificationsEnabled, testModeEnabled, testRecipient } = body as Record<string, unknown>

  if (notificationsEnabled !== undefined && typeof notificationsEnabled !== 'boolean') {
    return NextResponse.json({ error: 'notificationsEnabled trebuie să fie boolean.' }, { status: 400 })
  }
  if (testModeEnabled !== undefined && typeof testModeEnabled !== 'boolean') {
    return NextResponse.json({ error: 'testModeEnabled trebuie să fie boolean.' }, { status: 400 })
  }
  if (testRecipient !== undefined && (typeof testRecipient !== 'string' || !testRecipient.trim() || !testRecipient.includes('@'))) {
    return NextResponse.json({ error: 'testRecipient trebuie să fie o adresă de email validă.' }, { status: 400 })
  }

  try {
    await updateEmailSettings(
      {
        ...(notificationsEnabled !== undefined ? { notificationsEnabled } : {}),
        ...(testModeEnabled !== undefined ? { testModeEnabled } : {}),
        ...(testRecipient !== undefined ? { testRecipient: testRecipient.trim() } : {}),
      },
      auth.userId
    )
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Eroare la salvare.' }, { status: 500 })
  }

  return NextResponse.json(await getEmailSettings())
}
