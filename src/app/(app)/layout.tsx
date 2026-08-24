'use client'

import { AuthProvider } from '@/lib/hooks/useAuth'
import { Sidebar } from '@/components/layout/Sidebar'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-slate-50">
        <Sidebar />
        <main className="ml-60">
          {children}
        </main>
      </div>
    </AuthProvider>
  )
}
