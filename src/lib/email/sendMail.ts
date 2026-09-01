/**
 * src/lib/email/sendMail.ts
 *
 * sendMail() — trimitere de email prin SMTP-ul propriu al agenției
 * (Nodemailer), NU un serviciu terț (Resend/SendGrid) — vezi
 * EMAIL_PREZENTA_PLAN.md (proiectul Claude) pt. raționamentul complet.
 *
 * Variabile de mediu necesare (Vercel + .env.local local):
 * - SMTP_HOST              — ex. mail.jinfotours.ro
 * - SMTP_PORT              — ex. 587
 * - SMTP_USER              — ex. online@jinfotours.ro
 * - SMTP_PASS              — parola contului de mail
 * - SMTP_REQUIRE_TLS       — opțional, implicit "true" (forțează STARTTLS
 *   pe 587 — eșuează zgomotos dacă serverul nu-l acceptă, în loc să trimită
 *   tăcut necriptat). Pus pe "false" dacă serverul chiar nu suportă STARTTLS
 *   (contul de mail existent era configurat fără criptare pe 587).
 * - SMTP_TLS_REJECT_UNAUTHORIZED — opțional, implicit "true". Pus pe
 *   "false" DOAR dacă handshake-ul eșuează cu eroare de certificat
 *   (cert self-signed/hostname mismatch, frecvent la găzduire cPanel) —
 *   scade nivelul de verificare, nu se lasă implicit dezactivat.
 * - EMAIL_OVERRIDE_TO      — cât timp CRM-ul e în dezvoltare/testare: dacă
 *   e setat, ORICE email trimis prin sendMail() e redirecționat aici,
 *   indiferent de `to` cerut de apelant — plasă de siguranță, ca nimic să
 *   nu ajungă din greșeală la agenți/manageri reali înainte să fie gata.
 *   Destinatarul real intenționat rămâne vizibil în corpul mailului
 *   (vezi mai jos). Se scoate din mediu (Vercel) când trecem live.
 *
 * Nu aruncă excepții spre apelant — întoarce {success, error} — apelantul
 * (ruta de test, viitorul digest etc.) decide ce face cu eroarea, fără
 * try/catch repetat peste tot.
 *
 * sendMail() e transportul de bază — folosit direct DOAR de /api/email/test
 * (trimitere manuală, explicită, mereu permisă adminului). Orice trimitere
 * AUTOMATĂ viitoare (digest zilnic, alerte) trebuie să treacă prin
 * sendNotificationMail() de mai jos, nu prin sendMail() direct — acolo e
 * verificat switch-ul general + modul de testare din Setări (vezi
 * src/lib/email/emailSettings.ts), controlabile live din UI fără redeploy.
 */

import nodemailer from 'nodemailer'
import { getEmailSettings } from '@/lib/email/emailSettings'

interface SendMailInput {
  to: string
  subject: string
  html: string
  text?: string
}

type SendMailResult =
  | { success: true; messageId: string; redirectedFrom?: string }
  | { success: false; error: string }

function getTransport() {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !port || !user || !pass) {
    throw new Error('SMTP neconfigurat — lipsesc una sau mai multe din SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS din variabilele de mediu.')
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465 = TLS implicit de la conectare; 587/25 = STARTTLS negociat după conectare
    requireTLS: process.env.SMTP_REQUIRE_TLS !== 'false',
    auth: { user, pass },
    tls: {
      rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false',
    },
  })
}

export async function sendMail({ to, subject, html, text }: SendMailInput): Promise<SendMailResult> {
  const overrideTo = process.env.EMAIL_OVERRIDE_TO?.trim()
  const actualTo = overrideTo || to

  // Dacă redirecționăm, notă vizibilă în mail — ca cine deschide mailul de
  // test/dev să știe imediat că nu e destinatarul „real".
  const finalHtml = overrideTo && overrideTo !== to
    ? `<p style="background:#fef3c7;color:#92400e;padding:8px 12px;border-radius:8px;font:13px system-ui,sans-serif;margin:0 0 16px">⚠️ Mediu de dezvoltare — acest mail ar fi mers normal către <strong>${to}</strong>, dar EMAIL_OVERRIDE_TO e activ.</p>${html}`
    : html

  try {
    const transport = getTransport()
    const info = await transport.sendMail({
      from: process.env.SMTP_USER,
      to: actualTo,
      subject: overrideTo && overrideTo !== to ? `[DEV → ${to}] ${subject}` : subject,
      html: finalHtml,
      text,
    })
    return {
      success: true,
      messageId: info.messageId,
      ...(overrideTo && overrideTo !== to ? { redirectedFrom: to } : {}),
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Eroare necunoscută la trimitere.' }
  }
}

type NotificationMailResult =
  | { sent: true; messageId: string; redirectedTo?: string }
  | { sent: false; reason: 'disabled'; error?: undefined }
  | { sent: false; reason: 'error'; error: string }

/**
 * sendNotificationMail() — punctul de intrare pt. orice trimitere
 * AUTOMATĂ (digest zilnic, alerte — încă neconstruite). Verifică ÎNTÂI
 * setările din Setări → Email (app_settings, vezi emailSettings.ts):
 *
 * 1. Dacă `notificationsEnabled` e oprit → nu trimite nimic, întoarce
 *    { sent: false, reason: 'disabled' }. Asta e switch-ul general cerut
 *    explicit („buton general de on/off notificari pe mail").
 * 2. Dacă `testModeEnabled` e pornit (implicit DA) → redirecționează
 *    destinatarul către `testRecipient`, cu banner vizibil + subiect
 *    [TEST → ...], la fel ca EMAIL_OVERRIDE_TO — dar controlabil live.
 *
 * /api/email/test NU folosește funcția asta — trimiterea manuală de test
 * rămâne mereu posibilă adminului, ca să poată verifica SMTP-ul indiferent
 * de switch-ul general (altfel nu ar putea porni switch-ul fără să-l
 * pornească „orb").
 */
export async function sendNotificationMail(input: SendMailInput): Promise<NotificationMailResult> {
  const settings = await getEmailSettings()

  if (!settings.notificationsEnabled) {
    return { sent: false, reason: 'disabled' }
  }

  const redirected = settings.testModeEnabled && settings.testRecipient !== input.to
  const to = settings.testModeEnabled ? settings.testRecipient : input.to

  const html = redirected
    ? `<p style="background:#fef3c7;color:#92400e;padding:8px 12px;border-radius:8px;font:13px system-ui,sans-serif;margin:0 0 16px">⚠️ Mod testare activ (Setări → Email) — acest mail ar fi mers normal către <strong>${input.to}</strong>.</p>${input.html}`
    : input.html

  const result = await sendMail({
    to,
    subject: redirected ? `[TEST → ${input.to}] ${input.subject}` : input.subject,
    html,
    text: input.text,
  })

  if (!result.success) {
    return { sent: false, reason: 'error', error: result.error }
  }

  return { sent: true, messageId: result.messageId, ...(redirected ? { redirectedTo: settings.testRecipient } : {}) }
}

/** Config SMTP non-secretă, pt. panoul de test din Setări — NU expune parola. */
export function getSmtpStatus() {
  return {
    configured: Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS),
    host: process.env.SMTP_HOST || null,
    port: process.env.SMTP_PORT || null,
    user: process.env.SMTP_USER || null,
    requireTls: process.env.SMTP_REQUIRE_TLS !== 'false',
    overrideTo: process.env.EMAIL_OVERRIDE_TO?.trim() || null,
  }
}
