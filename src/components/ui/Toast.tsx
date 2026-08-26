'use client'

/**
 * src/components/ui/Toast.tsx
 *
 * Toast Notification System
 *
 * Provides visual feedback for user actions (lead saved, assigned, etc.)
 * 
 * Usage:
 *   1. Wrap your app with <ToastProvider>
 *   2. Use the hook: const { toast } = useToast()
 *   3. Call: toast({ title: 'Lead salvat', variant: 'success' })
 * 
 * Variants: success, error, info, warning
 * Auto-dismisses after 4 seconds by default
 */

import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// --- Types ---

type ToastVariant = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: string
  title: string
  description?: string
  variant: ToastVariant
  duration?: number
}

interface ToastContextType {
  toast: (opts: Omit<Toast, 'id'>) => void
}

// --- Config ---

const VARIANT_CONFIG: Record<ToastVariant, {
  icon: typeof CheckCircle2
  containerClass: string
  iconClass: string
}> = {
  success: {
    icon: CheckCircle2,
    containerClass: 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800',
    iconClass: 'text-green-600 dark:text-green-400',
  },
  error: {
    icon: XCircle,
    containerClass: 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800',
    iconClass: 'text-red-600 dark:text-red-400',
  },
  info: {
    icon: Info,
    containerClass: 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800',
    iconClass: 'text-blue-600 dark:text-blue-400',
  },
  warning: {
    icon: AlertTriangle,
    containerClass: 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800',
    iconClass: 'text-amber-600 dark:text-amber-400',
  },
}

// --- Context ---

const ToastContext = createContext<ToastContextType>({
  toast: () => {},
})

export function useToast() {
  return useContext(ToastContext)
}

// --- Single Toast Component ---

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const config = VARIANT_CONFIG[toast.variant]
  const Icon = config.icon

  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id)
    }, toast.duration || 4000)

    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, onDismiss])

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg',
        'animate-in slide-in-from-top-2 fade-in duration-200',
        'w-full sm:min-w-[300px] sm:w-auto max-w-[420px]',
        config.containerClass,
      )}
    >
      <Icon size={18} className={cn('mt-0.5 flex-shrink-0', config.iconClass)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{toast.title}</p>
        {toast.description && (
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{toast.description}</p>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex-shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  )
}

// --- Provider ---

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((opts: Omit<Toast, 'id'>) => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { ...opts, id }])
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}

      {/* Toast container - fixed top right */}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 left-4 sm:left-auto z-50 flex flex-col gap-2 items-stretch sm:items-end">
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={dismissToast} />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}
