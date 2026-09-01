'use client'

/**
 * src/app/(app)/layout.tsx
 *
 * App Layout (authenticated pages)
 *
 * Wraps all authenticated routes with:
 * - AuthProvider (user/profile context)
 * - PresenceProvider (prezență live — cine e conectat acum — vezi
 *   src/lib/hooks/usePresence.tsx; sub AuthProvider, are nevoie de user/profil)
 * - ToastProvider (notification feedback)
 * - MobileNavProvider (stare deschis/închis pentru sertarul de nav pe mobil)
 * - Sidebar (left navigation — sertar pe mobil, fix pe desktop de la `lg`)
 * - InstallBanner (banner PWA „instalează aplicația", doar pe pagini
 *   autentificate — vezi src/components/pwa/InstallBanner.tsx)
 */

import { AuthProvider } from '@/lib/hooks/useAuth'
import { PresenceProvider } from '@/lib/hooks/usePresence'
import { ToastProvider } from '@/components/ui/Toast'
import { MobileNavProvider } from '@/lib/hooks/useMobileNav'
import { Sidebar } from '@/components/layout/Sidebar'
import { InstallBanner } from '@/components/pwa/InstallBanner'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <PresenceProvider>
        <ToastProvider>
          <MobileNavProvider>
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
              <Sidebar />
              <main className="lg:ml-60">
                {children}
              </main>
              <InstallBanner />
            </div>
          </MobileNavProvider>
        </ToastProvider>
      </PresenceProvider>
    </AuthProvider>
  )
}
