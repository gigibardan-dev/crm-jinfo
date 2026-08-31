/**
 * src/app/layout.tsx
 *
 * Root Layout
 *
 * Layout-ul rădăcină Next.js (App Router) — setează <html>/<body>, metadata
 * globală (titlu/descriere/icons/manifest — vezi PWA mai jos) și importă
 * CSS-ul global (Tailwind + tema). Nu conține navigare sau auth — acelea
 * sunt în src/app/(app)/layout.tsx.
 *
 * PWA / instalabil — setul de icoane a fost generat cu favicon.io și pus
 * direct în /public (favicon.ico, favicon-16x16.png, favicon-32x32.png,
 * apple-touch-icon.png, android-chrome-192x192.png, android-chrome-512x512.png
 * + public/site.webmanifest, completat manual cu name/short_name/start_url/
 * theme_color — favicon.io le lasă goale). Ca butonul de „Instalează" să
 * apară în Chrome/Edge, mai era nevoie de:
 * - `metadata.manifest` mai jos → randează <link rel="manifest">;
 * - `metadata.icons`/`appleWebApp` → favicon + iconul de pe iOS la
 *   „Adaugă pe ecranul principal";
 * - un service worker înregistrat (criteriu obligatoriu de instalabilitate)
 *   — vezi public/sw.js + <ServiceWorkerRegister /> mai jos; nu face
 *   caching, doar există.
 * S-a șters vechiul src/app/favicon.ico (convenția specială Next.js) —
 * intra în conflict de rută cu noul public/favicon.ico.
 */

import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister'

export const metadata: Metadata = {
  title: 'JinfoTours CRM',
  description: 'Sistem CRM pentru managementul leadurilor JinfoTours',
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'JinfoTours CRM',
  },
}

export const viewport: Viewport = {
  themeColor: '#2563eb',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ro">
      <body className="font-sans antialiased">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
