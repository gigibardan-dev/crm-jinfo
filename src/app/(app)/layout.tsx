'use client'

/**
 * App Layout (authenticated pages)
 * 
 * Wraps all authenticated routes with:
 * - AuthProvider (user/profile context)
 * - ToastProvider (notification feedback)
 * - Sidebar (left navigation)
 */

import { AuthProvider } from '@/lib/hooks/useAuth'
import { ToastProvider } from '@/components/ui/Toast'
import { Sidebar } from '@/components/layout/Sidebar'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <ToastProvider>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
          <Sidebar />
          <main className="ml-60">
            {children}
          </main>
        </div>
      </ToastProvider>
    </AuthProvider>
  )
}
