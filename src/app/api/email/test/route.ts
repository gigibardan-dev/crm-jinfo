/**
 * src/app/api/email/test/route.ts
 *
 * GET  /api/email/test — status config SMTP (non-secret), admin only.
 * POST /api/email/test — trimite un email de test, admin only.
 *
 * Destinatarul NU vine din UI/body — e citit din setarea `testRecipient`
 * (Setări → Email, implicit „online@jinfotours.ro" — vezi
 * src/lib/email/emailSettings.ts) — exact cum a cerut adminul: cât timp
 * suntem în dezvoltare, testele de mail nu ating alte adrese. Testul
 * trimite direct prin sendMail() (nu prin sendNotificationMail()) — rămâne
 * mereu disponibil adminului, indiferent de switch-ul general
 * `notificationsEnabled`, ca să poată verifica SMTP-ul oricând, inclusiv
 * înainte de a porni switch-ul. (Independent de asta, EMAIL_OVERRIDE_TO din
 * sendMail.ts redirecționează ORICE mail, din orice apelant viitor, către
 * aceeași adresă — mecanismele se suprapun acum, intenționat.)
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendMail, getSmtpStatus } from '@/lib/email/sendMail'
import { getEmailSettings } from '@/lib/email/emailSettings'
import { formatDateTime } from '@/lib/utils'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, status: 401, error: 'Neautorizat' }

  const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') {
    return { ok: false as const, status: 403, error: 'Doar adminii pot administra setările de email' }
  }
  return { ok: true as const, profile }
}

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  return NextResponse.json(getSmtpStatus())
}

export async function POST() {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { testRecipient } = await getEmailSettings()

  const result = await sendMail({
    to: testRecipient,
    subject: 'Test SMTP — JinfoTours CRM',
    html: `
      <div style="font-family:system-ui,sans-serif;font-size:14px;color:#0f172a">
        <p>Mail de test trimis din panoul de Setări al CRM-ului.</p>
        <p style="color:#64748b;font-size:12px">
          Trimis de <strong>${auth.profile.full_name}</strong> la ${formatDateTime(new Date())}.<br/>
          Dacă vezi mailul ăsta, conexiunea SMTP funcționează.
        </p>
      </div>
    `,
    text: `Mail de test trimis din panoul de Setări al CRM-ului de ${auth.profile.full_name} la ${formatDateTime(new Date())}.`,
  })

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ success: true, messageId: result.messageId, sentTo: testRecipient })
}
