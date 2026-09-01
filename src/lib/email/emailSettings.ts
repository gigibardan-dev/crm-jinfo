/**
 * src/lib/email/emailSettings.ts
 *
 * Setări de email controlabile din UI (Setări → Email), fără redeploy —
 * stocate în tabelul generic `app_settings` (vezi migrarea 007). Diferit
 * de EMAIL_OVERRIDE_TO (variabilă de mediu, în sendMail.ts): acelea sunt
 * un fallback de infrastructură care necesită redeploy; astea sunt un
 * switch pe care adminul îl poate porni/opri singur, live, din browser —
 * exact ce a cerut: „vreau sa pot testa pe contul meu de admin dupa care
 * sa dam drumul pentru toata lumea, cand e nevoie".
 *
 * - notificationsEnabled — switch general (implicit FALSE): cât timp e
 *   oprit, sendNotificationMail() (sendMail.ts) nu trimite nimic. NU
 *   afectează /api/email/test (testul manual rămâne mereu disponibil).
 * - testModeEnabled — mod testare (implicit TRUE, safe by default): cât
 *   timp e pornit, sendNotificationMail() redirecționează ORICE mail
 *   către testRecipient, indiferent de destinatarul real.
 * - testRecipient — adresa de test (implicit online@jinfotours.ro).
 *
 * Citire/scriere DOAR prin service-role client (createAdminClient) — apelat
 * din API routes deja gate-uite pe rol admin (vezi
 * src/app/api/email/settings/route.ts), nu direct din componente client.
 */

import { createAdminClient } from '@/lib/supabase/admin'

export interface EmailSettings {
  notificationsEnabled: boolean
  testModeEnabled: boolean
  testRecipient: string
}

const DEFAULTS: EmailSettings = {
  notificationsEnabled: false,
  testModeEnabled: true,
  testRecipient: 'online@jinfotours.ro',
}

const KEYS = {
  notificationsEnabled: 'email_notifications_enabled',
  testModeEnabled: 'email_test_mode_enabled',
  testRecipient: 'email_test_recipient',
} as const

export async function getEmailSettings(): Promise<EmailSettings> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', Object.values(KEYS))

  const byKey = new Map((data || []).map((row) => [row.key, row.value]))

  return {
    notificationsEnabled:
      typeof byKey.get(KEYS.notificationsEnabled) === 'boolean'
        ? (byKey.get(KEYS.notificationsEnabled) as boolean)
        : DEFAULTS.notificationsEnabled,
    testModeEnabled:
      typeof byKey.get(KEYS.testModeEnabled) === 'boolean'
        ? (byKey.get(KEYS.testModeEnabled) as boolean)
        : DEFAULTS.testModeEnabled,
    testRecipient:
      typeof byKey.get(KEYS.testRecipient) === 'string' && (byKey.get(KEYS.testRecipient) as string).trim()
        ? (byKey.get(KEYS.testRecipient) as string)
        : DEFAULTS.testRecipient,
  }
}

export interface EmailSettingsPatch {
  notificationsEnabled?: boolean
  testModeEnabled?: boolean
  testRecipient?: string
}

export async function updateEmailSettings(patch: EmailSettingsPatch, updatedBy: string): Promise<void> {
  const supabase = createAdminClient()
  const rows: { key: string; value: boolean | string; updated_at: string; updated_by: string }[] = []
  const now = new Date().toISOString()

  if (patch.notificationsEnabled !== undefined) {
    rows.push({ key: KEYS.notificationsEnabled, value: patch.notificationsEnabled, updated_at: now, updated_by: updatedBy })
  }
  if (patch.testModeEnabled !== undefined) {
    rows.push({ key: KEYS.testModeEnabled, value: patch.testModeEnabled, updated_at: now, updated_by: updatedBy })
  }
  if (patch.testRecipient !== undefined) {
    rows.push({ key: KEYS.testRecipient, value: patch.testRecipient, updated_at: now, updated_by: updatedBy })
  }

  if (rows.length === 0) return

  const { error } = await supabase.from('app_settings').upsert(rows, { onConflict: 'key' })
  if (error) throw new Error(error.message)
}
