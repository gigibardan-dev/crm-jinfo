/**
 * src/app/layout.tsx
 *
 * Root Layout
 *
 * Layout-ul rădăcină Next.js (App Router) — setează <html>/<body>, metadata
 * globală (titlu/descriere) și importă CSS-ul global (Tailwind + tema).
 * Nu conține navigare sau auth — acelea sunt în src/app/(app)/layout.tsx.
 */

import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'JinfoTours CRM',
  description: 'Sistem CRM pentru managementul leadurilor JinfoTours',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ro">
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
