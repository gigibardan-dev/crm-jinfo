'use client'

/**
 * src/app/(app)/layout.tsx
 *
 * App Layout (authenticated pages)
 *
 * Wraps all authenticated routes with:
 * - AuthProvider (user/profile context)
 * - ToastProvider (notification feedback)
 * - MobileNavProvider (stare deschis/închis pentru sertarul de nav pe mobil)
 * - Sidebar (left navigation — sertar pe mobil, fix pe desktop de la `lg`)
 */

import { AuthProvider } from '@/lib/hooks/useAuth'
import { ToastProvider } from '@/components/ui/Toast'
import { MobileNavProvider } from '@/lib/hooks/useMobileNav'
import { Sidebar } from '@/components/layout/Sidebar'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <ToastProvider>
        <MobileNavProvider>
          <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            <Sidebar />
            <main className="lg:ml-60">
              {children}
            </main>
          </div>
        </MobileNavProvider>
      </ToastProvider>
    </AuthProvider>
  )
}
