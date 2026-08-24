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
