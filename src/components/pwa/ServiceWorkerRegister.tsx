'use client'

/**
 * src/components/pwa/ServiceWorkerRegister.tsx
 *
 * ServiceWorkerRegister
 *
 * Înregistrează public/sw.js la montarea layout-ului rădăcină — necesar
 * pt. ca browserul să considere aplicația instalabilă (PWA). Nu randează
 * nimic; eșuează silențios dacă `serviceWorker` nu e disponibil (ex. HTTP
 * simplu în dev fără localhost, browsere vechi) — nu blochează restul
 * aplicației.
 */

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  return null
}
