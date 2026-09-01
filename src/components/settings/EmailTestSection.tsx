'use client'

/**
 * src/components/settings/EmailTestSection.tsx
 *
 * EmailTestSection
 *
 * Secțiunea „Email (SMTP)" din /settings — admin only. Două blocuri:
 *
 * 1. Status SMTP + „Trimite test" — arată config curentă (host/port/user/
 *    TLS/redirecționare env — non-secretă, fără parolă) și trimite un mail
 *    real prin /api/email/test către adresa de test configurată mai jos
 *    (implicit online@jinfotours.ro) — mereu disponibil, indiferent de
 *    switch-ul de notificări, ca să poți verifica SMTP-ul oricând.
 * 2. Control notificări — switch general (pornește/oprește viitoarele
 *    trimiteri automate — digest, alerte) + mod testare (redirecționează
 *    ORICE mail automat către adresa de test) + adresa de test editabilă.
 *    Implicit: notificări OPRITE, mod testare PORNIT — safe by default,
 *    exact cum a cerut adminul („nu vreau sa ajunga mailuri la agenti
 *    admini sau manageri, doar la mine").
 *
 * Vezi src/lib/email/sendMail.ts (sendMail/sendNotificationMail) și
 * src/lib/email/emailSettings.ts pt. mecanism.
 */

import { useEffect, useState } from 'react'
import { Mail, Send, CheckCircle2, XCircle, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

interface SmtpStatus {
  configured: boolean
  host: string | null
  port: string | null
  user: string | null
  requireTls: boolean
  overrideTo: string | null
}

interface EmailSettings {
  notificationsEnabled: boolean
  testModeEnabled: boolean
  testRecipient: string
}

type TestResult =
  | { kind: 'success'; sentTo: string; messageId: string }
  | { kind: 'error'; message: string }

export function EmailTestSection() {
  const { toast } = useToast()

  const [status, setStatus] = useState<SmtpStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<TestResult | null>(null)

  const [settings, setSettings] = useState<EmailSettings | null>(null)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [savingKey, setSavingKey] = useState<'notificationsEnabled' | 'testModeEnabled' | 'testRecipient' | null>(null)
  const [recipientDraft, setRecipientDraft] = useState('')

  useEffect(() => {
    fetch('/api/email/test')
      .then((res) => res.json())
      .then((data) => setStatus(data))
      .finally(() => setLoadingStatus(false))

    fetch('/api/email/settings')
      .then((res) => res.json())
      .then((data: EmailSettings) => {
        setSettings(data)
        setRecipientDraft(data.testRecipient)
      })
      .finally(() => setLoadingSettings(false))
  }, [])

  async function patchSettings(patch: Partial<EmailSettings>, key: typeof savingKey) {
    setSavingKey(key)
    try {
      const res = await fetch('/api/email/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await res.json()
      if (res.ok) {
        setSettings(data)
        setRecipientDraft(data.testRecipient)
        toast({ title: 'Setare salvată', variant: 'success' })
      } else {
        toast({ title: data.error || 'Eroare la salvare', variant: 'error' })
      }
    } catch {
      toast({ title: 'Eroare de rețea', variant: 'error' })
    }
    setSavingKey(null)
  }

  async function sendTest() {
    setSending(true)
    setResult(null)

    try {
      const res = await fetch('/api/email/test', { method: 'POST' })
      const data = await res.json()

      if (res.ok) {
        setResult({ kind: 'success', sentTo: data.sentTo, messageId: data.messageId })
      } else {
        setResult({ kind: 'error', message: data.error || 'Eroare necunoscută.' })
      }
    } catch {
      setResult({ kind: 'error', message: 'Eroare de rețea — cererea nu a ajuns la server.' })
    }

    setSending(false)
  }

  const liveAndOpen = Boolean(settings?.notificationsEnabled && !settings?.testModeEnabled)

  return (
    <section className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">Email (SMTP)</h3>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 sm:p-5 space-y-4">
          {loadingStatus ? (
            <div className="animate-pulse h-16 bg-slate-50 dark:bg-slate-800 rounded-lg" />
          ) : !status?.configured ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              SMTP nu e configurat încă — lipsesc variabilele <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">SMTP_HOST</code>/
              <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">SMTP_PORT</code>/
              <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">SMTP_USER</code>/
              <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">SMTP_PASS</code> din mediu.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <p className="text-slate-400 dark:text-slate-500 mb-0.5">Server</p>
                <p className="text-slate-700 dark:text-slate-300 font-mono truncate">{status.host}:{status.port}</p>
              </div>
              <div>
                <p className="text-slate-400 dark:text-slate-500 mb-0.5">Cont</p>
                <p className="text-slate-700 dark:text-slate-300 font-mono truncate">{status.user}</p>
              </div>
              <div>
                <p className="text-slate-400 dark:text-slate-500 mb-0.5">TLS forțat</p>
                <p className="text-slate-700 dark:text-slate-300">{status.requireTls ? 'Da' : 'Nu'}</p>
              </div>
              <div>
                <p className="text-slate-400 dark:text-slate-500 mb-0.5">Redirecționare (env)</p>
                <p className="text-slate-700 dark:text-slate-300 truncate">{status.overrideTo || '—'}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={sendTest}
              disabled={sending || !status?.configured}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Trimite test către {settings?.testRecipient || '…'}
            </button>
          </div>

          {result?.kind === 'success' && (
            <div className="flex items-start gap-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950 rounded-lg px-3 py-2">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              <div>
                <p>Trimis către <strong>{result.sentTo}</strong>.</p>
                <p className="text-xs text-green-600/80 dark:text-green-400/70 mt-0.5 font-mono">{result.messageId}</p>
              </div>
            </div>
          )}

          {result?.kind === 'error' && (
            <div className="flex items-start gap-2 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950 rounded-lg px-3 py-2">
              <XCircle size={16} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Trimiterea a eșuat.</p>
                <p className="text-xs mt-0.5 font-mono break-all">{result.message}</p>
              </div>
            </div>
          )}

          <p className="flex items-start gap-1.5 text-xs text-slate-400 dark:text-slate-500">
            <Mail size={12} className="shrink-0 mt-0.5" />
            Testul de mai sus merge mereu doar la adresa de test de mai jos — indiferent de switch-ul de notificări.
          </p>
        </div>
      </div>

      <div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">Control notificări email</h3>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 sm:p-5 space-y-4">
          {loadingSettings || !settings ? (
            <div className="animate-pulse h-24 bg-slate-50 dark:bg-slate-800 rounded-lg" />
          ) : (
            <>
              {liveAndOpen && (
                <div className="flex items-start gap-2 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950 rounded-lg px-3 py-2">
                  <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                  <p>Notificările sunt pornite ȘI modul de testare e oprit — orice mail automat viitor (digest, alerte) va ajunge la adresele reale ale destinatarilor, nu la adresa de test.</p>
                </div>
              )}
              {!liveAndOpen && (
                <div className="flex items-start gap-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950 rounded-lg px-3 py-2">
                  <ShieldCheck size={16} className="shrink-0 mt-0.5" />
                  <p>
                    {!settings.notificationsEnabled
                      ? 'Notificările automate sunt oprite — deocamdată nu pleacă niciun mail automat (digestul zilnic nu e încă construit).'
                      : 'Modul de testare e pornit — orice mail automat merge doar la adresa de test de mai jos, nu la destinatarii reali.'}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 py-1">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Notificări automate</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Switch general — oprește instant orice viitoare trimitere automată (digest, alerte).</p>
                </div>
                {savingKey === 'notificationsEnabled' ? (
                  <Loader2 size={16} className="animate-spin text-slate-300 dark:text-slate-600 shrink-0" />
                ) : (
                  <button
                    type="button"
                    onClick={() => patchSettings({ notificationsEnabled: !settings.notificationsEnabled }, 'notificationsEnabled')}
                    aria-pressed={settings.notificationsEnabled}
                    className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                      settings.notificationsEnabled
                        ? 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950 hover:bg-green-100 dark:hover:bg-green-900'
                        : 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {settings.notificationsEnabled ? 'Pornite' : 'Oprite'}
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 py-1 border-t border-slate-100 dark:border-slate-800 pt-4">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Mod testare</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Cât timp e pornit, orice mail automat e redirecționat la adresa de test — nu la destinatarul real.</p>
                </div>
                {savingKey === 'testModeEnabled' ? (
                  <Loader2 size={16} className="animate-spin text-slate-300 dark:text-slate-600 shrink-0" />
                ) : (
                  <button
                    type="button"
                    onClick={() => patchSettings({ testModeEnabled: !settings.testModeEnabled }, 'testModeEnabled')}
                    aria-pressed={settings.testModeEnabled}
                    className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                      settings.testModeEnabled
                        ? 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950 hover:bg-green-100 dark:hover:bg-green-900'
                        : 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {settings.testModeEnabled ? 'Pornit' : 'Oprit'}
                  </button>
                )}
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">Adresă de test</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">Folosită de &bdquo;Trimite test&rdquo; de mai sus și, cât timp modul de testare e pornit, de orice mail automat.</p>
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={recipientDraft}
                    onChange={(e) => setRecipientDraft(e.target.value)}
                    className="flex-1 min-w-0 px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="online@jinfotours.ro"
                  />
                  <button
                    type="button"
                    onClick={() => patchSettings({ testRecipient: recipientDraft }, 'testRecipient')}
                    disabled={savingKey === 'testRecipient' || !recipientDraft.trim() || recipientDraft === settings.testRecipient}
                    className="shrink-0 px-3 py-1.5 text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {savingKey === 'testRecipient' ? <Loader2 size={14} className="animate-spin" /> : 'Salvează'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
