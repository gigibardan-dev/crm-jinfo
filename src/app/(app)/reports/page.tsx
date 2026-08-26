'use client'

/**
 * src/app/(app)/reports/page.tsx
 *
 * Reports Page — Placeholder pentru Faza 3
 *
 * Va conține: KPI-uri, conversie per sursă/agent, timp răspuns, export CSV
 */

import { useAuth } from '@/lib/hooks/useAuth'
import { Header } from '@/components/layout/Header'
import { BarChart3 } from 'lucide-react'

export default function ReportsPage() {
  const { isAdminOrManager } = useAuth()

  if (!isAdminOrManager) {
    return (
      <>
        <Header title="Rapoarte" />
        <div className="p-4 sm:p-6 text-sm text-slate-500 dark:text-slate-400">Nu ai acces la această pagină.</div>
      </>
    )
  }

  return (
    <>
      <Header title="Rapoarte" />
      <div className="p-4 sm:p-6 flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-4">
            <BarChart3 size={28} />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">Rapoarte si Analytics</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
            Modul de rapoarte va fi disponibil în Faza 3: KPI-uri, conversie per sursă și agent, timp de răspuns, export CSV.
          </p>
        </div>
      </div>
    </>
  )
}
