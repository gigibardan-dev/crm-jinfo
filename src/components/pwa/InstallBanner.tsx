'use client'

/**
 * src/components/pwa/InstallBanner.tsx
 *
 * InstallBanner
 *
 * Banner discret, fix jos, „Vrei un acces mai rapid? Instalează aplicația."
 * — apare DOAR când browserul chiar poate instala aplicația ca PWA (Chrome/
 * Edge/Android): ne agățăm de evenimentul `beforeinstallprompt`, care nu se
 * declanșează deloc dacă aplicația e deja instalată sau dacă browserul nu
 * suportă instalarea (ex. Safari pe iOS) — deci nu mai trebuie verificat
 * separat "e instalată?"/"suportă browserul?", evenimentul însuși e regula.
 *
 * Regulă de afișare (simplă, cerută explicit „nu vreau ceva complicat"):
 * - apare cu o mică întârziere (2s) după încărcare, ca să nu sară peste
 *   restul paginii;
 * - la „Închide" (X) sau după orice răspuns la promptul nativ de instalare
 *   (acceptat sau refuzat), salvăm timestamp-ul în localStorage și nu mai
 *   arătăm banner-ul timp de 14 zile de pe același dispozitiv/browser.
 *
 * Montat în src/app/(app)/layout.tsx — doar pe paginile autentificate (nu
 * și pe /login).
 */

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

const DISMISS_KEY = 'pwa-install-banner-dismissed-at'
const SNOOZE_DAYS = 14

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault()

      const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0)
      const daysSinceDismiss = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24)
      if (dismissedAt && daysSinceDismiss < SNOOZE_DAYS) return

      setDeferredPrompt(e as BeforeInstallPromptEvent)
      timer = setTimeout(() => setVisible(true), 2000)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      if (timer) clearTimeout(timer)
    }
  }, [])

  function snooze() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setVisible(false)
  }

  async function install() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    await deferredPrompt.userChoice // acceptat sau refuzat — oricum, nu mai insistăm curând
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setDeferredPrompt(null)
    setVisible(false)
  }

  if (!visible || !deferredPrompt) return null

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 p-3 sm:p-4 lg:pl-60 pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg px-4 py-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
          <Download size={16} />
        </div>
        <p className="flex-1 text-sm text-slate-700 dark:text-slate-300 min-w-0">
          <span className="font-medium text-slate-900 dark:text-slate-100">Vrei un acces mai rapid? </span>
          Instalează aplicația pe dispozitivul tău.
        </p>
        <button
          onClick={install}
          className="shrink-0 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Instalează
        </button>
        <button
          onClick={snooze}
          aria-label="Închide"
          title="Închide"
          className="shrink-0 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
