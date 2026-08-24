'use client'

import { useAuth } from '@/lib/hooks/useAuth'
import { Header } from '@/components/layout/Header'
import { BarChart3 } from 'lucide-react'

export default function ReportsPage() {
  const { isAdminOrManager } = useAuth()

  if (!isAdminOrManager) {
    return (
      <>
        <Header title="Rapoarte" />
        <div className="p-6 text-sm text-slate-500">Nu ai acces la această pagină.</div>
      </>
    )
  }

  return (
    <>
      <Header title="Rapoarte" />
      <div className="p-6 flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
            <BarChart3 size={28} />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">Rapoarte & Analytics</h3>
          <p className="text-sm text-slate-500 max-w-sm">
            Modul de rapoarte va fi disponibil în Faza 3: KPI-uri, conversie per sursă și agent, timp de răspuns, export CSV.
          </p>
        </div>
      </div>
    </>
  )
}
